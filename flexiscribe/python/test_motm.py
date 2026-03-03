"""
Test MOTM (Minutes of the Meeting) generation.
Sends a sample meeting transcript through the MOTM prompt and saves
the output to Documents/summaries/ for quality review.
"""
import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from summarizer.summarizer import summarize_motm

SAMPLE_TRANSCRIPT = """
Good morning everyone! It's March 3, 2026, 9:00 AM. Let's start today's meeting. I'm Professor Garcia, and we're here to discuss the progress of the CPE103 capstone projects.

First agenda item: Project Milestone Updates. 

Team Alpha, represented by Juan, presented their progress on the IoT-based classroom monitoring system. They mentioned they've completed the hardware prototyping phase and are now working on the software integration with the Raspberry Pi. Juan said they're about 70% done with the project. Professor Garcia asked about their timeline, and Juan confirmed they expect to finish integration testing by March 15.

Team Beta, led by Maria, discussed their mobile app for student attendance tracking. Maria reported that the UI design is finalized and they've started backend development using Firebase. However, she raised a concern about the QR code scanning feature being slower than expected on older Android devices. Professor Garcia suggested they look into optimizing the image processing or consider using NFC as an alternative.

Moving on to the second agenda item: Final Presentation Schedule.

Professor Garcia announced that final project presentations will be held on April 10 and 11, 2026. Each team will have 20 minutes to present followed by a 10-minute Q&A session. He reminded everyone that a working prototype is required — PowerPoint-only presentations will not be accepted. 

Maria asked if teams can request a specific presentation date. Professor Garcia said yes, but requests must be submitted by March 20 via email.

There was also a brief discussion about the grading rubric. Professor Garcia clarified that 40% of the grade will come from the working prototype, 30% from the presentation and documentation, and 30% from peer evaluation.

Before wrapping up, Professor Garcia reminded everyone that the next meeting will be on March 17, 2026, at 9:00 AM, same room. He asked all teams to prepare a one-page progress report to bring to the next meeting.

That concludes today's meeting. Thank you everyone! Meeting adjourned at 10:15 AM.

This meeting's minutes were prepared by Ana Santos.
"""

def main():
    print("=" * 60)
    print("MOTM (Minutes of the Meeting) Generation Test")
    print("=" * 60)
    print(f"\nTranscript length: {len(SAMPLE_TRANSCRIPT)} characters")
    print("\nGenerating MOTM via Ollama (gemma3:1b)...")
    
    start = time.time()
    
    try:
        result = summarize_motm(SAMPLE_TRANSCRIPT)
    except Exception as e:
        print(f"\n[ERROR] MOTM generation failed: {e}")
        import traceback
        traceback.print_exc()
        return
    
    elapsed = time.time() - start
    print(f"Generation completed in {elapsed:.1f}s\n")
    
    # Save to Documents/summaries
    output_dir = os.path.join(os.path.expanduser("~"), "Documents", "summaries")
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(output_dir, f"motm_test_{timestamp}.json")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"Saved to: {output_path}\n")
    print("-" * 60)
    print("Generated MOTM Output:")
    print("-" * 60)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("-" * 60)
    
    # Validate structure
    print("\nStructure Validation:")
    expected_keys = ["meeting_title", "date", "time", "speaker", "agendas", "next_meeting", "prepared_by"]
    for key in expected_keys:
        status = "OK" if key in result else "MISSING"
        print(f"  {key}: {status}")
    
    if "agendas" in result and isinstance(result["agendas"], list):
        print(f"  agenda count: {len(result['agendas'])}")
        for i, agenda in enumerate(result["agendas"]):
            print(f"    Agenda {i+1}: {agenda.get('title', 'NO TITLE')}")
            kp = agenda.get("key_points", [])
            ic = agenda.get("important_clarifications", [])
            print(f"      Key points: {len(kp)}, Clarifications: {len(ic)}")
    
    print(f"\nSpeaker field blank: {'OK' if result.get('speaker', 'x') == '' else 'FAIL'}")
    print("Done!")


if __name__ == "__main__":
    main()
