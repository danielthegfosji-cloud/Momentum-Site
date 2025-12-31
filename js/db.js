// Author: -REPLACE WITH YOUR NAME-
// OS support: -REPLACE WITH YOUR OS SUPPORT-
// Description: Defines the IndexedDB schema for the application.

const db = new Dexie('constructionManagerDb');

db.version(1).stores({
    projects: '++id, projectName'
});

db.version(2).stores({
    projects: '++id, projectName',
    quantities: '++id, projectId, scopeOfWork'
});

db.version(3).stores({
    projects: '++id, projectName',
    quantities: '++id, projectId, scopeOfWork, &category'
});

db.version(4).stores({
    projects: '++id, projectName',
    quantities: '++id, projectId, scopeOfWork, category'
});

db.version(5).stores({
    projects: '++id, projectName',
    quantities: '++id, projectId, scopeOfWork, category',
    dupas: '++id, &quantityId'
});

db.version(6).stores({
    projects: '++id, projectName',
    quantities: '++id, projectId, scopeOfWork, category',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId'
});

// VERSION 7: Adds the BOQ table to store locked reports.
// &projectId ensures only one locked BOQ per project.
db.version(7).stores({
    projects: '++id, projectName',
    quantities: '++id, projectId, scopeOfWork, category',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId' // Stores the locked BOQ data
});

db.version(8).stores({
    projects: '++id, projectName',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+date], quantityId, date'
});

db.version(9).stores({
    projects: '++id, projectName, startDate',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+date], quantityId, date'
});

db.version(10).stores({
    projects: '++id, projectName, startDate',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+date], quantityId, date',
    changeOrders: '++id, projectId, date, status',
    changeOrderItems: '++id, changeOrderId, scopeOfWork, quantity, unit',
    changeOrderDupas: '++id, &changeOrderItemId'
});

db.version(11).stores({
    projects: '++id, projectName, startDate',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+date], quantityId, date',
    changeOrders: '++id, projectId, date, status',
    changeOrderItems: '++id, changeOrderId, scopeOfWork, quantity, unit, originalQuantityId',
    changeOrderDupas: '++id, &changeOrderItemId'
});


db.version(12).stores({
    projects: '++id, projectName, startDate, lotArea, floorArea, numFloors',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+date], quantityId, date',
    changeOrders: '++id, projectId, date, status',
    changeOrderItems: '++id, changeOrderId, scopeOfWork, quantity, unit, originalQuantityId',
    changeOrderDupas: '++id, &changeOrderItemId'
});

db.version(13).stores({
    projects: '++id, projectName, startDate, lotArea, floorArea, numFloors, contractAmount, contractDate, projectStatus, targetStartDate, contractDuration, projectManager, clientContact',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+date], quantityId, date',
    changeOrders: '++id, projectId, date, status',
    changeOrderItems: '++id, changeOrderId, scopeOfWork, quantity, unit, originalQuantityId',
    changeOrderDupas: '++id, &changeOrderItemId'
});

db.version(14).stores({
    projects: '++id, projectName, startDate, lotArea, floorArea, numFloors, contractAmount, contractDate, projectStatus, targetStartDate, contractDuration, projectManager, clientContact',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+date], quantityId, date',
    changeOrders: '++id, projectId, date, status',
    changeOrderItems: '++id, changeOrderId, scopeOfWork, quantity, unit, originalQuantityId, percentComplete',
    changeOrderDupas: '++id, &changeOrderItemId'
});

db.version(15).stores({
    projects: '++id, projectName, startDate, lotArea, floorArea, numFloors, contractAmount, contractDate, projectStatus, targetStartDate, contractDuration, projectManager, clientContact',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+date], quantityId, date',
    changeOrders: '++id, projectId, date, status',
    changeOrderItems: '++id, changeOrderId, scopeOfWork, quantity, unit, originalQuantityId, percentComplete',
    changeOrderDupas: '++id, &changeOrderItemId',
    
    // New Library Tables
    materials: '++id, &name',
    resources: '++id, &[name+type]',
    crews: '++id, &name',
    crewComposition: '++id, crewId, resourceId'
});

db.version(16).stores({
    projects: '++id, projectName, startDate, lotArea, floorArea, numFloors, contractAmount, contractDate, projectStatus, targetStartDate, contractDuration, projectManager, clientContact',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete, subquantities',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+date], quantityId, date',
    changeOrders: '++id, projectId, date, status',
    changeOrderItems: '++id, changeOrderId, scopeOfWork, quantity, unit, originalQuantityId, percentComplete',
    changeOrderDupas: '++id, &changeOrderItemId',
    materials: '++id, &name',
    resources: '++id, &[name+type]',
    crews: '++id, &name',
    crewComposition: '++id, crewId, resourceId'
});

db.version(17).stores({
    projects: '++id, projectName, startDate, lotArea, floorArea, numFloors, contractAmount, contractDate, projectStatus, targetStartDate, contractDuration, projectManager, clientContact',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete, subquantities',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+subquantityIndex+date], quantityId, date',
    changeOrders: '++id, projectId, date, status',
    changeOrderItems: '++id, changeOrderId, scopeOfWork, quantity, unit, originalQuantityId, percentComplete',
    changeOrderDupas: '++id, &changeOrderItemId',
    materials: '++id, &name',
    resources: '++id, &[name+type]',
    crews: '++id, &name',
    crewComposition: '++id, crewId, resourceId'
});

db.version(18).stores({
    projects: '++id, projectName, startDate, lotArea, floorArea, numFloors, contractAmount, contractDate, projectStatus, targetStartDate, contractDuration, projectManager, clientContact',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete, subquantities',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    accomplishments: '++id, &[quantityId+subquantityIndex+date], &[changeOrderItemId+date], quantityId, subquantityIndex, changeOrderItemId, date',
    changeOrders: '++id, projectId, date, status',
    changeOrderItems: '++id, changeOrderId, scopeOfWork, quantity, unit, originalQuantityId, percentComplete',
    changeOrderDupas: '++id, &changeOrderItemId',
    materials: '++id, &name',
    resources: '++id, &[name+type]',
    crews: '++id, &name',
    crewComposition: '++id, crewId, resourceId'
}).upgrade(tx => {
    // This upgrade migrates old accomplishment records to the new, clearer structure.
    return tx.table('accomplishments').toCollection().modify(async (acc) => {
        if (!acc.hasOwnProperty('quantityId')) return;
        const isQuantity = await tx.table('quantities').get(acc.quantityId);
        if (!isQuantity) {
            acc.changeOrderItemId = acc.quantityId;
            delete acc.quantityId;
        }
    });
});

db.version(19).stores({
    projects: '++id, projectName, startDate, lotArea, floorArea, numFloors, contractAmount, contractDate, projectStatus, targetStartDate, contractDuration, projectManager, clientContact',
    quantities: '++id, projectId, scopeOfWork, category, percentComplete, subquantities',
    dupas: '++id, &quantityId',
    tasks: '++id, projectId, predecessorId, successorId',
    boqs: '++id, &projectId',
    // This is the new, simplified, and robust schema for accomplishments
    accomplishments: '++id, &[type+taskId+subIndex+date], type, taskId, subIndex, date',
    changeOrders: '++id, projectId, date, status',
    changeOrderItems: '++id, changeOrderId, scopeOfWork, quantity, unit, originalQuantityId, percentComplete',
    changeOrderDupas: '++id, &changeOrderItemId',
    materials: '++id, &name',
    resources: '++id, &[name+type]',
    crews: '++id, &name',
    crewComposition: '++id, crewId, resourceId'
}).upgrade(tx => {
    // This migration converts your existing accomplishment data to the new format
    return tx.table('accomplishments').toCollection().modify(acc => {
        if (acc.changeOrderItemId !== null && acc.changeOrderItemId !== undefined) {
            acc.type = 'changeOrderItem';
            acc.taskId = acc.changeOrderItemId;
        } else {
            acc.type = 'quantity';
            acc.taskId = acc.quantityId;
        }
        acc.subIndex = (acc.subquantityIndex === undefined) ? null : acc.subquantityIndex;
        
        // Delete the old, now-redundant properties
        delete acc.quantityId;
        delete acc.subquantityIndex;
        delete acc.changeOrderItemId;
    });
});

db.version(20).stores({
    resources: '++id, &[name+type], type'
});

db.version(21).stores({
    projects: 'id, projectName' // From ++id to string ULID
});
// --- End of db.js ---