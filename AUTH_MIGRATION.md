# Migration Guide: Custom Auth → NextAuth.js v5

## Summary

Successfully migrated from a custom self-rolled authentication system to NextAuth.js v5 (Auth.js) for better security, maintainability, and industry-standard practices.

## What Changed

### 1. Dependencies
**Added:**
- `next-auth@beta` (NextAuth.js v5)
- `@auth/prisma-adapter` (optional, for database sessions if needed later)

**Removed:**
- Custom JWT handling code
- `jsonwebtoken` dependency (still used internally by NextAuth)

### 2. Environment Variables

**Changed:**
- `JWT_SECRET` → `AUTH_SECRET` (NextAuth uses this automatically)

**Required:**
```bash
# Generate with:
openssl rand -base64 32
# Or:
npx auth secret
```

### 3. File Structure

**New Files:**
- `/src/lib/auth/auth.ts` - Main NextAuth configuration export
- `/src/lib/auth/auth-config.ts` - Auth configuration with providers
- `/src/lib/auth/otp-service.ts` - OTP generation and SMS sending
- `/src/types/next-auth.d.ts` - TypeScript type extensions
- `/src/components/auth/session-provider.tsx` - React session provider
- `/src/app/api/auth/[...nextauth]/route.ts` - Auth API route handler
- `/src/middleware.ts` - NextAuth middleware

**Updated Files:**
- `/src/lib/auth/middleware.ts` - Now uses NextAuth's `auth()` function
- `/src/lib/middleware/rls-route-helpers.ts` - Updated to work with async auth
- `/src/app/login/page.tsx` - Uses `signIn()` from NextAuth
- `/src/app/patient/login/page.tsx` - Uses `signIn()` from NextAuth
- `/src/app/dashboard/[clinic_id]/layout.tsx` - Uses `auth()` for session validation
- `/src/app/layout.tsx` - Added `AuthSessionProvider` wrapper

**Removed Files:**
- `/src/lib/auth/auth-service.ts` - Replaced by NextAuth providers
- `/src/app/api/auth/login/route.ts` - Replaced by NextAuth credentials provider
- `/src/app/api/patient/login/route.ts` - Replaced by NextAuth
- `/src/app/api/patient/auth/verify/route.ts` - Replaced by NextAuth credentials provider

### 4. Authentication Providers

**Clinic Staff:**
- Provider: `clinic-login` (CredentialsProvider)
- Flow: Clinic ID + Password → JWT Session

**Patients:**
- Provider: `patient-otp-verify` (CredentialsProvider)
- Flow: Phone Number + OTP → JWT Session

### 5. Session Management

**Before:**
- Custom JWT tokens in HTTP-only cookies (`clinic_session`, `patient_session`)
- Manual cookie management

**After:**
- NextAuth JWT sessions (8-hour expiry)
- Automatic cookie handling by NextAuth
- Session accessible via `auth()` on server or `useSession()` on client

### 6. Protected Routes

**Before:**
```typescript
const authResult = requireAuth(request)
if (!authResult.success) return authResult.response
```

**After:**
```typescript
const authResult = await requireAuth(request)
if (!authResult.success) return authResult.response

// Or in Server Components:
const session = await auth()
if (!session) redirect('/login')
```

### 7. Login Flow

**Clinic Login:**
```typescript
// Client-side
const result = await signIn("clinic-login", {
  clinicId,
  password,
  redirect: false,
})
```

**Patient Login:**
```typescript
// Step 1: Send OTP (custom API endpoint)
fetch("/api/patient/auth/send-otp", {...})

// Step 2: Verify OTP with NextAuth
const result = await signIn("patient-otp-verify", {
  phoneNumber,
  otp,
  redirect: false,
})
```

## Migration Checklist

- [x] Install NextAuth.js v5 dependencies
- [x] Create auth configuration with credentials providers
- [x] Create API route handler for `[...nextauth]`
- [x] Update middleware to use NextAuth
- [x] Update all protected API routes to await auth checks
- [x] Update login pages to use `signIn()`
- [x] Update dashboard layout to use `auth()`
- [x] Add SessionProvider to root layout
- [x] Remove old auth service and login routes
- [x] Update environment variables
- [x] Add TypeScript type definitions

## Security Improvements

1. **CSRF Protection:** Built into NextAuth
2. **Secure Cookies:** Automatic secure flag in production
3. **Session Management:** Industry-standard JWT handling
4. **Type Safety:** Full TypeScript support with proper type extensions
5. **Middleware Integration:** Proper Next.js middleware integration
6. **No Custom Crypto:** Using battle-tested libraries instead of custom JWT implementation

## Testing

After migration:

1. **Clinic Login:** Test clinic staff login with valid credentials
2. **Patient Login:** Test patient OTP flow (send → verify)
3. **Protected Routes:** Verify dashboard access requires login
4. **Session Persistence:** Verify sessions persist across page reloads
5. **Logout:** Implement and test sign-out functionality

## Next Steps

1. **Generate AUTH_SECRET:**
   ```bash
   npx auth secret
   # Or:
   openssl rand -base64 32
   ```

2. **Update Production Environment:**
   - Set `AUTH_SECRET` in production
   - Remove `JWT_SECRET` if present

3. **Implement Sign Out:**
   Add sign-out buttons using:
   ```typescript
   import { signOut } from "next-auth/react"
   <button onClick={() => signOut()}>Sign Out</button>
   ```

4. **Add OAuth Providers (Optional):**
   Easy to add Google, GitHub, etc. if needed later

## Troubleshooting

**Session not persisting:**
- Check `AUTH_SECRET` is set
- Check cookies are being set correctly
- Verify callback URLs are correct

**TypeScript errors:**
- Ensure `/src/types/next-auth.d.ts` is being picked up
- Check that type extensions are properly exported

**Middleware not working:**
- Verify `/src/middleware.ts` exports the NextAuth middleware
- Check matcher configuration includes protected routes

## References

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Auth.js v5 Beta](https://authjs.dev/)
- [NextAuth Credentials Provider](https://next-auth.js.org/providers/credentials)
