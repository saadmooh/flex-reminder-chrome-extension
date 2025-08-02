document.addEventListener('DOMContentLoaded', async () => {
  const backBtn = document.getElementById('back-btn');
  const addFreeTimeBtn = document.getElementById('add-free-time-btn');
  const timeSlotsList = document.getElementById('time-slots-screen');
  const daysOfWeek = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];
  let language = await getStoredLanguage(); // Get stored language

  // Apply the stored language initially
  applyLanguage(language);
  document.documentElement.lang = language;

  // Fetch the latest language from API and update if different
  const fetchedLanguage = await fetchUserLanguage(apiRequest);
  if (fetchedLanguage !== language) {
    language = fetchedLanguage;
    applyLanguage(language);
    document.documentElement.lang = language;
  }

  // Listen for language changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.language) {
      language = changes.language.newValue;
      applyLanguage(language);
      document.documentElement.lang = language;
      loadFreeTimes(); // Refresh the list with the new language
    }
  });

  backBtn.addEventListener('click', () => {
    window.location.href = chrome.runtime.getURL('popup.html');
  });

  addFreeTimeBtn.addEventListener('click', () => showAddFreeTimeDialog());

  loadFreeTimes();

  async function loadFreeTimes() {
    try {
      const response = await apiRequest('free-times', 'GET', null, true, language);
      const data = await response.json();
      if (response.ok) {
        const freeTimes = data || [];
        renderTimeSlots(freeTimes);
      } else {
        showMessage(`${translations[language].failedToLoadFreeTimes}: ${data.message || translations[language].unknownError}`, false);
      }
    } catch (error) {
      showMessage(`${translations[language].error}: ${error.message}`, false);
    }
  }

  function renderTimeSlots(freeTimes) {
    const timeSlotsList = document.getElementById('time-slots-list');
    timeSlotsList.innerHTML = '';
    daysOfWeek.forEach(day => {
      const daySlots = freeTimes.filter(slot => slot.day.toLowerCase() === day);
      const isDayOff = daySlots.some(slot => slot.is_off_day);

      const daySection = document.createElement('div');
      daySection.className = 'day-section';

      const dayHeader = document.createElement('div');
      dayHeader.className = 'day-header flex items-center gap-2';
      dayHeader.innerHTML = `
        <h3 style="color: ${isDayOff ? '#666' : '#006400'}">${translations[language][day]}</h3>
        <input type="checkbox" ${isDayOff ? 'checked' : ''}>
      `;
      daySection.appendChild(dayHeader);

      const checkbox = dayHeader.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', () => toggleDayOff(day, checkbox.checked));

      if (isDayOff) {
        const dayOffText = document.createElement('p');
        dayOffText.className = 'text-red';
        dayOffText.textContent = translations[language].dayOff;
        daySection.appendChild(dayOffText);
      } else {
        const slots = daySlots.filter(slot => !slot.is_off_day);
        if (slots.length === 0) {
          const noSlots = document.createElement('div');
          noSlots.className = 'text-gray';
          noSlots.textContent = translations[language].noFreeTimes;
          daySection.appendChild(noSlots);
        } else {
          slots.forEach(slot => {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'time-slot flex justify-between items-center gap-2';
            slotDiv.innerHTML = `
              <span class="time-slot-text">${slot.start_time} - ${slot.end_time}</span>
              <div class="time-slot-actions flex gap-2">
                <button data-id="${slot.id}" class="action-btn edit-btn">${translations[language].edit}</button>
                <button data-id="${slot.id}" class="action-btn delete-btn">${translations[language].delete}</button>
              </div>
            `;
            daySection.appendChild(slotDiv);

            slotDiv.querySelector('.edit-btn').addEventListener('click', () => editFreeTime(slot.id));
            slotDiv.querySelector('.delete-btn').addEventListener('click', () => deleteFreeTime(slot.id));
          });
        }
      }

      timeSlotsList.appendChild(daySection);
    });
  }

  async function toggleDayOff(day, isOff) {
    try {
      if (isOff) {
        const response = await apiRequest('free-times', 'POST', {
          day,
          start_time: '00:00',
          end_time: '23:59',
          is_off_day: true
        }, true, language);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(Object.values(data).join(', ') || translations[language].unknownError);
        }
        showMessage(translations[language].dayOffSetSuccess, true); // Added success message
      } else {
        const response = await apiRequest('free-times', 'GET', null, true, language);
        const data = await response.json();
        const daySlots = data.filter(slot => slot.day.toLowerCase() === day && slot.is_off_day);
        for (const slot of daySlots) {
          const delResponse = await apiRequest(`free-times/${slot.id}`, 'DELETE', null, true, language);
          if (!delResponse.ok) {
            const delData = await delResponse.json();
            throw new Error(delData.message || translations[language].failedToDelete);
          }
        }
        showMessage(translations[language].dayOffRemovedSuccess, true); // Added success message
      }
      loadFreeTimes();
    } catch (error) {
      showMessage(`${translations[language].errorTogglingDayOff}: ${error.message}`, false);
    }
  }

  async function editFreeTime(id) {
    try {
      const response = await apiRequest('free-times', 'GET', null, true, language);
      const data = await response.json();
      const freeTime = data.find(slot => slot.id === id);
      if (freeTime) {
        showAddFreeTimeDialog(freeTime);
      }
    } catch (error) {
      showMessage(`${translations[language].errorFetchingFreeTime}: ${error.message}`, false);
    }
  }

  async function deleteFreeTime(id) {
    const confirmed = confirm(translations[language].confirmDelete);
    if (confirmed) {
      try {
        const response = await apiRequest(`free-times/${id}`, 'DELETE', null, true, language);
        if (response.ok) {
          loadFreeTimes();
          showMessage(translations[language].deleteSuccess, true); // Added success message
        } else {
          const data = await response.json();
          showMessage(`${translations[language].failedToDeleteFreeTime}: ${data.message || translations[language].unknownError}`, false);
        }
      } catch (error) {
        showMessage(`${translations[language].error}: ${error.message}`, false);
      }
    }
  }

  function showAddFreeTimeDialog(existingTime = null) {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <h3 class="dialog-title">${translations[language][existingTime ? 'editFreeTime' : 'addFreeTimeDialog']}</h3>
      <form class="dialog-form">
        <select id="dialog-day" class="input-field">
          ${daysOfWeek.map(day => `<option value="${day}" ${existingTime && existingTime.day === day ? 'selected' : ''}>${translations[language][day]}</option>`).join('')}
        </select>
        <input type="time" id="dialog-start" class="input-field" value="${existingTime ? existingTime.start_time : '09:00'}">
        <input type="time" id="dialog-end" class="input-field" value="${existingTime ? existingTime.end_time : '17:00'}">
        <div class="flex gap-2">
          <button type="button" id="save-free-time-btn" class="action-btn">${translations[language][existingTime ? 'update' : 'add']}</button>
          <button type="button" id="cancel-dialog-btn" class="action-btn cancel-btn">${translations[language].cancel}</button>
        </div>
      </form>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    document.getElementById('save-free-time-btn').addEventListener('click', () => saveFreeTime(existingTime ? existingTime.id : null));
    document.getElementById('cancel-dialog-btn').addEventListener('click', () => {
      dialog.remove();
      overlay.remove();
    });
    overlay.addEventListener('click', () => {
      dialog.remove();
      overlay.remove();
    });
  }

  async function saveFreeTime(id) {
    const day = document.getElementById('dialog-day').value;
    let startTime = document.getElementById('dialog-start').value;
    let endTime = document.getElementById('dialog-end').value;

    startTime = normalizeTime(startTime);
    endTime = normalizeTime(endTime);

    if (!startTime || !endTime) {
      showMessage(translations[language].startEndTimesRequired, false);
      return;
    }

    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    if (end <= start) {
      showMessage(translations[language].endAfterStart, false);
      return;
    }

    try {
      let response;
      if (id) {
        response = await apiRequest(`free-times/${id}`, 'PUT', {
          day,
          start_time: startTime,
          end_time: endTime,
          is_off_day: false
        }, true, language);
      } else {
        response = await apiRequest('free-times', 'POST', {
          day,
          start_time: startTime,
          end_time: endTime,
          is_off_day: false
        }, true, language);
      }

      const data = await response.json();
      if (response.ok) {
        loadFreeTimes();
        document.querySelector('.dialog').remove();
        document.querySelector('.dialog-overlay').remove();
        showMessage(translations[language].saveSuccess, true); // Added success message
      } else {
        showMessage(`${translations[language].errorSavingFreeTime}: ${Object.values(data).join(', ') || translations[language].unknownError}`, false);
      }
    } catch (error) {
      showMessage(`${translations[language].error}: ${error.message}`, false);
    }
  }

  function normalizeTime(time) {
    if (!time) return time;
    const parts = time.split(':');
    if (parts.length === 3) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  }

  // Define showMessage for this file since it's not imported
  function showMessage(message, isSuccess) {
    const messageBar = document.createElement('div');
    messageBar.id = 'message-bar';
    messageBar.className = `fixed top-0 left-0 right-0 p-4 text-white text-center z-50 ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`;
    messageBar.textContent = message;
    document.body.appendChild(messageBar);
    setTimeout(() => {
      messageBar.remove();
    }, 5000);
  }
});