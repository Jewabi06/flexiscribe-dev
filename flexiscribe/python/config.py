import os

# Base output directory for transcription files
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# ─── Audio input settings ─────────────────────────────────────────────────
# On Linux/Jetson, PulseAudio owns the hardware devices exclusively.
# Trying to open ALSA hw: devices directly causes "Device unavailable".
# Instead we record through PulseAudio's default device and configure
# PulseAudio to route the correct USB mic as default source.
def _detect_audio_device():
    """
    Configure audio input through PulseAudio.

    Strategy:
    1. Use `pactl` to set the USB mic as PulseAudio's default source.
    2. Record from sounddevice's 'default' device (which goes through Pulse).
    This avoids ALSA exclusive-lock conflicts.
    """
    try:
        import sounddevice as sd
        import subprocess

        # --- Try to find & set USB mic as PulseAudio default source ---
        try:
            result = subprocess.run(
                ["pactl", "list", "sources", "short"],
                capture_output=True, text=True, timeout=5,
            )
            usb_keywords = ("usb", "fifine", "blue", "yeti", "microphone",
                            "samson", "rode")
            for line in result.stdout.strip().splitlines():
                source_name = line.split("\t")[1] if "\t" in line else ""
                if any(kw in source_name.lower() for kw in usb_keywords):
                    # Skip monitor sources (output loopback)
                    if ".monitor" in source_name:
                        continue
                    subprocess.run(
                        ["pactl", "set-default-source", source_name],
                        timeout=5,
                    )
                    print(f"[CONFIG] Set PulseAudio default source: {source_name}")
                    break
        except Exception as e:
            print(f"[CONFIG] PulseAudio source setup skipped: {e}")

        # --- Use the default device (routed through PulseAudio) ---
        default_idx = sd.default.device[0]
        default_info = sd.query_devices(default_idx)
        rate = int(default_info['default_samplerate'])
        print(f"[CONFIG] Using PulseAudio default [{default_idx}] "
              f"{default_info['name']} @ {rate}Hz")
        return default_idx, rate
    except Exception as e:
        print(f"[CONFIG] Audio device detection failed: {e}, using defaults")
        return None, 48000

AUDIO_DEVICE, AUDIO_NATIVE_RATE = _detect_audio_device()

# ─── Whisper settings ─────────────────────────────────────────────────────
WHISPER_SAMPLE_RATE = 16000  # Whisper always needs 16kHz
CHUNK_DURATION = 10  # seconds per audio chunk (longer = better context for Whisper)
CHANNELS = 1
WHISPER_MODEL = "small"  # best model that fits Jetson Orin Nano (~1.2GB in int8)
# Upgrade to "medium" if running on a device with ≥12GB RAM

# Device auto-detection: checks if CTranslate2 was compiled with CUDA.
# On devices like Jetson Orin, PyTorch may see CUDA but CTranslate2 (used by
# faster-whisper) may not have been compiled with CUDA support.
def _detect_device_and_compute():
    try:
        import ctranslate2
        cuda_types = ctranslate2.get_supported_compute_types("cuda")
        # CUDA is available in CTranslate2
        if "float16" in cuda_types:
            return "cuda", "float16"
        if "int8_float16" in cuda_types:
            return "cuda", "int8_float16"
        return "cuda", "float32"
    except Exception:
        # CTranslate2 not compiled with CUDA — fall back to CPU
        try:
            import ctranslate2
            cpu_types = ctranslate2.get_supported_compute_types("cpu")
            # Prefer int8 on CPU for speed (good on ARM/Jetson)
            if "int8" in cpu_types:
                return "cpu", "int8"
        except Exception:
            pass
        return "cpu", "float32"

WHISPER_DEVICE, WHISPER_COMPUTE_TYPE = _detect_device_and_compute()

# Language setting for transcription.
# None = auto-detect | "tl" = Tagalog | "en" = English
# For Taglish: use "en" — Whisper still captures Tagalog words thanks to the
# initial prompt, and avoids the auto-detect crash on short/quiet segments.
WHISPER_LANGUAGE = "en"

# Initial prompt gives Whisper context about the expected content.
# This dramatically improves accuracy for Taglish and prevents hallucinations.
WHISPER_INITIAL_PROMPT = (
    "Ito ay isang lecture sa unibersidad na gumagamit ng Taglish — "
    "halong Filipino/Tagalog at English. "
    "Ang mga technical terms ay madalas sa English habang ang mga "
    "paliwanag ay sa Tagalog. "
    "Halimbawa: 'So ang binary search tree, ito yung data structure na '"
    "'mas efficient kaysa sa linear search.' "
    "This is a university lecture mixing Filipino/Tagalog and English."
)

# Voice Activity Detection — filters out silence/noise before transcription.
# Essential when recording from speakers to prevent hallucinated words like 'you'.
WHISPER_VAD_FILTER = True

# Minimum RMS audio energy to consider a chunk worth transcribing.
# Chunks below this threshold are treated as silence and skipped.
# Increase this if you still get hallucinations from background noise.
AUDIO_ENERGY_THRESHOLD = 0.008

# ─── Summarizer settings ──────────────────────────────────────────────────
OLLAMA_MODEL = "gemma3:1b"  # Fits Jetson Orin Nano (~815MB) alongside Whisper small

# Minute buffer interval (seconds)
BUFFER_INTERVAL = 60

# Frontend callback URL (Next.js API)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://flexiscribe-dev.vercel.app")
