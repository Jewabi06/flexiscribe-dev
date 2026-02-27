"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleBack = () => {
    router.push("/auth/role-selection");
  };

  // Send password reset email
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("Please enter your email address");
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
      // Call the forgot password API
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send reset email");
        setIsLoading(false);
        return;
      }

      setSuccess("Password reset link has been sent to your email. Please check your inbox.");
      setEmail("");
      
      // Redirect to login after showing success message
      setTimeout(() => {
        router.push("/auth/role-selection");
      }, 5000);
    } catch (error) {
      console.error("Forgot password error:", error);
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
          <span className="font-extrabold text-4xl text-center mb-2">
            Forgot Password
          </span>
          <span className="text-center text-md mb-2">
            Enter your email to receive a password reset link
          </span>
        </div>

        {/* Success message */}
        {success && <p className="success-msg mb-4 text-center">{success}</p>}

        {/* Error message */}
        {error && <p className="error-msg mb-4 text-center">{error}</p>}

        {/* Email Input Form */}
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
            {isLoading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-10 text-center text-sm">
          Remember your password?{" "}
          <a href="/auth/role-selection" className="font-semibold hover:underline">
            Back to Login
          </a>
        </p>
      </div>
    </div>
  );
}
