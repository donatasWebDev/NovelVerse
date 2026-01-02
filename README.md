# NovelVerse: Real-Time Full-Stack Audiobook Streaming Application

*An In-Depth Case Study*

This case study explores **NovelVerse**, a personal full-stack web application that scrapes web novels, generates high-quality audiobooks using text-to-speech (TTS), and streams them in real-time. Designed as a portfolio project, it highlights expertise in hybrid language architecture, real-time systems, web scraping, audio processing, and secure user management.

### NovelVerse — Real-Time Web Novel Audiobook Streaming App

[![NovelVerse Demo](https://img.youtube.com/vi/o9cOABC1nu0/maxresdefault.jpg)](https://www.youtube.com/watch?v=o9cOABC1nu0)

A full-stack application that turns web novels into audiobooks on demand. It scrapes chapters in real-time, generates natural-sounding speech using a GPU-accelerated neural TTS engine, and streams audio seamlessly over WebSockets.

**Key Features**
- On-demand scraping and real-time audio generation
- Low-latency streaming with adaptive buffering
- Secure JWT authentication and private user libraries
- Progress tracking across sessions
- Hybrid architecture combining React, Node.js, and Python services

## Project Overview

NovelVerse lets users discover web novels, build private libraries, track reading progress, and listen to chapters as natural-sounding audio generated on-demand. Content is scraped in real-time, converted via a neural TTS engine, and streamed over WebSockets for low-latency playback—no pre-generated files or long waits required.

**Key goals**

- Instant scraping and streaming for seamless playback
- GPU acceleration for efficient, high-quality voice synthesis
- Secure authentication and personalized progress tracking

The app runs locallw with Docker and is being prepared for cloud deployment (e.g., RunPod for scalable GPU support).

## Technology Tree

```
Root Application
├── Languages & Runtime
│   ├── TypeScript (frontend & backend)
│   └── Python 3.10+ (real-time processing)
├── Containerization
│   └── Docker (frontend, backend, Python service)
└── Configuration
    └── .env files (DATABASE_URL, VITE_WS_URL, ports)

Frontend Layer
├── Framework: React + Vite
├── State & Routing: React Context + React Router
├── Real-Time: Native WebSocket client (useSocket hook)
└── Playback: Web Audio API (Player component, base64 MP3 decoding)

Backend Layer
├── Server: Node.js + Express (TypeScript)
├── Authentication: JWT + bcrypt
├── ORM: Prisma (MongoDB)
└── Database: MongoDB (users, books, favorites, progress)

Python Service Layer
├── Runtime: asyncio + threading
├── WebSocket Server: websockets library
├── Scraping: requests + BeautifulSoup
├── TTS Engine: Kokoro (neural, GPU via torch.cuda)
├── Audio Processing: numpy (buffering) + pydub (MP3 export)
└── Concurrency: task_queue (multi-worker threads, per-socket queues)

Cross-Cutting
├── Protocols: HTTP (API) + WebSocket (streaming)
└── Performance: GPU auto-detection + adaptive buffering
```

## System Architecture

A loosely coupled, microservices-style design:

- **Frontend ↔ Backend**: HTTP REST for authentication and library data
- **Frontend ↔ Python Server**: Direct WebSocket for real-time audio streaming
- **Python Server ↔ Backend**: HTTP verification endpoint for secure socket handshakes

This keeps the UI responsive while offloading heavy computation to Python.

## Key Workflows

### Database & Library Workflow

1. User registers/logs in → `POST /api/user/*` → Prisma creates/finds record → JWT issued
2. Fetch library → `GET /api/lib/books` → Prisma query with relations → Personalized book list returned
3. Save progress → Frontend POST → Prisma upserts `LatestRead` model

### Real-Time Streaming Workflow

1. Player page loads → Frontend opens WebSocket and sends streamKey + userId
2. Python server verifies via `POST /api/lib/verify`
3. User requests chapter → Frontend sends `"play <url> <chapter>"`
4. Python scrapes content → Queues TTS task → Workers generate audio (Kokoro on GPU/CPU)
5. Audio buffered (20s initial warmup) → Converted to MP3 chunks → Base64-encoded → Sent over WebSocket
6. Frontend decodes and plays; supports `"to <seconds>"` (seek) and `"stop"`

### TTS Generation Workflow

1. Scrape and clean chapter text
2. Kokoro pipeline splits text and synthesizes audio tensors
3. Convert tensors → numpy arrays → pydub MP3 export (requires ffmpeg)
4. Chunk, encode, and stream with metadata (duration, WPM)

GPU acceleration significantly reduces inference time compared to CPU fallback.

## End-to-End User Flow

1. **Login** → JWT stored in context
2. **Browse library** → API fetch → Navigate to player page (`/play/:id/:chapter`)
3. **Connect WebSocket** → Authenticated handshake
4. **Request chapter** → Scraping + TTS begins
5. **Stream & play** → Real-time audio with smooth buffering
6. **Finish session** → Progress automatically synced to database

## Challenges & Solutions

| Challenge                 | Solution                                   |
| ------------------------- | ------------------------------------------ |
| TTS latency on CPU        | GPU auto-detection + chunked streaming     |
| Scraping fragility        | Modular parsers (easy updates)             |
| Concurrent streams        | Threaded workers + per-connection queues   |
| Browser autoplay policies | User-initiated playback via interactive UI |

## Future Enhancements

- Dynamic worker scaling for more concurrent users
- Additional voice options and speed controls
- Full cloud deployment with monitoring
- Comprehensive testing (unit, integration, E2E)

NovelVerse is a solid demonstration of modern full-stack development, blending web technologies with real-time AI processing. It showcases clean architecture, performance optimization, and cross-language integration—making it an excellent portfolio piece for highlighting technical depth.
