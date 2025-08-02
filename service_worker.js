const API_BASE_URL = 'https://flexreminder.com/api';
const API_PASSWORD = 'api_password_app';

// تعريف المتغيرات العالمية
const translations = {};

// ✅ الاستماع لحدث الدفع (push)
self.addEventListener('push', function(event) {
  if (event.data) {
    const payload = event.data.json();
    console.log('Service Worker: Push received with payload:', payload);

    // التحقق من نوع الإشعار حسب الـ title
    if (payload.title === 'update' && payload.data && payload.data.post_id) {
      // إشعار تحديث - الحصول على بيانات التذكير من الخادم
      console.log('Service Worker: Processing update notification for post_id:', payload.data.post_id);
      event.waitUntil(handleUpdateNotification(payload));
    } else if (payload.title === 'delete' && payload.data && payload.data.post_id) {
      // إشعار حذف - حذف التذكير من القائمة المخزنة
      console.log('Service Worker: Processing delete notification for post_id:', payload.data.post_id);
      event.waitUntil(handleDeleteNotification(payload));
    } else if (payload.data && payload.data.data) {
      // الطريقة القديمة - للتوافق مع النظام القديم
      const updatedReminder = payload.data.data;
      console.log('Service Worker: Updating reminder data (legacy format):', updatedReminder);
      event.waitUntil(updateStoredReminderData(updatedReminder, payload));
    }

    // عرض الإشعار (اختياري)
    const title = payload.title || 'New Notification';
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/icons/icon-128.png',
      badge: payload.badge || '/icons/badge-72.png',
      data: payload.url || '/',
      actions: payload.actions || []
    };

    event.waitUntil(
      (async () => {
        console.log('Service Worker: Push notification processed');
        console.log('Service Worker: Title:', title);
        console.log('Service Worker: Body:', options.body);
        console.log('Service Worker: URL/Data:', options.data);
        // يمكن عرض الإشعار هنا إذا لزم الأمر
        // return self.registration.showNotification(title, options);
      })()
    );
    
  } else {
    console.warn('Push event received with no data');
  }
});

// دالة لمعالجة إشعار التحديث
async function handleUpdateNotification(payload) {
  try {
    console.log('Service Worker: Handling update notification for post_id:', payload.data.post_id);
    
    // الحصول على token من التخزين المحلي
    const { token } = await new Promise((resolve) => {
      chrome.storage.local.get(['token'], resolve);
    });

    if (!token) {
      console.error('Service Worker: No token found, cannot fetch reminder details');
      return;
    }

    // استدعاء API للحصول على بيانات التذكير
    console.log('Service Worker: Fetching reminder details from API');
    const response = await fetch(`${API_BASE_URL}/reminderById?id=${payload.data.post_id}`, {
      headers: {
        'X-API-Password': API_PASSWORD,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Service Worker: Failed to fetch reminder details:', response.status);
      if (response.status === 401) {
        console.warn('Service Worker: Token expired, clearing token');
        chrome.storage.local.remove(['token']);
      }
      return;
    }

    const data = await response.json();
    console.log('Service Worker: API response:', data);

    if (data.success && data.reminder) {
      // تحديث القائمة المخزنة بالبيانات الجديدة
      await updateStoredReminderFromAPI(data.reminder, payload);
    } else {
      console.error('Service Worker: Invalid API response:', data.message || 'Unknown error');
    }

  } catch (error) {
    console.error('Service Worker: Error handling update notification:', error);
  }
}

// دالة لمعالجة إشعار الحذف
async function handleDeleteNotification(payload) {
  try {
    console.log('Service Worker: Handling delete notification for post_id:', payload.data.post_id);
    
    // الحصول على التذكيرات المجدولة الحالية
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['scheduledReminders'], resolve);
    });
    
    const reminders = result.scheduledReminders || [];
    console.log('Service Worker: Current scheduled reminders count:', reminders.length);
    
    // العثور على التذكير المراد حذفه
    const reminderIndex = reminders.findIndex(r => r.id === payload.data.post_id);
    
    if (reminderIndex >= 0) {
      const deletedReminder = reminders[reminderIndex];
      console.log('Service Worker: Found reminder to delete:', deletedReminder.id);
      
      // حذف التذكير من القائمة
      reminders.splice(reminderIndex, 1);
      
      // مسح المنبه المرتبط بالتذكير
      chrome.alarms.clear(`reminder-${payload.data.post_id}`, (wasCleared) => {
        console.log(`Service Worker: Alarm for reminder-${payload.data.post_id} ${wasCleared ? 'was cleared' : 'did not exist'}`);
      });
      
      // حفظ القائمة المحدثة
      await new Promise((resolve) => {
        chrome.storage.local.set({ scheduledReminders: reminders }, () => {
          console.log('Service Worker: Updated scheduled reminders after deletion, new count:', reminders.length);
          resolve();
        });
      });
      
      // إرسال رسالة للصفحات المفتوحة لتحديث واجهة المستخدم
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach(client => {
          client.postMessage({
            type: 'REMINDER_DELETED',
            reminderId: payload.data.post_id,
            pushPayload: payload
          });
        });
        console.log('Service Worker: Notified clients about reminder deletion');
      } catch (error) {
        console.error('Service Worker: Error notifying clients about deletion:', error);
      }
      
    } else {
      console.log('Service Worker: Reminder not found in scheduled reminders:', payload.data.post_id);
    }
    
  } catch (error) {
    console.error('Service Worker: Error handling delete notification:', error);
  }
}

// دالة لتحديث القائمة المخزنة باستخدام بيانات من API
async function updateStoredReminderFromAPI(apiReminder, payload) {
  try {
    console.log('Service Worker: Updating stored reminder from API data:', apiReminder.id);
    
    // الحصول على التذكيرات المجدولة الحالية
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['scheduledReminders'], resolve);
    });
    
    const reminders = result.scheduledReminders || [];
    console.log('Service Worker: Current scheduled reminders count:', reminders.length);
    
    // تحويل بيانات API إلى التنسيق المطلوب
    const reminderData = {
      id: apiReminder.id,
      url: apiReminder.url,
      title: apiReminder.title,
      nextReminderTime: apiReminder.next_reminder_time,
      importance: apiReminder.importance,
      importance_ar: apiReminder.importance_ar,
      content: apiReminder.content,
      image_url: apiReminder.image_url,
      is_opened: apiReminder.is_opened,
      scheduled_times: apiReminder.scheduled_times
    };
    
    // البحث عن التذكير المطابق وتحديثه
    const existingIndex = reminders.findIndex(r => r.id === apiReminder.id);
    
    if (existingIndex >= 0) {
      // تحديث التذكير الموجود
      const oldReminder = reminders[existingIndex];
      reminders[existingIndex] = {
        ...oldReminder,
        ...reminderData
      };
      
      console.log('Service Worker: Updated existing reminder:', apiReminder.id);
      console.log('Service Worker: Old next reminder time:', oldReminder.nextReminderTime);
      console.log('Service Worker: New next reminder time:', apiReminder.next_reminder_time);
      
      // إعادة جدولة المنبه إذا تغير الوقت
      if (oldReminder.nextReminderTime !== apiReminder.next_reminder_time) {
        await rescheduleAlarm(reminderData);
      }
      
    } else {
      // إضافة تذكير جديد
      reminders.push(reminderData);
      console.log('Service Worker: Added new reminder:', apiReminder.id);
      
      // جدولة منبه جديد
      await rescheduleAlarm(reminderData);
    }
    
    // حفظ التذكيرات المحدثة
    await new Promise((resolve) => {
      chrome.storage.local.set({ scheduledReminders: reminders }, () => {
        console.log('Service Worker: Updated scheduled reminders saved to storage');
        resolve();
      });
    });
    
    // إرسال رسالة للصفحات المفتوحة لتحديث واجهة المستخدم
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach(client => {
        client.postMessage({
          type: 'REMINDER_UPDATED',
          reminder: reminderData,
          pushPayload: payload
        });
      });
      console.log('Service Worker: Notified clients about reminder update');
    } catch (error) {
      console.error('Service Worker: Error notifying clients:', error);
    }
    
  } catch (error) {
    console.error('Service Worker: Error updating stored reminder from API:', error);
  }
}

// دالة لتحديث بيانات التذكير المخزنة (الطريقة القديمة)
async function updateStoredReminderData(updatedReminder, payload) {
  try {
    console.log('Service Worker: Starting reminder data update process (legacy)');
    
    // الحصول على التذكيرات المجدولة الحالية
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['scheduledReminders'], resolve);
    });
    
    const reminders = result.scheduledReminders || [];
    console.log('Service Worker: Current scheduled reminders count:', reminders.length);
    
    // البحث عن التذكير المطابق وتحديثه
    const existingIndex = reminders.findIndex(r => r.id === updatedReminder.id);
    
    if (existingIndex >= 0) {
      // تحديث التذكير الموجود
      const oldReminder = reminders[existingIndex];
      reminders[existingIndex] = {
        ...oldReminder,
        ...updatedReminder,
        nextReminderTime: updatedReminder.next_reminder_time,
      
      };
      
      console.log('Service Worker: Updated existing reminder:', updatedReminder.id);
      console.log('Service Worker: Old next reminder time:', oldReminder.nextReminderTime);
      console.log('Service Worker: New next reminder time:', updatedReminder.next_reminder_time);
      
      // إعادة جدولة المنبه إذا تغير الوقت
      if (oldReminder.nextReminderTime !== updatedReminder.next_reminder_time) {
        await rescheduleAlarm(updatedReminder);
      }
      
    } else {
      // إضافة تذكير جديد
      const newReminder = {
        id: updatedReminder.id,
        url: updatedReminder.url,
        title: updatedReminder.title,
        nextReminderTime: updatedReminder.next_reminder_time,
        importance: updatedReminder.importance,
        importance_ar: updatedReminder.importance_ar
      };
      
      reminders.push(newReminder);
      console.log('Service Worker: Added new reminder:', updatedReminder.id);
      
      // جدولة منبه جديد
      await rescheduleAlarm(updatedReminder);
    }
    
    // حفظ التذكيرات المحدثة
    await new Promise((resolve) => {
      chrome.storage.local.set({ scheduledReminders: reminders }, () => {
        console.log('Service Worker: Updated scheduled reminders saved to storage');
        resolve();
      });
    });
    
    // إرسال رسالة للصفحات المفتوحة لتحديث واجهة المستخدم
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach(client => {
        client.postMessage({
          type: 'REMINDER_UPDATED',
          reminder: updatedReminder,
          pushPayload: payload
        });
      });
      console.log('Service Worker: Notified clients about reminder update');
    } catch (error) {
      console.error('Service Worker: Error notifying clients:', error);
    }
    
  } catch (error) {
    console.error('Service Worker: Error updating stored reminder data:', error);
  }
}

// دالة لإعادة جدولة المنبه
async function rescheduleAlarm(reminder) {
  try {
    const scheduledTime = new Date(reminder.nextReminderTime || reminder.next_reminder_time).getTime();
    const currentTime = Date.now();
    
    console.log('Service Worker: Rescheduling alarm for reminder:', reminder.id);
    console.log('Service Worker: Scheduled time:', new Date(scheduledTime).toLocaleString());
    console.log('Service Worker: Current time:', new Date(currentTime).toLocaleString());
    
    if (scheduledTime <= currentTime) {
      console.warn('Service Worker: Scheduled time is in the past, skipping alarm for:', reminder.id);
      return;
    }
    
    // مسح المنبه القديم
    await new Promise((resolve) => {
      chrome.alarms.clear(`reminder-${reminder.id}`, (wasCleared) => {
        console.log(`Service Worker: Previous alarm for reminder-${reminder.id} ${wasCleared ? 'was cleared' : 'did not exist'}`);
        resolve();
      });
    });
    
    // إنشاء منبه جديد
    chrome.alarms.create(`reminder-${reminder.id}`, {
      when: scheduledTime,
    });
    
    console.log('Service Worker: Successfully rescheduled alarm for reminder:', reminder.id);
    
  } catch (error) {
    console.error('Service Worker: Error rescheduling alarm:', error);
  }
}

// ✅ التعامل مع النقر على الإشعار
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const targetUrl = event.notification.data || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// دالة للحصول على النصوص المترجمة مع نص افتراضي
function getTranslation(key, language = 'ar') {
  console.log(`Background.js: Getting translation for key: ${key}, language: ${language}`);
  const defaultTranslations = {
    ar: {
      reminder: 'تذكير',
      timeToRead: 'حان وقت القراءة',
      untitled: 'بدون عنوان'
    },
    en: {
      reminder: 'Reminder',
      timeToRead: 'Time to read',
      untitled: 'Untitled'
    }
  };
  const translation = (translations && translations[language] && translations[language][key]) ||
                     (translations['en'] && translations['en'][key]) ||
                     defaultTranslations[language][key] ||
                     key;
  if (translation === key) {
    console.warn(`Background.js: No translation found for key: ${key}, returning default: ${key}`);
  }
  return translation;
}

// تحميل الترجمات من ملف i18n.js
fetch(chrome.runtime.getURL('i18n.js'))
  .then(response => {
    if (!response.ok) {
      throw new Error(`Failed to load i18n.js: ${response.status}`);
    }
    return response.text();
  })
  .then(scriptContent => {
    try {
      // استخراج كائن الترجمات من محتوى الملف
      const translationsText = scriptContent.replace('const translations = ', '').replace(/;$/, '');
      const translationsObj = JSON.parse(translationsText);
      Object.assign(translations, translationsObj);
      console.log('Background.js: Translations loaded successfully:', Object.keys(translations));
    } catch (e) {
      console.error('Background.js: Failed to parse i18n.js:', e);
    }
  })
  .catch(error => {
    console.error('Background.js: Error loading i18n.js:', error);
  });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background.js: Message received:', message, 'From sender:', sender);
  try {
    if (message.type === 'scheduleNotification') {
      const { bookmark } = message;
      console.log('Background.js: Processing scheduleNotification for bookmark:', bookmark);
      const scheduledTime = new Date(bookmark.nextReminderTime).getTime();
      console.log('Background.js: Parsed scheduled time:', scheduledTime, 'Current time:', Date.now());
      const currentTime = Date.now();

      if (scheduledTime <= currentTime) {
        console.warn('Background.js: Scheduled time is in the past, skipping alarm for:', bookmark.id);
        sendResponse({ success: false, error: 'Scheduled time is in the past' });
        return true;
      }

      chrome.alarms.clear(`reminder-${bookmark.id}`, (wasCleared) => {
        console.log(`Background.js: Previous alarm for reminder-${bookmark.id} ${wasCleared ? 'was cleared' : 'did not exist'}`);
        
        chrome.alarms.create(`reminder-${bookmark.id}`, {
          when: scheduledTime,
        });
        console.log('Background.js: Created alarm for:', bookmark.id, 'Scheduled at:', new Date(scheduledTime).toLocaleString());
        
        chrome.storage.local.get(['scheduledReminders'], (result) => {
          const reminders = result.scheduledReminders || [];
          console.log('Background.js: Current scheduled reminders:', reminders);
          const existingIndex = reminders.findIndex(r => r.id === bookmark.id);
          
          if (existingIndex >= 0) {
            reminders[existingIndex] = bookmark;
            console.log('Background.js: Updated existing reminder:', bookmark.id);
          } else {
            reminders.push(bookmark);
            console.log('Background.js: Added new reminder:', bookmark.id);
          }
          
          chrome.storage.local.set({ scheduledReminders: reminders }, () => {
            console.log('Background.js: Saved scheduled reminders to local storage:', reminders.length);
          });
        });
        
        console.log('Background.js: Alarm scheduling completed for:', bookmark.id);
        sendResponse({ success: true });
      });
      
      return true;
    } else {
      console.log('Background.js: Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Background.js: Error processing message:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const reminderId = alarm.name.split('-')[1];
  console.log('Background.js: Alarm triggered for reminder:', reminderId, 'Alarm details:', alarm);

  try {
    const { token } = await new Promise((resolve) =>
      chrome.storage.local.get(['token'], (r) => {
        console.log('Background.js: Retrieved token from storage:', r.token ? 'Token exists' : 'No token');
        resolve(r);
      })
    );

    const { language = 'ar' } = await new Promise((resolve) =>
      chrome.storage.local.get(['language'], (r) => {
        console.log('Background.js: Retrieved language from storage:', r.language || 'ar');
        resolve(r);
      })
    );

    if (!token) {
      console.error('Background.js: No token found, cannot fetch reminder');
      return;
    }

    console.log('Background.js: Fetching reminder with token:', token);
    const response = await fetch(`${API_BASE_URL}/reminderById?id=${reminderId}`, {
      headers: {
        'X-API-Password': API_PASSWORD,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    console.log('Background.js: Fetch response status:', response.status);
    const data = await response.json();
    console.log('Background.js: Fetch response data:', data);

    if (response.ok && data.success && data.reminder) {
      console.log('Background.js: Reminder data retrieved:', data.reminder);

      chrome.permissions.contains({ permissions: ['notifications'] }, (granted) => {
        console.log('Background.js: Notification permission check:', granted);
        if (!granted) {
          console.error('Background.js: Notification permission not granted');
          return;
        }

        const title = getTranslation('reminder', language);
        const message = `${getTranslation('timeToRead', language)} ${data.reminder.title || getTranslation('untitled', language)}`;
        console.log('Background.js: Creating notification with title:', title, 'message:', message);
        chrome.notifications.create(`notif-${reminderId}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon128.png'),
          title: title,
          message: message,
          contextMessage: data.reminder.url,
          requireInteraction: true,
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error('Background.js: Notification creation failed:', chrome.runtime.lastError);
          } else {
            console.log('Background.js: Notification created successfully:', notificationId);
          }
        });
      });
    } else if (response.status === 401) {
      console.warn('Background.js: Token expired, clearing and attempting re-authentication');
      chrome.storage.local.remove(['token'], () => {
        console.log('Background.js: Token cleared due to 401 error');
      });
    } else {
      console.error('Background.js: Failed to fetch reminder:', data.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Background.js: Error fetching reminder:', error);
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('Background.js: Notification clicked:', notificationId);
  const reminderId = notificationId.split('-')[1];

  chrome.storage.local.get(['token'], async (result) => {
    console.log('Background.js: Retrieved token for notification click:', result.token ? 'Token exists' : 'No token');
    try {
      const token = result.token;
      if (!token) {
        console.error('Background.js: No token found, cannot fetch reminder');
        chrome.notifications.clear(notificationId);
        return;
      }

      console.log('Background.js: Fetching reminder for notification click:', reminderId);
      const response = await fetch(`${API_BASE_URL}/reminderById?id=${reminderId}`, {
        headers: {
          'X-API-Password': API_PASSWORD,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const data = await response.json();
      console.log('Background.js: Reminder fetch response for click:', data);

      if (response.ok && data.success && data.reminder) {
        console.log('Background.js: Opening URL:', data.reminder.url);
        chrome.tabs.create({ url: data.reminder.url });

        console.log('Background.js: Updating stats for URL:', data.reminder.url);
        const updateResponse = await fetch(`${API_BASE_URL}/update-stats`, {
          method: 'POST',
          headers: {
            'X-API-Password': API_PASSWORD,
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: data.reminder.url,
            opened: 1,
          }),
        });
        const updateData = await updateResponse.json();
        console.log('Background.js: Stats update response:', updateData);

        if (updateResponse.ok) {
          console.log('Background.js: Stats updated successfully for URL:', data.reminder.url);
        } else {
          console.error('Background.js: Failed to update stats:', updateData.message || 'Unknown error');
        }
      } else {
        console.error('Background.js: Failed to fetch reminder:', data.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Background.js: Error handling notification click:', error);
    } finally {
      console.log('Background.js: Clearing notification:', notificationId);
      chrome.notifications.clear(notificationId, () => {
        console.log('Background.js: Notification cleared');
      });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Background.js: Background service started, rescheduling alarms');
  rescheduleAllReminders();
});

function rescheduleAllReminders() {
  chrome.storage.local.get(['scheduledReminders'], async (result) => {
    const reminders = result.scheduledReminders || [];
    console.log('Background.js: Found scheduled reminders:', reminders.length, 'Reminders:', reminders);
    
    chrome.alarms.clearAll(() => {
      console.log('Background.js: Cleared all existing alarms');
      
      const validReminders = reminders.filter(reminder => {
        const scheduledTime = new Date(reminder.nextReminderTime).getTime();
        const isValid = scheduledTime > Date.now();
        console.log(`Background.js: Checking reminder ${reminder.id}: Scheduled at ${new Date(scheduledTime).toLocaleString()}, Valid: ${isValid}`);
        return isValid;
      });
      
      console.log('Background.js: Valid reminders to reschedule:', validReminders.length);
      
      for (const reminder of validReminders) {
        const scheduledTime = new Date(reminder.nextReminderTime).getTime();
        chrome.alarms.create(`reminder-${reminder.id}`, {
          when: scheduledTime,
        });
        console.log('Background.js: Rescheduled alarm for:', reminder.id, 'at', new Date(scheduledTime).toLocaleString());
      }
      
      if (validReminders.length !== reminders.length) {
        chrome.storage.local.set({ scheduledReminders: validReminders }, () => {
          console.log('Background.js: Updated scheduled reminders list, removed expired reminders:', validReminders.length);
        });
      }
      
      chrome.alarms.getAll((alarms) => {
        console.log('Background.js: Current alarms after rescheduling:', alarms.length, 'Alarms:', alarms);
      });
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Background.js: Extension installed, initializing background service');
  chrome.permissions.request({ permissions: ['notifications'] }, (granted) => {
    console.log('Background.js: Notifications permission granted:', granted);
    if (granted) {
      chrome.notifications.create('test-notification', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon128.png'),
        title: 'Test Notification',
        message: 'This is a test notification',
        requireInteraction: true
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error('Background.js: Test notification creation failed:', chrome.runtime.lastError);
        } else {
          console.log('Background.js: Test notification created:', notificationId);
        }
      });
    }
  });
  rescheduleAllReminders();
});