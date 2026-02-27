"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./Topbar";

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f4f3fb]">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 px-4 sm:px-10 py-6 pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
