/*
- Author: Gemini
- OS support: Cross-platform
- Description: Handles data synchronization with Google Firestore.
*/

let syncModuleInitialized = false;
let autoSyncTimer = null;

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

    } catch (error) {
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
        const allProjects = await db.projects.toArray();
        for (const project of allProjects) {
            await syncProjectToFirestore(project.id);
        }
        console.log("Auto-sync finished.");
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
function handleAuthStateChangeForSync(event) {
    if (event.detail.user) {
        console.log("User signed in. Sync module is active.");
        if (loadSettings().autoSyncEnabled) startAutoSync();
    } else {
        console.log("User signed out. Sync module is inactive.");
        stopAutoSync();
    }
}

function initializeSyncModule() {
    if (syncModuleInitialized) return;
    document.addEventListener('auth-state-changed', handleAuthStateChangeForSync);
    syncModuleInitialized = true;
    console.log("Firebase Sync Module Initialized.");
}