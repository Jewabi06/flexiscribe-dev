import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import bcrypt from "bcrypt";

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: userId } = await params;
    const body = await request.json();
    const {
      email,
      phoneNumber,
      fullName,
      username,
      password,
      ...additionalData
    } = body;

    // Get user
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        student: true,
        educator: true,
        admin: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Update user data
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Update role-specific data
    if (existingUser.student) {
      const studentUpdate: any = {};
      if (fullName !== undefined) studentUpdate.fullName = fullName;
      if (username !== undefined) studentUpdate.username = username;
      if (additionalData.yearLevel !== undefined)
        studentUpdate.yearLevel = additionalData.yearLevel;
      if (additionalData.section !== undefined)
        studentUpdate.section = additionalData.section;
      if (additionalData.program !== undefined)
        studentUpdate.program = additionalData.program;

      if (Object.keys(studentUpdate).length > 0) {
        await prisma.student.update({
          where: { id: existingUser.student.id },
          data: studentUpdate,
        });
      }
    } else if (existingUser.educator) {
      const educatorUpdate: any = {};
      if (fullName !== undefined) educatorUpdate.fullName = fullName;
      if (username !== undefined) educatorUpdate.username = username;

      if (Object.keys(educatorUpdate).length > 0) {
        await prisma.educator.update({
          where: { id: existingUser.educator.id },
          data: educatorUpdate,
        });
      }
    } else if (existingUser.admin) {
      const adminUpdate: any = {};
      if (fullName !== undefined) adminUpdate.fullName = fullName;
      if (username !== undefined) adminUpdate.username = username;

      if (Object.keys(adminUpdate).length > 0) {
        await prisma.admin.update({
          where: { id: existingUser.admin.id },
          data: adminUpdate,
        });
      }
    }

    // Log activity
    await prisma.activity.create({
      data: {
        action: "User Updated",
        description: `Updated user: ${email || existingUser.email}`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "USER_UPDATED",
        details: `Updated user: ${email || existingUser.email}`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    return NextResponse.json(
      { message: "User updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "An error occurred while updating user" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: userId } = await params;

    // Get user before deletion
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Delete user (cascade will delete related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: "User Deleted",
        description: `Deleted user: ${existingUser.email}`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "USER_DELETED",
        details: `Deleted user: ${existingUser.email} (${existingUser.role})`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    return NextResponse.json(
      { message: "User deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "An error occurred while deleting user" },
      { status: 500 }
    );
  }
}
