// State variables
let language = 'en'; // Default language

// DOM elements
const elements = {
  loginScreen: document.getElementById('login-screen'),
  formTitle: document.getElementById('form-title'),
  emailInput: document.getElementById('email-input'),
  passwordInput: document.getElementById('password-input'),
  submitBtn: document.getElementById('submit-btn'),
  switchToRegister: document.getElementById('switch-to-register'),
  forgotPasswordBtn: document.getElementById('forgot-password-btn'),
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
    console.log(token);
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
  elements.forgotPasswordBtn.addEventListener('click', () => {
    window.location.href = chrome.runtime.getURL('reset_password.html');
  });
  elements.switchToRegister.addEventListener('click', () => {
    window.location.href = chrome.runtime.getURL('register.html');
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
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value.trim();

  if (!email || !password) {
    showMessage('error', translations[language].email + ' ' + translations[language].password + ' ' + 'are required.');
    return;
  }

  // سجل الدخول
  const success = await loginUser(email, password);

  // إذا نجح تسجيل الدخول، اشترك في Web Push
  if (success) {
    await subscribeToPush();
    redirectToMain() ;
  }
  
}

// ✅ تسجيل الدخول
async function loginUser(email, password) {
  try {
    const response = await apiRequest('login', 'POST', { email, password, device_name: 'browser_extension' }, false, language);
    const data = await response.json();

    if (data.status === 'success' && data.access_token) {
      showMessage('success', 'Login successful! Redirecting...');
      await chrome.storage.local.set({ token: data.access_token });
      return true;
    } else {
      showMessage('error', data.message || translations[language].errorLoggingIn);
      return false;
    }
  } catch (error) {
    showMessage('error', error.message || translations[language].errorLoggingIn);
    return false;
  }
}

// ✅ الاشتراك في Web Push
async function subscribeToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;

    const existingSub = await registration.pushManager.getSubscription();
    let subscription = existingSub;

    if (!existingSub) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array("BOl9XeqWHMkSSjNM_1OnrsKbklmG6y6SKysfNuf5yRJd3FVxhzRikb8FwkXJqUCtOgzXVIE3ctgAB7Rz0Irn9SQ")
      });
    }

    const body = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.getKey('p256dh') ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))) : null,
        auth: subscription.getKey('auth') ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')))) : null
      },
      contentEncoding: 'aes128gcm'
    };

    const pushResponse = await apiRequest('push-subscriptions', 'POST', body, true, language);
    const result = await pushResponse.json();

    if (result.success) {
      console.log("✅ Push subscription sent to server.");
    } else {
      console.warn("⚠️ Failed to send push subscription:", result);
    }
  } catch (error) {
    console.error("❌ Error in push subscription:", error);
  }
}

// ⚙️ تحويل المفتاح العام
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
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