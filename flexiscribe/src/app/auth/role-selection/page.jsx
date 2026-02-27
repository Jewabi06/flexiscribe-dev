"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { AcademicCapIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { Suspense } from "react";

function RoleSelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read the ?role= query param to restrict which cards to show
  const restrictedRole = searchParams.get("role")?.toLowerCase(); // "student" | "educator" | null
  const roleParam = restrictedRole === "student" || restrictedRole === "educator" ? `?role=${restrictedRole}` : "";

  const showStudent = !restrictedRole || restrictedRole === "student";
  const showEducator = !restrictedRole || restrictedRole === "educator";

  const handleBack = () => {
    router.push(`/${roleParam}`);
  };

  return (
    <div className="container">
      <button className="btn-back fixed top-4 right-4 z-50" onClick={handleBack}>
        <FiArrowLeft size={18} />
        Back
      </button>
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-12">
        {/* Title */}
        <div className="flex flex-col items-center mb-6 sm:mb-8 lg:mb-12">
          <span className="font-extrabold text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-center mb-2">
            Welcome to fLexiScribe
          </span>
          <span className="text-center text-sm sm:text-base md:text-xl">
            {restrictedRole
              ? `Log in or sign up as ${restrictedRole === "student" ? "a Student" : "an Educator"}`
              : "Choose your role to continue"}
          </span>
        </div>

        {/* Role Cards */}
        <div className={`grid grid-cols-1 ${showStudent && showEducator ? "md:grid-cols-2" : ""} gap-6 md:gap-8`}>
          {/* Student Card */}
          {showStudent && (
            <div className="neu-card hover:scale-105 transition-transform duration-200">
              <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
                <div className="bg-accent-primary rounded-full p-4 sm:p-5 md:p-6">
                  <AcademicCapIcon className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 text-[#4c4172]" />
                </div>
                <h2 className="text-2xl sm:text-3xl text-[#4c4172] font-bold">Student</h2>
                <p className="text-sm sm:text-base md:text-lg text-[#4c4172] opacity-90">
                  Access your lectures, notes, quizzes and track your learning progress
                </p>
                <div className="flex flex-col gap-2 sm:gap-3 w-full pt-3 sm:pt-4">
                  <button
                    onClick={() => router.push("/auth/student/login")}
                    className="neu-btn"
                  >
                    Log In as Student
                  </button>
                  <button
                    onClick={() => router.push("/auth/student/register")}
                    className="neu-btn bg-brand-secondary hover:bg-accent-primary"
                  >
                    Sign Up as Student
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Educator Card */}
          {showEducator && (
            <div className="neu-card hover:scale-105 transition-transform duration-200">
              <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
                <div className="bg-accent-primary rounded-full p-4 sm:p-5 md:p-6">
                  <UserGroupIcon className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 text-[#4c4172]" />
                </div>
                <h2 className="text-2xl sm:text-3xl text-[#4c4172] font-bold">Educator</h2>
                <p className="text-sm sm:text-base md:text-lg text-[#4c4172] opacity-90">
                  Create courses, manage content and monitor student performance
                </p>
                <div className="flex flex-col gap-2 sm:gap-3 w-full pt-3 sm:pt-4">
                  <button
                    onClick={() => router.push("/auth/educator/login")}
                    className="neu-btn"
                  >
                    Log In as Educator
                  </button>
                  <button
                    onClick={() => router.push("/auth/educator/register")}
                    className="neu-btn bg-brand-secondary hover:bg-accent-primary"
                  >
                    Sign Up as Educator
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RoleSelection() {
  return (
    <Suspense fallback={<div className="container"><p>Loading...</p></div>}>
      <RoleSelectionContent />
    </Suspense>
  );
}
