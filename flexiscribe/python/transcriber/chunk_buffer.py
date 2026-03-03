import time


class MinuteBuffer:
    """Buffers transcribed text and flushes at configurable intervals."""

    def __init__(self, interval=60):
        self.interval = interval
        self.start_time = time.time()
        self.buffer = []

    def add_text(self, text: str):
        self.buffer.append(text)

    def should_flush(self) -> bool:
        return time.time() - self.start_time >= self.interval

    def flush(self) -> str:
        text = " ".join(self.buffer)
        self.buffer.clear()
        self.start_time = time.time()
        return text

    def has_content(self) -> bool:
        return len(self.buffer) > 0
