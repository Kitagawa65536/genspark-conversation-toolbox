const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const intervals = new Map();
let intervalId = 0;
const context = { console, URL, TextEncoder, Uint8Array, AbortController, setTimeout, clearTimeout, atob, btoa, fetch,
    setInterval: (callback, delay) => { const id = ++intervalId; intervals.set(id, { callback, delay }); return id; },
    clearInterval: id => intervals.delete(id) };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'markdown.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'bundle-export.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), context);
const { imageType, fetchImage, downloadCompleted, exportMarkdownBundle, localizeImages } = context.GensparkBackgroundHelpers;
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([255, 216, 255, 224, 0, 0]);
const date = new Date(2026, 9, 31, 12);
const tick = () => new Promise(resolve => setImmediate(resolve));
const request = { title: 'Grocery shopping illustration request for two characters', url: 'https://www.genspark.ai/agents?id=abc', messages: [{ type: 'assistant', markdown: 'Hello' }], images: [] };
const base = '2026-10-31-Grocery-shopping-illustration-request-for-two-characters';
function response(bytes = PNG, type = 'image/png', status = 200) {
    return { ok: status >= 200 && status < 300, status, headers: { get: key => key === 'content-type' ? type : null }, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}
function mockBrowser({ autoComplete = true, interrupted = [], rename = [], history = [], startError = false, earlyComplete = false } = {}) {
    const listeners = new Set(), calls = [], items = new Map(), storage = {};
    let nextId = 1;
    function change(id, state, error) {
        const item = items.get(id);
        item.state = state;
        if (error) item.error = error;
        for (const listener of listeners) listener({ id, state: { current: state }, ...(error && { error: { current: error } }) });
    }
    const browser = {
        storage: { local: { get: async () => ({ ...storage }), set: async value => Object.assign(storage, value) } },
        downloads: {
            onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
            search: async query => query.id !== undefined ? [items.get(query.id)].filter(Boolean) : history.filter(item => new RegExp(query.filenameRegex).test(item.filename)),
            cancel: async id => { if (items.has(id)) change(id, 'interrupted', 'USER_CANCELED'); },
            download: async options => {
                calls.push(options);
                if (startError) throw new Error('Download not permitted');
                const id = nextId++;
                items.set(id, { id, filename: 'C:\\Users\\test\\Downloads\\' + options.filename.replaceAll('/', '\\'), state: 'in_progress' });
                if (rename.includes(id)) items.get(id).filename += ' (1)';
                const complete = () => change(id, interrupted.includes(id) ? 'interrupted' : 'complete', interrupted.includes(id) ? 'NETWORK_FAILED' : undefined);
                if (earlyComplete) complete();
                else if (autoComplete) setImmediate(complete);
                return id;
            }
        }
    };
    return { browser, calls, items, listeners, change, storage };
}
function decodeMarkdown(call) { return Buffer.from(call.url.split(',')[1], 'base64').toString('utf8'); }
function options(mock, extra = {}) { return { browser: mock.browser, fetchImpl: async () => response(), date, ...extra }; }

test('signature sniffing selects actual PNG/JPEG/GIF/WebP/AVIF extension, not URL', () => {
    assert.equal(imageType(PNG).ext, 'png');
    assert.equal(imageType(JPEG).ext, 'jpeg');
    assert.equal(imageType(new TextEncoder().encode('GIF89a')).ext, 'gif');
    assert.equal(imageType(new TextEncoder().encode('RIFF0000WEBP')).ext, 'webp');
    assert.equal(imageType(new TextEncoder().encode('0000ftypavif')).ext, 'avif');
    assert.equal(imageType(new TextEncoder().encode('<html>login</html>')), null);
});

test('fetch rejects HTTP/login HTML, fake image bytes, oversize and unsupported schemes', async () => {
    await assert.rejects(fetchImage('https://cdn/x', { fetchImpl: async () => response(PNG, 'image/png', 403) }), /HTTP 403/);
    await assert.rejects(fetchImage('https://cdn/x', { fetchImpl: async () => response(PNG, 'text/html') }), /Not an image/);
    await assert.rejects(fetchImage('https://cdn/x', { fetchImpl: async () => response(new TextEncoder().encode('not an image')) }), /invalid image/);
    await assert.rejects(fetchImage('https://cdn/x', { fetchImpl: async () => response(), maxBytes: 2 }), /too large/);
    await assert.rejects(fetchImage('file:///x', { fetchImpl: async () => response() }), /Unsupported/);
    assert.equal((await fetchImage('https://cdn/fake.png', { fetchImpl: async () => response(JPEG, 'application/octet-stream') })).ext, 'jpeg');
});

test('stream size cap cancels the reader instead of buffering an unbounded body', async () => {
    let canceled = false;
    const streamResponse = response();
    streamResponse.body = { getReader: () => ({ read: async () => ({ done: false, value: PNG }), cancel: async () => { canceled = true; } }) };
    await assert.rejects(fetchImage('https://cdn/x', { maxBytes: 2, fetchImpl: async () => streamResponse }), /too large/);
    assert.equal(canceled, true);
});

test('a download ID is not success: waits for complete and removes listener', async () => {
    const mock = mockBrowser({ autoComplete: false });
    let finished = false;
    const promise = downloadCompleted(mock.browser, { url: 'data:image/png;base64,AA==', filename: 'genspark-md-files/x.png' }).then(result => { finished = true; return result; });
    await tick();
    assert.equal(finished, false);
    assert.equal(mock.listeners.size, 1);
    mock.change(1, 'complete');
    assert.equal((await promise).id, 1);
    assert.equal(mock.listeners.size, 0);
    assert.equal(mock.calls[0].conflictAction, 'prompt');
    assert.equal(mock.calls[0].saveAs, false);
});

test('early completion, interruption, rejection, timeout and renamed targets are handled', async () => {
    const early = mockBrowser({ earlyComplete: true });
    assert.equal((await downloadCompleted(early.browser, { url: 'data:,x', filename: 'genspark-md-files/x.md' })).id, 1);
    for (const settings of [{ interrupted: [1] }, { startError: true }, { rename: [1] }]) {
        const mock = mockBrowser(settings);
        await assert.rejects(downloadCompleted(mock.browser, { url: 'data:,x', filename: 'genspark-md-files/x.md' }));
        assert.equal(mock.listeners.size, 0);
    }
    const stalled = mockBrowser({ autoComplete: false });
    await assert.rejects(downloadCompleted(stalled.browser, { url: 'data:,x', filename: 'genspark-md-files/x.md' }, 5), /timed out/);
    assert.equal(stalled.listeners.size, 0);
    assert.equal(stalled.items.get(1).state, 'interrupted');
});

test('reference layout: completed image first, sibling Markdown last, actual extension', async () => {
    const mock = mockBrowser({ autoComplete: false });
    const image = 'https://cdn.example/fake.png?signature=1';
    let finished = false;
    const promise = exportMarkdownBundle({ ...request, messages: [{ type: 'assistant', markdown: `![art](<${image}>)` }], images: [image, { url: image }] }, options(mock, { fetchImpl: async () => response(JPEG) })).then(result => { finished = true; return result; });
    await tick();
    assert.equal(mock.calls.length, 1);
    assert.equal(finished, false);
    assert.equal(mock.calls[0].filename, `genspark-md-files/${base}-assets/images/generated-image-1.jpeg`);
    mock.change(1, 'complete');
    await tick();
    assert.equal(mock.calls.length, 2);
    assert.equal(finished, false);
    assert.equal(mock.calls[1].filename, `genspark-md-files/${base}.md`);
    const text = decodeMarkdown(mock.calls[1]);
    assert.ok(text.includes(`![art](<${base}-assets/images/generated-image-1.jpeg>)`));
    assert.ok(!text.includes('### Generated images'), 'inline images are not appended twice');
    mock.change(2, 'complete');
    const result = await promise;
    assert.equal(result.success, true);
    assert.equal(result.downloadedImages, 1);
    assert.equal(result.markdownSaved, true);
});

test('only completed images become local; HTTP failure and interruption stay remote', async () => {
    const mock = mockBrowser({ interrupted: [2] });
    const images = ['https://cdn/ok', 'https://cdn/http-fail', 'https://cdn/interrupted'];
    const result = await exportMarkdownBundle({ ...request, images, messages: [{ type: 'assistant', markdown: images.map(url => `![](<${url}>)`).join('\n') }] }, options(mock, { fetchImpl: async url => response(PNG, 'image/png', url.includes('http-fail') ? 404 : 200) }));
    assert.equal(result.success, false);
    assert.equal(result.markdownSaved, true);
    assert.equal(result.downloadedImages, 1);
    assert.equal(result.failed.length, 2);
    const text = decodeMarkdown(mock.calls.at(-1));
    assert.ok(text.includes(`${base}-assets/images/generated-image-1.png`));
    assert.ok(text.includes('![](<https://cdn/http-fail>)'));
    assert.ok(text.includes('![](<https://cdn/interrupted>)'));
    assert.ok(!text.includes('generated-image-2.png'));
    assert.ok(!text.includes('generated-image-3.png'));
});

test('explicit non-inline images receive reference appendix with saved and original links', async () => {
    const mock = mockBrowser();
    const result = await exportMarkdownBundle({ ...request, images: ['https://cdn/art'] }, options(mock));
    assert.equal(result.success, true);
    const text = decodeMarkdown(mock.calls.at(-1));
    assert.ok(text.includes('### Generated images'));
    assert.ok(text.includes(`![generated-image-1.png](<${base}-assets/images/generated-image-1.png>)`));
    assert.ok(text.includes('[Open saved image]'));
    assert.ok(text.includes('[Open original](<https://cdn/art>)'));
});

test('whole bundle collision naming changes Markdown and assets together, even after history removal', async () => {
    const mock = mockBrowser({ history: [{ filename: `C:\\Downloads\\genspark-md-files\\${base}.md` }] });
    const first = await exportMarkdownBundle({ ...request, images: ['https://cdn/art'] }, options(mock));
    const second = await exportMarkdownBundle({ ...request, images: ['https://cdn/art'] }, options(mock));
    assert.equal(first.markdownPath, `genspark-md-files/${base}-2.md`);
    assert.equal(second.markdownPath, `genspark-md-files/${base}-3.md`);
    assert.equal(mock.calls[0].filename, `genspark-md-files/${base}-2-assets/images/generated-image-1.png`);
    assert.ok(decodeMarkdown(mock.calls[3]).includes(`${base}-3-assets/images/generated-image-1.png`));
    assert.ok(mock.calls.every(call => call.conflictAction !== 'uniquify'));
});

test('Markdown interruption is failure, not a queued-success response', async () => {
    const mock = mockBrowser({ interrupted: [1] });
    const result = await exportMarkdownBundle(request, options(mock));
    assert.equal(result.success, false);
    assert.equal(result.markdownSaved, false);
    assert.match(result.error, /NETWORK_FAILED/);
});

test('signed query variants are exact; a failed variant never borrows a successful local path', () => {
    const text = '![](<https://cdn/image?sig=good>) ![](<https://cdn/image?sig=bad>)';
    const localized = localizeImages(text, new Map([['https://cdn/image?sig=good', 'x-assets/images/generated-image-1.png']]), 'https://genspark.ai/');
    assert.ok(localized.includes('x-assets/images/generated-image-1.png'));
    assert.ok(localized.includes('https://cdn/image?sig=bad'));
});

test('canonical dedup retains first original cache_control query for fetch and original link', async () => {
    const mock = mockBrowser();
    const first = 'https://www.genspark.ai/api/files/a?signature=exact&cache_control=3600';
    const other = 'https://www.genspark.ai/api/files/a?signature=exact&cache_control=7200#preview';
    const fetched = [];
    const result = await exportMarkdownBundle({ ...request, images: [first, other] }, options(mock, { fetchImpl: async url => { fetched.push(url); return response(); } }));
    assert.equal(result.totalImages, 1);
    assert.deepEqual(fetched, [first]);
    assert.ok(decodeMarkdown(mock.calls.at(-1)).includes(`[Open original](<${first}>)`));
});

test('already-local Markdown assets are not resolved against the remote conversation URL', async () => {
    const mock = mockBrowser();
    const fetched = [];
    const markdown = '![](images/already-local.png) ![[notes/local.png]] ![](/api/files/root-relative)';
    const result = await exportMarkdownBundle({ ...request, messages: [{ type: 'assistant', markdown }] }, options(mock, { fetchImpl: async url => { fetched.push(url); return response(); } }));
    assert.equal(result.totalImages, 1);
    assert.deepEqual(fetched, ['https://www.genspark.ai/api/files/root-relative']);
    const saved = decodeMarkdown(mock.calls.at(-1));
    assert.ok(saved.includes('![](images/already-local.png)'));
    assert.ok(saved.includes('![[notes/local.png]]'));
    assert.ok(saved.includes(`${base}-assets/images/generated-image-1.png`));
});

test('bundle deadline stops remaining images, preserves remote links and leaves time for Markdown', async () => {
    const mock = mockBrowser();
    const urls = ['https://cdn/one', 'https://cdn/two', 'https://cdn/three'];
    let clock = 0, fetched = 0;
    const result = await exportMarkdownBundle({ ...request, images: urls }, options(mock, { budget: 100, now: () => clock, fetchImpl: async () => { if (++fetched === 2) clock = 80; return response(); } }));
    assert.equal(result.markdownSaved, true);
    assert.equal(result.success, false);
    assert.equal(result.downloadedImages, 1);
    assert.equal(fetched, 2, 'third image must not be fetched once budget exhausted');
    assert.equal(result.failed.length, 2);
    assert.ok(result.failed.every(item => item.error.includes('time budget')));
    const text = decodeMarkdown(mock.calls.at(-1));
    assert.ok(text.includes('https://cdn/two'));
    assert.ok(text.includes('https://cdn/three'));
});

test('heartbeat keeps download waits active, concurrent exports reject busy, and cleanup always runs', async () => {
    const mock = mockBrowser({ autoComplete: false });
    let heartbeats = 0;
    mock.browser.runtime = { getPlatformInfo: async () => { heartbeats++; return {}; } };
    const pending = exportMarkdownBundle(request, options(mock));
    await tick();
    assert.equal(intervals.size, 1);
    const interval = [...intervals.values()][0];
    assert.equal(interval.delay, 20000);
    interval.callback();
    await tick();
    assert.equal(heartbeats, 1);
    await assert.rejects(exportMarkdownBundle(request, options(mock)), /in progress/);
    assert.equal(intervals.size, 1, 'busy rejection does not stop active export heartbeat');
    mock.change(1, 'complete');
    assert.equal((await pending).success, true);
    assert.equal(intervals.size, 0);
    await assert.rejects(exportMarkdownBundle({ messages: [] }, options(mock)), /No conversation/);
    assert.equal(intervals.size, 0, 'heartbeat removed after thrown validation error');
    const after = mockBrowser();
    assert.equal((await exportMarkdownBundle(request, options(after))).success, true, 'busy state cleared');
});

test('injected directory writer receives bytes/text and relative sibling paths without Downloads APIs', async () => {
    const files = new Map(), writes = [];
    const writer = {
        reserveBase: async () => 'chosen-base',
        writeFile: async (path, data) => { writes.push(path); files.set(path, data); },
        resultPath: path => 'My Vault/' + path
    };
    const result = await exportMarkdownBundle({ ...request, images: ['https://www.genspark.ai/api/files/s/a'] }, {
        writer, fetchImpl: async () => response(), date
    });
    assert.equal(result.markdownSaved, true);
    assert.equal(result.markdownPath, 'My Vault/chosen-base.md');
    assert.deepEqual(writes, ['chosen-base-assets/images/generated-image-1.png', 'chosen-base.md']);
    assert.ok(files.get('chosen-base-assets/images/generated-image-1.png') instanceof Uint8Array);
    assert.ok(files.get('chosen-base.md').includes('chosen-base-assets/images/generated-image-1.png'));
    assert.ok(!files.get('chosen-base.md').includes('genspark-md-files/'));
});

test('malicious title cannot escape Downloads-relative root; Unicode and text-only export work', async () => {
    const mock = mockBrowser();
    const result = await exportMarkdownBundle({ ...request, title: '../日本語/evil: *?' }, options(mock));
    assert.equal(result.success, true);
    assert.equal(mock.calls.length, 1);
    assert.match(mock.calls[0].filename, /^genspark-md-files\/[^/]+\.md$/);
    assert.ok(mock.calls[0].filename.includes('日本語'));
    assert.ok(decodeMarkdown(mock.calls[0]).includes('Hello'));
    await assert.rejects(exportMarkdownBundle({ messages: [] }, options(mock)), /No conversation/);
});
