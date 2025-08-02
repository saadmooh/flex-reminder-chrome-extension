// sw.js
self.addEventListener('push', function (event) {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Flex Reminder';
    const options = {
      body: data.body || 'You have a new reminder!',
      icon: 'icon128.png',
    };
   console.log('Notification data:', data); // Debugging
    // Show the notificatio
    event.waitUntil(self.registration.showNotification(title, options));
  });
  