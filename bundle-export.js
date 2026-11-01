/* Shared Markdown/image bundle engine. A writer may target Downloads or a chosen directory. */
const EXPORT_ROOT = 'genspark-md-files';
let exportBusy = false;

function toBase64(value) {
    const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

// Trust file signatures, not a signed URL's suffix or a server's guessed MIME.
function imageType(bytes) {
    const starts = values => values.every((value, i) => bytes[i] === value);
    const text = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
    if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return { ext: 'png', mime: 'image/png' };
    if (starts([255, 216, 255])) return { ext: 'jpeg', mime: 'image/jpeg' };
    if (['GIF87a', 'GIF89a'].includes(text(0, 6))) return { ext: 'gif', mime: 'image/gif' };
    if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
    if (text(4, 8) === 'ftyp' && /^(avif|avis)$/.test(text(8, 12))) return { ext: 'avif', mime: 'image/avif' };
    if (starts([66, 77]) && bytes.length >= 26) return { ext: 'bmp', mime: 'image/bmp' };
    return null;
}

async function fetchImage(url, { fetchImpl = fetch, timeout = 20000, maxBytes = 20 * 1024 * 1024 } = {}) {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Unsupported image URL');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const credentials = /(?:^|\.)genspark\.ai$/i.test(parsed.hostname) ? 'include' : 'omit';
        const response = await fetchImpl(url, { signal: controller.signal, credentials });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (mime && !mime.startsWith('image/') && mime !== 'application/octet-stream') throw new Error(`Not an image: ${mime}`);
        if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Image too large');
        let bytes;
        if (response.body?.getReader) {
            const reader = response.body.getReader(), chunks = [];
            let length = 0;
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    length += value.byteLength;
                    if (length > maxBytes) throw new Error('Image too large');
                    chunks.push(value);
                }
            } catch (error) {
                await reader.cancel().catch(() => {});
                throw error;
            }
            bytes = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        } else {
            bytes = new Uint8Array(await response.arrayBuffer());
        }
        if (bytes.length > maxBytes) throw new Error('Image too large');
        const type = imageType(bytes);
        if (!type) throw new Error('Unsupported or invalid image bytes');
        return { bytes, ...type };
    } finally { clearTimeout(timer); }
}

// Install the listener BEFORE starting a download; search covers a completion
// occurring before download() resolves. An ID means started, never completed.
function downloadCompleted(browser, options, timeout = 120000) {
    return new Promise((resolve, reject) => {
        let id, settled = false;
        const early = new Map();
        const finish = (error, item) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            browser.downloads.onChanged.removeListener(changed);
            error ? reject(error) : resolve(item);
        };
        const inspect = item => {
            if (item.state === 'interrupted' || item.error) return finish(new Error(item.error?.current || item.error || 'Download interrupted'));
            if (item.state === 'complete') {
                const filename = String(item.filename || '').replace(/\\/g, '/');
                if (!(filename === options.filename || filename.endsWith('/' + options.filename))) return finish(new Error('Download target changed; refusing broken local links'));
                finish(null, { id, filename });
            }
        };
        const check = () => browser.downloads.search({ id }).then(items => {
            if (items[0]) inspect(items[0]);
            else finish(new Error('Download disappeared'));
        }).catch(error => finish(error));
        const changed = delta => {
            if (id === undefined) { early.set(delta.id, delta); return; }
            if (delta.id !== id) return;
            if (delta.state?.current === 'interrupted') finish(new Error(delta.error?.current || 'Download interrupted'));
            else if (delta.state?.current === 'complete') check();
        };
        const timer = setTimeout(() => {
            finish(new Error('Download completion timed out'));
            if (id !== undefined) browser.downloads.cancel(id).catch(() => {});
        }, timeout);
        browser.downloads.onChanged.addListener(changed);
        // A file copied outside extension history may still collide. Never
        // silently overwrite it or accept a per-file uniquified local path.
        Promise.resolve().then(() => browser.downloads.download({ ...options, saveAs: false, conflictAction: 'prompt' }))
            .then(downloadId => {
                id = downloadId;
                if (settled) { browser.downloads.cancel(id).catch(() => {}); return; }
                if (!Number.isInteger(id)) return finish(new Error('Download did not start'));
                if (early.has(id)) changed(early.get(id));
                early.clear();
                check();
            }).catch(error => finish(error));
    });
}

async function reserveBase(title, browser, markdown, date) {
    const proposed = markdown.filename(title, date).replace(/\.md$/i, '').replace(/\s+/g, '-');
    const { markdownBundleNames = {} } = await browser.storage.local.get('markdownBundleNames');
    let suffix = Number(markdownBundleNames[proposed]) || 0;
    let base;
    do {
        base = proposed + (suffix ? `-${suffix + 1}` : '');
        suffix++;
        const escaped = `${EXPORT_ROOT}/${base}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existing = await browser.downloads.search({ filenameRegex: `[/\\\\]${escaped.replace(/\//g, '[/\\\\]')}(\\.md|-assets[/\\\\])` });
        if (!existing.length) break;
    } while (true);
    // Reserve the WHOLE bundle before creating any file. Persisted across worker
    // restarts and history deletion; failed exports also retain their reservation.
    markdownBundleNames[proposed] = suffix;
    await browser.storage.local.set({ markdownBundleNames });
    return base;
}

function originalImageUrl(value, base) {
    try {
        const source = String(value).replace(/&amp;/g, '&');
        // Relative Markdown assets are already local, not URLs to refetch.
        if (!/^(?:https?:\/\/|\/)/i.test(source)) return '';
        const url = new URL(source, base);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
}

function normalizeImageUrl(value, base) {
    const original = originalImageUrl(value, base);
    if (!original) return '';
    const url = new URL(original);
    url.hash = '';
    if (/(?:^|\.)genspark\.ai$/i.test(url.hostname)) url.searchParams.delete('cache_control');
    return url.href;
}

// Exact URL matching deliberately preserves signed query strings. A failed
// signed variant must not accidentally reuse a different successful URL.
function localizeImages(text, successes, base) {
    const lookup = value => successes.get(normalizeImageUrl(value, base));
    const destination = path => `<${path.replace(/>/g, '%3E')}>`;
    return text.replace(/(!\[[^\]\n]*\]\()(<[^>]+>|[^)\s]+)(\s+"[^"]*")?\)|!\[\[([^\]|\n]+)(\|[^\]\n]*)?\]\]|<img\b[^>]*>/gi,
        (whole, prefix, source, title, wiki, size) => {
            if (prefix) {
                const path = lookup(source.replace(/^<|>$/g, ''));
                return path ? `${prefix}${destination(path)}${title || ''})` : whole;
            }
            if (wiki) {
                const path = lookup(wiki);
                return path ? `![[${path}${size || ''}]]` : whole;
            }
            return whole.replace(/\bsrc=(['"])(.*?)\1/i, (attribute, quote, url) => {
                const path = lookup(url);
                return path ? `src=${quote}${path}${quote}` : attribute;
            });
        });
}

async function performMarkdownBundle(request, { browser = globalThis.chrome, markdown = globalThis.GensparkMarkdown, fetchImpl = fetch, date = new Date(), downloadTimeout = 120000, budget = 210000, now = Date.now, writer: providedWriter } = {}) {
    // Bound the entire export below MV3's five-minute handler limit, reserving
    // the final 15 seconds for Markdown even when many image requests fail.
    const deadline = now() + Math.min(225000, Math.max(1, budget));
    const imageTimeLeft = () => deadline - now() - Math.min(15000, budget / 4);
    if (!Array.isArray(request.messages) || !request.messages.length) throw new Error('No conversation messages to export');
    const title = String(request.title || 'Genspark conversation');
    let text = markdown.renderConversation({ title, url: request.url || '', messages: request.messages, created: request.created || '', includeImages: false });
    const sources = (Array.isArray(request.images) ? request.images : []).map(image => typeof image === 'string' ? image : image?.url).filter(Boolean);
    const inline = new Set();
    // Include Markdown image destinations even if the DOM observer missed them.
    for (const match of text.matchAll(/!\[[^\]\n]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)|!\[\[([^\]|\n]+)(?:\|[^\]\n]*)?\]\]/g)) {
        const source = (match[1] || match[2]).replace(/^<|>$/g, '');
        sources.push(source);
        inline.add(normalizeImageUrl(source, request.url));
    }
    for (const match of text.matchAll(/<img\b[^>]*\bsrc=['"]([^'"]+)['"][^>]*>/gi)) {
        sources.push(match[1]);
        inline.add(normalizeImageUrl(match[1], request.url));
    }
    // Canonical keys deduplicate only; never strip queries from the actual
    // request or the user's Open original link.
    const originals = new Map();
    for (const source of sources) {
        const original = originalImageUrl(source, request.url);
        const key = normalizeImageUrl(original, request.url);
        if (key && !originals.has(key)) originals.set(key, original);
    }
    const urls = [...originals.keys()];
    const writer = providedWriter || {
        reserveBase: (title, markdown, date) => reserveBase(title, browser, markdown, date),
        writeFile: (relativePath, data, mime, timeout) => downloadCompleted(browser, {
            url: 'data:' + mime + ';base64,' + toBase64(data), filename: EXPORT_ROOT + '/' + relativePath
        }, timeout),
        resultPath: relativePath => EXPORT_ROOT + '/' + relativePath
    };
    const base = await writer.reserveBase(title, markdown, date);
    const successes = new Map(), failed = [];
    // Sequential downloads keep memory bounded and do not create the Markdown
    // until every included image has actually reached the completed state.
    for (const [index, url] of urls.entries()) {
        try {
            if (imageTimeLeft() <= 0) throw new Error('Bundle time budget exhausted');
            const image = await fetchImage(originals.get(url), { fetchImpl, timeout: Math.min(20000, imageTimeLeft()) });
            if (imageTimeLeft() <= 0) throw new Error('Bundle time budget exhausted');
            const path = `${base}-assets/images/generated-image-${index + 1}.${image.ext}`;
            await writer.writeFile(path, image.bytes, image.mime, Math.min(downloadTimeout, imageTimeLeft()));
            successes.set(url, path);
        } catch (error) { failed.push({ url: originals.get(url), error: String(error.message || error) }); }
    }
    text = localizeImages(text, successes, request.url);
    const appendix = urls.filter(url => !inline.has(url)).map(url => {
        const path = successes.get(url);
        const source = originals.get(url).replace(/[<>\s]/g, character => encodeURIComponent(character));
        if (!path) return `![generated-image](<${source}>)\n\n[Open original](<${source}>)`;
        const name = path.split('/').pop();
        return `![${name}](<${path}>)\n\n[Open saved image](<${path}>) · [Open original](<${source}>)`;
    });
    if (appendix.length) text += `\n### Generated images\n\n${appendix.join('\n\n')}\n`;
    const relativeMarkdownPath = base + '.md';
    const markdownPath = writer.resultPath(relativeMarkdownPath);
    try {
        await writer.writeFile(relativeMarkdownPath, text, 'text/markdown;charset=utf-8', Math.max(1, Math.min(downloadTimeout, deadline - now())));
    } catch (error) {
        return { success: false, markdownSaved: false, markdownPath, downloadedImages: successes.size, totalImages: urls.length, failed, error: String(error.message || error) };
    }
    return { success: failed.length === 0, markdownSaved: true, markdownPath, downloadedImages: successes.size, totalImages: urls.length, failed };
}

async function exportMarkdownBundle(request, options = {}) {
    if (exportBusy) throw new Error('Another Markdown export is in progress; retry when it finishes');
    exportBusy = true;
    const browser = options.browser || globalThis.chrome;
    // Chrome extension API calls reset the MV3 idle timer while waiting for
    // downloads. This bounded heartbeat is stopped on every success/error path.
    const heartbeat = !options.writer && browser?.runtime?.getPlatformInfo ? setInterval(() => {
        try { Promise.resolve(browser.runtime.getPlatformInfo()).catch(() => {}); } catch { /* Worker may be shutting down. */ }
    }, options.heartbeatInterval || 20000) : null;
    try { return await performMarkdownBundle(request, options); }
    finally {
        if (heartbeat !== null) clearInterval(heartbeat);
        exportBusy = false;
    }
}

globalThis.GensparkBundle = { imageType, fetchImage, downloadCompleted, reserveBase, localizeImages, exportMarkdownBundle, toBase64 };
