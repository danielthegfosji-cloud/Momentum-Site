/*
- Author: Gemini
- OS support: Cross-platform
- Description: Handles logic for the Data Management section, including full backup, import, and reset.
*/

let dataManagementModuleInitialized = false;

const exportAllData = async () => {
    if (!confirm("This will export all projects and library data into a single file. Continue?")) {
        return;
    }
    try {
        const backupData = {};
        const tables = db.tables.map(t => t.name);
        for (const tableName of tables) {
            backupData[tableName] = await db.table(tableName).toArray();
        }

        const fullBackup = {
            metadata: {
                appName: 'Momentum',
                timestamp: new Date().toISOString(),
                schemaVersion: db.verno,
            },
            data: backupData
        };

        const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `momentum_full_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        alert('Full backup exported successfully.');
    } catch (error) {
        console.error("Failed to export all data:", error);
        alert("An error occurred during the backup export.");
    }
};

const importAllData = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const rawData = JSON.parse(e.target.result);
            
            // Handle legacy (direct object) vs new (metadata wrapped) format
            let dataToImport = rawData;
            if (rawData.metadata && rawData.data) {
                dataToImport = rawData.data;
            }

            const tableNamesInData = Object.keys(dataToImport);
            const allAppTableNames = db.tables.map(t => t.name);

            const validTables = tableNamesInData.filter(name => allAppTableNames.includes(name));

            if (validTables.length === 0) {
                throw new Error("The selected file does not appear to be a valid Momentum backup file (no matching tables found).");
            }

            if (confirm('WARNING: Importing a full backup will ERASE all current data in the application. This action cannot be undone. Are you sure you want to continue?')) {
                await db.transaction('rw', allAppTableNames, async () => {
                    for (const tableName of allAppTableNames) {
                        await db.table(tableName).clear();
                    }
                    for (const tableName of validTables) {
                        if (dataToImport[tableName] && dataToImport[tableName].length > 0) {
                            await db.table(tableName).bulkPut(dataToImport[tableName]);
                        }
                    }
                });
                alert('Full backup imported successfully. The application will now reload.');
                window.location.reload();
            }
        } catch (error) {
            console.error("Failed to import backup:", error);
            alert(`Failed to import backup file: ${error.message}`);
        }
    };
    reader.readAsText(file);
};

const resetAllData = async () => {
    if (confirm('EXTREME WARNING: You are about to delete ALL projects, libraries, and settings from this application. This action cannot be undone.')) {
        const confirmation = prompt('Type "DELETE" to confirm irreversible data deletion:');
        if (confirmation === 'DELETE') {
            try {
                await db.close();
                await Dexie.delete('constructionManagerDb');
                alert('All application data has been deleted. The application will now reload.');
                window.location.reload();
            } catch (error) {
                console.error("Failed to delete database:", error);
                alert("An error occurred while trying to reset the application data.");
            }
        } else {
            alert('Reset cancelled. Your data is safe.');
        }
    }
};

function initializeDataManagementModule() {
    if (dataManagementModuleInitialized) return;

    const exportBtn = document.getElementById('export-all-data-btn');
    const importBtn = document.getElementById('import-all-data-btn');
    const importInput = document.getElementById('import-all-data-input');
    const resetBtn = document.getElementById('reset-all-data-btn');

    exportBtn.addEventListener('click', exportAllData);
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
        importAllData(e.target.files[0]);
        e.target.value = '';
    });
    resetBtn.addEventListener('click', resetAllData);

    dataManagementModuleInitialized = true;
}

// --- End of data_management.js ---