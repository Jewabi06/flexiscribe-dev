# Authentication & Security Implementation

## Overview

This implementation provides comprehensive authentication and authorization with role-based access control, secure session management, and email-based password reset functionality.

## Features

### ✅ Implemented

1. **JWT-Based Authentication**
   - Secure HTTP-only cookies
   - 7-day token expiration
   - Automatic token refresh

2. **Role-Based Access Control (RBAC)**
   - Three roles: ADMIN, EDUCATOR, STUDENT
   - Server-side middleware protection
   - Client-side route guards
   - API endpoint authorization

3. **Password Security**
   - Bcrypt hashing (10 salt rounds)
   - Minimum 6 character requirement
   - Secure password reset flow

4. **Email Integration**
   - Password reset emails
   - Welcome emails (optional)
   - Professional HTML templates

5. **Session Management**
   - Persistent login across browser sessions
   - Automatic logout on token expiration
   - Secure logout functionality

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required Variables:**

```env
# Database
DATABASE_URL="postgresql://..."

# JWT Secret (IMPORTANT: Use a strong random value in production)
JWT_SECRET="generate-with-openssl-rand-base64-32"

# Email (Resend)
RESEND_API_KEY="re_xxxxxxxxxxxx"
EMAIL_FROM="noreply@yourdomain.com"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 2. Generate JWT Secret

```bash
# On macOS/Linux
openssl rand -base64 32

# On Windows PowerShell
[Convert]::ToBase64String((1..32|%{[byte](Get-Random -Max 256)}))
```

### 3. Set Up Resend

1. Sign up at [https://resend.com](https://resend.com)
2. Verify your domain or use their test domain
3. Generate an API key from [https://resend.com/api-keys](https://resend.com/api-keys)
4. Add to `.env` file

### 4. Run Database Migration

```bash
npx prisma migrate dev --name add-password-reset
npx prisma generate
```

### 5. Install Dependencies

```bash
npm install
```

## Architecture

### Server-Side Protection

#### Middleware (`middleware.ts`)
- Intercepts all route requests
- Validates JWT tokens
- Redirects unauthorized users
- Role-based route protection

#### Auth Utilities (`lib/auth.ts`)
```typescript
// Generate token
generateToken({ userId, email, role })

// Verify token
verifyToken(token)

// Require authentication
requireAuth(request)

// Require specific role
requireRole(request, ["ADMIN"])
```

### API Routes

#### Login Endpoints
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/login` - Student/Educator login

#### Session Management
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

#### Password Reset
- `POST /api/auth/forgot-password` - Request reset
- `POST /api/auth/reset-password` - Reset with token

### Client-Side Protection

#### Auth Context (`components/auth/AuthProvider.tsx`)
```typescript
const { user, login, logout, isAuthenticated } = useAuth();
```

Wrap your app in the root layout:

```tsx
import { AuthProvider } from "@/components/auth/AuthProvider";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

## Usage Examples

### Protected API Route

```typescript
import { requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Only admins and educators can access
  const authResult = requireRole(request, ["ADMIN", "EDUCATOR"]);
  
  if (authResult instanceof NextResponse) {
    return authResult; // Returns 401/403 error
  }

  const user = authResult; // Get authenticated user
  // Your logic here...
}
```

### Protected Page

```tsx
"use client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/role-selection");
    }
  }, [user, loading, router]);

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return <div>Protected Content</div>;
}
```

### Login Implementation

```tsx
"use client";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password, "STUDENT"); // or "EDUCATOR", "ADMIN"
      // Automatically redirects based on role
    } catch (error) {
      console.error(error.message);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Password Reset Flow

1. **Request Reset:**
```typescript
const response = await fetch("/api/auth/forgot-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});
```

2. **User receives email with reset link**

3. **Reset Password:**
```typescript
const response = await fetch("/api/auth/reset-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token, password }),
});
```

## Security Best Practices

### ✅ Already Implemented

1. **HTTP-Only Cookies** - Prevents XSS attacks
2. **Bcrypt Hashing** - Secure password storage
3. **JWT Expiration** - Limited token lifetime
4. **Role-Based Access** - Principle of least privilege
5. **Secure Password Reset** - Time-limited tokens
6. **Generic Error Messages** - Prevents user enumeration
7. **Email Validation** - Ensures legitimate email addresses

### 🔒 Production Recommendations

1. **HTTPS Only** - Enable `secure: true` for cookies
2. **Rate Limiting** - Prevent brute force attacks
3. **CSRF Protection** - Add CSRF tokens for forms
4. **Input Sanitization** - Validate all user inputs
5. **Audit Logging** - Track authentication events
6. **2FA** - Two-factor authentication for admins
7. **Password Complexity** - Enforce stronger passwords
8. **Account Lockout** - Lock after failed attempts

## Troubleshooting

### Token Issues

**Problem:** User logged in but redirected to login
**Solution:** Check JWT_SECRET is set and consistent

**Problem:** Token expires too quickly
**Solution:** Adjust `JWT_EXPIRES_IN` in `lib/auth.ts`

### Email Issues

**Problem:** Password reset emails not sending
**Solution:** 
1. Verify RESEND_API_KEY is correct
2. Check EMAIL_FROM is verified in Resend
3. Check server logs for errors

### Route Protection Issues

**Problem:** Middleware not protecting routes
**Solution:** Check `middleware.ts` matcher configuration

**Problem:** Wrong role can access routes
**Solution:** Verify role checks in middleware and API routes

## Testing

### Test Admin Login
```bash
# Email: skyadmin@example.com
# Password: skyadminacc0123
```

### Test Password Reset
1. Go to `/auth/forgot-password`
2. Enter email address
3. Check email for reset link
4. Click link and set new password

## Migration Notes

### From Old System

The hardcoded credentials (`skyadmin@example.com`) are now stored securely in the database with hashed passwords. Users will be automatically redirected based on their role after login, preventing the issue where "logging in as admin then returning shows student portal."

### Database Changes

New fields added to `User` model:
- `resetToken` - Password reset token
- `resetTokenExpiry` - Token expiration time

Run migration:
```bash
npx prisma migrate dev
```

## Support

For issues or questions:
1. Check server logs for detailed errors
2. Verify environment variables are set correctly
3. Ensure database is accessible
4. Check Resend dashboard for email delivery status
