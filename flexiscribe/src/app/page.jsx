import Link from "next/link";

export default async function Landing({ searchParams }) {
  const params = await searchParams;
  const role = params?.role?.toLowerCase();
  const roleParam = role === "student" || role === "educator" ? `?role=${role}` : "";

  const portalLabel =
    role === "student"
      ? "Student Portal"
      : role === "educator"
        ? "Educator Portal"
        : "Student & Educator Portal";

  return (
    <div className="container min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="neu-navbar">
        {/* Logo */}
        <div className="neu-navbar-logo">
          <img
            src="/img/fLexiScribe-logo.png"
            alt="Logo"
            className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 lg:h-15 lg:w-15"
          />
          <div className="flex flex-col items-start">
            <span className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold">
              fLexiScribe
            </span>
            <span className="text-[0.625rem] sm:text-[0.7rem] md:text-xs font-normal">
              Your Note-Taking Assistant
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="neu-navbar-actions">
          {role !== "student" && (
            <Link
              href="/auth/educator/login?redirect=prototype"
              className="btn-login text-center"
            >
              Prototype
            </Link>
          )}
          <Link
            href={`/auth/role-selection${roleParam}`}
            className="btn-login text-center"
          >
            {portalLabel}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center items-center text-center px-3 py-4 sm:px-5 sm:py-6 md:px-6 md:py-8">
        <div className="neumorphism w-full max-w-4xl">
          <h1 className="text-[#4c4172] text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mt-4 sm:mt-6 mb-4 sm:mb-6">
            From Speech to Study-Ready Notes
          </h1>
          <p className="text-[#4c4172] text-xs sm:text-sm md:text-base lg:text-lg mb-3 sm:mb-4 leading-relaxed">
            Redefining how students capture, organize, and review lectures.
            <br className="hidden md:inline" />
            {" "}With real-time speech-to-text transcription and an intelligent auto-reviewer generator,
            <br className="hidden md:inline" />
            {" "}fLexiScribe ensures no detail is missed and every concept is easier to revisit.
          </p>
          <p className="text-[#4c4172] font-bold text-sm sm:text-base md:text-lg lg:text-xl mb-6 sm:mb-8 md:mb-10 lg:mb-12">
            Listen better. Write less. Learn more.
          </p>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8 md:mb-10 lg:mb-14">
            <div className="flex flex-col items-center gap-2 sm:gap-3">
              <div className="bg-red-400 rounded-xl p-3 sm:p-4 shadow-lg">
                <span className="text-white text-2xl sm:text-3xl">📃</span>
              </div>
              <span className="text-[#4c4172] text-xs sm:text-sm md:text-md font-semibold">
                Get Auto-Generated PDF Reviewer
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 sm:gap-3">
              <div className="bg-yellow-200 rounded-xl p-3 sm:p-4 shadow-lg">
                <span className="text-2xl sm:text-3xl">💡</span>
              </div>
              <span className="text-[#4c4172] text-xs sm:text-sm md:text-md font-semibold">
                Generate Interactive Quiz
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 sm:gap-3">
              <div className="bg-cyan-200 rounded-xl p-3 sm:p-4 shadow-lg">
                <span className="text-2xl sm:text-3xl">🏆</span>
              </div>
              <span className="text-[#4c4172] text-xs sm:text-sm md:text-md font-semibold">
                Earn XP and Rank UP!
              </span>
            </div>
          </div>

          {/* Get Started Button */}
          <Link href={`/auth/role-selection${roleParam}`} className="btn-get-started">
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}
