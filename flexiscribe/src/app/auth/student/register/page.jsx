"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { FiArrowLeft } from "react-icons/fi";

export default function StudentRegister() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: personal details, 2: account details

  // Step 1: Personal Details
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");
  const [program, setProgram] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");

  // Step 2: Account Details
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleBack = () => {
    if (step === 1) {
      router.push("/auth/role-selection?role=student");
    } else {
      setStep(step - 1);
      setError("");
      setSuccess("");
    }
  };

  // Password Strength Checker - based on complexity, not just length
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { label: "", color: "", width: "0%" };
    
    let score = 0;
    
    // Length check
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    
    // Character variety checks
    if (/[a-z]/.test(pwd)) score++; // lowercase
    if (/[A-Z]/.test(pwd)) score++; // uppercase
    if (/[0-9]/.test(pwd)) score++; // numbers
    if (/[^a-zA-Z0-9]/.test(pwd)) score++; // special characters
    
    // Determine strength based on score
    if (score <= 2) return { label: "Weak", color: "bg-red-400", width: "33%" };
    if (score <= 4) return { label: "Medium", color: "bg-yellow-300", width: "66%" };
    return { label: "Strong", color: "bg-green-400", width: "100%" };
  };

  const strength = getPasswordStrength(password);

  // Step 1 Validation and Submit
  const handleStep1Submit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName || !studentNumber || !yearLevel || !section || !program || !dateOfBirth || !gender) {
      setError("Please fill in all fields");
      return;
    }

    // Validate student number format
    if (studentNumber.length < 7) {
      setError("Please enter a valid student number");
      return;
    }

    setSuccess("Personal details saved!");
    setTimeout(() => {
      setStep(2);
      setSuccess("");
    }, 800);
  };

  // Step 2 Validation and Submit
  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Validate password
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          studentNumber,
          username,
          yearLevel,
          section,
          program,
          dateOfBirth,
          gender,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      setSuccess("Account created successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/auth/student/login");
      }, 2000);
    } catch (err) {
      console.error("Registration error:", err);
      setError("An error occurred during registration. Please try again.");
    }
  };

  return (
    <div className="container">
      <button className="btn-back fixed top-4 right-4 z-50" onClick={handleBack}>
        <FiArrowLeft size={18} />
        Back
      </button>
      <div className="neu-card w-full max-w-md mx-3 sm:mx-auto">
        {/* Title */}
        <div className="flex flex-col items-center mb-3 sm:mb-4 mt-1 sm:mt-2">
          <span className="text-[#4c4172] font-extrabold text-2xl sm:text-3xl md:text-4xl text-center mb-2">
            Student Registration
          </span>
          <span className="text-[#4c4172] text-center text-xs sm:text-sm md:text-base mb-2">
            {step === 1 && "Step 1 of 2: Personal Details"}
            {step === 2 && "Step 2 of 2: Account Details"}
          </span>
        </div>

        {/* Success message */}
        {success && <p className="success-msg mb-3 sm:mb-4 text-center">{success}</p>}

        {/* Error message */}
        {error && <p className="error-msg mb-3 sm:mb-4 text-center">{error}</p>}

        {/* Step 1: Personal Details */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-4 sm:space-y-6">
            {/* Full Name */}
            <div>
              <label className="text-[#4c4172] block text-sm font-medium mb-2">
                Full Name
              </label>
              <input
                type="text"
                className="neu-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Dela Cruz"
              />
            </div>

            {/* Student Number */}
            <div>
              <label className="text-[#4c4172] block text-sm font-medium mb-2">
                Student Number
              </label>
              <input
                type="text"
                className="neu-input"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="220XXXX"
              />
            </div>

            {/* Year Level & Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[#4c4172] block text-sm font-medium mb-2">
                  Year Level
                </label>
                <select
                  className="neu-input"
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                  <option value="5">5th Year</option>
                </select>
              </div>
              <div>
                <label className="text-[#4c4172] block text-sm font-medium mb-2">
                  Section
                </label>
                <input
                  type="text"
                  className="neu-input"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="A"
                />
              </div>
            </div>

            {/* Program */}
            <div>
              <label className="text-[#4c4172] block text-sm font-medium mb-2">
                Program
              </label>
              <select
                className="neu-input"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              >
                <option value="">Select Program</option>
                <option value="BSCS">BS Computer Science</option>
                <option value="BSIT">BS Information Technology</option>
                <option value="BSCPE">BS Computer Engineering</option>
                <option value="BSIE">BS Industrial Engineering</option>
                <option value="BSECE">BS Electrical Engineering</option>
              </select>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="text-[#4c4172] block text-sm font-medium mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                className="neu-input"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            {/* Gender */}
            <div>
              <label className="text-[#4c4172] block text-sm font-medium mb-2">
                Gender
              </label>
              <select
                className="neu-input"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Prefer not to say</option>
              </select>
            </div>

            {/* Next Button */}
            <button type="submit" className="neu-btn">
              Next
            </button>
          </form>
        )}

        {/* Step 2: Account Details */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-4 sm:space-y-6">
            {/* Username */}
            <div>
              <label className="text-[#4c4172] block text-sm font-medium mb-2">
                Username
              </label>
              <input
                type="text"
                className="neu-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="juandelacruz"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-[#4c4172] block text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                type="email"
                className="neu-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-[#4c4172] block text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="neu-input pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeIcon className="h-5 w-5" />
                  ) : (
                    <EyeSlashIcon className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Password strength */}
              {strength.label && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{strength.label}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div
                      className={`h-2 rounded-full ${strength.color}`}
                      style={{
                        width: strength.width,
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-[#4c4172] block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="neu-input pr-12"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <EyeIcon className="h-5 w-5" />
                  ) : (
                    <EyeSlashIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button type="submit" className="neu-btn">
              Create Account
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="text-[#4c4172] mt-4 sm:mt-6 text-center text-xs sm:text-sm">
          Already have an account?{" "}
          <a href="/auth/student/login" className="text-[#4c4172] font-semibold hover:underline">
            Log In
          </a>
        </p>
      </div>
    </div>
  );
}
