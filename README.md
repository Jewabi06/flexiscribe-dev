# fLexiScribe

**AI-Powered Live Transcription, Summarization & Quiz Generation Platform for Education**

fLexiScribe is a full-stack educational platform that captures live lectures via speech-to-text, summarizes them using LLMs, and generates interactive quizzes — all in real time. It consists of a **Next.js web application** (frontend + API), a **Python/FastAPI backend** running on an NVIDIA Jetson Orin Nano for on-device transcription and summarization, and **Ollama-served Gemma 3** models for AI quiz generation.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Next.js Frontend Setup](#nextjs-frontend-setup)
- [Database Setup (PostgreSQL + Prisma)](#database-setup-postgresql--prisma)
- [Python Backend Setup (Jetson Orin Nano)](#python-backend-setup-jetson-orin-nano)
- [Ollama Quiz Generation (Google Cloud via Vertex AI)](#ollama-quiz-generation-google-cloud-via-vertex-ai)
- [Running the Full System](#running-the-full-system)
- [Roles & Features](#roles--features)
- [API Routes](#api-routes)
- [Deployment](#deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                             │
│   Student / Educator / Admin dashboards (Next.js React/JSX)         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Next.js App (Vercel / localhost:3000)             │
│   • App Router (src/app/)                                           │
│   • API Routes (src/app/api/)                                       │
│   • Prisma ORM → PostgreSQL                                         │
│   • Ollama client (src/lib/ollama.ts) → quiz generation             │
└────────────┬────────────────────────────┬───────────────────────────┘
             │ SQL                        │ HTTP (Ollama API)
             ▼                            ▼
┌────────────────────────┐  ┌─────────────────────────────────────────┐
│  PostgreSQL Database   │  │  Ollama Server (Google Cloud VM)        │
│  (Neon / Supabase /    │  │  • Gemma 3 4B (quiz generation)         │
│   local)               │  │  • Runs on GPU-enabled GCE instance     │
└────────────────────────┘  └─────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│           Python FastAPI Backend (Jetson Orin Nano)                 │
│   • Whisper "small" on CUDA (sm_87) — live speech-to-text           │
│   • Ollama Gemma 3 1B on CPU — minute + Cornell summarization       │
│   • Audio capture via PulseAudio (USB mic)                          │ 
│   • SSE streaming for real-time transcript updates                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4, Framer Motion |
| **Backend API** | Next.js App Router API routes (TypeScript) |
| **Database** | PostgreSQL, Prisma ORM 7 (with `@prisma/adapter-pg`) |
| **Auth** | JWT (jose), bcrypt, HTTP-only cookies |
| **Transcription** | OpenAI Whisper "small" (PyTorch CUDA on Jetson Orin Nano) |
| **Summarization** | Ollama + Gemma 3 1B (CPU on Jetson Orin Nano) |
| **Quiz Generation** | Ollama + Gemma 3 4B (GPU on Google Cloud) |
| **Python Backend** | FastAPI, Uvicorn, sounddevice, scipy |
| **Edge Device** | NVIDIA Jetson Orin Nano (8GB, JetPack 6.x) |
| **Deployment** | Vercel (Next.js), Google Cloud (Ollama), Jetson (Python) |

---

## Prerequisites

### For Next.js Frontend
- **Node.js** ≥ 18.x (recommended: 20.x LTS)
- **npm** ≥ 9.x
- **PostgreSQL** database (local, Neon, Supabase, or any provider)

### For Python Backend (Jetson Orin Nano)
- **NVIDIA Jetson Orin Nano** (8GB) with JetPack 6.x
- **Python 3.10+**
- **PyTorch** (NVIDIA Jetson-specific build with sm_87 CUDA support)
- **Ollama** installed on the Jetson (for Gemma 3 1B summarization)
- **PulseAudio** running for USB microphone input
- **USB Microphone** (e.g., FIFINE, Blue Yeti, Samson, Rode)

### For Ollama Quiz Generation (Google Cloud)
- **Google Cloud** VM with GPU (e.g., `n1-standard-4` + NVIDIA T4)
- **Ollama** installed on the VM
- **Gemma 3 4B** model pulled (`ollama pull gemma3:4b`)

---

## Project Structure

```
flexiscribe/
├── prisma/
│   ├── schema.prisma          # Database schema (User, Student, Educator, Class, Quiz, Notification, etc.)
│   ├── seed-admin.js          # Seed admin user
│   ├── seed-direct.js         # Seed initial data
│   └── seed-achievements.js   # Seed achievement/badge data
├── python/
│   ├── main.py                # FastAPI entry point — transcription API
│   ├── config.py              # All Whisper/Ollama/audio configuration
│   ├── session_manager.py     # Manages active transcription sessions
│   ├── requirements.txt       # Python dependencies
│   ├── transcriber/
│   │   ├── whisper_worker.py  # Whisper model loading + real-time audio → text
│   │   ├── live_transcriber.py# Summarization worker (minute + Cornell notes)
│   │   └── chunk_buffer.py    # Audio chunk buffering
│   ├── summarizer/
│   │   ├── summarizer.py      # Minute + Cornell summary generation
│   │   ├── ollama_client.py   # Ollama HTTP client
│   │   ├── prompt_builder.py  # LLM prompt templates
│   │   └── json_utils.py      # JSON extraction from LLM output
│   └── output/                # Local transcript/summary output files
├── src/
│   ├── app/
│   │   ├── layout.jsx         # Root layout
│   │   ├── page.jsx           # Landing page
│   │   ├── admin/             # Admin dashboard & management pages
│   │   ├── educator/          # Educator dashboard, transcription, classes
│   │   ├── student/           # Student dashboard, documents, quizzes, rank
│   │   ├── auth/              # Authentication pages (login, register)
│   │   └── api/               # API routes (REST endpoints)
│   │       ├── auth/          # Login, register, logout, forgot-password
│   │       ├── students/      # Student-specific APIs
│   │       ├── educator/      # Educator-specific APIs
│   │       ├── admin/         # Admin-specific APIs
│   │       └── quizzes/       # Quiz generation & management
│   ├── components/            # Reusable UI components
│   │   ├── admin/             # Admin-specific components
│   │   ├── educator/          # Educator-specific components
│   │   ├── student/           # Student-specific components (NotificationMenu, etc.)
│   │   └── shared/            # Shared components (MessageModal, LoadingScreen, etc.)
│   ├── layouts/               # Layout wrappers (StudentSidebar, StudentHeader, etc.)
│   ├── hooks/                 # Custom React hooks (useQuizGeneration)
│   ├── lib/
│   │   ├── auth.ts            # JWT token creation/verification
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── email.ts           # Email sending (Nodemailer/Resend)
│   │   └── ollama.ts          # Ollama API client for quiz generation (~2400 lines)
│   ├── services/              # Service layer
│   ├── styles/
│   │   └── globals.css        # Global styles + Tailwind
│   └── utils/
│       └── student.jsx        # Student utility functions (streak, rank, activity tracking)
├── public/                    # Static assets (icons, images, TinyMCE editor)
├── package.json
├── next.config.ts
├── prisma.config.ts
├── tsconfig.json
└── eslint.config.mjs
```

---

## Environment Variables

Create a `.env` file in the `flexiscribe/` root directory:

```env
# ── Database ──────────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@host:5432/flexiscribe?sslmode=require"

# ── Authentication ────────────────────────────────────────────────────
JWT_SECRET="your-secure-jwt-secret-key"
ADMIN_ACCESS_KEY="your-admin-access-key"

# ── Ollama (Quiz Generation) ─────────────────────────────────────────
# Points to the Google Cloud VM running Ollama with Gemma 3 4B
OLLAMA_BASE_URL="http://<gcloud-vm-external-ip>:11434"

# ── Email (for password reset) ───────────────────────────────────────
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# ── Frontend URL (for Python backend callbacks) ──────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ── Python Backend URL (for educator transcription control) ──────────
NEXT_PUBLIC_TRANSCRIPTION_API="http://<jetson-ip>:8000"
```

---

## Next.js Frontend Setup

### 1. Install Dependencies

```bash
cd flexiscribe
npm install
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Run Database Migrations

```bash
npx prisma migrate deploy
# or for development:
npx prisma migrate dev
```

### 4. Seed the Database (Optional)

```bash
npm run db:seed           # Seed base data
node prisma/seed-admin.js # Seed admin user
```

### 5. Start Development Server

```bash
npm run dev
# or with Turbopack (faster HMR):
npm run dev:turbo
```

The app will be available at **http://localhost:3000**.

### 6. Build for Production

```bash
npm run build
npm start
```

---

## Database Setup (PostgreSQL + Prisma)

fLexiScribe uses **PostgreSQL** with **Prisma ORM** (using the `@prisma/adapter-pg` native PostgreSQL adapter for optimal performance).

### Schema Overview

Key models in `prisma/schema.prisma`:

| Model | Description |
|---|---|
| `User` | Base authentication (email, password, role: ADMIN/EDUCATOR/STUDENT) |
| `Student` | Student profile (studentNumber, fullName, xp, level) |
| `Educator` | Educator profile (department, specialization) |
| `Admin` | Admin profile |
| `Class` | Class/section with unique class codes |
| `StudentClass` | Many-to-many enrollment junction |
| `Transcription` | Uploaded lecture transcriptions |
| `Summary` | AI-generated lecture summaries |
| `Quiz` | Generated quizzes (MCQ, Fill-in, Flashcard) |
| `QuizAttempt` | Student quiz submissions and results |
| `Notification` | Push notifications (per student/educator/admin) |
| `Achievement` | Gamification achievements and badges |
| `Activity` | Student activity tracking (for study streaks) |

### Connection

The Prisma client connects using `DATABASE_URL` from `.env`:

```typescript
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

---

## Python Backend Setup (Jetson Orin Nano)

The Python backend runs live speech-to-text transcription using **OpenAI Whisper** on the Jetson's GPU, and **Ollama Gemma 3 1B** on CPU for real-time summarization.

### 1. Hardware Requirements

| Component | Specification |
|---|---|
| **Device** | NVIDIA Jetson Orin Nano Developer Kit (8GB) |
| **JetPack** | 6.x (L4T R36.x) |
| **GPU** | Ampere (sm_87), 1024 CUDA cores, shared 8GB RAM |
| **CPU** | 6× ARM Cortex-A78AE |
| **Microphone** | USB microphone (FIFINE, Blue Yeti, etc.) |

### 2. Install System Dependencies

```bash
# On Jetson Orin Nano (Ubuntu 22.04 Jetson)
sudo apt update
sudo apt install -y python3-pip python3-dev portaudio19-dev pulseaudio ffmpeg
```

### 3. Install PyTorch (Jetson Build)

The standard pip PyTorch does **not** include sm_87 CUDA kernels. Use NVIDIA's Jetson-specific wheel:

```bash
# Download from NVIDIA's Jetson PyTorch page:
# https://forums.developer.nvidia.com/t/pytorch-for-jetson/
pip3 install torch-<version>-cp310-cp310-linux_aarch64.whl
```

Verify CUDA is available:
```python
import torch
print(torch.cuda.is_available())          # True
print(torch.cuda.get_device_properties(0)) # Orin (sm_87)
```

### 4. Install OpenAI Whisper

```bash
pip3 install openai-whisper
```

> **Note:** fLexiScribe uses **OpenAI's PyTorch-based Whisper** (`import whisper`), NOT `faster-whisper`/CTranslate2, because CTranslate2 pip packages lack Jetson CUDA sm_87 kernels.

### 5. Install Ollama on Jetson

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull gemma3:1b
```

Configure Ollama for **CPU-only** inference (GPU is reserved for Whisper):
```bash
# In /etc/systemd/system/ollama.service or environment:
OLLAMA_NUM_GPU=0
```

### 6. Install Python Dependencies

```bash
cd flexiscribe/python
pip3 install -r requirements.txt
```

Dependencies:
- `fastapi==0.115.0` — Web framework
- `uvicorn==0.30.6` — ASGI server
- `sounddevice==0.5.1` — Audio recording from USB mic
- `numpy==1.26.4` — Audio array processing
- `scipy>=1.11.0` — Audio resampling (polyphase filter)
- `ollama==0.3.3` — Ollama Python client
- `faster-whisper==1.0.3` — (optional, unused on Jetson; kept for non-Jetson fallback)

### 7. Configure Audio Input

The Jetson uses **PulseAudio** for audio routing. The backend auto-detects USB microphones:

```python
# config.py — auto-detection logic
# Searches for USB mic keywords: "usb", "fifine", "blue", "yeti", etc.
# Sets it as PulseAudio default source via `pactl set-default-source`
```

Manual setup if auto-detection fails:
```bash
# List audio sources
pactl list sources short

# Set your USB mic as default
pactl set-default-source alsa_input.usb-FIFINE_Microphone-00.mono-fallback
```

### 8. Whisper Configuration

Key settings in `python/config.py`:

| Setting | Value | Reason |
|---|---|---|
| `WHISPER_MODEL` | `"small"` | Best accuracy-speed balance for Taglish on Jetson (~0.9 GB VRAM) |
| `WHISPER_DEVICE` | `"cuda"` | GPU-accelerated (sm_87 Ampere) |
| `WHISPER_FP16` | `True` | FP16 inference: 2× speed, half memory |
| `WHISPER_LANGUAGE` | `"en"` | English base; captures Tagalog via initial prompt |
| `WHISPER_BEAM_SIZE` | `1` | Greedy decoding for real-time speed |
| `WHISPER_TEMPERATURE` | `0.0` | Deterministic output |
| `CHUNK_DURATION` | `10` | 10-second audio chunks |
| `AUDIO_ENERGY_THRESHOLD` | `0.005` | Skip silence/noise |
| `WHISPER_VAD_FILTER` | `True` | Voice Activity Detection |

### 9. Summarization Configuration

| Setting | Value | Reason |
|---|---|---|
| `OLLAMA_MODEL` | `"gemma3:1b"` | Fits alongside Whisper in 8GB shared RAM |
| `OLLAMA_GPU_LAYERS` | `0` | CPU-only (GPU reserved for Whisper) |
| `BUFFER_INTERVAL` | `60` | Generate minute summaries every 60 seconds |

### 10. Start the Python Backend

```bash
cd flexiscribe/python
python3 main.py
```

The API will start on **http://0.0.0.0:8000**.

API Endpoints:
- `POST /transcribe/start` — Start a live transcription session
- `POST /transcribe/stop` — Stop and finalize session
- `GET /transcribe/status/{session_id}` — Get session status
- `GET /transcribe/live/{session_id}` — SSE stream for real-time updates
- `GET /health` — Health check

---

## Ollama Quiz Generation (Google Cloud via Vertex AI)

Quiz generation uses **Gemma 3 4B** served via Ollama on a Google Cloud GPU VM. This is separate from the Jetson's Gemma 3 1B (which handles summarization).

### 1. Create a GPU-Enabled VM

```bash
# Google Cloud CLI
gcloud compute instances create ollama-quiz-server \
  --zone=us-central1-a \
  --machine-type=n1-standard-4 \
  --accelerator=type=nvidia-tesla-t4,count=1 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=100GB \
  --maintenance-policy=TERMINATE
```

### 2. Install NVIDIA Drivers & CUDA

```bash
# SSH into the VM
sudo apt update
sudo apt install -y nvidia-driver-535 nvidia-cuda-toolkit
sudo reboot
```

### 3. Install Ollama

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### 4. Pull Gemma 3 4B Model

```bash
ollama pull gemma3:4b
```

For better performance, use a quantized variant:
```bash
ollama pull gemma3:4b-it-q4_K_M  # Best quality-to-speed ratio
```

### 5. Configure Ollama to Listen Externally

```bash
# Edit the Ollama service
sudo systemctl edit ollama

# Add:
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"

# Restart
sudo systemctl restart ollama
```

### 6. Open Firewall

```bash
gcloud compute firewall-rules create allow-ollama \
  --allow=tcp:11434 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=ollama-server
```

### 7. Set Environment Variable

In the Next.js `.env` file:
```env
OLLAMA_BASE_URL="http://<vm-external-ip>:11434"
```

### Quiz Generation Model Priority

The quiz engine (`src/lib/ollama.ts`) automatically selects the best available model:

```
Priority: gemma3:4b-it-q4_K_M → gemma3:4b-q4_0 → gemma3:4b-cloud
         → gemma3:4b → gemma3:1b-it-q4_K_M → gemma3:1b
```

### Quiz Types Supported

| Type | Description |
|---|---|
| **MCQ** | Multiple Choice Questions with 4 options, Bloom's taxonomy difficulty |
| **Fill-in-the-Blank** | Sentence completion with blanked key terms |
| **Flashcard** | Term-definition pairs for self-study |

Each quiz is generated from lecture summaries with:
- Deduplication (keyword-set overlap detection)
- Answer verification (Gemma validates each item against the source summary)
- Difficulty levels: Easy, Medium, Hard (mapped to Bloom's taxonomy)

---

## Running the Full System

### Development (All Components)

**Terminal 1 — Next.js Frontend:**
```bash
cd flexiscribe
npm run dev
```

**Terminal 2 — Python Backend (on Jetson Orin Nano):**
```bash
ssh jetson@<jetson-ip>
cd flexiscribe/python
python3 main.py
```

**Terminal 3 — Ollama Server (on Google Cloud VM):**
```bash
ssh user@<gcloud-vm-ip>
ollama serve
```

### Production

- **Next.js** → Deploy to Vercel (`npm run build`)
- **Python Backend** → Run as systemd service on Jetson
- **Ollama** → Run as systemd service on Google Cloud VM

---

## Roles & Features

### Student
- **Dashboard** — Welcome banner, study streak, XP rank, leaderboard, Jump Back In (resume quizzes), recently added content
- **Documents** — Join classes via code, view summaries & raw transcripts
- **Quizzes** — Take MCQ, Fill-in-the-Blank, and Flashcard quizzes with auto-save progress
- **Rank** — XP-based ranking system with achievements and badges
- **Leaderboard** — Global student rankings
- **Notifications** — Real-time notifications for new transcripts, summaries, quizzes, achievements

### Educator
- **Dashboard** — Class management, student analytics
- **Live Transcription** — Start/stop real-time lecture recording
- **Classes** — Create classes with auto-generated codes, manage enrollments
- **Content Management** — View/edit transcripts and summaries
- **Quiz Generation** — AI-powered quiz creation from lecture content
- **Notifications** — System notifications

### Admin
- **Dashboard** — Platform analytics and monitoring
- **User Management** — Manage educators and students
- **Department Management** — Organize departments
- **Notifications** — System-wide notification management

---

## API Routes

### Authentication
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (returns JWT cookie) |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/logout` | Logout (clears cookie) |
| POST | `/api/auth/forgot-password` | Send password reset email |

### Student APIs
| Method | Route | Description |
|---|---|---|
| GET | `/api/students/profile` | Get student profile |
| GET | `/api/students/classes` | List enrolled classes |
| POST | `/api/students/classes` | Join class by code |
| GET | `/api/students/quizzes` | List available quizzes |
| GET | `/api/students/quizzes/[id]` | Get quiz details |
| POST | `/api/students/quizzes/[id]/submit` | Submit quiz attempt |
| GET | `/api/students/transcriptions` | List transcriptions |
| GET | `/api/students/notifications` | Get notifications |
| PUT | `/api/students/notifications` | Mark all as read (deletes) |
| DELETE | `/api/students/notifications` | Delete single notification |
| GET | `/api/students/leaderboard` | Get leaderboard |

### Educator APIs
| Method | Route | Description |
|---|---|---|
| GET | `/api/educator/classes` | List educator's classes |
| POST | `/api/educator/classes` | Create new class |
| GET | `/api/educator/notifications` | Get notifications |
| POST | `/api/quizzes/generate` | Generate AI quiz from summary |

### Python Backend APIs
| Method | Route | Description |
|---|---|---|
| POST | `/transcribe/start` | Start live transcription |
| POST | `/transcribe/stop` | Stop transcription |
| GET | `/transcribe/status/{id}` | Session status |
| GET | `/transcribe/live/{id}` | SSE live stream |
| GET | `/health` | Health check |

---

## Deployment

### Vercel (Next.js)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy:
```bash
npm run build
# Vercel auto-deploys on push to main
```

### Jetson Orin Nano (Python Backend)

Create a systemd service:
```bash
sudo nano /etc/systemd/system/flexiscribe.service
```

```ini
[Unit]
Description=fLexiScribe Transcription Backend
After=network.target ollama.service

[Service]
Type=simple
User=jetson
WorkingDirectory=/home/jetson/flexiscribe/python
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=5
Environment=PYTORCH_CUDA_ALLOC_CONF=expandable_segments:False

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable flexiscribe
sudo systemctl start flexiscribe
```

### Google Cloud (Ollama)

Ollama runs as a system service by default after installation. Ensure it's configured to listen on `0.0.0.0:11434` and the firewall allows TCP 11434.

---

## License

This project is developed as part of a university thesis.
