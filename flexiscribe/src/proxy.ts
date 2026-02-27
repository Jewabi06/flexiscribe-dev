import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const { pathname } = request.nextUrl;

  console.log("Middleware - Path:", pathname, "Token exists:", !!token);

  // Public paths that don't require authentication
  const publicPaths = [
    "/auth/role-selection",
    "/auth/admin/login",
    "/auth/educator/login",
    "/auth/educator/register",
    "/auth/student/login",
    "/auth/student/register",
    "/auth/forgot-password",
  ];

  // Check if current path is public
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // If user is authenticated and trying to access login/auth pages, redirect to dashboard
  if (token && isPublicPath && pathname !== "/auth/forgot-password") {
    const user = await verifyToken(token);
    if (user) {
      // Redirect authenticated users to their dashboard
      if (user.role === "ADMIN") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      } else if (user.role === "EDUCATOR") {
        return NextResponse.redirect(new URL("/educator/dashboard", request.url));
      } else if (user.role === "STUDENT") {
        return NextResponse.redirect(new URL("/student/dashboard", request.url));
      }
    }
  }

  // Allow access to public paths, root, and admin landing page
  if (isPublicPath || pathname === "/" || pathname === "/admin") {
    return NextResponse.next();
  }

  // Verify token for protected routes
  if (!token) {
    console.log("No token found, redirecting to login");
    // Redirect to appropriate login page based on path
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/auth/admin/login", request.url));
    } else if (pathname.startsWith("/educator")) {
      return NextResponse.redirect(new URL("/auth/educator/login", request.url));
    } else if (pathname.startsWith("/student")) {
      return NextResponse.redirect(new URL("/auth/student/login", request.url));
    }
    return NextResponse.redirect(new URL("/auth/role-selection", request.url));
  }

  const user = await verifyToken(token);
  console.log("Token verification result:", user ? `Valid - Role: ${user.role}` : "Invalid");

  
  // Invalid token - clear cookie and redirect
  if (!user) {
    const response = NextResponse.redirect(
      new URL("/auth/role-selection", request.url)
    );
    response.cookies.delete("auth-token");
    return response;
  }

  // Role-based route protection - redirect to appropriate dashboard if accessing wrong portal
  if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
    if (user.role === "EDUCATOR") {
      return NextResponse.redirect(new URL("/educator/dashboard", request.url));
    } else if (user.role === "STUDENT") {
      return NextResponse.redirect(new URL("/student/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/auth/role-selection", request.url));
  }

  if (pathname.startsWith("/educator") && user.role !== "EDUCATOR") {
    if (user.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    } else if (user.role === "STUDENT") {
      return NextResponse.redirect(new URL("/student/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/auth/role-selection", request.url));
  }

  if (pathname.startsWith("/student") && user.role !== "STUDENT") {
    if (user.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    } else if (user.role === "EDUCATOR") {
      return NextResponse.redirect(new URL("/educator/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/auth/role-selection", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|js|css|mjs)$).*)",
  ],
};
