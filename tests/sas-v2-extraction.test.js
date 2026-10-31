const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { diagnosticDocument } = require('./helpers/diagnostic-dom');

// Structure from the reported SAS v2 page; all conversation text is synthetic.
const div = (classes, ...children) => ({ tag: 'div', class: classes, children });
const text = value => ({ text: value });
const markdown = value => div('markdown-viewer', div('answer-markdown', { tag: 'p', children: [text(value)] }));
const user = value => div('wb-msg-user-row',
    div('wb-msg-user-pill', div('wb-msg-user-text', { tag: 'span', class: 'arg-text', children: [text(value)] })),
    div('wb-msg-user-actions', text('コピー')));
const work = () => div('wb-work-session', div('wb-work-session-summary', text('作業完了')),
    div('wb-thinking-body', markdown('思考プロセス（回答に含めない）')));
const assistant = value => div('sas-asst-msg', div('wb-asst-block', markdown(value)));

function setup(turns) {
    const document = diagnosticDocument({ tag: 'body', children: [
        div('sidebar', markdown('サイドバー（回答に含めない）')),
        div('conversation-wrapper', div('sas-v2-scope wb-stream sas-chat-root', ...turns))
    ] });
    let saved = [];
    const context = {
        document, window: { location: { href: 'https://www.genspark.ai/agents?id=test' } }, console,
        Node: { DOCUMENT_POSITION_FOLLOWING: 4, DOCUMENT_POSITION_PRECEDING: 2 },
        chrome: { storage: { local: {
            get: async () => ({ savedConversations: saved }),
            set: async value => { saved = value.savedConversations; }
        } } }
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
    vm.runInNewContext(source, context);
    return { toolbox: context.window.gensparkConversationManager, saved: () => saved };
}

test('SAS v2 extracts the reported one question and three assistant messages, not work logs', () => {
    const { toolbox } = setup([
        user('質問の全文'), work(), assistant('調査開始の回答'),
        work(), assistant('途中の回答'), work(), assistant('最終回答の全文')
    ]);
    const messages = toolbox.extractConversation();
    assert.deepEqual(Array.from(messages, message => [message.type, message.content]), [
        ['user', '質問の全文'], ['assistant', '調査開始の回答'],
        ['assistant', '途中の回答'], ['assistant', '最終回答の全文']
    ]);
    assert.deepEqual(Array.from(messages, message => message.index), [0, 1, 2, 3]);
    assert.equal(toolbox.searchConversation('最終回答')[0].index, 3);
});

test('SAS v2 preserves repeated turns and handles a standalone assistant block', () => {
    const { toolbox } = setup([user('同じ質問'), assistant('同じ回答'), user('同じ質問'),
        div('wb-asst-block', markdown('同じ回答'))]);
    assert.deepEqual(Array.from(toolbox.extractConversation(), message => message.content),
        ['同じ質問', '同じ回答', '同じ質問', '同じ回答']);
});

test('SAS v2 saving and downloading use the extracted conversation, not controls or work logs', async () => {
    const { toolbox, saved } = setup([user('質問'), work(), assistant('回答')]);
    const result = await toolbox.saveCurrentConversation();
    assert.equal(result.success, true);
    assert.equal(result.messageCount, 2);
    assert.equal(saved()[0].messages[1].content, '回答');
    const downloads = [];
    toolbox.downloadJSON = async messages => downloads.push(messages);
    toolbox.downloadTXT = async messages => downloads.push(messages);
    assert.equal((await toolbox.downloadConversation('both')).success, true);
    assert.equal(downloads.length, 2);
    for (const messages of downloads) {
        assert.deepEqual(Array.from(messages, message => message.content), ['質問', '回答']);
    }
});
