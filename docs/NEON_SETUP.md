# AfyaBook Database Setup - Neon PostgreSQL

This guide explains how to set up Neon PostgreSQL with Prisma middleware-based authorization.

## Architecture Overview

Instead of native Row Level Security (RLS), we use **Prisma Middleware** to automatically filter queries based on user context. This provides:

- ✅ Database-level filtering (before data leaves DB)
- ✅ Automatic context propagation
- ✅ Role-based access control
- ✅ Easy to understand and debug

## Setup Instructions

### 1. Create Neon Account & Database

1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project called `afyabook`
3. Copy the connection string (looks like):
   ```
   postgresql://user:password@ep-xxx-xxx.us-east-1.aws.neon.tech/afyabook?sslmode=require
   ```

### 2. Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Neon connection string
DATABASE_URL="postgresql://your-user:your-password@your-host/afyabook?sslmode=require"
```

### 3. Generate Prisma Client

```bash
npm run db:generate
```

### 4. Run Migrations

```bash
npm run db:migrate
```

### 5. Seed Database

```bash
npm run db:seed
```

## Authorization System

### How It Works

The authorization middleware (`src/lib/middleware/authorization.ts`) automatically adds `WHERE` clauses to queries based on the user's role and context.

### Usage in API Routes

```typescript
import { prisma, withAuthContext } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  // Get user info from your auth system (NextAuth, Clerk, etc.)
  const user = await getCurrentUser(request)
  
  // Create auth context
  const authContext = {
    userId: user.id,
    userRole: user.role, // 'admin' | 'doctor' | 'nurse' | 'patient'
    clinicId: user.clinicId, // For clinic staff
    isAuthenticated: true
  }

  // All queries inside withAuthContext are automatically filtered
  const appointments = await withAuthContext(authContext, async () => {
    return prisma.appointment.findMany({
      include: {
        patient: true,
        slot: { include: { staff: true } }
      }
    })
  })

  return NextResponse.json({ appointments })
}
```

### Authorization Rules

| User Role | Patient Table | Appointment Table | Staff Table | Clinic Table | SMS Log Table |
|-----------|---------------|-------------------|-------------|--------------|---------------|
| **Admin** | All records | All records | All records | All records | All records |
| **Doctor/Nurse** | - | Own clinic only | Own clinic only | Own clinic only | Own clinic only |
| **Patient** | Own record only | Own appointments only | - | - | Own SMS only |

### Examples

#### Patient Viewing Their Appointments
```typescript
const authContext = {
  userId: 'patient-uuid-123',
  userRole: 'patient',
  isAuthenticated: true
}

const appointments = await withAuthContext(authContext, async () => {
  return prisma.appointment.findMany()
})
// Automatically filtered: WHERE patientId = 'patient-uuid-123'
```

#### Clinic Staff Viewing All Clinic Appointments
```typescript
const authContext = {
  userId: 'doctor-uuid-456',
  userRole: 'doctor',
  clinicId: 'clinic-uuid-789',
  isAuthenticated: true
}

const appointments = await withAuthContext(authContext, async () => {
  return prisma.appointment.findMany()
})
// Automatically filtered: WHERE clinicId = 'clinic-uuid-789'
```

#### Admin Viewing Everything
```typescript
const authContext = {
  userId: 'admin-uuid-000',
  userRole: 'admin',
  isAuthenticated: true
}

const appointments = await withAuthContext(authContext, async () => {
  return prisma.appointment.findMany()
})
// No filters applied - sees all appointments
```

## Important Notes

### Without Auth Context
If you call Prisma without `withAuthContext`, no filters are applied. This is useful for:
- Public endpoints (e.g., clinic listing)
- Background jobs
- Admin scripts

**Be careful**: Always wrap user-facing queries with `withAuthContext`!

### Transaction Safety
The auth context is maintained across transactions:
```typescript
await withAuthContext(authContext, async () => {
  return prisma.$transaction(async (tx) => {
    // Both queries are filtered by auth context
    const slot = await tx.appointmentSlot.findFirst({...})
    const appointment = await tx.appointment.create({...})
    return appointment
  })
})
```

### Testing
```typescript
// In tests, you can bypass auth or set specific contexts
const appointments = await withAuthContext(
  { userRole: 'admin', isAuthenticated: true }, 
  async () => prisma.appointment.findMany()
)
```

## Migration from SQLite

If you were using SQLite before:

1. ✅ Schema updated to PostgreSQL
2. ✅ Seed script updated
3. ✅ Adapter changed to Neon
4. ⚠️ **Data**: You'll need to re-seed (SQLite data doesn't migrate automatically)

Run:
```bash
# Reset and re-seed
npm run db:reset
```

## Troubleshooting

### Connection Issues
- Verify your Neon connection string includes `?sslmode=require`
- Check that the database exists in Neon dashboard
- Ensure your IP is allowed in Neon settings

### Auth Context Not Working
- Make sure you're using `withAuthContext()` wrapper
- Check that user role is set correctly
- Verify the model name matches in the middleware

### Performance
- Middleware adds WHERE clauses at query time (fast)
- No additional database overhead
- Context is stored in AsyncLocalStorage (minimal overhead)

## Next Steps

1. Set up authentication (NextAuth, Clerk, or custom)
2. Create middleware to extract user info from sessions
3. Use `withAuthContext` in all protected routes
4. Add audit logging for sensitive operations
