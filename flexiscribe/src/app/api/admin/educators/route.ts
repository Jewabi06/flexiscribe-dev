import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/educators — List all educators for dropdown selection
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const educators = await prisma.educator.findMany({
      include: { department: true },
      orderBy: { fullName: "asc" },
    });

    const transformed = educators.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      username: e.username,
      department: e.department.name,
      departmentId: e.departmentId,
    }));

    return NextResponse.json({ educators: transformed }, { status: 200 });
  } catch (error) {
    console.error("Get educators error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
