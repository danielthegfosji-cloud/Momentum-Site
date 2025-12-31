// --- Google Drive API Configuration ---
const API_KEY = 'AIzaSyAlOvTeEBPIXOiiNa3N9Ai7H4y4Mpd3U0g';
const CLIENT_ID = '994807186446-sgs6mfccb85bqc9t9jv5u91rrsti51mc.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const FOLDER_NAME = 'momentum-projects';

// --- Global State ---
let gapiReady = false;

// --- Initialization ---

/**
 * Called once the Google API client script has loaded.
 */
function gapiLoaded() {
    gapi.load('client:picker', initializeGapiClient);
}

/**
 * Initializes the GAPI client library.
 */
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
    });
    gapiReady = true;
    tryStartApp();
}

/**
 * Checks if both libraries are ready and then starts the main application.
 */
function tryStartApp() {
    // Firebase auth is initialized independently in firebase_config.js
    if (gapiReady) {
        startApp(); // This function is defined in app.js
    }
}

/**
 * Listens for Firebase authentication state changes and updates the UI
 * and GAPI client accordingly.
 */
auth.onAuthStateChanged(user => {
    updateSigninStatus(!!user);
    if (!user) {
        // If user signs out, clear the GAPI token
        gapi.client.setToken('');
    }
});

/**
 * Updates the Sign In/Out button text based on the current auth state.
 * @param {boolean} isSignedIn
 */
function updateSigninStatus(isSignedIn) {
    const authButton = document.getElementById('google-auth-btn');
    if (!authButton) return;

    const buttonTextSpan = authButton.querySelector('.google-btn-text');
    const buttonIconSvg = authButton.querySelector('.google-icon');

    if (buttonTextSpan && buttonIconSvg) {
        if (isSignedIn) {
            buttonIconSvg.style.display = 'none'; // Hide the Google logo when signed in
            buttonTextSpan.textContent = 'Sign Out';
        } else {
            buttonIconSvg.style.display = 'block'; // Show the Google logo when signed out
            buttonTextSpan.textContent = 'Sign In with Google';
        }
    }
}

/**
 * Handles the authentication flow using Firebase.
 * Signs in with Google via a popup or signs the current user out.
 */
function handleAuthClick() {
    if (!auth.currentUser) {
        // User is not signed in, so start the sign-in process.
        auth.signInWithPopup(googleProvider)
            .then((result) => {
                // This gives you a Google Access Token.
                const credential = result.credential;
                const token = credential.accessToken;
                
                // Set the token for the GAPI client to use for Drive API calls
                gapi.client.setToken({ access_token: token });

                console.log("Signed in as:", result.user.displayName);
                updateSigninStatus(true);
            }).catch((error) => {
                console.error("Firebase Auth Error:", error.code, error.message);
                alert(`Google sign-in error: ${error.message}`);
            });
    } else {
        // User is signed in, so sign them out.
        auth.signOut().then(() => {
            console.log("User signed out.");
        }).catch((error) => {
            console.error("Firebase Sign Out Error:", error);
        });
    }
}

/**
 * Gathers all data for a specific project into a single JSON object.
 * @param {number} projectId The ID of the project to package.
 * @returns {Promise<string>} A JSON string of the complete project data.
 */
async function getProjectDataAsJson(projectId) {
    // This ensures all data is fetched before proceeding.
    const [
        project,
        quantities,
        tasks,
        boq,
        changeOrders
    ] = await Promise.all([
        db.projects.get(projectId),
        db.quantities.where({ projectId }).toArray(),
        db.tasks.where({ projectId }).toArray(),
        db.boqs.where({ projectId }).first(),
        db.changeOrders.where({ projectId }).toArray()
    ]);

    const quantityIds = quantities.map(q => q.id);
    const changeOrderIds = changeOrders.map(co => co.id);

    const [
        dupas,
        changeOrderItems
    ] = await Promise.all([
        quantityIds.length > 0 ? db.dupas.where('quantityId').anyOf(quantityIds).toArray() : Promise.resolve([]),
        changeOrderIds.length > 0 ? db.changeOrderItems.where('changeOrderId').anyOf(changeOrderIds).toArray() : Promise.resolve([])
    ]);

    const changeOrderItemIds = changeOrderItems.map(item => item.id);

    const [
        changeOrderDupas,
        qtyAccomplishments,
        coAccomplishments
    ] = await Promise.all([
        changeOrderItemIds.length > 0 ? db.changeOrderDupas.where('changeOrderItemId').anyOf(changeOrderItemIds).toArray() : Promise.resolve([]),
        quantityIds.length > 0 ? db.accomplishments.where('taskId').anyOf(quantityIds).and(r => r.type === 'quantity').toArray() : Promise.resolve([]),
        changeOrderItemIds.length > 0 ? db.accomplishments.where('taskId').anyOf(changeOrderItemIds).and(r => r.type === 'changeOrderItem').toArray() : Promise.resolve([])
    ]);

    const accomplishments = [...qtyAccomplishments, ...coAccomplishments];

    const exportData = {
        project, quantities, dupas, tasks, boq,
        accomplishments, changeOrders, changeOrderItems, changeOrderDupas
    };

    return JSON.stringify(exportData, null, 2);
}

/**
 * Finds the ID of the 'momentum-projects' folder, or creates it if it doesn't exist.
 * @returns {Promise<string>} The ID of the folder.
 */
async function getOrCreateFolderId() {
    const response = await gapi.client.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`,
        fields: 'files(id, name)',
    });
    if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id;
    } else {
        const createResponse = await gapi.client.drive.files.create({
            resource: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
            fields: 'id',
        });
        return createResponse.result.id;
    }
}

/**
 * The main function to trigger saving a project to Google Drive.
 * @param {number} projectId The ID of the project to save.
 */
async function saveProjectToDrive(projectId) {
    if (!auth.currentUser) {
        alert("Please sign in to save your project to Google Drive.");
        handleAuthClick(); // Prompt user to sign in
        return;
    }

    // GAPI token might not be set yet if the page was just loaded.
    // We can get it from the sign-in result, but if the user is already signed in,
    // we need to ensure GAPI has the token. A robust way is to re-authenticate silently
    // or manage the token more explicitly. For this app, we'll rely on the token
    // being set during the initial sign-in. If it's missing, we'll alert the user.
    if (!gapi.client.getToken()) {
        alert("Authentication token is missing. Please try signing out and signing back in.");
        return;
    }

    try {
        const projectJsonString = await getProjectDataAsJson(projectId);
        const project = JSON.parse(projectJsonString).project;
        let fileName = `${project.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;

        alert(`Checking Google Drive for existing files...`);

        const folderId = await getOrCreateFolderId();

        const searchResponse = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and name='${fileName}' and trashed=false`,
            fields: 'files(id)',
        });
        
        let existingFileId = searchResponse.result.files.length > 0 ? searchResponse.result.files[0].id : null;
        let method = 'POST'; // Default to creating a new file

        if (existingFileId) {
            const shouldOverwrite = confirm(`A file named "${fileName}" already exists.\n\nClick 'OK' to overwrite it.\nClick 'Cancel' to save a new file with a "(copy)" suffix.`);
            
            if (shouldOverwrite) {
                // User wants to overwrite. Set method to PATCH to update the existing file.
                method = 'PATCH';
            } else {
                // User wants to save a copy. Reset the file ID and update the filename.
                existingFileId = null; 
                if (fileName.endsWith('.json')) {
                    fileName = fileName.replace('.json', ' (copy).json');
                } else {
                    fileName += ' (copy)';
                }
            }
        }

        alert(`Preparing to ${method === 'PATCH' ? 'overwrite' : 'create'} "${fileName}"...`);

        const metadata = { name: fileName, mimeType: 'application/json' };
        if (!existingFileId) {
            metadata.parents = [folderId];
        }

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            projectJsonString +
            close_delim;

        const path = `/upload/drive/v3/files${existingFileId ? `/${existingFileId}` : ''}`;
        
        const request = gapi.client.request({
            'path': path,
            'method': method,
            'params': { 'uploadType': 'multipart' },
            'headers': { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
            'body': multipartRequestBody
        });

        await request;
        alert(`Project "${project.projectName}" saved successfully as "${fileName}" in the "${FOLDER_NAME}" folder in your Google Drive.`);

    } catch (err) {
        console.error('Error saving to Google Drive:', err);
        alert(`An error occurred while saving the project. The error was: ${err.result?.error?.message || err.message}`);
    }
}

/**
 * Main function to trigger the Google Drive import process.
 */
function handleImportClick() {
     if (!auth.currentUser) {
        alert('Please sign in with Google to import a project from Drive.');
        handleAuthClick();
        return;
    }
    createPicker();
}

/**
 * Creates and displays the Google Picker interface.
 */
async function createPicker() {
    const token = gapi.client.getToken(); // GAPI token should be set from Firebase sign-in
    if (token === null) return;

    // First, get the ID of the dedicated app folder.
    const folderId = await getOrCreateFolderId();

    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes("application/json");
    
    // Tell the Picker to start inside our specific folder.
    view.setParent(folderId);

    const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setAppId('994807186446')
        .setOAuthToken(token.access_token)
        .addView(view)
        .setDeveloperKey(API_KEY)
        .setCallback(pickerCallback)
        .build();
    picker.setVisible(true);
}

/**
 * Callback function that is executed when a user selects a file in the Picker.
 * @param {object} data The data returned from the Picker API.
 */
async function pickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
        const fileId = data.docs[0].id;
        try {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            
            const projectDataString = typeof response.body === 'string' ? response.body : JSON.stringify(response.result);
            const projectData = JSON.parse(projectDataString);
            
            await importProjectData(projectData);

        } catch (error) {
            console.error('Error fetching file from Google Drive:', error);
            alert(`Could not import the selected file. Error: ${error.result?.error?.message || error.message}`);
        }
    }
}
/**
 * Gathers all library data into a single JSON object.
 * @returns {Promise<string>} A JSON string of the complete library data.
 */
async function getLibraryDataAsJson() {
    const [materials, resources, crews, crewComposition] = await Promise.all([
        db.materials.toArray(),
        db.resources.toArray(),
        db.crews.toArray(),
        db.crewComposition.toArray()
    ]);

    const libraryData = { materials, resources, crews, crewComposition };
    return JSON.stringify(libraryData, null, 2);
}

/**
 * Saves the entire library to a file in Google Drive.
 */
async function saveLibraryToDrive() {
    if (!auth.currentUser) {
        alert('Please sign in with Google to save the library to Drive.');
        handleAuthClick();
        return;
    }

    try {
        const libraryJsonString = await getLibraryDataAsJson();
        let fileName = 'momentum_library.json';

        alert(`Saving library to Google Drive...`);

        const folderId = await getOrCreateFolderId();

        const searchResponse = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and name='${fileName}' and trashed=false`,
            fields: 'files(id)',
        });
        
        let existingFileId = searchResponse.result.files.length > 0 ? searchResponse.result.files[0].id : null;
        let method = 'POST';

        if (existingFileId) {
            const shouldOverwrite = confirm(`A library file named "${fileName}" already exists.\n\nClick 'OK' to overwrite it.\nClick 'Cancel' to save a new file with a "(copy)" suffix.`);
            if (shouldOverwrite) {
                method = 'PATCH';
            } else {
                existingFileId = null;
                fileName = 'momentum_library (copy).json';
            }
        }
        
        const metadata = { name: fileName, mimeType: 'application/json' };
        if (!existingFileId) {
            metadata.parents = [folderId];
        }

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const multipartRequestBody =
            delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
            delimiter + 'Content-Type: application/json\r\n\r\n' + libraryJsonString + close_delim;

        const path = `/upload/drive/v3/files${existingFileId ? `/${existingFileId}` : ''}`;
        
        await gapi.client.request({
            'path': path,
            'method': method,
            'params': { 'uploadType': 'multipart' },
            'headers': { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
            'body': multipartRequestBody
        });

        alert(`Library saved successfully as "${fileName}" in your Google Drive.`);

    } catch (err) {
        console.error('Error saving library to Google Drive:', err);
        alert(`An error occurred while saving the library: ${err.result?.error?.message || err.message}`);
    }
}

/**
 * Callback function for the library import picker.
 * @param {object} data The data returned from the Picker API.
 */
async function libraryPickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
        const fileId = data.docs[0].id;
        try {
            const response = await gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
            const libraryData = typeof response.body === 'string' ? JSON.parse(response.body) : response.result;
            
            // This reuses your existing import preview logic from library_management.js
            await processAndPreviewImport(libraryData);

        } catch (error) {
            console.error('Error fetching library file from Google Drive:', error);
            alert(`Could not import the selected file. Error: ${error.result?.error?.message || error.message}`);
        }
    }
}

/**
 * Triggers the Google Drive import process for the library.
 */
async function handleLibraryImportClick() {
     if (!auth.currentUser) {
        alert('Please sign in with Google to import a library from Drive.');
        handleAuthClick();
        return;
    }
    
    const token = gapi.client.getToken();
    if (token === null) return;

    // First, get the ID of the dedicated app folder.
    const folderId = await getOrCreateFolderId();

    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes("application/json");

    // Tell the Picker to start inside our specific folder.
    view.setParent(folderId);

    const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setAppId('994807186446')
        .setOAuthToken(token.access_token)
        .addView(view)
        .setDeveloperKey(API_KEY)
        .setCallback(libraryPickerCallback) // Use the new callback
        .build();
    picker.setVisible(true);
}