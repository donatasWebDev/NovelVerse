/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_STREAM_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'event-source-polyfill' {
  export class EventSourcePolyfill extends EventSource {
    constructor(
      url: string,
      options?: EventSourceInit & {
        headers?: Record<string, string>
        withCredentials?: boolean
        signal?: AbortSignal
      },
    )
  }
}