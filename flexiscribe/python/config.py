import os

# Base output directory for transcription files
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# ─── Library path fix for Jetson Orin Nano ────────────────────────────────
# The NVIDIA Jetson PyTorch wheel needs libcusparseLt.so from the nvidia
# pip package.  Set LD_LIBRARY_PATH early so torch can import successfully.
_CUSPARSE_PATH = os.path.expanduser(
    "~/.local/lib/python3.10/site-packages/nvidia/cusparselt/lib"
)
if os.path.isdir(_CUSPARSE_PATH):
    os.environ.setdefault("LD_LIBRARY_PATH", "")
    if _CUSPARSE_PATH not in os.environ["LD_LIBRARY_PATH"]:
        os.environ["LD_LIBRARY_PATH"] = (
            _CUSPARSE_PATH + ":" + os.environ["LD_LIBRARY_PATH"]
        )
    # Also update the runtime linker so dlopen() can find it
    import ctypes
    try:
        ctypes.CDLL(os.path.join(_CUSPARSE_PATH, "libcusparseLt.so.0"))
    except OSError:
        pass

# Jetson Orin uses a unified memory architecture where NVML doesn't work
# like desktop GPUs.  Disable PyTorch's expandable-segments allocator to
# avoid "NVML_SUCCESS == r INTERNAL ASSERT FAILED" crashes.
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:False")

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
CHUNK_DURATION = 3            # seconds per audio chunk (real‑time)
CHANNELS = 1

# Model: "small" (~244M params, ~0.9 GB VRAM) — best balance of accuracy and
# speed for Taglish on Jetson Orin Nano GPU.  Transcribes 10s audio in ~2-3s.
# "base" (~74M) is faster but has poor Taglish accuracy.
# "medium" (~769M) would exceed Jetson's 7.4 GB shared RAM with Ollama.
WHISPER_MODEL = "small"

# Device detection: use PyTorch CUDA for the Jetson Orin Nano (sm_87).
# The standard pip faster-whisper / CTranslate2 packages lack Jetson CUDA
# kernels, so we use OpenAI's PyTorch-based Whisper which works with the
# NVIDIA Jetson-specific PyTorch build.
def _detect_whisper_device():
    """Detect if PyTorch CUDA is available and actually works on this GPU."""
    try:
        import torch
        if torch.cuda.is_available():
            # Verify the GPU compute capability is in the arch list
            props = torch.cuda.get_device_properties(0)
            sm = f"sm_{props.major}{props.minor}"
            arch_list = torch.cuda.get_arch_list()
            if sm in arch_list or f"compute_{props.major}{props.minor}" in arch_list:
                # Quick sanity: try creating a tensor on GPU
                x = torch.zeros(1, device="cuda")
                del x
                print(f"[CONFIG] CUDA available: {props.name} ({sm}), "
                      f"VRAM: {props.total_memory / 1024**3:.1f} GB")
                return "cuda"
            else:
                print(f"[CONFIG] GPU {sm} not in arch list {arch_list} — using CPU")
    except Exception as e:
        print(f"[CONFIG] CUDA detection failed: {e}")
    return "cpu"

WHISPER_DEVICE = _detect_whisper_device()

# FP16 on CUDA for 2× speed + half memory; CPU must use FP32.
WHISPER_FP16 = WHISPER_DEVICE == "cuda"

# Language setting for transcription.
# None = auto-detect | "tl" = Tagalog | "en" = English
# For Taglish: use "en" — Whisper still captures Tagalog words thanks to the
# initial prompt, and avoids the auto-detect crash on short/quiet segments.
WHISPER_LANGUAGE = "en"

# Initial prompt gives Whisper context about the expected content.
# This dramatically improves accuracy for Taglish and prevents hallucinations.
# The prompt includes real Taglish examples so Whisper learns the code-switching
# pattern and correctly spells Filipino words.
WHISPER_INITIAL_PROMPT = (
    "Ito ay isang lecture sa unibersidad na gumagamit ng Taglish — "
    "halong Filipino at English. "
    "Halimbawa ng Taglish: "
    "'So ang binary search tree, ito yung data structure na "
    "mas efficient kaysa sa linear search. "
    "Kaya kung merong sorted array, pwede nating gamitin ang "
    "binary search para mabilis ang pag-search. "
    "Ang time complexity niya ay O of log n, kasi every step, "
    "hinahati natin yung array. "
    "So kapag ang input ay malaki, mas mabilis ito kaysa linear na O of n.' "
    "This is a university lecture mixing Filipino/Tagalog and English."
)

# Voice Activity Detection — filters out silence/noise before transcription.
# Essential when recording from speakers to prevent hallucinated words like 'you'.
WHISPER_VAD_FILTER = True

# Minimum RMS audio energy to consider a chunk worth transcribing.
# Chunks below this threshold are treated as silence and skipped.
# Increase this if you still get hallucinations from background noise.
AUDIO_ENERGY_THRESHOLD = 0.005

# Whisper beam size: 1 = greedy decoding (fastest, best for real-time on Jetson).
# With "small" on GPU beam_size=1 still gives good quality; increase to 3 if
# you have GPU headroom and want slightly better accuracy.
WHISPER_BEAM_SIZE = 1

# Temperature for Whisper decoding.  0.0 = deterministic (no sampling).
# Keeps transcription stable and reproducible.
WHISPER_TEMPERATURE = 0.0

# ─── Summarizer settings ──────────────────────────────────────────────────
OLLAMA_MODEL = "gemma3:1b"  # Fits Jetson Orin Nano (~815MB) alongside Whisper small

# GPU layers for Ollama.  99 = offload all layers to GPU.
# On Jetson Orin Nano (7.4 GB shared), Whisper small FP16 (~0.9 GB) +
# gemma3:1b Q4 (~0.8 GB) fit comfortably (~2 GB total).  Whisper only
# uses the GPU in short 2-3 s bursts every 10 s, so Ollama can run on
# the GPU during the 7-8 s idle gaps.  This gives ~4-6× faster summaries
# compared to CPU-only.  Keep SUMMARY_MAX_WORKERS=1 so only one Ollama
# inference hits the GPU at a time.
OLLAMA_GPU_LAYERS = 99

# ─── Remote GPU-powered Ollama for final summary generation ───────────────
# After transcription stops, the final Cornell Notes / MOTM summary is
# generated on a remote GPU-powered Ollama instance (e.g. Google Cloud VM)
# using gemma3:4b for faster and higher-quality output.
# Per-minute summaries still use the local Jetson Ollama (gemma3:1b).
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_CORNELL_MODEL = os.environ.get("OLLAMA_CORNELL_MODEL", "gemma3:4b")

# Minute buffer interval (seconds)
BUFFER_INTERVAL = 60

# Maximum concurrent summary worker threads.  With Ollama on GPU, keep
# this at 1 so only one Ollama inference shares the GPU with Whisper at
# a time.  Two simultaneous GPU inferences would cause memory thrashing
# and latency spikes on the Jetson Orin Nano's shared 7.4 GB.
SUMMARY_MAX_WORKERS = 1

# Frontend callback URL (Next.js API)
# Use NGROK_URL if available (for local development), otherwise FRONTEND_URL (for production)
NGROK_URL = os.environ.get("NGROK_URL", "")
FRONTEND_URL = NGROK_URL if NGROK_URL else os.environ.get("FRONTEND_URL", "https://flexiscribe.vercel.app")

# Shared secret for the async summary callback (FastAPI → Next.js)
# Fallback ensures callbacks are always authenticated even without env var.
CALLBACK_SECRET = os.environ.get("FLEXISCRIBE_CALLBACK_SECRET", "fls-cb-s3cr3t-k7m9x2")