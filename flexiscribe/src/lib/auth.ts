import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const JWT_EXPIRES_IN = "7d"; // Token expires in 7 days

export interface JWTPayload {
  userId: string;
  email: string;
  role: "ADMIN" | "STUDENT" | "EDUCATOR";
}

// Generate a JWT token for authenticated users
export async function generateToken(payload: JWTPayload): Promise<string> {
  console.log("Generating token with secret length:", JWT_SECRET?.length);
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRES_IN)
    .setIssuedAt()
    .sign(JWT_SECRET_KEY);
  return token;
}

// Verify and decode a JWT token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    console.log("Token verified successfully:", payload);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as "ADMIN" | "STUDENT" | "EDUCATOR",
    };
  } catch (error) {
    console.error("Token verification failed:", error instanceof Error ? error.message : error);
    console.error("JWT_SECRET exists:", !!JWT_SECRET, "Length:", JWT_SECRET?.length);
    return null;
  }
}

// Set authentication cookie
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

// Get authentication token from cookies
export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token");
  return token?.value || null;
}

// Clear authentication cookie
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
}

// Get current authenticated user from token
export async function getCurrentUser(): Promise<JWTPayload | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return await verifyToken(token);
}

// Middleware to verify authentication
export async function requireAuth(request: NextRequest): Promise<NextResponse | JWTPayload> {
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  return user;
}

// Middleware to verify role-based authorization
export async function requireRole(request: NextRequest, allowedRoles: Array<"ADMIN" | "STUDENT" | "EDUCATOR">): Promise<NextResponse | JWTPayload> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult; // Auth failed, return error response
  }

  const user = authResult as JWTPayload;

  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { error: "Access denied. Insufficient permissions." },
      { status: 403 }
    );
  }

  return user;
}

// Verify authentication from request (for API routes)
export async function verifyAuth(request: Request): Promise<JWTPayload | null> {
  try {
    // Extract token from cookies
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const authCookie = cookies.find((c) => c.startsWith("auth-token="));
    
    if (!authCookie) return null;

    const token = authCookie.split("=")[1];
    if (!token) return null;

    return await verifyToken(token);
  } catch (error) {
    console.error("Auth verification error:", error);
    return null;
  }
}
