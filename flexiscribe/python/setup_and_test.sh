#!/bin/bash
# Setup and Test Guide for Transcription with NGROK

echo "========================================="
echo "fLexiScribe Transcription - Setup Guide"
echo "========================================="
echo ""

echo "STEP 1: Install ngrok (if not installed)"
echo "-----------------------------------------"
echo "Visit: https://ngrok.com/download"
echo "Or on Ubuntu/Debian: snap install ngrok"
echo ""

echo "STEP 2: Start your Next.js development server"
echo "----------------------------------------------"
echo "In a separate terminal:"
echo "  cd /home/psuia/Downloads/flexiscribe-dev/flexiscribe"
echo "  npm run dev"
echo ""
echo "Press Enter when Next.js is running..."
read

echo "STEP 3: Start ngrok tunnel"
echo "---------------------------"
echo "In another terminal:"
echo "  ngrok http 3000"
echo ""
echo "Copy the 'Forwarding' URL (e.g., https://1234-xxx-xxx.ngrok-free.app)"
echo "Paste it here:"
read NGROK_URL

if [ -z "$NGROK_URL" ]; then
    echo "❌ No URL provided. Exiting..."
    exit 1
fi

# Remove trailing slash if present
NGROK_URL=${NGROK_URL%/}

echo ""
echo "STEP 4: Set environment variables"
echo "----------------------------------"
export NGROK_URL="$NGROK_URL"
echo "✓ NGROK_URL=$NGROK_URL"

# Get or set callback secret
if [ -z "$FLEXISCRIBE_CALLBACK_SECRET" ]; then
    echo ""
    echo "Enter FLEXISCRIBE_CALLBACK_SECRET (must match Next.js .env):"
    echo "(Press Enter to skip if not using authentication)"
    read SECRET
    if [ ! -z "$SECRET" ]; then
        export FLEXISCRIBE_CALLBACK_SECRET="$SECRET"
        echo "✓ FLEXISCRIBE_CALLBACK_SECRET set"
    else
        echo "⚠️  Callback secret not set"
    fi
else
    echo "✓ FLEXISCRIBE_CALLBACK_SECRET already set"
fi

echo ""
echo "STEP 5: Verify Next.js is accessible via ngrok"
echo "-----------------------------------------------"
echo "Testing: $NGROK_URL"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$NGROK_URL" 2>/dev/null)
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "301" ] || [ "$HTTP_CODE" == "302" ]; then
    echo "✓ ngrok tunnel is working (HTTP $HTTP_CODE)"
else
    echo "❌ Cannot reach Next.js via ngrok (HTTP $HTTP_CODE)"
    echo "   Make sure:"
    echo "   1. Next.js is running (npm run dev)"
    echo "   2. ngrok is pointing to port 3000"
    echo "   3. The ngrok URL is correct"
    echo ""
    echo "Continue anyway? (y/N)"
    read CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 1
    fi
fi

echo ""
echo "STEP 6: Start Python backend"
echo "-----------------------------"
echo "Configuration summary:"
echo "  NGROK_URL: $NGROK_URL"
echo "  Callback: $NGROK_URL/api/transcribe/summary/callback"
echo "  Secret: ${FLEXISCRIBE_CALLBACK_SECRET:+[SET]}"
echo ""
echo "Starting FastAPI server..."
echo ""

cd /home/psuia/Downloads/flexiscribe-dev/flexiscribe/python
python main.py
