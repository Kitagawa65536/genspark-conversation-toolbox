const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const context = { setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'directory-writer.js'), 'utf8'), context);
const { create } = context.GensparkDirectoryWriter;
const error = (name, message = name) => Object.assign(new Error(message), { name });
const tick = () => new Promise(resolve => setImmediate(resolve));

function directory(name = 'Chosen notes', options = {}, events = []) {
    const children = new Map();
    return {
        kind: 'directory', name, children, events,
        async getFileHandle(name, config = {}) {
            events.push(['file', name, Boolean(config.create)]);
            if (options.denyProbe && !config.create) throw options.denyProbe;
            if (children.has(name)) {
                if (children.get(name).kind !== 'file') throw error('TypeMismatchError');
                return children.get(name);
            }
            if (!config.create) throw error('NotFoundError');
            if (options.denyCreate) throw options.denyCreate;
            const state = { kind: 'file', name, data: null, aborted: 0, closed: 0, opened: 0,
                async createWritable() {
                    this.opened++;
                    if (options.denyWritable) throw options.denyWritable;
                    let pending;
                    return {
                        write: async value => {
                            events.push(['write', name]);
                            if (options.writeError) throw options.writeError;
                            if (options.waitWrite) await options.waitWrite;
                            pending = value;
                        },
                        close: async () => {
                            events.push(['close', name]);
                            if (options.closeError) throw options.closeError;
                            state.closed++;
                            state.data = pending;
                        },
                        abort: async () => {
                            events.push(['abort', name]);
                            state.aborted++;
                            if (options.abortError) throw options.abortError;
                        }
                    };
                }
            };
            children.set(name, state);
            return state;
        },
        async getDirectoryHandle(name, config = {}) {
            events.push(['directory', name, Boolean(config.create)]);
            if (children.has(name)) {
                if (children.get(name).kind !== 'directory') throw error('TypeMismatchError');
                return children.get(name);
            }
            if (!config.create) throw error('NotFoundError');
            if (options.denyCreate) throw options.denyCreate;
            const child = directory(name, options, events);
            children.set(name, child);
            return child;
        }
    };
}
const markdown = { filename: title => '2026-11-01-' + title + '.md' };

test('writes binary and text under an arbitrary chosen root, with no Downloads prefix', async () => {
    const root = directory(), sink = create(root);
    const base = await sink.reserveBase('A B', markdown, new Date());
    assert.equal(base, '2026-11-01-A-B');
    const imagePath = base + '-assets/images/generated-image-1.png';
    const bytes = new Uint8Array([137, 80, 78, 71]);
    await sink.writeFile(imagePath, bytes, 'image/png', 1000);
    await sink.writeFile(base + '.md', '# Notes\n', 'text/markdown', 1000);
    const image = root.children.get(base + '-assets').children.get('images').children.get('generated-image-1.png');
    assert.equal(image.data, bytes, 'binary data passes through without text/JSON conversion');
    assert.equal(image.closed, 1);
    assert.equal(root.children.get(base + '.md').data, '# Notes\n');
    assert.equal(root.children.has('genspark-md-files'), false);
    assert.equal(sink.resultPath(imagePath), 'Chosen notes/' + imagePath);
    assert.doesNotMatch(sink.resultPath(imagePath), /^[A-Za-z]:|^\//);
});

test('reserveBase checks existing Markdown and assets of either handle kind before suffixing', async () => {
    const root = directory(), b = '2026-11-01-A-B';
    root.children.set(b + '.md', { kind: 'file' });
    root.children.set(b + '-2-assets', directory('assets'));
    root.children.set(b + '-3-assets', { kind: 'file' });
    root.children.set(b + '-4.md', directory('not a file'));
    assert.equal(await create(root).reserveBase('A B', markdown), b + '-5');
    assert.equal(root.children.size, 4, 'name selection does not create/truncate handles');
});

test('existing file data and existing directories are never truncated or opened writable', async () => {
    const root = directory();
    const original = await root.getFileHandle('existing.md', { create: true });
    original.data = 'user data';
    const sink = create(root);
    await assert.rejects(sink.writeFile('existing.md', 'replacement'), /already exists/);
    assert.equal(original.data, 'user data');
    assert.equal(original.opened, 0);
    root.children.set('folder.md', directory('folder.md'));
    await assert.rejects(sink.writeFile('folder.md', 'replacement'), /already exists/);
    assert.equal(root.children.get('folder.md').kind, 'directory');
});

test('unsafe paths are rejected before any filesystem operation', async () => {
    const root = directory(), sink = create(root);
    const invalid = ['', '.', '..', '../x', 'a/../b', 'a/./b', '/absolute', '//server/share', 'C:/x',
        'C:\\x', 'a\\b', 'a//b', 'a/', 'a\u0000b', 'a\nb', 'a:b', 'a?b', 'a|b', 'trailing.', 'trailing '];
    for (const candidate of invalid) {
        await assert.rejects(sink.writeFile(candidate, 'x'), /Invalid relative/);
        assert.throws(() => sink.resultPath(candidate), /Invalid relative/);
    }
    assert.equal(root.events.length, 0);
    await assert.rejects(sink.reserveBase('ignored', { filename: () => '../bad.md' }), /Invalid/);
    assert.equal(root.events.length, 0);
});

test('write failure aborts, keeps the partial file, and propagates the original error', async () => {
    const failure = error('QuotaExceededError'), root = directory('root', { writeError: failure, abortError: error('AbortError') });
    await assert.rejects(create(root).writeFile('partial.bin', new Uint8Array([1])), value => value === failure);
    const partial = root.children.get('partial.bin');
    assert.equal(partial.aborted, 1);
    assert.equal(partial.closed, 0);
    assert.equal(partial.data, null);
    assert.ok(root.children.has('partial.bin'), 'no automatic deletion of partial/user files');
});

test('close failure aborts and is not falsely reported as complete', async () => {
    const failure = error('NotAllowedError', 'read-only filesystem'), root = directory('root', { closeError: failure });
    await assert.rejects(create(root).writeFile('notes.md', 'notes'), value => value === failure);
    const partial = root.children.get('notes.md');
    assert.equal(partial.aborted, 1);
    assert.equal(partial.closed, 0);
});

test('permission errors propagate without requesting permission or overwriting anything', async () => {
    const denied = error('NotAllowedError');
    const root = directory('root', { denyProbe: denied });
    root.requestPermission = () => { throw Error('must not request permission'); };
    await assert.rejects(create(root).reserveBase('A', markdown), value => value === denied);
    await assert.rejects(create(root).writeFile('notes.md', 'x'), value => value === denied);
    assert.equal(root.children.size, 0);
    const readonly = directory('readonly', { denyWritable: denied });
    await assert.rejects(create(readonly).writeFile('notes.md', 'x'), value => value === denied);
    assert.equal(readonly.children.get('notes.md').data, null);
});

test('a timed-out pending write is aborted and never subsequently closed', async () => {
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    const root = directory('root', { waitWrite: waiting });
    await assert.rejects(create(root).writeFile('slow.bin', new Uint8Array([1]), 'image/png', 5), value => value.name === 'TimeoutError');
    assert.equal(root.children.get('slow.bin').aborted, 1);
    release();
    await tick();
    assert.equal(root.children.get('slow.bin').closed, 0);
});

test('invalid handles and invalid timeouts fail explicitly', async () => {
    assert.throws(() => create(null), /directory handle/);
    const root = directory();
    await assert.rejects(create(root).writeFile('x', 'x', '', 0), /timeout/);
    assert.equal(root.children.size, 0);
});
