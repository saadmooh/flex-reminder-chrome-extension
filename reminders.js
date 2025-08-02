// تعريف المتغيرات العالمية بطريقة آمنة
var unreadCurrentPage = 1;
var unreadLastPage = 1;
var readCurrentPage = 1;
var readLastPage = 1;
var isLoadingUnread = false;
var isLoadingRead = false;
var unreadHasFetchedLastPage = false;
var readHasFetchedLastPage = false;
var activeTab = 'unread'; // تتبع علامة التبويب النشطة ('unread' أو 'read')

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
 * Display a confirmation dialog for delete actions.
 * @param {string} message - Confirmation message.
 * @param {Function} onConfirm - Callback if confirmed.
 * @param {string} language - Current language.
 */
function showConfirm(message, onConfirm, language) {
  const confirmModal = document.createElement('div');
  confirmModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  confirmModal.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
      <p class="text-lg mb-4">${message}</p>
      <p class="text-sm text-gray-500 mb-4">${translations[language].confirmDeleteMessage}</p>
      <div class="flex justify-end space-x-2">
        <button id="confirm-cancel" class="px-4 py-2 bg-gray-300 rounded-lg">${translations[language].cancel}</button>
        <button id="confirm-delete" class="px-4 py-2 bg-red-500 text-white rounded-lg">${translations[language].delete}</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);

  document.getElementById('confirm-cancel').addEventListener('click', () => {
    confirmModal.remove();
  });

  document.getElementById('confirm-delete').addEventListener('click', () => {
    onConfirm();
    confirmModal.remove();
  });
}

/**
 * Initialize the reminders screen.
 * @param {Function} showScreen - Function to show a specific screen.
 */
async function initializeRemindersScreen(showScreen) {
  let language = await getStoredLanguage(); // Get stored language

  const remindersScreen = document.getElementById('reminders-screen');
  const settingsBtn = document.getElementById('settings-btn');
  const sidebar = document.getElementById('sidebar');
  const addBookmarkBtn = document.getElementById('add-bookmark-btn');
  const freeTimesBtn = document.getElementById('free-times-btn');
  const subscriptionsBtn = document.getElementById('subscriptions-btn');
  const languageBtn = document.getElementById('language-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const searchInput = document.getElementById('search');
  const categoryFilter = document.getElementById('category-filter');
  const complexityFilter = document.getElementById('complexity-filter');
  const domainFilter = document.getElementById('domain-filter');
  const unreadTab = document.getElementById('unread-tab');
  const readTab = document.getElementById('read-tab');
  const unreadRemindersList = document.getElementById('unread-reminders-list');
  const readRemindersList = document.getElementById('read-reminders-list');
  const unreadLoadingIndicator = document.getElementById('unread-loading-indicator');
  const readLoadingIndicator = document.getElementById('read-loading-indicator');

  if (!remindersScreen || !unreadRemindersList || !readRemindersList || !unreadTab || !readTab) {
    console.error('Required elements not found in reminders.html');
    showMessage(`${translations[language].error}: ${translations[language].pageElementsNotFound}`, false);
    return;
  }

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
      loadReminders(true); // Refresh the list with the new language
    }
  });

  // Toggle sidebar visibility
  if (settingsBtn && sidebar) {
    settingsBtn.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
      console.log('Sidebar toggled');
    });

    document.addEventListener('click', (event) => {
      if (!sidebar.classList.contains('hidden') &&
          !event.target.closest('#sidebar') &&
          !event.target.closest('#settings-btn')) {
        sidebar.classList.add('hidden');
        console.log('Sidebar closed due to outside click');
      }
    });
  }

  // Change language
  if (languageBtn) {
    languageBtn.addEventListener('click', async () => {
      const newLanguage = language === 'en' ? 'ar' : 'en';
      try {
        const response = await apiRequest('update-language', 'POST', { language: newLanguage }, true, language);
        const data = await response.json();
        if (response.ok && data.success) {
          // Update stored language
          chrome.storage.local.set({ language: newLanguage }, () => {
            console.log('Language updated to:', newLanguage);
          });
          language = newLanguage;
          applyLanguage(language);
          document.documentElement.lang = language;
          loadReminders(true); // Refresh the list with the new language
        } else {
          showMessage(data.message || translations[language].error, false);
        }
      } catch (error) {
        console.error('Error changing language:', error);
        showMessage(`${translations[language].error}: ${error.message}`, false);
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiRequest('logout', 'POST', null, true, language);
        chrome.storage.local.remove(['token', 'language'], () => {
          sidebar.classList.add('hidden');
          window.location.href = chrome.runtime.getURL('index.html');
          console.log('User logged out');
        });
      } catch (error) {
        console.error('Error logging out:', error);
        showMessage(`${translations[language].error}: ${error.message}`, false);
      }
    });
  }

  // Navigate to add bookmark screen
  if (addBookmarkBtn) {
    addBookmarkBtn.addEventListener('click', () => {
      sidebar.classList.add('hidden');
      window.location.href = chrome.runtime.getURL('save_post.html');
      console.log('Navigating to save_post.html');
    });
  }

  // Navigate to free times screen
  if (freeTimesBtn) {
    freeTimesBtn.addEventListener('click', () => {
      sidebar.classList.add('hidden');
      window.location.href = chrome.runtime.getURL('time_slots.html');
      console.log('Navigating to time_slots.html');
    });
  }

  // Open customer portal
  if (subscriptionsBtn) {
    subscriptionsBtn.addEventListener('click', async () => {
      try {
        const response = await apiRequest('customer-portal-url', 'GET', null, true, language);
        const data = await response.json();
        if (response.ok && data.status === 'success' && data.customer_portal_url) {
          chrome.tabs.create({ url: data.customer_portal_url, active: true });
          sidebar.classList.add('hidden');
          console.log('Opened customer portal');
        } else {
          showMessage(translations[language].failedToLoadCustomerPortal, false);
        }
      } catch (error) {
        console.error('Error loading customer portal:', error);
        showMessage(`${translations[language].error}: ${error.message}`, false);
        if (error.message.includes('401')) {
          chrome.storage.local.remove(['token', 'language'], () => {
            sidebar.classList.add('hidden');
            window.location.href = chrome.runtime.getURL('auth.html');
            console.log('Redirecting to auth.html due to 401 error');
          });
        }
      }
    });
  }

  // Trigger search on Enter key
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        console.log('Search triggered with value:', searchInput.value);
        loadReminders(true);
      }
    });
  }

  // Trigger load on filter change
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      console.log('Category filter changed to:', categoryFilter.value);
      loadReminders(true);
    });
  }

  if (complexityFilter) {
    complexityFilter.addEventListener('change', () => {
      console.log('Complexity filter changed to:', complexityFilter.value);
      loadReminders(true);
    });
  }

  if (domainFilter) {
    domainFilter.addEventListener('change', () => {
      console.log('Domain filter changed to:', domainFilter.value);
      loadReminders(true);
    });
  }

  unreadTab.addEventListener('click', () => {
    if (activeTab !== 'unread') {
      activeTab = 'unread';
      unreadTab.classList.add('tab-active', 'border-black');
      readTab.classList.remove('tab-active', 'border-black');
      document.getElementById('unread-reminders-container').classList.remove('hidden');
      document.getElementById('read-reminders-container').classList.add('hidden');
      console.log('Switched to unread tab');
      if (unreadRemindersList.children.length === 0) {
        loadReminders(true);
      }
    }
  });
  
  readTab.addEventListener('click', () => {
    if (activeTab !== 'read') {
      activeTab = 'read';
      readTab.classList.add('tab-active', 'border-black');
      unreadTab.classList.remove('tab-active', 'border-black');
      document.getElementById('read-reminders-container').classList.remove('hidden');
      document.getElementById('unread-reminders-container').classList.add('hidden');
      console.log('Switched to read tab');
      if (readRemindersList.children.length === 0) {
        loadReminders(true);
      }
    }
  });

  // Infinite scroll for unread reminders
  if (unreadRemindersList) {
    unreadRemindersList.addEventListener('scroll', () => {
      if (isLoadingUnread || unreadHasFetchedLastPage || activeTab !== 'unread') return;
      const { scrollTop, scrollHeight, clientHeight } = unreadRemindersList;
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        console.log('Reached end of unread list, loading more reminders...');
        loadReminders();
      }
    });
  }

  // Infinite scroll for read reminders
  if (readRemindersList) {
    readRemindersList.addEventListener('scroll', () => {
      if (isLoadingRead || readHasFetchedLastPage || activeTab !== 'read') return;
      const { scrollTop, scrollHeight, clientHeight } = readRemindersList;
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        console.log('Reached end of read list, loading more reminders...');
        loadReminders();
      }
    });
  }

  /**
   * Load reminders from API with pagination and filters.
   * @param {boolean} reset - Whether to reset the list and page.
   */
  async function loadReminders(reset = false) {
    const isUnreadTab = activeTab === 'unread';
    let isLoading = isUnreadTab ? isLoadingUnread : isLoadingRead;
    if (isLoading) {
      console.log(`Already loading ${activeTab} reminders, skipping...`);
      return;
    }
    isLoading = true;
    if (isUnreadTab) {
      isLoadingUnread = true;
    } else {
      isLoadingRead = true;
    }

    const loadingIndicator = isUnreadTab ? unreadLoadingIndicator : readLoadingIndicator;
    const remindersList = isUnreadTab ? unreadRemindersList : readRemindersList;

    if (loadingIndicator) {
      loadingIndicator.classList.remove('hidden');
      applyLanguage(language);
    }

    if (reset) {
      if (isUnreadTab) {
        unreadCurrentPage = 1;
        unreadHasFetchedLastPage = false;
      } else {
        readCurrentPage = 1;
        readHasFetchedLastPage = false;
      }
      remindersList.innerHTML = '';
      console.log(`Resetting ${activeTab} reminders list`);
    }

    const searchQuery = searchInput?.value.trim().toLowerCase() || '';
    const category = categoryFilter?.value || '';
    const complexity = complexityFilter?.value || '';
    const domain = domainFilter?.value || '';

    console.log(`Loading ${activeTab} reminders with filters:`, {
      search: searchQuery,
      category,
      complexity,
      domain,
      page: isUnreadTab ? unreadCurrentPage : readCurrentPage
    });

    try {
      const params = new URLSearchParams({
        page: isUnreadTab ? unreadCurrentPage : readCurrentPage,
        perPage: '10',
        ...(searchQuery && { search: searchQuery }),
        ...(category && { category }),
        ...(complexity && { complexity }),
        ...(domain && { domain }),
      });
      const response = await apiRequest(`remindersWNTR?${params}`, 'GET', null, true, language);
      const data = await response.json();

      console.log('API response:', data);

      if (response.ok && data.success) {
        const reminders = data.reminders || [];
        const lastPage = data.last_page || 1;
        if (isUnreadTab) {
          unreadLastPage = lastPage;
        } else {
          readLastPage = lastPage;
        }

        const unreadReminders = reminders.filter(r => r.is_opened === 0);
        const readReminders = reminders.filter(r => r.is_opened === 1);

        const targetReminders = isUnreadTab ? unreadReminders : readReminders;

        targetReminders.forEach(r => {
          const li = document.createElement('li');
          li.className = 'flex justify-between items-center p-2 border-b';
          
          // Format the reminder time with proper localization and 24-hour format
          const dateOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          };
          const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false, // Use 24-hour format
          };
          const reminderDate = new Date(r.next_reminder_time);
          const formattedDate = reminderDate.toLocaleDateString(language, dateOptions);
          const formattedTime = reminderDate.toLocaleTimeString(language, timeOptions);
          const formattedReminderTime = `${formattedDate} ${formattedTime}`; // Combine date and time

          if (r.is_opened === 0) {
            li.innerHTML = `
              <div class="reminder-details">
                <span class="reminder-title cursor-pointer text-black hover:underline" data-id="${r.id}" data-url="${r.url}">${r.title}</span>
                <span class="reminder-time text-gray-500" dir="${language === 'ar' ? 'rtl' : 'ltr'}">${translations[language].next} ${formattedReminderTime}</span>
              </div>
              <div class="reminder-actions flex space-x-2">
                <button class="action-btn edit px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600" data-id="${r.id}">${translations[language].edit}</button>
                <button class="action-btn delete px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600" data-id="${r.id}">${translations[language].delete}</button>
              </div>
            `;
            li.querySelector('.reminder-title').addEventListener('click', () => openReminder(r.id, r.url));
            li.querySelector('.edit').addEventListener('click', () => editReminder(r.id));
            li.querySelector('.delete').addEventListener('click', () => deleteReminder(r.id));
          } else {
            li.innerHTML = `
              <div class="reminder-details">
                <span class="reminder-title cursor-pointer text-black hover:underline" data-id="${r.id}" data-url="${r.url}">${r.title}</span>
              </div>
              <div class="reminder-actions flex space-x-2">
                <button class="action-btn save px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600" data-id="${r.id}" data-url="${r.url}">${translations[language].saveAction}</button>
                <button class="action-btn delete px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600" data-id="${r.id}">${translations[language].delete}</button>
              </div>
            `;
            li.querySelector('.reminder-title').addEventListener('click', () => openReminder(r.id, r.url));
            li.querySelector('.save').addEventListener('click', async () => {
              try {
                const response = await apiRequest(`reminderById?id=${r.id}`, 'GET', null, true, language);
                const reminderData = await response.json();
                if (response.ok && reminderData.success) {
                  const reminder = {
                    id: r.id,
                    url: r.url,
                    title: reminderData.reminder.title,
                    importance: reminderData.reminder.importance_en || reminderData.reminder.importance,
                    importance_ar: reminderData.reminder.importance_ar || translations['ar'][reminderData.reminder.importance.toLowerCase()],
                  };
                  await rescheduleReminder(reminder, language);
                  loadReminders(true);
                } else {
                  showMessage(reminderData.message || translations[language].failedToFetchReminder, false);
                }
              } catch (error) {
                console.error('Error fetching reminder for rescheduling:', error);
                showMessage(`${translations[language].error}: ${error.message}`, false);
              }
            });
            li.querySelector('.delete').addEventListener('click', () => deleteReminder(r.id));
          }
          remindersList.appendChild(li);
        });

        console.log('Filter options received:', {
          categories: data.categories,
          complexities: data.complexities,
          domains: data.domains
        });

        updateFilterOptions('category-filter', data.categories || [], category);
        updateFilterOptions('complexity-filter', data.complexities || [], complexity);
        updateFilterOptions('domain-filter', data.domains || [], domain);

        if (isUnreadTab) {
          const currentTime = Date.now();
          const alarms = await new Promise(resolve => chrome.alarms.getAll(resolve));
          const alarmIds = alarms.map(a => a.name.split('-')[1]);

          for (const reminder of unreadReminders) {
            if (!alarmIds.includes(reminder.id.toString())) {
              const nextReminderTime = new Date(reminder.next_reminder_time).getTime();
              if (nextReminderTime > currentTime) {
                const bookmark = {
                  id: reminder.id,
                  url: reminder.url,
                  title: reminder.title,
                  nextReminderTime: reminder.next_reminder_time,
                };
                console.log('Adding notification for new unread reminder:', bookmark);
                chrome.runtime.sendMessage({
                  type: 'scheduleNotification',
                  bookmark,
                });
              } else {
                console.log('Rescheduling expired unread reminder:', reminder.id);
                await rescheduleReminder(reminder, language);
              }
            }
          }

          for (const alarm of alarms) {
            const reminderId = alarm.name.split('-')[1];
            const reminder = unreadReminders.find(r => r.id.toString() === reminderId);
            if (reminder && new Date(reminder.next_reminder_time).getTime() < currentTime) {
              console.log('Rescheduling expired unread reminder:', reminderId);
              await rescheduleReminder(reminder, language);
            }
          }
        }

        if ((isUnreadTab && unreadCurrentPage >= unreadLastPage) || (!isUnreadTab && readCurrentPage >= readLastPage)) {
          if (isUnreadTab) {
            unreadHasFetchedLastPage = true;
          } else {
            readHasFetchedLastPage = true;
          }
          console.log(`All ${activeTab} pages loaded, stopping further requests`);
          if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
          }
        } else {
          if (isUnreadTab) {
            unreadCurrentPage++;
          } else {
            readCurrentPage++;
          }
        }
      } else {
        showMessage(data.message || translations[language].failedToLoadReminders, false);
      }
    } catch (error) {
      console.error(`Error loading ${activeTab} reminders:`, error);
      showMessage(`${translations[language].error}: ${error.message}`, false);
    } finally {
      isLoading = false;
      if (isUnreadTab) {
        isLoadingUnread = false;
      } else {
        isLoadingRead = false;
      }
      if (loadingIndicator && (isUnreadTab ? unreadHasFetchedLastPage : readHasFetchedLastPage)) {
        loadingIndicator.classList.add('hidden');
      }
    }
  }

  /**
   * Reschedule a reminder.
   * @param {Object} reminder - Reminder object.
   * @param {string} language - Current language.
   */
  async function rescheduleReminder(reminder, language) {
    console.log(reminder);
    
    try {
      const response = await apiRequest(`reschedule-post`, 'POST', {
        url: reminder.url,
        importance: reminder.importance_en || translations['en'][reminder.importance.toLowerCase()],
        importance_ar: reminder.importance_ar || translations['ar'][reminder.importance.toLowerCase()],
      }, true, language);
      const data = await response.json();
      if (response.ok && data.success) {
        const newNextReminderTime = data.post.next_reminder_time;
        const bookmark = {
          id: reminder.id,
          url: reminder.url,
          title: reminder.title,
          nextReminderTime: newNextReminderTime,
        };
        console.log('Scheduling new notification for rescheduled reminder:', bookmark);
        chrome.alarms.clear(`reminder-${reminder.id}`);
        chrome.runtime.sendMessage({
          type: 'scheduleNotification',
          bookmark,
        });

        // Format the new reminder time with proper localization and 24-hour format
        const dateOptions = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        };
        const timeOptions = {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false, // Use 24-hour format
        };
        const reminderDate = new Date(newNextReminderTime);
        const formattedDate = reminderDate.toLocaleDateString(language, dateOptions);
        const formattedTime = reminderDate.toLocaleTimeString(language, timeOptions);
        const formattedReminderTime = `${formattedDate} ${formattedTime}`; // Combine date and time

        const unreadLi = document.querySelector(`#unread-reminders-list button[data-id="${reminder.id}"]`)?.closest('li');
        const readLi = document.querySelector(`#read-reminders-list button[data-id="${reminder.id}"]`)?.closest('li');
        const li = unreadLi || readLi;
        if (li) {
          const timeElement = li.querySelector('.reminder-time');
          if (timeElement) {
            timeElement.textContent = `${translations[language].next} ${formattedReminderTime}`;
            timeElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
          } else {
            const detailsDiv = li.querySelector('.reminder-details');
            const timeSpan = document.createElement('span');
            timeSpan.className = 'reminder-time text-gray-500';
            timeSpan.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
            timeSpan.textContent = `${translations[language].next} ${formattedReminderTime}`;
            detailsDiv.appendChild(timeSpan);
          }
        }
      } else {
        console.error('Failed to reschedule reminder:', data.message || 'Unknown error');
        showMessage(data.message || translations[language].failedToLoadReminders, false);
      }
    } catch (error) {
      console.error('Error rescheduling reminder:', error);
      showMessage(`${translations[language].error}: ${error.message}`, false);
    }
  }

  /**
   * Open a reminder in a new tab and update stats.
   * @param {number} id - Reminder ID.
   * @param {string} url - Reminder URL.
   */
  async function openReminder(id, url) {
    try {
      chrome.tabs.create({ url });
      const response = await apiRequest('update-stats', 'POST', {
        url,
        opened: 1,
      }, true, language);
      const data = await response.json();
      if (response.ok) {
        console.log('Stats updated for URL:', url);
        loadReminders(true);
      } else {
        console.error('Failed to update stats:', data.message || 'Unknown error');
        showMessage(data.message || translations[language].error, false);
      }
    } catch (error) {
      console.error('Error opening reminder:', error);
      showMessage(`${translations[language].error}: ${error.message}`, false);
    }
  }

  /**
   * Navigate to edit reminder screen.
   * @param {number} id - Reminder ID.
   */
  async function editReminder(id) {
    try {
      const response = await apiRequest(`reminderById?id=${id}`, 'GET', null, true, language);
      const data = await response.json();
      if (response.ok && data.success) {
        showScreen('edit-post.html', data.reminder);
      } else {
        showMessage(data.message || translations[language].failedToFetchReminder, false);
      }
    } catch (error) {
      console.error('Error fetching reminder:', error);
      showMessage(`${translations[language].error}: ${error.message}`, false);
    }
  }

  /**
   * Delete a reminder and remove it directly from the list.
   * @param {number} id - Reminder ID.
   */
  async function deleteReminder(id) {
    showConfirm(translations[language].confirmDelete, async () => {
      try {
        const response = await apiRequest(`deleteReminder/${id}`, 'GET', null, true, language);
        const data = await response.json();
        if (response.ok && data.success) {
          chrome.alarms.clear(`reminder-${id}`);
          // Find and remove the reminder element from the DOM
          const unreadLi = document.querySelector(`#unread-reminders-list button[data-id="${id}"]`)?.closest('li');
          const readLi = document.querySelector(`#read-reminders-list button[data-id="${id}"]`)?.closest('li');
          const reminderElement = unreadLi || readLi;
          if (reminderElement) {
            reminderElement.remove();
            console.log(`Reminder with ID ${id} removed from the DOM`);
          } else {
            console.warn(`Reminder with ID ${id} not found in the DOM`);
          }
          showMessage(data.message || translations[language].deleteSuccess, true);
        } else {
          showMessage(data.message || translations[language].failedToDeleteReminder, false);
        }
      } catch (error) {
        console.error('Error deleting reminder:', error);
        showMessage(`${translations[language].error}: ${error.message}`, false);
      }
    }, language);
  }

  /**
   * Update filter options for select elements.
   * @param {string} selectId - ID of the select element.
   * @param {Array} options - Array of option values.
   * @param {string} selected - Currently selected value.
   */
  function updateFilterOptions(selectId, options, selected = '') {
    const select = document.getElementById(selectId);
    if (select) {
      const allOptionKey = {
        'category-filter': 'allCategories',
        'complexity-filter': 'allComplexities',
        'domain-filter': 'allDomains'
      }[selectId];
      if (!options || options.length === 0) {
        console.warn(`No options provided for ${selectId}, using default`);
        options = [];
      }
      select.innerHTML = `<option value="">${translations[language][allOptionKey]}</option>` +
        options.map(opt =>
          `<option value="${opt}" ${opt === selected ? 'selected' : ''}>${opt}</option>`
        ).join('');
      console.log(`Updated ${selectId} with options:`, options);
    } else {
      console.error(`Element with ID ${selectId} not found`);
    }
  }

  loadReminders(true);
}

// Call initializeRemindersScreen on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initializeRemindersScreen(showScreen => {
    window.location.href = chrome.runtime.getURL(showScreen);
  });
});