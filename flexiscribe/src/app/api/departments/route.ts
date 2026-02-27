// app/api/departments/route.ts
import prisma from "@/lib/db"; // <- your singleton
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      select: { id: true, name: true },
    });
    return NextResponse.json(departments);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}
