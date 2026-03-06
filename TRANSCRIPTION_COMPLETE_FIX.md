# fLexiScribe Transcription System - Complete Fix

## 🎯 Issues Resolved

### 1. ✅ Timestamps Now 0-Based
**Before:** `"05:02:04"` (actual clock time)  
**After:** `"01:02"` (1 minute 2 seconds elapsed from start)

All timestamps in live chunks and minute summaries now show elapsed time from the session start in `MM:SS` format.

### 2. ✅ NGROK Support for Local Development
The system now properly uses NGROK URLs for callbacks when developing locally with Vercel-deployed Next.js.

### 3. ✅ Proper Chunk Streaming
Server-Sent Events (SSE) streaming is working correctly with 0-based timestamps.

---

## 📝 Changes Made

### Modified Files

1. **`session_manager.py`**
   - Added `get_elapsed_timestamp()` method
   - Returns time elapsed from session start in `MM:SS` format

2. **`config.py`**
   - Added `NGROK_URL` environment variable support
   - Priority: `NGROK_URL` → `FRONTEND_URL` → default

3. **`transcriber/live_transcriber.py`**
   - Changed minute summary timestamps to use `session.get_elapsed_timestamp()`
   - Logs now show 0-based timestamps

4. **`transcriber/whisper_worker.py`**
   - Changed live chunk timestamps to use `session.get_elapsed_timestamp()`
   - All chunks now have 0-based timestamps

5. **`main.py`**
   - Improved callback URL logging for debugging

### New Files Created

1. **`test_timestamps.py`** - Test script to verify 0-based timestamps
2. **`start_backend.sh`** - Quick start script with validation
3. **`setup_and_test.sh`** - Interactive setup wizard
4. **`TRANSCRIPTION_FIX_SUMMARY.md`** - Detailed documentation

---

## 🚀 Quick Start

### Option 1: Interactive Setup (Recommended)

```bash
cd /home/psuia/Downloads/flexiscribe-dev/flexiscribe/python
./setup_and_test.sh
```

This script will:
- Guide you through starting Next.js
- Help you set up ngrok
- Configure environment variables
- Start the backend

### Option 2: Manual Setup

```bash
# Terminal 1: Start Next.js
cd /home/psuia/Downloads/flexiscribe-dev/flexiscribe
npm run dev

# Terminal 2: Start ngrok
ngrok http 3000
# Copy the URL (e.g., https://1234-xxx.ngrok-free.app)

# Terminal 3: Start Python backend
cd /home/psuia/Downloads/flexiscribe-dev/flexiscribe/python
export NGROK_URL="https://1234-xxx.ngrok-free.app"
export FLEXISCRIBE_CALLBACK_SECRET="your-secret"
./start_backend.sh
```

---

## 🧪 Testing

### 1. Test Timestamps
```bash
cd /home/psuia/Downloads/flexiscribe-dev/flexiscribe/python
python test_timestamps.py
```

Expected output:
```
Initial timestamp (should be 00:00): 00:00
Timestamp at 1:30 (simulated): 01:30
Timestamp at 10:45 (simulated): 10:45
✓ Timestamps are now 0-based (MM:SS format)
```

### 2. Test Full Transcription

1. Open browser to your ngrok URL
2. Navigate to `/prototype`
3. Log in as an educator
4. Start transcription
5. Speak into microphone
6. Check live chunks appear with timestamps: `00:10`, `00:20`, `00:30`, etc.
7. Stop transcription
8. Verify final summary callback is received

---

## 📊 Data Format Examples

### Live Chunk (Every ~10 seconds)
```json
{
  "type": "live_chunk",
  "chunk_id": 1,
  "timestamp": "00:10",  // ← 10 seconds elapsed
  "text": "Hello everybody and welcome..."
}
```

### Minute Summary (Every 60 seconds)
```json
{
  "type": "minute_summary",
  "minute": 1,
  "timestamp": "01:00",  // ← 1 minute elapsed
  "text": "Combined text from 6 chunks...",
  "summary": "Introduction to the lecture...",
  "key_points": ["Key point 1", "Key point 2"]
}
```

### Final Summary Callback
```json
{
  "session_id": "uuid",
  "transcription_id": "db-record-id",
  "final_summary": {
    "metadata": {...},
    "title": "Lecture Title",
    "key_concepts": [...],
    "notes": [...],
    "summary": [...]
  }
}
```

Posted to: `{NGROK_URL}/api/transcribe/summary/callback`

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NGROK_URL` | No | - | Ngrok tunnel URL for local dev |
| `FRONTEND_URL` | No | `https://flexiscribe.vercel.app` | Production frontend URL |
| `FLEXISCRIBE_CALLBACK_SECRET` | Recommended | `""` | Shared secret for callback auth |

### Priority Order

1. If `NGROK_URL` is set → use it
2. Else if `FRONTEND_URL` is set → use it
3. Else use default: `https://flexiscribe.vercel.app`

---

## 🎬 Architecture Flow

```
1. Frontend (Next.js) → Start Transcription
   POST /api/transcribe/start
   ↓
2. Next.js → Python FastAPI
   POST http://localhost:8000/transcribe/start
   ↓
3. Python starts:
   - Whisper worker (records audio, transcribes every ~10s)
   - Summarization worker (aggregates every 60s)
   ↓
4. Live chunks streamed via SSE:
   GET /api/transcribe/live?sessionId=xxx
   → data: {"type": "live_chunk", "timestamp": "00:10", ...}
   → data: {"type": "minute_summary", "timestamp": "01:00", ...}
   ↓
5. On stop:
   POST /api/transcribe/stop
   → Returns immediate data (transcript + minute summaries)
   → Final summary generated in background
   ↓
6. Async callback:
   POST {NGROK_URL}/api/transcribe/summary/callback
   → Creates Lesson in database
   → Sends student notifications
```

---

## ✅ Verification Checklist

- [x] Timestamps are 0-based (tested)
- [x] NGROK_URL environment variable supported
- [x] Callback URL properly configured
- [x] SSE streaming working
- [x] All dependencies installed
- [x] Python syntax validated
- [x] Test scripts created
- [x] Documentation complete

### Your Setup Checklist

- [ ] Set `NGROK_URL` environment variable
- [ ] Set `FLEXISCRIBE_CALLBACK_SECRET` (match Next.js)
- [ ] Start Next.js (`npm run dev`)
- [ ] Start ngrok (`ngrok http 3000`)
- [ ] Start Python backend (`./start_backend.sh`)
- [ ] Test transcription from `/prototype`
- [ ] Verify timestamps show as `00:00`, `00:10`, `00:20`, etc.
- [ ] Verify callback receives final summary

---

## 🐛 Troubleshooting

### Timestamps Still Show Clock Time
- Make sure you restarted the Python backend after the changes
- Check: `python test_timestamps.py` should show 0-based times

### Callback Not Received
```bash
# Check if NGROK_URL is set
echo $NGROK_URL

# Check callback URL in Python logs
# Should see: "Posting to https://xxxx.ngrok-free.app/api/transcribe/summary/callback"

# Test ngrok tunnel
curl -I $NGROK_URL
# Should return 200/301/302
```

### Live Chunks Not Appearing
- Check browser console for SSE errors
- Verify `/api/transcribe/live?sessionId=xxx` is accessible
- Check Python logs for "[LIVE] Chunk..." messages

### Audio Not Recording
- Check PulseAudio: `pactl list sources short`
- Verify USB mic is detected: `./start_backend.sh` shows audio device
- Check browser permissions for microphone

---

## 📞 Support

If issues persist:
1. Check Python logs for errors
2. Check browser console (F12) for frontend errors
3. Verify all environment variables are set
4. Test with `./setup_and_test.sh` for guided setup

---

## 🎉 Summary

**All transcription functionality is now fully restored with:**
- ✅ 0-based timestamps (MM:SS format)
- ✅ NGROK support for local development
- ✅ Proper SSE streaming of live chunks
- ✅ Async callbacks for final summaries
- ✅ Complete documentation and test scripts

**Ready to use!** Run `./setup_and_test.sh` to get started.
