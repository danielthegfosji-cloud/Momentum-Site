/*
- Author: Gemini
- OS support: Cross-platform
- Description: Handles data synchronization with Google Firestore.
*/

let syncModuleInitialized = false;
let autoSyncTimer = null;
let lastSyncDate = null;
let lastSyncedTextTimer = null;
let syncHistory = [];
const MAX_HISTORY_ITEMS = 5;

function addSyncHistory(status, message) {
    syncHistory.unshift({
        timestamp: new Date(),
        status: status, // 'success', 'error', 'start'
        message: message
    });
    if (syncHistory.length > MAX_HISTORY_ITEMS) {
        syncHistory.pop();
    }
    // Call render in case the user is on the settings page
    renderSyncHistory();
}

function renderSyncHistory() {
    const logContainer = document.getElementById('sync-history-log');
    if (!logContainer) return; // Exit if the element is not in the current view

    if (syncHistory.length === 0) {
        logContainer.innerHTML = '<li>No sync activity yet.</li>';
        return;
    }

    logContainer.innerHTML = syncHistory.map(entry => {
        const time = entry.timestamp.toLocaleTimeString();
        let statusClass = '';
        let statusIcon = '';
        if (entry.status === 'success') {
            statusClass = 'sync-success';
            statusIcon = '✔️';
        } else if (entry.status === 'error') {
            statusClass = 'sync-error';
            statusIcon = '❌';
        } else { // 'start'
            statusClass = 'sync-start';
            statusIcon = '⏳';
        }
        return `<li class="${statusClass}"><span>${statusIcon} [${time}]</span> ${entry.message}</li>`;
    }).join('');
}

function updateLastSyncedText() {
    const footerTimestamp = document.getElementById('footer-last-synced');
    if (!footerTimestamp || !lastSyncDate) return;

    const now = new Date();
    const isToday = lastSyncDate.getDate() === now.getDate() &&
                    lastSyncDate.getMonth() === now.getMonth() &&
                    lastSyncDate.getFullYear() === now.getFullYear();

    const timeStr = lastSyncDate.toLocaleTimeString();
    const dateStr = lastSyncDate.toLocaleDateString();

    footerTimestamp.textContent = `Last Synced: ${isToday ? timeStr : `${dateStr} ${timeStr}`}`;
}

/**
 * Updates the visual sync status indicator on the dashboard.
 * @param {'syncing'|'synced'|'error'|'offline'|'hidden'} status The status to display.
 * @param {string} [message] An optional message for the tooltip.
 */
function updateSyncStatusIndicator(status, message) {
    const indicator = document.getElementById('sync-status-indicator');
    const footerTimestamp = document.getElementById('footer-last-synced');
    if (!indicator) return;

    // Use a timeout to ensure the class change is applied, especially for animations
    setTimeout(() => {
        indicator.className = 'sync-status-indicator'; // Reset classes
        
        if (lastSyncedTextTimer) {
            clearInterval(lastSyncedTextTimer);
            lastSyncedTextTimer = null;
        }

        if (status !== 'hidden') {
            indicator.classList.add(status);
            
            if (footerTimestamp) {
                footerTimestamp.classList.remove('hidden');
                if (status === 'syncing') {
                    footerTimestamp.textContent = 'Syncing...';
                } else if (status === 'error') {
                    footerTimestamp.textContent = 'Sync Error';
                } else if (status === 'offline') {
                    footerTimestamp.textContent = 'Offline';
                } else if (status === 'synced') {
                    if (message && message.includes('disabled')) {
                        footerTimestamp.textContent = 'Auto-sync disabled';
                    } else {
                        lastSyncDate = new Date();
                        updateLastSyncedText();
                        lastSyncedTextTimer = setInterval(updateLastSyncedText, 60000);
                    }
                }
            }

            switch (status) {
                case 'syncing':
                    indicator.title = message || 'Syncing data with the cloud...';
                    break;
                case 'synced':
                    indicator.title = message || `Last synced: ${new Date().toLocaleTimeString()}`;
                    break;
                case 'error':
                    indicator.title = message || 'Sync error. Check console for details.';
                    break;
                case 'offline':
                    indicator.title = message || 'Offline. Changes will be synced when you reconnect.';
                    break;
            }
        } else {
            if (footerTimestamp) footerTimestamp.classList.add('hidden');
        }
    }, 0);
}

/**
 * Restores a single project object from Firestore into the local Dexie DB.
 * This uses 'put' and 'bulkPut' to perform an "upsert" operation.
 * @param {object} projectData The complete project data object from Firestore.
 */
async function restoreProjectFromCloud(projectData) {
    const allTables = db.tables.map(t => t.name);
    try {
        await db.transaction('rw', allTables, async () => {
            // Using .put() and .bulkPut() will insert or update records,
            // which is exactly what we want for a cloud restore.
            if (projectData.project) await db.projects.put(projectData.project);
            if (projectData.quantities) await db.quantities.bulkPut(projectData.quantities);
            if (projectData.dupas) await db.dupas.bulkPut(projectData.dupas);
            if (projectData.tasks) await db.tasks.bulkPut(projectData.tasks);
            if (projectData.boq) await db.boqs.put(projectData.boq);
            if (projectData.changeOrders) await db.changeOrders.bulkPut(projectData.changeOrders);
            if (projectData.changeOrderItems) await db.changeOrderItems.bulkPut(projectData.changeOrderItems);
            if (projectData.changeOrderDupas) await db.changeOrderDupas.bulkPut(projectData.changeOrderDupas);
            if (projectData.accomplishments) await db.accomplishments.bulkPut(projectData.accomplishments);
        });
        console.log(`Project "${projectData.project.projectName}" restored from cloud.`);
    } catch (error) {
        console.error(`Failed to restore project "${projectData.project.projectName}" from cloud:`, error);
    }
}

/**
 * Fetches all project data from the current user's Firestore collection
 * and restores it to the local database.
 */
async function syncAllDataFromFirestore() {
    if (!currentUser) {
        console.warn("Cannot sync from Firestore: User not logged in.");
        return;
    }
    updateSyncStatusIndicator('syncing', 'Restoring data from cloud...');
    addSyncHistory('start', 'Restoring data from cloud...');

    try {
        const projectsSnapshot = await db_firestore.collection('users').doc(currentUser.uid).collection('projects').get();
        if (projectsSnapshot.empty) {
            console.log("No projects found in the cloud to restore.");
            updateSyncStatusIndicator('synced', 'No cloud data found.');
            addSyncHistory('success', 'No cloud data found to restore.');
            return;
        }

        for (const doc of projectsSnapshot.docs) {
            await restoreProjectFromCloud(doc.data());
        }

        console.log("Cloud restore complete.");
        updateSyncStatusIndicator('synced', 'Cloud data restored.');
        addSyncHistory('success', 'Successfully restored data from cloud.');
        showDashboard(); // Refresh the UI to show the newly downloaded data.
    } catch (error) {
        console.error("Error syncing all data from Firestore:", error);
        updateSyncStatusIndicator('error', 'Failed to restore from cloud.');
        addSyncHistory('error', 'Failed to restore data from cloud.');
    }
}

/**
 * Gathers all data for a specific project into a single JS object.
 * @param {number} projectId The ID of the project to package.
 * @returns {Promise<object|null>} A JS object of the complete project data, or null if project not found.
 */
async function getProjectDataAsObject(projectId) {
    const project = await db.projects.get(projectId);
    if (!project) return null;

    const quantities = await db.quantities.where({ projectId }).toArray();
    const quantityIds = quantities.map(q => q.id);

    const dupas = quantityIds.length > 0 ? await db.dupas.where('quantityId').anyOf(quantityIds).toArray() : [];
    const tasks = await db.tasks.where({ projectId }).toArray();
    const boq = await db.boqs.where({ projectId }).first();
    const changeOrders = await db.changeOrders.where({ projectId }).toArray();
    const changeOrderIds = changeOrders.map(co => co.id);

    const changeOrderItems = changeOrderIds.length > 0 ? await db.changeOrderItems.where('changeOrderId').anyOf(changeOrderIds).toArray() : [];
    const changeOrderItemIds = changeOrderItems.map(item => item.id);
    
    const changeOrderDupas = changeOrderItemIds.length > 0 ? await db.changeOrderDupas.where('changeOrderItemId').anyOf(changeOrderItemIds).toArray() : [];
    
    const qtyAccomplishments = quantityIds.length > 0 ? await db.accomplishments.where('taskId').anyOf(quantityIds).and(r => r.type === 'quantity').toArray() : [];
    const coAccomplishments = changeOrderItemIds.length > 0 ? await db.accomplishments.where('taskId').anyOf(changeOrderItemIds).and(r => r.type === 'changeOrderItem').toArray() : [];
    const accomplishments = [...qtyAccomplishments, ...coAccomplishments];

    return { 
        project, quantities, dupas, tasks, boq, 
        accomplishments, changeOrders, changeOrderItems, changeOrderDupas 
    };
}

/**
 * Saves a single project's data to Firestore.
 * @param {number} projectId The local ID of the project to sync.
 */
async function syncProjectToFirestore(projectId) {
    if (!currentUser) {
        console.warn(`Sync failed for project ${projectId}: User not logged in.`);
        return;
    }

    console.log(`Syncing project ${projectId} to Firestore...`);
    try {
        updateSyncStatusIndicator('syncing');
        const projectData = await getProjectDataAsObject(projectId);
        if (!projectData) {
            console.error(`Project with ID ${projectId} not found for syncing.`);
            return;
        }

        // Use the local project ID as the document ID in Firestore for easy mapping.
        const projectDocRef = db_firestore.collection('users').doc(currentUser.uid).collection('projects').doc(String(projectId));
        
        // Firestore can't store `undefined` values. This trick cleans the data.
        const cleanedData = JSON.parse(JSON.stringify(projectData));

        await projectDocRef.set(cleanedData, { merge: true });
        console.log(`Project ${projectId} synced successfully.`);
        updateSyncStatusIndicator('synced');

    } catch (error) {
        updateSyncStatusIndicator('error');
        console.error(`Error syncing project ${projectId} to Firestore:`, error);
    }
}

/**
 * Starts the auto-sync interval timer.
 */
function startAutoSync() {
    if (autoSyncTimer) stopAutoSync(); // Stop existing timer before starting

    if (!currentUser) {
        console.log("Cannot start auto-sync: user is not logged in.");
        return;
    }
    const settings = loadSettings();
    if (!settings.autoSyncEnabled) {
        console.log("Auto-sync is disabled in settings.");
        return;
    }

    const intervalMinutes = settings.autoSyncInterval;
    console.log(`Starting auto-sync every ${intervalMinutes} minutes.`);
    
    const syncAllProjects = async () => {
        console.log("Auto-sync triggered.");
        addSyncHistory('start', 'Auto-sync triggered.');
        updateSyncStatusIndicator('syncing');
        try {
            const allProjects = await db.projects.toArray();
            for (const project of allProjects) {
                await syncProjectToFirestore(project.id);
            }
            console.log("Auto-sync finished.");
            updateSyncStatusIndicator('synced');
            addSyncHistory('success', 'All projects synced successfully.');
        } catch (error) {
            console.error("Auto-sync failed during project iteration:", error);
            updateSyncStatusIndicator('error', 'Auto-sync failed. Check console.');
            addSyncHistory('error', 'Auto-sync failed. See console for details.');
        }
    };

    syncAllProjects(); // Run once immediately
    autoSyncTimer = setInterval(syncAllProjects, intervalMinutes * 60 * 1000);
}

/**
 * Stops the auto-sync interval timer.
 */
function stopAutoSync() {
    if (autoSyncTimer) {
        console.log("Stopping auto-sync.");
        clearInterval(autoSyncTimer);
        autoSyncTimer = null;
    }
}

/**
 * Handles authentication state changes to start or stop sync processes.
 * @param {CustomEvent} event The auth-state-changed event.
 */
async function handleAuthStateChangeForSync(event) {
    if (event.detail.user) {
        console.log("User signed in. Sync module is active.");
        if (navigator.onLine) {
            const projectCount = await db.projects.count();
            const settings = loadSettings();

            if (projectCount === 0) {
                console.log("Local database is empty. Attempting to restore from cloud.");
                await syncAllDataFromFirestore();
                // After restoring, start the regular auto-sync if it's enabled.
                if (settings.autoSyncEnabled) {
                    startAutoSync();
                }
            } else {
                console.log("Local data found. Proceeding with normal sync-to-cloud.");
                if (settings.autoSyncEnabled) {
                    startAutoSync();
                } else {
                    updateSyncStatusIndicator('synced', 'Ready. Auto-sync is disabled.');
                }
            }
        } else {
            updateSyncStatusIndicator('offline');
        }
    } else {
        console.log("User signed out. Sync module is inactive.");
        stopAutoSync();
        updateSyncStatusIndicator('hidden');
    }
}

function initializeSyncModule() {
    if (syncModuleInitialized) return;
    document.addEventListener('auth-state-changed', handleAuthStateChangeForSync);

    window.addEventListener('online', () => {
        console.log('App is online.');
        handleAuthStateChangeForSync({ detail: { user: currentUser } }); // Re-evaluate sync status
    });

    window.addEventListener('offline', () => {
        console.log('App is offline.');
        if (currentUser) updateSyncStatusIndicator('offline');
        stopAutoSync();
    });

    // Initial render for when the page loads
    renderSyncHistory();

    syncModuleInitialized = true;
    console.log("Firebase Sync Module Initialized.");
}