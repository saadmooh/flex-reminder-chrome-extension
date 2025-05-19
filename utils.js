const API_BASE_URL = 'https://flexreminder.com/api';
const API_PASSWORD = 'api_password_app';

// Fetch the stored language from chrome.storage.local
async function getStoredLanguage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['language'], (result) => {
      resolve(result.language || null); // Return null if no language is stored
    });
  });
}

async function fetchUserLanguage(apiRequest) {
  try {
    const response = await apiRequest('user', 'GET');
    const data = await response.json();
    if (response.ok && data.language) {
      // Store the language in chrome.storage.local
      chrome.storage.local.set({ language: data.language }, () => {
        console.log('Language stored:', data.language);
      });
      return data.language; // 'ar' or 'en'
    }
    return null; // Return null if language is not found
  } catch (error) {
    console.error('Error fetching user language:', error);
    return null; // Return null on error
  }
}

function applyLanguage(language) {
  const isRTL = language === 'ar';
  document.body.classList.remove('rtl', 'ltr');
  document.body.classList.add(isRTL ? 'rtl' : 'ltr');

  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = translations[language][key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    element.placeholder = translations[language][key];
  });
}

async function apiRequest(endpoint, method, body = null, auth = true, lang = 'en') {
  const headers = {
    'X-API-Password': API_PASSWORD,
    'Accept': 'application/json',
  };
  if (auth) {
    const token = await new Promise((resolve) =>
      chrome.storage.local.get(['token'], (r) => resolve(r.token))
    );
    if (!token) {
      throw new Error(translations[lang]?.noToken || 'No authentication token found');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }
  const config = { method, headers };
  if (body) {
    config.body = method === 'POST' && (endpoint.includes('login') || endpoint.includes('register'))
      ? new URLSearchParams(body)
      : JSON.stringify(body);
    config.headers['Content-Type'] = method === 'POST' && (endpoint.includes('login') || endpoint.includes('register'))
      ? 'application/x-www-form-urlencoded'
      : 'application/json';
  }
  return fetch(`${API_BASE_URL}/${endpoint}`, config);
}