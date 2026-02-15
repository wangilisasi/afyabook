#!/bin/bash

# ============================================================================
# RLS DEPLOYMENT SCRIPT FOR NEON POSTGRESQL
# ============================================================================
# This script applies Row Level Security policies to your Neon database
#
# Usage:
#   ./scripts/apply-rls.sh
#
# Prerequisites:
#   - DATABASE_URL environment variable must be set
#   - psql or prisma CLI must be available
# ============================================================================

set -e

echo "🔐 Applying Row Level Security policies to Neon database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo "   Please set it to your Neon database connection string:"
    echo "   export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

echo "📋 Checking migration file..."

MIGRATION_FILE="prisma/migrations/20260215000000_add_rls_policies/migration.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found at $MIGRATION_FILE"
    exit 1
fi

echo "✓ Migration file found"

# Apply migration using Prisma
echo "🚀 Applying migration with Prisma..."
npx prisma migrate dev --name add_rls_policies

echo ""
echo "✅ RLS policies applied successfully!"
echo ""
echo "📊 To verify RLS is enabled, run:"
echo "   psql \$DATABASE_URL -c \"SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('clinics', 'staff', 'patients', 'appointment_slots', 'appointments', 'sms_logs', 'waitlist', 'cron_logs');\""
echo ""
echo "🔍 To test RLS, you can use:"
echo "   1. Set the clinic context: SET LOCAL app.current_clinic_id = 'your-clinic-uuid';"
echo "   2. Set the user role: SET LOCAL app.current_user_role = 'doctor';"
echo "   3. Query data: SELECT * FROM patients;"
echo ""
echo "📚 See docs/RLS_IMPLEMENTATION.md for more details"
