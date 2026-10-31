const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Minimal DOM fixture for the message structures used by Genspark.
function element(order, text, children = [], content = {}) {
    return {
        order, textContent: text, innerText: text, children,
        contains(other) { return children.some(child => child === other || child.contains(other)); },
        compareDocumentPosition(other) { return this.order < other.order ? 4 : this.order > other.order ? 2 : 0; },
        querySelector(selector) { return content[selector] || null; },
        querySelectorAll() { return []; },
        getBoundingClientRect() { return { top: order, left: 0 }; }
    };
}

test('extracts distinct ordered turns without usernames or nested duplicates', () => {
    const question = element(3, '質問です');
    const nestedUser = element(2, '質問です', [], { '.content code': question });
    const user = element(1, '匿名ユーザー 質問です', [nestedUser], { '.content code': question });
    const answerText = element(5, '回答の見出し\n回答本文');
    const answer = element(4, 'ツール 回答', [], { '.markdown-viewer': answerText });
    const repeated = element(6, '質問です', [], { '.content code': question });
    const matches = {
        '.conversation-item-desc.user': [user, repeated],
        '.conversation-statement.user': [nestedUser],
        '.conversation-item-desc.assistant': [answer]
    };
    const document = { readyState: 'loading', querySelectorAll: selector => matches[selector] || [], addEventListener() {} };
    const context = { document, window: {}, Node: { DOCUMENT_POSITION_FOLLOWING: 4, DOCUMENT_POSITION_PRECEDING: 2 }, console, setTimeout };
    const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
    vm.runInNewContext(source + '\nglobalThis.Toolbox = GensparkRTLToolbox;', context);
    const toolbox = new context.Toolbox();
    const messages = toolbox.extractConversation();
    assert.deepEqual(Array.from(messages, msg => [msg.type, msg.content]), [
        ['user', '質問です'], ['assistant', '回答の見出し\n回答本文'], ['user', '質問です']
    ]);
    assert.equal(toolbox.searchConversation('回答本文')[0].index, 1);
});
