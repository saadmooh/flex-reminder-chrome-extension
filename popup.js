let currentScreen = null;
let language = 'en';

document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('content');
  const token = await new Promise(resolve => chrome.storage.local.get(['token'], r => resolve(r.token)));
    console.log('Token:', token);
  async function showScreen(screenFile, data = null) {
    console.log(`Attempting to load screen: ${screenFile}`); // Debugging
    if (currentScreen !== screenFile) {
      try {
        const response = await fetch(chrome.runtime.getURL(screenFile));
        if (!response.ok) {
          throw new Error(`Failed to fetch ${screenFile}: ${response.statusText}`);
        }
        content.innerHTML = await response.text();
        console.log(`Successfully loaded ${screenFile}`); // Debugging
        currentScreen = screenFile;
        language = await fetchUserLanguage(apiRequest);
        applyLanguage(language);

        // Remove any existing dynamically loaded scripts to avoid duplication
        document.querySelectorAll('script.dynamic').forEach(script => script.remove());
        
        // Clear any global variables that might be redeclared
        if (screenFile === 'reminders.html') {
          window.unreadCurrentPage = undefined;
          window.unreadLastPage = undefined;
          window.readCurrentPage = undefined;
          window.readLastPage = undefined;
          window.isLoadingUnread = undefined;
          window.isLoadingRead = undefined;
          window.unreadHasFetchedLastPage = undefined;
          window.readHasFetchedLastPage = undefined;
          window.activeTab = undefined;
        } else if (screenFile === 'edit-post.html') {
          window.editMode = undefined;
          window.originalImportance = undefined;
          window.originalNextTime = undefined;
        }

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(screenFile.replace('.html', '.js'));
        script.className = 'dynamic'; // Mark as dynamic for cleanup
        script.onload = () => {
          console.log(`Script ${script.src} loaded`); // Debugging
          if (screenFile === 'reminders.html') {
            initializeRemindersScreen(showScreen, language, applyLanguage, apiRequest);
          } else if (screenFile === 'edit-post.html') {
            console.log('Initializing edit-post with data:', data); // Debugging
            initializeEditPostScreen(showScreen, language, applyLanguage, apiRequest, data);
          }
        };
        script.onerror = () => {
          console.error(`Failed to load script ${script.src}`); // Debugging
        };
        document.body.appendChild(script);
      } catch (error) {
        console.error(`Error loading screen ${screenFile}:`, error);
      }
    }
  }

  chrome.storage.local.get(['token'], async (result) => {
    if (!result.token) {
      console.log('No token found, redirecting to auth.html'); // Debugging
      window.location.href = chrome.runtime.getURL('auth.html');
      return;
    }
    await showScreen('reminders.html');
  });
});