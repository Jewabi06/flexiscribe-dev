"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { FiArrowLeft } from "react-icons/fi"; 

export default function Login() {
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

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

  const handleBack = () => {
    router.push("/auth/role-selection?role=student");
  };

  // Handle form submission
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!studentNumber || !password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      // First, get the email associated with the student number
      const studentResponse = await fetch(`/api/students/${studentNumber}`);
      
      if (!studentResponse.ok) {
        setError("Invalid student number or password ❌");
        setIsLoading(false);
        return;
      }

      const studentData = await studentResponse.json();

      // Now attempt login with the email
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: studentData.email,
          password,
          role: "STUDENT",
        }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        setError("Invalid student number or password ❌");
        setIsLoading(false);
        return;
      }

      setSuccess("Login successful ✅");
      setIsLoading(false);
      
      // Wait for browser to process Set-Cookie header before redirecting
      setTimeout(() => {
        window.location.href = "/student/dashboard";
      }, 200);
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login. Please try again.");
      setIsLoading(false);
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
        <div className="flex flex-col items-center mb-4 sm:mb-6 mt-1 sm:mt-2">
          <span className="text-[#4c4172] font-extrabold text-2xl sm:text-3xl md:text-4xl text-center mb-2">Student Log In</span>
          <span className="text-[#4c4172] text-center text-xs sm:text-sm md:text-base mb-2">Access your fLexiScribe student portal</span>
        </div>
        {/* Success message */}
        {success && (
          <p className="success-msg mb-3 sm:mb-4 text-center">{success}</p>
        )}

        {/* Error message */}
        {error && (
          <p className="error-msg mb-3 sm:mb-4 text-center">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 md:space-y-8">
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

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[#4c4172] text-sm font-medium">
                Password
              </label>
              <a href="/auth/forgot-password" className="text-[#4c4172] text-sm font-semibold hover:underline">
                Forgot Password?
              </a>
            </div>
            {/* Password input */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="neu-input pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              {/* Eye toggle */}
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

          {/* Submit */}
          <button type="submit" className="neu-btn" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Log In"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-[#4c4172] mt-6 sm:mt-8 md:mt-10 text-center text-xs sm:text-sm">
          No account?{" "}
          <a href="/auth/student/register" className="text-[#4c4172] font-semibold hover:underline">
            Create Account
          </a>
        </p>
      </div>
    </div>
  );
}
