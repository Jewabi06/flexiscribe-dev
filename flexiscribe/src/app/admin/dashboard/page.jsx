"use client";

import { useState, useEffect } from "react";
import StatCard from "@/components/admin/cards/StatCard";
import ProgressCard from "@/components/admin/cards/ProgressCard";
import RecentActivityCard from "@/components/admin/cards/RecentActivityCard";
import ClassAnalyticsCard from "@/components/admin/cards/ClassAnalyticsCard";
import LoadingScreen from "@/components/shared/LoadingScreen";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalEducators: 0,
    activeUsers: 0,
    flashcards: 0,
    mcqs: 0,
    fitb: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch("/api/admin/dashboard");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentActivities(data.recentActivities || []);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* QUICK STATS */}
      <section className="space-y-3 sm:space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-[#9d8adb]">
          Quick Stats
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          <StatCard
            label="Total Students"
            value={stats.totalStudents}
          />
          <StatCard
            label="Total Educators"
            value={stats.totalEducators}
          />
          <StatCard
            label="Active Users"
            value={stats.activeUsers}
          />
        </div>
      </section>

      {/* PROGRESS */}
      <ProgressCard
        flashcards={stats.flashcards}
        mcqs={stats.mcqs}
        fitb={stats.fitb}
      />

      {/* ANALYTICS */}
      <section>
        <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_3fr] gap-6">
          {/* RECENT ACTIVITY */}
          <div className="space-y-2 sm:space-y-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#9d8adb]">
              Recent Activity
            </h2>
            <RecentActivityCard activities={recentActivities} />
          </div>

          {/* CLASS ANALYTICS */}
          <div className="space-y-2 sm:space-y-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#9d8adb]">
              Class Analytics
            </h2>
            <ClassAnalyticsCard />
          </div>
        </div>
      </section>
    </div>
  );
}
