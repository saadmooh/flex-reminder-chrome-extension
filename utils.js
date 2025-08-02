const API_BASE_URL = 'https://flexreminder.com/api';
const API_PASSWORD = 'api_password_app';

// Complete translations object


// Fetch the stored language from chrome.storage.local
async function getStoredLanguage() {
  return new Promise((resolve) => {
    try {
      // Check if chrome storage is available
      if (!chrome || !chrome.storage || !chrome.storage.local) {
        console.warn('Chrome storage not available, using default language');
        resolve('ar');
        return;
      }

      chrome.storage.local.get(['language'], (result) => {
        if (chrome.runtime.lastError) {
          // Don't log the error to avoid console spam
          resolve('ar'); // Default fallback
          return;
        }
        resolve(result.language || 'ar'); // Default to 'ar' instead of null
      });
    } catch (error) {
      console.warn('Error in getStoredLanguage, using default:', error.message);
      resolve('ar'); // Default fallback
    }
  });
}

async function fetchUserLanguage(apiRequest) {
  try {
    const response = await apiRequest('user', 'GET');
    
    // Check if response is ok before parsing JSON
    if (!response.ok) {
      console.warn('API response not ok:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.language) {
      // Store the language in chrome.storage.local with error handling
      return new Promise((resolve) => {
        try {
          // Check if chrome storage is available
          if (!chrome || !chrome.storage || !chrome.storage.local) {
            console.warn('Chrome storage not available for language storage');
            resolve(data.language);
            return;
          }

          chrome.storage.local.set({ language: data.language }, () => {
            if (chrome.runtime.lastError) {
              // Don't log the error to avoid console spam
              resolve(data.language); // Still return the language even if storage fails
            } else {
              resolve(data.language);
            }
          });
        } catch (error) {
          console.warn('Error storing language, returning language anyway:', error.message);
          resolve(data.language);
        }
      });
    }
    return null; // Return null if language is not found
  } catch (error) {
    console.warn('Error fetching user language:', error.message);
    return null; // Return null on error
  }
}

function applyLanguage(language) {
  // Validate language parameter
  if (!language || typeof language !== 'string') {
    console.warn('Invalid language parameter, using default');
    language = 'ar';
  }
  
  // Ensure translations exist for the language
  if (!translations[language]) {
    console.warn(`No translations found for language: ${language}, using default`);
    language = 'ar';
  }
  
  const isRTL = language === 'ar';
  
  // Safely add/remove classes
  if (document.body) {
    document.body.classList.remove('rtl', 'ltr');
    document.body.classList.add(isRTL ? 'rtl' : 'ltr');
  }

  // Apply translations with error handling
  document.querySelectorAll('[data-i18n]').forEach(element => {
    try {
      const key = element.getAttribute('data-i18n');
      if (key && translations[language] && translations[language][key]) {
        element.textContent = translations[language][key];
      } else {
        console.warn(`Translation not found for key: ${key} in language: ${language}`);
      }
    } catch (error) {
      console.error('Error applying translation to element:', error);
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    try {
      const key = element.getAttribute('data-i18n-placeholder');
      if (key && translations[language] && translations[language][key]) {
        element.placeholder = translations[language][key];
      } else {
        console.warn(`Placeholder translation not found for key: ${key} in language: ${language}`);
      }
    } catch (error) {
      console.error('Error applying placeholder translation to element:', error);
    }
  });
}

async function apiRequest(endpoint, method, body = null, auth = true, lang = 'ar') {
  // Validate parameters
  if (!endpoint || typeof endpoint !== 'string') {
    throw new Error('Invalid endpoint parameter');
  }
  
  if (!method || typeof method !== 'string') {
    throw new Error('Invalid method parameter');
  }
  
  // Ensure lang has a fallback
  lang = lang || 'ar';
  
  const headers = {
    'X-API-Password': API_PASSWORD,
    'Accept': 'application/json',
  };
  
  if (auth) {
    const token = await new Promise((resolve) => {
      try {
        // Check if chrome storage is available
        if (!chrome || !chrome.storage || !chrome.storage.local) {
          console.warn('Chrome storage not available for token retrieval');
          resolve(null);
          return;
        }

        chrome.storage.local.get(['token'], (result) => {
          if (chrome.runtime.lastError) {
            // Don't log the error to avoid console spam
            resolve(null);
            return;
          }
          resolve(result.token);
        });
      } catch (error) {
        console.warn('Error in token retrieval:', error.message);
        resolve(null);
      }
    });
    
    if (!token) {
      const errorMessage = (translations[lang] && translations[lang].noToken) || 'No authentication token found';
      throw new Error(errorMessage);
    }
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = { method, headers };
  
  if (body) {
    const isFormData = method === 'POST' && (endpoint.includes('login') || endpoint.includes('register'));
    config.body = isFormData ? new URLSearchParams(body) : JSON.stringify(body);
    config.headers['Content-Type'] = isFormData 
      ? 'application/x-www-form-urlencoded' 
      : 'application/json';
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, config);
    
    // Log response for debugging
    console.log(`API Request: ${method} ${endpoint}`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    return response;
  } catch (error) {
    console.error(`API Request failed for ${endpoint}:`, error);
    throw error;
  }
}

// Load translations from external file if available
async function loadTranslations() {
  try {
    const response = await fetch(chrome.runtime.getURL('i18n.js'));
    if (response.ok) {
      const scriptContent = await response.text();
      // Extract translations object from file content
      const translationsText = scriptContent.replace('const translations = ', '').replace(/;$/, '');
      const translationsObj = JSON.parse(translationsText);
      
      // Merge with existing translations
      Object.assign(translations, translationsObj);
      console.log('External translations loaded successfully');
    }
  } catch (error) {
    console.warn('Could not load external translations, using defaults:', error);
  }
}

// Initialize translations on load
if (typeof chrome !== 'undefined' && chrome.runtime) {
  loadTranslations();
}