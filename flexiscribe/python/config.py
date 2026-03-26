import os

# Base output directory
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# ─── Jetson Orin Nano library path fix ───────────────────────────────────
_CUSPARSE_PATH = os.path.expanduser(
    "~/.local/lib/python3.10/site-packages/nvidia/cusparselt/lib"
)
if os.path.isdir(_CUSPARSE_PATH):
    os.environ.setdefault("LD_LIBRARY_PATH", "")
    if _CUSPARSE_PATH not in os.environ["LD_LIBRARY_PATH"]:
        os.environ["LD_LIBRARY_PATH"] = (
            _CUSPARSE_PATH + ":" + os.environ["LD_LIBRARY_PATH"]
        )
    import ctypes
    try:
        ctypes.CDLL(os.path.join(_CUSPARSE_PATH, "libcusparseLt.so.0"))
    except OSError:
        pass

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:False")

# ─── Audio input ─────────────────────────────────────────────────────────
def _detect_audio_device():
    try:
        import sounddevice as sd
        import subprocess
        # Set USB mic as PulseAudio default
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

# ─── Whisper settings ────────────────────────────────────────────────────
WHISPER_SAMPLE_RATE = 16000
CHUNK_DURATION = 3            # seconds per audio chunk → live caption updates every 3s
CHANNELS = 1

WHISPER_MODEL = "small"       # best balance of accuracy/speed for Taglish

def _detect_whisper_device():
    try:
        import torch
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            sm = f"sm_{props.major}{props.minor}"
            arch_list = torch.cuda.get_arch_list()
            if sm in arch_list or f"compute_{props.major}{props.minor}" in arch_list:
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
WHISPER_FP16 = WHISPER_DEVICE == "cuda"          # FP16 only on GPU

WHISPER_LANGUAGE = "en"                         # works well with Taglish
WHISPER_INITIAL_PROMPT = (" ")                  # empty prompt reduces hallucinations

WHISPER_VAD_FILTER = True
AUDIO_ENERGY_THRESHOLD = 0.01                   # skip very quiet chunks → fewer hallucinations
WHISPER_BEAM_SIZE = 1                           # greedy decoding for speed
WHISPER_TEMPERATURE = 0.0

# ─── Summarizer settings ─────────────────────────────────────────────────
OLLAMA_MODEL = "gemma3:1b"
OLLAMA_GPU_LAYERS = 99

# Remote GPU-powered Ollama for final summaries
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://34.21.130.162:11434")
OLLAMA_CORNELL_MODEL = os.environ.get("OLLAMA_CORNELL_MODEL", "gemma3:4b-it-q4_K_M")

BUFFER_INTERVAL = 60
SUMMARY_MAX_WORKERS = 1

NGROK_URL = os.environ.get("NGROK_URL", "")
FRONTEND_URL = NGROK_URL if NGROK_URL else os.environ.get("FRONTEND_URL", "https://flexiscribe.vercel.app")
CALLBACK_SECRET = os.environ.get("FLEXISCRIBE_CALLBACK_SECRET", "fls-cb-s3cr3t-k7m9x2")