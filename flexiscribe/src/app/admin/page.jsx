"use client";
import { useRouter } from "next/navigation";
import "./styles.css";

export default function AdminLanding() {
  const router = useRouter();

  return (
    <div className="container min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="neu-navbar">
        {/* Logo */}
        <div className="neu-navbar-logo">
          <img src="/img/fLexiScribe-logo.png" alt="Logo" className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 lg:h-15 lg:w-15" />
          <div className="flex flex-col items-start">
            <span className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold">fLexiScribe</span>
            <span className="text-[0.625rem] sm:text-[0.7rem] md:text-xs font-normal">Your Note-Taking Assistant</span>
          </div>
        </div>

        {/* Actions */}
        <div className="neu-navbar-actions">
          <button
            className="btn-login text-xs sm:text-sm md:text-base text-center admin-portal-btn"
            onClick={() => router.push("/auth/admin/login")}
          >
            Admin Portal
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center items-center text-center px-3 py-4 sm:px-5 sm:py-6 md:px-8 md:py-10">
        <div className="neumorphism w-full max-w-5xl">
          {/* Title */}
          <h1 className="text-[#4c4172] text-2xl sm:text-3xl md:text-5xl lg:text-[3rem] font-bold mb-4 sm:mb-5 md:mb-6 leading-tight">
            Manage fLexiScribe with <span className="confidence-text">Confidence</span>
          </h1>

          {/* Subtitle */}
          <p className="text-[#4c4172] text-xs sm:text-sm md:text-base lg:text-[1.15rem] leading-relaxed mb-8 sm:mb-10 md:mb-14 opacity-95">
            Oversee users, ensure platform integrity, and maintain seamless operations.
            <br className="hidden sm:inline" />
            The fLexiScribe Admin Portal provides centralized tools for monitoring
            <br className="hidden md:inline" />
            {" "}activity, managing content, and optimizing system performance.
          </p>

          {/* Feature Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-12 mb-8 sm:mb-10 md:mb-14 w-full max-w-4xl mx-auto">
            {/* Row 1 */}
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <div className="admin-feature-icon purple-icon w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <span className="text-[#4c4172] text-xs sm:text-sm md:text-base font-semibold">Manage Users</span>
            </div>

            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <div className="admin-feature-icon green-icon w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <span className="text-[#4c4172] text-xs sm:text-sm md:text-base font-semibold">View Audit Trails</span>
            </div>

            {/* Row 2 */}
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <div className="admin-feature-icon blue-icon w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <span className="text-[#4c4172] text-xs sm:text-sm md:text-base font-semibold">Track User Behavior</span>
            </div>

            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <div className="admin-feature-icon yellow-icon w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
              </div>
              <span className="text-[#4c4172] text-xs sm:text-sm md:text-base font-semibold">Generate Data Reports</span>
            </div>
          </div>

          {/* Admin Login Button */}
          <button
            className="admin-login-btn w-full sm:w-auto"
            onClick={() => router.push("/auth/admin/login")}
          >
            Admin Login
          </button>
        </div>
      </main>
    </div>
  );
}