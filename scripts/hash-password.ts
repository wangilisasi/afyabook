/**
 * Utility script to hash clinic passwords
 * 
 * Usage:
 *   npx tsx scripts/hash-password.ts your-password
 * 
 * Output:
 *   Hashed password to use in CLINIC_CREDENTIALS env var
 */

import bcrypt from 'bcryptjs'

const password = process.argv[2]

if (!password) {
  console.error('Usage: npx tsx scripts/hash-password.ts <password>')
  process.exit(1)
}

const hash = bcrypt.hashSync(password, 12)
console.log('\nHashed password:')
console.log(hash)
console.log('\nAdd to CLINIC_CREDENTIALS env var:')
console.log(`CLINIC_CREDENTIALS={"your-clinic-id": "${hash}"}`)
