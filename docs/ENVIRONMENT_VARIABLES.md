# Environment Variables Documentation

This document describes all environment variables required for AfyaBook deployment.

## Required Variables

These variables **must** be set for the application to function properly.

### Database

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection String | PostgreSQL connection string for Prisma. Must include `?sslmode=require` |

**How to get:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Project Settings → Database
4. Copy "Connection String" under "Transaction Pooler" (Port 6543)
5. **Important:** Append `&channel_binding=require` for Neon compatibility

**Example:**
```bash
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:6543/postgres?sslmode=require&channel_binding=require"
```

---

### Authentication

| Variable | Source | Description |
|----------|--------|-------------|
| `CLINIC_CREDENTIALS` | Generate yourself | JSON object with clinic IDs and passwords for staff dashboard |

**Format:**
```bash
CLINIC_CREDENTIALS='{"clinic-001": "SecurePass123!", "clinic-002": "AnotherPass456"}'
```

**Security notes:**
- Use strong passwords (12+ chars, mixed case, numbers, symbols)
- Change default passwords immediately after deployment
- Store securely in Vercel/Vault, never commit to git

---

### SMS (Twilio)

| Variable | Source | Description |
|----------|--------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info | Your Twilio Account SID (starts with "AC") |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info | Your Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Twilio Console → Phone Numbers → Manage | Your Twilio phone number with country code |

**How to get:**
1. Sign up at [Twilio](https://www.twilio.com)
2. Go to Console Dashboard
3. Copy Account SID and Auth Token from "Account Info" section
4. Buy a phone number (see Tanzania-specific notes below)

**Tanzania-Specific Notes:**

🇹🇿 **Twilio Phone Number for Tanzania:**
- Twilio offers **short codes** for high-volume messaging in Tanzania
- Alternative: Use **Alphanumeric Sender ID** (e.g., "AFYABOOK") for branding
- Standard long codes may work but with lower delivery rates
- Contact Twilio sales for Tanzania-specific pricing and setup

**Cost Estimate (Tanzania):**
- SMS to Tanzania: ~$0.02-0.05 USD per message
- Short code setup: ~$500-1000 one-time fee
- Monthly short code rental: ~$500-1000/month

**Testing in development:**
Use Twilio test credentials (see Twilio console) to avoid charges during testing.

---

### Cron Security

| Variable | Source | Description |
|----------|--------|-------------|
| `CRON_SECRET` | Generate yourself | Secret key to verify Vercel Cron requests |
| `REMINDERS_SECRET_KEY` | Generate yourself | Secret for manual reminder trigger endpoint |

**Generation:**
```bash
# Generate secure random strings
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Optional Variables

These variables add functionality but are not required for basic operation.

### Twilio Webhook

| Variable | Source | Description |
|----------|--------|-------------|
| `TWILIO_STATUS_CALLBACK_URL` | Your deployed URL | Webhook URL for SMS delivery status updates |

**Format:**
```bash
TWILIO_STATUS_CALLBACK_URL="https://your-domain.com/api/webhooks/twilio/status"
```

**Setup:**
1. Deploy your application first
2. Copy your production URL
3. Add this variable
4. Redeploy to activate

---

### Development

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to "development" for local development (auto-set by Next.js) |

---

## Environment Variable Checklist

Before deploying, ensure you have:

```bash
# Required
✓ DATABASE_URL                    # From Supabase
✓ CLINIC_CREDENTIALS              # Generate yourself
✓ TWILIO_ACCOUNT_SID              # From Twilio
✓ TWILIO_AUTH_TOKEN               # From Twilio
✓ TWILIO_PHONE_NUMBER             # From Twilio (+255... for TZ)
✓ CRON_SECRET                     # Generate yourself
✓ REMINDERS_SECRET_KEY            # Generate yourself

# Optional (can add later)
○ TWILIO_STATUS_CALLBACK_URL      # Your production URL
```

---

## Setting Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable:
   - Name: Variable name (e.g., `DATABASE_URL`)
   - Value: Variable value
   - Environment: Production (and Preview for testing)

5. **Important:** After adding variables, redeploy the project!

---

## Security Best Practices

1. **Never commit .env files** - They are in `.gitignore` for a reason
2. **Rotate secrets regularly** - Change API keys every 90 days
3. **Use different credentials** for production vs staging
4. **Limit Twilio access** - Use subaccounts for different environments
5. **Monitor usage** - Set up billing alerts in Twilio/Supabase
6. **Enable 2FA** - On both Twilio and Supabase accounts

---

## Troubleshooting Environment Issues

### "DATABASE_URL is not set"
```bash
# Check if variable is set
vercel env ls

# Add it if missing
vercel env add DATABASE_URL
```

### "Invalid Twilio credentials"
- Verify Account SID starts with "AC"
- Check Auth Token hasn't been regenerated
- Ensure phone number includes + and country code

### "Cron unauthorized"
- Verify `CRON_SECRET` is set in Vercel
- Check that the value matches between Vercel and your local .env

### "Cannot connect to database"
- Ensure `sslmode=require` is in the connection string
- Add `&channel_binding=require` for Supabase
- Check if IP is allowlisted in Supabase

---

## Tanzania-Specific Deployment Notes

### Phone Number Format
```
International: +255 XXX XXX XXX
Twilio Format: +255XXXXXXXXX (no spaces)
```

### SMS Regulations in Tanzania
- **Required:** Sender ID registration with TCRA (Tanzania Communications Regulatory Authority)
- **Required:** Opt-out instructions in every SMS
- **Recommended:** Business registration documentation

### Recommended Setup
1. Apply for Alphanumeric Sender ID: "AFYABOOK"
2. Register with TCRA (can take 2-4 weeks)
3. Use short code for high volume (>1000 SMS/day)
4. Test with small user base first

---

## Quick Reference

### Supabase URL
https://app.supabase.com/project/[PROJECT_REF]

### Twilio Console
https://console.twilio.com

### Vercel Dashboard
https://vercel.com/dashboard

### Generate Secure Secret
```bash
openssl rand -base64 32
```
