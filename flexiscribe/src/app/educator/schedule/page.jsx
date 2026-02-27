"use client";

import { useEffect, useState } from "react";
import ScheduleGrid from "./components/ScheduleGrid";
import { generateTimeSlots } from "@/lib/timeSlots";
import LoadingScreen from "@/components/shared/LoadingScreen";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function SchedulePage() {
  const timeSlots = generateTimeSlots(7, 22);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const res = await fetch("/api/educator/schedule");
        if (res.ok) {
          const data = await res.json();
          setClasses(data.schedule);
        }
      } catch (error) {
        console.error("Failed to fetch schedule:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ScheduleGrid
        classes={classes}
        days={days}
        timeSlots={timeSlots}
      />
    </div>
  );
}
