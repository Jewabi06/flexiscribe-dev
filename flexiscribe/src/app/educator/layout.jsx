"use client";

import SidebarClient from "@/layouts/educator/SidebarClient";
import Footer from "@/components/shared/Footer";
import "./styles.css";

export default function EducatorLayout({ children }) {
  return (
    <div className="edu-layout-wrapper flex h-screen overflow-hidden bg-white dark:bg-[#1a1625] transition-colors duration-300 md:ml-[350px]">
      {/* Sidebar — z-50 so it always sits above the footer */}
      <div className="relative z-50 shrink-0">
        <SidebarClient />
      </div>

      {/* Main scrollable area — footer lives inside so you only see it at the bottom of the content */}
      <main className="edu-main-content edu-scrollbar flex-1 overflow-y-auto transition-colors duration-300">
        <div className="min-h-full flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <Footer />
        </div>
      </main>
    </div>
  );
}
