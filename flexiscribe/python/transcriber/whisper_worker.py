"""
Whisper transcription worker — optimised for Jetson Orin Nano with GPU.

Uses OpenAI's PyTorch-based Whisper (``import whisper``) instead of
faster-whisper/CTranslate2, because the CTranslate2 pip package was NOT
compiled with CUDA sm_87 kernels for Jetson Orin.  The NVIDIA Jetson-
specific PyTorch build *does* include sm_87 so we get full GPU inference.

Records live audio from the microphone and transcribes every CHUNK_DURATION
seconds (~10 s).  Each fragment is appended to ``session.live_chunks`` for
real-time display.  The summarisation worker reads those chunks on its own
timer.

Key optimisations for Jetson Orin Nano:
  - "small" model on CUDA FP16 (~0.9 GB VRAM, ~2-3 s per 10 s chunk).
  - beam_size = 1 (greedy) + temperature = 0.0 for fast deterministic output.
  - Ollama runs on CPU (configured elsewhere) so Whisper owns the GPU.
  - RMS energy gate to avoid wasting GPU cycles on silence.
  - Hallucination filter to drop single-word artefacts.
  - Immediate stop: checks stop_event before each transcribe() call.
"""

import time
import threading
import numpy as np
import sounddevice as sd
import whisper                   # OpenAI's PyTorch-based Whisper
import torch
from scipy.signal import resample_poly
from math import gcd

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    WHISPER_SAMPLE_RATE, AUDIO_NATIVE_RATE, AUDIO_DEVICE,
    CHUNK_DURATION, CHANNELS,
    WHISPER_MODEL, WHISPER_DEVICE, WHISPER_FP16,
    WHISPER_LANGUAGE, WHISPER_INITIAL_PROMPT,
    AUDIO_ENERGY_THRESHOLD, WHISPER_BEAM_SIZE, WHISPER_TEMPERATURE,
)


# ── Helpers ───────────────────────────────────────────────────────────────

def _resample_audio(audio: np.ndarray, from_rate: int, to_rate: int) -> np.ndarray:
    """Resample audio from one sample rate to another using polyphase filter."""
    if from_rate == to_rate:
        return audio
    divisor = gcd(from_rate, to_rate)
    up = to_rate // divisor
    down = from_rate // divisor
    return resample_poly(audio, up, down).astype(np.float32)


_model = None
_model_lock = threading.Lock()

# Common Whisper hallucinations when given silence or noise
# Common Whisper hallucinations when given silence or noise.
# Also includes fragments from WHISPER_INITIAL_PROMPT that Whisper
# sometimes regurgitates during quiet/unclear audio segments.
_HALLUCINATION_PHRASES = {
    "you", "the", "i", "a", "is", "it", "and", "to",
    "thank you", "thanks for watching", "subscribe",
    "thank you for watching", "bye", "you.", "the.",
    "thanks", "thank", "please subscribe",
    "so", "uh", "um", "hmm",
    # Prompt echo hallucinations (from WHISPER_INITIAL_PROMPT)
    "Ito ay isang", "ito ay isang lecture",
    "halimbawa ng taglish", "this is a university lecture",
    "this is a university lecture mixing filipino",
}


def get_whisper_model():
    """Load the OpenAI Whisper model once (singleton, thread-safe)."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                device = WHISPER_DEVICE
                print(f"[INFO] Loading Whisper model '{WHISPER_MODEL}' "
                      f"on {device} (fp16={WHISPER_FP16})...")
                try:
                    _model = whisper.load_model(WHISPER_MODEL, device=device)
                except Exception as e:
                    if device != "cpu":
                        print(f"[WARN] Failed on {device}: {e}")
                        print("[INFO] Falling back to CPU...")
                        _model = whisper.load_model(WHISPER_MODEL, device="cpu")
                    else:
                        raise
                print(f"[INFO] Whisper model loaded on "
                      f"{next(_model.parameters()).device}.")
    return _model


def _is_hallucination(text: str) -> bool:
    """Check if transcribed text is a known Whisper hallucination or prompt echo."""
    cleaned = text.strip().lower().rstrip(".!?,")
    if cleaned in _HALLUCINATION_PHRASES:
        return True
    # Also filter very short outputs (≤2 words) that are just filler
    words = cleaned.split()
    if len(words) <= 2 and all(w in _HALLUCINATION_PHRASES for w in words):
        return True
    # Filter prompt echoes: if the entire chunk is a substring of the
    # initial prompt, Whisper is regurgitating context, not real speech.
    from config import WHISPER_INITIAL_PROMPT
    if WHISPER_INITIAL_PROMPT and cleaned in WHISPER_INITIAL_PROMPT.lower():
        return True
    return False


def _rms_energy(audio: np.ndarray) -> float:
    """Compute root-mean-square energy of an audio signal."""
    return float(np.sqrt(np.mean(audio ** 2)))


# ── Transcribe a single audio buffer ─────────────────────────────────────

def _transcribe_chunk(model, audio_data: np.ndarray, needs_resample: bool, use_fp16: bool = False):
    """
    Resample -> energy gate -> normalise -> transcribe -> hallucination filter.
    Returns the transcribed text or None.

    use_fp16 is determined by the caller based on the **actual** model device
    (not the config value, which may be stale after a CUDA → CPU fallback).
    """
    if needs_resample:
        audio_data = _resample_audio(
            audio_data, AUDIO_NATIVE_RATE, WHISPER_SAMPLE_RATE,
        )

    energy = _rms_energy(audio_data)
    if energy < AUDIO_ENERGY_THRESHOLD:
        print(f"[DEBUG] Skipping chunk (energy={energy:.6f} "
              f"< threshold={AUDIO_ENERGY_THRESHOLD})")
        return None

    # Normalise to [-1, 1]
    audio_data = audio_data.astype(np.float32)
    peak = np.max(np.abs(audio_data))
    if peak > 0:
        audio_data /= peak

    # Pad or trim to exactly 30 s as expected by openai-whisper
    audio_data = whisper.pad_or_trim(audio_data)

    # Encode mel spectrogram on the model's device
    mel = whisper.log_mel_spectrogram(audio_data).to(model.device)

    # Decode with optimised settings for Taglish real-time
    options = whisper.DecodingOptions(
        language=WHISPER_LANGUAGE,
        beam_size=WHISPER_BEAM_SIZE if WHISPER_BEAM_SIZE > 1 else None,
        best_of=None,
        temperature=WHISPER_TEMPERATURE,
        prompt=WHISPER_INITIAL_PROMPT,
        fp16=use_fp16,
        without_timestamps=True,
        suppress_blank=True,
    )
    result = whisper.decode(model, mel, options)
    transcript_text = result.text.strip()

    if not transcript_text:
        print("[DEBUG] Whisper returned empty transcript.")
        return None

    if _is_hallucination(transcript_text):
        print(f'[DEBUG] Filtered hallucination: "{transcript_text}"')
        return None

    # Log no-speech probability for diagnostics only — do NOT filter.
    # High no_speech_prob chunks may still contain valid speech (e.g.
    # quiet speakers, background noise) and should be kept so no audio
    # content is lost from the transcript.
    if hasattr(result, "no_speech_prob") and result.no_speech_prob > 0.6:
        print(f"[DEBUG] High no_speech_prob ({result.no_speech_prob:.2f}), "
              f"keeping: \"{transcript_text[:50]}\"")

    return transcript_text


# ── Main worker ───────────────────────────────────────────────────────────

def whisper_worker(stop_event: threading.Event, session):
    """
    Records live audio, transcribes with Whisper every ~10 s, and appends
    each fragment to ``session.live_chunks`` for real-time display.

    The summarisation worker independently reads ``live_chunks`` on a 60 s
    timer, so this function has zero queue/buffer overhead.

    On stop it processes any remaining audio so no spoken words are lost,
    then sets ``session.whisper_done`` to tell the summariser it can safely
    collect the final chunks.
    """
    model = get_whisper_model()
    needs_resample = AUDIO_NATIVE_RATE != WHISPER_SAMPLE_RATE

    # Determine fp16 from the ACTUAL model device — not the config value.
    # If CUDA failed and the model fell back to CPU, WHISPER_FP16 is still
    # True (set at import time), but fp16 on CPU is emulated and ~3-5× slower.
    actual_device = next(model.parameters()).device
    use_fp16 = WHISPER_FP16 and actual_device.type == "cuda"

    print("[INFO] Whisper worker started.")
    print(f"[INFO] Model={WHISPER_MODEL}, device={actual_device}, "
          f"fp16={use_fp16}, beam_size={WHISPER_BEAM_SIZE}, "
          f"Language={WHISPER_LANGUAGE or 'auto-detect'}, "
          f"energy_threshold={AUDIO_ENERGY_THRESHOLD}")
    if actual_device.type != WHISPER_DEVICE:
        print(f"[WARN] Model is on {actual_device} (config wanted {WHISPER_DEVICE}). "
              f"fp16 overridden to {use_fp16}.")
    print(f"[INFO] Audio device={AUDIO_DEVICE}, "
          f"native_rate={AUDIO_NATIVE_RATE}Hz, "
          f"whisper_rate={WHISPER_SAMPLE_RATE}Hz, "
          f"resample={'yes' if needs_resample else 'no'}")

    audio_buffer = []
    buffer_lock = threading.Lock()

    def audio_callback(indata, frames, time_info, status):
        if status:
            print(f"[WARN] {status}")
        with buffer_lock:
            audio_buffer.append(indata[:, 0].copy())

    def _drain_buffer():
        """Thread-safe drain of the audio buffer."""
        with buffer_lock:
            if not audio_buffer:
                return None
            data = np.concatenate(audio_buffer, axis=0)
            audio_buffer.clear()
            return data

    def _append_live_chunk(text):
        """Append a transcribed fragment to session.live_chunks."""
        session.live_chunk_counter += 1
        session.live_chunks.append({
            "chunk_id": session.live_chunk_counter,
            "timestamp": time.strftime("%H:%M:%S"),
            "text": text,
        })
        print(f"[LIVE] Chunk {session.live_chunk_counter}: {text[:80]}...")

    try:
        # ── Flush stale PulseAudio buffer ──────────────────────────
        # PulseAudio may hold residual audio from a previous session.
        # Open a short-lived stream with a tiny blocksize to drain it.
        _flush_buf = []
        def _flush_cb(indata, frames, time_info, status):
            _flush_buf.append(indata.copy())
        try:
            with sd.InputStream(
                samplerate=AUDIO_NATIVE_RATE,
                channels=CHANNELS,
                device=AUDIO_DEVICE,
                callback=_flush_cb,
                blocksize=int(AUDIO_NATIVE_RATE * 0.1),  # 100 ms blocks
            ):
                time.sleep(0.5)  # let PulseAudio deliver any buffered audio
            flushed = sum(len(b) for b in _flush_buf)
            if flushed > 0:
                print(f"[INFO] Flushed {flushed} stale samples from audio buffer.")
        except Exception as e:
            print(f"[WARN] Audio buffer flush failed (non-fatal): {e}")

        with sd.InputStream(
            samplerate=AUDIO_NATIVE_RATE,
            channels=CHANNELS,
            device=AUDIO_DEVICE,
            callback=audio_callback,
            blocksize=int(AUDIO_NATIVE_RATE * CHUNK_DURATION),
        ):
            print(f"[INFO] Recording audio from device {AUDIO_DEVICE}...")

            while not stop_event.is_set():
                # Wait for one chunk-duration of audio or until stop
                stop_event.wait(timeout=CHUNK_DURATION)

                # Check stop BEFORE transcribing to avoid processing after stop
                audio_data = _drain_buffer()
                if audio_data is None:
                    continue

                # If stop was signalled, still transcribe this last buffered audio
                t0 = time.time()
                text = _transcribe_chunk(model, audio_data, needs_resample, use_fp16)
                elapsed = time.time() - t0
                if text:
                    _append_live_chunk(text)
                    print(f"[PERF] Transcription took {elapsed:.1f}s")

            # ── Process ALL remaining audio after stop ────────────────
            time.sleep(0.3)
            audio_data = _drain_buffer()
            if audio_data is not None:
                print("[INFO] Processing remaining audio buffer on stop...")
                text = _transcribe_chunk(model, audio_data, needs_resample, use_fp16)
                if text:
                    _append_live_chunk(text)

    except Exception as e:
        print(f"[ERROR] Whisper worker for session {session.session_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.whisper_done.set()
        print("[INFO] Whisper worker stopped — whisper_done event set.")
