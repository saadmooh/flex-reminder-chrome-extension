const VAPID_PUBLIC_KEY = 'BOl9XeqWHMkSSjNM_1OnrsKbklmG6y6SKysfNuf5yRJd3FVxhzRikb8FwkXJqUCtOgzXVIE3ctgAB7Rz0Irn9SQ';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

async function createPushSubscription() {
  try {
    // 🔧 تسجيل Service Worker (إن لم يكن مسجلاً)
    const reg = await navigator.serviceWorker.register('sw.js'); // اسم الملف الذي سنضيفه لاحقًا
    const registration = await navigator.serviceWorker.ready;

    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('✅ Existing subscription:', existingSubscription);
      sendSubscriptionToBackground(existingSubscription);
      return;
    }

    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    console.log('✅ New subscription:', newSubscription);
    sendSubscriptionToBackground(newSubscription);

  } catch (err) {
    console.error('❌ Failed to create push subscription in offscreen.js:', err);
  }
}

function sendSubscriptionToBackground(subscription) {
  chrome.runtime.sendMessage({
    type: 'pushSubscriptionCreated',
    subscription: subscription.toJSON()
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'createPushSubscription') {
    createPushSubscription().then(() => sendResponse({ success: true }));
    return true;
  }
});
