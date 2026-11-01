const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '..', 'directory-store.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup(options = {}) {
    const values = new Map(), databases = [], transactions = [], opens = [];
    let upgraded = false;
    const indexedDB = {
        open(name, version) {
            const request = {}; opens.push({ name, version, request });
            setImmediate(() => {
                if (options.openError) { request.error = options.openError; request.onerror(); return; }
                const database = {
                    closed: 0,
                    close() { this.closed++; },
                    objectStoreNames: { contains: () => upgraded },
                    createObjectStore(name) { assert.equal(name, 'handles'); upgraded = true; },
                    transaction(name, mode) {
                        assert.equal(name, 'handles');
                        const tx = { mode, error: null,
                            abort() { this.onabort?.(); },
                            objectStore() {
                                const run = (kind, value, key) => {
                                    const req = {};
                                    const commit = () => {
                                        if (kind === 'put') values.set(key, value);
                                        if (kind === 'delete') values.delete(key);
                                    };
                                    tx.complete = () => {
                                        if (options.transactionError) {
                                            tx.error = options.transactionError;
                                            tx.onabort();
                                        } else { commit(); tx.oncomplete(); }
                                    };
                                    setImmediate(() => {
                                        if (options.requestError) { req.error = options.requestError; req.onerror(); tx.error = req.error; tx.onerror(); return; }
                                        req.result = kind === 'get' ? values.get(key) : key;
                                        req.onsuccess();
                                        if (options.autoComplete !== false) tx.complete();
                                    });
                                    return req;
                                };
                                return { get: key => run('get', undefined, key), put: (value, key) => run('put', value, key), delete: key => run('delete', undefined, key) };
                            }
                        };
                        transactions.push(tx);
                        return tx;
                    }
                };
                databases.push(database);
                request.result = database;
                if (options.blocked) { request.onblocked(); return; }
                if (!upgraded) request.onupgradeneeded();
                request.onsuccess();
            });
            return request;
        }
    };
    const context = { indexedDB, JSON: { stringify() { throw Error('Handles must never be serialized as JSON'); } } };
    vm.runInNewContext(source, context);
    return { store: context.GensparkDirectoryStore, values, databases, transactions, opens };
}

test('directory handles round-trip directly through IndexedDB, and clear removes only the saved handle', async () => {
    const env = setup();
    const handle = { kind: 'directory', name: 'My vault', getDirectoryHandle() {} };
    assert.equal(await env.store.load(), null);
    await env.store.save(handle);
    assert.equal(await env.store.load(), handle, 'structured-clone-capable IDB stores the handle value, not JSON');
    env.values.set('unrelated', 123);
    await env.store.clear();
    assert.equal(await env.store.load(), null);
    assert.equal(env.values.get('unrelated'), 123);
    assert.ok(env.opens.every(open => open.name === 'genspark-directory-handles' && open.version === 1));
    assert.ok(env.databases.every(database => database.closed === 1));
});

test('save resolves only on transaction completion, not request success', async () => {
    const env = setup({ autoComplete: false });
    let complete = false;
    const pending = env.store.save({ kind: 'directory', name: 'root' }).then(() => { complete = true; });
    await tick(); await tick();
    assert.equal(env.transactions.length, 1);
    assert.equal(complete, false);
    assert.equal(env.values.size, 0);
    env.transactions[0].complete();
    await pending;
    assert.equal(complete, true);
    assert.equal(env.databases[0].closed, 1);
});

test('request and transaction failures reject with the underlying error and close connections', async () => {
    for (const property of ['requestError', 'transactionError']) {
        const failure = Object.assign(new Error('denied'), { name: 'QuotaExceededError' });
        const env = setup({ [property]: failure });
        await assert.rejects(env.store.save({ kind: 'directory' }), error => error === failure);
        assert.equal(env.values.size, 0);
        assert.equal(env.databases[0].closed, 1);
    }
});

test('versionchange releases an open connection while its transaction settles', async () => {
    const env = setup({ autoComplete: false });
    const pending = env.store.load();
    await tick(); await tick();
    env.databases[0].onversionchange();
    assert.equal(env.databases[0].closed, 1);
    env.transactions[0].complete();
    assert.equal(await pending, null);
    assert.ok(env.databases[0].closed >= 1);
});

test('blocked opens fail explicitly and close a connection that arrives after rejection', async () => {
    const env = setup({ blocked: true });
    await assert.rejects(env.store.load(), /blocked/);
    const request = env.opens[0].request;
    request.onsuccess();
    assert.equal(env.databases[0].closed, 1);
});

test('open failure, unsupported IndexedDB and invalid handles are not silently ignored', async () => {
    const failure = new Error('IndexedDB disabled');
    const env = setup({ openError: failure });
    await assert.rejects(env.store.load(), error => error === failure);
    await assert.rejects(env.store.save({ kind: 'file' }), /directory handle/);
    const context = {};
    vm.runInNewContext(source, context);
    await assert.rejects(context.GensparkDirectoryStore.load(), /unavailable/);
});
