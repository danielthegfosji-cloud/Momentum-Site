// js/takeoff.js

let takeoffModuleInitialized = false;

// --- DOM References ---
const quantitiesProjectName = document.getElementById('quantities-project-name');
const addQuantityBtn = document.getElementById('add-quantity-btn');
const quantitiesTableBody = document.querySelector('#quantities-table tbody');
const quantityModal = document.getElementById('quantity-modal');
const quantityModalClose = document.querySelector('.quantity-modal-close');
const quantityModalTitle = document.getElementById('quantity-modal-title');
const quantityForm = document.getElementById('quantity-form');
const quantityIdInput = document.getElementById('quantityId');
const categoryInput = document.getElementById('category');
const categoryList = document.getElementById('category-list');
const scopeOfWorkInput = document.getElementById('scopeOfWork');
const quantityInput = document.getElementById('quantity');
const unitInput = document.getElementById('unit');
const addSubquantityBtn = document.getElementById('add-subquantity-btn');
const subquantitiesTableBody = document.querySelector('#subquantities-table tbody');

// --- Functions ---
const openQuantityModal = () => quantityModal.style.display = 'block';
const closeQuantityModal = () => quantityModal.style.display = 'none';

const populateCategoryDatalist = async () => {
    const allCategories = await db.quantities.orderBy('category').uniqueKeys();
    categoryList.innerHTML = allCategories.map(cat => `<option value="${cat}"></option>`).join('');
};

const displayQuantities = async () => {
    const quantities = await db.quantities.where('projectId').equals(currentProjectId).toArray();
    const lockedBoq = await db.boqs.get({ projectId: currentProjectId });
    const isLocked = !!lockedBoq;

    quantitiesTableBody.innerHTML = '';
    if (quantities.length === 0) {
        quantitiesTableBody.innerHTML = '<tr><td colspan="4">No quantities added for this project yet.</td></tr>';
        return;
    }
    const grouped = quantities.reduce((acc, q) => {
        const category = q.category || 'Uncategorized';
        if (!acc[category]) { acc[category] = []; }
        acc[category].push(q);
        return acc;
    }, {});
    const sortedCategories = Object.keys(grouped).sort();
    for (const category of sortedCategories) {
        const headerRow = quantitiesTableBody.insertRow();
        headerRow.className = 'category-header-row';
        headerRow.innerHTML = `<td colspan="4">${category}</td>`;
        grouped[category].forEach(q => {
            const row = quantitiesTableBody.insertRow();
            row.innerHTML = `<td>${q.scopeOfWork}</td><td>${q.quantity}</td><td>${q.unit}</td><td class="actions-cell"><button class="btn btn-warning edit-quantity-btn" data-id="${q.id}" ${isLocked ? 'disabled' : ''}>Edit</button><button class="btn btn-danger delete-quantity-btn" data-id="${q.id}" ${isLocked ? 'disabled' : ''}>Delete</button></td>`;
        });
    }
};

const showQuantitiesForProject = async (projectId, projectName) => {
    currentProjectId = projectId;
    quantitiesProjectName.textContent = projectName;
    document.getElementById('back-to-takeoff-list').innerHTML = `&larr; Back to ${projectName}`;
    takeoffQuantitiesView.classList.remove('hidden');

    const lockedBoq = await db.boqs.get({ projectId: projectId });
    addQuantityBtn.classList.toggle('hidden', !!lockedBoq);

    await displayQuantities();
};

const addSubquantityRow = (data = {}) => {
    const row = subquantitiesTableBody.insertRow();
    row.innerHTML = `
        <td><input type="text" class="subquantity-name" value="${data.name || ''}" placeholder="e.g., External Walls" required></td>
        <td><input type="number" class="subquantity-value" value="${data.quantity || ''}" step="any" required></td>
        <td><button type="button" class="btn-remove">X</button></td>
    `;
};

const updateMainQuantityFromSubs = () => {
    const rows = subquantitiesTableBody.querySelectorAll('tr');
    if (rows.length > 0) {
        let total = 0;
        rows.forEach(row => {
            const value = parseFloat(row.querySelector('.subquantity-value').value);
            if (!isNaN(value)) {
                total += value;
            }
        });
        quantityInput.value = total;
        quantityInput.readOnly = true;
    } else {
        quantityInput.readOnly = false;
    }
};

function initializeTakeoffModule() {
    if (takeoffModuleInitialized) return;

    addQuantityBtn.addEventListener('pointerdown', () => {
    // 1. Perform all synchronous UI updates immediately.
    quantityModalTitle.textContent = 'Add Quantity';
    quantityForm.reset();
    quantityIdInput.value = '';
    subquantitiesTableBody.innerHTML = '';
    quantityInput.readOnly = false;
    openQuantityModal(); // This opens the modal right away.

    // 2. Then, call the async function to load data in the background.
    // This prevents data-loading from blocking the UI.
    populateCategoryDatalist();
});


    quantityModalClose.addEventListener('click', closeQuantityModal);
    
    addSubquantityBtn.addEventListener('click', addSubquantityRow);

    quantityForm.addEventListener('input', (e) => {
        if (e.target.classList.contains('subquantity-value')) {
            updateMainQuantityFromSubs();
        }
    });

    quantityForm.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            e.target.closest('tr').remove();
            updateMainQuantityFromSubs();
        }
    });

    quantityForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        updateMainQuantityFromSubs();
        
        const id = parseInt(quantityIdInput.value);
        
        const subquantities = [];
        subquantitiesTableBody.querySelectorAll('tr').forEach(row => {
            subquantities.push({
                name: row.querySelector('.subquantity-name').value,
                quantity: parseFloat(row.querySelector('.subquantity-value').value)
            });
        });

        const quantityData = {
            scopeOfWork: scopeOfWorkInput.value,
            quantity: parseFloat(quantityInput.value),
            unit: unitInput.value,
            category: categoryInput.value.trim(),
            projectId: currentProjectId,
            subquantities: subquantities.length > 0 ? subquantities : null
        };

        if (id) await db.quantities.update(id, quantityData);
        else await db.quantities.add(quantityData);
        
        closeQuantityModal();
        await displayQuantities();
    });

    quantitiesTableBody.addEventListener('click', async (event) => {
        const target = event.target;
        const id = parseInt(target.dataset.id);
        if (target.classList.contains('edit-quantity-btn')) {
            await populateCategoryDatalist();
            const quantity = await db.quantities.get(id);
            quantityModalTitle.textContent = 'Edit Quantity';
            quantityIdInput.value = quantity.id;
            categoryInput.value = quantity.category;
            scopeOfWorkInput.value = quantity.scopeOfWork;
            quantityInput.value = quantity.quantity;
            unitInput.value = quantity.unit;

            subquantitiesTableBody.innerHTML = '';
            if (quantity.subquantities && quantity.subquantities.length > 0) {
                quantity.subquantities.forEach(sub => addSubquantityRow(sub));
                quantityInput.readOnly = true;
            } else {
                quantityInput.readOnly = false;
            }

            openQuantityModal();
        }
        if (target.classList.contains('delete-quantity-btn')) {
            if (confirm('Are you sure you want to delete this quantity?')) {
                await db.quantities.delete(id);
                await displayQuantities();
            }
        }
    });

    takeoffModuleInitialized = true;
}
