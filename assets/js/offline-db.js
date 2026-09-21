// assets/js/offline-db.js
(function () {
    'use strict';

    const DB_NAME = 'baca-offline';
    const DB_VERSION = 1;
    const STORE_ACTIONS = 'pendingActions';

    let db = null;

    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = event => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_ACTIONS)) {
                    database.createObjectStore(STORE_ACTIONS, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async function ensureDb() {
        if (!db) await openDb();
        return db;
    }

    async function addPendingAction(action) {
        const database = await ensureDb();
        return new Promise((resolve, reject) => {
            const tx = database.transaction([STORE_ACTIONS], 'readwrite');
            const store = tx.objectStore(STORE_ACTIONS);
            const item = {
                ...action,
                createdAt: new Date().toISOString()
            };
            const req = store.add(item);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getAllPendingActions() {
        const database = await ensureDb();
        return new Promise((resolve, reject) => {
            const tx = database.transaction([STORE_ACTIONS], 'readonly');
            const store = tx.objectStore(STORE_ACTIONS);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function clearPendingActions() {
        const database = await ensureDb();
        return new Promise((resolve, reject) => {
            const tx = database.transaction([STORE_ACTIONS], 'readwrite');
            const store = tx.objectStore(STORE_ACTIONS);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function removePendingAction(id) {
        const database = await ensureDb();
        return new Promise((resolve, reject) => {
            const tx = database.transaction([STORE_ACTIONS], 'readwrite');
            const store = tx.objectStore(STORE_ACTIONS);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function getPendingActionsCount() {
        const actions = await getAllPendingActions();
        return actions.length;
    }

    async function initOfflineDb() {
        await ensureDb();
    }

    window.BACA_OFFLINE_DB = {
        initOfflineDb,
        addPendingAction,
        getAllPendingActions,
        clearPendingActions,
        removePendingAction,
        getPendingActionsCount
    };
})();