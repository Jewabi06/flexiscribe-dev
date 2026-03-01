import time
import threading
import queue
import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel
from scipy.signal import resample_poly
from math import gcd

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    WHISPER_SAMPLE_RATE, AUDIO_NATIVE_RATE, AUDIO_DEVICE,
    CHUNK_DURATION, CHANNELS,
    WHISPER_MODEL, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE,
    WHISPER_LANGUAGE, WHISPER_INITIAL_PROMPT, WHISPER_VAD_FILTER,
    AUDIO_ENERGY_THRESHOLD, BUFFER_INTERVAL,
)
from transcriber.chunk_buffer import MinuteBuffer


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
_HALLUCINATION_PHRASES = {
    "you", "the", "i", "a", "is", "it", "and", "to",
    "thank you", "thanks for watching", "subscribe",
    "thank you for watching", "bye", "you.", "the.",
    "thanks", "thank", "please subscribe",
}


def get_whisper_model() -> WhisperModel:
    """Load the Whisper model once with safe device/compute-type fallback."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                device = WHISPER_DEVICE
                compute_type = WHISPER_COMPUTE_TYPE
                print(f"[INFO] Loading Whisper model '{WHISPER_MODEL}' "
                      f"on {device} ({compute_type})...")
                try:
                    _model = WhisperModel(
                        WHISPER_MODEL,
                        device=device,
                        compute_type=compute_type,
                    )
                except Exception as e:
                    # Fallback: if CUDA fails at runtime, drop to CPU
                    if device != "cpu":
                        print(f"[WARN] Failed to load on {device}: {e}")
                        print("[INFO] Falling back to CPU (float32)...")
                        _model = WhisperModel(
                            WHISPER_MODEL,
                            device="cpu",
                            compute_type="float32",
                        )
                    else:
                        raise
                print("[INFO] Whisper model loaded.")
    return _model


def _is_hallucination(text: str) -> bool:
    """Check if transcribed text is a known Whisper hallucination."""
    cleaned = text.strip().lower().rstrip(".!?,")
    return cleaned in _HALLUCINATION_PHRASES


def _rms_energy(audio: np.ndarray) -> float:
    """Compute root-mean-square energy of an audio signal."""
    return float(np.sqrt(np.mean(audio ** 2)))


def whisper_worker(text_queue: queue.Queue, stop_event: threading.Event, session=None):
    """
    Records live audio from mic, transcribes with Whisper every CHUNK_DURATION
    seconds (~10s), and does two things with each fragment:

    1. Immediately appends to session.live_chunks for real-time display.
    2. Accumulates in MinuteBuffer and flushes to text_queue every 60s
       for per-minute summarization (~6 chunks per summary).

    Key features:
    - RMS energy gate: skips near-silent chunks before they reach Whisper.
    - VAD filter (Silero): faster-whisper strips silent segments internally.
    - Language / initial-prompt: steers Whisper toward Taglish output.
    - Hallucination filter: drops single-word artefacts like "You".
    - MinuteBuffer: accumulates transcribed text, flushes every 60 seconds.
    """
    model = get_whisper_model()
    minute_buffer = MinuteBuffer(interval=BUFFER_INTERVAL)
    needs_resample = (AUDIO_NATIVE_RATE != WHISPER_SAMPLE_RATE)
    print("[INFO] Whisper worker started.")
    print(f"[INFO] Model={WHISPER_MODEL}, Language={WHISPER_LANGUAGE or 'auto-detect'}, "
          f"VAD={WHISPER_VAD_FILTER}, "
          f"energy_threshold={AUDIO_ENERGY_THRESHOLD}, "
          f"buffer_interval={BUFFER_INTERVAL}s")
    print(f"[INFO] Audio device={AUDIO_DEVICE}, "
          f"native_rate={AUDIO_NATIVE_RATE}Hz, "
          f"whisper_rate={WHISPER_SAMPLE_RATE}Hz, "
          f"resample={'yes' if needs_resample else 'no'}")
    audio_buffer = []

    last_display_time = time.time()
    last_summary_time = time.time()

    def audio_callback(indata, frames, time_info, status):
        if status:
            print(f"[WARN] {status}")
        audio_buffer.append(indata[:, 0].copy())

    try:
        with sd.InputStream(
            samplerate=AUDIO_NATIVE_RATE,
            channels=CHANNELS,
            device=AUDIO_DEVICE,
            callback=audio_callback,
            blocksize=int(AUDIO_NATIVE_RATE * CHUNK_DURATION),
        ):
            print(f"[INFO] Recording audio from device {AUDIO_DEVICE}...")
            while not stop_event.is_set():
                time.sleep(0.5)  # check buffer twice per second

                if not audio_buffer:
                    # Even if no audio, check if minute buffer should flush
                    if minute_buffer.should_flush() and minute_buffer.has_content():
                        combined_text = minute_buffer.flush()
                        if combined_text.strip():
                            text_queue.put(combined_text)
                            print(f"[BUFFER] Flushed minute text ({len(combined_text)} chars)")
                    continue

                audio_data = np.concatenate(audio_buffer, axis=0)
                audio_buffer.clear()

                # ── Resample from mic native rate to Whisper's 16kHz ──
                if needs_resample:
                    audio_data = _resample_audio(
                        audio_data, AUDIO_NATIVE_RATE, WHISPER_SAMPLE_RATE
                    )

                # ── Energy gate: skip chunks that are mostly silence ──
                energy = _rms_energy(audio_data)
                if energy < AUDIO_ENERGY_THRESHOLD:
                    print(f"[DEBUG] Skipping chunk (energy={energy:.6f} "
                          f"< threshold={AUDIO_ENERGY_THRESHOLD})")
                    # Still check minute buffer flush even on silent chunks
                    if minute_buffer.should_flush() and minute_buffer.has_content():
                        combined_text = minute_buffer.flush()
                        if combined_text.strip():
                            text_queue.put(combined_text)
                            print(f"[BUFFER] Flushed minute text ({len(combined_text)} chars)")
                    continue

                # Normalise audio to [-1, 1]
                audio_data = audio_data.astype(np.float32)
                peak = np.max(np.abs(audio_data))
                if peak > 0:
                    audio_data /= peak

                # ── Transcribe with Taglish-aware settings ──
                segments, info = model.transcribe(
                    audio_data,
                    beam_size=5,
                    language=WHISPER_LANGUAGE,
                    initial_prompt=WHISPER_INITIAL_PROMPT,
                    vad_filter=WHISPER_VAD_FILTER,
                    vad_parameters=dict(
                        min_silence_duration_ms=500,
                        speech_pad_ms=300,
                    ),
                    condition_on_previous_text=False,
                    no_speech_threshold=0.6,
                    log_prob_threshold=-1.0,
                )

                transcript_text = " ".join(
                    seg.text.strip() for seg in segments
                ).strip()

                # ── Drop known hallucinations ──
                if not transcript_text:
                    print("[DEBUG] Whisper returned empty transcript.")
                else:
                    if _is_hallucination(transcript_text):
                        print(f"[DEBUG] Filtered hallucination: \"{transcript_text}\"")
                    else:
                        if info and hasattr(info, 'language'):
                            print(f"[DEBUG] Detected language: {info.language} "
                                  f"(prob={getattr(info, 'language_probability', 'N/A')})")

                        # ── Real-time: append to session.live_chunks immediately ──
                        if session is not None:
                            import time as _time
                            session.live_chunk_counter += 1
                            live_chunk = {
                                "chunk_id": session.live_chunk_counter,
                                "timestamp": _time.strftime("%H:%M:%S"),
                                "text": transcript_text,
                            }
                            session.live_chunks.append(live_chunk)
                            print(f"[LIVE] Chunk {session.live_chunk_counter}: "
                                  f"{transcript_text[:60]}...")

                        # ── Accumulate for 60s summarization ──
                        minute_buffer.add_text(transcript_text)

                # ── Flush minute buffer if interval has elapsed ──
                if minute_buffer.should_flush() and minute_buffer.has_content():
                    combined_text = minute_buffer.flush()
                    if combined_text.strip():
                        text_queue.put(combined_text)
                        print(f"[BUFFER] Flushed minute text ({len(combined_text)} chars)")

    except Exception as e:
        print(f"[ERROR] Whisper worker for session {session.session_id}: {e}")
    finally:
        # ── Flush any remaining buffered text when stopping ──
        if minute_buffer.has_content():
            remaining_text = minute_buffer.flush()
            if remaining_text.strip():
                text_queue.put(remaining_text)
                print(f"[BUFFER] Flushed remaining text on stop ({len(remaining_text)} chars)")
        print("[INFO] Whisper worker stopped.")
