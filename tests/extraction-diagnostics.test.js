const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const text = value => ({ nodeType: 3, textContent: value });
function element(tagName, attributes = {}, childNodes = []) {
    return {
        nodeType: 1, tagName, childNodes,
        getAttribute: name => attributes[name] || null
    };
}

test('diagnostics capture unmatched structure, accessible frames and shadow roots without form values or scripts', () => {
    const answer = element('DIV', { class: 'new-answer-class', 'data-token': 'secret' }, [text('回答本文')]);
    answer.shadowRoot = { children: [element('P', {}, [text('shadow answer')])] };
    const frame = element('IFRAME', { src: '/conversation-frame' });
    frame.contentDocument = {
        body: element('BODY', {}, [element('P', {}, [text('frame answer')])]),
        querySelectorAll: () => []
    };
    const inaccessibleFrame = element('IFRAME', { src: 'https://other.example/' });
    Object.defineProperty(inaccessibleFrame, 'contentDocument', { get() { throw new Error('Cross origin'); } });
    const body = element('BODY', {}, [
        answer, frame, inaccessibleFrame,
        element('SCRIPT', {}, [text('secret script')]),
        element('TEXTAREA', {}, [text('unsent prompt')]),
        element('INPUT', { value: 'password' }),
        text('x'.repeat(500))
    ]);
    const document = {
        body, title: 'Test chat', readyState: 'loading',
        querySelectorAll: () => [], addEventListener() {}
    };
    const context = {
        document, window: { location: { href: 'https://www.genspark.ai/agents/sas?id=test' } },
        chrome: { runtime: { getManifest: () => ({ version: '2.6' }) } },
        Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }, console
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
    vm.runInNewContext(source + '\nglobalThis.Toolbox = GensparkRTLToolbox;', context);
    const toolbox = context.window.gensparkConversationManager;
    const result = toolbox.getExtractionDiagnostics();
    assert.equal(result.extractedMessageCount, 0);
    assert.equal(result.selectorCounts['.conversation-item-desc.user'], 0);
    assert.equal(result.frames[0].accessible, true);
    assert.equal(result.frames[1].accessible, false);
    assert.equal(result.structure.children.at(-1).text.length, 300);
    assert.equal(result.structure.children.at(-1).truncated, true);
    const output = JSON.stringify(result);
    for (const expected of ['new-answer-class', '回答本文', 'shadow answer', 'frame answer']) assert.ok(output.includes(expected));
    for (const excluded of ['secret', 'unsent prompt', 'password']) assert.ok(!output.includes(excluded));
});

test('popup saves diagnostics and reports download failures instead of success', async () => {
    let fail = false;
    const requested = [];
    const revoked = [];
    const context = {
        document: { addEventListener() {} }, window: { addEventListener() {} }, console, Blob,
        URL: { createObjectURL: () => 'blob:diagnostics', revokeObjectURL: url => revoked.push(url) },
        chrome: { downloads: { download: async options => {
            requested.push(options);
            if (fail) throw new Error('Download rejected');
            return 1;
        } } }
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');
    vm.runInNewContext(source + '\nglobalThis.Manager = PopupManager;', context);
    const manager = Object.create(context.Manager.prototype);
    manager.currentLang = 'ja';
    const messages = [];
    manager.showMessage = (message, type) => messages.push({ message, type });
    manager.showLoading = () => {};
    manager.sendMessageToTab = async action => {
        assert.equal(action, 'getExtractionDiagnostics');
        return { success: true, diagnostics: { schemaVersion: 1 } };
    };
    await manager.saveExtractionDiagnostics();
    assert.equal(messages.at(-1).type, 'success');
    assert.match(requested[0].filename, /^genspark-diagnostics_.*\.json$/);
    assert.equal(revoked.length, 1);
    fail = true;
    await manager.saveExtractionDiagnostics();
    assert.equal(messages.at(-1).type, 'error');
    assert.match(messages.at(-1).message, /Download rejected/);
    assert.equal(revoked.length, 2);
});
