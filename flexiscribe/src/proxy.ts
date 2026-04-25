import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

// Secret key required to reach the admin login/landing pages.
// Change this value or move it to an env var (ADMIN_ACCESS_KEY) for production.
const ADMIN_ACCESS_KEY =
  process.env.ADMIN_ACCESS_KEY || "fls-ctrl-1p2s7";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const { pathname, searchParams } = request.nextUrl;

  console.log("Middleware - Path:", pathname, "Token exists:", !!token);

  // ── 1. Authenticated user at root → redirect to their dashboard ──────────
  if (pathname === "/" && token) {
    const user = await verifyToken(token);
    if (user) {
      if (user.role === "ADMIN") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      } else if (user.role === "EDUCATOR") {
        return NextResponse.redirect(new URL("/educator/dashboard", request.url));
      } else if (user.role === "STUDENT") {
        return NextResponse.redirect(new URL("/student/dashboard", request.url));
      }
    }
  }

  // Public paths that don't require authentication
  const publicPaths = [
    "/auth/role-selection",
    "/auth/educator/login",
    "/auth/educator/register",
    "/auth/student/login",
    "/auth/student/register",
    "/auth/forgot-password",
  ];

  // Check if current path is public
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // ── 2. Admin gate – require secret access key for unauthenticated visits ─
  const isAdminAuthPage = pathname.startsWith("/auth/admin");
  const isAdminLanding = pathname === "/admin";

  if (isAdminAuthPage || isAdminLanding) {
    // Authenticated admins can always pass through
    if (token) {
      const user = await verifyToken(token);
      if (user && user.role === "ADMIN") {
        // Admin accessing login/landing while authenticated → go to dashboard
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
    }

    // Check for valid access: either query param or cookie from prior verification
    const accessKey = searchParams.get("access");
    const hasAccessCookie = request.cookies.get("admin-access")?.value === "1";

    if (accessKey === ADMIN_ACCESS_KEY) {
      // Correct key supplied → set a short-lived cookie so subsequent admin pages
      // (like /auth/admin/login) work without the key in the URL.
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete("access");
      const response = NextResponse.rewrite(cleanUrl);
      response.cookies.set("admin-access", "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 30, // 30 minutes
        path: "/",
      });
      return response;
    }

    if (hasAccessCookie) {
      // User previously verified with the access key — allow through
      return NextResponse.next();
    }

    // No key and no cookie → looks like the page doesn't exist
    return NextResponse.redirect(new URL("/", request.url));
  }

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

  // ── Validate /?role= param on the landing page ────────────────────────────
  if (pathname === "/") {
    const roleParam = searchParams.get("role");
    if (roleParam && roleParam !== "student" && roleParam !== "educator") {
      // Invalid role → 404
      return NextResponse.rewrite(new URL("/not-found", request.url));
    }
    return NextResponse.next();
  }

  // Allow access to public paths
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Verify token for protected routes
  if (!token) {
    console.log("No token found, redirecting to login");
    // Redirect to appropriate login page based on path
    if (pathname.startsWith("/admin")) {
      // Don't reveal admin login exists — send to landing
      return NextResponse.redirect(new URL("/", request.url));
    } else if (pathname.startsWith("/educator")) {
      return NextResponse.redirect(new URL("/auth/educator/login", request.url));
    } else if (pathname.startsWith("/student")) {
      return NextResponse.redirect(new URL("/auth/student/login", request.url));
    }
    return NextResponse.redirect(new URL("/auth/role-selection", request.url));
  }

  const user = await verifyToken(token);
  console.log("Token verification result:", user ? `Valid - Role: ${user.role}` : "Invalid");

  
  // Invalid token - clear cookie and redirect to role-appropriate login
  if (!user) {
    let redirectUrl = "/auth/role-selection";
    if (pathname.startsWith("/admin")) {
      redirectUrl = "/";
    } else if (pathname.startsWith("/educator")) {
      redirectUrl = "/auth/educator/login";
    } else if (pathname.startsWith("/student")) {
      redirectUrl = "/auth/student/login";
    }
    const response = NextResponse.redirect(
      new URL(redirectUrl, request.url)
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
