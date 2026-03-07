import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import bcrypt from "bcrypt";

// GET /api/admin/users - Get all users with filters
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
    const role = searchParams.get("role");
    const status = searchParams.get("status");
    const dateFilter = searchParams.get("date");

    // Build where clause
    const where: any = {};
    
    // Only filter by role if it's not "All" and has a value
    if (role && role !== "All" && role !== "All Roles") {
      where.role = role.toUpperCase();
    }

    // Date filtering — values come in as day-count strings ("7", "30", "90")
    if (dateFilter && dateFilter !== "All" && dateFilter !== "All Dates") {
      const days = parseInt(dateFilter, 10);
      if (!isNaN(days)) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        where.createdAt = { gte: startDate };
      }
    }

    // Get users with related data
    const users = await prisma.user.findMany({
      where,
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

    // Transform data to a consistent format
    const transformedUsers = users.map((u) => {
      let fullName = "";
      let username = "";
      let additionalInfo = {};

      if (u.student) {
        fullName = u.student.fullName || "";
        username = u.student.username || "";
        additionalInfo = {
          studentNumber: u.student.studentNumber || "",
          yearLevel: u.student.yearLevel || "",
          section: u.student.section || "",
          program: u.student.program || "",
          gender: u.student.gender || "",
          birthDate: u.student.birthDate,
        };
      } else if (u.educator) {
        fullName = u.educator.fullName || "";
        username = u.educator.username || "";
        additionalInfo = {
          department: u.educator.department?.name || "",
          gender: u.educator.gender || "",
          birthDate: u.educator.birthDate,
        };
      } else if (u.admin) {
        fullName = u.admin.fullName || "";
        username = u.admin.username || "";
      }

      // Use status from user model or default to "Active"
      const userStatus = u.status || "Active";

      return {
        id: u.id,
        email: u.email || "",
        role: u.role || "",
        fullName,
        username,
        status: userStatus,
        isGhost: u.isGhost ?? false,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        ...additionalInfo,
      };
    });

    // Apply status filter after transformation (if needed)
    let filteredUsers = transformedUsers;
    if (status && status !== "All" && status !== "All Status") {
      filteredUsers = transformedUsers.filter((u) => u.status === status);
    }

    return NextResponse.json({ users: filteredUsers }, { status: 200 });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching users" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Create new user
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request);
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      email,
      password,
      role,
      fullName,
      username,
      isGhost,
      ...additionalData
    } = body;

    // Validate required fields
    if (!email || !password || !role || !fullName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      );
    }

    // Check if username exists for the specific role
    if (username) {
      if (role.toUpperCase() === "STUDENT") {
        const existingStudent = await prisma.student.findUnique({
          where: { username },
        });
        if (existingStudent) {
          return NextResponse.json(
            { error: "Username already exists" },
            { status: 400 }
          );
        }
      } else if (role.toUpperCase() === "EDUCATOR") {
        const existingEducator = await prisma.educator.findUnique({
          where: { username },
        });
        if (existingEducator) {
          return NextResponse.json(
            { error: "Username already exists" },
            { status: 400 }
          );
        }
      } else if (role.toUpperCase() === "ADMIN") {
        const existingAdmin = await prisma.admin.findUnique({
          where: { username },
        });
        if (existingAdmin) {
          return NextResponse.json(
            { error: "Username already exists" },
            { status: 400 }
          );
        }
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with role-specific data
    // isGhost is only valid for STUDENT accounts
    const ghostValue = role.toUpperCase() === "STUDENT" ? Boolean(isGhost) : false;

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role.toUpperCase(),
        status: "Active", // Set default status
        isGhost: ghostValue,
        ...(role.toUpperCase() === "STUDENT" && {
          student: {
            create: {
              fullName,
              username: username || email.split("@")[0],
              studentNumber: additionalData.studentNumber || "",
              yearLevel: additionalData.yearLevel || "",
              section: additionalData.section || "",
              program: additionalData.program || "",
              gender: additionalData.gender || "PREFER_NOT_TO_SAY",
              birthDate: additionalData.birthDate ? new Date(additionalData.birthDate) : new Date(),
            },
          },
        }),
        ...(role.toUpperCase() === "EDUCATOR" && {
          educator: {
            create: {
              fullName,
              username: username || email.split("@")[0],
              gender: additionalData.gender || "PREFER_NOT_TO_SAY",
              birthDate: additionalData.birthDate ? new Date(additionalData.birthDate) : new Date(),
              departmentId: additionalData.departmentId,
            },
          },
        }),
        ...(role.toUpperCase() === "ADMIN" && {
          admin: {
            create: {
              fullName,
              username: username || email.split("@")[0],
            },
          },
        }),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: "User Created",
        description: `Created new ${role} user: ${email}`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "USER_CREATED",
        details: `Created new ${role} user: ${email} (${fullName})`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    return NextResponse.json(
      { message: "User created successfully", userId: newUser.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "An error occurred while creating user" },
      { status: 500 }
    );
  }
}