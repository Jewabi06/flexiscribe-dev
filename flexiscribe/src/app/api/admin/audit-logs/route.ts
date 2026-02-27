import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/audit-logs - Get audit logs
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.auditLog.count();

    return NextResponse.json(
      {
        auditLogs,
        total,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get audit logs error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching audit logs" },
      { status: 500 }
    );
  }
}
