/**
 * Display a message in the top message bar.
 * @param {string} message - The message to display.
 * @param {boolean} isSuccess - True for success (green), false for error (red).
 */
function showMessage(message, isSuccess) {
  const messageBar = document.getElementById('message-bar');
  if (messageBar) {
    messageBar.textContent = message;
    messageBar.classList.remove('hidden', 'bg-green-500', 'bg-red-500');
    messageBar.classList.add(isSuccess ? 'bg-green-500' : 'bg-red-500');
    setTimeout(() => {
      messageBar.classList.add('hidden');
    }, 5000);
  } else {
    console.error('Message bar element not found');
  }
}

/**
 * Initialize the save-post screen.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const savePostScreen = document.getElementById('save-post-screen');
  const savePostForm = document.getElementById('save-post-form');
  const cancelSave = document.getElementById('cancel-save');
  const backToRemindersBtn = document.getElementById('back-to-reminders-btn');
  const urlInput = document.getElementById('url');
  const saveButton = savePostForm.querySelector('button[type="submit"]');

  let language = await getStoredLanguage(); // Get stored language

  if (!savePostScreen || !savePostForm || !cancelSave || !urlInput || !saveButton) {
    console.error('Required elements not found in save_post.html');
    showMessage(`${translations[language].error}: ${translations[language].pageElementsNotFound}`, false);
    return;
  }

  // Check for authentication token
  chrome.storage.local.get(['token'], async result => {
    if (!result.token) {
      window.location.href = chrome.runtime.getURL('auth.html');
      return;
    }

    // Fetch the latest language from API and update if different
    const fetchedLanguage = await fetchUserLanguage(apiRequest);
    if (fetchedLanguage && fetchedLanguage !== language) {
      language = fetchedLanguage;
      applyLanguage(language);
    }

    // Apply the language initially
    applyLanguage(language);
    document.documentElement.lang = language;

    // Listen for language changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.language) {
        language = changes.language.newValue;
        applyLanguage(language);
        document.documentElement.lang = language;
      }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.url) {
        urlInput.value = tabs[0].url;
      }
    });
  });

  // Handle cancel button
  cancelSave?.addEventListener('click', () => {
    console.log('Cancel save clicked');
    window.location.href = chrome.runtime.getURL('popup.html');
  });

  // Handle back to reminders button
  backToRemindersBtn?.addEventListener('click', () => {
    console.log('Back to reminders clicked');
    window.location.href = chrome.runtime.getURL('popup.html');
  });

  // Handle form submission
  savePostForm?.addEventListener('submit', async e => {
    e.preventDefault();
    console.log('Save post form submitted');

    // Disable all buttons on the page
    saveButton.disabled = true;
    cancelSave.disabled = true;
    backToRemindersBtn.disabled = true;
    console.log('All buttons disabled: Save, Cancel, and Back to Reminders');

    const url = urlInput.value;
    const importance = document.getElementById('importance')?.value;
    const timezoneOffset = -(new Date().getTimezoneOffset() / 60); // Convert to hours

    if (!url || !importance) {
      showMessage(`${translations[language].error}: ${translations[language].urlAndImportanceRequired}`, false);
      // Re-enable all buttons if validation fails
      saveButton.disabled = false;
      cancelSave.disabled = false;
      backToRemindersBtn.disabled = false;
      console.log('All buttons re-enabled due to validation failure');
      return;
    }

    try {
      console.log('Sending API request to save-post with method: POST');
      const response = await apiRequest('save-post', 'POST', {
        url,
        importance_en: { day: 'Day', week: 'Week', month: 'Month' }[importance],
        importance_ar: { day: 'يوم', week: 'أسبوع', month: 'شهر' }[importance],
        timezone_offset: timezoneOffset.toString(),
        timezone_name: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }, true, language);

      const data = await response.json();
      if (response.ok && data.success) {
        const nextReminderTime = data.nextReminderTime;
        if (!nextReminderTime) {
          throw new Error('No next_reminder_time returned from API');
        }

        const bookmark = {
          id: data.id,
          url,
          title: data.title || 'Untitled',
          nextReminderTime,
        };

        chrome.runtime.sendMessage({
          type: 'scheduleNotification',
          bookmark,
        });

        showMessage(data.message || translations[language].saveSuccess, true);
        setTimeout(() => {
          window.location.href = chrome.runtime.getURL('popup.html');
        }, 2000);
      } else {
        showMessage(data.message || translations[language].failedToSaveReminder, false);
        // Re-enable all buttons if the API request fails
        saveButton.disabled = false;
        cancelSave.disabled = false;
        backToRemindersBtn.disabled = false;
        console.log('All buttons re-enabled due to API failure');
      }
    } catch (error) {
      console.error('Error saving post:', error);

    }
  });
})