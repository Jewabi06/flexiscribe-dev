import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container min-h-screen flex flex-col items-center justify-center text-center px-4">
      <div className="neumorphism w-full max-w-md p-8">
        <h1 className="text-[#4c4172] text-6xl font-bold mb-4">404</h1>
        <h2 className="text-[#4c4172] text-xl font-semibold mb-2">
          Page Not Found
        </h2>
        <p className="text-[#4c4172] opacity-75 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="neu-btn inline-block text-center"
        >
          Go Back Home
        </Link>
      </div>
    </div>
  );
}
