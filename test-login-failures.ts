
async function testLogin(username, password, scenario) {
    const url = 'http://127.0.0.1:3000/api/auth/login';
    const body = { username, password };

    console.log(`\n--- Testing ${scenario} ---`);
    console.log(`Attempting login for '${username}' with password '${password}'`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        console.log(`Status: ${response.status}`);
        const data = await response.json();
        console.log(`Response:`, data);
    } catch (error) {
        console.error('Request failed:', error);
    }
}

async function runTests() {
    // 1. Success case
    await testLogin('ministry.admin', 'admin123', 'Valid Credentials');

    // 2. User not found
    await testLogin('nonexistent.user', 'admin123', 'User Not Found');

    // 3. Invalid password
    await testLogin('ministry.admin', 'wrongpassword', 'Invalid Password');

    // 4. Inactive user (if any, skipping for now as we don't have a known inactive user seed)
}

runTests();
