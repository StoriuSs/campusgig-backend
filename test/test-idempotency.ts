/**
 * IDEMPOTENCY RACE CONDITION TEST
 * -------------------------------
 * This script simulates 5 concurrent requests sent at the exact same millisecond
 * to verify that the backend's "Processing Lock" and Idempotency logic are working.
 *
 * HOW TO USE:
 * 1. Start your backend: `npm run dev`
 * 2. Get a valid JWT Token:
 *    - Open your browser DevTools (F12) -> Network tab.
 *    - Perform any action in the app (e.g., Save Profile).
 *    - Click the request -> Headers -> Request Headers.
 *    - Copy the string AFTER "Bearer " in the Authorization header.
 * 3. Paste the token into the TOKEN variable below.
 * 4. Run this script:
 *    npx ts-node -r tsconfig-paths/register test/test-idempotency.ts
 *
 * EXPECTED RESULT:
 * - Request 1: Status 200 (The first one to hit the server processed successfully)
 * - Request 2-5: Status 409 (Blocked by the atomic processing lock)
 */

import axios from 'axios'

const API_URL = 'http://localhost:8888/api/v1/users/me'
const TOKEN = 'YOUR_AUTH_TOKEN_HERE'
const IDEMPOTENCY_KEY = 'test-key-' + Date.now()

async function runTest() {
    console.log(`Firing 5 concurrent requests with key: ${IDEMPOTENCY_KEY}`)

    const requests = Array(5)
        .fill(0)
        .map((_, i) =>
            axios
                .patch(
                    API_URL,
                    { displayName: `Name ${i}` },
                    {
                        headers: {
                            Authorization: `Bearer ${TOKEN.replace(/[^\x20-\x7E]/g, '').trim()}`,
                            'Idempotency-Key': IDEMPOTENCY_KEY
                        }
                    }
                )
                .catch(
                    (err) =>
                        err.response || {
                            status: 0,
                            error: err.message,
                            code: err.code
                        }
                )
        )

    const results = await Promise.all(requests)

    results.forEach((res, i) => {
        if (res && res.status !== 0) {
            console.log(`Request ${i + 1}: Status ${res.status}`)
        } else {
            console.log(`Request ${i + 1}: FAILED (${res.error} [${res.code}])`)
        }
    })
}

runTest()
