document.addEventListener('DOMContentLoaded', async () => {
  const resetPasswordScreen = document.getElementById('reset-password-screen');
  const backToLoginBtn = document.getElementById('back-to-login-btn');
  const emailInput = document.getElementById('email');
  const codeInput = document.getElementById('code');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const sendCodeBtn = document.getElementById('send-code-btn');
  const verifyCodeBtn = document.getElementById('verify-code-btn');
  const resendCodeBtn = document.getElementById('resend-code-btn');
  const updatePasswordBtn = document.getElementById('update-password-btn');
  const haveCodeBtn = document.getElementById('have-code-btn');
  const notificationBar = document.getElementById('notification-bar');
  const errorMessageDiv = document.getElementById('error-message');
  const successMessageDiv = document.getElementById('success-message');
  const loadingDiv = document.getElementById('loading');
  const step1Div = document.getElementById('step-1');
  const step2Div = document.getElementById('step-2');
  const step3Div = document.getElementById('step-3');
  let step = 1;
  let language = 'en'; // Default language

  // Initialize the page
  async function initialize() {
    try {
      // Fetch stored language
      const storedLanguage = await getStoredLanguage();
      if (storedLanguage) {
        language = storedLanguage;
      }

      // Apply language after determining it
      applyLanguage(language);
      document.documentElement.lang = language;
      showStep(step);
    } catch (error) {
      showError('Error initializing the page.');
    }
  }

  // Apply language direction and translations
  function applyLanguage(lang) {
    const isRTL = lang === 'ar';

    // Apply direction
    document.body.classList.remove('rtl', 'ltr');
    document.body.classList.add(isRTL ? 'rtl' : 'ltr');
    resetPasswordScreen.classList.remove('rtl', 'ltr');
    resetPasswordScreen.classList.add(isRTL ? 'rtl' : 'ltr');

    // Localize text
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = translations[lang][key] || key; // Fallback to key if translation missing
    });

    // Localize placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = translations[lang][key] || key; // Fallback to key if translation missing
    });

    // Localize tooltips
    document.querySelectorAll('[data-i18n-tooltip]').forEach(element => {
      const key = element.getAttribute('data-i18n-tooltip');
      element.setAttribute('title', translations[lang][key] || key); // Fallback to key if translation missing
    });
  }

  // Show notification bar
  function showNotification(message, isSuccess) {
    notificationBar.textContent = message;
    notificationBar.className = 'fixed top-0 left-0 w-full p-4 text-center text-white z-50';
    notificationBar.classList.remove('hidden');
    notificationBar.classList.add(isSuccess ? 'bg-green-500' : 'bg-red-500');
    setTimeout(() => {
      notificationBar.classList.add('hidden');
    }, 3000); // Hide after 3 seconds
  }

  await initialize();

  // Add event listener for Back to Login button
  backToLoginBtn.addEventListener('click', () => {
    window.location.href = chrome.runtime.getURL('login.html');
  });

  // Send reset code
  sendCodeBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showNotification(translations[language].invalidEmail, false);
      return;
    }

    // Store email in chrome.storage.local
    await new Promise((resolve) => chrome.storage.local.set({ resetEmail: email }, resolve));

    showLoading(true);
    clearMessages();

    try {
      const response = await apiRequest('password/send-code', 'POST', { email }, false, language);
      const data = await response.json();

      if (response.ok) {
        step = 2;
        showStep(step);
        showNotification(translations[language].codeSent, true);
      } else {
        showNotification(data.message || translations[language].failedToSendCode, false);
      }
    } catch (error) {
      showNotification(translations[language].error + ': ' + error.message, false);
    } finally {
      showLoading(false);
    }
  });

  // I Have Activation Code button
  haveCodeBtn.addEventListener('click', () => {
    const email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showNotification(translations[language].invalidEmail, false);
      return;
    }

    // Store email in chrome.storage.local
    chrome.storage.local.set({ resetEmail: email }, () => {
      step = 2;
      showStep(step);
    });
  });

  // Resend reset code
  resendCodeBtn.addEventListener('click', async () => {
    const storedEmail = await new Promise((resolve) =>
      chrome.storage.local.get(['resetEmail'], (r) => resolve(r.resetEmail))
    );

    if (!storedEmail) {
      showNotification(translations[language].invalidEmail, false);
      return;
    }

    showLoading(true);
    clearMessages();

    try {
      const response = await apiRequest('password/send-code', 'POST', { email: storedEmail }, false, language);
      const data = await response.json();

      if (response.ok) {
        showNotification(translations[language].codeResent, true);
      } else {
        showNotification(data.message || translations[language].failedToResendCode, false);
      }
    } catch (error) {
      showNotification(translations[language].error + ': ' + error.message, false);
    } finally {
      showLoading(false);
    }
  });

  // Verify code
  verifyCodeBtn.addEventListener('click', async () => {
    const storedEmail = await new Promise((resolve) =>
      chrome.storage.local.get(['resetEmail'], (r) => resolve(r.resetEmail))
    );
    const code = codeInput.value.trim();

    if (!storedEmail) {
      showNotification(translations[language].invalidEmail, false);
      return;
    }
    if (!code) {
      showNotification(translations[language].emptyCode, false);
      return;
    }

    showLoading(true);
    clearMessages();

    try {
      const response = await apiRequest('password/verify-code', 'POST', { email: storedEmail, code }, false, language);
      const data = await response.json();

      if (response.ok) {
        step = 3;
        showStep(step);
        showNotification(translations[language].codeVerified, true);
      } else {
        showNotification(data.message || translations[language].invalidCode, false);
      }
    } catch (error) {
      showNotification(translations[language].error + ': ' + error.message, false);
    } finally {
      showLoading(false);
    }
  });

  // Update password
  updatePasswordBtn.addEventListener('click', async () => {
    const storedEmail = await new Promise((resolve) =>
      chrome.storage.local.get(['resetEmail'], (r) => resolve(r.resetEmail))
    );
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!storedEmail) {
      showNotification(translations[language].invalidEmail, false);
      return;
    }
    if (password !== confirmPassword) {
      showNotification(translations[language].passwordsDoNotMatch, false);
      return;
    }
    if (password.length < 6) {
      showNotification(translations[language].passwordTooShort, false);
      return;
    }

    showLoading(true);
    clearMessages();

    try {
      const response = await apiRequest('password/update', 'POST', {
        email: storedEmail,
        password,
        password_confirmation: confirmPassword
      }, false, language);
      const data = await response.json();

      if (response.ok) {
        showNotification(translations[language].passwordUpdated, true);
        setTimeout(() => {
          window.location.href = chrome.runtime.getURL('login.html');
        }, 1000); // Redirect after 1 second
      } else {
        showNotification(data.message || translations[language].failedToUpdatePassword, false);
      }
    } catch (error) {
      showNotification(translations[language].error + ': ' + error.message, false);
    } finally {
      showLoading(false);
    }
  });

  function showStep(currentStep) {
    [step1Div, step2Div, step3Div].forEach(div => div.classList.add('hidden'));
    if (currentStep === 1) step1Div.classList.remove('hidden');
    if (currentStep === 2) step2Div.classList.remove('hidden');
    if (currentStep === 3) step3Div.classList.remove('hidden');
  }

  function showError(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.remove('hidden');
    successMessageDiv.classList.add('hidden');
  }

  function showSuccess(message) {
    successMessageDiv.textContent = message;
    successMessageDiv.classList.remove('hidden');
    errorMessageDiv.classList.add('hidden');
  }

  function clearMessages() {
    errorMessageDiv.classList.add('hidden');
    successMessageDiv.classList.add('hidden');
  }

  function showLoading(isLoading) {
    loadingDiv.classList.toggle('hidden', !isLoading);
  }
});