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
    flashcards: 0,
    mcqs: 0,
    fitb: 0,
  });
  const [percentages, setPercentages] = useState({
    studentsPercentage: 12.5,
    educatorsPercentage: 0,
    activeUsersPercentage: 8.3,
    flashcardsPercentage: 15.7,
    mcqsPercentage: -2.1,
    fitbPercentage: 10.5,
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
        
        // If your API returns percentages, use them
        if (data.percentages) {
          setPercentages(data.percentages);
        }
        
        setWeeklyData(data.weeklyQuizData || []);

        const today = new Date().toDateString();
        const todaysActivities = (data.recentActivities || []).filter(activity => {
          const activityDate = new Date(activity.createdAt).toDateString();
          return activityDate === today;
        });

        setRecentActivities(todaysActivities);
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
        <h2 className="text-xl sm:text-2xl font-semibold text-[#9d8adb]">Quick Stats</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          <StatCard 
            label="Total Students" 
            value={stats.totalStudents}
            percentage={percentages.studentsPercentage}
          />
          <StatCard 
            label="Total Educators" 
            value={stats.totalEducators}
            percentage={percentages.educatorsPercentage}
          />
          <StatCard 
            label="Active Users" 
            value={stats.activeUsers}
            percentage={percentages.activeUsersPercentage}
          />
        </div>
      </section>

      {/* PROGRESS SECTION - COMBINED */}
      <section className="space-y-3 sm:space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-[#9d8adb]">Learning Progress</h2>
        <ProgressCard 
          flashcards={stats.flashcards} 
          mcqs={stats.mcqs} 
          fitb={stats.fitb}
        />
        
        {/* Optional: Small percentage indicators if needed */}
        <div className="flex gap-4 text-sm text-gray-600">
          <span>Flashcards <span className={percentages.flashcardsPercentage > 0 ? 'text-green-500' : 'text-red-500'}>
            {percentages.flashcardsPercentage > 0 ? '+' : ''}{percentages.flashcardsPercentage}%
          </span></span>
          <span>MCQs <span className={percentages.mcqsPercentage > 0 ? 'text-green-500' : 'text-red-500'}>
            {percentages.mcqsPercentage > 0 ? '+' : ''}{percentages.mcqsPercentage}%
          </span></span>
          <span>FITB <span className={percentages.fitbPercentage > 0 ? 'text-green-500' : 'text-red-500'}>
            {percentages.fitbPercentage > 0 ? '+' : ''}{percentages.fitbPercentage}%
          </span></span>
        </div>
      </section>

      {/* ANALYTICS */}
      <section>
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_2fr] gap-6">
          {/* RECENT ACTIVITY */}
          <div className="space-y-2 sm:space-y-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#9d8adb]">Recent Activity</h2>
            <RecentActivityCard activities={recentActivities} />
          </div>

          {/* CLASS ANALYTICS */}
          <div className="space-y-2 sm:space-y-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#9d8adb]">Class Analytics</h2>
            <ClassAnalyticsCard weeklyData={weeklyData} />
          </div>
        </div>
      </section>
    </div>
  );
}