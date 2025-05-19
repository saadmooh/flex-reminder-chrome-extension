// تعريف المتغيرات العالمية بطريقة آمنة
var editMode = null;
var originalImportance = null;
var originalNextTime = null;

function showMessage(message, isSuccess) {
  const messageBar = document.getElementById('message-bar');
  if (messageBar) {
    messageBar.textContent = message;
    messageBar.classList.remove('hidden', 'bg-green-500', 'bg-red-500');
    messageBar.classList.add(isSuccess ? 'bg-green-500' : 'bg-red-500');
    setTimeout(() => {
      messageBar.classList.add('hidden');
    }, 5000);
  }
}

function initializeEditPostScreen(showScreen, language, applyLanguage, apiRequest, reminderData) {
  console.log('Initializing edit-post screen with reminderData:', reminderData);
  const editPostScreen = document.getElementById('edit-post-screen');
  const editPostForm = document.getElementById('edit-post-form');
  const cancelEdit = document.getElementById('cancel-edit');
  const editImportanceBtn = document.getElementById('edit-importance-btn');
  const editTimeBtn = document.getElementById('edit-time-btn');
  const editUrl = document.getElementById('edit-url');
  const editImportance = document.getElementById('edit-importance');
  const editNextTime = document.getElementById('edit-next-time');
  const updateBtn = document.getElementById('update-btn');
  
  // إعادة تعيين المتغيرات العالمية
  window.editMode = null;
  window.originalImportance = null;
  window.originalNextTime = null;

  if (!editPostScreen || !editPostForm || !editUrl || !editImportance || !editNextTime || !updateBtn) {
    console.error('One or more elements not found in edit-post.html');
    showMessage(`${translations[language].error}: ${translations[language].pageElementsNotFound}`, false);
    return;
  }

  editPostScreen.classList.remove('hidden');
  console.log('edit-post-screen visibility set to visible');

  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

  // Listen for language changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.language) {
      language = changes.language.newValue;
      applyLanguage(language);
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      editNextTime.setAttribute('lang', language);
      editNextTime.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    }
  });

  const now = new Date();
  const minDateTime = now.toISOString().slice(0, 16);
  editNextTime.setAttribute('min', minDateTime);
  editNextTime.setAttribute('lang', language);
  editNextTime.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  console.log('Set min datetime for edit-next-time:', minDateTime);

  if (reminderData) {
    editUrl.value = reminderData.url || '';
    editImportance.value = reminderData.importance ? reminderData.importance.toLowerCase() : 'day';
    
    // Adjust next reminder time to local timezone
    let nextReminderTime = '';
    if (reminderData.next_reminder_time) {
      const reminderDate = new Date(reminderData.next_reminder_time);
      const offsetMinutes = reminderDate.getTimezoneOffset();
      const adjustedDate = new Date(reminderDate.getTime() - offsetMinutes * 60 * 1000);
      nextReminderTime = adjustedDate.toISOString().slice(0, 16);
    }
    
    editNextTime.value = nextReminderTime;
    editPostForm.dataset.reminderId = reminderData.id || '';
    editMode = null;
    document.getElementById('edit-importance').classList.add('hidden');
    document.getElementById('edit-time').classList.add('hidden');

    window.originalImportance = editImportance.value;
    window.originalNextTime = nextReminderTime;
    console.log('Stored original values:', { originalImportance: window.originalImportance, originalNextTime: window.originalNextTime });

    console.log('Form initialized with data:', {
      url: editUrl.value,
      importance: editImportance.value,
      nextTime: editNextTime.value,
      reminderId: editPostForm.dataset.reminderId
    });
  } else {
    console.warn('No reminderData provided, form not initialized');
    showMessage(`${translations[language].error}: ${translations[language].failedToFetchReminder}`, false);
  }

  applyLanguage(language);

  function checkFormChanges() {
    const importanceChanged = editImportance.value !== window.originalImportance;
    const nextTimeChanged = editNextTime.value !== window.originalNextTime;
    const hasChanges = importanceChanged || nextTimeChanged;

    if (hasChanges) {
      updateBtn.disabled = false;
      updateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      console.log('Form changed, enabling update button:', { importanceChanged, nextTimeChanged });
    } else {
      updateBtn.disabled = true;
      updateBtn.classList.add('opacity-50', 'cursor-not-allowed');
      console.log('No form changes, disabling update button');
    }
  }

  if (editImportance) {
    editImportance.addEventListener('change', () => {
      console.log('Importance changed to:', editImportance.value);
      checkFormChanges();
    });
  }

  if (editNextTime) {
    editNextTime.addEventListener('change', () => {
      console.log('Next time changed to:', editNextTime.value);
      checkFormChanges();
    });
  }

  if (cancelEdit) {
    cancelEdit.addEventListener('click', () => {
      console.log('Cancel edit clicked, switching to reminders.html');
      showScreen('reminders.html');
    });
  }

  if (editImportanceBtn) {
    editImportanceBtn.addEventListener('click', () => {
      window.editMode = 'importance';
      document.getElementById('edit-importance').classList.remove('hidden');
      document.getElementById('edit-time').classList.add('hidden');
      console.log('Edit importance mode activated');
    });
  }

  if (editTimeBtn) {
    editTimeBtn.addEventListener('click', () => {
      window.editMode = 'time';
      document.getElementById('edit-importance').classList.add('hidden');
      document.getElementById('edit-time').classList.remove('hidden');
      console.log('Edit time mode activated');
    });
  }

  if (editPostForm) {
    editPostForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Form submitted with editMode:', window.editMode);
      const url = editUrl.value;
      const importance = editImportance.value;
      const nextTime = editNextTime.value;
      const reminderId = editPostForm.dataset.reminderId;

      if (window.editMode === 'time' && nextTime) {
        const selectedTime = new Date(nextTime);
        const currentTime = new Date();
        if (selectedTime <= currentTime) {
          showMessage(translations[language].invalidTime, false);
          console.warn('Selected time is not in the future:', nextTime);
          return;
        }
      }

      try {
        let response, data, bookmark;

        if (window.editMode === 'time' && nextTime) {
          const date = new Date(nextTime);
          const timezoneOffset = date.getTimezoneOffset() * 60 * 1000; // Convert to milliseconds
          const localISOTime = new Date(date.getTime() - timezoneOffset).toISOString().replace('T', ' ').substring(0, 19);
          response = await apiRequest(`update-reminder`, 'POST', {
            id: reminderId,
            next_reminder_time: localISOTime,
            timezone_offset: date.getTimezoneOffset().toString(),
            timezone_name: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }, true, language);
          data = await response.json();
          if (response.ok && data.id) {
            bookmark = {
              id: reminderId,
              url,
              title: data.post.title || translations[language].untitled,
              nextReminderTime: localISOTime,
            };
            console.log('New Reminder Time:', new Date(localISOTime).toLocaleString());
            showMessage(translations[language].updateSuccess, true);
          } else {
            throw new Error(data.message || translations[language].failedToUpdateReminderTime);
          }
        } else if (editMode === 'importance') {
          console.log(url);
          console.log(translations['en'][importance]);
          console.log(translations['ar'][importance]);
          response = await apiRequest(`reschedule-post`, 'POST', {
            url,
            importance: translations['en'][importance],
            importance_ar: translations['ar'][importance],
          }, true, language);
          data = await response.json();
          if (response.ok && data.success) {
            const nextReminderTime = data.post.next_reminder_time;
            if (!nextReminderTime) {
              throw new Error(translations[language].noNextReminderTime);
            }
            bookmark = {
              id: reminderId,
              url,
              title: data.post.title || translations[language].untitled,
              nextReminderTime,
            };
            showMessage(translations[language].updateSuccess, true);
          } else {
            throw new Error(data.message || translations[language].failedToRescheduleReminder);
          }
        } else {
          showMessage(translations[language].selectEditMode, false);
          return;
        }

        chrome.runtime.sendMessage({
          type: 'scheduleNotification',
          bookmark,
        });
        console.log('Form submission successful, switching to reminders.html');
        showScreen('reminders.html');
      } catch (error) {
        console.error('Form submission error:', error);
        showMessage(`${translations[language].error}: ${error.message}`, false);
      }
    });
  }
}