/* Root-relative File System Access sink. The caller holds the whole-export Web Lock. */
(function (root) {
    'use strict';

    function validatePath(value) {
        if (typeof value !== 'string' || !value || value.includes('\\') || value.startsWith('/') ||
            /[\x00-\x1f<>:"|?*]/.test(value)) throw new TypeError('Invalid relative export path');
        const parts = value.split('/');
        if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) {
            throw new TypeError('Invalid relative export path');
        }
        return parts;
    }

    const namedError = (name, message) => Object.assign(new Error(message), { name });
    const notFound = error => error?.name === 'NotFoundError';
    const mismatch = error => error?.name === 'TypeMismatchError';

    // getFileHandle reports TypeMismatchError when a directory occupies the name.
    // Check both kinds for adapters and implementations reporting NotFound instead.
    async function exists(directory, name) {
        try { await directory.getFileHandle(name, { create: false }); return true; }
        catch (error) { if (mismatch(error)) return true; if (!notFound(error)) throw error; }
        try { await directory.getDirectoryHandle(name, { create: false }); return true; }
        catch (error) { if (mismatch(error)) return true; if (!notFound(error)) throw error; }
        return false;
    }

    function create(handle) {
        if (!handle || handle.kind !== 'directory' || typeof handle.getFileHandle !== 'function' ||
            typeof handle.getDirectoryHandle !== 'function') throw new TypeError('A directory handle is required');

        async function reserveBase(title, markdown, date) {
            const proposed = markdown.filename(title, date).replace(/\.md$/i, '').replace(/\s+/g, '-');
            if (validatePath(proposed).length !== 1) throw new TypeError('Invalid export basename');
            for (let suffix = 1; ; suffix++) {
                const base = proposed + (suffix === 1 ? '' : '-' + suffix);
                if (!(await exists(handle, base + '.md')) && !(await exists(handle, base + '-assets'))) return base;
            }
        }

        async function writeFile(relativePath, data, mime, timeout = 120000) {
            const parts = validatePath(relativePath);
            if (!Number.isFinite(timeout) || timeout <= 0) throw new TypeError('Invalid write timeout');
            // Writable streams accept strings, Blobs, ArrayBuffers and typed arrays.
            // Do not coerce binary input into text; mime is informational for this sink.
            void mime;
            let writable, stopped = false, abortStarted = false;
            const abort = async () => {
                if (!writable || abortStarted) return;
                abortStarted = true;
                try { await writable.abort(); } catch { /* Retain the original write/close error. */ }
            };
            const check = () => { if (stopped) throw namedError('TimeoutError', 'Directory write timed out'); };
            let timer;
            const deadline = new Promise((resolve, reject) => {
                timer = setTimeout(() => {
                    stopped = true;
                    void abort();
                    reject(namedError('TimeoutError', 'Directory write timed out'));
                }, timeout);
            });
            const operation = (async () => {
                try {
                    let directory = handle;
                    for (const part of parts.slice(0, -1)) {
                        check();
                        directory = await directory.getDirectoryHandle(part, { create: true });
                    }
                    check();
                    const name = parts[parts.length - 1];
                    if (await exists(directory, name)) {
                        throw namedError('InvalidModificationError', 'Export file already exists: ' + relativePath);
                    }
                    check();
                    // The File System Access API has no exclusive-create flag.
                    // Whole-export Web Locks protect cooperating extension tabs;
                    // external applications modifying the directory are not locked.
                    const file = await directory.getFileHandle(name, { create: true });
                    check();
                    writable = await file.createWritable();
                    check();
                    await writable.write(data);
                    check();
                    await writable.close();
                    check();
                } catch (error) {
                    await abort();
                    throw error;
                }
            })();
            try { await Promise.race([operation, deadline]); }
            finally { clearTimeout(timer); }
        }

        function resultPath(relativePath) {
            validatePath(relativePath);
            // A handle exposes a display name, not an absolute filesystem path.
            return handle.name ? handle.name + '/' + relativePath : relativePath;
        }
        return { reserveBase, writeFile, resultPath };
    }

    root.GensparkDirectoryWriter = { create };
})(globalThis);
