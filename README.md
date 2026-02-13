# AfyaBook - Tanzanian Clinic Appointment System

A mobile-first appointment booking system for Tanzanian clinics with SMS reminders, staff dashboard, and automated scheduling.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/afyabook)

## Features

- **Patient Booking**: Phone-based booking with SMS confirmations
- **Staff Dashboard**: Mobile-optimized interface for managing appointments
- **Automated Reminders**: 24-hour and same-day SMS reminders via Vercel Cron
- **Tanzania-Optimized**: Swahili language support, local timezone (EAT UTC+3)
- **Secure**: Row-Level Security, clinic data isolation
- **Real-time**: Optimistic updates, instant status changes

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/afyabook.git
cd afyabook
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Setup database
npx prisma migrate dev
npx prisma db seed

# Run development server
npm run dev
```

Visit http://localhost:3000/login

Demo credentials:
- Clinic ID: `demo-clinic`
- Password: `demo123`

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │   /login    │  │  /dashboard  │  │  Quick Book Wizard      │ │
│  │  Staff Auth │  │   Today      │  │  (4-step booking)       │ │
│  │             │  │   Search     │  │                         │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                  │
│  Next.js 14 App Router | React Server Components | Tailwind CSS │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ /api/appoint-│  │ /api/patients│  │ /api/cron/send-      │   │
│  │    ments     │  │              │  │    reminders         │   │
│  │ CRUD + SMS   │  │ Lookup/Create│  │ Hourly cron job      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ /api/auth/   │  │ /api/webhooks│  │ /api/reminders/      │   │
│  │    login     │  │ /twilio/     │  │    send-now          │   │
│  │ Clinic Auth  │  │    status    │  │ Manual trigger       │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│  Edge Functions | TypeScript | Zod Validation                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │    Prisma    │  │    Twilio    │  │  date-fns/timezone   │   │
│  │   ORM/Query  │  │ SMS Service  │  │  Tanzania EAT +3     │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Supabase (PostgreSQL)                   │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  patients | clinics | staff | slots | appointments       │   │
│  │  sms_logs | cron_logs                                    │   │
│  │  Row-Level Security (RLS) | Indexes | Triggers           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Cost Estimation

### Tanzania Deployment Costs

| Service | Cost | Notes |
|---------|------|-------|
| **Vercel** | $0/mo | Free tier: 100GB bandwidth, unlimited serverless functions |
| **Supabase** | $0/mo | Free tier: 500MB database, 2GB bandwidth |
| **Twilio SMS** | ~$0.02-0.05/SMS | To Tanzania numbers |
| **Twilio Phone** | ~$1-2/mo | Number rental |
| **Total** | ~$1-20/mo | Depends on SMS volume |

### SMS Volume Examples

| Clinic Size | Daily SMS | Monthly Cost |
|-------------|-----------|--------------|
| Small (50 appts/mo) | 2-3 | $3-5 |
| Medium (200 appts/mo) | 8-10 | $12-20 |
| Large (1000 appts/mo) | 40-50 | $60-100 |

### Tanzania-Specific SMS Pricing

**Standard SMS to Tanzania:**
- Twilio: $0.02-0.05 per SMS
- Delivery rate: ~90-95% (with Alphanumeric Sender ID)

**For High Volume (>1000 SMS/day):**
- Short code setup: $500-1000 one-time
- Short code rental: $500-1000/month
- Delivery rate: ~98%+
- **Recommendation:** Start with standard numbers, upgrade to short code as you scale

### Free Tier Limits

**Vercel Free Tier:**
- 100GB bandwidth/month
- 1000 build minutes/month
- Unlimited serverless functions
- **Adequate for:** Up to 5 clinics, 5000 appointments/month

**Supabase Free Tier:**
- 500MB database
- 2GB bandwidth
- 50,000 monthly active users
- **Adequate for:** Up to 10,000 patients, 50,000 appointments

**Upgrade triggers:**
- Database > 400MB → Pro tier ($25/mo)
- Bandwidth > 80GB → Pro tier
- Need backups → Pro tier

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Prisma |
| **SMS** | Twilio |
| **Auth** | Cookie-based (simple) |
| **Hosting** | Vercel |
| **Cron** | Vercel Cron |

## Project Structure

```
afyabook/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── appointments/  # Booking endpoints
│   │   │   ├── auth/          # Login endpoint
│   │   │   ├── cron/          # Scheduled jobs
│   │   │   ├── patients/      # Patient lookup
│   │   │   ├── reminders/     # Manual triggers
│   │   │   └── webhooks/      # Twilio webhooks
│   │   ├── dashboard/         # Staff dashboard
│   │   │   └── [clinic_id]/   # Clinic-specific routes
│   │   │       ├── today/     # Daily view
│   │   │       ├── search/    # Patient search
│   │   │       └── quick-book/# Booking wizard
│   │   ├── login/             # Staff login
│   │   └── page.tsx           # Root redirect
│   ├── lib/                   # Utilities
│   │   ├── prisma.ts          # Database client
│   │   ├── sms/               # SMS service
│   │   └── middleware/        # Auth middleware
│   └── components/            # Shared components
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── supabase/
│   ├── migrations/            # SQL migrations
│   └── seed.sql               # Demo data
├── scripts/
│   └── verify-install.js      # Setup verification
├── docs/                      # Documentation
├── vercel.json               # Vercel config
└── TESTING.md                # Testing checklist
```

## Key Features Explained

### Automated Reminders

The system uses Vercel Cron to send SMS reminders:

- **24-hour reminder**: Sent when appointment is 23-25 hours away
- **Same-day reminder**: Sent 2-4 hours before appointment
- **Timezone-aware**: Tanzania (EAT UTC+3), no daylight saving

**Why Cron beats setTimeout:**
- ✓ Survives server restarts
- ✓ Guaranteed execution
- ✓ No state management needed
- ✓ Built-in monitoring

See `docs/REMINDER_SYSTEM.md` for details.

### Mobile-First Dashboard

Designed for clinic staff using phones/tablets:

- **Swipe gestures**: Quick status updates
- **Pull-to-refresh**: Latest appointments
- **Optimistic updates**: Instant UI feedback
- **30-minute slots**: 8am-6pm schedule
- **Bilingual**: Swahili/English

### Security

- **Row-Level Security**: Clinic data isolation
- **Simple auth**: Cookie-based with 8-hour sessions
- **Twilio signature validation**: Webhook security
- **Input validation**: Zod schemas
- **SQL injection protection**: Prisma ORM

## Environment Variables

See `docs/ENVIRONMENT_VARIABLES.md` for complete documentation.

**Required:**
```bash
DATABASE_URL=postgresql://...
CLINIC_CREDENTIALS={"clinic-001": "password"}
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+255xxxx
CRON_SECRET=xxxxx
REMINDERS_SECRET_KEY=xxxxx
```

## Deployment

See `DEPLOY.md` for step-by-step deployment instructions.

**Quick deploy:**
```bash
# 1. Push to GitHub
git push origin main

# 2. Import to Vercel
# Go to https://vercel.com/new

# 3. Add environment variables
# In Vercel dashboard → Settings → Environment Variables

# 4. Deploy!
```

## Testing

See `TESTING.md` for comprehensive testing checklist.

**Quick verification:**
```bash
# Check setup
node scripts/verify-install.js

# Run tests
npm run test

# Test booking flow
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"slotId": "...", "patientId": "...", "clinicId": "..."}'
```

## Troubleshooting

### SMS Not Sending
1. Check Twilio credentials in `.env`
2. Verify phone number format (+255...)
3. Check Twilio account balance
4. Review SMS logs in database

### Cron Not Running
1. Verify `CRON_SECRET` is set
2. Check Vercel function logs
3. Test manually: `POST /api/reminders/send-now`

### Timezone Issues
1. Confirm Tanzania is UTC+3 (no DST)
2. Check server timezone settings
3. Review appointment times in database

See `docs/TROUBLESHOOTING.md` for more.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see LICENSE file

## Support

- **Issues:** https://github.com/yourusername/afyabook/issues
- **Documentation:** See `/docs` folder
- **Demo:** https://afyabook-demo.vercel.app

## Acknowledgments

- Built for Tanzanian healthcare clinics
- Swahili translations by native speakers
- SMS infrastructure by Twilio
- Database hosting by Supabase

---

**Made with ❤️ for Tanzania's healthcare system**
