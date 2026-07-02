import { useState, useRef, useCallback, useEffect } from 'react'
import { EventSourcePolyfill } from 'event-source-polyfill'
import Cookies from 'js-cookie'

const DEFAULT_STREAM_URL =
  import.meta.env.VITE_API_STREAM_URL || 'http://localhost:5000/api/'

const streamUrl = DEFAULT_STREAM_URL

interface StreamMessage {
  status: string
  audio_bytes?: string
  message?: string
}

interface StreamData {
  key: string | null
  user_id: string | null
}

export const useSocket = (url: string = streamUrl) => {
  const eventSourceRef = useRef<EventSource | null>(null)

  const [messages, setMessages] = useState<StreamMessage[]>([])
  const [audio, setAudio] = useState<ArrayBuffer[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<StreamData>()

  const connect = useCallback(
    (key: string, user_id: string, book_url: string, chapter_nr: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      setError(null)

      const params = new URLSearchParams({
        book_url,
        chapter_nr,
      }).toString()

      const token = Cookies.get('userToken')
      if (!token) {
        throw new Error('No token')
      }

      const fullUrl = `${url}/stream?${params}`

      const controller = new AbortController()

      const es = new EventSourcePolyfill(fullUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
        signal: controller.signal,
      })

      es.onopen = () => {
        console.log('SSE connected')
        eventSourceRef.current = es
        setIsConnected(true)
        setData({ key, user_id })
      }

      es.onmessage = (event: MessageEvent<string>) => {
        try {
          const obj = JSON.parse(event.data) as StreamMessage

          switch (obj.status) {
            case 'chunk': {
              const base64 = obj.audio_bytes
              if (!base64) break
              const binaryString = atob(base64)
              const buffer = new Uint8Array(binaryString.length)

              for (let i = 0; i < binaryString.length; i++) {
                buffer[i] = binaryString.charCodeAt(i)
              }

              setAudio((prev) => [...prev, buffer.buffer])
              break
            }
            case 'complete':
              if (eventSourceRef.current) eventSourceRef.current.close()
              console.log('source ended')
              break
            case 'error':
              setError(new Error(obj.message ?? 'Stream error'))
              if (eventSourceRef.current) eventSourceRef.current.close()
              break
            default:
              console.log('Received message:', obj)
              setMessages((prev) => [...prev, obj])
          }
        } catch (e: unknown) {
          const parseError = e instanceof Error ? e : new Error('Message parse error')
          setError(parseError)
          console.error('Message parse error:', e)
        }
      }

      es.onerror = () => {
        const streamError = new Error('SSE connection error')
        console.error('SSE error:', streamError)
        setError(streamError)
        es.close()
        eventSourceRef.current = null
        setIsConnected(false)
      }

      eventSourceRef.current = es
    },
    [url],
  )

  const disconnect = useCallback(() => {
    console.log('Disconnecting SSE')
    const source = eventSourceRef.current
    if (!source) {
      console.log('No active SSE to close')
      return
    }

    setIsConnected(false)
    setMessages([])
    setAudio([])

    source.close()
    eventSourceRef.current = null
  }, [])

  const clearAudioBuffer = useCallback((): void => {
    console.log('clearing buffer')
    setAudio([])
    setMessages([])
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    connect,
    disconnect,
    messages,
    clearAudioBuffer,
    audio,
    isConnected,
    socketRef: eventSourceRef,
    error,
    data,
  }
}