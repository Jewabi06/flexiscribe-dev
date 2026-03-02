import { NextResponse } from "next/server";
import { clearAuthCookie, getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

export async function POST() {
  try {
    // Get the current user before clearing the cookie so we can:
    // 1. Clear the DB token for non-admin users
    // 2. Return the role so the client can redirect properly
    const user = await getCurrentUser();
    const role = user?.role || null;

    // Clear DB token for student/educator (admin never stores tokens in DB)
    if (user && user.role !== "ADMIN") {
      try {
        await prisma.user.update({
          where: { id: user.userId },
          data: { token: null, tokenExpiry: null },
        });
      } catch (dbError) {
        console.error("Failed to clear DB token:", dbError);
        // Continue with logout even if DB update fails
      }
    }

    // Clear the authentication cookie
    await clearAuthCookie();

    return NextResponse.json(
      { message: "Logout successful", role },
      { status: 200 }
    );
  } catch (error) {
    console.error("Logout error:", error);

    // Even on error, try to clear the cookie
    try {
      await clearAuthCookie();
    } catch (_) {
      // best effort
    }

    return NextResponse.json(
      { error: "An error occurred during logout" },
      { status: 500 }
    );
  }
}
