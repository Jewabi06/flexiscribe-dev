import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/users/export - Export users data
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all users with related data
    const users = await prisma.user.findMany({
      include: {
        student: true,
        educator: {
          include: {
            department: true,
          },
        },
        admin: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to CSV format
    const csvRows: string[] = [];
    
    // Header
    csvRows.push([
      "ID",
      "Email",
      "Phone Number",
      "Role",
      "Full Name",
      "Username",
      "Student Number",
      "Year Level",
      "Section",
      "Program",
      "Department",
      "Gender",
      "Birth Date",
      "Created At",
      "Status",
    ].join(","));

    // Data rows
    users.forEach((u) => {
      let fullName = "";
      let username = "";
      let studentNumber = "";
      let yearLevel = "";
      let section = "";
      let program = "";
      let department = "";
      let gender = "";
      let birthDate = "";

      if (u.student) {
        fullName = u.student.fullName;
        username = u.student.username || "";
        studentNumber = u.student.studentNumber;
        yearLevel = u.student.yearLevel;
        section = u.student.section;
        program = u.student.program;
        gender = u.student.gender;
        birthDate = u.student.birthDate.toISOString().split("T")[0];
      } else if (u.educator) {
        fullName = u.educator.fullName;
        username = u.educator.username;
        department = u.educator.department.name;
        gender = u.educator.gender;
        birthDate = u.educator.birthDate.toISOString().split("T")[0];
      } else if (u.admin) {
        fullName = u.admin.fullName;
        username = u.admin.username;
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const status = u.updatedAt >= sevenDaysAgo ? "Active" : "Inactive";

      csvRows.push([
        u.id,
        u.email,
        u.phoneNumber || "",
        u.role,
        `"${fullName}"`,
        username,
        studentNumber,
        yearLevel,
        section,
        program,
        department,
        gender,
        birthDate,
        u.createdAt.toISOString(),
        status,
      ].join(","));
    });

    const csvContent = csvRows.join("\n");

    // Log activity
    await prisma.activity.create({
      data: {
        action: "Users Exported",
        description: `Exported ${users.length} users to CSV`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "USERS_EXPORTED",
        details: `Exported ${users.length} users to CSV`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="users_export_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export users error:", error);
    return NextResponse.json(
      { error: "An error occurred while exporting users" },
      { status: 500 }
    );
  }
}
