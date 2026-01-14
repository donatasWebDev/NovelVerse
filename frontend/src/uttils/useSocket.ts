import axios from 'axios'
import { body } from 'framer-motion/client'
import { useState, useRef, useCallback, useEffect } from 'react'

const DEFAULT_STREAM_URL =
  import.meta.env.VITE_API_STREAM_URL || 'http://localhost:5000/stream'

const isDev = import.meta.env.DEV

let streamUrl: string

if (isDev) {
  streamUrl = DEFAULT_STREAM_URL
} else {
  streamUrl = DEFAULT_STREAM_URL
}
export const useSocket = (url: string = streamUrl) => {
  const eventSourceRef = useRef<EventSource | null>(null)

  const [messages, setMessages] = useState<any[]>([])
  const [audio, setAudio] = useState<ArrayBuffer[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<{
    key: string | null
    user_id: string | null
  }>()

  const startJob = useCallback(
    async (
      key: string,
      user_id: string,
      book_url: string,
      chapter_nr: string
    ) => {
      console.log('starting Job')

      const API_KEY: string = import.meta.env.VITE_STREAM_API_KEY
      setData({ key, user_id })
      if (!API_KEY) {
        console.error('No API KEY FOUND')
        return
      }

      try {
        const res = await axios.post(
          `${url}/run`,
          {
            input: {
              book_url,
              chapter_nr,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        )
        if (res) {
          console.log('got id', res.data.id)
          return res.data.id
        }
      } catch (error) {
        console.log(error)
      }
    },
    []
  )
  const connect = useCallback(
    async (jobId: string) => {
      if (!jobId) {
        console.error('No jobId')
        return
      }

      const API_KEY = import.meta.env.VITE_STREAM_API_KEY
      if (!API_KEY) {
        console.error('No API key')
        return
      }

      console.log(`Starting stream polling for job ${jobId}`)

      let isPolling = true
      let lastProcessedIndex = 0

      const poll = async () => {
        while (isPolling) {
          try {
            const res = await fetch(`${url}/stream/${jobId}`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${API_KEY}`,
              },
            })

            if (!res.ok) {
              throw new Error(`Poll failed: ${res.status} ${await res.text()}`)
            }

            const data = await res.json()

            console.log('Poll response:', data)

            if (data.stream && Array.isArray(data.stream)) {
              data.stream.forEach((item: { output: string }) => {
                try {
                  // Clean the output string
                  const cleaned = item.output.trim().replace(/\n$/, '')
                  const obj = JSON.parse(cleaned)

                  switch (obj.status) {
                    case 'chunk':
                      if (obj.audio_bytes) {
                        const binaryString = atob(obj.audio_bytes)
                        const bytes = new Uint8Array(binaryString.length)
                        for (let i = 0; i < binaryString.length; i++) {
                          bytes[i] = binaryString.charCodeAt(i)
                        }
                        setAudio((prev) => [...prev, bytes.buffer])
                        console.log(
                          'Added audio chunk | total now:',
                          audio.length + 1
                        )
                      }
                      break

                    case 'error':
                      console.error('TTS error:', obj.message)
                      setError(new Error(obj.message || 'Generation error'))
                      isPolling = false
                      break

                    default:
                      // started, audio-info, complete, etc.
                      console.log(`Status update: ${obj.status}`, obj)
                      setMessages((prev) => [...prev, obj])
                      break
                  }

                  // Optional early stop if complete appears
                  if (obj.status === 'complete') {
                    isPolling = false
                    console.log('Complete inside chunks → stopping')
                  }
                } catch (e) {
                  console.error('Parse failed for output:', item.output, e)
                }
              })
            }

            // Still stop on overall COMPLETED
            if (data.status === 'COMPLETED') {
              console.log('Job COMPLETED → stopping poll')
              isPolling = false
              setIsConnected(false)
            }

            setIsConnected(true)
          } catch (err) {
            console.error('Polling error:', err)
            setError(err as any)
            isPolling = false
            setIsConnected(false)
          }

          // Poll interval – 600-1000ms is good for TTS chunks
          await new Promise((r) => setTimeout(r, 800))
        }
      }

      poll()

      return () => {
        isPolling = false
      }
    },
    [url]
  )

  const disconnect = useCallback(() => {
    console.log('Disconnecting SSE')
    const source = eventSourceRef.current

    if (!source) {
      console.log('No active SSE to close')
      return
    }

    source.close()
    eventSourceRef.current = null

    setIsConnected(false)
    setMessages([])
    setAudio([])
  }, [])

  const clearAudioBuffer = useCallback((): void => {
    setAudio([])
  }, [])

  const sendMessage = useCallback((message: any) => {
    console.warn('sendMessage not supported in SSE mode (one-way stream)')
    // If you need to send more commands later, add separate POST endpoints
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    connect,
    disconnect,
    sendMessage,
    messages,
    startJob,
    clearAudioBuffer,
    audio,
    isConnected,
    socketRef: eventSourceRef,
    error,
    data,
  }
}
