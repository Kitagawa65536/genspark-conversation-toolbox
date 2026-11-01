const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.join(__dirname, '..');
function setup(destination) {
    let id = 0;
    const context = { console, URL, Date, crypto: { randomUUID: () => 'job-' + (++id) } };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'bundle-export.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), context);
    const session = {}, tabs = [];
    let legacyCalls = 0;
    const browser = {
        storage: {
            local: { get: async () => ({ markdownExportDestination: destination }) },
            session: {
                get: async () => ({ ...session }),
                set: async value => Object.assign(session, value),
                remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete session[key]; }
            }
        },
        runtime: { getURL: file => 'chrome-extension://test/' + file },
        tabs: { create: async options => { tabs.push(options); return { id: tabs.length }; } }
    };
    context.GensparkBundle.exportMarkdownBundle = async () => { legacyCalls++; return { markdownSaved: true }; };
    return { ...context.GensparkBackgroundHelpers, browser, session, tabs, legacyCalls: () => legacyCalls };
}
const request = { title: 'notes', url: 'https://www.genspark.ai/agents?id=test',
    messages: [{ type: 'assistant', markdown: 'plain text without images' }], images: [] };

test('first Markdown export opens a dedicated page and stores transient payload, not a false success', async () => {
    const env = setup();
    const result = await env.routeMarkdownExport(request, env.browser);
    assert.equal(result.queued, true);
    assert.equal(result.savePageOpened, true);
    assert.equal(result.success, undefined);
    assert.equal(env.legacyCalls(), 0);
    assert.equal(env.tabs[0].url, 'chrome-extension://test/export.html?job=job-1');
    assert.equal(env.session['directory-export:job-1'].status, 'pending');
    assert.equal(env.session['directory-export:job-1'].request.messages[0].markdown, 'plain text without images');
});

test('remembered directory uses the page while explicit Downloads keeps original engine', async () => {
    const directory = setup('directory');
    await directory.routeMarkdownExport(request, directory.browser);
    assert.equal(directory.tabs.length, 1);
    const downloads = setup('downloads');
    const result = await downloads.routeMarkdownExport(request, downloads.browser);
    assert.equal(result.markdownSaved, true);
    assert.equal(downloads.legacyCalls(), 1);
    assert.equal(downloads.tabs.length, 0);
    assert.equal(Object.keys(downloads.session).length, 0);
});

test('expired export payloads are removed, unrelated/new session values retained', async () => {
    const env = setup();
    env.session['directory-export:old'] = { createdAt: Date.now() - 25 * 3600000 };
    env.session['directory-export:new'] = { createdAt: Date.now() };
    env.session.other = { createdAt: 0 };
    await env.openDirectoryExport(request, env.browser);
    assert.ok(!env.session['directory-export:old']);
    assert.ok(env.session['directory-export:new']);
    assert.ok(env.session.other);
});

test('status lookup reports results without sending private request payload back to the content script', async () => {
    const env = setup();
    const queued = await env.openDirectoryExport(request, env.browser);
    assert.equal((await env.getDirectoryExportStatus(queued.jobId, env.browser)).status, 'pending');
    env.session['directory-export:' + queued.jobId] = {
        status: 'completed', request, result: { markdownSaved: true, markdownPath: 'Vault/test.md' }
    };
    const status = await env.getDirectoryExportStatus(queued.jobId, env.browser);
    assert.equal(status.result.markdownSaved, true);
    assert.equal(status.request, undefined);
    assert.equal((await env.getDirectoryExportStatus('gone', env.browser)).status, 'missing');
    await assert.rejects(env.getDirectoryExportStatus('../bad', env.browser), /Invalid/);
});

test('tab/storage failures are surfaced without stray jobs or Downloads fallback', async () => {
    const env = setup();
    env.browser.tabs.create = async () => { throw Error('Cannot open tab'); };
    await assert.rejects(env.openDirectoryExport(request, env.browser), /Cannot open tab/);
    assert.equal(Object.keys(env.session).length, 0);
    assert.equal(env.legacyCalls(), 0);
    env.browser.storage.session.set = async () => { throw Error('Session quota exceeded'); };
    await assert.rejects(env.openDirectoryExport(request, env.browser), /quota/);
    await assert.rejects(env.openDirectoryExport({ messages: [] }, env.browser), /No conversation/);
});
