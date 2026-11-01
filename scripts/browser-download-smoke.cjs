// Opt-in real Chrome API smoke test. No user profile or login is used.
// Usage: node scripts/browser-download-smoke.cjs (requires Chrome with CDP Extensions.loadUnpacked).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
class CDP {
    constructor(url) {
        this.socket = new WebSocket(url);
        this.next = 0;
        this.pending = new Map();
        this.ready = new Promise((resolve, reject) => { this.socket.onopen = resolve; this.socket.onerror = reject; });
        this.socket.onmessage = event => {
            const message = JSON.parse(event.data), pending = this.pending.get(message.id);
            if (!pending) return;
            this.pending.delete(message.id);
            message.error ? pending.reject(Error(JSON.stringify(message.error))) : pending.resolve(message.result);
        };
        this.socket.onclose = () => { for (const pending of this.pending.values()) pending.reject(Error('CDP closed')); this.pending.clear(); };
    }
    async call(method, params = {}) {
        await this.ready;
        const id = ++this.next;
        return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); });
    }
    async evaluate(expression) {
        const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
    }
    close() { this.socket.close(); }
}
(async () => {
    const root = path.resolve(__dirname, '..');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'genspark-browser-smoke-'));
    const downloads = path.join(profile, 'downloads');
    fs.mkdirSync(downloads);
    fs.mkdirSync(path.join(profile, 'Default'));
    // CDP Browser.setDownloadBehavior overrides extension filename suggestions;
    // use an ordinary profile preference to test the real folder semantics.
    fs.writeFileSync(path.join(profile, 'Default', 'Preferences'), JSON.stringify({ download: { default_directory: downloads, prompt_for_download: false } }));
    const executable = process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const child = spawn(executable, ['--headless=new', '--enable-unsafe-extension-debugging', '--user-data-dir=' + profile,
        '--remote-debugging-port=0', '--disable-background-networking', '--disable-sync', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
    let startupError;
    child.on('error', error => { startupError = error; });
    let browser, worker, popup, directoryPage;
    const exportPages = [];
    const timeout = setTimeout(() => { child.kill(); console.error('Browser test timed out:', profile); process.exit(2); }, 60000);
    try {
        let port;
        for (let n = 0; n < 100; n++) {
            if (startupError) throw startupError;
            const file = path.join(profile, 'DevToolsActivePort');
            if (fs.existsSync(file)) { port = fs.readFileSync(file, 'utf8').split('\n')[0]; break; }
            await pause(100);
        }
        assert.ok(port, 'Chrome did not expose a debugging endpoint');
        const endpoint = 'http://127.0.0.1:' + port;
        const version = await (await fetch(endpoint + '/json/version')).json();
        browser = new CDP(version.webSocketDebuggerUrl);
        const extension = await browser.call('Extensions.loadUnpacked', { path: root });
        await browser.call('Target.createTarget', { url: 'chrome-extension://' + extension.id + '/popup.html' });
        let popupTarget, workerTarget;
        for (let n = 0; n < 100; n++) {
            const targets = await (await fetch(endpoint + '/json/list')).json();
            popupTarget = targets.find(target => target.url === 'chrome-extension://' + extension.id + '/popup.html');
            workerTarget = targets.find(target => target.type === 'service_worker' && target.url === 'chrome-extension://' + extension.id + '/background.js');
            if (popupTarget && workerTarget) break;
            await pause(100);
        }
        assert.ok(popupTarget && workerTarget, 'Extension popup/worker did not load');
        popup = new CDP(popupTarget.webSocketDebuggerUrl);
        worker = new CDP(workerTarget.webSocketDebuggerUrl);
        // Mock only the network response. Runtime messaging, storage, completion
        // events, Chrome's filename resolution, and actual files are all real.
        await worker.evaluate(`globalThis.fetch = async url => ({ ok: true, headers: { get: () => '' },
            arrayBuffer: async () => new Uint8Array(url.includes('jpeg') ? [255,216,255,224] : [137,80,78,71,13,10,26,10]).buffer }); true`);
        await popup.evaluate(`chrome.storage.local.set({ markdownExportDestination: 'downloads' })`);
        const result = await popup.evaluate(`chrome.runtime.sendMessage({ action: 'exportMarkdownBundle',
            title: 'Grocery shopping illustration request for two characters', url: 'https://www.genspark.ai/agents?id=smoke',
            messages: [{ type: 'assistant', markdown: 'Real Chrome download test' }],
            images: [{ url: 'https://www.genspark.ai/api/files/s/smoke-png?cache_control=3600' },
                     { url: 'https://www.genspark.ai/api/files/s/smoke-jpeg?cache_control=3600' }] })`);
        assert.equal(result.markdownSaved, true, JSON.stringify(result));
        assert.equal(result.downloadedImages, 2, JSON.stringify(result));
        const markdownFile = path.join(downloads, result.markdownPath);
        const markdown = fs.readFileSync(markdownFile, 'utf8');
        const stem = path.basename(markdownFile, '.md');
        for (const [index, ext] of ['png', 'jpeg'].entries()) {
            const relative = `${stem}-assets/images/generated-image-${index + 1}.${ext}`;
            assert.ok(markdown.includes(relative), 'Missing local link: ' + relative);
            assert.ok(fs.existsSync(path.join(path.dirname(markdownFile), relative)), 'Missing image: ' + relative);
        }
        // Use real OPFS directory handles to verify IndexedDB structured cloning,
        // write/close, page routing and reuse without automating the OS picker.
        async function waitTarget(predicate) {
            for (let n = 0; n < 100; n++) {
                const targets = await (await fetch(endpoint + '/json/list')).json();
                const target = targets.find(predicate);
                if (target) return target;
                await pause(100);
            }
            throw Error('Expected export page did not open');
        }
        const settings = await browser.call('Target.createTarget', { url: 'chrome-extension://' + extension.id + '/export.html' });
        const settingsTarget = await waitTarget(target => target.id === settings.targetId && target.url.endsWith('/export.html'));
        directoryPage = new CDP(settingsTarget.webSocketDebuggerUrl);
        let directoryReady = false;
        for (let n = 0; n < 100; n++) {
            directoryReady = await directoryPage.evaluate('typeof GensparkDirectoryStore !== "undefined"');
            if (directoryReady) break;
            await pause(50);
        }
        assert.ok(directoryReady, 'Directory page scripts failed to load');
        const directorySupport = await directoryPage.evaluate(`(async () => {
            const root = await navigator.storage.getDirectory();
            const handle = await root.getDirectoryHandle('Chosen notes', { create: true });
            await GensparkDirectoryStore.save(handle);
            await chrome.storage.local.set({ markdownExportDestination: 'directory', markdownExportDirectoryName: handle.name });
            return { pickerAvailable: typeof showDirectoryPicker === 'function', permission: await handle.queryPermission({ mode: 'readwrite' }) };
        })()`);
        assert.equal(directorySupport.pickerAvailable, true);
        assert.equal(directorySupport.permission, 'granted');
        const directoryResults = [];
        for (let attempt = 0; attempt < 2; attempt++) {
            const queued = await popup.evaluate(`chrome.runtime.sendMessage({ action: 'exportMarkdownBundle', title: 'Remembered folder',
                url: 'https://www.genspark.ai/agents?id=smoke', messages: [{ type: 'assistant', markdown: 'Folder persistence test' }], images: [] })`);
            assert.equal(queued.savePageOpened, true);
            const target = await waitTarget(target => target.url.includes('/export.html?job=' + queued.jobId));
            const page = new CDP(target.webSocketDebuggerUrl);
            exportPages.push(page);
            let job;
            for (let n = 0; n < 100; n++) {
                job = await popup.evaluate(`chrome.storage.session.get('directory-export:${queued.jobId}').then(value => value['directory-export:${queued.jobId}'])`);
                if (job?.status === 'completed') break;
                await pause(50);
            }
            assert.equal(job?.status, 'completed', JSON.stringify(job));
            assert.equal(job.result.markdownSaved, true);
            assert.equal(job.request, undefined, 'Completed jobs must release private source payload');
            directoryResults.push(job.result);
            // A completed-job reload must not run the export a second time.
            await page.call('Page.reload');
            await pause(200);
        }
        assert.notEqual(directoryResults[0].markdownPath, directoryResults[1].markdownPath, 'Whole-base suffix collision protection');
        await directoryPage.call('Page.reload');
        await pause(300);
        const reused = await directoryPage.evaluate(`(async () => {
            const handle = await GensparkDirectoryStore.load();
            const root = await navigator.storage.getDirectory();
            const same = await handle.isSameEntry(await root.getDirectoryHandle('Chosen notes'));
            const entries = []; for await (const entry of handle.values()) entries.push(entry.name);
            const result = await GensparkBundle.exportMarkdownBundle({ title: 'Binary folder', url: 'https://www.genspark.ai/agents?id=smoke',
                messages: [{ type: 'assistant', markdown: 'Binary write test' }], images: ['https://www.genspark.ai/api/files/s/a'] }, {
                writer: GensparkDirectoryWriter.create(handle),
                fetchImpl: async () => ({ ok: true, headers: { get: () => '' }, arrayBuffer: async () => new Uint8Array([137,80,78,71,13,10,26,10]).buffer }) });
            const mdName = result.markdownPath.slice(handle.name.length + 1);
            const text = await (await (await handle.getFileHandle(mdName)).getFile()).text();
            const assets = await handle.getDirectoryHandle(mdName.replace(/\\.md$/, '-assets'));
            const images = await assets.getDirectoryHandle('images');
            const image = await (await images.getFileHandle('generated-image-1.png')).getFile();
            return { same, entries, result, linked: text.includes('-assets/images/generated-image-1.png'), imageSize: image.size };
        })()`);
        assert.equal(reused.same, true, 'Real directory handle survived page reload');
        assert.equal(reused.entries.length, 2, 'Completed reloads must not create duplicate files');
        assert.equal(reused.result.markdownSaved, true);
        assert.equal(reused.linked, true);
        assert.equal(reused.imageSize, 8);
        console.log(JSON.stringify({ passed: true, chrome: version.Browser, version: (await popup.evaluate('chrome.runtime.getManifest()')).version,
            downloads: { markdownPath: result.markdownPath, imageCount: result.downloadedImages },
            directory: { saved: directoryResults.map(result => result.markdownPath), rememberedHandle: reused.same,
                binaryImageSaved: reused.imageSize, nativePickerAutomated: false, testHandle: 'real OPFS handle' }, isolatedProfile: profile }, null, 2));
    } catch (error) { console.error(error, '\nIsolated profile:', profile); process.exitCode = 1; }
    finally {
        clearTimeout(timeout);
        if (worker) worker.close();
        if (popup) popup.close();
        if (directoryPage) directoryPage.close();
        for (const page of exportPages) page.close();
        if (browser) { await browser.call('Browser.close').catch(() => {}); browser.close(); }
        else child.kill();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
