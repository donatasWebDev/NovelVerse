# NovelVerse — Real-Time Web Novel Audiobook Streaming

*An In-Depth Case Study*

[![NovelVerse Demo](https://img.youtube.com/vi/o9cOABC1nu0/maxresdefault.jpg)](https://www.youtube.com/watch?v=o9cOABC1nu0)
*Click to watch: live scraping → GPU synthesis → seamless streaming*

NovelVerse turns web novels into instant audiobooks on demand. It scrapes chapters live, generates natural-sounding audio with GPU-accelerated neural TTS (Kokoro), caches efficiently in **AWS S3**, and streams low-latency audio via **Server-Sent Events** (SSE) — all proxied securely through Express.

Designed as a portfolio showcase for hybrid stacks, real-time binary streaming, cost-optimized cloud infra, and smart prefetching.

**Key Features**

- On-demand scraping + real-time TTS generation
- Adaptive low-latency SSE streaming with client buffering
- Secure JWT auth + private libraries with progress tracking
- Intelligent S3 caching + proactive 2-chapter preload
- Cost-efficient AWS spot GPU (auto-stops after 1h idle)

## Quick Tech Overview

- **Frontend** — React + Vite + TypeScript, Tailwind, Framer Motion, MediaSource Extensions
- **Backend** — Node.js + Express + TypeScript, Prisma (MongoDB), JWT + Redis sessions
- **Heavy Compute** — Python (asyncio + threads), Kokoro TTS (PyTorch GPU), cloudscraper
- **Streaming** — HTML SSE (proxied via Express), audio stored as Opus → streamed as MP3
- **Cloud** — Vercel (frontend/backend), AWS S3 (cache), AWS spot GPU instance (RunPod-style)
- **Storage** — MongoDB Atlas (users/books/progress), S3 (audio artifacts)

## How It Works (Core Flow)

1. User picks chapter → frontend requests short-lived stream token
2. Backend verifies → frontend opens SSE connection (proxied via Express)
3. Server checks S3 cache (hash-based key: `audio/{book-hash}/chapter_N-v1.opus`)
   - **Hit** → streams cached MP3 (<3s start)
   - **Miss** → wakes GPU spot instance if stopped → scrapes → TTS → streams live while uploading to S3 (~5s start)
4. While playing current chapter → **preloads next 2 chapters** in background → caches them for instant switch
5. Client appends chunks to MediaSource buffer → smooth playback with adaptive buffering
6. Progress auto-saved to DB every few seconds

**GPU Lifecycle**

- AWS spot instance stops after ~1 hour idle (CloudWatch CPU monitoring)
- Cold start ~5 min; handles ~10 concurrent threads (1 chain per user)
- Chapter generation: 1–2 min per thread → frees up quickly

**Performance Stats**

- Uncached chapter start: ~5 seconds
- Cached chapter start: <3 seconds
- Repeat plays / preloaded chapters: near-instant

## Challenges & Smart Solutions

| Challenge                | Solution                                          |
| ------------------------ | ------------------------------------------------- |
| GPU cost & idle waste    | AWS spot + 1h auto-stop via CloudWatch            |
| First-play latency       | S3 cache check + concurrent stream/upload         |
| Chapter switching delays | Preload & cache next 2 chapters during playback   |
| Scraping reliability     | Modular parsers + cloudscraper for CF bypass      |
| Browser compatibility    | Store Opus (efficient) → stream MP3 (universal)  |
| Security on GPU access   | Express proxy with rate limiting + JWT validation |

## Future Ideas

- Multi-GPU autoscaling + distributed queue
- Voice/speed variants in S3
- CloudFront for faster global cache hits
- Sequence numbers + recovery for dropped connections
- Full monitoring dashboard (cache hits, GPU usage, wake events)

NovelVerse combines real-time ML, thoughtful caching/prefetching, and production-grade cloud cost control — all in a clean full-stack personal project.
