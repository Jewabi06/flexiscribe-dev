"""
Whisper transcription worker — optimised for Jetson Orin Nano with GPU.
Records live audio, transcribes every CHUNK_DURATION seconds, and appends
each fragment to session.live_chunks for real-time display.
"""

import time
import threading
import numpy as np
import sounddevice as sd
import whisper
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

# HELPERS
def _resample_audio(audio: np.ndarray, from_rate: int, to_rate: int) -> np.ndarray:
    if from_rate == to_rate:
        return audio
    divisor = gcd(from_rate, to_rate)
    up = to_rate // divisor
    down = from_rate // divisor
    return resample_poly(audio, up, down).astype(np.float32)

_model = None
_model_lock = threading.Lock()

_HALLUCINATION_PHRASES = {}

def get_whisper_model():
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
                actual_device = next(_model.parameters()).device
                print(f"[INFO] Whisper model loaded on {actual_device}.")
    return _model

def _is_hallucination(text: str) -> bool:
    cleaned = text.strip().lower().rstrip(".!?,")
    if cleaned in _HALLUCINATION_PHRASES:
        return True
    words = cleaned.split()
    if len(words) <= 2 and all(w in _HALLUCINATION_PHRASES for w in words):
        return True
    # Also filter prompt echoes if the whole chunk is a substring of the prompt
    from config import WHISPER_INITIAL_PROMPT
    if WHISPER_INITIAL_PROMPT and cleaned in WHISPER_INITIAL_PROMPT.lower():
        return True
    return False

def _rms_energy(audio: np.ndarray) -> float:
    return float(np.sqrt(np.mean(audio ** 2)))

# Transcribe a single audio buffer
def _transcribe_chunk(model, audio_data: np.ndarray, needs_resample: bool, use_fp16: bool = False):
    t_start = time.time()
    if needs_resample:
        audio_data = _resample_audio(
            audio_data, AUDIO_NATIVE_RATE, WHISPER_SAMPLE_RATE,
        )

    energy = _rms_energy(audio_data)
    if energy < AUDIO_ENERGY_THRESHOLD:
        print(f"[DEBUG] Skipping chunk (energy={energy:.6f} "
              f"< threshold={AUDIO_ENERGY_THRESHOLD})")
        return None

    # Normalize to [-1, 1]
    audio_data = audio_data.astype(np.float32)
    peak = np.max(np.abs(audio_data))
    if peak > 0:
        audio_data /= peak

    audio_data = whisper.pad_or_trim(audio_data)
    mel = whisper.log_mel_spectrogram(audio_data).to(model.device)

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

    # Filter high no-speech probability (hallucinations from silence)
    if hasattr(result, "no_speech_prob") and result.no_speech_prob > 0.8:
        print(f"[DEBUG] Skipping high no-speech chunk (prob={result.no_speech_prob:.2f})")
        return None

    t_end = time.time()
    print(f"[PERF] Transcription took {t_end - t_start:.2f}s for {CHUNK_DURATION}s audio")

    if not transcript_text:
        print("[DEBUG] Whisper returned empty transcript.")
        return None

    if _is_hallucination(transcript_text):
        print(f'[DEBUG] Filtered hallucination: "{transcript_text}"')
        return None

    if hasattr(result, "no_speech_prob") and result.no_speech_prob > 0.6:
        print(f"[DEBUG] High no_speech_prob ({result.no_speech_prob:.2f}), "
              f"keeping: \"{transcript_text[:50]}\"")

    return transcript_text

# ── Main worker ───────────────────────────────────────────────────────────
def whisper_worker(stop_event: threading.Event, session):
    model = get_whisper_model()
    needs_resample = AUDIO_NATIVE_RATE != WHISPER_SAMPLE_RATE
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

    # Variables for 10‑second final transcript buffer
    ten_sec_buffer = []
    ten_sec_start = time.time()

    def audio_callback(indata, frames, time_info, status):
        if status:
            print(f"[WARN] {status}")
        with buffer_lock:
            audio_buffer.append(indata[:, 0].copy())

    def _drain_buffer():
        with buffer_lock:
            if not audio_buffer:
                return None
            data = np.concatenate(audio_buffer, axis=0)
            audio_buffer.clear()
            return data

    def _append_live_chunk(text):
        session.live_chunk_counter += 1
        timestamp = session.get_elapsed_timestamp()
        session.live_chunks.append({
            "chunk_id": session.live_chunk_counter,
            "timestamp": timestamp,
            "text": text,
        })
        print(f"[LIVE] Chunk {session.live_chunk_counter} at {timestamp}: {text[:80]}...")

    try:
        # Flush stale PulseAudio buffer
        _flush_buf = []
        def _flush_cb(indata, frames, time_info, status):
            _flush_buf.append(indata.copy())
        try:
            with sd.InputStream(
                samplerate=AUDIO_NATIVE_RATE,
                channels=CHANNELS,
                device=AUDIO_DEVICE,
                callback=_flush_cb,
                blocksize=int(AUDIO_NATIVE_RATE * 0.1),
            ):
                time.sleep(0.5)
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
                stop_event.wait(timeout=CHUNK_DURATION)

                audio_data = _drain_buffer()
                if audio_data is None:
                    continue

                text = _transcribe_chunk(model, audio_data, needs_resample, use_fp16)
                if text:
                    _append_live_chunk(text)

                    # Build 10‑second final transcript chunks
                    ten_sec_buffer.append(text)
                    now = time.time()
                    if now - ten_sec_start >= 10.0:
                        combined = " ".join(ten_sec_buffer)
                        timestamp = session.get_elapsed_timestamp(now)
                        session.final_transcript_chunks.append({
                            "timestamp": timestamp,
                            "text": combined,
                        })
                        print(f"[FINAL] 10s chunk at {timestamp}: {combined[:80]}...")
                        ten_sec_buffer.clear()
                        ten_sec_start = now

            # Process remaining audio after stop
            time.sleep(0.3)
            audio_data = _drain_buffer()
            if audio_data is not None:
                print("[INFO] Processing remaining audio buffer on stop...")
                text = _transcribe_chunk(model, audio_data, needs_resample, use_fp16)
                if text:
                    _append_live_chunk(text)
                    ten_sec_buffer.append(text)

            # Flush any leftover 10‑second buffer
            if ten_sec_buffer:
                combined = " ".join(ten_sec_buffer)
                timestamp = session.get_elapsed_timestamp(time.time())
                session.final_transcript_chunks.append({
                    "timestamp": timestamp,
                    "text": combined,
                })
                print(f"[FINAL] Final 10s chunk at {timestamp}: {combined[:80]}...")
                ten_sec_buffer.clear()

    except Exception as e:
        print(f"[ERROR] Whisper worker for session {session.session_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.whisper_done.set()
        print("[INFO] Whisper worker stopped — whisper_done event set.")