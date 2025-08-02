// State variables
let language = 'en'; // Default language

// DOM elements
const elements = {
  registerScreen: document.getElementById('register-screen'),
  formTitle: document.getElementById('form-title'),
  nameInput: document.getElementById('name-input'),
  emailInput: document.getElementById('email-input'),
  passwordInput: document.getElementById('password-input'),
  confirmPasswordInput: document.getElementById('confirm-password-input'),
  submitBtn: document.getElementById('submit-btn'),
  switchToLogin: document.getElementById('switch-to-login'),
  languageToggleBtn: document.getElementById('language-toggle-btn'),
  languageDropdown: document.getElementById('language-dropdown'),
  messageBar: document.getElementById('message-bar'),
  messageText: document.getElementById('message-text')
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  await initialize();
});

// Main initialization function
async function initialize() {
  try {
    // Check if user is already logged in
    const token = await new Promise(resolve => chrome.storage.local.get(['token'], r => resolve(r.token)));
    if (token) {
      window.location.href = chrome.runtime.getURL('popup.html');
      return;
    }

    // Fetch stored language
    const storedLanguage = await getStoredLanguage();
    if (storedLanguage) {
      language = storedLanguage;
    }

    // Apply language after determining it
    applyLanguage(language);
    document.documentElement.lang = language;
    setupEventListeners();
  } catch (error) {
    showMessage('error', 'Error initializing the page.');
  }
}

// Setup event listeners
function setupEventListeners() {
  elements.submitBtn.addEventListener('click', handleSubmit);
  elements.switchToLogin.addEventListener('click', () => {
    window.location.href = chrome.runtime.getURL('login.html');
  });

  // Language toggle button
  elements.languageToggleBtn.addEventListener('click', () => {
    elements.languageDropdown.classList.toggle('hidden');
  });

  // Language selection
  document.querySelectorAll('#language-dropdown button').forEach(button => {
    button.addEventListener('click', () => {
      language = button.getAttribute('data-lang');
      chrome.storage.local.set({ language: language }, () => {
        console.log('Language updated to:', language);
      });
      elements.languageDropdown.classList.add('hidden');
      applyLanguage(language);
      document.documentElement.lang = language;
    });
  });

  // Close dropdown if clicked outside
  document.addEventListener('click', (e) => {
    if (!elements.languageToggleBtn.contains(e.target) && !elements.languageDropdown.contains(e.target)) {
      elements.languageDropdown.classList.add('hidden');
    }
  });
}

// Handle form submission
async function handleSubmit() {
  const name = elements.nameInput.value.trim();
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value.trim();
  const confirmPassword = elements.confirmPasswordInput.value.trim();

  if (!name || !email || !password || !confirmPassword) {
    showMessage('error', !name ? translations[language].nameRequired : 'Please fill in all required fields.');
    return;
  }

  if (password !== confirmPassword) {
    showMessage('error', translations[language].passwordsDoNotMatch);
    return;
  }

  try {
    await register(name, email, password, language);
  } catch (error) {
    showMessage('error', translations[language].errorRegistering);
  }
}

// Register function
async function register(name, email, password, language) {
  try {
    const response = await apiRequest('register', 'POST', { name, email, password, language }, false, language);
    const data = await response.json();
    
    // Check the status from the response
    if (data.status === 'success' && response.ok) {
      showMessage('success', data.message || 'Registration successful! Please check your email for verification.');
      setTimeout(() => {
        window.location.href = chrome.runtime.getURL('login.html');
      }, 3000);
    } else {
      showMessage('error', data.message || translations[language].errorRegistering);
      throw new Error(data.message || translations[language].errorRegistering);
    }
  } catch (error) {
    showMessage('error', error.message || translations[language].errorRegistering);
  }
}

// Redirect to main page
function redirectToMain() {
  try {
    window.location.href = chrome.runtime.getURL('popup.html');
  } catch (error) {
    showMessage('error', translations[language].navigationError);
  }
}

// Show message in a bar
function showMessage(status, message) {
  console.log(`${status}: ${message}`);
  elements.messageText.textContent = message;
  elements.messageBar.classList.remove('hidden', 'bg-red-500', 'bg-green-500');
  elements.messageBar.classList.add(status === 'success' ? 'bg-green-500' : 'bg-red-500');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.messageBar.classList.add('hidden');
  }, 5000);
}