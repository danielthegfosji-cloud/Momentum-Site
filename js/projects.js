// Author: -REPLACE WITH YOUR NAME-
// OS support: -REPLACE WITH YOUR OS SUPPORT-
// Description: Logic for the Projects module.

const lotAreaInput = document.getElementById('lotArea');
const floorAreaInput = document.getElementById('floorArea');
const numFloorsInput = document.getElementById('numFloors');
const contractAmountInput = document.getElementById('contractAmount');
const contractDateInput = document.getElementById('contractDate');
const projectStatusInput = document.getElementById('projectStatus');
const targetStartDateInput = document.getElementById('targetStartDate');
const contractDurationInput = document.getElementById('contractDuration');
const projectManagerInput = document.getElementById('projectManager');
const clientContactInput = document.getElementById('clientContact');
const addProjectBtn = document.getElementById('add-project-btn');
const copyProjectBtn = document.getElementById('copy-project-btn');
const copyProjectModal = document.getElementById('copy-project-modal');
const copyProjectModalClose = document.querySelector('.copy-project-modal-close');
const copyProjectForm = document.getElementById('copy-project-form');
const sourceProjectSelect = document.getElementById('source-project-select');
const newProjectNameInputCopy = document.getElementById('new-project-name-copy');
const importProjectBtn = document.getElementById('import-project-btn');
const importProjectInput = document.getElementById('import-project-input');
const projectModal = document.getElementById('project-modal');
const projectModalClose = document.querySelector('.project-modal-close');
const projectForm = document.getElementById('project-form');
const projectsTableBody = document.querySelector('#projects-table tbody');
const projectModalTitle = document.getElementById('modal-title');
const projectIdInput = document.getElementById('projectId');
const projectNameInput = document.getElementById('projectName');
const projectAddressInput = document.getElementById('projectAddress');
const clientNameInput = document.getElementById('clientName');
const projectDescriptionInput = document.getElementById('projectDescription');

let projectsModuleInitialized = false;

const openProjectModal = () => projectModal.style.display = 'block';
const closeProjectModal = () => projectModal.style.display = 'none';
const openCopyProjectModal = () => copyProjectModal.style.display = 'block';
const closeCopyProjectModal = () => copyProjectModal.style.display = 'none';

const showProjectSummary = async (projectId) => {
    currentHubProjectId = projectId;
    try {
        const project = await db.projects.get(projectId);
        if (!project) {
            alert('Project details not found.');
            return;
        }

        showView(projectSummaryView);

        // --- Calculate and Display Progress Bar ---
        const overallProgress = await getProjectActualPercentComplete(projectId);
        document.getElementById('summary-progress-bar').value = overallProgress;
        document.getElementById('summary-progress-percent').textContent = `${overallProgress.toFixed(2)}%`;

        // Populate header and subtitle
        document.getElementById('summary-project-name').textContent = project.projectName;
        document.getElementById('summary-description-subtitle').textContent = project.projectDescription || 'No description provided.';
        
        // --- Populate KPI Cards ---
        document.getElementById('kpi-status').textContent = project.projectStatus || 'N/A';
        document.getElementById('kpi-contract-amount').textContent = project.contractAmount ? project.contractAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) : 'N/A';
        document.getElementById('kpi-project-manager').textContent = project.projectManager || 'N/A';

        // Calculate and display Days Remaining
        const startDate = project.startDate ? new Date(project.startDate) : null;
        const duration = project.contractDuration;
        const daysRemainingEl = document.getElementById('kpi-days-remaining');
        if (project.projectStatus === 'Completed') {
            daysRemainingEl.textContent = 'Done';
        } else if (startDate && duration) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());
            startDate.setHours(0, 0, 0, 0);
            const elapsedDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
            const remainingDays = duration - elapsedDays;
            daysRemainingEl.textContent = remainingDays < 0 ? `${Math.abs(remainingDays)} Overdue` : remainingDays;
        } else {
            daysRemainingEl.textContent = 'N/A';
        }

        // --- Populate Secondary Details ---
        document.getElementById('secondary-client-name').textContent = project.clientName || 'N/A';
        document.getElementById('secondary-address').textContent = project.address || 'N/A';
        document.getElementById('secondary-client-contact').textContent = project.clientContact || 'N/A';
        document.getElementById('secondary-contract-date').textContent = project.contractDate || 'N/A';
        document.getElementById('secondary-target-start').textContent = project.targetStartDate || 'N/A';
        document.getElementById('secondary-duration').textContent = project.contractDuration ? `${project.contractDuration} days` : 'N/A';
        document.getElementById('secondary-lot-area').textContent = project.lotArea ? `${project.lotArea} m²` : 'N/A';
        document.getElementById('secondary-floor-area').textContent = project.floorArea ? `${project.floorArea} m²` : 'N/A';
        document.getElementById('secondary-floors').textContent = project.numFloors || 'N/A';

        // Set dataset attributes for all hub buttons
        const hubButtons = document.querySelectorAll('.hub-buttons button');
        hubButtons.forEach(btn => {
            btn.dataset.id = project.id;
            btn.dataset.name = project.projectName;
        });

        // --- Conditional Button Logic ---
        const lockedBoq = await db.boqs.get({ projectId });
        const approvedCOs = await db.changeOrders.where({ projectId, status: 'Approved' }).count();

        // Baseline reports are always enabled
        document.querySelectorAll('.baseline-report-btn').forEach(btn => {
            btn.disabled = false;
            btn.title = '';
        });

        // Construction buttons depend on the BOQ lock state
        const constructionButtons = document.querySelectorAll('.construction-phase-btn');
        constructionButtons.forEach(btn => {
            if (lockedBoq) {
                btn.disabled = false;
                btn.title = '';
            } else {
                btn.disabled = true;
                btn.title = 'This module requires a locked Bill of Quantities (BOQ).';
            }
        });
        
        // Revised Report buttons require a locked BOQ AND approved change orders
        const revisedReportButtons = document.querySelectorAll('.revised-report-btn');
        revisedReportButtons.forEach(btn => {
            if (lockedBoq && approvedCOs > 0) {
                btn.disabled = false;
                btn.title = '';
            } else {
                btn.disabled = true;
                btn.title = 'Requires a locked BOQ and at least one approved change order.';
            }
        });

    } catch (error) {
        console.error('Failed to show project summary:', error);
        alert('An error occurred while trying to load the project summary.');
    }
};
const exportProject = async (projectId) => {
    try {
        const project = await db.projects.get(projectId);
        if (!project) {
            alert('Project not found.');
            return;
        }
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

        const exportData = { 
            project, 
            quantities, 
            dupas, 
            tasks, 
            boq, 
            accomplishments, 
            changeOrders, 
            changeOrderItems, 
            changeOrderDupas 
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const dateStamp = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${dateStamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export project:', error);
        alert('An error occurred while exporting the project.');
    }
};

const importProjectData = async (data) => {
    if (!data.project || !data.quantities) {
        alert('Invalid project file format.');
        throw new Error('Invalid project file format.');
    }
    const newProjectName = prompt('Please enter a name for the imported project:', `Copy of ${data.project.projectName}`);
    if (!newProjectName) {
        alert('Import cancelled.');
        return;
    }
    data.project.projectName = newProjectName;
    data.project.id = generateULID(); // Generate a new ULID for the imported project
    if (!data.project.startDate) {
        data.project.startDate = null;
    }

    const allTables = db.tables.map(t => t.name);

    try {
        await db.transaction('rw', allTables, async () => {
            const oldToNewTaskIdMap = new Map();
            
            const newProjectId = await db.projects.put(data.project); // Use put since we are providing the ID

            // Process original quantities
            if (data.quantities && data.quantities.length > 0) {
                for (const q of data.quantities) {
                    const oldId = q.id;
                    delete q.id;
                    q.projectId = newProjectId;
                    const newId = await db.quantities.add(q);
                    oldToNewTaskIdMap.set(`qty-${oldId}`, `qty-${newId}`);
                }
            }
            
            // Process change orders and their items
            const changeOrderIdMap = new Map();
            if (data.changeOrders && data.changeOrders.length > 0) {
                 for (const co of data.changeOrders) {
                    const oldCoId = co.id;
                    delete co.id;
                    co.projectId = newProjectId;
                    const newCoId = await db.changeOrders.add(co);
                    changeOrderIdMap.set(oldCoId, newCoId);
                }
            }
            if (data.changeOrderItems && data.changeOrderItems.length > 0) {
                for (const item of data.changeOrderItems) {
                    const oldItemId = item.id;
                    delete item.id;
                    item.changeOrderId = changeOrderIdMap.get(item.changeOrderId);
                    if (item.originalQuantityId) {
                        const newOriginalId = Array.from(oldToNewTaskIdMap.entries())
                                                 .find(([oldStr, newStr]) => oldStr === `qty-${item.originalQuantityId}`);
                        if (newOriginalId) item.originalQuantityId = parseInt(newOriginalId[1].split('-')[1]);
                    }
                    const newItemId = await db.changeOrderItems.add(item);
                    oldToNewTaskIdMap.set(`co-${oldItemId}`, `co-${newItemId}`);
                }
            }

            // Rebuild tasks using the complete ID map
            if (data.tasks && data.tasks.length > 0) {
                const newTasks = data.tasks.map(t => {
                    const getNewId = (oldId) => {
                        if (typeof oldId === 'number') {
                            return oldToNewTaskIdMap.get(`qty-${oldId}`) || oldToNewTaskIdMap.get(`co-${oldId}`) || oldId;
                        }
                        return oldToNewTaskIdMap.get(oldId) || oldId;
                    };

                    const newPredecessorId = getNewId(t.predecessorId);
                    const newSuccessorId = getNewId(t.successorId);

                    return {
                        projectId: newProjectId,
                        predecessorId: newPredecessorId,
                        successorId: newSuccessorId
                    };
                }).filter(t => t.predecessorId && t.successorId);

                if(newTasks.length > 0) await db.tasks.bulkAdd(newTasks);
            }
            
            // Rebuild DUPAs and other related data
            if (data.dupas && data.dupas.length > 0) {
                 const newDupas = data.dupas.map(d => {
                    const newQtyIdStr = oldToNewTaskIdMap.get(`qty-${d.quantityId}`);
                    return newQtyIdStr ? { ...d, id: undefined, quantityId: parseInt(newQtyIdStr.split('-')[1]) } : null;
                }).filter(Boolean);
                if(newDupas.length > 0) await db.dupas.bulkAdd(newDupas);
            }
            if (data.changeOrderDupas && data.changeOrderDupas.length > 0) {
                const newCoDupas = data.changeOrderDupas.map(d => {
                    const newCoItemIdStr = oldToNewTaskIdMap.get(`co-${d.changeOrderItemId}`);
                    return newCoItemIdStr ? { ...d, id: undefined, changeOrderItemId: parseInt(newCoItemIdStr.split('-')[1]) } : null;
                }).filter(Boolean);
                if(newCoDupas.length > 0) await db.changeOrderDupas.bulkAdd(newCoDupas);
            }
            
            if (data.accomplishments && data.accomplishments.length > 0) {
                const newAccomplishments = data.accomplishments.map(a => {
                    const oldUniqueId = a.type === 'changeOrderItem' ? `co-${a.taskId}` : 
                                       (a.subIndex !== null ? `sub-${a.taskId}-${a.subIndex}` : `qty-${a.taskId}`);
                    const newUniqueId = oldToNewTaskIdMap.get(oldUniqueId.split('-').slice(0, 2).join('-')); // map parent task
                    if (!newUniqueId) return null;
                    return {
                        ...a,
                        id: undefined,
                        taskId: parseInt(newUniqueId.split('-')[1])
                    };
                }).filter(Boolean);
                if(newAccomplishments.length > 0) await db.accomplishments.bulkAdd(newAccomplishments);
            }
            
            if (data.boq) {
                for (const category in data.boq.boqData) {
                    data.boq.boqData[category].forEach(item => {
                        const newQtyIdStr = oldToNewTaskIdMap.get(`qty-${item.quantityId}`);
                        if (newQtyIdStr) item.quantityId = parseInt(newQtyIdStr.split('-')[1]);
                    });
                }
                delete data.boq.id;
                data.boq.projectId = newProjectId;
                await db.boqs.add(data.boq);
            }
        });
        alert('Project imported successfully!');
        await displayProjects();
    } catch (error) {
        console.error('Error during project import transaction:', error);
        alert('A critical error occurred during the import process. The operation has been rolled back.');
    }
};

const displayProjects = async () => {
    const allProjects = await db.projects.orderBy('projectName').toArray();
    projectsTableBody.innerHTML = '';
    if (allProjects.length === 0) {
        projectsTableBody.innerHTML = '<tr><td colspan="3">No projects found.</td></tr>';
    } else {
        allProjects.forEach(p => {
            const r = projectsTableBody.insertRow();
            r.innerHTML = `
            <td>${p.projectName}</td>
            <td>${p.projectStatus || 'N/A'}</td>
            <td class="actions-cell">
                <button class="btn btn-primary summary-btn" data-id="${p.id}">Manage Project</button>
                <button class="btn btn-warning edit-btn" data-id="${p.id}" title="Edit Project">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/></svg>
                </button>
                <button class="btn btn-secondary export-btn" data-id="${p.id}" title="Export Project">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
                </button>
                <button class="btn btn-danger delete-btn" data-id="${p.id}" title="Delete Project">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                </button>
            </td>`;
        });
    }
};

function initializeProjectsModule() {
    if (projectsModuleInitialized) return;

    addProjectBtn.addEventListener('click', () => {
        projectModalTitle.textContent = 'Add New Project';
        projectForm.reset();
        projectIdInput.value = '';
        openProjectModal();
    });

    projectModalClose.addEventListener('click', closeProjectModal);

    copyProjectBtn.addEventListener('click', async () => {
        const allProjects = await db.projects.orderBy('projectName').toArray();
        sourceProjectSelect.innerHTML = '<option value="">-- Select a Project --</option>';
        allProjects.forEach(p => {
            sourceProjectSelect.innerHTML += `<option value="${p.id}">${p.projectName}</option>`;
        });
        copyProjectForm.reset();
        openCopyProjectModal();
    });

    copyProjectModalClose.addEventListener('click', closeCopyProjectModal);

    // document.getElementById('import-gdrive-btn').addEventListener('click', () => {
    //     // This function is defined in js/gdrive.js
    //     handleImportClick();
    // });

    copyProjectForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const sourceProjectId = sourceProjectSelect.value;
        const newProjectName = newProjectNameInputCopy.value.trim();

        if (!sourceProjectId || !newProjectName) {
            alert('Please select a source project and provide a new name.');
            return;
        }

        const allTables = db.tables.map(t => t.name);

        try {
            // Step 1: Read all data from the source project outside the transaction
            const sourceProject = await db.projects.get(sourceProjectId);
            const quantities = await db.quantities.where({ projectId: sourceProjectId }).toArray();
            const quantityIds = quantities.map(q => q.id);
            const changeOrders = await db.changeOrders.where({ projectId: sourceProjectId }).toArray();
            const changeOrderIds = changeOrders.map(co => co.id);
            const changeOrderItems = changeOrderIds.length > 0 ? await db.changeOrderItems.where('changeOrderId').anyOf(changeOrderIds).toArray() : [];
            const changeOrderItemIds = changeOrderItems.map(item => item.id);

            const dupas = quantityIds.length > 0 ? await db.dupas.where('quantityId').anyOf(quantityIds).toArray() : [];
            const changeOrderDupas = changeOrderItemIds.length > 0 ? await db.changeOrderDupas.where('changeOrderItemId').anyOf(changeOrderItemIds).toArray() : [];
            const tasks = await db.tasks.where({ projectId: sourceProjectId }).toArray();
            const boq = await db.boqs.where({ projectId: sourceProjectId }).first();
            const qtyAccomplishments = quantityIds.length > 0 ? await db.accomplishments.where('taskId').anyOf(quantityIds).and(r => r.type === 'quantity').toArray() : [];
            const coAccomplishments = changeOrderItemIds.length > 0 ? await db.accomplishments.where('taskId').anyOf(changeOrderItemIds).and(r => r.type === 'changeOrderItem').toArray() : [];
            const accomplishments = [...qtyAccomplishments, ...coAccomplishments];

            // Step 2: Perform all writes in a single transaction
            await db.transaction('rw', allTables, async () => {
                const quantityIdMap = new Map();
                const changeOrderIdMap = new Map();
                const changeOrderItemIdMap = new Map();
                const oldNumericIdToNewUniqueIdMap = new Map();

                // Generate a new ULID for the copied project
                const newProjectId = generateULID();
                const newProjectData = { ...sourceProject, id: newProjectId, projectName: newProjectName };
                // Use 'put' since we are providing the ID
                await db.projects.put(newProjectData);

                for (const q of quantities) {
                    const oldId = q.id;
                    const newId = await db.quantities.add({ ...q, id: undefined, projectId: newProjectId });
                    quantityIdMap.set(oldId, newId);
                    oldNumericIdToNewUniqueIdMap.set(oldId, `qty-${newId}`);
                }

                for (const co of changeOrders) {
                    const oldId = co.id;
                    const newId = await db.changeOrders.add({ ...co, id: undefined, projectId: newProjectId });
                    changeOrderIdMap.set(oldId, newId);
                }

                for (const item of changeOrderItems) {
                    const oldId = item.id;
                    const newItemData = { ...item, id: undefined, changeOrderId: changeOrderIdMap.get(item.changeOrderId) };
                    if (item.originalQuantityId) {
                        newItemData.originalQuantityId = quantityIdMap.get(item.originalQuantityId);
                    }
                    const newId = await db.changeOrderItems.add(newItemData);
                    changeOrderItemIdMap.set(oldId, newId);
                    oldNumericIdToNewUniqueIdMap.set(oldId, `co-${newId}`);
                }

                if (tasks.length > 0) {
                    const newTasks = tasks.map(t => {
                        const oldPredId = parseInt(String(t.predecessorId).split('-')[1]);
                        const oldSuccId = parseInt(String(t.successorId).split('-')[1]);
                        const predecessor = typeof t.predecessorId === 'string' && t.predecessorId.startsWith('qty-') ? `qty-${quantityIdMap.get(oldPredId)}` : (typeof t.predecessorId === 'string' && t.predecessorId.startsWith('co-') ? `co-${changeOrderItemIdMap.get(oldPredId)}` : t.predecessorId);
                        const successor = typeof t.successorId === 'string' && t.successorId.startsWith('qty-') ? `qty-${quantityIdMap.get(oldSuccId)}` : (typeof t.successorId === 'string' && t.successorId.startsWith('co-') ? `co-${changeOrderItemIdMap.get(oldSuccId)}` : t.successorId);
                        return { projectId: newProjectId, predecessorId: predecessor, successorId: successor };
                    }).filter(t => t.predecessorId && t.successorId);
                    if(newTasks.length > 0) await db.tasks.bulkAdd(newTasks);
                }

                if (dupas.length > 0) await db.dupas.bulkAdd(dupas.map(d => ({ ...d, id: undefined, quantityId: quantityIdMap.get(d.quantityId) })));
                if (changeOrderDupas.length > 0) await db.changeOrderDupas.bulkAdd(changeOrderDupas.map(d => ({ ...d, id: undefined, changeOrderItemId: changeOrderItemIdMap.get(d.changeOrderItemId) })));
                
                if (accomplishments.length > 0) {
                    const newAccomplishments = accomplishments.map(a => {
                        const newRecord = { ...a, id: undefined };
                        if (a.type === 'changeOrderItem') {
                            newRecord.taskId = changeOrderItemIdMap.get(a.taskId);
                        } else {
                            newRecord.taskId = quantityIdMap.get(a.taskId);
                        }
                        return newRecord;
                    });
                    if(newAccomplishments.length > 0) await db.accomplishments.bulkAdd(newAccomplishments);
                }

                if (boq) {
                    for (const category in boq.boqData) {
                        boq.boqData[category].forEach(item => {
                            if (item.quantityId && quantityIdMap.has(item.quantityId)) {
                                item.quantityId = quantityIdMap.get(item.quantityId);
                            }
                        });
                    }
                    await db.boqs.add({ ...boq, id: undefined, projectId: newProjectId });
                }
            });
            alert('Project copied successfully!');
            closeCopyProjectModal();
            await displayProjects();
        } catch (error) {
            console.error('Failed to copy project:', error);
            alert('An error occurred while copying the project.');
        }
    });

    importProjectBtn.addEventListener('click', () => {
        importProjectInput.click();
    });

    importProjectInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                await importProjectData(data);
            } catch (error) {
                console.error('Failed to import project:', error);
                alert('Failed to parse project file. Please ensure it is a valid project JSON file.');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    });

    projectForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = projectIdInput.value;
        const projectData = {
            projectName: projectNameInput.value,
            address: projectAddressInput.value,
            clientName: clientNameInput.value,
            projectDescription: projectDescriptionInput.value,
            lotArea: lotAreaInput.value ? parseFloat(lotAreaInput.value) : null,
            floorArea: floorAreaInput.value ? parseFloat(floorAreaInput.value) : null,
            numFloors: numFloorsInput.value ? parseInt(numFloorsInput.value) : null,
            contractAmount: contractAmountInput.value ? parseFloat(contractAmountInput.value) : null,
            contractDate: contractDateInput.value || null,
            projectStatus: projectStatusInput.value || null,
            targetStartDate: targetStartDateInput.value || null,
            contractDuration: contractDurationInput.value ? parseInt(contractDurationInput.value) : null,
            projectManager: projectManagerInput.value || null,
            clientContact: clientContactInput.value || null,
        };
        if (id) {
            await db.projects.update(id, projectData);
        } else {
            projectData.id = generateULID(); // Generate a ULID for the new project
            await db.projects.add(projectData);
        }
        closeProjectModal();
        await displayProjects();
    });

    projectsTableBody.addEventListener('click', async (event) => {
    const target = event.target.closest('button'); // Ensure we target the button itself
    if (!target || !target.dataset.id) return;
    const id = target.dataset.id; // Project ID is now a string (ULID)

    if (target.classList.contains('summary-btn')) {
        showProjectSummary(id);
    }
    if (target.classList.contains('edit-btn')) {
        const p = await db.projects.get(id);
        projectModalTitle.textContent = 'Edit Project';
        projectIdInput.value = p.id;
        projectNameInput.value = p.projectName;
        projectAddressInput.value = p.address;
        clientNameInput.value = p.clientName;
        projectDescriptionInput.value = p.projectDescription;
        lotAreaInput.value = p.lotArea || '';
        floorAreaInput.value = p.floorArea || '';
        numFloorsInput.value = p.numFloors || '';
        contractAmountInput.value = p.contractAmount || '';
        contractDateInput.value = p.contractDate || '';
        projectStatusInput.value = p.projectStatus || 'On-Going';
        targetStartDateInput.value = p.targetStartDate || '';
        contractDurationInput.value = p.contractDuration || '';
        projectManagerInput.value = p.projectManager || '';
        clientContactInput.value = p.clientContact || '';
        openProjectModal();
    }
    if (target.classList.contains('delete-btn')) {
        if (confirm('Are you sure you want to permanently delete this project and ALL of its associated data (quantities, reports, change orders, progress, etc.)? This action cannot be undone.')) {
            try {
                await db.transaction('rw', db.tables.map(t => t.name), async () => {
                    const quantities = await db.quantities.where({ projectId: id }).toArray();
                    const quantityIds = quantities.map(q => q.id);

                    const changeOrders = await db.changeOrders.where({ projectId: id }).toArray();
                    const changeOrderIds = changeOrders.map(co => co.id);

                    let changeOrderItemIds = [];
                    if (changeOrderIds.length > 0) {
                        const changeOrderItems = await db.changeOrderItems.where('changeOrderId').anyOf(changeOrderIds).toArray();
                        changeOrderItemIds = changeOrderItems.map(item => item.id);
                    }

                    if (quantityIds.length > 0) {
                        await db.accomplishments.where('type').equals('quantity').and(record => quantityIds.includes(record.taskId)).delete();
                        await db.dupas.where('quantityId').anyOf(quantityIds).delete();
                    }
                    if (changeOrderItemIds.length > 0) {
                        await db.changeOrderDupas.where('changeOrderItemId').anyOf(changeOrderItemIds).delete();
                    }
                    if (changeOrderIds.length > 0) {
                        await db.changeOrderItems.where('changeOrderId').anyOf(changeOrderIds).delete();
                    }
                    await db.changeOrders.where({ projectId: id }).delete();
                    await db.tasks.where({ projectId: id }).delete();
                    await db.boqs.where({ projectId: id }).delete();
                    await db.quantities.where({ projectId: id }).delete();

                    await db.projects.delete(id);
                });
                alert('Project and all associated data deleted successfully.');
                await displayProjects();
            } catch (error) {
                console.error("Failed to delete project:", error);
                alert("An error occurred while deleting the project and its data.");
            }
        }
    }
    if (target.classList.contains('export-btn')) {
        await exportProject(id);
    }
    // if (target.classList.contains('gdrive-save-btn')) {
    //     await saveProjectToDrive(id);
    // }
    });

    projectsModuleInitialized = true;
}
// --- End of projects.js ---