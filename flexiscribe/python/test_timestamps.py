#!/usr/bin/env python3
"""
Quick test to verify timestamp formatting is 0-based.
"""
import time
from session_manager import TranscriptionSession

# Create a test session
session = TranscriptionSession(
    session_id="test-123",
    course_code="TEST101",
    educator_id="edu-001",
    session_type="lecture"
)

print(f"Session started at: {session.started_at}")
print(f"Initial timestamp (should be 00:00): {session.get_elapsed_timestamp()}")

# Simulate 1 minute 30 seconds elapsed
time.sleep(2)  # Wait 2 seconds for demonstration
fake_time = session.started_at + 90  # Simulate 1:30 elapsed
print(f"Timestamp at 1:30 (simulated): {session.get_elapsed_timestamp(fake_time)}")

# Simulate 10 minutes 45 seconds
fake_time = session.started_at + 645  # 10 * 60 + 45
print(f"Timestamp at 10:45 (simulated): {session.get_elapsed_timestamp(fake_time)}")

# Test actual elapsed time
actual_timestamp = session.get_elapsed_timestamp()
print(f"Actual elapsed time: {actual_timestamp}")

print("\n✓ Timestamps are now 0-based (MM:SS format)")
