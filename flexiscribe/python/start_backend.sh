#!/bin/bash
# Quick Start Script for fLexiScribe Transcription Backend

echo "==================================="
echo "fLexiScribe Transcription Backend"
echo "==================================="
echo ""

# Check if ngrok URL is set
if [ -z "$NGROK_URL" ]; then
    echo "⚠️  WARNING: NGROK_URL is not set!"
    echo "   For local development with Vercel, you need to:"
    echo "   1. Run: ngrok http 3000"
    echo "   2. Export: export NGROK_URL=\"https://xxxx.ngrok-free.app\""
    echo ""
    echo "   Using default FRONTEND_URL instead..."
    if [ -z "$FRONTEND_URL" ]; then
        FRONTEND_URL="https://flexiscribe.vercel.app"
        echo "   Default: $FRONTEND_URL"
    else
        echo "   Using: $FRONTEND_URL"
    fi
else
    echo "✓ NGROK_URL is set: $NGROK_URL"
fi

# Check callback secret
if [ -z "$FLEXISCRIBE_CALLBACK_SECRET" ]; then
    echo "⚠️  WARNING: FLEXISCRIBE_CALLBACK_SECRET is not set!"
    echo "   This must match the secret in your Next.js .env file"
else
    echo "✓ FLEXISCRIBE_CALLBACK_SECRET is set"
fi

echo ""
echo "Configuration:"
echo "  Callback URL: ${NGROK_URL:-${FRONTEND_URL:-https://flexiscribe.vercel.app}}/api/transcribe/summary/callback"
echo ""

# Check Python dependencies
echo "Checking Python dependencies..."
python -c "import fastapi, uvicorn, sounddevice, whisper, scipy, ollama, requests" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ All required Python packages installed"
else
    echo "❌ Missing Python packages. Run: pip install -r requirements.txt"
    exit 1
fi

# Check audio device
echo ""
echo "Checking audio device..."
python -c "import sounddevice as sd; print(f'✓ Audio device: {sd.query_devices(sd.default.device[0])[\"name\"]}')" 2>/dev/null || echo "⚠️  Could not detect audio device"

echo ""
echo "==================================="
echo "Starting FastAPI server..."
echo "==================================="
echo ""
echo "Features enabled:"
echo "  ✓ 0-based timestamps (MM:SS format)"
echo "  ✓ Live chunk streaming via SSE"
echo "  ✓ Minute summaries (every 60s)"
echo "  ✓ Async final summary callback"
echo "  ✓ NGROK URL support"
echo ""

# Start the server
python main.py
