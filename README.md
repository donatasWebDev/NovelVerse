# NovelVerse

> A small platform for scraping novels and streaming generated audio to clients via WebSockets. This repository contains a TypeScript backend, a React + Vite frontend, and a Python service for scraping and text-to-speech/socket logic.

## Repository layout

- `backend/` - TypeScript/Node backend (includes APIs and Prisma schema).
- `frontend/` - React + Vite TypeScript app (UI and player components).
- `py_server/` - Python services: scraping, websocket audio server, and supporting scripts. Includes Dockerfiles for various Python components.

## Quick features

- WebSocket audio streaming server (Python) that accepts a user key, scrapes novel content, converts it to audio, and streams MP3 chunks to clients.
- Frontend React app for browsing and playing audiobooks.
- Backend TypeScript API (with Prisma schema) that provides authentication and library endpoints.

## Prerequisites

- Node.js (v16+ recommended)
- npm or yarn
- Python 3.9+ (3.10+ recommended)
- pip
- Docker (optional, for containerized runs)

## Running the services (local development)

Below are minimal steps to run each part locally. Adjust ports and environment variables as needed.

### Backend (Node / TypeScript)

1. Open a terminal and change to the `backend/` directory:

```powershell
cd backend
```

2. Install dependencies:

```powershell
npm install
```

3. (If using Prisma) generate client and run migrations as needed:

```powershell
npx prisma generate
# If you have migrations to apply:
npx prisma migrate dev
```

4. Start the backend:

```powershell
npm run dev
```

Check `backend/package.json` for the correct start script if different.

### Frontend (React + Vite)

1. Open a terminal and change to the `frontend/` directory:

```powershell
cd frontend
```

2. Install dependencies and start the dev server:

```powershell
npm install
npm run dev
```

The Vite dev server typically serves at `http://localhost:5173` (check the terminal output).

### Python socket & scraping server (`py_server`)

This repo contains a Python WebSocket server (`py_socket.py`) that listens (by default) on port `12345` and streams MP3 audio chunks after scraping and TTS processing.

1. Create and activate a virtual environment (optional but recommended):

```powershell
cd py_server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install Python requirements:

```powershell
pip install -r requirements.txt
```

3. Start the socket server (example):

```powershell
python py_socket.py
```

This will start the WebSocket server that clients can connect to. The default port in the file is `12345` (edit if you want a different port).

Notes:

- The socket server expects an initial text message containing the user's `streamKey` and `userId` (comma-separated) as in the existing code.
- The Python code posts to a local backend verification URL (in the file it's set to `http://localhost:4000/api/lib/verify`) — ensure your backend verification endpoint is running and matches that URL or change the constant in `py_socket.py`.

## Docker (optional)

There are Dockerfiles present for Python services and the project contains a `backend/Dockerfile`. Typical steps to build and run a service:

```powershell
# Example: build backend image
cd backend
docker build -t novelverse-backend .

# Run the container (example)
docker run -p 4000:4000 --env-file ../.env novelverse-backend
```

Adjust ports, env files, and service names as needed. There are additional Dockerfile-* files under `py_server/` for various Python components.

## Configuration / Environment variables

You may need to supply environment variables for the backend and python components. Common variables to check or add to an `.env` file:

- `DATABASE_URL` — for Prisma/DB connection (backend)
- `PORT` — backend or frontend ports if configured
- Any API keys used for TTS or scraping in `py_server/` (if applicable)

Search each component for `process.env` (Node) or direct references to secrets in Python files to see required variables.

## How clients interact with the socket server

- Connect via WebSocket to the server (default `ws://<host>:12345`).
- Send an initial message with `streamKey,userId` (comma separated).
- Use commands like `play <book_url> <chapter_number>` from the client to trigger scraping and audio streaming.

Example (pseudo-client):

1. connect
2. send: `myStreamKey,12345`
3. send: `play https://somesite/book-slug 1`

The server will verify the key with the backend and then scrape the requested chapter, generate audio and stream it back in base64-encoded MP3 messages.

## Troubleshooting

- If the socket server posts to the verification URL and errors, confirm the backend is running on the expected port and endpoint (default in code: `http://localhost:4000/api/lib/verify`).
- If imports fail in Python (e.g., `pydub`), make sure `ffmpeg` is installed or available to `pydub` (ffmpeg is required to export MP3).
- If the frontend can't reach the backend due to CORS, check backend CORS settings.

## Contributing

1. Open an issue describing the change or bug.
2. Create a branch: `git checkout -b feat/your-change`.
3. Add tests where appropriate and ensure linting passes.
4. Submit a PR with a clear description of the change.
