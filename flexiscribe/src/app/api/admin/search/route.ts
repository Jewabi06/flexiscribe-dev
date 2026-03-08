import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/search?q=<query> — Search users, classes, transcripts, activities
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
          { student: { studentNumber: { contains, mode: "insensitive" } } },
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
      take: 8,
    });

    const userResults = users.map((u) => {
      const name =
        u.student?.fullName ||
        u.educator?.fullName ||
        u.admin?.fullName ||
        u.email;
      const role = u.role;
      const ghostSuffix = u.isGhost ? " 👻" : "";
      const detail = u.student
        ? `${role} • ${u.student.studentNumber} • ${u.email}${ghostSuffix}`
        : `${role} • ${u.email}`;
      return {
        id: u.id,
        type: "user" as const,
        title: `${name}${ghostSuffix}`,
        subtitle: detail,
        href: "/admin/manage-accounts",
        isGhost: u.isGhost,
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
          { day: { contains, mode: "insensitive" } },
          { educator: { fullName: { contains, mode: "insensitive" } } },
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
      subtitle: `${c.classCode} • ${c.educator.fullName} • ${c.day} • Room ${c.room}`,
      href: "/admin/manage-classes",
    }));

    // Search transcriptions
    const transcriptions = await prisma.transcription.findMany({
      where: {
        OR: [
          { title: { contains, mode: "insensitive" } },
          { course: { contains, mode: "insensitive" } },
          { educator: { fullName: { contains, mode: "insensitive" } } },
        ],
      },
      include: {
        educator: { select: { fullName: true } },
        class: { select: { subject: true, section: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const transcriptResults = transcriptions.map((t) => ({
      id: t.id,
      type: "transcript" as const,
      title: t.title,
      subtitle: `${t.educator.fullName} • ${t.course}${t.class ? ` • ${t.class.subject} ${t.class.section}` : ""} • ${t.status}`,
      href: "/admin/manage-classes",
    }));

    // Search audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { contains, mode: "insensitive" } },
          { details: { contains, mode: "insensitive" } },
          { userName: { contains, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const auditResults = auditLogs.map((a) => ({
      id: a.id,
      type: "activity" as const,
      title: a.action,
      subtitle: `${a.userName} • ${a.userRole}${a.details ? " • " + a.details : ""}`,
      href: "/admin/audit-logs",
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

    // Search departments
    const departments = await prisma.department.findMany({
      where: {
        name: { contains, mode: "insensitive" },
      },
      include: {
        _count: { select: { educators: true } },
      },
      take: 3,
    });

    const departmentResults = departments.map((d) => ({
      id: d.id,
      type: "department" as const,
      title: d.name,
      subtitle: `Department • ${d._count.educators} educator(s)`,
      href: "/admin/manage-accounts",
    }));

    return NextResponse.json(
      {
        results: [
          ...userResults,
          ...classResults,
          ...transcriptResults,
          ...auditResults,
          ...activityResults,
          ...departmentResults,
        ],
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
