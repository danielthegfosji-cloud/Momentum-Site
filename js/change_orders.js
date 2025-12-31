// Author: -REPLACE WITH YOUR NAME-
// OS support: -REPLACE WITH YOUR OS SUPPORT-
// Description: Logic for the Change Orders module.

const coProjectsListDiv = document.getElementById('co-projects-list');
const coListView = document.getElementById('co-list-view');
const coProjectName = document.getElementById('co-project-name');
const backToCoProjectsBtn = document.getElementById('back-to-co-projects');
const coTableBody = document.querySelector('#co-table tbody');
const addCoBtn = document.getElementById('add-co-btn');

const coModal = document.getElementById('co-modal');
const coModalClose = document.querySelector('.co-modal-close');
const coModalTitle = document.getElementById('co-modal-title');
const coForm = document.getElementById('co-form');
const coIdInput = document.getElementById('co-id');
const coDescriptionInput = document.getElementById('co-description');
const coDateInput = document.getElementById('co-date');
const coStatusSelect = document.getElementById('co-status');
const coItemsTableBody = document.querySelector('#co-items-table tbody');
const addCoItemBtn = document.getElementById('add-co-item-btn');

const coItemDupaModal = document.getElementById('co-item-dupa-modal');
const coItemDupaModalClose = document.querySelector('.co-item-dupa-modal-close');
const coItemDupaForm = document.getElementById('co-item-dupa-form');
const coItemIdInput = document.getElementById('co-item-id');

const coSelectNewItemBtn = document.getElementById('co-select-new-item-btn');
const coSelectExistingItemBtn = document.getElementById('co-select-existing-item-btn');
const coExistingItemForm = document.getElementById('co-existing-item-form');
const coOriginalItemSelect = document.getElementById('co-original-item-select');
const coItemQuantityChangeInput = document.getElementById('co-item-quantity-change');

const coLaborTbody = document.getElementById('co-labor-tbody');
const coMaterialTbody = document.getElementById('co-material-tbody');
const coEquipmentTbody = document.getElementById('co-equipment-tbody');

let currentCoProjectId = null;
let currentCoId = null;

const openCoModal = () => coModal.style.display = 'block';
const closeCoModal = () => coModal.style.display = 'none';
const openCoItemDupaModal = () => coItemDupaModal.style.display = 'block';
const closeCoItemDupaModal = () => coItemDupaModal.style.display = 'none';

const addCoLaborRow = (data = {}) => {
    const row = coLaborTbody.insertRow();
    const costType = data.amount !== undefined ? 'lot' : 'mandays';
    const amount = data.rate !== undefined ? data.rate : (data.amount !== undefined ? data.amount : '');

    row.innerHTML = `
        <td><input type="text" class="co-labor-type" value="${data.laborType || ''}" required></td>
        <td><input type="number" class="co-labor-mandays" value="${data.mandays || 1}" step="any" required ${costType === 'lot' ? 'readonly' : ''}></td>
        <td>
            <select class="co-labor-cost-type">
                <option value="mandays" ${costType === 'mandays' ? 'selected' : ''}>Manday</option>
                <option value="lot" ${costType === 'lot' ? 'selected' : ''}>Lot</option>
            </select>
        </td>
        <td><input type="number" class="co-labor-rate" value="${amount}" step="any" min="0" required></td>
        <td><button type="button" class="btn-remove">X</button></td>
    `;
};

const addCoMaterialRow = (data = {}) => {
    const row = coMaterialTbody.insertRow();
    row.innerHTML = `<td><input type="text" class="co-material-name" value="${data.name || ''}" required></td><td><input type="number" class="co-material-qty" value="${data.quantity || ''}" step="any" required></td><td><input type="text" class="co-material-unit" value="${data.unit || ''}" required></td><td><input type="number" class="co-material-price" value="${data.unitPrice || ''}" step="any" min="0" required></td><td><button type="button" class="btn-remove">X</button></td>`;
};
const addCoEquipmentRow = (data = {}) => {
    const row = coEquipmentTbody.insertRow();
    row.innerHTML = `<td><input type="text" class="co-equipment-name" value="${data.name || ''}" required></td><td><input type="number" class="co-equipment-hours" value="${data.hours || ''}" step="any" required></td><td><input type="number" class="co-equipment-rate" value="${data.rate || ''}" step="any" min="0" required></td><td><button type="button" class="btn-remove">X</button></td>`;
};

const calculateChangeOrderDupaTotal = (dupa) => {
    if (!dupa || !dupa.directCosts || !Array.isArray(dupa.directCosts)) return 0;

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


const renderCoItems = async (changeOrderId) => {
    coItemsTableBody.innerHTML = '';
    const items = await db.changeOrderItems.where({ changeOrderId }).toArray();
    
    const additiveItems = [];
    const deductiveItems = [];

    for (const item of items) {
        if (item.quantity >= 0) {
            additiveItems.push(item);
        } else {
            deductiveItems.push(item);
        }
    }

    let tableHtml = '';

    const renderGroup = async (title, groupItems) => {
        if (groupItems.length === 0) return;

        let groupSubtotal = 0;
        tableHtml += `<tr class="category-header-row"><td colspan="5">${title}</td></tr>`;

        for (const item of groupItems) {
            const dupa = await db.changeOrderDupas.get({ changeOrderItemId: item.id });
            const amount = calculateChangeOrderDupaTotal(dupa);
            groupSubtotal += amount;

            let rowClass = '';
            const isDeductive = item.quantity < 0;
            const amountIsNegative = amount < 0;

            rowClass = isDeductive ? 'co-item-deductive' : 'co-item-additive';

            if (isDeductive !== amountIsNegative && amount !== 0) {
                rowClass += ' co-item-conflict';
            }

            tableHtml += `
                <tr class="${rowClass}">
                    <td>${item.scopeOfWork}</td>
                    <td>${item.quantity.toLocaleString()}</td>
                    <td>${item.unit}</td>
                    <td>${amount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</td>
                    <td class="actions-cell">
                        <button type="button" class="btn btn-warning edit-co-item-btn" data-id="${item.id}" data-type="${item.originalQuantityId ? 'existing' : 'new'}">Edit</button>
                        <button type="button" class="btn btn-danger delete-co-item-btn" data-id="${item.id}">Del</button>
                    </td>
                </tr>
            `;
        }
        
        // Add the subtotal row
        tableHtml += `
            <tr class="co-subtotal-row">
                <td colspan="3" style="text-align: right;">Subtotal</td>
                <td style="text-align: right;">${groupSubtotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</td>
                <td></td>
            </tr>
        `;
    };
    
    await renderGroup('Additive Items', additiveItems);
    await renderGroup('Deductive Items', deductiveItems);

    coItemsTableBody.innerHTML = tableHtml;
};

const showChangeOrdersForProject = async (projectId, projectName) => {
    currentCoProjectId = projectId;
    coProjectName.textContent = `Change Orders: ${projectName}`;
    document.getElementById('back-to-co-projects').innerHTML = `&larr; Back to ${projectName}`;
    coListView.classList.remove('hidden');

    coTableBody.innerHTML = '';
    const changeOrders = await db.changeOrders.where({ projectId }).toArray();
    for (const order of changeOrders) {
        const items = await db.changeOrderItems.where({ changeOrderId: order.id }).toArray();
        let totalAmount = 0;
        for (const item of items) {
            const dupa = await db.changeOrderDupas.get({ changeOrderItemId: item.id });
            totalAmount += calculateChangeOrderDupaTotal(dupa);
        }
        const row = coTableBody.insertRow();
        row.innerHTML = `
            <td>${String(order.id).padStart(4, '0')}</td>
            <td>${order.description}</td>
            <td>${order.date}</td>
            <td>${order.status}</td>
            <td>${totalAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</td>
            <td class="actions-cell">
                <button class="btn btn-warning edit-co-btn" data-id="${order.id}">Edit</button>
            </td>
        `;
    }
};

function initializeChangeOrdersModule() {
    addCoBtn.addEventListener('click', () => {
        currentCoId = null;
        coForm.reset();
        coIdInput.value = '';
        coDateInput.valueAsDate = new Date();
        coItemsTableBody.innerHTML = '';
        coModalTitle.textContent = 'New Change Order';
        openCoModal();
    });
    
    coModalClose.addEventListener('click', closeCoModal);
    coItemDupaModalClose.addEventListener('click', closeCoItemDupaModal);
    coItemTypeModalClose.addEventListener('click', closeCoItemTypeModal);
    coExistingItemModalClose.addEventListener('click', closeCoExistingItemModal);

    document.getElementById('co-add-labor-btn').addEventListener('click', () => addCoLaborRow());
    document.getElementById('co-add-material-btn').addEventListener('click', () => addCoMaterialRow());
    document.getElementById('co-add-equipment-btn').addEventListener('click', () => addCoEquipmentRow());

    coItemDupaModal.addEventListener('change', (e) => {
        if (e.target.classList.contains('co-labor-cost-type')) {
            const row = e.target.closest('tr');
            const quantityInput = row.querySelector('.co-labor-mandays');
            if (e.target.value === 'lot') {
                quantityInput.value = 1;
                quantityInput.readOnly = true;
            } else {
                quantityInput.readOnly = false;
            }
        }
    });

    coForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = { projectId: currentCoProjectId, description: coDescriptionInput.value, date: coDateInput.value, status: coStatusSelect.value };
        if (currentCoId) {
            await db.changeOrders.update(currentCoId, data);
        } else {
            currentCoId = await db.changeOrders.add(data);
            coIdInput.value = currentCoId;
        }
        closeCoModal();
        await showChangeOrdersForProject(currentCoProjectId, coProjectName.textContent.replace('Change Orders: ', ''));
    });

    addCoItemBtn.addEventListener('click', () => {
        if (!currentCoId) {
            alert('Please save the Change Order details before adding items.');
            return;
        }
        openCoItemTypeModal();
    });
    
    coSelectNewItemBtn.addEventListener('click', () => {
        closeCoItemTypeModal();
        coItemDupaForm.reset();
        coItemIdInput.value = '';
        document.getElementById('co-original-quantity-id').value = '';
        coLaborTbody.innerHTML = '';
        coMaterialTbody.innerHTML = '';
        coEquipmentTbody.innerHTML = '';
        openCoItemDupaModal();
    });

    coSelectExistingItemBtn.addEventListener('click', async () => {
        closeCoItemTypeModal();
        coExistingItemForm.reset();
        const originalQuantities = await db.quantities.where({ projectId: currentCoProjectId }).toArray();
        coOriginalItemSelect.innerHTML = '<option value="">-- Select Original Task --</option>';
        originalQuantities.forEach(q => {
            coOriginalItemSelect.innerHTML += `<option value="${q.id}">${q.scopeOfWork}</option>`;
        });
        openCoExistingItemModal();
    });

    coExistingItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const originalQuantityId = parseInt(coOriginalItemSelect.value);
        const quantityChange = parseFloat(coItemQuantityChangeInput.value);
        if (!originalQuantityId || isNaN(quantityChange)) {
            alert('Please select an item and enter a valid quantity change.');
            return;
        }

        try {
            const originalQuantity = await db.quantities.get(originalQuantityId);
            const originalDupa = await db.dupas.where({ quantityId: originalQuantityId }).first();

            if (!originalQuantity || !originalDupa) {
                throw new Error("Original item or its DUPA could not be found.");
            }
            if (originalQuantity.quantity === 0) {
                throw new Error("Cannot base calculation on an item with zero quantity.");
            }
            
            const proportion = quantityChange / originalQuantity.quantity;

            closeCoExistingItemModal();
            coItemDupaForm.reset();
            coItemIdInput.value = '';
            coLaborTbody.innerHTML = '';
            coMaterialTbody.innerHTML = '';
            coEquipmentTbody.innerHTML = '';

            document.getElementById('co-original-quantity-id').value = originalQuantityId;
            document.getElementById('co-item-scope').value = `(VO) ${originalQuantity.scopeOfWork}`;
            document.getElementById('co-item-quantity').value = quantityChange;
            document.getElementById('co-item-unit').value = originalQuantity.unit;

            document.getElementById('co-item-dupa-duration').value = Math.round(originalDupa.duration * proportion);

            (originalDupa.directCosts || []).forEach(item => {
                const newItem = { ...item };
                if (newItem.type === 'labor') {
                    newItem.mandays *= proportion;
                    addCoLaborRow(newItem);
                }
                if (newItem.type === 'material') {
                    newItem.quantity *= proportion;
                    addCoMaterialRow(newItem);
                }
                if (newItem.type === 'equipment') {
                    newItem.hours *= proportion;
                    addCoEquipmentRow(newItem);
                }
            });

            document.getElementById('co-item-dupa-ocm').value = originalDupa.indirectCosts.ocm;
            document.getElementById('co-item-dupa-profit').value = originalDupa.indirectCosts.profit;
            document.getElementById('co-item-dupa-taxes').value = originalDupa.indirectCosts.taxes;

            openCoItemDupaModal();

        } catch (error) {
            console.error("Error preparing existing item modification:", error);
            alert(`An error occurred: ${error.message}`);
        }
    });

    coItemsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        if (!target.dataset.id) return;
        const itemId = parseInt(target.dataset.id);

        if (target.classList.contains('edit-co-item-btn')) {
            const item = await db.changeOrderItems.get(itemId);
            const dupa = await db.changeOrderDupas.where({ changeOrderItemId: itemId }).first();

            if (!item || !dupa) {
                alert('Could not find the item details to edit.');
                return;
            }

            // Reset and prepare the DUPA modal
            coItemDupaForm.reset();
            coLaborTbody.innerHTML = '';
            coMaterialTbody.innerHTML = '';
            coEquipmentTbody.innerHTML = '';
            
            // Populate the modal with existing data
            coItemIdInput.value = item.id;
            document.getElementById('co-original-quantity-id').value = item.originalQuantityId || '';
            document.getElementById('co-item-scope').value = item.scopeOfWork;
            document.getElementById('co-item-quantity').value = item.quantity;
            document.getElementById('co-item-unit').value = item.unit;
            
            document.getElementById('co-item-dupa-duration').value = dupa.duration;
            document.getElementById('co-item-dupa-ocm').value = dupa.indirectCosts.ocm;
            document.getElementById('co-item-dupa-profit').value = dupa.indirectCosts.profit;
            document.getElementById('co-item-dupa-taxes').value = dupa.indirectCosts.taxes;

            // Populate direct cost tables
            (dupa.directCosts || []).forEach(cost => {
                if (cost.type === 'labor') addCoLaborRow(cost);
                if (cost.type === 'material') addCoMaterialRow(cost);
                if (cost.type === 'equipment') addCoEquipmentRow(cost);
            });
            
            openCoItemDupaModal();
        }

        if (target.classList.contains('delete-co-item-btn')) {
            if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
                await db.transaction('rw', db.changeOrderItems, db.changeOrderDupas, async () => {
                    await db.changeOrderDupas.where({ changeOrderItemId: itemId }).delete();
                    await db.changeOrderItems.delete(itemId);
                });
                await renderCoItems(currentCoId);
            }
        }
    });
    
    coTableBody.addEventListener('click', async (e) => {
        if(e.target.classList.contains('edit-co-btn')) {
            const orderId = parseInt(e.target.dataset.id);
            const order = await db.changeOrders.get(orderId);
            currentCoId = orderId;
            coIdInput.value = order.id;
            coDescriptionInput.value = order.description;
            coDateInput.value = order.date;
            coStatusSelect.value = order.status;
            coModalTitle.textContent = `Edit Change Order #${String(order.id).padStart(4, '0')}`;
            await renderCoItems(orderId);
            openCoModal();
        }
    });

    coItemDupaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = coItemIdInput.value ? parseInt(coItemIdInput.value) : null;
        const originalQuantityIdValue = document.getElementById('co-original-quantity-id').value;
        
        const itemData = {
            changeOrderId: currentCoId,
            scopeOfWork: document.getElementById('co-item-scope').value,
            quantity: parseFloat(document.getElementById('co-item-quantity').value),
            unit: document.getElementById('co-item-unit').value
        };
        
        if (originalQuantityIdValue) {
            itemData.originalQuantityId = parseInt(originalQuantityIdValue);
        }

        const directCosts = [];
        coLaborTbody.querySelectorAll('tr').forEach(row => {
            const type = row.querySelector('.co-labor-cost-type').value;
            const laborData = {
                type: 'labor',
                laborType: row.querySelector('.co-labor-type').value,
                costType: type
            };
            if (type === 'lot') {
                laborData.amount = parseFloat(row.querySelector('.co-labor-rate').value);
            } else {
                laborData.mandays = parseFloat(row.querySelector('.co-labor-mandays').value);
                laborData.rate = parseFloat(row.querySelector('.co-labor-rate').value);
            }
            directCosts.push(laborData);
        });
        coMaterialTbody.querySelectorAll('tr').forEach(row => directCosts.push({ type: 'material', name: row.querySelector('.co-material-name').value, quantity: parseFloat(row.querySelector('.co-material-qty').value), unit: row.querySelector('.co-material-unit').value, unitPrice: parseFloat(row.querySelector('.co-material-price').value) }));
        coEquipmentTbody.querySelectorAll('tr').forEach(row => directCosts.push({ type: 'equipment', name: row.querySelector('.co-equipment-name').value, hours: parseFloat(row.querySelector('.co-equipment-hours').value), rate: parseFloat(row.querySelector('.co-equipment-rate').value) }));

        const dupaData = {
            duration: parseInt(document.getElementById('co-item-dupa-duration').value),
            directCosts: directCosts,
            indirectCosts: {
                ocm: parseFloat(document.getElementById('co-item-dupa-ocm').value),
                profit: parseFloat(document.getElementById('co-item-dupa-profit').value),
                taxes: parseFloat(document.getElementById('co-item-dupa-taxes').value)
            }
        };

        await db.transaction('rw', db.changeOrderItems, db.changeOrderDupas, db.tasks, async () => {
            if (itemId) {
                await db.changeOrderItems.update(itemId, itemData);
                const dupaToUpdate = await db.changeOrderDupas.get({ changeOrderItemId: itemId });
                await db.changeOrderDupas.update(dupaToUpdate.id, dupaData);
            } else {
                const newItemId = await db.changeOrderItems.add(itemData);
                dupaData.changeOrderItemId = newItemId;
                await db.changeOrderDupas.add(dupaData);

                // Automatically copy sequencing from parent task for variation orders
                if (itemData.originalQuantityId) {
                    const parentId = itemData.originalQuantityId;
                    const projectId = currentCoProjectId;

                    const parentPredecessorLinks = await db.tasks.where({ projectId: projectId, successorId: parentId }).toArray();
                    const parentSuccessorLinks = await db.tasks.where({ projectId: projectId, predecessorId: parentId }).toArray();

                    const newLinks = [];
                    parentPredecessorLinks.forEach(link => {
                        newLinks.push({
                            projectId: projectId,
                            predecessorId: link.predecessorId,
                            successorId: newItemId
                        });
                    });
                    parentSuccessorLinks.forEach(link => {
                        newLinks.push({
                            projectId: projectId,
                            predecessorId: newItemId,
                            successorId: link.successorId
                        });
                    });

                    if (newLinks.length > 0) {
                        await db.tasks.bulkAdd(newLinks);
                    }
                }
            }
        });

        document.getElementById('co-original-quantity-id').value = ''; 
        closeCoItemDupaModal();
        await renderCoItems(currentCoId);
    });
}