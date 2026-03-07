"use client";

import { useState, useEffect } from "react";
import StatCard from "@/components/admin/cards/StatCard";
import LoadingScreen from "@/components/shared/LoadingScreen";
import ProgressCard from "@/components/admin/cards/ProgressCard";
import RecentActivityCard from "@/components/admin/cards/RecentActivityCard";
import ClassAnalyticsCard from "@/components/admin/cards/ClassAnalyticsCard";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalEducators: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    totalUsers: 0,
    totalQuizzes: 0,
    flashcards: 0,
    mcqs: 0,
    fitb: 0,
  });
  const [percentages, setPercentages] = useState({
    studentsPercentage: 0,
    educatorsPercentage: 0,
    activeUsersPercentage: 0,
    flashcardsPercentage: 0,
    mcqsPercentage: 0,
    fitbPercentage: 0,
  });
  const [proportionChanges, setProportionChanges] = useState({
    studentsChange: 0,
    educatorsChange: 0,
    activeUsersChange: 0,
    flashcardsChange: 0,
    mcqsChange: 0,
    fitbChange: 0,
  });
  const [weeklyData, setWeeklyData] = useState([]);
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

        if (data.percentages) setPercentages(data.percentages);
        if (data.proportionChanges) setProportionChanges(data.proportionChanges);

        setWeeklyData(data.weeklyQuizData || []);

        const today = new Date().toDateString();
        const todaysActivities = (data.recentActivities || []).filter(
          (activity) => new Date(activity.createdAt).toDateString() === today
        );
        setRecentActivities(todaysActivities);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const formatShift = (value) => {
    if (value === 0) return null;
    const sign = value > 0 ? "+" : "";
    return `${sign}${value}%`;
  };

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
            percentage={percentages.studentsPercentage}
            percentageContext={`of ${stats.totalUsers} total users`}
            change={proportionChanges.studentsChange}
          />
          <StatCard
            label="Total Educators"
            value={stats.totalEducators}
            percentage={percentages.educatorsPercentage}
            percentageContext={`of ${stats.totalUsers} total users`}
            change={proportionChanges.educatorsChange}
          />
          <StatCard
            label="Active Users"
            value={stats.activeUsers}
            percentage={percentages.activeUsersPercentage}
            percentageContext={`of ${stats.activeUsers + stats.inactiveUsers} total`}
            change={proportionChanges.activeUsersChange}
          />
        </div>
      </section>

      {/* LEARNING PROGRESS */}
      <section className="space-y-3 sm:space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-[#9d8adb]">
          Learning Progress
        </h2>
        <ProgressCard
          flashcards={stats.flashcards}
          mcqs={stats.mcqs}
          fitb={stats.fitb}
        />

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm px-1">
          {[
            {
              label: "Flashcards",
              pct: percentages.flashcardsPercentage,
              shift: proportionChanges.flashcardsChange,
            },
            {
              label: "MCQs",
              pct: percentages.mcqsPercentage,
              shift: proportionChanges.mcqsChange,
            },
            {
              label: "FITB",
              pct: percentages.fitbPercentage,
              shift: proportionChanges.fitbChange,
            },
          ].map(({ label, pct, shift }) => (
            <div key={label} className="flex items-center">
              <span className="font-medium text-[#4c4172]">{label}</span>
              {shift !== 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    shift > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {shift > 0 ? "↑" : "↓"} {formatShift(shift)}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ANALYTICS */}
      <section>
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_2fr] gap-6">
          <div className="space-y-2 sm:space-y-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#9d8adb]">
              Recent Activity
            </h2>
            <RecentActivityCard activities={recentActivities} />
          </div>
          <div className="space-y-2 sm:space-y-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#9d8adb]">
              Class Analytics
            </h2>
            <ClassAnalyticsCard weeklyData={weeklyData} curveType="linear" />
          </div>
        </div>
      </section>
    </div>
  );
}