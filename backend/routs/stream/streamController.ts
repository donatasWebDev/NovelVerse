import { Request, Response } from 'express';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import crypto from 'crypto';
import { get } from 'http';
import dotenv from "dotenv"

dotenv.config()

const s3 = new S3Client({ region: 'us-east-1' }); // your region
const BUCKET = process.env.BUCKET;
const FLASK_URL = process.env.PY_SERVER_URL;

if (!BUCKET) {
  throw new Error("S3 Bucket name not found")
}
if (!FLASK_URL) {
  throw new Error("Flask Url not found")
}


function getS3Key(book_url: string, chapter_nr: string | number): string {

  const normalized = book_url.trim().toLowerCase().replace(/\/$/, '');

  // Use md5
  const hash = crypto.createHash('md5')
    .update(normalized)
    .digest('hex');

  // Take first 16 characters 
  const shortHash = hash.slice(0, 16);

  return `audio/${shortHash}/chapter_${chapter_nr}-v1.opus`;
}

ffmpeg.setFfmpegPath('./ffmpeg.exe'); // your local path

export const streamController = async (req: Request, res: Response) => {
  const { book_url, chapter_nr, preload = '2' } = req.query;

  if (!book_url || !chapter_nr) {
    res.status(400).json({ error: 'Missing book_url or chapter_nr' });
    return;
  }

  const s3Key = getS3Key(book_url as string, chapter_nr as string);

  try {
    // HEAD check for existence
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: s3Key }));
    console.log('Cache hit – serving from S3');

    const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
    if (!Body) throw new Error('No body from S3');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const mp3Stream = ffmpeg(Body as Readable)
      .inputFormat('ogg')
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .audioFrequency(24000)     // match your source
      .audioChannels(1)          // mono
      .format('mp3')
      .outputOptions([
        '-bufsize', '256k',      // helps smooth streaming
        '-flush_packets', '1'    // lower latency flushing
      ])
      .on('error', (err: any) => {
        console.error('FFmpeg error:', err);
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });

    // Target: ~8 seconds → 128 kbit/s = 16 kB/s → 128 kB
    const TARGET_CHUNK_BYTES = 128 * 1024;

    let buffer = Buffer.alloc(0);

    mp3Stream.pipe().on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= TARGET_CHUNK_BYTES) {
        const toSend = buffer.subarray(0, TARGET_CHUNK_BYTES);
        const base64 = toSend.toString('base64');

        res.write(`data: {"status":"chunk","audio_bytes":"${base64}"}\n\n`);

        buffer = buffer.subarray(TARGET_CHUNK_BYTES);
      }
    });

    mp3Stream.on('end', () => {
      if (buffer.length > 0) {
        const base64 = buffer.toString('base64');
        res.write(`data: {"status":"chunk","audio_bytes":"${base64}"}\n\n`);
      }
      res.write(`data: {"status":"complete"}\n\n`);
      res.end();
      console.log('Finished streaming from S3');
    });

    // Clean up on client disconnect
    req.on('close', () => {
      mp3Stream.kill('SIGKILL');
      console.log('Client disconnected – killed ffmpeg');
    });

  } catch (err: any) {
    if (err.name === 'NotFound') {
      console.log('Cache miss – proxy to Flask');
      await proxyToFlask(req, res, book_url as string, chapter_nr as string, preload as string);
    } else {
      console.error('S3 check failed:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Cache check failed' });
      else res.end();
    }
  }
};

async function proxyToFlask(req: Request, res: Response, book_url: string, chapter_nr: string, preload: string) {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const flaskUrl = `${FLASK_URL}/stream?book_url=${encodeURIComponent(book_url)}&chapter_nr=${chapter_nr}&preload=${preload}`;
    console.log('Proxying to Flask:', flaskUrl);

    const flaskRes = await fetch(flaskUrl, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
    });

    if (!flaskRes.ok || !flaskRes.body) {
      console.error(`Flask responded with ${flaskRes.status}`);
      if (!res.headersSent) res.status(500).json({ error: 'Flask failed' });
      return;
    }

    const reader = flaskRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      res.write(chunkText);
    }

    res.end();

  } catch (error) {
    console.error('Proxy error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Proxy failed' });
    else res.end();
  }
}