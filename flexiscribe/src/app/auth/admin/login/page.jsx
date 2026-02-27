"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { FiArrowLeft } from "react-icons/fi";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Password Strength Checker
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { label: "", color: "" };
    if (pwd.length < 6) return { label: "Weak", color: "bg-red-400" };
    if (pwd.length < 10) return { label: "Medium", color: "bg-yellow-300" };
    return { label: "Strong", color: "bg-green-400" };
  };

  const strength = getPasswordStrength(password);

  const handleBack = () => {
    router.push("/admin");
  };

  // Handle form submission
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
      const response = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Login successful ✅");
        setError("");
        setIsLoading(false);
        
        // Wait for browser to process Set-Cookie header before redirecting
        setTimeout(() => {
          window.location.href = "/admin/dashboard";
        }, 200);
      } else {
        setError(data.error || "Invalid email or password ❌");
        setSuccess("");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An error occurred during login. Please try again.");
      setSuccess("");
    } finally {
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
          <span className="text-[#4c4172] font-extrabold text-2xl sm:text-3xl md:text-4xl text-center mb-2">
            Admin Portal
          </span>
          <span className="text-[#4c4172] text-center text-xs sm:text-sm md:text-base mb-2">Sign in to manage fLexiScribe</span>
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
          {/* Email Address */}
          <div>
            <label className="text-[#4c4172] block text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              className="neu-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@email.com"
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
                placeholder="••••••••••"
              />
              {/* Eye toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4c4172] hover:text-[#4c4172]/80"
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
                  <span className="text-[#4c4172]">{strength.label}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full">
                  <div
                    className={`h-2 rounded-full ${strength.color}`}
                    style={{
                      width:
                        strength.label === "Weak"
                          ? "33%"
                          : strength.label === "Medium"
                          ? "66%"
                          : "100%",
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button 
            type="submit" 
            className="neu-btn"
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
