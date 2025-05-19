const API_BASE_URL = 'https://flexreminder.com/api';
const API_PASSWORD = 'api_password_app';

// تعريف المتغيرات العالمية
const translations = {};

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