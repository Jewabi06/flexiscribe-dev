"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: email, 2: code, 3: new password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleBack = () => {
    router.push("/auth/role-selection");
  };

  // Step 1: Send verification code to email
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send verification code");
        setIsLoading(false);
        return;
      }

      setSuccess("A verification code has been sent to your email. Please check your inbox.");
      setCountdown(60);
      setStep(2);
    } catch (error) {
      console.error("Forgot password error:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify code and move to new password step
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");

    if (!code || code.length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setStep(3);
  };

  // Step 3: Reset password with code
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password");
        setIsLoading(false);
        return;
      }

      setSuccess("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/auth/role-selection");
      }, 3000);
    } catch (error) {
      console.error("Reset password error:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Resend code
  const handleResendCode = async () => {
    if (countdown > 0) return;

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSuccess("A new verification code has been sent to your email.");
        setCountdown(60);
        setCode("");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to resend code");
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <button className="btn-back fixed top-4 right-4" onClick={handleBack}>
        <FiArrowLeft size={18} />
        Back
      </button>
      <div className="neu-card w-full max-w-md mx-auto justify-center">
        {/* Title */}
        <div className="flex flex-col items-center mb-6 mt-2">
          <span className="text-[#4c4172] font-extrabold text-4xl text-center mb-2">
            Forgot Password
          </span>
          <span className="text-center text-md mb-2">
            {step === 1 && "Enter your email to receive a verification code"}
            {step === 2 && "Enter the 6-digit code sent to your email"}
            {step === 3 && "Create your new password"}
          </span>
        </div>

        {/* Success message */}
        {success && <p className="success-msg mb-4 text-center">{success}</p>}

        {/* Error message */}
        {error && <p className="error-msg mb-4 text-center">{error}</p>}

        {/* Step 1: Email Input */}
        {step === 1 && (
          <form onSubmit={handleSendCode} className="space-y-8">
            <div>
              <label className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                type="email"
                className="neu-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                disabled={isLoading}
              />
            </div>
            <button type="submit" className="neu-btn" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Verification Code"}
            </button>
          </form>
        )}

        {/* Step 2: Verification Code */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Verification Code
              </label>
              <input
                type="text"
                className="neu-input"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(value);
                }}
                placeholder="000000"
                maxLength={6}
                style={{ textAlign: "center", fontSize: "24px", letterSpacing: "8px" }}
                disabled={isLoading}
              />
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={countdown > 0 || isLoading}
                className="text-sm font-semibold hover:underline disabled:opacity-50"
              >
                {countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="neu-btn"
                style={{ flex: 1, opacity: 0.7 }}
                onClick={() => { setStep(1); setError(""); setSuccess(""); }}
              >
                Back
              </button>
              <button
                type="submit"
                className="neu-btn"
                style={{ flex: 1 }}
                disabled={isLoading || code.length !== 6}
              >
                Verify Code
              </button>
            </div>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                New Password
              </label>
              <input
                type="password"
                className="neu-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                className="neu-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="neu-btn"
                style={{ flex: 1, opacity: 0.7 }}
                onClick={() => { setStep(2); setError(""); setSuccess(""); }}
              >
                Back
              </button>
              <button
                type="submit"
                className="neu-btn"
                style={{ flex: 1 }}
                disabled={isLoading}
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="mt-10 text-[#4c4172] text-center text-sm">
          Remember your password?{" "}
          <a href="/auth/role-selection" className="font-semibold text-[#4c4172] hover:underline">
            Back to Login
          </a>
        </p>
      </div>
    </div>
  );
}
