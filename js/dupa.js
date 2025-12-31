// Author: -REPLACE WITH YOUR NAME-
// OS support: -REPLACE WITH YOUR OS SUPPORT-
// Description: Logic for the DUPA module.

let dupaQuantitiesListDiv, dupaProjectName, dupaQuantityName, dupaForm, dupaQuantityIdInput, dupaIdInput, dupaDurationInput, addLaborBtn, laborTbody, addMaterialBtn, materialTbody, addEquipmentBtn, equipmentTbody, ocmPercentInput, profitPercentInput, taxesPercentInput;
let addMaterialFromLibraryBtn, addLaborFromLibraryBtn, addCrewFromLibraryBtn, addEquipmentFromLibraryBtn;
let dupaModuleInitialized = false;


const displayDupaQuantities = async () => {
    const quantities = await db.quantities.where('projectId').equals(currentDupaProjectId).toArray();
    dupaQuantitiesListDiv.innerHTML = '';
    if (quantities.length === 0) {
        dupaQuantitiesListDiv.innerHTML = "<p>No quantities found for this project.</p>";
        return;
    }
    
    const quantityIds = quantities.map(q => q.id);
    const dupas = quantityIds.length > 0 ? await db.dupas.where('quantityId').anyOf(quantityIds).toArray() : [];
    const hasDupaSet = new Set(dupas.map(d => d.quantityId));

    const grouped = quantities.reduce((acc, q) => {
        const category = q.category || 'Uncategorized';
        if (!acc[category]) { acc[category] = []; }
        acc[category].push(q);
        return acc;
    }, {});

    const sortedCategories = Object.keys(grouped).sort();
    for (const category of sortedCategories) {
        const header = document.createElement('h3');
        header.className = 'dupa-category-header';
        header.textContent = category;
        dupaQuantitiesListDiv.appendChild(header);
        grouped[category].forEach(q => {
            const hasDupa = hasDupaSet.has(q.id);
            const buttonText = hasDupa ? 'Show/Edit DUPA' : 'Add DUPA';
            const buttonClass = hasDupa ? 'btn-primary' : 'btn-secondary';

            const item = document.createElement('div');
            item.className = 'list-item';
            if (!hasDupa) {
                item.classList.add('no-dupa');
            }
            item.innerHTML = `<h3>${q.scopeOfWork}</h3><button class="btn ${buttonClass} show-dupa-form-btn" data-id="${q.id}" data-name="${q.scopeOfWork}">${buttonText}</button>`;
            dupaQuantitiesListDiv.appendChild(item);
        });
    }
};

const showDupaQuantitiesForProject = async (projectId, projectName) => {
    currentDupaProjectId = projectId;
    dupaProjectName.textContent = projectName;
    document.getElementById('back-to-dupa-projects').innerHTML = `&larr; Back to ${projectName}`;
    dupaFormView.classList.add('hidden');
    dupaQuantityListView.classList.remove('hidden');
    await displayDupaQuantities();
};

const addLaborRow = (data = {}) => {
    const row = laborTbody.insertRow();
    const costType = data.amount !== undefined ? 'lot' : 'mandays';
    const amount = data.rate !== undefined ? data.rate : (data.amount !== undefined ? data.amount : '');

    row.innerHTML = `
        <td><input type="text" class="labor-type" value="${data.laborType || ''}" required></td>
        <td><input type="number" class="labor-mandays" value="${data.mandays || 1}" step="any" min="0" required ${costType === 'lot' ? 'readonly' : ''}></td>
        <td>
            <select class="labor-cost-type">
                <option value="mandays" ${costType === 'mandays' ? 'selected' : ''}>Manday</option>
                <option value="lot" ${costType === 'lot' ? 'selected' : ''}>Lot</option>
            </select>
        </td>
        <td><input type="number" class="labor-rate" value="${amount}" step="any" min="0" required></td>
        <td class="row-total" style="text-align:right;"></td>
        <td><button type="button" class="btn-remove">X</button></td>
    `;
};

const addMaterialRow = (data = {}) => {
    const row = materialTbody.insertRow();
    row.innerHTML = `<td><input type="text" class="material-name" value="${data.name || ''}" required></td><td><input type="number" class="material-qty" value="${data.quantity || ''}" step="any" min="0" required></td><td><input type="text" class="material-unit" value="${data.unit || ''}" required></td><td><input type="number" class="material-price" value="${data.unitPrice || ''}" step="any" min="0" required></td><td class="row-total" style="text-align:right;"></td><td><button type="button" class="btn-remove">X</button></td>`;
};

const addEquipmentRow = (data = {}) => {
    const row = equipmentTbody.insertRow();
    row.innerHTML = `<td><input type="text" class="equipment-name" value="${data.name || ''}" required></td><td><input type="number" class="equipment-hours" value="${data.hours || ''}" step="any" min="0" required></td><td><input type="number" class="equipment-rate" value="${data.rate || ''}" step="any" min="0" required></td><td class="row-total" style="text-align:right;"></td><td><button type="button" class="btn-remove">X</button></td>`;
};

const calculateAndDisplayDupaTotals = async () => {
    const formatCurrency = (value) => value.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

    let laborSubtotal = 0;
    document.querySelectorAll('#labor-tbody tr').forEach(row => {
        const type = row.querySelector('.labor-cost-type').value;
        const quantity = parseFloat(row.querySelector('.labor-mandays').value) || 0;
        const rate = parseFloat(row.querySelector('.labor-rate').value) || 0;
        const rowTotal = (type === 'lot') ? rate : quantity * rate;
        laborSubtotal += rowTotal;
        row.querySelector('.row-total').textContent = formatCurrency(rowTotal);
    });
    document.getElementById('labor-subtotal').textContent = formatCurrency(laborSubtotal);

    let materialSubtotal = 0;
    document.querySelectorAll('#material-tbody tr').forEach(row => {
        const qty = parseFloat(row.querySelector('.material-qty').value) || 0;
        const price = parseFloat(row.querySelector('.material-price').value) || 0;
        const rowTotal = qty * price;
        materialSubtotal += rowTotal;
        row.querySelector('.row-total').textContent = formatCurrency(rowTotal);
    });
    document.getElementById('material-subtotal').textContent = formatCurrency(materialSubtotal);

    let equipmentSubtotal = 0;
    document.querySelectorAll('#equipment-tbody tr').forEach(row => {
        const hours = parseFloat(row.querySelector('.equipment-hours').value) || 0;
        const rate = parseFloat(row.querySelector('.equipment-rate').value) || 0;
        const rowTotal = hours * rate;
        equipmentSubtotal += rowTotal;
        row.querySelector('.row-total').textContent = formatCurrency(rowTotal);
    });
    document.getElementById('equipment-subtotal').textContent = formatCurrency(equipmentSubtotal);

    const totalDirectCost = laborSubtotal + materialSubtotal + equipmentSubtotal;
    document.getElementById('total-direct-cost-summary').textContent = formatCurrency(totalDirectCost);

    const ocmPercent = parseFloat(ocmPercentInput.value) || 0;
    const profitPercent = parseFloat(profitPercentInput.value) || 0;
    const taxesPercent = parseFloat(taxesPercentInput.value) || 0;

    const ocmAmount = totalDirectCost * (ocmPercent / 100);
    const profitAmount = totalDirectCost * (profitPercent / 100);
    const totalIndirectCost = ocmAmount + profitAmount;
    const subtotalBeforeTax = totalDirectCost + totalIndirectCost;
    const taxAmount = subtotalBeforeTax * (taxesPercent / 100);
    const grandTotal = subtotalBeforeTax + taxAmount;

    document.getElementById('ocm-amount').textContent = formatCurrency(ocmAmount);
    document.getElementById('profit-amount').textContent = formatCurrency(profitAmount);
    document.getElementById('tax-amount').textContent = formatCurrency(taxAmount);
    document.getElementById('total-indirect-cost-summary').textContent = formatCurrency(totalIndirectCost + taxAmount);
    
    document.getElementById('summary-grand-total').textContent = formatCurrency(grandTotal);
    
    const quantityId = parseInt(dupaQuantityIdInput.value);
    if (quantityId) {
        const quantityItem = await db.quantities.get(quantityId);
        const quantity = quantityItem ? quantityItem.quantity : 0;
        document.getElementById('summary-quantity').textContent = `${quantity.toLocaleString()} ${quantityItem ? quantityItem.unit : ''}`;
        const unitPrice = quantity > 0 ? grandTotal / quantity : 0;
        document.getElementById('summary-unit-price').textContent = formatCurrency(unitPrice);
    } else {
        document.getElementById('summary-quantity').textContent = 'N/A';
        document.getElementById('summary-unit-price').textContent = formatCurrency(0);
    }
};

const showDupaFormForQuantity = async (quantityId, quantityName) => {
    currentDupaQuantityId = quantityId;
    dupaQuantityName.textContent = `DUPA for: ${quantityName}`;
    dupaQuantityListView.classList.add('hidden');
    dupaFormView.classList.remove('hidden');
    laborTbody.innerHTML = '';
    materialTbody.innerHTML = '';
    equipmentTbody.innerHTML = '';
    dupaForm.reset();
    dupaQuantityIdInput.value = quantityId;

    const lockedBoq = await db.boqs.get({ projectId: currentDupaProjectId });
    const isLocked = !!lockedBoq;

    const existingDupa = await db.dupas.where({ quantityId: quantityId }).first();
    if (existingDupa) {
        dupaIdInput.value = existingDupa.id;
        dupaDurationInput.value = existingDupa.duration;
        (existingDupa.directCosts || []).forEach(item => {
            if (item.type === 'labor') addLaborRow(item);
            if (item.type === 'material') addMaterialRow(item);
            if (item.type === 'equipment') addEquipmentRow(item);
        });
        ocmPercentInput.value = existingDupa.indirectCosts.ocm;
        profitPercentInput.value = existingDupa.indirectCosts.profit;
        taxesPercentInput.value = existingDupa.indirectCosts.taxes;
    } else {
        dupaIdInput.value = '';
    }

    Array.from(dupaForm.elements).forEach(element => {
        element.disabled = isLocked;
    });
    
    await calculateAndDisplayDupaTotals();
};

const addCrewToDupa = async (crew, multiplier) => {
    try {
        const quantityId = parseInt(dupaQuantityIdInput.value);
        const quantity = await db.quantities.get(quantityId);
        
        if (!quantity || crew.productivityRate <= 0) {
            alert("Cannot calculate crew mandays. Ensure the DUPA quantity and crew productivity are set and greater than zero.");
            return;
        }

        const taskDurationDays = quantity.quantity / crew.productivityRate;
        
        const composition = await db.crewComposition.where({ crewId: crew.id }).toArray();
        const resourceIds = composition.map(c => c.resourceId);
        if (resourceIds.length === 0) {
            alert("This crew has no resources assigned to it.");
            return;
        }

        const resources = await db.resources.where('id').anyOf(resourceIds).toArray();
        const resourceMap = new Map(resources.map(r => [r.id, r]));

        composition.forEach(comp => {
            const resource = resourceMap.get(comp.resourceId);
            if (resource) {
                if (resource.type === 'labor') {
                    const mandays = taskDurationDays * comp.quantity * multiplier;
                    addLaborRow({ laborType: resource.name, mandays: mandays.toFixed(2), rate: resource.rate });
                } else if (resource.type === 'equipment') {
                    const hours = taskDurationDays * 8 * comp.quantity * multiplier; 
                    addEquipmentRow({ name: resource.name, hours: hours.toFixed(2), rate: resource.rate });
                }
            }
        });
        await calculateAndDisplayDupaTotals();
    } catch (error) {
        console.error("Error adding crew to DUPA:", error);
        alert("An error occurred while calculating crew composition.");
    }
};

function initializeDupaModule() {
    if (dupaModuleInitialized) return;
    dupaQuantitiesListDiv = document.getElementById('dupa-quantities-list');
    dupaProjectName = document.getElementById('dupa-project-name');
    dupaQuantityName = document.getElementById('dupa-quantity-name');
    dupaForm = document.getElementById('dupa-form');
    dupaQuantityIdInput = document.getElementById('dupaQuantityId');
    dupaIdInput = document.getElementById('dupaId');
    dupaDurationInput = document.getElementById('dupaDuration');
    addLaborBtn = document.getElementById('add-labor-btn');
    laborTbody = document.getElementById('labor-tbody');
    addMaterialBtn = document.getElementById('add-material-btn');
    materialTbody = document.getElementById('material-tbody');
    addEquipmentBtn = document.getElementById('add-equipment-btn');
    equipmentTbody = document.getElementById('equipment-tbody');
    ocmPercentInput = document.getElementById('ocmPercent');
    profitPercentInput = document.getElementById('profitPercent');
    taxesPercentInput = document.getElementById('taxesPercent');
    addMaterialFromLibraryBtn = document.getElementById('add-material-from-library-btn');
    addLaborFromLibraryBtn = document.getElementById('add-labor-from-library-btn');
    addCrewFromLibraryBtn = document.getElementById('add-crew-from-library-btn');
    addEquipmentFromLibraryBtn = document.getElementById('add-equipment-from-library-btn');

    addLaborBtn.addEventListener('click', () => addLaborRow());
    addMaterialBtn.addEventListener('click', () => addMaterialRow());
    addEquipmentBtn.addEventListener('click', () => addEquipmentRow());

    addMaterialFromLibraryBtn.addEventListener('click', async () => {
        const materials = await db.materials.orderBy('name').toArray();
        openLibraryPicker({
            title: 'Select Material from Library',
            dataSource: materials,
            onSelect: (item) => { 
                addMaterialRow({ name: item.name, unit: item.unit, unitPrice: item.unitPrice });
                calculateAndDisplayDupaTotals();
            },
            searchKeys: ['name'],
            isCrewPicker: false
        });
    });

    addLaborFromLibraryBtn.addEventListener('click', async () => {
    // The extra line causing the blank row has been removed from here.
    const labor = await db.resources.where('type').equals('labor').sortBy('name');
    openLibraryPicker({
        title: 'Select Labor from Library',
        dataSource: labor,
        onSelect: (item) => {
            addLaborRow({ laborType: item.name, rate: item.rate });
            calculateAndDisplayDupaTotals();
        },
        searchKeys: ['name'],
        isCrewPicker: false
    });
});

    addEquipmentFromLibraryBtn.addEventListener('click', async () => {
        const equipment = await db.resources.where('type').equals('equipment').sortBy('name');
        openLibraryPicker({
            title: 'Select Equipment from Library',
            dataSource: equipment,
            onSelect: (item) => {
                addEquipmentRow({ name: item.name, rate: item.rate });
                calculateAndDisplayDupaTotals();
            },
            searchKeys: ['name'],
            isCrewPicker: false
        });
    });

    addCrewFromLibraryBtn.addEventListener('click', async () => {
        const crews = await db.crews.orderBy('name').toArray();
        openLibraryPicker({
            title: 'Select Crew from Library',
            dataSource: crews,
            onSelect: (item, multiplier) => addCrewToDupa(item, multiplier),
            searchKeys: ['name'],
            isCrewPicker: true
        });
    });

    dupaView.addEventListener('click', (e) => {
    if (e.target.classList.contains('show-dupa-form-btn')) { showDupaFormForQuantity(parseInt(e.target.dataset.id), e.target.dataset.name); }
    if (e.target.classList.contains('btn-remove')) { 
        e.target.closest('tr').remove();
        calculateAndDisplayDupaTotals();
    }
});
    
    dupaForm.addEventListener('input', calculateAndDisplayDupaTotals);

    dupaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const directCosts = [];
        laborTbody.querySelectorAll('tr').forEach(row => {
            const type = row.querySelector('.labor-cost-type').value;
            const laborData = {
                type: 'labor',
                laborType: row.querySelector('.labor-type').value,
                costType: type
            };
            if (type === 'lot') {
                laborData.amount = parseFloat(row.querySelector('.labor-rate').value) || 0;
            } else {
                laborData.mandays = parseFloat(row.querySelector('.labor-mandays').value) || 0;
                laborData.rate = parseFloat(row.querySelector('.labor-rate').value) || 0;
            }
            directCosts.push(laborData);
        });
        materialTbody.querySelectorAll('tr').forEach(row => {
            directCosts.push({
                type: 'material',
                name: row.querySelector('.material-name').value,
                quantity: parseFloat(row.querySelector('.material-qty').value) || 0,
                unit: row.querySelector('.material-unit').value,
                unitPrice: parseFloat(row.querySelector('.material-price').value) || 0
            });
        });
        equipmentTbody.querySelectorAll('tr').forEach(row => {
            directCosts.push({
                type: 'equipment',
                name: row.querySelector('.equipment-name').value,
                hours: parseFloat(row.querySelector('.equipment-hours').value) || 0,
                rate: parseFloat(row.querySelector('.equipment-rate').value) || 0
            });
        });
        const dupaData = {
            quantityId: parseInt(dupaQuantityIdInput.value),
            duration: parseInt(dupaDurationInput.value) || 0,
            directCosts: directCosts,
            indirectCosts: {
                ocm: parseFloat(ocmPercentInput.value) || 0,
                profit: parseFloat(profitPercentInput.value) || 0,
                taxes: parseFloat(taxesPercentInput.value) || 0
            }
        };
        if (dupaIdInput.value) { dupaData.id = parseInt(dupaIdInput.value); }
        await db.dupas.put(dupaData);
        alert('DUPA saved successfully!');
        showDupaQuantitiesForProject(currentDupaProjectId, dupaProjectName.textContent);
    });
    dupaForm.addEventListener('change', (e) => {
    if (e.target.classList.contains('labor-cost-type')) {
        const row = e.target.closest('tr');
        const quantityInput = row.querySelector('.labor-mandays');
        if (e.target.value === 'lot') {
            quantityInput.value = 1;
            quantityInput.readOnly = true;
        } else {
            quantityInput.readOnly = false;
        }
    }
});

    dupaModuleInitialized = true;
    
}