const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.join(__dirname, '..');
const pageSource = fs.readFileSync(path.join(root, 'export-page.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'export.html'), 'utf8');
const key = 'directory-export:job-1';
const goodResult = () => ({ success: true, markdownSaved: true, markdownPath: 'Vault/2026-11-01-Test.md', downloadedImages: 2, totalImages: 2, failed: [] });
const pendingJob = () => ({ createdAt: 123, status: 'pending', request: { title: 'テスト会話', url: 'https://www.genspark.ai/agents?id=test', messages: [{ type: 'assistant', markdown: '本文' }], images: [] } });
function harness(options = {}) {
    const events = [], writes = [], selected = [], removed = [];
    const nodes = Object.fromEntries(Array.from(html.matchAll(/\bid="([^"]+)"/g), match => [match[1], {
        textContent: '', hidden: false, disabled: false, dataset: {}, listeners: {},
        addEventListener(name, callback) { this.listeners[name] = callback; }
    }]));
    let permission = options.permission || 'granted';
    let requests = 0, queries = 0;
    const oldHandle = { name: 'Vault',
        queryPermission: async settings => { queries++; events.push('query'); assert.equal(settings.mode, 'readwrite'); return permission; },
        requestPermission: settings => { requests++; events.push('request'); assert.equal(settings.mode, 'readwrite'); permission = options.requestedPermission || 'granted'; return Promise.resolve(permission); }
    };
    let stored = options.missingHandle ? null : oldHandle;
    const local = { ...(options.local || {}) };
    const session = options.settings ? {} : { [key]: options.job || pendingJob() };
    const browser = { storage: {
        local: { get: async () => { events.push('local.get'); return { ...local }; },
            set: async value => { events.push('local.set'); Object.assign(local, value); },
            remove: async name => { removed.push(name); delete local[name]; } },
        session: { get: async name => { events.push('session.get'); return { [name]: session[name] }; },
            set: async value => { events.push('session.set'); Object.assign(session, value); } }
    } };
    const store = { load: async () => { events.push('store.load'); return stored; },
        save: async handle => { events.push('store.save'); selected.push(handle); stored = handle; },
        clear: async () => { stored = null; } };
    const writer = { create: handle => { events.push('writer.create'); return { handle, token: 'sink' }; } };
    const picker = options.unsupported ? undefined : settings => {
        events.push('picker');
        assert.equal(settings.id, 'genspark-export');
        assert.equal(settings.mode, 'readwrite');
        return options.pick ? options.pick(settings) : Promise.resolve(oldHandle);
    };
    const navigator = { locks: { request: async (name, callback) => {
        assert.equal(name, 'genspark-directory-export');
        events.push('lock');
        if (options.beforeLock) options.beforeLock(session);
        return callback();
    } } };
    const bundle = { exportMarkdownBundle: async (request, settings) => {
        events.push('engine'); writes.push({ request, settings });
        assert.equal(settings.browser, browser);
        assert.equal(settings.writer.token, 'sink');
        if (options.engine) return options.engine(request, settings);
        return options.result || goodResult();
    } };
    const document = { getElementById: id => nodes[id], addEventListener() {} };
    const context = { URLSearchParams, Date, console };
    vm.runInNewContext(pageSource, context);
    const page = new context.GensparkExportPage({ document, browser, store, writer, bundle, picker, navigator,
        location: { search: options.settings ? '' : '?job=job-1' } });
    return { page, events, writes, selected, removed, nodes, local, session, oldHandle,
        stored: () => stored, requests: () => requests, queries: () => queries, setPermission: value => { permission = value; } };
}

test('export page uses external ordered scripts only and exposes no absolute-path textbox', () => {
    const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+)"\s*>\s*<\/script>/g), match => match[1]);
    assert.deepEqual(scripts, ['markdown.js', 'bundle-export.js', 'directory-store.js', 'directory-writer.js', 'export-page.js']);
    assert.equal((html.match(/<script/g) || []).length, scripts.length);
    assert.doesNotMatch(html, /on(?:click|load)\s*=|<input[^>]+type="text"/i);
});

test('remembered allowed handle auto-saves pending job under lock without prompting', async () => {
    const env = harness(); await env.page.init();
    assert.equal(env.writes.length, 1);
    assert.equal(env.requests(), 0);
    assert.ok(!env.events.includes('picker'));
    assert.ok(env.events.indexOf('lock') < env.events.indexOf('engine'));
    assert.equal(env.session[key].status, 'completed');
    assert.equal(env.session[key].request, undefined, 'completed receipt does not retain private request');
    assert.equal(env.session[key].title, 'テスト会話');
    assert.equal(env.nodes.status.dataset.kind, 'success');
    assert.ok(env.nodes.result.textContent.includes('Vault/2026-11-01-Test.md'));
});

test('settings startup does not pick, request permission, lock, or write', async () => {
    const env = harness({ settings: true, permission: 'prompt' }); await env.page.init();
    assert.equal(env.writes.length, 0);
    assert.equal(env.requests(), 0);
    assert.ok(!env.events.includes('picker'));
    assert.ok(!env.events.includes('lock'));
    assert.equal(env.nodes.grantPermission.hidden, true);
});

test('missing handle and prompt/denied permissions leave job pending with no implicit consent', async () => {
    for (const options of [{ missingHandle: true }, { permission: 'prompt' }, { permission: 'denied' }]) {
        const env = harness(options); await env.page.init();
        assert.equal(env.writes.length, 0);
        assert.equal(env.requests(), 0);
        assert.equal(env.session[key].status, 'pending');
        assert.ok(!env.events.includes('picker'));
        if (!options.missingHandle) assert.equal(env.nodes.grantPermission.hidden, false);
        assert.notEqual(env.local.markdownExportDestination, 'downloads');
    }
});

test('picker is invoked immediately on click before storage awaits and then auto-saves', async () => {
    const env = harness({ missingHandle: true }); await env.page.init();
    env.events.length = 0;
    const pending = env.nodes.chooseFolder.listeners.click();
    assert.equal(env.events[0], 'picker');
    assert.ok(!env.events.includes('store.save'), 'picker promise not yet resolved');
    await pending;
    assert.equal(env.writes.length, 1);
    assert.equal(env.local.markdownExportDestination, 'directory');
    assert.equal(env.local.markdownExportDirectoryName, 'Vault');
    assert.equal(env.session[key].status, 'completed');
});

test('choosing a folder on settings page persists only; no job writes', async () => {
    const env = harness({ settings: true, missingHandle: true }); await env.page.init();
    await env.nodes.chooseFolder.listeners.click();
    assert.equal(env.stored(), env.oldHandle);
    assert.equal(env.local.markdownExportDirectoryName, 'Vault');
    assert.equal(env.writes.length, 0);
    assert.equal(env.requests(), 0);
});

test('picker AbortError is normal cancellation and retains previous folder and Downloads preference', async () => {
    const abort = Object.assign(new Error('picker canceled'), { name: 'AbortError' });
    const env = harness({ settings: true, local: { markdownExportDestination: 'downloads', markdownExportDirectoryName: 'Vault' },
        pick: () => Promise.reject(abort) });
    await env.page.init(); await env.nodes.chooseFolder.listeners.click();
    assert.equal(env.stored(), env.oldHandle);
    assert.equal(env.page.handle, env.oldHandle);
    assert.equal(env.selected.length, 0);
    assert.equal(env.local.markdownExportDestination, 'downloads');
    assert.equal(env.nodes.status.dataset.kind, 'info');
    assert.ok(env.nodes.status.textContent.includes('キャンセル'));
    assert.equal(env.writes.length, 0);
});

test('consent button requests permission in original gesture before storage or lock', async () => {
    const env = harness({ permission: 'prompt' }); await env.page.init(); env.events.length = 0;
    const pending = env.nodes.grantPermission.listeners.click();
    assert.equal(env.events[0], 'request');
    assert.equal(env.writes.length, 0);
    await pending;
    assert.equal(env.writes.length, 1);
    assert.equal(env.session[key].status, 'completed');
});

test('denied user consent never falls back to Downloads or completes job', async () => {
    const env = harness({ permission: 'prompt', requestedPermission: 'denied' }); await env.page.init();
    await env.nodes.grantPermission.listeners.click();
    assert.equal(env.requests(), 1);
    assert.equal(env.writes.length, 0);
    assert.equal(env.session[key].status, 'pending');
    assert.notEqual(env.local.markdownExportDestination, 'downloads');
    assert.equal(env.nodes.status.dataset.kind, 'info');
});

test('completed job reload renders stored receipt even without request, handle or consent', async () => {
    const env = harness({ missingHandle: true, job: { createdAt: 123, title: '既存', status: 'completed', result: goodResult() } });
    await env.page.init();
    assert.equal(env.writes.length, 0);
    assert.equal(env.requests(), 0);
    assert.ok(!env.events.includes('lock'));
    assert.ok(env.nodes.status.textContent.includes('保存済み'));
    assert.equal(env.nodes.jobTitle.textContent, '既存');
});

test('lock re-reads completed job from another tab instead of duplicating writes', async () => {
    const env = harness({ beforeLock: session => { session[key] = { status: 'completed', result: goodResult() }; } });
    await env.page.init();
    assert.equal(env.writes.length, 0);
    assert.ok(env.events.includes('lock'));
    assert.ok(env.nodes.status.textContent.includes('重複'));
});

test('success is not displayed or job completed before engine write/close promise resolves', async () => {
    let finish;
    const env = harness({ engine: () => new Promise(resolve => { finish = resolve; }) });
    const pending = env.page.init();
    for (let n = 0; n < 20 && !finish; n++) await Promise.resolve();
    assert.equal(typeof finish, 'function');
    assert.equal(env.session[key].status, 'pending');
    assert.notEqual(env.nodes.status.dataset.kind, 'success');
    finish(goodResult()); await pending;
    assert.equal(env.session[key].status, 'completed');
    assert.equal(env.nodes.status.dataset.kind, 'success');
});

test('real engine failure keeps pending, shows actual error, and retry rechecks permission', async () => {
    let attempts = 0;
    const env = harness({ engine: () => ++attempts === 1 ? { markdownSaved: false, error: 'FILE_ACCESS_DENIED' } : goodResult() });
    await env.page.init();
    assert.equal(env.nodes.status.textContent, 'FILE_ACCESS_DENIED');
    assert.equal(env.nodes.status.dataset.kind, 'error');
    assert.equal(env.session[key].status, 'pending');
    assert.equal(env.nodes.retryExport.hidden, false);
    env.events.length = 0;
    const pending = env.nodes.retryExport.listeners.click();
    assert.equal(env.events[0], 'request');
    await pending;
    assert.equal(env.writes.length, 2);
    assert.equal(env.session[key].status, 'completed');
});

test('thrown write error remains pending and visible rather than reported as success', async () => {
    const env = harness({ engine: () => { throw Error('Disk full'); } }); await env.page.init();
    assert.equal(env.session[key].status, 'pending');
    assert.equal(env.nodes.status.textContent, 'Disk full');
    assert.equal(env.nodes.status.dataset.kind, 'error');
    assert.equal(env.nodes.retryExport.hidden, false);
    assert.equal(env.session[key].result.markdownSaved, false);
    assert.equal(env.session[key].result.error, 'Disk full');
    assert.ok(env.session[key].request, 'pending retry retains request');
});

test('thrown error diagnostics never revert a job another tab already completed', async () => {
    const completed = { status: 'completed', title: 'saved elsewhere', result: goodResult() };
    const env = harness({ engine: () => { env.session[key] = completed; throw Error('Late writer failure'); } });
    await env.page.init();
    assert.equal(env.session[key], completed);
    assert.equal(env.page.job.status, 'completed');
    assert.equal(env.nodes.status.textContent, 'Late writer failure');
    assert.equal(env.nodes.retryExport.hidden, true);
});

test('diagnostic session persistence failure does not replace original write error', async () => {
    const env = harness({ engine: () => { throw Error('Original disk error'); } });
    env.page.browser.storage.session.set = async () => { throw Error('Session storage unavailable'); };
    await env.page.init();
    assert.equal(env.nodes.status.textContent, 'Original disk error');
    assert.equal(env.nodes.status.dataset.kind, 'error');
    assert.equal(env.session[key].status, 'pending');
});

test('partial image result completes saved Markdown with warning and detailed failures', async () => {
    const result = { ...goodResult(), success: false, downloadedImages: 1, failed: [{ url: 'https://example.test/image', error: 'HTTP 403' }] };
    const env = harness({ result }); await env.page.init();
    assert.equal(env.session[key].status, 'completed');
    assert.equal(env.nodes.status.dataset.kind, 'warning');
    assert.ok(env.nodes.status.textContent.includes('元の画像リンク'));
    assert.ok(env.nodes.result.textContent.includes('HTTP 403'));
});

test('permission revoked while lock waits does not trigger permission request or writes', async () => {
    const env = harness({ beforeLock: () => env.setPermission('denied') }); await env.page.init();
    assert.equal(env.writes.length, 0);
    assert.equal(env.requests(), 0);
    assert.equal(env.session[key].status, 'pending');
    assert.equal(env.nodes.grantPermission.hidden, false);
});

test('forget clears remembered handle/name without writing or deleting files', async () => {
    const env = harness({ settings: true, local: { markdownExportDirectoryName: 'Vault' } }); await env.page.init();
    await env.nodes.forgetFolder.listeners.click();
    assert.equal(env.stored(), null);
    assert.equal(env.page.handle, null);
    assert.equal(env.local.markdownExportDirectoryName, undefined);
    assert.deepEqual(env.removed, ['markdownExportDirectoryName']);
    assert.equal(env.writes.length, 0);
});

test('Downloads is explicit opt-in and does not silently save pending job', async () => {
    const env = harness({ permission: 'prompt' }); await env.page.init();
    await env.nodes.useDownloads.listeners.click();
    assert.equal(env.local.markdownExportDestination, 'downloads');
    assert.equal(env.session[key].status, 'pending');
    assert.equal(env.writes.length, 0);
    assert.ok(env.nodes.status.textContent.includes('まだ保存していません'));
});

test('explicit Downloads preference prevents auto-writing a stale directory job', async () => {
    const env = harness({ local: { markdownExportDestination: 'downloads' } }); await env.page.init();
    assert.equal(env.writes.length, 0);
    assert.equal(env.requests(), 0);
    assert.equal(env.session[key].status, 'pending');
});

test('unsupported picker displays clear information and keeps Downloads option available', async () => {
    const env = harness({ unsupported: true }); await env.page.init();
    assert.equal(env.writes.length, 0);
    assert.equal(env.nodes.chooseFolder.disabled, true);
    assert.equal(env.nodes.useDownloads.disabled, false);
    assert.ok(env.nodes.status.textContent.includes('対応していません'));
    assert.notEqual(env.local.markdownExportDestination, 'downloads');
});

function popupHarness() {
    const popupHtml = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
    const nodes = Object.fromEntries(Array.from(popupHtml.matchAll(/\bid="([^"]+)"/g), match => [match[1], {
        listeners: {}, style: {}, innerHTML: '', textContent: '', disabled: false,
        addEventListener(name, callback) { this.listeners[name] = callback; }
    }]));
    const tabs = [], messages = [];
    const context = { console, URL, Blob, setTimeout() {}, document: { addEventListener() {}, getElementById: id => nodes[id] },
        window: { addEventListener() {} }, chrome: { runtime: { getURL: file => 'chrome-extension://test/' + file },
            tabs: { create: async settings => tabs.push(settings) } } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'popup.js'), 'utf8') + '\nglobalThis.PopupManagerForTest = PopupManager;', context);
    const manager = Object.create(context.PopupManagerForTest.prototype);
    manager.currentLang = 'ja'; manager.currentSearchMode = 'conversation'; manager.bindElements();
    manager.showLoading = () => {}; manager.showMessage = (text, type) => messages.push({ text, type });
    return { manager, nodes, tabs, messages, popupHtml };
}

test('folder settings popup button is always enabled outside Genspark and opens top-level settings page', async () => {
    const env = popupHarness();
    assert.doesNotMatch(env.popupHtml.match(/<button[^>]*id="directorySettingsBtn"[^>]*>/)[0], /disabled/);
    env.manager.isConnected = false;
    env.manager.setButtonsEnabled(false);
    assert.equal(env.nodes.directorySettingsBtn.disabled, false);
    env.manager.attachEventListeners();
    await env.nodes.directorySettingsBtn.listeners.click();
    // Existing click handlers deliberately do not return their async methods.
    for (let n = 0; n < 4; n++) await Promise.resolve();
    assert.equal(env.tabs[0].url, 'chrome-extension://test/export.html');
    for (const language of ['ja', 'en', 'he']) {
        env.manager.currentLang = language; env.manager.updateButtonTexts();
        assert.ok(env.nodes.directorySettingsBtn.innerHTML.length > 10);
        assert.ok(!env.nodes.directorySettingsBtn.innerHTML.includes('directorySettingsBtn'));
    }
});

test('queued directory page is informational, never a completed download in ja/en/he', async () => {
    for (const language of ['ja', 'en', 'he']) {
        const env = popupHarness();
        env.manager.isConnected = true; env.manager.currentLang = language;
        let request;
        env.manager.sendMessageToTab = async (action, data) => { request = { action, data }; return { queued: true, savePageOpened: true, jobId: 'job-1' }; };
        await env.manager.downloadConversation();
        assert.equal(request.action, 'download');
        assert.equal(request.data.format, 'md');
        assert.equal(env.messages.at(-1).type, 'info');
        assert.equal(env.messages.at(-1).text, env.manager.t('savePageOpened'));
        assert.ok(!env.messages.some(message => message.type === 'success'));
    }
});
