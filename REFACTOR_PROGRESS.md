# NovelVerse — Refactor Progress Log

> **Goal:** Transform a pre-job spaghetti codebase into readable, typed, tested, CI-ready software.  
> **Started:** 2026-07-02  
> **Owner:** AI-assisted refactor (Cursor/Grok)  
> **Rule:** Update this file after every work session — check boxes, add notes, log decisions.

---

## Project Snapshot

| Area | Stack | Files (src) | TS | Tests | CI |
|------|-------|-------------|-----|-------|-----|
| `frontend/` | React 18 + Vite + Tailwind | ~27 | Strict, **tsc clean** | None | None |
| `backend/` | Express + Prisma + MongoDB + Redis | ~17 | Strict + typecheck | None | Vercel only |
| `gpuServer/` | Flask + Kokoro TTS + PyTorch | ~10 py modules | N/A (Python) | None | None |

**Architecture:** React client → Express API (JWT + SSE proxy) → Flask GPU server (scrape + TTS) → AWS S3 cache

---

## Work Line (Strategy — read this first)

> **Decision (2026-07-02):** P0 first as a short airlock, then structure. Not structure first, not P0 forever.

```
P0 bugs (1–2 sessions) → Structure + reusability → Types/tests → Scale/CI
```

### Why P0 before structure?
- Refactoring broken code moves bugs into new folders instead of fixing them
- Runtime crashes (`location`, auth spinner) make manual testing unreliable during big diffs
- Security holes (password hash in response, open admin routes) stay open during renames
- Most P0 fixes are small — don't delay the real refactor work

### Why not P0-only for weeks?
- P0 is ~7 bugs, many one-liners — not a month of work
- Staying in bug-fix mode never improves architecture (layers, hooks, services)

### Phase 1 rules (P0 airlock)
- Fix only what **crashes, corrupts data, or leaks secrets**
- **Do NOT** rename folders, split god files, or extract services yet
- Smoke-test after: login → browse → play chapter

### Phase 3 rules (structure — main work)
- Extract layers first: `frontend/src/api/`, `backend/services/`, `gpuServer/config.py`
- Then split god files: `Player.tsx`, `AudioPlayerPage.tsx`, `streamController.ts`
- Then rename typos: `uttils` → `utils`, `routs` → `routes` (one package at a time)
- `tsc --noEmit` must pass before marking a phase complete

### Rule of thumb
| If it… | When |
|--------|------|
| Crashes, corrupts data, or leaks secrets | **Now (P0)** |
| Makes adding features painful | **Structure phase** |
| Prevents deploy/team confidence | **Tests + CI** |

---

## How to Resume (new chat / token limit)

Chats don't carry over. **This file is the memory.** Start a new chat with:

```
Continue NovelVerse refactor. Read D:\backup\NovelVerse\REFACTOR_PROGRESS.md
and pick up the next unchecked todo. Current phase: [number].
```

Or in Cursor: `@REFACTOR_PROGRESS.md` + "continue from next unchecked item."

After each session, update:
1. Check off completed todos
2. Add a row to **Session Log**
3. Note decisions in **Notes & Decisions**

---

## Critical Bugs (Fix Before Refactoring)

These are production-breaking — not style issues.

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| B1 | 🔴 P0 | `backend/routs/library/libraryController.ts:42` | `normalizeString(title)` uses Node `process.title`, not `bookData.title` — all books get wrong normalized title |
| B2 | 🔴 P0 | `frontend/src/uttils/LibraryContext.tsx:70` | Uses `location.search` without `useLocation()` — **ReferenceError** at runtime |
| B3 | 🔴 P0 | `frontend/src/uttils/AuthContex.tsx` | Auth error path never calls `setLoading(false)` — infinite spinner |
| B4 | 🔴 P0 | `backend/routs/user/userController.ts` | Registration response returns password hash |
| B5 | 🔴 P0 | `backend/index.ts:59-72` | `server.listen()` runs **before** routes/middleware; error handler registered **before** routes |
| B6 | 🟠 P1 | `backend/routs/library/libraryController.ts` | `addBook`, `addBooksBulk`, `getAllUsers` unprotected |
| B7 | 🟠 P1 | `gpuServer/server.py:202` | SSE error handler yields dict instead of string |
| B8 | 🟠 P1 | `frontend/src/uttils/AuthContex.tsx` | `handleRegister` returns `true` on error (inverted) |
| B9 | 🟡 P2 | `backend/routs/user/userController.ts` | `setLatestBook` always creates new record instead of upsert |
| B10 | 🟡 P2 | `frontend/src/pages/SignupPage.tsx` | Form not wired to `handleRegister` |

---

## Naming / Structure Debt

| Issue | Current | Target |
|-------|---------|--------|
| Typo folder | `frontend/src/uttils/` | `src/utils/` |
| Typo file | `AuthContex.tsx` | `AuthContext.tsx` |
| Typo folder | `backend/routs/` | `backend/routes/` |
| Typo folder | `gpuServer/scarping/` | `gpuServer/scraping/` |
| Typo file | `cache_opum.py` | `cache_opus.py` |
| Inconsistent casing | `homePage.tsx`, `chDropDown.tsx` | `HomePage.tsx`, `ChDropDown.tsx` |
| Template name | `magic-patterns-vite-template` | `novelverse-frontend` |
| Phantom imports | `postcss`, `dns`, `framer-motion/client` | Remove |

---

## Refactor Phases

### Phase 0 — Audit & Tracking ✅ COMPLETE
- [x] Explore full monorepo structure
- [x] Document tech stack and architecture
- [x] Identify critical bugs and priority list
- [x] Create this progress file
- [x] Run `tsc --noEmit` on frontend (baseline: ~50 errors, mostly unused imports)
- [x] Run backend build (baseline: passes)
- [x] Snapshot current git branch / commit hash

### Phase 1 — Stop the Bleeding (P0 Bugs) ✅ COMPLETE
> Fix runtime crashes and security holes before any restructuring.

- [x] **B1** Fix `titleNormalize` bug in `libraryController.ts`
- [x] **B2** Fix `location` bug in `LibraryContext.tsx` (`useLocation`)
- [x] **B3** Fix auth loading deadlock in `AuthContex.tsx`
- [x] **B4** Remove password hash from registration response (now returns JWT token)
- [x] **B5** Restructure `backend/index.ts` bootstrap order
- [x] **B7** Fix SSE error yield in `gpuServer/server.py`
- [x] **B8** Fix inverted `handleRegister` return value
- [x] **B8b** Set `userToken` cookie on successful registration
- [x] Automated smoke test: `dev-smoke-test.ps1` — **5/5 passed**
- [x] Dev health check: **3/3 passed**
- [ ] Manual browser test: login → browse → play chapter (play needs GPU + S3 — out of Phase 1 scope)

### Phase 2 — TypeScript & Lint Baseline ✅ COMPLETE
> Get `tsc --noEmit` green on frontend; tighten backend types.

#### Frontend
- [x] Remove all phantom/wrong imports (postcss, dns, util, etc.)
- [x] Add `VITE_*` env types to `vite-env.d.ts`
- [x] Add `@types/event-source-polyfill` or module declaration
- [x] Replace `any` in contexts (`AuthContex`, `LibraryContext`, `useSocket`)
- [x] Fix `VolumeButton` ref prop mismatch
- [x] Safe context hooks (throw if undefined, remove `!` assertions)
- [x] Pin `latest` deps (`lucide-react`, `react-router-dom`)
- [x] Consolidate ESLint config (`.eslintrc.cjs` vs `eslint.config.js`)
- [x] Add `typecheck` script: `"typecheck": "tsc --noEmit"`

#### Backend
- [x] Single shared `PrismaClient` in `lib/prisma.ts` (3 instances today)
- [x] Unify `AuthRequest` type (defined 3× separately)
- [x] Replace `any` on `req.redis`, `generateToken`, error handlers
- [x] Validate `JWT_SECRET` / `SESSION_SECRET` at startup (fail fast)
- [x] Remove dead imports in `libraryController.ts`
- [x] Add `typecheck` script

#### gpuServer
- [x] Fix `scrape.py` return type mismatch `(title, text)` vs text-only
- [x] Align `MAX_WORKERS` between `server.py` and `task_queue.py`
- [x] Create `Resample` once in `TTSPipeline.__init__` (perf)

### Phase 3 — Structure & Naming
> Rename, reorganize, extract layers. One concern per file.

#### Frontend structure target
```
src/
├── api/           # Axios client + typed endpoints
├── components/    # Presentational UI
├── contexts/      # React providers (renamed from utils)
├── hooks/         # useBookSearch, useFavorites, useSocket
├── pages/         # Route-level components
├── types/         # Shared interfaces (split from types.ts)
└── utils/         # Pure helpers
```

- [ ] Rename `uttils/` → `utils/` (or split into `contexts/` + `hooks/`)
- [ ] Rename `AuthContex.tsx` → `AuthContext.tsx`
- [ ] Standardize page/component file names (PascalCase files)
- [ ] Extract `src/api/client.ts` + `src/api/auth.ts` + `src/api/library.ts`
- [ ] Extract `useBookSearch` hook (dedupe `homePage` + `SearchPage`)
- [ ] Split `Player.tsx` (~436 lines) into player sub-components
- [ ] Split `AudioPlayerPage.tsx` (~428 lines) into orchestration + layout

#### Backend structure target
```
backend/
├── index.ts           # Thin bootstrap only
├── lib/
│   ├── prisma.ts      # Singleton client
│   └── redis.ts
├── middleware/
├── routes/            # Renamed from routs
│   ├── user/
│   ├── library/
│   └── stream/
├── services/          # Business logic extracted from controllers
│   ├── auth.service.ts
│   ├── library.service.ts
│   └── stream.service.ts
└── types/
```

- [ ] Rename `routs/` → `routes/`, fix `userRouts` → `userRoutes`
- [ ] Extract `generateToken()` to shared `lib/jwt.ts`
- [ ] Extract `normalizeString()` to `lib/strings.ts`
- [ ] Split `streamController.ts` (~280 lines) into service + thin controller
- [ ] Remove Mongoose (use Prisma only) or document why both exist
- [ ] Remove duplicate body parser + Redis middleware in `index.ts`
- [ ] Add input validation (Zod) on route handlers

#### gpuServer structure target
```
gpuServer/
├── server.py          # Thin Flask app
├── config.py          # Env-based settings
├── tts/
├── tasks/
├── caching/
└── scraping/          # Renamed from scarping
```

- [ ] Rename `scarping/` → `scraping/` (update all imports)
- [ ] Rename `cache_opum.py` → `cache_opus.py`
- [ ] Extract `config.py` from hardcoded Redis/S3/CORS values
- [ ] Document S3 key contract (shared with backend `streamController.ts`)
- [ ] Remove `debug=True` from production entry
- [ ] Update `.gitignore` (exclude `venv/`, `ffmpeg.exe`, large JSONL files)

### Phase 4 — Security Hardening
- [ ] Protect `GET /api/user/all` (admin-only or remove)
- [ ] Protect `addBook` / `addBooksBulk` endpoints
- [ ] Fix `verifYStreamKey` missing `return` after invalid token
- [ ] Remove `emailVerified: true` on registration without verification
- [ ] Move hardcoded wakeup API URL to env (`streamController.ts`)
- [ ] Strip `console.log` of tokens/responses (15 frontend files)
- [ ] Rate limit by user ID, not raw IP (gpuServer)

### Phase 5 — Testing
- [ ] **Frontend:** Add Vitest + React Testing Library
  - [ ] Smoke: `AuthContext` login/logout
  - [ ] Smoke: `useSocket` connection lifecycle
  - [ ] Unit: `AudioBookCard` favorite toggle
- [ ] **Backend:** Add Vitest or Jest + supertest
  - [ ] Unit: `normalizeString`, `generateToken`
  - [ ] Integration: auth routes (register/login)
  - [ ] Integration: library CRUD
- [ ] **gpuServer:** Add pytest
  - [ ] Unit: S3 key generation
  - [ ] Unit: scrape parsing
  - [ ] Unit: SSE message format

### Phase 6 — CI/CD Pipeline
- [ ] Root `package.json` with workspace scripts (optional monorepo tooling)
- [ ] GitHub Actions workflow:
  - [ ] Frontend: `typecheck` + `lint` + `test` + `build`
  - [ ] Backend: `typecheck` + `test` + `build`
  - [ ] gpuServer: `pytest` + lint (ruff/black)
- [ ] Pre-commit hooks (lint-staged)
- [ ] Environment variable documentation (`.env.example` per package)
- [ ] Dockerfile for `gpuServer` (referenced in README but missing)

### Phase 7 — Polish & Documentation
- [ ] Fix Prisma schema naming (`categorys` → `categories`)
- [ ] Wire `SignupPage` to auth flow
- [ ] Fix `AudioBookCard` favorite sync effect deps
- [ ] Remove unused npm deps (ws, howler, multer, etc.)
- [ ] Finish or remove half-disabled email verification (`transporter.ts`)
- [ ] Add JSDoc/comments on public APIs and complex streaming logic
- [ ] Update README with local dev setup + env vars

---

## Session Log

| Date | Session | Work Done | Next Up |
|------|---------|-----------|---------|
| 2026-07-02 | #1 — Audit | Full codebase exploration (frontend, backend, gpuServer). Created this file. Identified 10 critical bugs, 7-phase roadmap. | Phase 1: Fix P0 bugs (B1–B5, B7–B8) |
| 2026-07-02 | #2 — Planning | Agreed work line: P0 airlock (1–2 sessions) → structure → types/tests → CI. Documented resume instructions. | Phase 1: start P0 fixes |
| 2026-07-02 | #3 — P0 Fixes | Fixed B1–B5, B7, B8. Backend builds clean. Removed dead imports in libraryController. Registration now returns token not hash. | Phase 2: TypeScript baseline |
| 2026-07-02 | #4 — Dev tooling | Added `scripts/dev-start.*`, health checks with retry, `.env.example`. Health check: 3/3 pass. P0 fixes committed on separate branches. | Open PRs on GitHub |
| 2026-07-02 | #5 — Cleanup | Killed stale dev servers (weather-app on :5173, NovelVerse on :5174/:5000). Removed legacy `serverless/`. Pushed branches for PR review. | Review & merge PRs |
| 2026-07-02 | #6 — Phase 1 done | Smoke test 5/5. Register cookie fix. `integration/phase1-smoke` branch has all P0 fixes combined. Updated fix/chore branches. | Discuss merge → Phase 2 |
| 2026-07-02 | #7 — Merge | Merged `integration/phase1-smoke` + `docs/refactor-progress` into `main`. Future: one branch per phase. | Phase 2 |
| 2026-07-02 | #8 — Phase 2 | Frontend `tsc --noEmit` green (50+ → 0). Backend shared prisma/jwt/auth types, env validation. gpuServer scrape/MAX_WORKERS/Resample fixes. Branch `fix/phase2-typescript`. | Phase 3 |

## Git — Phase 1 merged to `main` (2026-07-02)

> **Lesson:** Next phases use **one branch per phase** (e.g. `fix/phase1-p0`), not one branch per file.

| What | Status |
|------|--------|
| Phase 1 P0 fixes + smoke tests | ✅ merged via `integration/phase1-smoke` |
| `REFACTOR_PROGRESS.md` | ✅ merged via `docs/refactor-progress` |
| Old per-file branches | Can be deleted after confirming `main` |

> Repo canonical URL: `https://github.com/donatasWebDev/NovelVerse`

**Start dev (Windows):** `.\scripts\dev-start.ps1`  
**Start dev (Git Bash):** `./scripts/dev-start.sh`  
**Health check:** `.\scripts\dev-healthcheck.ps1`  
**Phase 1 smoke test:** `.\scripts\dev-smoke-test.ps1`  
**Stop:** `.\scripts\dev-stop.ps1`

---

## Conventions (Going Forward)

### TypeScript
- `strict: true` everywhere — no new `any` without a `// TODO: type this` comment
- Shared types in dedicated `types/` folders, not inline in components
- API responses typed at the boundary (Zod parse or explicit interfaces)

### Code Style
- One responsibility per file; controllers stay thin
- Extract services for business logic
- Comments on **why**, not **what** — especially streaming/GPU lifecycle code
- No `console.log` in committed code — use structured logging later

### Git / PR Strategy
- Small focused commits per todo item
- Fix bugs before renaming/moving files (easier to review)
- Run `typecheck` before marking a phase complete

### File Rename Order
1. Fix bugs in place first
2. Then rename/move with full import updates
3. Never rename and refactor logic in the same commit

---

## Quick Reference — Key Files

| File | Lines | Role | Priority |
|------|-------|------|----------|
| `frontend/src/components/Player.tsx` | ~436 | MediaSource SSE playback | P1 split |
| `frontend/src/pages/AudioPlayerPage.tsx` | ~428 | Player orchestration | P1 split |
| `frontend/src/uttils/LibraryContext.tsx` | — | Book state + **B2 bug** | P0 fix |
| `frontend/src/uttils/AuthContex.tsx` | — | Auth + **B3/B8 bugs** | P0 fix |
| `frontend/src/uttils/useSocket.ts` | — | SSE streaming hook | P1 types |
| `backend/index.ts` | ~116 | Bootstrap + **B5 bug** | P0 fix |
| `backend/routs/library/libraryController.ts` | — | Library CRUD + **B1 bug** | P0 fix |
| `backend/routs/stream/streamController.ts` | ~280 | S3/FFmpeg/SSE proxy | P2 split |
| `backend/routs/user/userController.ts` | — | Auth + **B4 bug** | P0 fix |
| `gpuServer/server.py` | — | Flask TTS API + **B7 bug** | P0 fix |
| `gpuServer/tasks/task_queue.py` | — | Worker pool + task chains | P1 |
| `gpuServer/tts/tts_pipeline.py` | — | Kokoro TTS (perf issue) | P1 |

---

## Notes & Decisions

- **Mongoose vs Prisma:** Backend connects both but only Prisma is used for queries. Plan: remove Mongoose unless there's a hidden dependency.
- **S3 key format:** Duplicated in `gpuServer/caching/cache_opum.py` and `backend/routs/stream/streamController.ts` — must stay in sync; extract to shared spec doc in Phase 3.
- **gpuServer not directly called by frontend:** All traffic goes through Express proxy — good security pattern, keep it.
- **Large data files in repo:** `fanmtl_all.json` (~52MB), `fanmtl_novels.jsonl` (~41MB) — move to S3/data volume in Phase 3.

---

*Last updated: 2026-07-02 — Session #8 — Phase 2 COMPLETE*