


async function reproduceLogin() {
    const url = 'http://127.0.0.1:3000/api/auth/login';
    const body = {
        username: 'ministry.admin',
        password: 'admin123'
    };

    try {
        console.log(`Attempting login to ${url} with`, body);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        console.log('Response status:', response.status);
        const text = await response.text();
        console.log('Response body:', text);

        if (response.ok) {
            console.log('Login SUCCESS');
        } else {
            console.log('Login FAILED');
        }
    } catch (error) {
        console.error('Error during login request:', error);
    }
}

reproduceLogin();
