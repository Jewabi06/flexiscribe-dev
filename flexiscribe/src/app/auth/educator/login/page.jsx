"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { FiArrowLeft } from "react-icons/fi";

export default function EducatorLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPrototypeMode, setIsPrototypeMode] = useState(false);

  useEffect(() => {
    const redirect = searchParams.get('redirect');
    setIsPrototypeMode(redirect === 'prototype');
  }, [searchParams]);

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
    if (isPrototypeMode) {
      router.push("/");
    } else {
      router.push("/auth/role-selection?role=educator");
    }
  };

  // Handle form submission
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          role: "EDUCATOR",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        setIsLoading(false);
        return;
      }

      setSuccess("Login successful ✅");
      setIsLoading(false);

      // Wait for browser to process Set-Cookie header before redirecting
      setTimeout(() => {
        if (isPrototypeMode) {
          window.location.href = "/prototype";
        } else {
          window.location.href = "/educator/dashboard";
        }
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
        <div className="flex flex-col items-center text-[#4c4172] mb-4 sm:mb-6 mt-1 sm:mt-2">
          <span className="font-extrabold text-2xl sm:text-3xl md:text-4xl text-center mb-2">
            {isPrototypeMode ? "Educator Login" : "Educator Log In"}
          </span>
          <span className="text-center text-xs sm:text-sm md:text-base mb-2">
            {isPrototypeMode ? "Sign in to access the recording prototype" : "Access your fLexiScribe educator portal"}
          </span>
        </div>
        {/* Success message */}
        {success && <p className="success-msg mb-3 sm:mb-4 text-center">{success}</p>}

        {/* Error message */}
        {error && <p className="error-msg mb-3 sm:mb-4 text-center">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 md:space-y-8">
          {/* Email */}
          <div>
            <label className="block text-sm text-[#4c4172] font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              className="neu-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="educator@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-[#4c4172] font-medium">Password</label>
              <a
                href="/auth/forgot-password"
                className="text-sm text-[#4c4172] font-semibold hover:underline"
              >
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
        <p className="mt-6 sm:mt-8 md:mt-10 text-center text-[#4c4172] text-xs sm:text-sm">
          No account?{" "}
          <a
            href="/auth/educator/register"
            className="text-[#4c4172] font-semibold hover:underline"
          >
            Create Account
          </a>
        </p>
      </div>
    </div>
  );
}
