"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: email + new password, 2: submitted
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleBack = () => {
    router.push("/auth/role-selection");
  };

  // Submit password reset request to admin
  const handleSubmitRequest = async (e) => {
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
      const response = await fetch("/api/auth/password-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword, reason }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit request");
        setIsLoading(false);
        return;
      }

      setSuccess(data.message);
      setStep(2);
    } catch (err) {
      console.error("Password request error:", err);
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
          <span className="text-[#4c4172] text-center text-md mb-2">
            {step === 1 && "Submit a password reset request for admin approval"}
            {step === 2 && "Your request has been submitted"}
          </span>
        </div>

        {/* Success message */}
        {success && <p className="success-msg mb-4 text-center">{success}</p>}

        {/* Error message */}
        {error && <p className="error-msg mb-4 text-center">{error}</p>}

        {/* Step 1: Email + New Password */}
        {step === 1 && (
          <form onSubmit={handleSubmitRequest} className="text-[#4c4172] space-y-6">
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
                autoComplete="new-password"
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
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Reason (optional)
              </label>
              <textarea
                className="neu-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., I forgot my password"
                disabled={isLoading}
                rows={2}
                style={{ resize: "vertical" }}
              />
            </div>
            <button type="submit" className="neu-btn" disabled={isLoading}>
              {isLoading ? "Submitting..." : "Submit Reset Request"}
            </button>
          </form>
        )}

        {/* Step 2: Request Submitted */}
        {step === 2 && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center mb-4">
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>
            <p className="text-md">
              Your password reset request has been sent to the admin for review. 
              You will be notified once it has been processed.
            </p>
            <p className="text-sm" style={{ color: "#888" }}>
              This may take some time. Please check back later or contact your admin directly.
            </p>
            <button
              className="neu-btn"
              onClick={() => router.push("/auth/role-selection")}
            >
              Back to Login
            </button>
          </div>
        )}

        {/* Footer */}
        {step === 1 && (
          <p className="mt-10 text-[#4c4172] text-center text-sm">
            Remember your password?{" "}
            <a href="/auth/role-selection" className="font-semibold text-[#4c4172] hover:underline">
              Back to Login
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
