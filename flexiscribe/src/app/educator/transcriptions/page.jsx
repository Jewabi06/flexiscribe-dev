"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import TranscriptionHeader from "./components/TranscriptionHeader";
import CourseTabs from "./components/CourseTabs";
import TranscriptCard from "./components/TranscriptCard";
import PreviewPanel from "./components/PreviewPanel";
import LoadingScreen from "@/components/shared/LoadingScreen";

export default function TranscriptionsPage() {
  const searchParams = useSearchParams();

  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState("");
  const [selected, setSelected] = useState(null);

  // Fetch all transcriptions
  useEffect(() => {
    async function fetchTranscriptions() {
      try {
        const res = await fetch("/api/educator/transcriptions");
        if (res.ok) {
          const data = await res.json();
          setTranscripts(data.transcriptions);
          
          // Extract unique courses
          const uniqueCourses = [...new Set(data.transcriptions.map(t => t.course))];
          setCourses(uniqueCourses);
          
          if (uniqueCourses.length > 0 && !activeCourse) {
            setActiveCourse(uniqueCourses[0]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch transcriptions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTranscriptions();
  }, []);

  /* Sync from URL */
  useEffect(() => {
    const course = searchParams.get("course");
    const id = searchParams.get("id");

    if (course && courses.includes(course)) {
      setActiveCourse(course);
    }

    if (id) {
      const found = transcripts.find(
        (t) => t.id === id
      );
      setSelected(found || null);
    }
  }, [searchParams, courses, transcripts]);

  const filtered = transcripts.filter(
    (t) => t.course === activeCourse
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="h-full flex flex-col px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <TranscriptionHeader />

      <div className="mt-3 sm:mt-4">
        <CourseTabs
          courses={courses}
          activeCourse={activeCourse}
          onChange={(course) => {
            setActiveCourse(course);
            setSelected(null);
          }}
        />
      </div>

      {/* MAIN LAYOUT */}
      <div className="
        flex-1
        mt-4 sm:mt-6
        flex flex-col
        lg:grid lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr] 2xl:grid-cols-[380px_1fr]
        gap-4 sm:gap-6
        min-h-0
      ">

        {/* LIST */}
        <aside className="
          overflow-y-auto
          pr-1
          pb-6
          rounded-xl
          flex-shrink-0
          max-h-[45vh] lg:max-h-none
          edu-scrollbar
        ">
          <div className="space-y-4 sm:space-y-6 px-1">
            {filtered.map((t) => (
              <TranscriptCard
                key={t.id}
                transcript={t}
                selected={selected?.id === t.id}
                onSelect={() => setSelected(t)}
              />
            ))}
          </div>
        </aside>

        {/* PREVIEW */}
        <main className="
          min-w-0
          flex
          flex-col
        ">
          <PreviewPanel transcript={selected} />
        </main>

      </div>
    </div>
  );
}
