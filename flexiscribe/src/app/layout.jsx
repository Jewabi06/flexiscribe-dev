import "@/styles/globals.css";
import { Inter } from "next/font/google";
import Footer from "@/components/shared/Footer";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "fLexiScribe",
  description: "Struggling to keep up with lectures? fLexiScribe captures every word, generates smart reviewers, and creates interactive quizzes so you can focus on listening and learning.",
  icons: {
    icon: "/fLexiScribe-logo.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} flex flex-col min-h-screen`}
        suppressHydrationWarning
      >
        {children}
        <Footer />
      </body>
    </html>
  );
}
