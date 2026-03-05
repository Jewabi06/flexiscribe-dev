"use client";

import SidebarClient from "@/layouts/educator/SidebarClient";
import "./styles.css";

export default function EducatorLayout({ children }) {
  return (
    <div className="flex overflow-hidden border-radius-lg bg-white dark:bg-[#1a1625] transition-colors duration-300"
    style={{ height: 'calc(100vh - 44px)' }}>
      <SidebarClient />

      <main className="edu-main-content edu-scrollbar flex-1 overflow-y-auto transition-colors duration-300 md:ml-[350px]">
        {children}
      </main>
    </div>
  );
}
