const API_BASE_URL = 'https://flexreminder.com/api';
const API_PASSWORD = 'api_password_app';
const TOKEN_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check if user is already logged in
    const token = await new Promise(resolve => chrome.storage.local.get(['token'], r => resolve(r.token)));
    console.log('Token:', token);
    if (token) {
      // Verify token immediately
      const isValid = await verifyToken(token);
      if (!isValid) {
        await chrome.storage.local.remove('token');
        window.location.href = chrome.runtime.getURL('login.html');
        return;
      }

      // Token is valid, redirect to save_post.html
      window.location.href = chrome.runtime.getURL('save_post.html');

      // Schedule token verification every hour
      setInterval(async () => {
        const currentToken = await new Promise(resolve => chrome.storage.local.get(['token'], r => resolve(r.token)));
        if (currentToken) {
          const isValid = await verifyToken(currentToken);
          if (!isValid) {
            await chrome.storage.local.remove('token');
            window.location.href = chrome.runtime.getURL('login.html');
          }
        }
      }, TOKEN_CHECK_INTERVAL);
    } else {
      window.location.href = chrome.runtime.getURL('login.html');
    }
  } catch (error) {
    console.error('Error checking authentication:', error);
    // Redirect to auth.html in case of error
    window.location.href = chrome.runtime.getURL('login.html');
  }
});

// Verify token with backend
async function verifyToken(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/verify-token`, {
      method: 'GET',
      headers: {
        'X-API-Password': API_PASSWORD,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      return true; // Token is valid
    } else if (response.status === 401) {
      return false; // Token is invalid
    } else {
      console.error('Unexpected response while verifying token:', response.status);
      return false; // Treat unexpected responses as invalid
    }
  } catch (error) {
    console.error('Error verifying token:', error);
    return false; // Treat errors as invalid token
  }
}