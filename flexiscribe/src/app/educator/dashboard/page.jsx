"use client";

import SearchBar from "@/layouts/educator/SearchBar";
import ProfessorProfileCard from "@/components/educator/cards/ProfessorProfileCard";
import ScheduleCard from "@/components/educator/cards/ScheduleCard";
import WelcomeCard from "@/components/educator/cards/WelcomeCard";
import LectureRecordingsCard from "@/components/educator/cards/LectureRecordingsCard";
import CalendarCard from "@/components/educator/cards/CalendarCard";
import StudentsLeaderboardCard from "@/components/educator/cards/StudentsLeaderboardCard";

export default function DashboardPage() {

  return (
    <>
      {/* ================= MOBILE ================= */}
      <div className="md:hidden flex flex-col gap-5 p-4">

        {/* HEADER ROW */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SearchBar />
          </div>

          {/* PROFILE */}
          <ProfessorProfileCard />
        </div>

        {/* WELCOME */}
        <WelcomeCard />

        {/* MAIN CONTENT */}
        <LectureRecordingsCard />

        {/* SECONDARY */}
        <ScheduleCard />
        <CalendarCard />

        {/* STATS */}
        <StudentsLeaderboardCard />

      </div>

      {/* ================= TABLET ================= */}
      <div className="hidden md:block lg:hidden p-6 space-y-6">

        <div className="grid grid-cols-2 gap-6">

          <SearchBar />

          <ProfessorProfileCard />
        </div>

        <WelcomeCard />

        <div className="grid grid-cols-2 gap-6">
          <LectureRecordingsCard />
          <ScheduleCard />
        </div>

        <CalendarCard />
        <StudentsLeaderboardCard />

      </div>

      {/* ================= DESKTOP ================= */}
      <div className="hidden lg:flex gap-6 xl:gap-8 p-6 xl:p-10 max-w-[1600px] mx-auto">

        {/* LEFT COLUMN — takes remaining width */}
        <div className="flex-1 min-w-0 flex flex-col gap-6 xl:gap-8">

          <SearchBar />

          <WelcomeCard />

          <div className="grid grid-cols-2 gap-6 xl:gap-8">
            <ScheduleCard />
            <CalendarCard />
          </div>

          <StudentsLeaderboardCard />

        </div>

        {/* RIGHT COLUMN — fixed width sidebar */}
        <div className="w-[320px] xl:w-[360px] 2xl:w-[400px] shrink-0 flex flex-col gap-6 xl:gap-8">

          <ProfessorProfileCard />

          <div className="flex-1">
            <LectureRecordingsCard />
          </div>

        </div>

      </div>
    </>
  );
}
