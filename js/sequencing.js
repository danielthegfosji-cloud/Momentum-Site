let sequencingProjectName, sequencesOverviewTbody, unsequencedTasksList, sequenceEditModal, 
    sequenceModalClose, sequenceModalTitle, sequenceEditForm, editingTaskIdInput, 
    modalPredecessorsSelect, modalSuccessorsSelect;

const openSequenceEditModal = () => sequenceEditModal.style.display = 'block';
const closeSequenceEditModal = () => sequenceEditModal.style.display = 'none';

const displayUnsequencedTasks = async (allTasks, allLinks) => {
    const sequencedIds = new Set();
    allLinks.forEach(link => {
        sequencedIds.add(link.predecessorId);
        sequencedIds.add(link.successorId);
    });

    unsequencedTasksList.innerHTML = '';
    const unsequencedTasks = allTasks.filter(task => !sequencedIds.has(task.uniqueId));
    
    if (unsequencedTasks.length === 0) {
        unsequencedTasksList.innerHTML = '<li>All tasks are sequenced!</li>';
    } else {
        unsequencedTasks.forEach(task => {
            const li = document.createElement('li');
            li.textContent = task.displayName;
            li.dataset.id = task.uniqueId;
            li.style.cursor = 'pointer';
            unsequencedTasksList.appendChild(li);
        });
    }
};

const displaySequencesOverview = async () => {
    let allTasks = await getAllProjectTasks(currentSequencingProjectId); 
    const allLinks = await db.tasks.where('projectId').equals(currentSequencingProjectId).toArray();
    const pertData = await getPertCpmData(currentSequencingProjectId, true);

    const taskMap = new Map(allTasks.map(t => [t.uniqueId, { ...t, predecessors: [], successors: [] }]));
    taskMap.set('PROJECT_START', { uniqueId: 'PROJECT_START', displayName: '-- Project Start --', successors: [] });
    taskMap.set('PROJECT_END', { uniqueId: 'PROJECT_END', displayName: '-- Project End --', predecessors: [] });

    const subtaskParentMap = new Map();
allTasks.forEach(task => {
    if (task.type === 'subquantity') {
        const parentId = `qty-${task.quantityId}`;
        if (!subtaskParentMap.has(parentId)) subtaskParentMap.set(parentId, []);
        subtaskParentMap.get(parentId).push(task.uniqueId);
    }
});

allLinks.forEach(link => {
    const predecessors = subtaskParentMap.get(link.predecessorId) || [link.predecessorId];
    const successors = subtaskParentMap.get(link.successorId) || [link.successorId];

    for (const predId of predecessors) {
        for (const succId of successors) {
            const predTask = taskMap.get(predId);
            const succTask = taskMap.get(succId);
            if (predTask && succTask) {
                succTask.predecessors.push(predTask.displayName);
                predTask.successors.push(succTask.displayName);
            }
        }
    }
});
    
    displayUnsequencedTasks(allTasks, allLinks);

    sequencesOverviewTbody.innerHTML = '';
    if (allTasks.length === 0) {
        sequencesOverviewTbody.innerHTML = '<tr><td colspan="4">No tasks exist for this project.</td></tr>';
        return;
    }

    const sortBy = document.getElementById('sequence-sort').value;
    if (pertData && pertData.tasks) {
        const esMap = new Map(Array.from(pertData.tasks.values()).map(task => [task.id, task.es]));
        const startTaskIds = new Set(allLinks.filter(l => l.predecessorId === 'PROJECT_START').map(l => l.successorId));
        
        allTasks.sort((a, b) => {
            if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
            
            const aIsStart = startTaskIds.has(a.uniqueId);
            const bIsStart = startTaskIds.has(b.uniqueId);
            if (aIsStart && !bIsStart) return -1;
            if (bIsStart && !aIsStart) return 1;
            
            const taskA_es = esMap.get(a.uniqueId) || Infinity;
            const taskB_es = esMap.get(b.uniqueId) || Infinity;
            if (taskA_es === taskB_es) return a.displayName.localeCompare(b.displayName);
            return taskA_es - taskB_es;
        });
    } else {
        allTasks.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    const renderTaskRow = (task) => {
        const data = taskMap.get(task.uniqueId);
        if (!data) return;
        const predecessorsHtml = data.predecessors.length > 0 ? `<ul>${data.predecessors.map(p => `<li>${p}</li>`).join('')}</ul>` : '<em>None</em>';
        const successorsHtml = data.successors.length > 0 ? `<ul>${data.successors.map(s => `<li>${s}</li>`).join('')}</ul>` : '<em>None</em>';
        const row = sequencesOverviewTbody.insertRow();
        row.innerHTML = `
            <td>${predecessorsHtml}</td>
            <td><strong>${data.displayName}</strong></td>
            <td>${successorsHtml}</td>
            <td class="actions-cell">
                <button class="btn btn-warning edit-sequence-btn" data-id="${task.uniqueId}">Edit</button>
            </td>
        `;
    };

    const groupBy = document.getElementById('sequence-group').value;
    if (groupBy === 'category') {
        const groupedTasks = allTasks.reduce((acc, task) => {
            const category = task.category || (task.type === 'changeOrderItem' ? 'Change Orders' : 'Uncategorized');
            if (!acc[category]) acc[category] = [];
            acc[category].push(task);
            return acc;
        }, {});
        Object.keys(groupedTasks).sort().forEach(category => {
            const headerRow = sequencesOverviewTbody.insertRow();
            headerRow.className = 'category-header-row';
            headerRow.innerHTML = `<td colspan="4">${category}</td>`;
            groupedTasks[category].forEach(renderTaskRow);
        });
    } else {
        allTasks.forEach(renderTaskRow);
    }
};

const handleEditSequenceClick = async (taskUniqueId) => {
    const allTasks = await getAllProjectTasks(currentSequencingProjectId);
    const currentTask = allTasks.find(t => t.uniqueId === taskUniqueId);
    if (!currentTask) return;

    sequenceModalTitle.textContent = `Edit Sequence for: ${currentTask.displayName}`;
    editingTaskIdInput.value = taskUniqueId;
    
    const otherTasks = allTasks.filter(t => t.uniqueId !== taskUniqueId);
    modalPredecessorsSelect.innerHTML = `<option value="PROJECT_START">-- Project Start --</option>`;
    modalSuccessorsSelect.innerHTML = `<option value="PROJECT_END">-- Project End --</option>`;
    otherTasks.forEach(t => {
        modalPredecessorsSelect.innerHTML += `<option value="${t.uniqueId}">${t.displayName}</option>`;
        modalSuccessorsSelect.innerHTML += `<option value="${t.uniqueId}">${t.displayName}</option>`;
    });

    const existingPredecessorLinks = await db.tasks.where({ projectId: currentSequencingProjectId, successorId: taskUniqueId }).toArray();
    const existingPredecessorIds = existingPredecessorLinks.map(link => link.predecessorId);
    Array.from(modalPredecessorsSelect.options).forEach(opt => {
        opt.selected = existingPredecessorIds.includes(opt.value);
    });

    const existingSuccessorLinks = await db.tasks.where({ projectId: currentSequencingProjectId, predecessorId: taskUniqueId }).toArray();
    const existingSuccessorIds = existingSuccessorLinks.map(link => link.successorId);
    Array.from(modalSuccessorsSelect.options).forEach(opt => {
        opt.selected = existingSuccessorIds.includes(opt.value);
    });

    openSequenceEditModal();
};

const showSequencesForProject = async (projectId, projectName) => {
    currentSequencingProjectId = projectId;
    sequencingProjectName.textContent = projectName;
    document.getElementById('back-to-sequencing-projects').innerHTML = `&larr; Back to ${projectName}`;
    sequencingTasksView.classList.remove('hidden');
    await displaySequencesOverview();
};

function initializeSequencingModule() {
    sequencingProjectName = document.getElementById('sequencing-project-name');
    sequencesOverviewTbody = document.querySelector('#sequences-overview-tbody');
    unsequencedTasksList = document.getElementById('unsequenced-tasks-list');
    sequenceEditModal = document.getElementById('sequence-edit-modal');
    sequenceModalClose = document.querySelector('.sequence-modal-close');
    sequenceModalTitle = document.getElementById('sequence-modal-title');
    sequenceEditForm = document.getElementById('sequence-edit-form');
    editingTaskIdInput = document.getElementById('editingTaskId');
    modalPredecessorsSelect = document.getElementById('modal-predecessors-multiselect');
    modalSuccessorsSelect = document.getElementById('modal-successors-multiselect');

    sequencesOverviewTbody.addEventListener('click', (e) => {
        const button = e.target.closest('.edit-sequence-btn');
        if (button) {
            handleEditSequenceClick(button.dataset.id);
        }
    });

    unsequencedTasksList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            handleEditSequenceClick(e.target.dataset.id);
        }
    });

    // Add the missing event listeners for the dropdowns
    document.getElementById('sequence-sort').addEventListener('change', displaySequencesOverview);
    document.getElementById('sequence-group').addEventListener('change', displaySequencesOverview);
    document.getElementById('ai-sequence-btn').addEventListener('click', () => {
    runAiSequencing(currentSequencingProjectId);
});

    sequenceModalClose.addEventListener('click', closeSequenceEditModal);

    sequenceEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentTaskId = editingTaskIdInput.value;
        if (!currentTaskId) return;

        const newPredecessorIds = new Set(Array.from(modalPredecessorsSelect.selectedOptions, opt => opt.value));
        const newSuccessorIds = new Set(Array.from(modalSuccessorsSelect.selectedOptions, opt => opt.value));

        await db.transaction('rw', db.tasks, async () => {
            await db.tasks.where({ successorId: currentTaskId, projectId: currentSequencingProjectId }).delete();
            await db.tasks.where({ predecessorId: currentTaskId, projectId: currentSequencingProjectId }).delete();

            const linksToAdd = [];
            newPredecessorIds.forEach(id => linksToAdd.push({ projectId: currentSequencingProjectId, predecessorId: id, successorId: currentTaskId }));
            newSuccessorIds.forEach(id => linksToAdd.push({ projectId: currentSequencingProjectId, predecessorId: currentTaskId, successorId: id }));
            
            if (linksToAdd.length > 0) await db.tasks.bulkAdd(linksToAdd);
        });
        
        closeSequenceEditModal();
        await displaySequencesOverview();
    });
}