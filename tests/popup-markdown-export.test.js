const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
function setup(saved = []) {
    const nodes = Object.fromEntries(Array.from(html.matchAll(/\bid="([^"]+)"/g), match => [match[1], {
        listeners: {}, style: {}, innerHTML: '', textContent: '',
        value: match[1] === 'savedDownloadFormat' ? 'md' : '',
        addEventListener(event, handler) { this.listeners[event] = handler; }
    }]));
    const blobs = new Map();
    const downloads = [];
    const revoked = [];
    const messages = [];
    const context = {
        document: { addEventListener() {}, getElementById: id => nodes[id] },
        window: { addEventListener() {} }, console, Blob, confirm: () => true,
        setTimeout() {},
        URL: class extends URL {
            static createObjectURL(blob) { const url = `blob:${blobs.size}`; blobs.set(url, blob); return url; }
            static revokeObjectURL(url) { revoked.push(url); }
        },
        chrome: {
            storage: { local: { get: async () => ({ savedConversations: saved }) } },
            downloads: { download: async options => { downloads.push(options); return 1; } }
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'markdown.js'), 'utf8'), context);
    vm.runInNewContext(fs.readFileSync(path.join(root, 'popup.js'), 'utf8') + '\nglobalThis.Manager = PopupManager;', context);
    const manager = Object.create(context.Manager.prototype);
    manager.currentLang = 'ja';
    manager.bindElements();
    manager.showLoading = () => {};
    manager.showMessage = (text, type) => messages.push({ text, type });
    return { manager, context, nodes, downloads, blobs, revoked, messages };
}

test('popup loads Markdown first, offers Markdown as primary action and keeps JSON/TXT/both', async () => {
    assert.ok(html.indexOf('src="markdown.js"') < html.indexOf('src="popup.js"'));
    assert.ok(html.indexOf('id="downloadMdBtn"') < html.indexOf('id="downloadBtn"'));
    assert.match(html, /<option value="md" selected>/);
    for (const value of ['md', 'json', 'txt', 'both']) assert.ok(html.includes(`value="${value}"`));
    const { manager, nodes } = setup();
    const formats = [];
    manager.downloadConversation = format => formats.push(format);
    manager.attachEventListeners();
    for (const id of ['downloadMdBtn', 'downloadBtn', 'downloadJsonBtn', 'downloadTxtBtn']) nodes[id].listeners.click();
    assert.deepEqual(formats, ['md', 'both', 'json', 'txt']);
    for (const lang of ['ja', 'en', 'he']) {
        manager.currentLang = lang;
        manager.updateButtonTexts();
        assert.match(nodes.downloadMdBtn.innerHTML, /Markdown/);
        assert.notEqual(manager.t('savedDownloadFormat'), 'savedDownloadFormat');
        assert.match(nodes.downloadBtn.innerHTML, /JSON \+ TXT/);
    }
    manager.setButtonsEnabled(false);
    assert.equal(nodes.downloadMdBtn.disabled, true);
    manager.setButtonsEnabled(true);
    assert.equal(nodes.downloadMdBtn.disabled, false);
});

test('current-conversation export defaults to md and passes selected formats unchanged', async () => {
    const { manager } = setup();
    manager.isConnected = true;
    const requested = [];
    manager.sendMessageToTab = async (action, payload) => { requested.push({ action, ...payload }); return { success: true }; };
    await manager.downloadConversation();
    for (const format of ['both', 'json', 'txt']) await manager.downloadConversation(format);
    assert.deepEqual(requested.map(request => request.format), ['md', 'both', 'json', 'txt']);
    assert.ok(requested.every(request => request.action === 'download' && request.language === 'ja'));
});

const saved = [{ title: 'Test conversation', url: 'https://www.genspark.ai/agents?id=test', savedAt: '2026-10-31T00:00:00Z',
    messageCount: 3, messages: [
        { type: 'user', content: 'plain question', markdown: '**Markdown question**' },
        { type: 'assistant', content: 'plain answer' },
        { type: 'assistant', text: 'legacy text answer' }
    ] }];

test('saved export defaults to Markdown, preserves rich text and supports old saved messages', async () => {
    const { manager, downloads, blobs, revoked, messages } = setup(saved);
    await manager.downloadAllConversations();
    assert.equal(downloads.length, 1);
    assert.match(downloads[0].filename, /\.md$/);
    const blob = blobs.get(downloads[0].url);
    assert.equal(blob.type, 'text/markdown;charset=utf-8');
    const content = await blob.text();
    for (const value of ['**Markdown question**', 'plain answer', 'legacy text answer', 'https://www.genspark.ai/agents?id=test']) assert.ok(content.includes(value));
    assert.ok(!content.includes('plain question'));
    assert.equal(revoked.length, 1);
    assert.equal(messages.at(-1).type, 'success');
});

test('saved export respects JSON/TXT/both selections without changing legacy content', async () => {
    for (const format of ['json', 'txt', 'both']) {
        const { manager, nodes, downloads, blobs, revoked } = setup(saved);
        nodes.savedDownloadFormat.value = format;
        await manager.downloadAllConversations();
        assert.deepEqual(downloads.map(download => download.filename.split('.').pop()), format === 'both' ? ['json', 'txt'] : [format]);
        for (const download of downloads) {
            const content = await blobs.get(download.url).text();
            assert.ok(content.includes('plain question'));
            assert.ok(content.includes('legacy text answer'));
            if (download.filename.endsWith('.json')) assert.deepEqual(JSON.parse(content).conversations, saved);
        }
        assert.equal(revoked.length, downloads.length);
    }
});

test('saved export reports failure and releases object URLs when download is rejected', async () => {
    const { manager, context, revoked, messages } = setup(saved);
    context.chrome.downloads.download = async () => { throw new Error('Download rejected'); };
    await manager.downloadAllConversations();
    assert.equal(messages.at(-1).type, 'error');
    assert.match(messages.at(-1).text, /Download rejected/);
    assert.equal(revoked.length, 1);
});

test('content-script reinjection loads the shared Markdown renderer first', async () => {
    const { manager, context } = setup();
    manager.currentTab = { id: 12 };
    let files;
    context.chrome.scripting = { executeScript: async options => { files = Array.from(options.files); } };
    context.setTimeout = callback => callback();
    await manager.injectContentScript();
    assert.deepEqual(files, ['markdown.js', 'content.js']);
});
