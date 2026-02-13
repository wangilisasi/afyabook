#!/usr/bin/env node

/**
 * AfyaBook Installation Verification Script
 * 
 * Checks:
 * 1. Environment variables are set
 * 2. Database connection works
 * 3. Twilio credentials are valid
 * 4. Required files exist
 * 5. Dependencies are installed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

// Track results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function log(message, type = 'info') {
  const color = type === 'success' ? colors.green : 
                type === 'error' ? colors.red : 
                type === 'warning' ? colors.yellow : colors.blue;
  console.log(`${color}${message}${colors.reset}`);
}

function check(message, condition) {
  if (condition) {
    log(`  ✓ ${message}`, 'success');
    results.passed++;
    return true;
  } else {
    log(`  ✗ ${message}`, 'error');
    results.failed++;
    return false;
  }
}

function warn(message) {
  log(`  ⚠ ${message}`, 'warning');
  results.warnings++;
}

function section(title) {
  console.log(`\n${colors.bold}${colors.blue}▶ ${title}${colors.reset}`);
}

// Check if running in production (Vercel)
const isProduction = process.env.VERCEL === '1';

// Load environment variables from .env file if not in production
if (!isProduction) {
  try {
    require('dotenv').config();
  } catch {
    // dotenv might not be installed yet
  }
}

console.log(`\n${colors.bold}${colors.blue}
╔═══════════════════════════════════════════════════════════╗
║           AfyaBook Installation Verification              ║
║              Tanzanian Clinic Appointment System          ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

// ============================================================================
// 1. CHECK ENVIRONMENT VARIABLES
// ============================================================================

section('1. Environment Variables');

const requiredVars = [
  'DATABASE_URL',
  'CLINIC_CREDENTIALS',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'CRON_SECRET',
  'REMINDERS_SECRET_KEY'
];

const optionalVars = [
  'TWILIO_STATUS_CALLBACK_URL'
];

log('Required variables:');
for (const varName of requiredVars) {
  const value = process.env[varName];
  const exists = !!value;
  const masked = exists ? `${value.substring(0, 10)}...` : 'NOT SET';
  check(`${varName}: ${masked}`, exists);
}

log('\nOptional variables:');
for (const varName of optionalVars) {
  const value = process.env[varName];
  if (value) {
    log(`  ✓ ${varName}: Set`, 'success');
    results.passed++;
  } else {
    warn(`${varName}: Not set (optional)`);
  }
}

// Validate specific formats
if (process.env.DATABASE_URL) {
  const hasSSL = process.env.DATABASE_URL.includes('sslmode=require');
  check('DATABASE_URL includes sslmode=require', hasSSL);
}

if (process.env.TWILIO_ACCOUNT_SID) {
  const isValidFormat = process.env.TWILIO_ACCOUNT_SID.startsWith('AC');
  check('TWILIO_ACCOUNT_SID format (starts with AC)', isValidFormat);
}

if (process.env.TWILIO_PHONE_NUMBER) {
  const hasPlus = process.env.TWILIO_PHONE_NUMBER.startsWith('+');
  check('TWILIO_PHONE_NUMBER includes country code (+)', hasPlus);
}

// ============================================================================
// 2. CHECK FILE STRUCTURE
// ============================================================================

section('2. File Structure');

const requiredFiles = [
  'package.json',
  'vercel.json',
  'prisma/schema.prisma',
  'src/app/login/page.tsx',
  'src/app/dashboard/[clinic_id]/layout.tsx',
  'src/app/dashboard/[clinic_id]/today/page.tsx',
  'src/app/api/auth/login/route.ts',
  'src/app/api/cron/send-reminders/route.ts'
];

for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  check(`${file} exists`, exists);
}

// ============================================================================
// 3. CHECK DEPENDENCIES
// ============================================================================

section('3. Dependencies');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const requiredDeps = [
  'next',
  'react',
  '@prisma/client',
  'twilio',
  'date-fns',
  'zod'
];

for (const dep of requiredDeps) {
  const exists = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
  check(`${dep} installed`, exists);
}

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
  warn('node_modules not found. Run: npm install');
}

// ============================================================================
// 4. CHECK DATABASE CONNECTION (if DATABASE_URL is set)
// ============================================================================

section('4. Database Connection');

if (process.env.DATABASE_URL) {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Try a simple query
    prisma.$connect()
      .then(() => {
        log('  ✓ Database connection successful', 'success');
        results.passed++;
        
        // Check if tables exist
        return prisma.$queryRaw`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`;
      })
      .then((result) => {
        const tableCount = result[0].count;
        if (tableCount > 0) {
          log(`  ✓ Database has ${tableCount} tables`, 'success');
          results.passed++;
        } else {
          warn('Database exists but has no tables. Run migrations.');
        }
        return prisma.$disconnect();
      })
      .then(() => {
        printSummary();
      })
      .catch((err) => {
        log(`  ✗ Database connection failed: ${err.message}`, 'error');
        results.failed++;
        printSummary();
      });
  } catch (err) {
    log(`  ✗ Could not load Prisma: ${err.message}`, 'error');
    results.failed++;
    warn('Run: npm install && npx prisma generate');
    printSummary();
  }
} else {
  warn('DATABASE_URL not set, skipping database check');
  printSummary();
}

// ============================================================================
// 5. CHECK TWILIO CREDENTIALS (optional)
// ============================================================================

async function checkTwilio() {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    section('5. Twilio Configuration');
    
    try {
      const twilio = require('twilio');
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      // Try to fetch account info
      const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      
      log(`  ✓ Twilio credentials valid`, 'success');
      results.passed++;
      log(`  ℹ Account Status: ${account.status}`, 'info');
      log(`  ℹ Account Type: ${account.type}`, 'info');
      
      if (account.status !== 'active') {
        warn('Twilio account is not active. Verify your account.');
      }
      
    } catch (err) {
      log(`  ✗ Twilio credentials invalid: ${err.message}`, 'error');
      results.failed++;
    }
  }
}

// ============================================================================
// SUMMARY
// ============================================================================

function printSummary() {
  console.log(`\n${colors.bold}${colors.blue}
╔═══════════════════════════════════════════════════════════╗
║                      SUMMARY                              ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

  log(`Passed: ${results.passed}`, results.failed === 0 ? 'success' : 'info');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'info');
  log(`Warnings: ${results.warnings}`, results.warnings > 0 ? 'warning' : 'info');

  if (results.failed === 0) {
    console.log(`\n${colors.green}${colors.bold}✓ All checks passed! Ready for deployment.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bold}✗ Some checks failed. Please fix the issues above before deploying.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run Twilio check if credentials are available
checkTwilio().then(() => {
  // Summary will be printed by the database check callback
}).catch(() => {
  // If Twilio check fails, summary still needs to be printed
});
