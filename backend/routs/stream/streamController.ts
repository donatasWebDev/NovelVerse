import { Request, Response } from 'express'
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'
import { Readable, PassThrough, Transform, TransformCallback } from 'stream'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

const s3 = new S3Client({ region: 'us-east-1' })
const BUCKET = process.env.BUCKET
const FLASK_URL = process.env.SPOT_API_BASE

if (!BUCKET) throw new Error('S3 Bucket name not found')
if (!FLASK_URL) throw new Error('Flask URL not found')

ffmpeg.setFfmpegPath(ffmpegPath.path)

// Generates deterministic S3 key from book URL + chapter
function getS3Key(bookUrl: string, chapterNr: string | number): string {
  const normalized = bookUrl.trim().toLowerCase().replace(/\/$/, '')
  const hash = crypto.createHash('md5').update(normalized).digest('hex')
  return `audio/${hash.slice(0, 16)}/chapter_${chapterNr}-v1.opus`
}

// Sets SSE headers once
function setStreamingHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
}

// Streams ffmpeg output as base64 SSE chunks
function streamToSseChunks(ffmpegCmd: any, res: Response): void {
  let buffer = Buffer.alloc(0)
  const chunkSize = 128 * 1024 // ~8s at 128 kbit/s

  const outputStream = ffmpegCmd
    .on('error', (err: any) => {
      console.error('FFmpeg error:', err)
      if (!res.headersSent) res.status(500).end()
      else res.end()
    })
    .pipe()

  outputStream.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length >= chunkSize) {
      const part = buffer.subarray(0, chunkSize)
      res.write(
        `data: {"status":"chunk","audio_bytes":"${part.toString('base64')}"}\n\n`,
      )
      buffer = buffer.subarray(chunkSize)
    }
  })

  outputStream.on('end', () => {
    if (buffer.length > 0) {
      res.write(
        `data: {"status":"chunk","audio_bytes":"${buffer.toString('base64')}"}\n\n`,
      )
    }
    res.write(`data: {"status":"complete"}\n\n`)
    res.end()
  })

  outputStream.on('error', (err: any) => {
    console.error('FFmpeg error:', err)
    if (!res.headersSent) res.status(500).end()
    else res.end()
  })
}

// Fallback: proxy stream directly from Flask
async function proxyToFlask(
  req: Request,
  res: Response,
  bookUrl: string,
  chapterNr: string,
  preload: string,
): Promise<void> {
  setStreamingHeaders(res)

  const url = `${FLASK_URL}/stream?book_url=${encodeURIComponent(bookUrl)}&chapter_nr=${chapterNr}&preload=${preload}`

  try {
    const flaskRes = await fetch(url, {
      headers: { Accept: 'text/event-stream' },
    })

    if (!flaskRes.ok || !flaskRes.body) {
      throw new Error(`Flask responded with ${flaskRes.status}`)
    }

    const reader = flaskRes.body.getReader()
    const decoder = new TextDecoder()

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          if (value) {
            const chunkText = decoder.decode(value, { stream: true })
            res.write(chunkText)
          }
        }
        res.end()
      } catch (err) {
        console.error('Stream read error:', err)
        res.end()
      }
    }

    pump().catch((err) => {
      console.error('Pump error:', err)
      if (!res.headersSent) res.status(500).end()
    })

    // Cleanup on client disconnect
    req.on('close', () => {
      reader.cancel().catch(() => {})
      res.end()
      console.log('Client disconnected – cancelled Flask stream')
    })
  } catch (err) {
    console.error('Proxy error:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Proxy failed' })
    else res.end()
  }
}

// Main entry point
export const streamController = async (req: Request, res: Response) => {
  const { book_url, chapter_nr, preload = '2' } = req.query

  if (!book_url || !chapter_nr) {
    res.status(400).json({ error: 'Missing book_url or chapter_nr' })
    return
  }

  const bookUrlStr = book_url as string
  const chapterNrStr = chapter_nr as string

  const s3Key = getS3Key(bookUrlStr, chapterNrStr)

  try {
    // Fast existence check
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: s3Key }))

    // Cache miss → fetch from S3 once
    const metaResp  = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: s3Key, Range: 'bytes=0-65535' }),
    )

    if (!metaResp.Body) throw new Error ("No Stream, Cache missed")

    setStreamingHeaders(res)

    const metadata = await mm.parseStream(metaResp.Body as Readable, {
      mimeType: 'audio/ogg',
    })

    const vorbisTags = metadata.native?.vorbis ?? [] // ← lowercase 'v'

    let durationFromTag: number | undefined
    let fullText = ''
    let wpmFromTag: number | undefined

    for (const tag of vorbisTags) {
      const key = tag.id.toUpperCase()

      if (key === 'DURATION') durationFromTag = parseFloat(tag.value as string)
      if (key === 'LYRICS') fullText = tag.value as string
      if (key === 'WPM') wpmFromTag = parseFloat(tag.value as string)
    }

    // Fallbacks
    const duration = durationFromTag ?? 0

    res.write(
      `data: ${JSON.stringify({
        status: 'audio-info',
        duration,
        WPM: wpmFromTag ?? null,
        text: fullText,
      })}\n\n`,
    )

    const ffmpegStream  = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }),
    )

    const mp3Stream = ffmpeg(ffmpegStream.Body as Readable)
      .inputFormat('ogg')
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .audioFrequency(48000)
      .audioChannels(1)
      .format('mp3')
      .outputOptions(['-bufsize', '256k', '-flush_packets', '1'])

    if (!mp3Stream) throw new Error('No Mp3 Stream Made')

    streamToSseChunks(mp3Stream, res)

    req.on('close', () => mp3Stream.kill('SIGKILL'))
  } catch (err: any) {
    if (err.name === 'NotFound') {
      proxyToFlask(req, res, bookUrlStr, chapterNrStr, preload as string)
      return
    }

    console.error('S3 error:', err)
    if (!res.headersSent) res.status(500).json({ error: 'S3 error' })
    else res.end()
  }
}
