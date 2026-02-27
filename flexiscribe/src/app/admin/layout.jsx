"use client";

import { usePathname } from "next/navigation";
import AdminLayout from "@/layouts/admin/AdminLayout";

export default function AdminRootLayout({ children }) {
  const pathname = usePathname();

  // Landing page should not have the admin layout (sidebar/topbar)
  if (pathname === "/admin") {
    return <>{children}</>;
  }

  return <AdminLayout>{children}</AdminLayout>;
}
