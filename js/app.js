// Author: -REPLACE WITH YOUR NAME-
// OS support: -REPLACE WITH YOUR OS SUPPORT-
// Description: Main application entry point, state management, and initialization.

// --- Global State Variables ---
let currentProjectId = null;
let currentDupaProjectId = null;
let currentDupaQuantityId = null;
let currentSequencingProjectId = null;
let currentBoqProjectId = null;
let currentHubProjectId = null;
let appInitialized = false;

const populateInitialDataIfNeeded = async () => {
    try {
        const projectCount = await db.projects.count();
        if (projectCount > 0) {
            return;
        }

        console.log('First-time setup: Populating database with sample data...');

        // Fetch both library files concurrently
        const [libResponse1, libResponse2] = await Promise.all([
            fetch('import samples/Sample Libraries/comprehensive_library.json'),
            fetch('import samples/Sample Libraries/bat-os Materials.json')
        ]);
        const comprehensiveLib = await libResponse1.json();
        const batOsLib = await libResponse2.json();

        // Merge and de-duplicate data from both libraries
        const allMaterials = [...(comprehensiveLib.materials || []), ...(batOsLib.materials || [])];
        const uniqueMaterials = Array.from(new Map(allMaterials.map(m => [m.name.toLowerCase(), m])).values());

        const allResources = [...(comprehensiveLib.resources || []), ...(batOsLib.resources || [])];
        const uniqueResources = Array.from(new Map(allResources.map(r => [`${r.name.toLowerCase()}|${r.type}`, r])).values());
        
        const crews = comprehensiveLib.crews || [];
        const crewComposition = comprehensiveLib.crewComposition || [];

        // Save merged library to the database
        await db.transaction('rw', db.materials, db.resources, db.crews, db.crewComposition, async () => {
            if (uniqueMaterials.length > 0) await db.materials.bulkPut(uniqueMaterials);
            if (uniqueResources.length > 0) await db.resources.bulkPut(uniqueResources);
            if (crews.length > 0) await db.crews.bulkPut(crews);
            if (crewComposition.length > 0) await db.crewComposition.bulkPut(crewComposition);
        });

        // Fetch all three sample project files concurrently
        const [projectResponse1, projectResponse2, projectResponse3, projectResponse4] = await Promise.all([
            fetch('import samples/sample projects/default multistory.json'),
            fetch('import samples/sample projects/commercial_cafe.json'),
            fetch('import samples/sample projects/warehouse_project.json'),
            fetch('import samples/sample projects/new_office_project.json')
        ]);

        const projectData1 = await projectResponse1.json();
        const projectData2 = await projectResponse2.json();
        const projectData3 = await projectResponse3.json();
        const projectData4 = await projectResponse4.json();

        await importProjectData(projectData1);
        await importProjectData(projectData2);
        await importProjectData(projectData3);
        await importProjectData(projectData4);

        alert('Welcome! Four sample projects and an expanded library have been loaded.');
        window.location.reload();

    } catch (error) {
        console.error("Failed to populate initial database:", error);
        alert("There was an error loading the initial sample data.");
    }
};

function startApp() {
    if (appInitialized) return;
    appInitialized = true;

    initializeViewsModule();
    initializeProjectsModule();
    initializeTakeoffModule();
    initializeDupaModule();
    initializeSequencingModule();
    initializeConstructionModule();
    initializeReportsModule();
    initializeChangeOrdersModule();
    initializeDashboardModule();
    initializeMaterialsLibraryModule();
    initializeDupaLibraryModule();
    initializeLibraryManagementModule();
    initializeSettingsModule(); 
    initializeDataManagementModule();
    initializeThemeManagerModule();
    
    initializeSyncModule();
    const authButton = document.getElementById('google-auth-btn');
    if (authButton) {
        authButton.addEventListener('click', handleAuthClick);
    }
    
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
            return;
        }
        const closeButton = event.target.closest('.close-button');
        if (closeButton) {
            const modal = closeButton.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        }
    });

    showDashboard();
}



window.addEventListener('load', () => {
    db.open().then(async () => {
        console.log("Database opened successfully.");
        loadAndApplyTheme(); 
        await populateInitialDataIfNeeded();
        const isDarkMode = document.body.classList.contains('dark-theme');
        mermaid.initialize({ 
            startOnLoad: false,
            theme: isDarkMode ? 'dark' : 'default'
        });
        startApp();
    }).catch(err => {
        console.error("Failed to open db: ", err.stack || err);
    });
});
// --- End of app.js ---