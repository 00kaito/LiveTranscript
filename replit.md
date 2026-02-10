# replit.md

## Overview

This is a real-time audio transcription web application. Users can record audio through their browser microphone, which gets chunked and sent to the server for transcription using OpenAI's speech-to-text API (specifically `gpt-4o-mini-transcribe`). The transcribed text appears live on screen as the user speaks. Supports multiple languages including auto-detection. Features configurable settings (chunk duration, language, context length, temperature, silence threshold) persisted in localStorage. Includes an AI "Clarify" feature that sends batches of transcribed sentences to GPT-4o-mini for grammar/logic correction. Has a "Summarize" feature that generates a full meeting report with summary, key points, goals, and action items from the transcript.

The project follows a monorepo structure with a React frontend (Vite) and an Express backend, sharing types and schemas through a `shared/` directory.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Directory Structure
- `client/` — React frontend (Vite + TypeScript)
- `server/` — Express backend (TypeScript, runs via tsx)
- `shared/` — Shared types, schemas, and route definitions used by both client and server
- `migrations/` — Drizzle ORM migration files
- `script/` — Build scripts (esbuild for server, Vite for client)

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query for server state management
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming, custom fonts (Inter for body, Outfit for display)
- **Animations**: Framer Motion for UI animations (audio visualizer, live indicator)
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Core Feature: Audio Transcription
- `ChunkedAudioRecorder` (client/src/lib/audio-recorder.ts) captures microphone audio using Web Audio API's ScriptProcessorNode, records at 16kHz sample rate, and encodes chunks as WAV blobs
- Chunks are sent as `multipart/form-data` to `POST /api/transcribe` via the `useTranscribeChunk` hook
- Server uses multer for file upload handling, then sends to OpenAI's transcription API
- Previous transcript context (last 200 chars) is sent as a prompt for better continuity
- Temp files are cleaned up after processing

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript, executed via tsx in development
- **API Pattern**: RESTful endpoints under `/api/`
- **File Uploads**: Multer with temp directory (`uploads/`)
- **Development**: Vite dev server with HMR proxied through Express
- **Production**: Vite builds static assets to `dist/public`, esbuild bundles server to `dist/index.cjs`

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema location**: `shared/schema.ts` (main) and `shared/models/chat.ts` (chat models)
- **Tables**:
  - `transcription_logs` — stores transcription content with timestamps
  - `conversations` — chat conversation metadata (from Replit integrations)
  - `messages` — chat messages linked to conversations
- **Schema push**: `npm run db:push` (uses drizzle-kit push)
- **Connection**: Uses `DATABASE_URL` environment variable with `pg` Pool

### Replit Integrations
The `server/replit_integrations/` and `client/replit_integrations/` directories contain pre-built integration modules:
- **Audio**: Voice recording, playback (AudioWorklet), streaming SSE responses, speech-to-text, text-to-speech
- **Chat**: Conversation CRUD with OpenAI chat completions
- **Image**: Image generation via `gpt-image-1`
- **Batch**: Rate-limited batch processing utility with retries

These are available but not all actively wired into the main routes.

### Build System
- **Dev**: `npm run dev` — runs tsx with Vite middleware for HMR
- **Build**: `npm run build` — Vite builds client, esbuild bundles server with selected deps bundled (allowlist in script/build.ts)
- **Start**: `npm start` — runs the production bundle from `dist/index.cjs`

## External Dependencies

### Required Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required, app throws on startup without it)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key for transcription (falls back to "dummy-key")
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Custom OpenAI base URL (Replit AI Integrations proxy)

### Third-Party Services
- **OpenAI API** — Used for audio transcription (`gpt-4o-mini-transcribe` model), accessed through Replit's AI Integrations proxy
- **PostgreSQL** — Primary database, provisioned through Replit

### Key NPM Dependencies
- `openai` — Official OpenAI SDK
- `drizzle-orm` + `drizzle-kit` — Database ORM and migration tooling
- `express` + `multer` — HTTP server and multipart file handling
- `@tanstack/react-query` — Client-side data fetching
- `framer-motion` — Animations
- `wouter` — Client-side routing
- `shadcn/ui` ecosystem (Radix UI, class-variance-authority, tailwind-merge, clsx)