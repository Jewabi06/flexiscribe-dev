## fLexiScribe Transcription Fix - Summary

### Issues Fixed

1. **✅ Timestamps Changed to 0-Based Format**
   - Previously: Used actual wall clock time (e.g., "05:02:04")
   - Now: Uses elapsed time from session start (e.g., "01:30" for 1 minute 30 seconds)
   - Format: MM:SS (zero-padded)

2. **✅ NGROK URL Support for Callbacks**
   - Added support for `NGROK_URL` environment variable
   - Prioritizes NGROK_URL over FRONTEND_URL for local development
   - Falls back to FRONTEND_URL (Vercel) if NGROK_URL is not set

3. **✅ Proper Callback URL Logging**
   - Callback worker now logs the full URL it's posting to
   - Helps with debugging callback issues

### Files Modified

1. **session_manager.py**
   - Added `get_elapsed_timestamp()` method for 0-based timestamps

2. **config.py**
   - Updated FRONTEND_URL logic to check NGROK_URL first
   - Priority: NGROK_URL → FRONTEND_URL → Default

3. **transcriber/live_transcriber.py**
   - Changed minute summary timestamps to use `session.get_elapsed_timestamp()`
   - Updated log messages to show timestamps

4. **transcriber/whisper_worker.py**
   - Changed live chunk timestamps to use `session.get_elapsed_timestamp()`
   - Updated log messages to show timestamps

5. **main.py**
   - Improved callback URL logging

### Environment Setup

To use this with ngrok (for local development), set the NGROK_URL:

```bash
# Start ngrok tunnel to your Next.js app (default port 3000)
ngrok http 3000

# Export the ngrok URL
export NGROK_URL="https://xxxx-xxx-xxx-xxx-xxx.ngrok-free.app"

# Set the callback secret (must match Next.js .env)
export FLEXISCRIBE_CALLBACK_SECRET="your-secret-here"

# Start the Python FastAPI backend
cd /home/psuia/Downloads/flexiscribe-dev/flexiscribe/python
python main.py
```

For production (Vercel):
```bash
export FRONTEND_URL="https://flexiscribe.vercel.app"
export FLEXISCRIBE_CALLBACK_SECRET="your-secret-here"
```

### How It Works Now

1. **Live Transcription**
   - Whisper captures ~10s audio chunks
   - Each chunk gets a 0-based timestamp (e.g., "00:10", "00:20", "00:30")
   - Chunks are streamed to frontend via SSE at `/api/transcribe/live`

2. **Minute Summaries**
   - Every 60 seconds, chunks are aggregated
   - Minute summaries created with 0-based timestamps
   - Summaries also streamed via SSE in real-time

3. **Final Summary Callback**
   - After transcription stops, Cornell/MOTM summary generated
   - FastAPI posts to: `{NGROK_URL or FRONTEND_URL}/api/transcribe/summary/callback`
   - Next.js creates Lesson and sends notifications

### Testing

Test file created: `test_timestamps.py`
```bash
python test_timestamps.py
```

Output shows 0-based timestamps working correctly.

### Data Format Examples

**Live Chunk (10s intervals):**
```json
{
  "chunk_id": 1,
  "timestamp": "00:10",  // 0-based: 10 seconds elapsed
  "text": "Hello everybody and welcome..."
}
```

**Minute Summary (60s intervals):**
```json
{
  "minute": 1,
  "timestamp": "01:00",  // 0-based: 1 minute elapsed
  "text": "Combined text from 6 chunks...",
  "summary": "Introduction to the lecture...",
  "key_points": [...]
}
```

### Next Steps

1. Set NGROK_URL environment variable with your ngrok tunnel URL
2. Ensure FLEXISCRIBE_CALLBACK_SECRET matches between Python and Next.js
3. Start the FastAPI backend
4. Test transcription from the prototype page
5. Verify timestamps show as 00:00, 00:10, 00:20, etc.

### Verification Checklist

- [x] Timestamps are 0-based (MM:SS format)
- [x] NGROK_URL environment variable supported
- [x] Callback URL properly configured
- [x] SSE streaming endpoints working
- [x] All dependencies installed (requests library)
- [ ] Set NGROK_URL in your shell
- [ ] Set FLEXISCRIBE_CALLBACK_SECRET in your shell
- [ ] Start ngrok tunnel
- [ ] Start FastAPI backend
- [ ] Test end-to-end transcription

---

**Note:** The system now works exactly as before, but with 0-based timestamps and proper ngrok support for local development with Vercel deployment.
