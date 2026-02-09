import axios from 'axios'
import { b, body } from 'framer-motion/client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { EventSourcePolyfill } from 'event-source-polyfill'
import Cookies from 'js-cookie'

console.log('All env vars:', import.meta.env)
console.log('Specific:', import.meta.env.VITE_API_STREAM_URL)
const DEFAULT_STREAM_URL =
  import.meta.env.VITE_API_STREAM_URL || 'http://localhost:5000/api/'

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

  const connect = useCallback(
    (key: string, user_id: string, book_url: string, chapter_nr: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      setError(null)

      // Build URL with query params
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

      const es: EventSourcePolyfill = new EventSourcePolyfill(fullUrl, {
        // Use polyfill for headers
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true, // if cookies involved
        signal: controller.signal,
      })

      es.onopen = () => {
        console.log('SSE connected')
        eventSourceRef.current = es
        setIsConnected(true)
        setData({ key, user_id })
      }

      es.onmessage = (event: any) => {
        try {
          const obj = JSON.parse(event.data)

          switch (obj.status) {
            case 'chunk':
              const base64 = obj.audio_bytes
              const binaryString = atob(base64)
              const buffer = new Uint8Array(binaryString.length)

              for (let i = 0; i < binaryString.length; i++) {
                buffer[i] = binaryString.charCodeAt(i)
              }

              setAudio((prev) => [...prev, buffer.buffer])
              break
            case 'complete':
              if (eventSourceRef.current) eventSourceRef.current.close()
              console.log('source ended')
              break
            case 'error':
              setError(Error(obj.message))
              if (eventSourceRef.current) eventSourceRef.current.close()
              break
            default:
              console.log('Received message:', obj)
              setMessages((prev) => [...prev, obj])
              setMessages((prev) => [...prev, obj])
          }
        } catch (e: any) {
          setError(e)
          console.error('Message parse error:', e)
        }
      }

      es.onerror = (err: any) => {
        console.error('SSE error:', err)
        setError(err)
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

  // const sendMessage = useCallback((message: any) => {
  //   console.warn('sendMessage not supported in SSE mode (one-way stream)')
  //   // If you need to send more commands later, add separate POST endpoints
  // }, [])

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
