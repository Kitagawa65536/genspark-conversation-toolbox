const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { diagnosticDocument } = require('./helpers/diagnostic-dom');
const fixture = require('./fixtures/image-generation-dom.json');
const root = path.join(__dirname, '..');
const title = 'Grocery shopping illustration request for two characters';
const base = 'https://www.genspark.ai/agents?id=sample';
const stem = '2026-10-31-Grocery-shopping-illustration-request-for-two-characters';

function setup(structure = fixture.structure) {
    const document = diagnosticDocument(structure);
    document.title = title;
    const calls = [], state = {}, listeners = new Set();
    const browser = {
        storage: { local: {
            get: async () => state,
            set: async value => Object.assign(state, value)
        } },
        downloads: {
            onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
            download: async options => { calls.push({ ...options, id: calls.length + 1 }); return calls.length; },
            search: async query => query.id
                ? [{ id: query.id, state: 'complete', filename: 'C:/Downloads/' + calls[query.id - 1].filename }]
                : [],
            cancel: async () => {}
        }
    };
    const fetched = [];
    let failImages = false, failMarkdown = false;
    const context = { document, window: { location: { href: base } }, URL, Blob,
        console: { log() {}, error() {} }, TextEncoder, Uint8Array, AbortController,
        setTimeout, clearTimeout, setInterval, clearInterval, btoa, Date,
        Node: { TEXT_NODE: 3, ELEMENT_NODE: 1, DOCUMENT_POSITION_FOLLOWING: 4, DOCUMENT_POSITION_PRECEDING: 2 },
        chrome: { runtime: { getManifest: () => ({ version: '2.6.2' }) } }
    };
    vm.createContext(context);
    for (const file of ['markdown.js', 'bundle-export.js', 'content.js', 'background.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    }
    context.chrome.runtime.sendMessage = async request => {
        if (failMarkdown) return { success: false, markdownSaved: false, markdownPath: 'requested-but-not-saved.md', error: 'FILE_ACCESS_DENIED' };
        assert.equal(request.action, 'exportMarkdownBundle');
        return context.GensparkBackgroundHelpers.exportMarkdownBundle(request, {
            browser, markdown: context.GensparkMarkdown, date: new Date(2026, 9, 31),
            fetchImpl: async url => {
                fetched.push(url);
                if (failImages) throw Error('Network failure');
                const bytes = url.includes('generated3') ? [255, 216, 255, 1] : [137, 80, 78, 71, 13, 10, 26, 10, 1];
                return { ok: true, headers: { get: () => '' }, arrayBuffer: async () => new Uint8Array(bytes).buffer };
            }
        });
    };
    const markdownText = () => Buffer.from(calls.find(call => call.filename.endsWith('.md')).url.split(',')[1], 'base64').toString('utf8');
    return { context, toolbox: context.window.gensparkConversationManager, markdown: context.GensparkMarkdown,
        calls, fetched, listeners, markdownText,
        failImages: () => { failImages = true; }, failMarkdown: () => { failMarkdown = true; } };
}

test('actual diagnostic structure preserves three questions, eight answer blocks and four image grids', () => {
    const { toolbox, markdown } = setup();
    const messages = toolbox.extractConversation();
    assert.equal(messages.filter(message => message.type === 'user').length, 3);
    assert.equal(messages.filter(message => message.type === 'assistant' && message.markdown).length, 8);
    const urls = messages.flatMap(message => message.images.map(image => image.url));
    assert.deepEqual(Array.from(urls), [1, 2, 3, 4].map(i => `https://www.genspark.ai/api/files/s/generated${i}?cache_control=3600`));
    const text = markdown.renderConversation({ title, url: base, messages });
    assert.equal((text.match(/^## You$/gm) || []).length, 3);
    assert.equal((text.match(/^## Genspark$/gm) || []).length, 8, 'no empty assistant headings from tool/image-only rows');
    assert.doesNotMatch(text, /TOOL_CONTROL|model-icon/);
    assert.ok(text.includes('[Reference image 1](<https://www.genspark.ai/api/files/s/reference1>)'));
    assert.ok(text.includes('[Reference image 2](<https://www.genspark.ai/api/files/s/reference2>)'));
    for (let i = 1; i <= 8; i++) assert.ok(text.includes(`answer-${i}`), `answer ${i} was preserved`);
});

test('diagnostic replay to worker produces reference sibling layout and PNG/JPEG extensions', async () => {
    const env = setup();
    const response = await env.toolbox.downloadConversation();
    assert.equal(response.success, true);
    assert.equal(response.imageCount, 4);
    assert.equal(response.failedImageCount, 0);
    assert.equal(env.calls.length, 5);
    const extensions = ['png', 'png', 'jpeg', 'png'];
    for (let i = 0; i < 4; i++) {
        assert.equal(env.calls[i].filename, `genspark-md-files/${stem}-assets/images/generated-image-${i + 1}.${extensions[i]}`);
    }
    assert.equal(env.calls[4].filename, `genspark-md-files/${stem}.md`);
    const text = env.markdownText();
    assert.ok(text.includes('### Generated images'));
    assert.equal((text.match(/Open saved image/g) || []).length, 4);
    assert.equal((text.match(/Open original/g) || []).length, 4);
    assert.ok(text.includes(`${stem}-assets/images/generated-image-3.jpeg`));
    assert.ok(text.includes('https://www.genspark.ai/api/files/s/generated1?cache_control=3600'));
    assert.equal(env.fetched.length, 4, 'background/preview duplicates and model icons excluded');
    assert.equal(env.listeners.size, 0);
});

test('download failure preserves original links and returns a partial warning, never broken local links', async () => {
    const env = setup(); env.failImages();
    const response = await env.toolbox.downloadConversation();
    assert.equal(response.success, true, 'Markdown still saved');
    assert.equal(response.imageCount, 0);
    assert.equal(response.failedImageCount, 4);
    assert.equal(env.calls.length, 1);
    const text = env.markdownText();
    assert.ok(text.includes('https://www.genspark.ai/api/files/s/generated1?cache_control=3600'));
    assert.doesNotMatch(text, /-assets\/images\//);
});

test('dedicated save-page handoff is pending, then diagnostics retrieve the actual page result', async () => {
    const env = setup();
    env.context.chrome.runtime.sendMessage = async request => request.action === 'exportMarkdownBundle'
        ? { queued: true, savePageOpened: true, jobId: 'job-1' }
        : { status: 'completed', result: { markdownSaved: true, markdownPath: 'Vault/test.md', downloadedImages: 4, failed: [] } };
    const result = await env.toolbox.downloadConversation();
    assert.equal(result.queued, true);
    assert.equal(result.success, undefined);
    assert.equal(env.toolbox.lastExport.status, 'waiting-for-save-page');
    const diagnostics = await env.toolbox.getExportDiagnostics();
    assert.equal(diagnostics.lastExport.status, 'completed');
    assert.equal(diagnostics.lastExport.markdownPath, 'Vault/test.md');
    assert.equal(diagnostics.lastExport.queued, false);
});

test('a requested Markdown path alone is not a successful save', async () => {
    const env = setup(); env.failMarkdown();
    const result = await env.toolbox.downloadConversation();
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'downloadError');
    assert.equal(result.errorDetail, 'FILE_ACCESS_DENIED');
    const diagnostic = env.toolbox.getExtractionDiagnostics();
    assert.equal(diagnostic.lastExport.status, 'failed');
    assert.equal(diagnostic.lastExport.error, 'FILE_ACCESS_DENIED');
    assert.equal(diagnostic.lastExport.markdownPath, 'requested-but-not-saved.md');
});

test('Naive UI foreground image wins over distinct blurred preview URLs and model badges', () => {
    const image = src => ({ tag: 'img', src });
    const structure = { tag: 'body', children: [{ tag: 'div', class: 'conversation-item-desc assistant', children: [
        { tag: 'div', class: 'model-label', children: [image('https://example.test/badge.png')] },
        { tag: 'div', class: 'generated-images', children: [
            { tag: 'div', class: 'image-grid', children: [image('https://example.test/blur.png'),
                { tag: 'div', class: 'n-image', children: [image('https://www.genspark.ai/api/files/s/full')] }] }
        ] }
    ] }] };
    const messages = setup(structure).toolbox.extractConversation();
    assert.equal(messages.length, 1);
    assert.deepEqual(Array.from(messages[0].images, image => image.url), ['https://www.genspark.ai/api/files/s/full']);
    assert.equal(messages[0].markdown, '');
});

test('source dates are not invented and filename segments remain safe', () => {
    const { markdown } = setup();
    const text = markdown.renderConversation({ title, url: base, messages: [], created: '2026-10-17T09:33:32.358Z' });
    assert.ok(text.includes('created: "2026-10-17T09:33:32.358Z"'));
    assert.doesNotMatch(markdown.renderConversation({ messages: [] }), /\n(?:created|updated):/);
    const name = markdown.safeName('../a/b\\c:d*e?f"g<h>i|j[[k]]#^l. ');
    assert.doesNotMatch(name, /[<>:"/\\|?*\[\]^]/);
    assert.doesNotMatch(name, /^[. ]|[. ]$/);
    assert.equal(Array.from(markdown.safeName('あ'.repeat(400))).length, 100);
});
