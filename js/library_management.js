// js/library_management.js

let libraryManagementModuleInitialized = false;
let importPreviewData = null; // Holds the parsed data for the import modal

const exportLibrary = async () => {
    try {
        const materials = await db.materials.toArray();
        const resources = await db.resources.toArray();
        const crews = await db.crews.toArray();
        const crewComposition = await db.crewComposition.toArray();

        const libraryData = { materials, resources, crews, crewComposition };

        const blob = new Blob([JSON.stringify(libraryData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `constructapp_library_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(URL.createObjectURL(blob));
    } catch (error) {
        console.error("Failed to export library:", error);
        alert("An error occurred while exporting the library.");
    }
};

const processAndPreviewImport = async (data) => {
    try {
        if (!data.materials || !data.resources || !data.crews || !data.crewComposition) {
            throw new Error("Invalid library file format.");
        }

        const existingMaterials = await db.materials.toArray();
        const existingResources = await db.resources.toArray();
        const existingCrews = await db.crews.toArray();

        const existingMaterialNames = new Set(existingMaterials.map(m => m.name));
        const existingResourceKeys = new Set(existingResources.map(r => `${r.name}|${r.type}`));
        const existingCrewNames = new Set(existingCrews.map(c => c.name));

        const newMaterials = data.materials.filter(m => !existingMaterialNames.has(m.name));
        const duplicateMaterials = data.materials.filter(m => existingMaterialNames.has(m.name));

        const newResources = data.resources.filter(r => !existingResourceKeys.has(`${r.name}|${r.type}`));
        const duplicateResources = data.resources.filter(r => existingResourceKeys.has(`${r.name}|${r.type}`));

        const newCrews = data.crews.filter(c => !existingCrewNames.has(c.name));
        const duplicateCrews = data.crews.filter(c => existingCrewNames.has(c.name));

        importPreviewData = {
            newMaterials, duplicateMaterials,
            newResources, duplicateResources,
            newCrews, duplicateCrews,
            fullData: data 
        };

        const previewContentEl = document.getElementById('import-preview-content');
        let html = '';
        const createList = (title, items, nameKey = 'name') => {
            let listHtml = `<h5>${title} (${items.length})</h5>`;
            if (items.length > 0) {
                listHtml += '<ul>';
                items.forEach(item => {
                    listHtml += `<li>${item[nameKey]} ${item.type ? `(${item.type})` : ''}</li>`;
                });
                listHtml += '</ul>';
            } else {
                listHtml += '<p>None</p>';
            }
            return listHtml;
        };
        
        html += createList('New Materials', newMaterials);
        html += createList('Duplicate Materials (will be overwritten)', duplicateMaterials);
        html += '<hr>';
        html += createList('New Resources', newResources);
        html += createList('Duplicate Resources (will be overwritten)', duplicateResources);
        html += '<hr>';
        html += createList('New Crews', newCrews);
        html += createList('Duplicate Crews (will be overwritten)', duplicateCrews);
        
        previewContentEl.innerHTML = html;
        openImportPreviewModal();

    } catch (error) {
        console.error("Failed to process library file:", error);
        alert(`Failed to process library file: ${error.message}`);
    }
};

const executeImport = async (mode) => {
    if (!importPreviewData) return;

    const { newMaterials, newResources, newCrews, fullData } = importPreviewData;
    const materialsToImport = (mode === 'overwrite') ? fullData.materials : newMaterials;
    const resourcesToImport = (mode === 'overwrite') ? fullData.resources : newResources;
    const crewsToImport = (mode === 'overwrite') ? fullData.crews : newCrews;

    closeImportPreviewModal();

    try {
        await db.transaction('rw', db.materials, db.resources, db.crews, db.crewComposition, async () => {
            const stripId = (obj) => {
                const { id, ...rest } = obj;
                return rest;
            };

            if (materialsToImport.length > 0) {
                await db.materials.bulkPut(materialsToImport.map(stripId));
            }
            if (resourcesToImport.length > 0) {
                await db.resources.bulkPut(resourcesToImport.map(stripId));
            }

            const fileCrewMap = new Map(fullData.crews.map(c => [c.id, c]));
            const fileResourceMap = new Map(fullData.resources.map(r => [r.id, r]));

            const crewsToProcess = crewsToImport.map(stripId);
            if (crewsToProcess.length > 0) {
                await db.crews.bulkPut(crewsToProcess);
            }
            
            const allDbCrews = await db.crews.toArray();
            const allDbResources = await db.resources.toArray();
            const dbCrewMap = new Map(allDbCrews.map(c => [c.name, c.id]));
            const dbResourceMap = new Map(allDbResources.map(r => [`${r.name}|${r.type}`, r.id]));
            
            const importedCrewNames = new Set(crewsToImport.map(c => c.name));
            const relevantCompositions = fullData.crewComposition.filter(comp => {
                const crew = fileCrewMap.get(comp.crewId);
                return crew && importedCrewNames.has(crew.name);
            });

            const newCompositions = [];
            for (const comp of relevantCompositions) {
                const crew = fileCrewMap.get(comp.crewId);
                const resource = fileResourceMap.get(comp.resourceId);
                if (crew && resource) {
                    const newCrewId = dbCrewMap.get(crew.name);
                    const newResourceId = dbResourceMap.get(`${resource.name}|${resource.type}`);
                    if (newCrewId && newResourceId) {
                        newCompositions.push({
                            crewId: newCrewId,
                            resourceId: newResourceId,
                            quantity: comp.quantity
                        });
                    }
                }
            }
            
            if (newCompositions.length > 0) {
                const crewIdsToUpdate = newCompositions.map(c => c.crewId);
                await db.crewComposition.where('crewId').anyOf(crewIdsToUpdate).delete();
                await db.crewComposition.bulkAdd(newCompositions);
            }
        });
        alert('Library imported successfully!');
    } catch (error) {
        console.error('Error during library import:', error);
        alert(`A critical error occurred during import: ${error.message}`);
    } finally {
        importPreviewData = null;
    }
};

function initializeLibraryManagementModule() {
    if (libraryManagementModuleInitialized) return;

    const exportBtn = document.getElementById('export-library-btn');
    const importBtn = document.getElementById('import-library-btn');
    const importInput = document.getElementById('import-library-input');
    
    exportBtn.addEventListener('click', exportLibrary);
    importBtn.addEventListener('click', () => importInput.click());
    
    importInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                await processAndPreviewImport(data);
            } catch (error) {
                console.error("Failed to import library:", error);
                alert(`Failed to parse library file: ${error.message}`);
            } finally {
                event.target.value = ''; // Reset file input
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('import-cancel-btn').addEventListener('click', closeImportPreviewModal);
    document.querySelector('.import-preview-modal-close').addEventListener('click', closeImportPreviewModal);
    document.getElementById('import-proceed-duplicates-btn').addEventListener('click', () => executeImport('overwrite'));
    document.getElementById('import-proceed-new-btn').addEventListener('click', () => executeImport('new_only'));
    // document.getElementById('export-library-gdrive-btn').addEventListener('click', saveLibraryToDrive);
    // document.getElementById('import-library-gdrive-btn').addEventListener('click', handleLibraryImportClick);
    
    libraryManagementModuleInitialized = true;
}