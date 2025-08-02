const API_BASE_URL = 'https://flexreminder.com/api';
const API_PASSWORD = 'api_password_app';

// Translation dictionary for English and Arabic
const translations = {
  en: {
    manageSubscription: 'Manage Subscription',
    back: 'Back',
    subscriptionStatus: 'Subscription Status',
    currentSubscription: 'Current Subscription',
    availablePlans: 'Available Plans',
    youAreSubscribed: 'You are subscribed.',
    renewsAt: 'Renews at: {{date}}',
    subscriptionPaused: 'Your subscription is paused.',
    restoreBy: 'Restore by: {{date}}',
    notSubscribed: 'You are not subscribed.',
    status: 'Status: {{status}}',
    unnamedPlan: 'Unnamed Plan',
    noDescriptionAvailable: 'No description available.',
    advancedFeatures: 'Advanced Features: {{status}}',
    yes: 'Yes',
    no: 'No',
    price: 'Price: {{price}}',
    duration: 'Duration: {{duration}}',
    savePercent: 'Save {{percent}}%',
    subscribe: 'Subscribe',
    changePlan: 'Change Plan',
    currentPlan: 'Current Plan',
    confirmAction: 'Confirm Action',
    confirmSubscription: 'Are you sure you want to subscribe to {{plan}}?',
    cancel: 'Cancel',
    confirm: 'Confirm',
    pausePlan: 'Pause Plan',
    cancelPlan: 'Cancel Plan',
    resumePlan: 'Resume Plan',
    subscriptionPausedSuccessfully: 'Subscription paused successfully.',
    subscriptionCancelledSuccessfully: 'Subscription cancelled successfully.',
    subscriptionResumedSuccessfully: 'Subscription resumed successfully.',
    planChangedSuccessfully: 'Plan changed successfully.',
    errorLoadingInitialData: 'Error loading initial data.',
    errorLoadingSubscriptionData: 'Error loading subscription data.',
    errorLoadingCustomerPortal: 'Error loading customer portal.',
    errorPausingSubscription: 'Error pausing subscription.',
    errorCancellingSubscription: 'Error cancelling subscription.',
    errorResumingSubscription: 'Error resuming subscription.',
    errorPerformingAction: 'Error performing action.',
    noPlansAvailable: 'No plans available.',
    navigationError: 'Failed to return to reminders. Please try reopening the extension.',
    settings: 'Settings'
  },
  ar: {
    manageSubscription: 'إدارة الاشتراك',
    back: 'رجوع',
    subscriptionStatus: 'حالة الاشتراك',
    currentSubscription: 'الاشتراك الحالي',
    availablePlans: 'الخطط المتاحة',
    youAreSubscribed: 'أنت مشترك.',
    renewsAt: 'يجدد في: {{date}}',
    subscriptionPaused: 'اشتراكك متوقف.',
    restoreBy: 'استعادة بحلول: {{date}}',
    notSubscribed: 'لست مشتركًا.',
    status: 'الحالة: {{status}}',
    unnamedPlan: 'خطة بدون اسم',
    noDescriptionAvailable: 'لا يوجد وصف متاح.',
    advancedFeatures: 'الميزات المتقدمة: {{status}}',
    yes: 'نعم',
    no: 'لا',
    price: 'السعر: {{price}}',
    duration: 'المدة: {{duration}}',
    savePercent: 'وفر {{percent}}%',
    subscribe: 'اشترك',
    changePlan: 'تغيير الخطة',
    currentPlan: 'الخطة الحالية',
    confirmAction: 'تأكيد الإجراء',
    confirmSubscription: 'هل أنت متأكد من الاشتراك في {{plan}}؟',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    pausePlan: 'إيقاف الخطة',
    cancelPlan: 'إلغاء الخطة',
    resumePlan: 'استئناف الخطة',
    subscriptionPausedSuccessfully: 'تم إيقاف الاشتراك بنجاح.',
    subscriptionCancelledSuccessfully: 'تم إلغاء الاشتراك بنجاح.',
    subscriptionResumedSuccessfully: 'تم استئناف الاشتراك بنجاح.',
    planChangedSuccessfully: 'تم تغيير الخطة بنجاح.',
    errorLoadingInitialData: 'خطأ في تحميل البيانات الأولية.',
    errorLoadingSubscriptionData: 'خطأ في تحميل بيانات الاشتراك.',
    errorLoadingCustomerPortal: 'خطأ في تحميل بوابة العميل.',
    errorPausingSubscription: 'خطأ في إيقاف الاشتراك.',
    errorCancellingSubscription: 'خطأ في إلغاء الاشتراك.',
    errorResumingSubscription: 'خطأ في استئناف الاشتراك.',
    errorPerformingAction: 'خطأ في تنفيذ الإجراء.',
    noPlansAvailable: 'لا توجد خطط متاحة.',
    navigationError: 'فشل في العودة إلى التذكيرات. يرجى إعادة فتح الإضافة.',
    settings: 'الإعدادات'
  }
};

// State variables
let language = 'en';
let subscriptionData = null;
let customerPortalUrl = null;
let billingProvider = 'lemon_squeezy';
let isLoading = true;
let error = null;

// DOM elements
const elements = {
  subscriptionsScreen: document.getElementById('subscriptions-screen'),
  statusMessage: document.getElementById('status-message'),
  currentSubscriptionSection: document.querySelector('.current-subscription'),
  currentSubscriptionCard: document.getElementById('current-subscription-card'),
  plansList: document.getElementById('plans-list'),
  manageSubscriptionBtn: document.getElementById('manage-subscription-btn'),
  backBtn: document.getElementById('back-btn')
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  await initialize();
});

// Main initialization function
async function initialize() {
  try {
    await applyLanguage();
    setupEventListeners();
    await loadInitialData();
  } catch (error) {
    showError(error, translations[language].errorLoadingInitialData);
  }
}

// Fetch user language from /user endpoint
async function fetchUserLanguage() {
  try {
    const response = await apiRequest('user', 'GET');
    const data = await response.json();
    if (response.ok && data.language) {
      return data.language; // 'ar' or 'en'
    }
    return 'en'; // Fallback to English
  } catch (error) {
    console.error('Error fetching user language:', error);
    return 'en'; // Fallback to English
  }
}

// Apply language and direction
async function applyLanguage() {
  language = await fetchUserLanguage();
  const isRTL = language === 'ar';

  // Apply direction
  elements.subscriptionsScreen.classList.add(isRTL ? 'rtl' : 'ltr');

  // Localize text
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = translations[language][key];
  });
}

// Setup event listeners
function setupEventListeners() {
  // Back button
  elements.backBtn.addEventListener('click', () => {
    try {
      window.location.href = chrome.runtime.getURL('popup.html');
    } catch (error) {
      showError(error, translations[language].navigationError);
    }
  });

  // Manage subscription button
  elements.manageSubscriptionBtn.addEventListener('click', () => {
    if (customerPortalUrl) {
      chrome.tabs.create({ url: customerPortalUrl, active: true });
    } else {
      showError(null, translations[language].errorLoadingCustomerPortal);
    }
  });
}

// Load initial subscription data and customer portal URL
async function loadInitialData() {
  try {
    isLoading = true;
    await Promise.all([
      loadSubscriptionData(),
      loadCustomerPortalUrl()
    ]);
    updateUI();
  } catch (error) {
    showError(error, translations[language].errorLoadingInitialData);
  } finally {
    isLoading = false;
  }
}

// Load subscription data
async function loadSubscriptionData() {
  const response = await apiRequest('subscription/check', 'GET');
  const data = await response.json();
  if (response.ok) {
    subscriptionData = data;
    billingProvider = data.billing_provider || 'lemon_squeezy';
  } else {
    throw new Error(data.message || translations[language].errorLoadingSubscriptionData);
  }
}

// Load customer portal URL
async function loadCustomerPortalUrl() {
  const response = await apiRequest('customer-portal-url', 'GET');
  const data = await response.json();
  if (response.ok && data.status === 'success') {
    customerPortalUrl = data.customer_portal_url;
    elements.manageSubscriptionBtn.classList.remove('hidden');
  } else {
    throw new Error(data.message || translations[language].errorLoadingCustomerPortal);
  }
}

// Check subscription status
function isSubscribed() {
  return subscriptionData && subscriptionData.subscribed && subscriptionData.subscription;
}

function isPaused() {
  if (!subscriptionData || !subscriptionData.subscription) return false;
  if (billingProvider === 'lemon_squeezy') {
    return subscriptionData.subscription.status === 'paused';
  } else {
    return (
      subscriptionData.subscription.status === 'cancelled' &&
      subscriptionData.subscription.is_on_grace_period
    );
  }
}

function isSubscriptionInactive() {
  if (!subscriptionData || !subscriptionData.subscription) return true;
  if (billingProvider === 'lemon_squeezy') {
    return (
      subscriptionData.subscription.status === 'paused' ||
      subscriptionData.subscription.status === 'cancelled' ||
      (subscriptionData.subscription.ends_at &&
        new Date(subscriptionData.subscription.ends_at) < new Date())
    );
  } else {
    return (
      subscriptionData.subscription.status === 'cancelled' &&
      !subscriptionData.subscription.is_on_grace_period
    );
  }
}

// Update UI based on subscription data
function updateUI() {
  if (isLoading) {
    elements.statusMessage.innerHTML = '<p>Loading...</p>';
    return;
  }

  if (error) {
    elements.statusMessage.innerHTML = `<p style="color: red;">${error}</p>`;
    return;
  }

  // Subscription Status
  let message = '';
  let statusClass = '';
  if (isSubscribed()) {
    message = translations[language].youAreSubscribed;
    statusClass = 'active';
    if (subscriptionData.subscription.renews_at) {
      const renewsAt = new Date(subscriptionData.subscription.renews_at).toLocaleDateString();
      message += `<br>${translations[language].renewsAt.replace('{{date}}', renewsAt)}`;
    }
  } else if (isPaused()) {
    message = translations[language].subscriptionPaused;
    statusClass = 'paused';
    if (
      billingProvider === 'polar' &&
      subscriptionData.subscription.current_period_end
    ) {
      const gracePeriodEnd = new Date(
        subscriptionData.subscription.current_period_end
      ).toLocaleDateString();
      message += `<br>${translations[language].restoreBy.replace('{{date}}', gracePeriodEnd)}`;
    }
  } else {
    message = translations[language].notSubscribed;
    statusClass = 'inactive';
  }
  elements.statusMessage.innerHTML = `<p class="${statusClass}">${message}</p>`;

  // Current Subscription
  if (isSubscribed() && !isSubscriptionInactive()) {
    elements.currentSubscriptionSection.classList.remove('hidden');
    const plan = subscriptionData.subscription.plan || {};
    const renewsAt = subscriptionData.subscription.renews_at
      ? new Date(subscriptionData.subscription.renews_at).toLocaleDateString()
      : subscriptionData.subscription.current_period_end
      ? new Date(subscriptionData.subscription.current_period_end).toLocaleDateString()
      : null;
    elements.currentSubscriptionCard.innerHTML = `
      <h4>${plan.name || translations[language].unnamedPlan}</h4>
      <p>${translations[language].status.replace('{{status}}', subscriptionData.subscription.status.toUpperCase())}</p>
      ${renewsAt ? `<p>${translations[language].renewsAt.replace('{{date}}', renewsAt)}</p>` : ''}
    `;
    elements.currentSubscriptionCard.onclick = () => showPlanModal(subscriptionData.subscription);

    // Add subscription menu
    const menu = document.createElement('div');
    menu.className = 'subscription-menu';
    menu.innerHTML = `
      <button class="menu-btn bg-black text-white px-2 py-1 rounded-lg">${translations[language].settings}</button>
      <div class="menu-content hidden">
        ${
          billingProvider === 'polar' && isPaused()
            ? `<button class="resume-btn">${translations[language].resumePlan}</button>
               <button class="cancel-btn">${translations[language].cancelPlan}</button>`
            : billingProvider === 'lemon_squeezy' && isPaused()
            ? `<button class="resume-btn">${translations[language].resumePlan}</button>
               <button class="cancel-btn">${translations[language].cancelPlan}</button>`
            : `
               ${billingProvider !== 'polar' ? `<button class="pause-btn">${translations[language].pausePlan}</button>` : ''}
               <button class="cancel-btn">${translations[language].cancelPlan}</button>
              `
        }
      </div>
    `;
    elements.currentSubscriptionCard.appendChild(menu);
    menu.querySelector('.menu-btn').addEventListener('click', () => {
      menu.querySelector('.menu-content').classList.toggle('hidden');
    });
    menu.querySelectorAll('.pause-btn').forEach(btn => btn.addEventListener('click', pauseSubscription));
    menu.querySelectorAll('.cancel-btn').forEach(btn => btn.addEventListener('click', cancelSubscription));
    menu.querySelectorAll('.resume-btn').forEach(btn => btn.addEventListener('click', resumeSubscription));
  } else {
    elements.currentSubscriptionSection.classList.add('hidden');
  }

  // Available Plans
  elements.plansList.innerHTML = '';
  if (subscriptionData && subscriptionData.plans && subscriptionData.plans.length > 0) {
    subscriptionData.plans.forEach(plan => {
      const planCard = document.createElement('div');
      planCard.className = 'plan-card';
      const discount = plan.discount || 0;
      planCard.innerHTML = `
        <h4>${plan.name || translations[language].unnamedPlan}</h4>
        <p>${plan.description || translations[language].noDescriptionAvailable}</p>
        <p>${translations[language].advancedFeatures.replace('{{status}}', plan.has_advanced_features ? translations[language].yes : translations[language].no)}</p>
        ${discount > 0 ? `<p class="discount">${translations[language].savePercent.replace('{{percent}}', discount)}</p>` : ''}
      `;
      planCard.onclick = () => showPlanModal(plan);
      elements.plansList.appendChild(planCard);
    });
  } else {
    elements.plansList.innerHTML = `<p>${translations[language].noPlansAvailable}</p>`;
  }
}

// Pause subscription
async function pauseSubscription() {
  try {
    isLoading = true;
    const response = await apiRequest('subscription/pause', 'POST');
    const data = await response.json();
    if (response.ok) {
      await Promise.all([loadSubscriptionData(), loadCustomerPortalUrl()]);
      alert(translations[language].subscriptionPausedSuccessfully);
    } else {
      throw new Error(data.message || translations[language].errorPausingSubscription);
    }
  } catch (error) {
    showError(error, translations[language].errorPausingSubscription);
  } finally {
    isLoading = false;
    updateUI();
  }
}

// Cancel subscription
async function cancelSubscription() {
  try {
    isLoading = true;
    const response = await apiRequest('subscription/cancel', 'POST');
    const data = await response.json();
    if (response.ok) {
      await Promise.all([loadSubscriptionData(), loadCustomerPortalUrl()]);
      let message = translations[language].subscriptionCancelledSuccessfully;
      if (
        billingProvider === 'polar' &&
        subscriptionData.subscription.current_period_end
      ) {
        const gracePeriodEnd = new Date(
          subscriptionData.subscription.current_period_end
        ).toLocaleDateString();
        message += `\n${translations[language].restoreBy.replace('{{date}}', gracePeriodEnd)}`;
      }
      alert(message);
    } else {
      throw new Error(data.message || translations[language].errorCancellingSubscription);
    }
  } catch (error) {
    showError(error, translations[language].errorCancellingSubscription);
  } finally {
    isLoading = false;
    updateUI();
  }
}

// Resume subscription
async function resumeSubscription() {
  try {
    isLoading = true;
    const response = await apiRequest('subscription/resume', 'POST');
    const data = await response.json();
    if (response.ok) {
      await Promise.all([loadSubscriptionData(), loadCustomerPortalUrl()]);
      let message = translations[language].subscriptionResumedSuccessfully;
      if (subscriptionData.subscription.renews_at) {
        const renewsAt = new Date(
          subscriptionData.subscription.renews_at
        ).toLocaleDateString();
        message += `\n${translations[language].renewsAt.replace('{{date}}', renewsAt)}`;
      }
      alert(message);
    } else {
      throw new Error(data.message || translations[language].errorResumingSubscription);
    }
  } catch (error) {
    showError(error, translations[language].errorResumingSubscription);
  } finally {
    isLoading = false;
    updateUI();
  }
}

// Show plan modal
function showPlanModal(planData) {
  const isUserSubscribed = isSubscribed();
  const isPausedSubscription = isPaused();
  const isCurrentSubscription = planData.status !== undefined;
  const planName = isCurrentSubscription
    ? planData.plan?.name || translations[language].unnamedPlan
    : planData.name || translations[language].unnamedPlan;
  const planDescription = isCurrentSubscription
    ? planData.plan?.description || translations[language].noDescriptionAvailable
    : planData.description || translations[language].noDescriptionAvailable;
  const hasAdvancedFeatures = isCurrentSubscription
    ? planData.plan?.has_advanced_features
    : planData.has_advanced_features;
  const variants = planData.variants || (planData.checkout_data ? [planData] : []);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>${planName}</h3>
      ${isCurrentSubscription ? `<p>${translations[language].status.replace('{{status}}', planData.status.toUpperCase())}</p>` : ''}
      <p>${planDescription}</p>
      <p>${translations[language].advancedFeatures.replace('{{status}}', hasAdvancedFeatures ? translations[language].yes : translations[language].no)}</p>
      ${variants
        .map(variant => {
          const price = variant.price ? variant.price.toFixed(2) : null;
          const duration = variant.duration || null;
          const subscriptionId = variant.checkout_data?.subscription_id || variant.subscription_id;
          const isCurrentVariant =
            isUserSubscribed &&
            planData.plan?.id === subscriptionData.subscription.plan.id &&
            variant.id === subscriptionData.subscription.variant_id;
          return `
            <div>
              <p><strong>${variant.name || translations[language].unnamedPlan}</strong></p>
              ${price ? `<p>${translations[language].price.replace('{{price}}', `$${price}`)}</p>` : ''}
              ${duration ? `<p>${translations[language].duration.replace('{{duration}}', duration)}</p>` : ''}
              ${
                subscriptionId
                  ? `<button class="${
                      isCurrentVariant ? 'current-plan-btn' : isUserSubscribed && !isSubscriptionInactive() ? 'change-plan-btn' : 'subscribe-btn'
                    }" ${isCurrentVariant ? 'disabled' : ''}>${
                      isCurrentVariant
                        ? translations[language].currentPlan
                        : isUserSubscribed && !isSubscriptionInactive()
                        ? translations[language].changePlan
                        : translations[language].subscribe
                    }</button>`
                  : ''
              }
            </div>
          `;
        })
        .join('')}
      <button class="close-btn">${translations[language].cancel}</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelectorAll('.subscribe-btn, .change-plan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const subscriptionId = variants.find(v => v.checkout_data?.subscription_id || v.subscription_id)?.subscription_id;
      if (!subscriptionId) return;
      showConfirmDialog(
        translations[language].confirmSubscription.replace('{{plan}}', planName),
        async () => {
          try {
            isLoading = true;
            modal.remove();
            if (isUserSubscribed && !isSubscriptionInactive()) {
              const response = await apiRequest('subscription/swap', 'POST', { subscription_id: subscriptionId });
              const data = await response.json();
              if (response.ok) {
                alert(translations[language].planChangedSuccessfully);
              } else {
                throw new Error(data.message || translations[language].errorPerformingAction);
              }
            } else {
              const response = await apiRequest('subscription/buy', 'POST', { subscription_id: subscriptionId });
              const data = await response.json();
              if (response.ok && data.checkout_url) {
                chrome.tabs.create({
                  url: data.checkout_url,
                  active: true,
                });
              } else {
                throw new Error(data.message || translations[language].errorPerformingAction);
              }
            }
            await Promise.all([loadSubscriptionData(), loadCustomerPortalUrl()]);
          } catch (error) {
            showError(error, translations[language].errorPerformingAction);
          } finally {
            isLoading = false;
            updateUI();
          }
        }
      );
    });
  });

  modal.querySelector('.close-btn').addEventListener('click', () => {
    modal.remove();
  });
}

// Show confirmation dialog
function showConfirmDialog(message, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>${translations[language].confirmAction}</h3>
      <p>${message}</p>
      <button class="confirm-btn bg-black text-white px-2 py-1 rounded-lg">${translations[language].confirm}</button>
      <button class="close-btn">${translations[language].cancel}</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.confirm-btn').addEventListener('click', () => {
    modal.remove();
    onConfirm();
  });

  modal.querySelector('.close-btn').addEventListener('click', () => {
    modal.remove();
  });
}

// Show error message
function showError(error, message) {
  console.error('Error:', error);
  alert(`${message}${error ? ': ' + error.message : ''}`);
  if (error && error.message.includes('401')) {
    chrome.storage.local.remove('token', () => {
      window.location.href = chrome.runtime.getURL('popup.html');
    });
  }
}

// API request helper
async function apiRequest(endpoint, method, body = null) {
  const headers = {
    'X-API-Password': API_PASSWORD,
    'Accept': 'application/json',
  };
  const token = await new Promise(resolve => chrome.storage.local.get(['token'], r => resolve(r.token)));
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { method, headers };
  if (body) {
    config.body = JSON.stringify(body);
    config.headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_BASE_URL}/${endpoint}`, config);
}