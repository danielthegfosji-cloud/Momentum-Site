// Author: Gemini
// OS support: Cross-platform
// Description: Logic for the construction phase modules, including accomplishment tracking and reporting.

let currentConstructionProjectId = null;
let trackingGanttChart = null;
let trackingSCurveChart = null;

const accomplishmentProjectName = document.getElementById('accomplishment-project-name');
const accomplishmentEntryView = document.getElementById('accomplishment-entry-view');
const accomplishmentDateInput = document.getElementById('accomplishment-date');
const accomplishmentTableBody = document.querySelector('#accomplishment-table tbody');
const accomplishmentForm = document.getElementById('accomplishment-form');
const backToAccomplishmentProjectsBtn = document.getElementById('back-to-accomplishment-projects');
const trackingGanttChartView = document.getElementById('tracking-gantt-chart-view');
const trackingGanttProjectName = document.getElementById('tracking-gantt-project-name');
const backToTrackingGanttProjectsBtn = document.getElementById('back-to-tracking-gantt-projects');
const trackingSCurveChartView = document.getElementById('tracking-s-curve-chart-view');
const trackingSCurveProjectName = document.getElementById('tracking-s-curve-project-name');
const trackingSCurveCanvas = document.getElementById('tracking-s-curve-chart');
const backToTrackingSCurveProjectsBtn = document.getElementById('back-to-tracking-s-curve-projects');

// Add this entire function to the file.

const getAllProjectTasks = async (projectId) => {
    // 1. Get all base items
    const quantities = await db.quantities.where({ projectId }).toArray();
    const approvedChangeOrders = await db.changeOrders.where({ projectId, status: 'Approved' }).toArray();
    const approvedChangeOrderIds = approvedChangeOrders.map(co => co.id);
    const changeOrderItems = approvedChangeOrderIds.length > 0
        ? await db.changeOrderItems.where('changeOrderId').anyOf(approvedChangeOrderIds).toArray()
        : [];

    const expandedTasks = [];

    // 2. Create a uniqueId for each task and sub-task
    quantities.forEach(q => {
        if (q.subquantities && q.subquantities.length > 0) {
            q.subquantities.forEach((sub, index) => {
                expandedTasks.push({
                    ...q,
                    id: q.id, // Keep original ID for DUPA linking
                    subIndex: index,
                    uniqueId: `sub-${q.id}-${index}`,
                    displayName: `${q.scopeOfWork}: ${sub.name}`,
                    quantity: sub.quantity, // Use sub-quantity value
                    type: 'subquantity'
                });
            });
        } else {
            expandedTasks.push({
                ...q,
                uniqueId: `qty-${q.id}`,
                displayName: q.scopeOfWork,
                type: 'quantity'
            });
        }
    });

    changeOrderItems.forEach(ci => {
        expandedTasks.push({
            ...ci,
            uniqueId: `co-${ci.id}`,
            displayName: `(CO) ${ci.scopeOfWork}`,
            type: 'changeOrderItem'
        });
    });

    return expandedTasks;
};
const showAccomplishmentList = (projectId) => {
    document.getElementById('accomplishment-entry-view').classList.add('hidden');
    document.getElementById('accomplishment-detail-view').classList.add('hidden');
    document.getElementById('accomplishment-list-view').classList.remove('hidden');
    displayAccomplishmentHistory(projectId);
};

const showAccomplishmentDetail = (projectId, date) => {
    document.getElementById('accomplishment-list-view').classList.add('hidden');
    document.getElementById('accomplishment-detail-view').classList.remove('hidden');
    displayAccomplishmentDetails(projectId, date);
};
const calculateDupaTotalCost = (dupa) => {
    if (!dupa || !dupa.directCosts || !Array.isArray(dupa.directCosts) || dupa.directCosts.length === 0) return 0;
    
    const directCostsTotal = dupa.directCosts.reduce((total, dc) => {
        if (!dc) return total;
        switch (dc.type) {
            case 'labor':
                if (dc.costType === 'lot') {
                    return total + (dc.amount || 0);
                }
                return total + ((dc.mandays || 0) * (dc.rate || 0));
            case 'material':
                return total + ((dc.quantity || 0) * (dc.unitPrice || 0));
            case 'equipment':
                return total + ((dc.hours || 0) * (dc.rate || 0));
            default:
                return total;
        }
    }, 0);

    const ocmPercent = dupa.indirectCosts?.ocm || 0;
    const profitPercent = dupa.indirectCosts?.profit || 0;
    const taxesPercent = dupa.indirectCosts?.taxes || 0;

    const ocmCost = directCostsTotal * (ocmPercent / 100);
    const profitCost = directCostsTotal * (profitPercent / 100);
    const totalBeforeTax = directCostsTotal + ocmCost + profitCost;
    const taxCost = totalBeforeTax * (taxesPercent / 100);
    const finalTotal = totalBeforeTax + taxCost;

    return Math.round(finalTotal * 100) / 100;
};

// 1. ADD THIS NEW, UNIFIED FUNCTION
// This is the new "source of truth" for fetching all task types with their real-time progress.
const getProjectTasks = async (projectId) => {
    // 1. Get all base items
    const quantities = await db.quantities.where({ projectId }).toArray();
    const approvedChangeOrders = await db.changeOrders.where({ projectId, status: 'Approved' }).toArray();
    const approvedChangeOrderIds = approvedChangeOrders.map(co => co.id);
    const changeOrderItems = approvedChangeOrderIds.length > 0
        ? await db.changeOrderItems.where('changeOrderId').anyOf(approvedChangeOrderIds).toArray()
        : [];

    // 2. Get all DUPAs to calculate costs
    const quantityIds = quantities.map(q => q.id);
    const changeOrderItemIds = changeOrderItems.map(ci => ci.id);
    const dupas = await db.dupas.where('quantityId').anyOf(quantityIds).toArray();
    const coDupas = changeOrderItemIds.length > 0 ? await db.changeOrderDupas.where('changeOrderItemId').anyOf(changeOrderItemIds).toArray() : [];
    const dupaMap = new Map();
    dupas.forEach(d => dupaMap.set(d.quantityId, d));
    coDupas.forEach(d => dupaMap.set(d.changeOrderItemId, d));

    // 3. Get all accomplishment records to calculate progress
    const qtyAccomplishments = await db.accomplishments.where('taskId').anyOf(quantityIds).and(r => r.type === 'quantity').toArray();
    const coAccomplishments = changeOrderItemIds.length > 0 ? await db.accomplishments.where('taskId').anyOf(changeOrderItemIds).and(r => r.type === 'changeOrderItem').toArray() : [];
    const allAccomplishments = [...qtyAccomplishments, ...coAccomplishments];

    const progressMap = new Map();
    allAccomplishments.forEach(acc => {
        let key;
        if (acc.type === 'changeOrderItem') key = `co-${acc.taskId}`;
        else key = (acc.subIndex !== null) ? `sub-${acc.taskId}-${acc.subIndex}` : `qty-${acc.taskId}`;
        progressMap.set(key, (progressMap.get(key) || 0) + acc.percentComplete);
    });

    // This line initializes the array before we add items to it.
    const expandedTasks = [];

    // 4. Build the final list of tasks, ignoring sub-quantities
    quantities.forEach(q => {
        const dupa = dupaMap.get(q.id);
        const parentTotalCost = calculateDupaTotalCost(dupa);

        // Always treat the item as a single, parent-level task and ignore subquantities
        const uniqueId = `qty-${q.id}`;
        expandedTasks.push({
            ...q, uniqueId: uniqueId, displayName: q.scopeOfWork, type: 'quantity',
            percentComplete: Math.min(100, progressMap.get(uniqueId) || 0),
            cost: parentTotalCost
        });
    });

    changeOrderItems.forEach(ci => {
        const uniqueId = `co-${ci.id}`;
        const totalCost = calculateDupaTotalCost(dupaMap.get(ci.id));
        expandedTasks.push({
            ...ci, uniqueId: uniqueId, displayName: `(CO) ${ci.scopeOfWork}`,
            type: 'changeOrderItem',
            percentComplete: Math.min(100, progressMap.get(uniqueId) || 0),
            cost: totalCost
        });
    });

    // Sorting by display name is a sensible default
    return expandedTasks.sort((a, b) => a.displayName.localeCompare(b.displayName));
};


// 2. REPLACE your existing getAllTasksForReport function with this one.
// It now uses the new function and provides the data in the format your reports expect.
const getAllTasksForReport = async (projectId, isRevised = false) => {
    let allTasks = await getProjectTasks(projectId);

    // If this is not a revised report, filter out the change order items
    // to ensure we are only using the original, baseline scope.
    if (!isRevised) {
        allTasks = allTasks.filter(task => task.type !== 'changeOrderItem');
    }
    
    // Reports also need the DUPA data, so we'll fetch that here.
    const quantities = await db.quantities.where({ projectId }).toArray();
    const quantityIds = quantities.map(q => q.id);
    let allDupas = quantityIds.length > 0 ? await db.dupas.where('quantityId').anyOf(quantityIds).toArray() : [];
    
    if (isRevised) {
        const approvedChangeOrders = await db.changeOrders.where({ projectId, status: 'Approved' }).toArray();
        const approvedChangeOrderIds = approvedChangeOrders.map(co => co.id);
        const changeOrderItems = approvedChangeOrderIds.length > 0 ? await db.changeOrderItems.where('changeOrderId').anyOf(approvedChangeOrderIds).toArray() : [];
        const changeOrderItemIds = changeOrderItems.map(item => item.id);
        if (changeOrderItemIds.length > 0) {
            const changeOrderDupas = await db.changeOrderDupas.where('changeOrderItemId').anyOf(changeOrderItemIds).toArray();
            allDupas.push(...changeOrderDupas);
        }
    }

    return { allTasks, allDupas };
};


// 3. REPLACE your existing getAllAccomplishmentTasks function with this one.
// It now just calls our new, reliable function.
const getAllAccomplishmentTasks = async (projectId) => {
    return await getProjectTasks(projectId);
};

const getPertCpmData = async (projectId, isRevised = false) => {
    const allTasksForReport = await getAllTasksForReport(projectId, isRevised);
    const allTasks = allTasksForReport.allTasks; // This now comes from the corrected function
    const allDupas = allTasksForReport.allDupas;
    const links = await db.tasks.where({ projectId }).toArray();

    if (allTasks.length === 0) return null;

    const dupaMap = new Map();
    allDupas.forEach(d => {
        const key = d.quantityId || d.changeOrderItemId;
        dupaMap.set(key, d);
    });

    const tasks = new Map(allTasks.map(t => {
        const dupa = dupaMap.get(t.type === 'subquantity' ? t.quantityId : t.id);
        const duration = dupa?.duration || 0;
        return [t.uniqueId, { id: t.uniqueId, name: t.displayName, duration, es: 0, ef: 0, ls: 0, lf: 0, predecessors: new Set(), successors: new Set() }];
    }));

    tasks.set('PROJECT_START', { id: 'PROJECT_START', name: 'Start', duration: 0, es: 0, ef: 0, ls: 0, lf: 0, predecessors: new Set(), successors: new Set() });
    tasks.set('PROJECT_END', { id: 'PROJECT_END', name: 'End', duration: 0, es: 0, ef: 0, ls: 0, lf: 0, predecessors: new Set(), successors: new Set() });

    const subtaskParentMap = new Map();
    allTasks.forEach(task => {
        if (task.type === 'subquantity') {
            const parentId = `qty-${task.quantityId}`;
            if (!subtaskParentMap.has(parentId)) subtaskParentMap.set(parentId, []);
            subtaskParentMap.get(parentId).push(task.uniqueId);
        }
    });

    links.forEach(link => {
        const predecessors = subtaskParentMap.get(link.predecessorId) || [link.predecessorId];
        const successors = subtaskParentMap.get(link.successorId) || [link.successorId];

        for (const pred of predecessors) {
            for (const succ of successors) {
                if (tasks.has(pred) && tasks.has(succ)) {
                    tasks.get(succ).predecessors.add(pred);
                    tasks.get(pred).successors.add(succ);
                }
            }
        }
    });
    
    const sortedNodes = [];
    const queue = new Map();
    tasks.forEach((task, id) => {
        queue.set(id, task.predecessors.size);
        if (task.predecessors.size === 0) sortedNodes.push(id);
    });

    let head = 0;
    while (head < sortedNodes.length) {
        const currentId = sortedNodes[head++];
        const currentNode = tasks.get(currentId);
        if (!currentNode) continue;
        currentNode.ef = currentNode.es + currentNode.duration;
        currentNode.successors.forEach(succId => {
            const succNode = tasks.get(succId);
            if (succNode) {
                succNode.es = Math.max(succNode.es, currentNode.ef);
                const newPredCount = queue.get(succId) - 1;
                queue.set(succId, newPredCount);
                if (newPredCount === 0) sortedNodes.push(succId);
            }
        });
    }

    const projectDuration = tasks.get('PROJECT_END')?.ef || 0;
    tasks.forEach(task => task.lf = projectDuration);

    for (let i = sortedNodes.length - 1; i >= 0; i--) {
        const currentId = sortedNodes[i];
        const currentNode = tasks.get(currentId);
        if (!currentNode) continue;
        if (currentNode.successors.size === 0) currentNode.lf = projectDuration;
        currentNode.ls = currentNode.lf - currentNode.duration;
        currentNode.predecessors.forEach(predId => {
            const predNode = tasks.get(predId);
            if (predNode) predNode.lf = Math.min(predNode.lf, currentNode.ls);
        });
    }

    return { tasks, quantities: allTasks, projectDuration, links, allDupas };
};

const getSCurveData = async (projectId, isRevised = false) => {
    const pertData = await getPertCpmData(projectId, isRevised);
    const project = await db.projects.get(projectId);

    if (!pertData || pertData.projectDuration === 0) return null;

    const { tasks, quantities, projectDuration } = pertData;
    
    const { allDupas } = await getAllTasksForReport(projectId, isRevised);
    const dupaMap = new Map();
    allDupas.forEach(d => {
        const key = d.quantityId || d.changeOrderItemId;
        dupaMap.set(key, d);
    });

// Correctly calculate the grand total cost by summing the 'cost' property,
    // which is already calculated by getProjectTasks() and included in the 'quantities' array.
    const grandTotalCost = quantities.reduce((sum, task) => sum + (task.cost || 0), 0);

    if (grandTotalCost === 0) return null;

const dailyCosts = new Array(projectDuration + 1).fill(0);
    quantities.forEach(q => {
        const task = tasks.get(q.uniqueId); // Use the correct uniqueId for lookup
        if (!task || !task.duration) return; // Skip tasks with no duration

        const totalTaskCost = q.cost || 0; // Use the reliable pre-calculated cost
        const costPerDay = totalTaskCost / task.duration;

        for (let day = task.es; day < task.ef; day++) {
            if (day < dailyCosts.length) {
                dailyCosts[day] += costPerDay;
            }
        }
    });

    let cumulativeSum = 0;
    const cumulativeCosts = Array.from({ length: projectDuration }, (_, i) => {
        cumulativeSum += dailyCosts[i];
        return cumulativeSum;
    });
    
    const plannedPercentage = cumulativeCosts.map(cost => (cost / grandTotalCost) * 100);

    const labels = [];
    if (project.startDate) {
        const projectStartDate = new Date(project.startDate);
        projectStartDate.setMinutes(projectStartDate.getMinutes() + projectStartDate.getTimezoneOffset());
        const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
        for (let i = 0; i < projectDuration; i++) {
            const currentDate = new Date(projectStartDate);
            currentDate.setDate(currentDate.getDate() + i);
            labels.push(dateFormatter.format(currentDate));
        }
    } else {
        for (let i = 0; i < projectDuration; i++) {
            labels.push(`Day ${i + 1}`);
        }
    }

    return {
        labels: labels,
        plannedPercentage: plannedPercentage,
        cumulativeCosts: cumulativeCosts, // Add cumulative costs for the tooltip
        grandTotalCost: grandTotalCost,
        projectDuration: projectDuration
    };
};


const populateAccomplishmentTable = async (projectId) => {
    try {
        console.log('Fetching all accomplishment tasks...');
        const allTasks = await getAllAccomplishmentTasks(projectId);
        console.log(`Found ${allTasks.length} tasks.`);
        const pertData = await getPertCpmData(projectId, true);
        console.log('PERT data fetched for sorting.');
        
        if (pertData && pertData.tasks) {
            const esMap = new Map();
            pertData.tasks.forEach((task, id) => esMap.set(id, task.es));
            allTasks.sort((a, b) => (esMap.get(a.id) || Infinity) - (esMap.get(b.id) || Infinity) || a.displayName.localeCompare(b.displayName));
            console.log('Tasks sorted by Early Start date.');
        }
        
        accomplishmentTableBody.innerHTML = '';
        if (allTasks.length === 0) {
            accomplishmentTableBody.innerHTML = '<tr><td colspan="3">No tasks found for this project.</td></tr>';
            console.log('Rendered empty table message.');
            return;
        }

        allTasks.forEach(task => {
            const row = accomplishmentTableBody.insertRow();
            const overallProgress = task.percentComplete || 0;
            row.dataset.taskId = task.id;
            row.dataset.parentQuantityId = task.parentQuantityId || task.id;
            row.dataset.isSubtask = !!task.parentQuantityId;
            
            row.innerHTML = `
                <td>${task.displayName}</td>
                <td><progress value="${overallProgress}" max="100"></progress> ${overallProgress.toFixed(2)}%</td>
                <td><input type="number" class="progress-input" min="0" max="${(100 - overallProgress).toFixed(2)}" step="any" placeholder="0.00"> %</td>
            `;
        });
        console.log(`Rendered ${allTasks.length} tasks into the table.`);
    } catch (error) {
        console.error('Error populating accomplishment table:', error);
        accomplishmentTableBody.innerHTML = '<tr><td colspan="3">Could not load tasks due to an error.</td></tr>';
    }
};

const showAccomplishmentForm = async (projectId, projectName) => {
    currentConstructionProjectId = projectId;
    accomplishmentProjectName.textContent = projectName;
    document.getElementById('back-to-accomplishment-projects').innerHTML = `&larr; Back to ${projectName}`;

    showView(accomplishmentView);
    document.getElementById('accomplishment-list-view').classList.add('hidden');
    document.getElementById('accomplishment-detail-view').classList.add('hidden');
    accomplishmentEntryView.classList.remove('hidden');

    accomplishmentDateInput.removeAttribute('readonly');
    document.getElementById('view-past-reports-btn').classList.remove('hidden');
    accomplishmentDateInput.valueAsDate = new Date();
    accomplishmentTableBody.innerHTML = '<tr><td colspan="3">Loading tasks...</td></tr>';
    
    const project = await db.projects.get(projectId);

    const populateTable = async () => {
        let allTasks = await getProjectTasks(projectId);
        const pertData = await getPertCpmData(projectId, true);
        
        const sortBy = document.getElementById('accomplishment-sort').value;
        if (pertData && pertData.tasks) {
            const startTaskIds = new Set(pertData.links
                .filter(link => link.predecessorId === 'PROJECT_START')
                .map(link => link.successorId)
            );

            const esMap = new Map(Array.from(pertData.tasks.values()).map(task => [task.id, task.es]));
            allTasks.sort((a, b) => {
                if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
                if (sortBy === 'progress') return (a.percentComplete || 0) - (b.percentComplete || 0);

                const aIsStart = startTaskIds.has(a.id);
                const bIsStart = startTaskIds.has(b.id);

                if (aIsStart && !bIsStart) return -1;
                if (!aIsStart && bIsStart) return 1;

                const taskA_es = esMap.get(a.id) || Infinity;
                const taskB_es = esMap.get(b.id) || Infinity;
                if (taskA_es === taskB_es) return a.displayName.localeCompare(b.displayName);
                return taskA_es - taskB_es;
            });
        }

        accomplishmentTableBody.innerHTML = '';
        if (allTasks.length === 0) {
            accomplishmentTableBody.innerHTML = '<tr><td colspan="3">No tasks found for this project.</td></tr>';
            return;
        }

        const groupBy = document.getElementById('accomplishment-group').value;

        const renderTaskRow = (task) => {
            const row = accomplishmentTableBody.insertRow();
            const overallProgress = task.percentComplete || 0;
            row.dataset.uniqueId = task.uniqueId;
            row.dataset.type = task.type;
            if (task.type === 'subquantity') {
                row.dataset.quantityId = task.quantityId;
                row.dataset.subquantityIndex = task.subIndex;
            } else {
                row.dataset.quantityId = task.id;
            }
            row.innerHTML = `
                <td>${task.displayName}</td>
                <td><progress value="${overallProgress}" max="100"></progress> ${overallProgress.toFixed(2)}%</td>
                <td><input type="number" class="progress-input" min="0" max="${(100 - overallProgress).toFixed(2)}" step="any" placeholder="0.00"> %</td>
            `;
        };

        if (groupBy === 'category') {
            const groupedTasks = allTasks.reduce((acc, task) => {
                const category = task.category || (task.type === 'changeOrderItem' ? 'Change Orders' : 'Uncategorized');
                if (!acc[category]) acc[category] = [];
                acc[category].push(task);
                return acc;
            }, {});
            
            Object.keys(groupedTasks).sort().forEach(category => {
                const tasksInCategory = groupedTasks[category];
                
                let totalCategoryValue = 0;
                let accomplishedCategoryValue = 0;
                tasksInCategory.forEach(task => {
                    const taskCost = task.cost || 0;
                    totalCategoryValue += taskCost;
                    accomplishedCategoryValue += taskCost * ((task.percentComplete || 0) / 100);
                });
                const categoryWeightedProgress = (totalCategoryValue > 0)
                    ? (accomplishedCategoryValue / totalCategoryValue) * 100
                    : 0;

                const headerRow = accomplishmentTableBody.insertRow();
                headerRow.className = 'category-header-row';
                headerRow.innerHTML = `
                    <td colspan="2">${category}</td>
                    <td style="font-weight: 500;">
                        <progress value="${categoryWeightedProgress}" max="100" style="width: 70%; vertical-align: middle;"></progress> 
                        ${categoryWeightedProgress.toFixed(2)}%
                    </td>
                `;
                tasksInCategory.forEach(renderTaskRow);
            });
        } else {
            allTasks.forEach(renderTaskRow);
        }
    };

    if (!project.startDate) {
        const modal = document.getElementById('start-date-modal');
        const dateInput = document.getElementById('modal-start-date-input');
        const confirmBtn = document.getElementById('set-start-date-btn');

        const onConfirm = async () => {
            const selectedDate = dateInput.value;
            if (selectedDate) {
                await db.projects.update(projectId, { startDate: selectedDate });
                modal.style.display = 'none';
                confirmBtn.removeEventListener('click', onConfirm);
                await populateTable();
            } else {
                alert('Please select a valid start date.');
            }
        };

        dateInput.valueAsDate = new Date();
        modal.style.display = 'block';
        confirmBtn.addEventListener('click', onConfirm);
    } else {
        await populateTable();
    }
};

const displayAccomplishmentHistory = async (projectId) => {
    document.getElementById('accomplishment-list-project-name').textContent = `Past Reports: ${accomplishmentProjectName.textContent}`;
    const historyTableBody = document.querySelector('#accomplishment-history-table tbody');
    if (!historyTableBody) return; // Safety check
    historyTableBody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';

    // 1. Get all tasks, which now includes their calculated costs
    const allTasks = await getProjectTasks(projectId);
    if (allTasks.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="3">No tasks found for this project.</td></tr>';
        return;
    }
    const taskMap = new Map(allTasks.map(t => [t.uniqueId, t]));

    // 2. Calculate the total value of the entire project
    const totalProjectValue = allTasks.reduce((sum, task) => sum + (task.cost || 0), 0);

    // 3. Fetch all accomplishment records for the project
    const quantityTaskIds = allTasks.filter(t => t.type !== 'changeOrderItem').map(t => t.quantityId || t.id);
    const coTaskIds = allTasks.filter(t => t.type === 'changeOrderItem').map(t => t.id);
    const qtyAccomplishments = await db.accomplishments.where('taskId').anyOf(quantityTaskIds).and(r => r.type === 'quantity').toArray();
    const coAccomplishments = coTaskIds.length > 0 ? await db.accomplishments.where('taskId').anyOf(coTaskIds).and(r => r.type === 'changeOrderItem').toArray() : [];
    const allReports = [...qtyAccomplishments, ...coAccomplishments];

    // 4. Group reports by date and sum their cost-weighted "earned value"
    const dailyEarnedValue = allReports.reduce((acc, report) => {
        const date = report.date;
        let taskUniqueId;
        if (report.type === 'changeOrderItem') {
            taskUniqueId = `co-${report.taskId}`;
        } else {
            taskUniqueId = (report.subIndex !== null) ? `sub-${report.taskId}-${report.subIndex}` : `qty-${report.taskId}`;
        }
        
        const task = taskMap.get(taskUniqueId);
        const taskCost = task ? (task.cost || 0) : 0;
        const earnedValue = taskCost * (report.percentComplete / 100);
        
        acc.set(date, (acc.get(date) || 0) + earnedValue);
        return acc;
    }, new Map());
    
    const sortedDates = [...dailyEarnedValue.keys()].sort((a, b) => new Date(b) - new Date(a));

    if (sortedDates.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="3">No past accomplishment reports found.</td></tr>';
        return;
    }

    historyTableBody.innerHTML = '';
    sortedDates.forEach(date => {
        const earnedValueForDay = dailyEarnedValue.get(date);
        // 5. Calculate the day's progress as a percentage of the TOTAL project value
        const weightedPercent = (totalProjectValue > 0) ? (earnedValueForDay / totalProjectValue) * 100 : 0;
        
        const row = historyTableBody.insertRow();
        row.innerHTML = `
            <td>${new Date(date).toLocaleDateString(undefined, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}</td>
            <td><strong>${weightedPercent.toFixed(2)}%</strong></td>
            <td class="actions-cell"><button class="btn btn-primary view-accomplishment-detail-btn" data-date="${date}">View</button></td>
        `;
    });
};
const displayAccomplishmentDetails = async (projectId, date) => {
    document.getElementById('accomplishment-detail-title').textContent = `Report for: ${new Date(date).toLocaleDateString(undefined, { timeZone: 'UTC' })}`;
    document.getElementById('edit-accomplishment-btn').dataset.date = date;
    const detailTableBody = document.querySelector('#accomplishment-detail-table tbody');
    detailTableBody.innerHTML = '<tr><td colspan="2">Loading details...</td></tr>';

    // Use the new, correct getProjectTasks function to get a map of all task names
    const allTasks = await getProjectTasks(projectId);
    const taskMap = new Map(allTasks.map(t => [t.uniqueId, t.displayName]));

    // Fetch the reports for the specific date
    const reportsForDate = await db.accomplishments.where('date').equals(date).toArray();
    // Filter down to only reports for this project (since accomplishments table has no projectId)
    const projectReports = reportsForDate.filter(r => {
        const taskUniqueId = r.type === 'changeOrderItem' ? `co-${r.taskId}` : 
                             (r.subIndex !== null ? `sub-${r.taskId}-${r.subIndex}` : `qty-${r.taskId}`);
        return taskMap.has(taskUniqueId);
    });

    if (projectReports.length === 0) {
        detailTableBody.innerHTML = '<tr><td colspan="2">No accomplishments recorded for this date.</td></tr>';
        return;
    }

    detailTableBody.innerHTML = '';
    projectReports.forEach(report => {
        const taskUniqueId = report.type === 'changeOrderItem' ? `co-${report.taskId}` : 
                             (report.subIndex !== null ? `sub-${report.taskId}-${report.subIndex}` : `qty-${report.taskId}`);
        const taskName = taskMap.get(taskUniqueId) || 'Unknown Task';
        
        const row = detailTableBody.insertRow();
        row.innerHTML = `
            <td>${taskName}</td>
            <td>${report.percentComplete.toFixed(2)}%</td>
        `;
    });
};

const editAccomplishmentReport = async (projectId, date) => {
    // Show the correct view and pre-fill the form for editing
    showView(accomplishmentView);
    accomplishmentEntryView.classList.remove('hidden');
    document.getElementById('accomplishment-list-view').classList.add('hidden');
    document.getElementById('accomplishment-detail-view').classList.add('hidden');
    accomplishmentDateInput.value = date;
    accomplishmentDateInput.setAttribute('readonly', true);
    document.getElementById('view-past-reports-btn').classList.add('hidden');

    // Get the comprehensive list of all tasks using our reliable, updated function
    const allTasks = await getProjectTasks(projectId);
    
    // Fetch all accomplishment records for the specific date using the correct 'date' index
    const reportsForDate = await db.accomplishments.where({ date }).toArray();
    
    // Create a map of the reports using the uniqueId format for easy lookup
    const reportMap = new Map();
    reportsForDate.forEach(r => {
        let key;
        if (r.type === 'changeOrderItem') {
            key = `co-${r.taskId}`;
        } else { // type is 'quantity'
            key = (r.subIndex !== undefined && r.subIndex !== null)
                ? `sub-${r.taskId}-${r.subIndex}`
                : `qty-${r.taskId}`;
        }
        reportMap.set(key, r);
    });

    accomplishmentTableBody.innerHTML = '';
    for (const task of allTasks) {
        const report = reportMap.get(task.uniqueId);
        const overallProgress = task.percentComplete || 0;
        const progressOnDate = report ? report.percentComplete : 0;
        // This is the progress already recorded BEFORE the date we are editing
        const progressBeforeDate = overallProgress - progressOnDate;

        const row = accomplishmentTableBody.insertRow();
        // Set the necessary data attributes for the submit handler
        row.dataset.uniqueId = task.uniqueId;
        row.dataset.type = task.type;
        if (task.type === 'subquantity') {
            row.dataset.quantityId = task.quantityId;
            row.dataset.subquantityIndex = task.subIndex;
        } else {
            row.dataset.quantityId = task.id; // This is the numeric taskId
        }
        if (report) row.dataset.accomplishmentId = report.id;
        
        row.innerHTML = `
            <td>${task.displayName}</td>
            <td><progress value="${progressBeforeDate}" max="100"></progress> ${progressBeforeDate.toFixed(2)}%</td>
            <td><input type="number" class="progress-input" value="${progressOnDate}" min="0" max="${(100 - progressBeforeDate).toFixed(2)}" step="any"> %</td>
        `;
    }
};

const getConstructionReadyProjects = async () => {
    const allProjects = await db.projects.orderBy('projectName').toArray();
    const allBoqs = await db.boqs.toArray();
    const boqProjectIds = new Set(allBoqs.map(b => b.projectId));
    return allProjects.filter(p => boqProjectIds.has(p.id));
};


const showLookAheadReportView = (projectId, projectName) => {
    currentConstructionProjectId = projectId;
    document.getElementById('lookahead-report-view').classList.remove('hidden');
    document.getElementById('back-to-lookahead-projects').innerHTML = `&larr; Back to ${projectName}`;
    document.getElementById('lookahead-project-name').textContent = `Look-Ahead: ${projectName}`;
    document.getElementById('lookahead-start-date').valueAsDate = new Date();
    document.getElementById('lookahead-report-content').innerHTML = `<p class="placeholder-text">Please select a start date and click "Generate Report" to see the look-ahead schedule.</p>`;
    document.getElementById('lookahead-kpi-container').innerHTML = '';
};

const showTrackingGanttChart = async (projectId, projectName) => {
    currentConstructionProjectId = projectId; 
    trackingGanttChartView.classList.remove('hidden');
    trackingGanttProjectName.textContent = `Tracking Gantt: ${projectName}`;
    document.getElementById('back-to-tracking-gantt-projects').innerHTML = `&larr; Back to ${projectName}`;

    const ganttContainer = document.getElementById('tracking-gantt-chart-target');
    ganttContainer.innerHTML = 'Loading Chart...';

    const data = await getPertCpmData(projectId, true);
    const project = await db.projects.get(projectId);

    if (!project.startDate) {
        ganttContainer.innerHTML = '<p>A project start date has not been set...</p>';
        return;
    }
    if (!data || data.quantities.length === 0) {
        ganttContainer.innerHTML = 'No tasks to display.';
        return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const projectStartDate = new Date(project.startDate);
    projectStartDate.setMinutes(projectStartDate.getMinutes() + projectStartDate.getTimezoneOffset());

    let tasksForGantt = data.quantities.map(q => {
        const task = data.tasks.get(q.uniqueId); // FIX 1: Use uniqueId
        if (!task) return null;

        const progress = q.percentComplete || 0;
        const startDate = new Date(projectStartDate);
        startDate.setDate(startDate.getDate() + task.es);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + task.duration);
        const isCritical = (task.ls - task.es) <= 0;
        let status_class = isCritical ? 'bar-critical' : '';
        if (progress >= 100) {
            status_class += ' bar-done';
        } else if (today > endDate) {
            status_class += ' bar-behind';
        } else if (today >= startDate && today <= endDate) {
            const duration = Math.max(1, task.duration);
            const daysElapsed = (today - startDate) / (1000 * 60 * 60 * 24) + 1;
            const plannedProgress = (daysElapsed / duration) * 100;
            status_class += (progress >= plannedProgress) ? ' bar-on-track' : ' bar-behind';
        }
        
        // FIX 2: Use consistent uniqueIds for dependencies
        const dependencies = Array.from(task.predecessors)
            .filter(pId => typeof pId !== 'string' || !pId.startsWith('PROJECT'))
            .join(', ');
            
        return {
            id: q.uniqueId, // FIX 3: Use uniqueId for the task ID
            name: task.name,
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
            progress: progress,
            dependencies: dependencies,
            custom_class: status_class
        };
    }).filter(Boolean);

    const sortBy = document.getElementById('tracking-gantt-sort').value;
    tasksForGantt.sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'progress') return a.progress - b.progress;
        return new Date(a.start) - new Date(b.start);
    });

    ganttContainer.innerHTML = '';
    trackingGanttChart = new Gantt("#tracking-gantt-chart-target", tasksForGantt, {
        view_mode: 'Week',
        custom_popup_html: function(task) {
            const pertTask = data.tasks.get(task.id.replace('task_', ''));
            const duration = pertTask ? pertTask.duration : 'N/A';
            return `<div class="gantt-popup-wrapper">
                <strong>${task.name}</strong>
                <p>Progress: ${task.progress.toFixed(1)}%</p>
                <p>Duration: ${duration} days</p>
            </div>`;
        }
    });
    setTimeout(() => {
    document.querySelectorAll(`#tracking-gantt-chart-target .bar-wrapper.bar-critical`).forEach(wrapper => {
        const taskId = wrapper.dataset.id;
        document.querySelectorAll(`#tracking-gantt-chart-target .arrow-line.dep-${taskId}`).forEach(arrow => {
            arrow.classList.add('arrow-critical');
        });
    });
}, 100);
};

function getChartColors() {
    const isDarkMode = document.body.classList.contains('dark-theme');
    return {
        gridColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        textColor: isDarkMode ? '#f1f1f1' : '#212529',
    };
}

const renderTrackingSCurve = async (projectId, projectName) => {
    currentConstructionProjectId = projectId;
    trackingSCurveChartView.classList.remove('hidden');
    document.getElementById('back-to-tracking-s-curve-projects').innerHTML = `&larr; Back to ${projectName}`;
    trackingSCurveProjectName.textContent = `Tracking S-Curve: ${projectName}`;

    const plannedData = await getSCurveData(projectId, true);
    const project = await db.projects.get(projectId);

    if (!plannedData || !project.startDate) {
        if (trackingSCurveChart) trackingSCurveChart.destroy();
        alert("Cannot generate S-Curve. Ensure the project has a start date and a locked BOQ.");
        return;
    }

    const { grandTotalCost } = plannedData;
    const projectStartDate = new Date(project.startDate);
    projectStartDate.setMinutes(projectStartDate.getMinutes() + projectStartDate.getTimezoneOffset());

    const { allDupas } = await getAllTasksForReport(projectId, true);
    const quantities = await db.quantities.where({ projectId }).toArray();
    const approvedChangeOrders = await db.changeOrders.where({ projectId, status: 'Approved' }).toArray();
    const approvedChangeOrderIds = approvedChangeOrders.map(co => co.id);
    const changeOrderItems = approvedChangeOrderIds.length > 0 ? await db.changeOrderItems.where('changeOrderId').anyOf(approvedChangeOrderIds).toArray() : [];
    
    const quantityTaskIds = quantities.map(q => q.id);
    const coTaskIds = changeOrderItems.map(item => item.id);
    const qtyAccomplishments = await db.accomplishments.where('taskId').anyOf(quantityTaskIds).and(r => r.type === 'quantity').toArray();
    const coAccomplishments = coTaskIds.length > 0 ? await db.accomplishments.where('taskId').anyOf(coTaskIds).and(r => r.type === 'changeOrderItem').toArray() : [];
    const allAccomplishments = [...qtyAccomplishments, ...coAccomplishments];

    const accomplishmentValuesByDay = new Map();
    if (allAccomplishments.length > 0) {
        const dupaMap = new Map(allDupas.map(d => [d.quantityId || d.changeOrderItemId, d]));
        const parentQuantityMap = new Map(quantities.map(q => [q.id, q]));
        for (const acc of allAccomplishments) {
            let taskCost = 0;
            if (acc.type === 'changeOrderItem') taskCost = calculateDupaTotalCost(dupaMap.get(acc.taskId));
            else {
                const parentDupa = dupaMap.get(acc.taskId);
                const parentQuantity = parentQuantityMap.get(acc.taskId);
                if (parentQuantity?.subquantities?.length > 0) taskCost = calculateDupaTotalCost(parentDupa) / parentQuantity.subquantities.length;
                else taskCost = calculateDupaTotalCost(parentDupa);
            }
            const earnedValue = taskCost * (acc.percentComplete / 100);
            const reportDate = new Date(acc.date);
            reportDate.setMinutes(reportDate.getMinutes() + reportDate.getTimezoneOffset());
            const projectDay = Math.round((reportDate - projectStartDate) / (1000 * 60 * 60 * 24));
            if (projectDay >= 0) accomplishmentValuesByDay.set(projectDay, (accomplishmentValuesByDay.get(projectDay) || 0) + earnedValue);
        }
    }

    const today = new Date();
    const daysElapsed = Math.floor((today - projectStartDate) / (1000 * 60 * 60 * 24));
    const reportDays = Array.from(accomplishmentValuesByDay.keys());
    const latestReportDay = reportDays.length > 0 ? Math.max(...reportDays) : -1;
    const chartDuration = Math.max(plannedData.projectDuration, latestReportDay, daysElapsed) + 5;

    const extendedLabels = [...plannedData.labels];
    const extendedPlannedPercentage = [...plannedData.plannedPercentage];
    const lastPlannedValue = extendedPlannedPercentage.length > 0 ? extendedPlannedPercentage[extendedPlannedPercentage.length - 1] : 100;

    for (let i = plannedData.projectDuration; i < chartDuration; i++) {
        const currentDate = new Date(projectStartDate);
        currentDate.setDate(currentDate.getDate() + i);
        extendedLabels.push(new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(currentDate));
        extendedPlannedPercentage.push(lastPlannedValue);
    }
    
    const actualPercentage = new Array(chartDuration).fill(null);
    if (accomplishmentValuesByDay.size > 0 || project.startDate) {
        let cumulativeValue = 0;
        const sortedDays = [...accomplishmentValuesByDay.keys()].sort((a, b) => a - b);
        sortedDays.forEach(day => {
            cumulativeValue += accomplishmentValuesByDay.get(day);
            if (day < chartDuration) actualPercentage[day] = (cumulativeValue / grandTotalCost) * 100;
        });
        
        let lastDay = 0;
        let lastValue = 0;
        if (actualPercentage[0] === null) {
            accomplishmentValuesByDay.set(0,0);
        }
        for (let i = 0; i < chartDuration; i++) {
            if (actualPercentage[i] !== null) {
                const nextValue = actualPercentage[i], nextDay = i;
                if (nextDay > lastDay) {
                    const daysBetween = nextDay - lastDay;
                    const valueStep = (nextValue - lastValue) / daysBetween;
                    for (let j = 1; j < daysBetween; j++) {
                        actualPercentage[lastDay + j] = lastValue + (valueStep * j);
                    }
                }
                lastDay = nextDay;
                lastValue = nextValue;
            }
        }
        
        if (daysElapsed > lastDay && lastDay < chartDuration) {
             for (let i = lastDay + 1; i <= daysElapsed && i < chartDuration; i++) {
                 actualPercentage[i] = lastValue;
             }
        }
    }
    
    const pointRadii = new Array(chartDuration).fill(2);
    const pointColors = new Array(chartDuration).fill('rgba(255, 99, 132, 0.5)');
    for (const day of accomplishmentValuesByDay.keys()) {
        if (day >= 0 && day < chartDuration) {
            pointRadii[day] = 5;
            pointColors[day] = 'rgb(255, 99, 132)';
        }
    }

    const colors = getChartColors();

    if (trackingSCurveChart) trackingSCurveChart.destroy();
    trackingSCurveChart = new Chart(trackingSCurveCanvas, {
        type: 'line',
        data: {
            labels: extendedLabels,
            datasets: [
                { label: 'Planned Cumulative %', data: extendedPlannedPercentage, borderColor: 'rgb(75, 192, 192)', tension: 0.4, fill: false },
                {
                    label: 'Actual Cumulative %',
                    data: actualPercentage,
                    borderColor: 'rgb(255, 99, 132)',
                    spanGaps: true, tension: 0.1, fill: false,
                    pointRadius: pointRadii,
                    pointBackgroundColor: pointColors,
                    pointHoverRadius: 7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: value => value + '%',
                        color: colors.textColor
                    },
                    grid: {
                        color: colors.gridColor
                    },
                    title: {
                        color: colors.textColor
                    }
                },
                x: {
                    ticks: {
                        color: colors.textColor
                    },
                    grid: {
                        color: colors.gridColor
                    },
                    title: {
                        color: colors.textColor
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Planned vs. Actual S-Curve (As-Built)',
                    color: colors.textColor
                },
                legend: {
                    labels: {
                        color: colors.textColor
                    }
                }
            }
        }
    });
};

const generateLookAheadReport = async () => {
    const projectId = currentConstructionProjectId;
    const startDateStr = document.getElementById('lookahead-start-date').value;
    const durationWeeks = parseInt(document.getElementById('lookahead-duration').value);
    const contentDiv = document.getElementById('lookahead-report-content');
    const kpiDiv = document.getElementById('lookahead-kpi-container');

    contentDiv.innerHTML = `<p class="placeholder-text">Generating report...</p>`;
    kpiDiv.innerHTML = '';

    if (!startDateStr) {
        alert('Please select a start date for the report.');
        contentDiv.innerHTML = `<p class="placeholder-text">Please select a start date and click "Generate Report".</p>`;
        return;
    }

    const project = await db.projects.get(projectId);
    if (!project.startDate) {
        alert('This project has no actual start date. Please file at least one accomplishment report before generating a look-ahead.');
        contentDiv.innerHTML = `<p class="placeholder-text">Project has no start date.</p>`;
        return;
    }

    const pertData = await getPertCpmData(projectId, true);
    if (!pertData) {
        alert('Could not generate schedule data for this project.');
        return;
    }
    
    const { tasks: pertTasks, allDupas } = pertData;
    const allTasksWithProgress = await getAllAccomplishmentTasks(projectId);
    const taskProgressMap = new Map(allTasksWithProgress.map(t => [t.uniqueId, t]));

    const dupaMap = new Map();
    if (allDupas) {
        allDupas.forEach(d => {
            const key = d.quantityId || d.changeOrderItemId;
            dupaMap.set(key, d);
        });
    }

    let totalProjectValue = 0;
    let accomplishedProjectValue = 0;
    allTasksWithProgress.forEach(task => {
        totalProjectValue += task.cost || 0;
        accomplishedProjectValue += (task.cost || 0) * ((task.percentComplete || 0) / 100);
    });
    const overallProgress = totalProjectValue > 0 ? (accomplishedProjectValue / totalProjectValue) * 100 : 0;
    kpiDiv.innerHTML = `<strong>Overall Project Completion: ${overallProgress.toFixed(2)}%</strong>`;

    const reportStartDate = new Date(startDateStr);
    const reportEndDate = new Date(reportStartDate);
    reportEndDate.setDate(reportEndDate.getDate() + durationWeeks * 7);

    const projectStartDate = new Date(project.startDate);
    
    const dayInMillis = 1000 * 60 * 60 * 24;
    const reportStartDay = Math.floor((reportStartDate - projectStartDate) / dayInMillis);
    const reportEndDay = reportStartDay + (durationWeeks * 7);

    const finalTasksForReport = allTasksWithProgress
        .map(task => {
            // Merge the main task data with its corresponding schedule data from PERT-CPM
            const scheduleData = pertTasks.get(task.uniqueId);
            if (!scheduleData) return null;
            return { ...task, ...scheduleData }; // Creates a single, complete task object
        })
        .filter(task => {
            if (!task) return false;
            // The core filtering logic: does the task's schedule overlap with the report window?
            // A task is relevant if it must start before the window ends (ls < reportEndDay)
            // AND it can't finish before the window starts (ef > reportStartDay).
            return task.ls < reportEndDay && task.ef > reportStartDay;
        });

    if (finalTasksForReport.length === 0) {
        contentDiv.innerHTML = `<p class="placeholder-text">No tasks scheduled for this period.</p>`;
        return;
    }
    
    finalTasksForReport.sort((a,b) => a.es - b.es);

    let reportHtml = '';
    for (const task of finalTasksForReport) {
        let isAtRisk = false;
        let predecessorHtml = '<ul>';
        
        // FIX: Access predecessors directly from the merged task object
        if (task.predecessors.size === 0) {
            predecessorHtml += '<li>None (Project Start)</li>';
        } else {
            for (const predId of task.predecessors) {
                // Use the reliable taskProgressMap to get predecessor details
                const predMaster = taskProgressMap.get(predId);
                if (predMaster) {
                    const predProgress = predMaster.percentComplete || 0;
                    if (predProgress < 100) isAtRisk = true;
                    predecessorHtml += `<li>${predMaster.displayName} (${predProgress.toFixed(0)}% complete)</li>`;
                }
            }
        }
        predecessorHtml += '</ul>';
        
        const dupa = dupaMap.get(parseInt(task.uniqueId.split('-')[1]));
        let resourceHtml = '<ul>';
        if (dupa && dupa.directCosts) {
            const laborCosts = dupa.directCosts.filter(dc => dc.type === 'labor');
            const materialCosts = dupa.directCosts.filter(dc => dc.type === 'material');
            const equipmentCosts = dupa.directCosts.filter(dc => dc.type === 'equipment');

            if (laborCosts.length === 0 && materialCosts.length === 0 && equipmentCosts.length === 0) {
                resourceHtml += '<li>No resources specified in DUPA.</li>';
            } else {
                if (laborCosts.length > 0) {
                    resourceHtml += '<li><strong>Labor:</strong><ul>';
                    laborCosts.forEach(dc => {
                        resourceHtml += `<li class="resource-item"><span class="resource-name">${dc.laborType}</span><span class="resource-qty">(${dc.mandays.toFixed(2)} mandays)</span></li>`;
                    });
                    resourceHtml += '</ul></li>';
                }
                if (materialCosts.length > 0) {
                    resourceHtml += '<li><strong>Materials:</strong><ul>';
                    materialCosts.forEach(dc => {
                        resourceHtml += `<li class="resource-item"><span class="resource-name">${dc.name}</span><span class="resource-qty">(${dc.quantity} ${dc.unit})</span></li>`;
                    });
                    resourceHtml += '</ul></li>';
                }
                if (equipmentCosts.length > 0) {
                    resourceHtml += '<li><strong>Equipment:</strong><ul>';
                    equipmentCosts.forEach(dc => {
                        resourceHtml += `<li class="resource-item"><span class="resource-name">${dc.name}</span><span class="resource-qty">(${dc.hours.toFixed(2)} hours)</span></li>`;
                    });
                    resourceHtml += '</ul></li>';
                }
            }
        } else {
            resourceHtml += '<li>DUPA not found.</li>';
        }
        resourceHtml += '</ul>';

        const earlyStartDate = new Date(projectStartDate);
        earlyStartDate.setDate(projectStartDate.getDate() + task.es);
        const lateFinishDate = new Date(projectStartDate);
        lateFinishDate.setDate(projectStartDate.getDate() + task.lf);

        reportHtml += `
            <div class="lookahead-task ${isAtRisk ? 'at-risk' : ''}">
                <div class="lookahead-task-header">
                    <h3>
                        <span>${task.displayName}</span>
                        <span class="status ${isAtRisk ? 'at-risk' : 'on-track'}">${isAtRisk ? 'At Risk' : 'On Track'}</span>
                    </h3>
                    <small>Scheduled Window: ${earlyStartDate.toLocaleDateString()} - ${lateFinishDate.toLocaleDateString()}</small>
                </div>
                <div class="lookahead-task-body">
                    <div>
                        <h4>Constraints (Predecessors)</h4>
                        ${predecessorHtml}
                    </div>
                    <div>
                        <h4>Required Resources</h4>
                        ${resourceHtml}
                    </div>
                </div>
            </div>
        `;
    }

    contentDiv.innerHTML = reportHtml;
};


function initializeConstructionModule() {

    document.getElementById('accomplishment-list-view').addEventListener('click', (e) => {
        if (e.target.classList.contains('view-accomplishment-detail-btn')) {
            showAccomplishmentDetail(currentConstructionProjectId, e.target.dataset.date);
        }
    });
    document.getElementById('edit-accomplishment-btn').addEventListener('click', (e) => {
        editAccomplishmentReport(currentConstructionProjectId, e.target.dataset.date);
    });
    document.getElementById('back-to-accomplishment-entry').addEventListener('click', () => {
        showAccomplishmentForm(currentConstructionProjectId, accomplishmentProjectName.textContent);
    });
    
    accomplishmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = accomplishmentDateInput.value;
    const isEditMode = accomplishmentDateInput.hasAttribute('readonly');

    if (!date) {
        alert('Please select a date.');
        return;
    }

    const updates = [];
    accomplishmentTableBody.querySelectorAll('tr[data-unique-id]').forEach(row => {
        const progressInput = row.querySelector('.progress-input');
        const progressToday = progressInput.value ? parseFloat(progressInput.value) : 0;
        if (isNaN(progressToday) || progressToday <= 0) return;

        const update = {
            type: row.dataset.type,
            progressToday: progressToday,
        };
        if (update.type === 'subquantity') {
            update.taskId = parseInt(row.dataset.quantityId);
            update.subIndex = parseInt(row.dataset.subquantityIndex);
        } else {
            update.taskId = parseInt(row.dataset.quantityId);
        }
        updates.push(update);
    });

    if (updates.length === 0) {
        alert('No progress updates to save.');
        return;
    }

    try {
        await db.transaction('rw', db.accomplishments, db.quantities, db.changeOrderItems, async () => {
            const recordsToAdd = updates.map(update => {
                const record = {
                    date: date,
                    percentComplete: update.progressToday,
                    taskId: update.taskId,
                    subIndex: null,
                    type: update.type === 'subquantity' ? 'quantity' : update.type
                };
                if (update.type === 'subquantity') {
                    record.subIndex = update.subIndex;
                }
                return record;
            });
            await db.accomplishments.bulkAdd(recordsToAdd);

            const tasksToRecalculate = new Map();
            updates.forEach(upd => {
                const key = `${upd.type}-${upd.taskId}`;
                if (!tasksToRecalculate.has(key)) {
                    tasksToRecalculate.set(key, { type: upd.type, id: upd.taskId });
                }
            });

            for (const task of tasksToRecalculate.values()) {
                if (task.type === 'changeOrderItem') {
                    const allReports = await db.accomplishments.where({ type: 'changeOrderItem', taskId: task.id }).toArray();
                    const totalProgress = allReports.reduce((sum, r) => sum + r.percentComplete, 0);
                    await db.changeOrderItems.update(task.id, { percentComplete: Math.min(100, totalProgress) });
                } else { 
                    const parentQuantity = await db.quantities.get(task.id);
                    if (!parentQuantity) continue;

                    if (Array.isArray(parentQuantity.subquantities) && parentQuantity.subquantities.length > 0) {
                        let totalSubProgress = 0;
                        for (let i = 0; i < parentQuantity.subquantities.length; i++) {
                            const subReports = await db.accomplishments.where({ type: 'quantity', taskId: task.id, subIndex: i }).toArray();
                            const subTotal = subReports.reduce((sum, r) => sum + r.percentComplete, 0);
                            totalSubProgress += Math.min(100, subTotal);
                        }
                        const finalParentProgress = totalSubProgress / parentQuantity.subquantities.length;
                        await db.quantities.update(task.id, { percentComplete: finalParentProgress });
                    } else {
                        const allReports = await db.accomplishments.where({ type: 'quantity', taskId: task.id }).toArray();
                        const totalProgress = allReports.reduce((sum, r) => sum + r.percentComplete, 0);
                        await db.quantities.update(task.id, { percentComplete: Math.min(100, totalProgress) });
                    }
                }
            }
        });

        alert(`Accomplishment report saved successfully!`);
        showAccomplishmentForm(currentConstructionProjectId, accomplishmentProjectName.textContent);

    } catch (error) {
        console.error("Failed to save accomplishment report:", error);
        alert('An error occurred. Please check the browser console for details.');
    }
});


    backToTrackingGanttProjectsBtn.addEventListener('click', showTrackingGantt);
    document.getElementById('tracking-gantt-view-day').addEventListener('click', () => { if (trackingGanttChart) trackingGanttChart.change_view_mode('Day'); });
    document.getElementById('tracking-gantt-view-week').addEventListener('click', () => { if (trackingGanttChart) trackingGanttChart.change_view_mode('Week'); });
    document.getElementById('tracking-gantt-view-month').addEventListener('click', () => { if (trackingGanttChart) trackingGanttChart.change_view_mode('Month'); });
    document.getElementById('tracking-gantt-sort').addEventListener('change', () => {
        if (currentConstructionProjectId) {
            const projectName = trackingGanttProjectName.textContent.replace('Tracking Gantt: ', '');
            showTrackingGanttChart(currentConstructionProjectId, projectName);
        }
    });

    backToTrackingSCurveProjectsBtn.addEventListener('click', showTrackingSCurve);


    document.getElementById('back-to-lookahead-projects').addEventListener('click', showLookahead);
    document.getElementById('generate-lookahead-btn').addEventListener('click', generateLookAheadReport);
        document.getElementById('accomplishment-sort').addEventListener('change', () => {
        showAccomplishmentForm(currentConstructionProjectId, accomplishmentProjectName.textContent);
    });
    document.getElementById('accomplishment-group').addEventListener('change', () => {
        showAccomplishmentForm(currentConstructionProjectId, accomplishmentProjectName.textContent);
    });
}
// --- End of construction.js ---