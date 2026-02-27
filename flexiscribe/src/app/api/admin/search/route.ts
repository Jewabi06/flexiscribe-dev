import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/search?q=<query> — Search users, classes, activities
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const contains = q;

    // Search users (students, educators, admins)
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains, mode: "insensitive" } },
          { student: { fullName: { contains, mode: "insensitive" } } },
          { student: { username: { contains, mode: "insensitive" } } },
          { educator: { fullName: { contains, mode: "insensitive" } } },
          { educator: { username: { contains, mode: "insensitive" } } },
          { admin: { fullName: { contains, mode: "insensitive" } } },
          { admin: { username: { contains, mode: "insensitive" } } },
        ],
      },
      include: {
        student: true,
        educator: true,
        admin: true,
      },
      take: 5,
    });

    const userResults = users.map((u) => {
      const name =
        u.student?.fullName ||
        u.educator?.fullName ||
        u.admin?.fullName ||
        u.email;
      return {
        id: u.id,
        type: "user" as const,
        title: name,
        subtitle: `${u.role} • ${u.email}`,
        href: "/admin/manage-accounts",
      };
    });

    // Search classes
    const classes = await prisma.class.findMany({
      where: {
        OR: [
          { subject: { contains, mode: "insensitive" } },
          { section: { contains, mode: "insensitive" } },
          { classCode: { contains, mode: "insensitive" } },
          { room: { contains, mode: "insensitive" } },
        ],
      },
      include: {
        educator: { select: { fullName: true } },
      },
      take: 5,
    });

    const classResults = classes.map((c) => ({
      id: c.id,
      type: "class" as const,
      title: `${c.subject} - ${c.section}`,
      subtitle: `${c.classCode} • ${c.educator.fullName} • Room ${c.room}`,
      href: "/admin/manage-classes",
    }));

    // Search activities
    const activities = await prisma.activity.findMany({
      where: {
        OR: [
          { action: { contains, mode: "insensitive" } },
          { description: { contains, mode: "insensitive" } },
          { userName: { contains, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const activityResults = activities.map((a) => ({
      id: a.id,
      type: "activity" as const,
      title: a.action,
      subtitle: `${a.userName} • ${a.description || ""}`,
      href: "/admin/audit-logs",
    }));

    return NextResponse.json(
      {
        results: [...userResults, ...classResults, ...activityResults],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin search error:", error);
    return NextResponse.json(
      { error: "An error occurred during search" },
      { status: 500 }
    );
  }
}
