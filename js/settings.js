let settingsModuleInitialized = false;

function initializeSettingsModule() {
    if (settingsModuleInitialized) return;
    // Sync settings are now handled automatically by the real-time sync module.
    settingsModuleInitialized = true;
}