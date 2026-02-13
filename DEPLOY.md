# Deployment Guide - AfyaBook

Step-by-step instructions for deploying AfyaBook to production.

## Prerequisites

- [ ] GitHub account
- [ ] Vercel account (free tier works)
- [ ] Supabase account (free tier works)
- [ ] Twilio account (for SMS)
- [ ] Node.js 18+ installed locally

## Deployment Time: ~30 minutes

---

## Step 1: Clone and Setup (5 min)

### 1.1 Clone Repository

```bash
git clone https://github.com/yourusername/afyabook.git
cd afyabook
```

### 1.2 Install Dependencies

```bash
npm install
```

### 1.3 Copy Environment Template

```bash
cp .env.example .env
```

Leave this file open - you'll add values as you go.

---

## Step 2: Setup Supabase Database (10 min)

### 2.1 Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Name: `afyabook-[your-clinic-name]`
4. Password: Generate a strong password (save it!)
5. Region: Choose closest to Tanzania (e.g., `East US`)
6. Click "Create new project"

**Wait 2-3 minutes for project to initialize**

### 2.2 Get Database Connection String

1. In Supabase Dashboard, go to **Project Settings** → **Database**
2. Scroll to **Connection String** section
3. Copy the **Transaction Pooler** connection string (port 6543)
4. It looks like:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:6543/postgres?sslmode=require
   ```
5. Add `&channel_binding=require` to the end

### 2.3 Add to .env

```bash
# In .env file
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:6543/postgres?sslmode=require&channel_binding=require"
```

### 2.4 Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

**Expected output:**
```
✔ Your database is now in sync with your Prisma schema
```

### 2.5 Seed Demo Data (Optional)

```bash
# Seed database with demo clinic, staff, patients
npx prisma db seed
```

Or manually:
```bash
psql $DATABASE_URL -f supabase/seed.sql
```

### 2.6 Verify Database

```bash
# Open Prisma Studio
npx prisma studio
```

You should see all tables with data.

---

## Step 3: Setup Twilio (5 min)

### 3.1 Create Twilio Account

1. Go to [Twilio Console](https://www.twilio.com/console)
2. Sign up (free trial works for testing)
3. Verify your account

### 3.2 Get Credentials

In Twilio Console Dashboard:

1. **Account SID**: Copy "ACxxxxx" string
2. **Auth Token**: Click "Show" and copy

Add to `.env`:
```bash
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="xxxxx"
```

### 3.3 Get Phone Number

1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. For Tanzania: You may need to contact Twilio sales for local numbers
3. Alternative: Use US/UK number for testing
4. Copy the number with `+` prefix

Add to `.env`:
```bash
TWILIO_PHONE_NUMBER="+1234567890"
```

**For Tanzania Production:**
- Apply for Alphanumeric Sender ID: "AFYABOOK"
- Register with TCRA (Tanzania Communications Regulatory Authority)
- This takes 2-4 weeks

### 3.4 Test SMS

```bash
# Run verification script
node scripts/verify-install.js
```

You should see "✓ Twilio credentials valid"

---

## Step 4: Generate Secrets (2 min)

Generate secure random strings for:

```bash
# Generate secrets
node -e "console.log('CLINIC_CREDENTIALS_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CRON_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('REMINDERS_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:

```bash
# Clinic credentials (you can change these)
CLINIC_CREDENTIALS='{"demo-clinic": "demo123", "main-clinic": "YourSecurePass123!"}'

# Random secrets
CRON_SECRET="generated-secret-1"
REMINDERS_SECRET_KEY="generated-secret-2"
```

**Important:**
- Change default passwords before production
- Use strong passwords (12+ chars, mixed case, numbers, symbols)

---

## Step 5: Local Testing (5 min)

### 5.1 Verify Installation

```bash
node scripts/verify-install.js
```

**Expected:** All checks pass ✓

### 5.2 Build Test

```bash
npm run build
```

**Expected:** Build completes without errors

### 5.3 Test Locally

```bash
npm run dev
```

1. Open http://localhost:3000/login
2. Login with: `demo-clinic` / `demo123`
3. Verify dashboard loads
4. Check today's appointments are visible

---

## Step 6: Deploy to Vercel (10 min)

### 6.1 Push to GitHub

```bash
# Create repository (if not done)
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/afyabook.git
git push -u origin main
```

### 6.2 Import to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New...** → **Project**
3. Import your GitHub repository
4. Click **Import**

### 6.3 Configure Project

**Framework Preset:** Next.js

**Build Settings:**
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

**Environment Variables:**

Add ALL variables from your `.env` file:

1. `DATABASE_URL`
2. `CLINIC_CREDENTIALS`
3. `TWILIO_ACCOUNT_SID`
4. `TWILIO_AUTH_TOKEN`
5. `TWILIO_PHONE_NUMBER`
6. `CRON_SECRET`
7. `REMINDERS_SECRET_KEY`

For each:
- Click "Add"
- Enter name and value
- Select "Production" and "Preview" environments
- Click "Add"

### 6.4 Deploy

Click **Deploy**

Wait 2-3 minutes for build to complete.

### 6.5 Verify Deployment

Once deployed, Vercel will show you the URL:
`https://afyabook-xxxxx.vercel.app`

1. Visit the URL
2. Add `/login` to the end
3. Test login with demo credentials
4. Verify dashboard works

---

## Step 7: Configure Twilio Webhook (3 min)

### 7.1 Get Production URL

Copy your Vercel deployment URL:
```
https://afyabook-xxxxx.vercel.app
```

### 7.2 Add Webhook URL to Vercel

1. In Vercel Dashboard, go to **Settings** → **Environment Variables**
2. Add new variable:
   - Name: `TWILIO_STATUS_CALLBACK_URL`
   - Value: `https://afyabook-xxxxx.vercel.app/api/webhooks/twilio/status`
   - Environment: Production
3. Click **Save**
4. **Important:** Redeploy the project!
   - Go to **Deployments**
   - Click the latest deployment
   - Click **Redeploy**

### 7.3 Configure Twilio

1. Go to Twilio Console → **Phone Numbers** → **Manage** → **Active Numbers**
2. Click your phone number
3. Scroll to **Messaging** section
4. Under **A Message Comes In**, set webhook:
   - Webhook: `https://afyabook-xxxxx.vercel.app/api/webhooks/twilio/status`
   - HTTP Method: `POST`
5. Click **Save**

---

## Step 8: Final Verification (5 min)

### 8.1 Test Complete Flow

1. **Book Appointment:**
   - Login to dashboard
   - Go to Quick Book
   - Enter your phone number
   - Complete booking

2. **Verify SMS:**
   - Check your phone for confirmation SMS
   - Should arrive within 30 seconds

3. **Test Reminder:**
   - Book appointment for tomorrow
   - Or manually trigger: 
     ```bash
     curl -X POST "https://afyabook-xxxxx.vercel.app/api/reminders/send-now?secret_key=YOUR_REMINDERS_SECRET_KEY"
     ```

4. **Verify Status Updates:**
   - In dashboard, change appointment status
   - Verify slot availability updates

### 8.2 Run Verification Script

```bash
# Update verification script with production URL
# Then run locally:
node scripts/verify-install.js
```

### 8.3 Check Logs

**Vercel Logs:**
1. Go to Vercel Dashboard → **Deployments**
2. Click latest deployment
3. Click **View Function Logs**
4. Check for errors

**Supabase Logs:**
1. Go to Supabase Dashboard → **Logs**
2. Check for database errors

---

## Step 9: Custom Domain (Optional, 5 min)

### 9.1 Add Custom Domain

1. In Vercel Dashboard → **Settings** → **Domains**
2. Enter your domain: `clinic.afyabook.co.tz`
3. Click **Add**
4. Follow DNS configuration instructions

### 9.2 Update Environment Variables

After domain is configured:

1. Update `TWILIO_STATUS_CALLBACK_URL` to use custom domain
2. Redeploy

---

## Post-Deployment Checklist

- [ ] Dashboard loads at production URL
- [ ] Can login with demo credentials
- [ ] Can book appointment
- [ ] Receives confirmation SMS
- [ ] Appointment visible in dashboard
- [ ] Can update appointment status
- [ ] Slot availability updates correctly
- [ ] Cron job running (check in Vercel dashboard)
- [ ] Database has data (check Supabase)
- [ ] No errors in Vercel logs
- [ ] Changed default passwords
- [ ] Set up custom domain (optional)

---

## Production Security Checklist

- [ ] Changed `demo-clinic` password
- [ ] Generated strong secrets
- [ ] Enabled 2FA on Twilio account
- [ ] Enabled 2FA on Supabase account
- [ ] Set up billing alerts on Twilio
- [ ] Reviewed RLS policies
- [ ] Tested cross-clinic isolation
- [ ] Verified SSL certificate
- [ ] No secrets in git history

---

## Common Issues & Solutions

### "Database connection failed"
```
✗ Check DATABASE_URL format
✓ Must include sslmode=require
✓ Must include channel_binding=require
✓ Use Transaction Pooler (port 6543), not Session Pooler
```

### "SMS not sending"
```
✗ Check Twilio credentials
✓ Verify TWILIO_PHONE_NUMBER starts with +
✓ Check Twilio account balance
✓ Verify account is not in trial mode
✓ Check phone number format in patient records
```

### "Cron job not running"
```
✗ Check CRON_SECRET is set
✓ Verify cron job visible in Vercel dashboard
✓ Check Vercel function logs for errors
✓ Test manual trigger endpoint
```

### "Build failed"
```
✗ Check TypeScript errors: npm run build locally
✓ Ensure all dependencies installed
✓ Check Prisma schema is valid
✓ Verify environment variables set
```

---

## Scaling Up

### When to Upgrade

**Supabase Free → Pro ($25/mo):**
- Database > 400MB
- Bandwidth > 80GB/month
- Need automated backups
- Need more than 500MB storage

**Twilio Short Code:**
- >1000 SMS/day
- Need better delivery rates
- Business registration complete

**Vercel Pro ($20/mo):**
- >100GB bandwidth
- Need team collaboration
- Priority support needed

### Performance Monitoring

Set up monitoring:
```bash
# Add to your monitoring stack
- Vercel Analytics (built-in)
- Supabase Dashboard metrics
- Twilio Console analytics
- Custom cron_logs monitoring
```

---

## Support

**Stuck?**

1. Check `TESTING.md` for troubleshooting
2. Review `docs/ENVIRONMENT_VARIABLES.md`
3. Check Vercel/Supabase/Twilio documentation
4. Open an issue on GitHub

**Emergency Contacts:**
- Vercel Support: https://vercel.com/help
- Supabase Support: https://supabase.com/support
- Twilio Support: https://support.twilio.com

---

## Next Steps

After successful deployment:

1. **Train staff** on dashboard usage
2. **Set up monitoring** alerts
3. **Schedule regular backups** (if on Pro tier)
4. **Collect feedback** from clinic staff
5. **Plan for scaling** as user base grows

---

**🎉 Congratulations! AfyaBook is now live and ready to serve your clinic!**
