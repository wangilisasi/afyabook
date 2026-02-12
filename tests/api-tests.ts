/**
 * API Test Script for AfyaBook
 * 
 * This file contains test examples for all API endpoints.
 * Run these in your browser console or use a tool like Postman/Insomnia.
 * 
 * Prerequisites:
 * 1. Server running: npm run dev
 * 2. Valid clinic_id from your database
 * 3. Valid slot_id from your database
 */

const BASE_URL = 'http://localhost:3000/api'

// ============================================================================
// TEST 1: POST /api/patients/lookup - Existing Patient
// ============================================================================

async function testLookupExistingPatient() {
  console.log('\n=== TEST 1: Lookup Existing Patient ===')
  
  try {
    const response = await fetch(`${BASE_URL}/patients/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: '0712345678',  // Maria Juma from seed data
        language_preference: 'sw'
      }),
    })

    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Response:', JSON.stringify(data, null, 2))
    
    // Expected: 200 OK, isNew: false, patient data returned
    if (response.status === 200 && !data.isNew) {
      console.log('✅ TEST PASSED: Existing patient found')
    } else {
      console.log('❌ TEST FAILED: Expected existing patient')
    }
    
    return data
  } catch (error) {
    console.error('❌ TEST ERROR:', error)
  }
}

// ============================================================================
// TEST 2: POST /api/patients/lookup - New Patient (Auto-create)
// ============================================================================

async function testLookupNewPatient() {
  console.log('\n=== TEST 2: Lookup New Patient (Auto-create) ===')
  
  try {
    const uniquePhone = `07${Math.floor(Math.random() * 100000000)}`
    
    const response = await fetch(`${BASE_URL}/patients/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: uniquePhone,
        name: 'Juma Test',
        language_preference: 'sw'
      }),
    })

    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Response:', JSON.stringify(data, null, 2))
    
    // Expected: 201 Created, isNew: true
    if (response.status === 201 && data.isNew) {
      console.log('✅ TEST PASSED: New patient created')
    } else {
      console.log('❌ TEST FAILED: Expected new patient creation')
    }
    
    return data
  } catch (error) {
    console.error('❌ TEST ERROR:', error)
  }
}

// ============================================================================
// TEST 3: POST /api/patients/lookup - Invalid Phone Format
// ============================================================================

async function testInvalidPhoneFormat() {
  console.log('\n=== TEST 3: Invalid Phone Format ===')
  
  const testCases = [
    { phone: '1234567890', description: 'Invalid prefix' },
    { phone: '071234567', description: 'Too short (9 digits)' },
    { phone: '07123456789', description: 'Too long (11 digits)' },
    { phone: '', description: 'Empty phone' },
    { phone: 'abc123', description: 'Non-numeric' },
    { phone: '0721234567', description: 'Invalid prefix (072)' }
  ]
  
  for (const testCase of testCases) {
    try {
      const response = await fetch(`${BASE_URL}/patients/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: testCase.phone,
          name: 'Test Patient'
        }),
      })

      const data = await response.json()
      console.log(`\nTest: ${testCase.description}`)
      console.log('Phone:', testCase.phone)
      console.log('Status:', response.status)
      
      if (response.status === 400) {
        console.log('✅ TEST PASSED: Validation error returned')
        console.log('Error:', data.error)
      } else {
        console.log('❌ TEST FAILED: Expected 400 error')
      }
    } catch (error) {
      console.error('❌ TEST ERROR:', error)
    }
  }
}

// ============================================================================
// TEST 4: GET /api/slots/available - Valid Request
// ============================================================================

async function testGetAvailableSlots() {
  console.log('\n=== TEST 4: Get Available Slots ===')
  
  // You'll need to replace this with a valid clinic_id from your database
  const clinicId = 'YOUR_CLINIC_ID_HERE'  // TODO: Replace with real clinic ID
  const today = new Date().toISOString().split('T')[0]
  
  try {
    const response = await fetch(
      `${BASE_URL}/slots/available?clinic_id=${clinicId}&date=${today}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Response:', JSON.stringify(data, null, 2))
    
    if (response.status === 200) {
      console.log(`✅ TEST PASSED: Found ${data.count} available slots`)
      if (data.slots.length > 0) {
        console.log('First slot:', data.slots[0])
      }
    } else {
      console.log('❌ TEST FAILED: Expected 200 OK')
    }
    
    return data
  } catch (error) {
    console.error('❌ TEST ERROR:', error)
  }
}

// ============================================================================
// TEST 5: GET /api/slots/available - Missing Parameters
// ============================================================================

async function testMissingParameters() {
  console.log('\n=== TEST 5: Missing Query Parameters ===')
  
  const testCases = [
    { url: `${BASE_URL}/slots/available`, description: 'No parameters' },
    { url: `${BASE_URL}/slots/available?clinic_id=123`, description: 'Missing date' },
    { url: `${BASE_URL}/slots/available?date=2025-02-20`, description: 'Missing clinic_id' },
  ]
  
  for (const testCase of testCases) {
    try {
      const response = await fetch(testCase.url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      console.log(`\nTest: ${testCase.description}`)
      console.log('Status:', response.status)
      
      if (response.status === 400) {
        console.log('✅ TEST PASSED: Validation error returned')
        console.log('Error:', data.error)
      } else {
        console.log('❌ TEST FAILED: Expected 400 error')
      }
    } catch (error) {
      console.error('❌ TEST ERROR:', error)
    }
  }
}

// ============================================================================
// TEST 6: GET /api/slots/available - Past Date
// ============================================================================

async function testPastDate() {
  console.log('\n=== TEST 6: Past Date Request ===')
  
  const clinicId = 'YOUR_CLINIC_ID_HERE'  // TODO: Replace with real clinic ID
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const pastDate = yesterday.toISOString().split('T')[0]
  
  try {
    const response = await fetch(
      `${BASE_URL}/slots/available?clinic_id=${clinicId}&date=${pastDate}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Response:', JSON.stringify(data, null, 2))
    
    if (response.status === 400) {
      console.log('✅ TEST PASSED: Past date rejected')
    } else {
      console.log('❌ TEST FAILED: Expected 400 error for past date')
    }
  } catch (error) {
    console.error('❌ TEST ERROR:', error)
  }
}

// ============================================================================
// TEST 7: GET /api/slots/[id] - Valid Slot
// ============================================================================

async function testGetSlotDetails() {
  console.log('\n=== TEST 7: Get Slot Details ===')
  
  // You'll need to replace this with a valid slot_id from your database
  const slotId = 'YOUR_SLOT_ID_HERE'  // TODO: Replace with real slot ID
  
  try {
    const response = await fetch(`${BASE_URL}/slots/${slotId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Response:', JSON.stringify(data, null, 2))
    
    if (response.status === 200) {
      console.log('✅ TEST PASSED: Slot details retrieved')
      console.log('Clinic:', data.slot.clinic?.name)
      console.log('Staff:', `${data.slot.staff?.first_name} ${data.slot.staff?.last_name}`)
      console.log('Can Book:', data.can_book)
    } else {
      console.log('❌ TEST FAILED: Expected 200 OK')
    }
    
    return data
  } catch (error) {
    console.error('❌ TEST ERROR:', error)
  }
}

// ============================================================================
// TEST 8: GET /api/slots/[id] - Invalid/Non-existent Slot
// ============================================================================

async function testInvalidSlotId() {
  console.log('\n=== TEST 8: Invalid/Non-existent Slot ===')
  
  const testCases = [
    { id: 'invalid-id', description: 'Invalid format' },
    { id: '123e4567-e89b-12d3-a456-426614174000', description: 'Non-existent UUID' },
  ]
  
  for (const testCase of testCases) {
    try {
      const response = await fetch(`${BASE_URL}/slots/${testCase.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      console.log(`\nTest: ${testCase.description}`)
      console.log('ID:', testCase.id)
      console.log('Status:', response.status)
      
      if (response.status === 400 || response.status === 404) {
        console.log('✅ TEST PASSED: Error returned')
        console.log('Error:', data.error)
      } else {
        console.log('❌ TEST FAILED: Expected 400 or 404 error')
      }
    } catch (error) {
      console.error('❌ TEST ERROR:', error)
    }
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
  console.log('🧪 Starting AfyaBook API Tests...')
  console.log('Make sure your server is running: npm run dev')
  console.log('=========================================')
  
  // Patient lookup tests
  await testLookupExistingPatient()
  await testLookupNewPatient()
  await testInvalidPhoneFormat()
  
  // Slots available tests
  await testGetAvailableSlots()
  await testMissingParameters()
  await testPastDate()
  
  // Slot details tests
  await testGetSlotDetails()
  await testInvalidSlotId()
  
  console.log('\n=========================================')
  console.log('✅ All tests completed!')
  console.log('Check the results above.')
}

// ============================================================================
// USAGE INSTRUCTIONS
// ============================================================================

/**
 * To run these tests:
 * 
 * Option 1: Browser Console
 * 1. Open your browser and navigate to http://localhost:3000
 * 2. Open Developer Tools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste this entire file
 * 5. Run: await runAllTests()
 * 
 * Option 2: Individual Tests
 * - await testLookupExistingPatient()
 * - await testGetAvailableSlots()
 * - await testGetSlotDetails()
 * 
 * Option 3: Postman/Insomnia
 * Use the fetch calls as templates for your API client
 * 
 * IMPORTANT: Replace YOUR_CLINIC_ID_HERE and YOUR_SLOT_ID_HERE 
 * with actual UUIDs from your database!
 */

// Export for use in other files if needed
export {
  testLookupExistingPatient,
  testLookupNewPatient,
  testInvalidPhoneFormat,
  testGetAvailableSlots,
  testMissingParameters,
  testPastDate,
  testGetSlotDetails,
  testInvalidSlotId,
  runAllTests,
}

// Make available globally for browser console
declare global {
  interface Window {
    testApi: {
      lookupExisting: typeof testLookupExistingPatient
      lookupNew: typeof testLookupNewPatient
      invalidPhone: typeof testInvalidPhoneFormat
      getSlots: typeof testGetAvailableSlots
      missingParams: typeof testMissingParameters
      pastDate: typeof testPastDate
      getSlot: typeof testGetSlotDetails
      invalidSlot: typeof testInvalidSlotId
      runAll: typeof runAllTests
    }
  }
}

if (typeof window !== 'undefined') {
  window.testApi = {
    lookupExisting: testLookupExistingPatient,
    lookupNew: testLookupNewPatient,
    invalidPhone: testInvalidPhoneFormat,
    getSlots: testGetAvailableSlots,
    missingParams: testMissingParameters,
    pastDate: testPastDate,
    getSlot: testGetSlotDetails,
    invalidSlot: testInvalidSlotId,
    runAll: runAllTests,
  }
}
