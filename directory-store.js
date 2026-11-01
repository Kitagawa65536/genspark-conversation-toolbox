/* Persist real FileSystemDirectoryHandle objects using IndexedDB structured clone. */
(function (root) {
    'use strict';
    const DATABASE = 'genspark-directory-handles';
    const STORE = 'handles';
    const KEY = 'export-directory';

    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (!root.indexedDB) return reject(new Error('IndexedDB is unavailable'));
            let request, settled = false;
            const fail = error => {
                if (settled) return;
                settled = true;
                reject(error || new Error('Cannot open directory-handle database'));
            };
            try { request = root.indexedDB.open(DATABASE, 1); }
            catch (error) { fail(error); return; }
            request.onupgradeneeded = () => {
                try {
                    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
                } catch (error) {
                    try { request.transaction.abort(); } catch { /* Open request will also fail. */ }
                    fail(error);
                }
            };
            request.onerror = () => fail(request.error);
            request.onblocked = () => fail(new Error('Directory-handle database is blocked by another page'));
            request.onsuccess = () => {
                const database = request.result;
                // Release old connections promptly when another page upgrades/deletes.
                database.onversionchange = () => database.close();
                if (settled) { database.close(); return; }
                settled = true;
                resolve(database);
            };
        });
    }

    async function transact(mode, operation) {
        const database = await openDatabase();
        try {
            return await new Promise((resolve, reject) => {
                let transaction, request, result, settled = false;
                const fail = error => {
                    if (settled) return;
                    settled = true;
                    reject(error || new Error('Directory-handle transaction failed'));
                };
                try {
                    transaction = database.transaction(STORE, mode);
                    transaction.oncomplete = () => {
                        if (settled) return;
                        settled = true;
                        resolve(result);
                    };
                    transaction.onerror = () => fail(transaction.error || request?.error);
                    transaction.onabort = () => fail(transaction.error || request?.error || new Error('Directory-handle transaction aborted'));
                    request = operation(transaction.objectStore(STORE));
                    request.onsuccess = () => { result = request.result; };
                    request.onerror = () => fail(request.error);
                } catch (error) {
                    try { transaction?.abort(); } catch { /* Preserve the original error. */ }
                    fail(error);
                }
            });
        } finally { database.close(); }
    }

    async function load() {
        const handle = await transact('readonly', store => store.get(KEY));
        return handle?.kind === 'directory' ? handle : null;
    }
    async function save(handle) {
        if (!handle || handle.kind !== 'directory') throw new TypeError('A directory handle is required');
        await transact('readwrite', store => store.put(handle, KEY));
    }
    async function clear() {
        await transact('readwrite', store => store.delete(KEY));
    }
    root.GensparkDirectoryStore = { load, save, clear };
})(globalThis);
