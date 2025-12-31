let settingsModuleInitialized = false;

// --- DOM References ---
let autoSyncToggle, autoSyncIntervalSelect;

// --- Default Settings ---
const defaultSettings = {
    autoSyncEnabled: false,
    autoSyncInterval: 5, // in minutes
};

/**
 * Loads settings from localStorage or uses defaults.
 */
function loadSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('momentumSettings'));
    return { ...defaultSettings, ...savedSettings };
}

/**
 * Saves a specific setting to localStorage.
 * @param {string} key The setting key to save.
 * @param {any} value The value to save.
 */
function saveSetting(key, value) {
    const settings = loadSettings();
    settings[key] = value;
    localStorage.setItem('momentumSettings', JSON.stringify(settings));
}

/**
 * Applies the loaded settings to the UI elements.
 */
function applySettingsToUI() {
    const settings = loadSettings();
    autoSyncToggle.checked = settings.autoSyncEnabled;
    autoSyncIntervalSelect.value = settings.autoSyncInterval;
}

function initializeSettingsModule() {
    if (settingsModuleInitialized) return;

    autoSyncToggle = document.getElementById('auto-sync-toggle');
    autoSyncIntervalSelect = document.getElementById('auto-sync-interval');

    // Load settings and apply them to the UI when the module starts
    applySettingsToUI();

    // Add event listeners to save changes
    autoSyncToggle.addEventListener('change', (event) => {
        const isEnabled = event.target.checked;

        // Check if user is trying to enable the feature without being signed in.
        if (isEnabled && !auth.currentUser) {
            alert("Please sign in with Google first to enable auto-sync.");
            event.target.checked = false; // Revert the toggle to the "off" position.
            return; // Stop further execution.
        }

        saveSetting('autoSyncEnabled', isEnabled);
        // We will add the logic to start/stop the sync timer here later
        console.log(`Auto-sync ${isEnabled ? 'enabled' : 'disabled'}.`);
    });

    autoSyncIntervalSelect.addEventListener('change', (event) => {
        const interval = parseInt(event.target.value, 10);
        saveSetting('autoSyncInterval', interval);
        // We will add the logic to restart the timer with the new interval here later
        console.log(`Auto-sync interval set to ${interval} minutes.`);
    });

    settingsModuleInitialized = true;
}