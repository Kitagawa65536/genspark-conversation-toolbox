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
const user = value => div('wb-msg-user-row user-message',
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
        document, window: { location: { href: 'https://www.genspark.ai/agents?id=test' } }, URL, console,
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

// Shape of the reported image generation page (2026-10-31 diagnostics): each
// turn is a conversation-item-desc inside one conversation-statement wrapper,
// and GPT Image cards render the picture in a component, not as Markdown.
const imageCard = (...srcs) => div('conversation-item-desc assistant',
    div('bubble',
        div('desc',
            div('content',
                div('inline-component',
                    div('moa-image-result',
                        div('generated-images',
                            div('image-container model-gpt-image-2-5',
                                div('model-label', { tag: 'img', class: 'model-icon' }, text('GPT Image 2.5')),
                                ...srcs.map(src => div('main-image-item',
                                    div('image-generated', div('image-grid', { tag: 'img', src }))))))))))),
    // Adversarial extra empty match: not present in the supplied diagnostic.
    div('message assistant'));
const imageUrlTurn = () => div('conversation-item-desc user',
    div('bubble image_url', div('desc', div('content', div('image_url_wrapper', { tag: 'img' })))));
const userTextTurn = value => div('conversation-item-desc user',
    div('bubble', div('desc', div('content', div('text-content', text(value))))));
const nestedWrapper = (...turns) => div('conversation-statement assistant plain-text', ...turns);

test('Image turns inside one wrapper keep their text and component-rendered figures', () => {
    const { toolbox } = setup([
        nestedWrapper(
            div('conversation-item-desc user', div('bubble image_url', div('desc', div('content', div('image_url_wrapper', { tag: 'img' }))))),
            div('conversation-item-desc user', div('bubble', div('desc', div('content', div('text-content', text('イラストお願いします')))))),
            div('conversation-item-desc assistant', div('bubble', div('desc', div('content',
                div('markdown-viewer', div('answer-markdown', { tag: 'p', children: [text('生成しました')] }))))))
        ),
        nestedWrapper(
            imageCard('https://www.genspark.ai/api/files/s/wiVTFgQX?cache_control=3600',
                'https://www.genspark.ai/api/files/s/hgY0Lo05?cache_control=3600'),
            imageCard('https://www.genspark.ai/api/files/s/pJZeOyyO')
        )
    ]);
    const messages = toolbox.extractConversation();
    // The attachment-only turn ("bubble image_url") has no text and is not a turn.
    assert.deepEqual(Array.from(messages, message => message.type), ['user', 'assistant', 'assistant', 'assistant']);
    assert.equal(messages[0].markdown, 'イラストお願いします');
    assert.equal(messages[1].markdown, '生成しました');
    assert.equal(messages[2].images.length, 2);
    assert.equal(messages[3].images.length, 1);
    assert.equal(messages[2].markdown, '', 'image controls are not exported as prose');
    assert.equal(toolbox.hasImages(messages), true);
});

test('Component-rendered figures land in the turn that shows them, once, without badges', () => {
    const { toolbox } = setup([
        nestedWrapper(userTextTurn('イラストお願いします'), assistant('生成しました')),
        nestedWrapper(
            imageCard('https://www.genspark.ai/api/files/s/wiVTFgQX?cache_control=3600',
                'https://www.genspark.ai/api/files/s/hgY0Lo05?cache_control=3600'),
            imageCard('https://www.genspark.ai/api/files/s/pJZeOyyO')
        )
    ]);
    const messages = toolbox.extractConversation();
    assert.deepEqual(Array.from(messages, message => message.type), ['user', 'assistant', 'assistant', 'assistant']);
    assert.equal(messages[1].markdown, '生成しました');
    assert.deepEqual(Array.from(messages[2].images, image => image.url), [
        'https://www.genspark.ai/api/files/s/wiVTFgQX?cache_control=3600',
        'https://www.genspark.ai/api/files/s/hgY0Lo05?cache_control=3600'
    ]);
    assert.equal(messages[3].images[0].url, 'https://www.genspark.ai/api/files/s/pJZeOyyO');
    assert.ok(!messages.some(message => /GPT Image|model-icon/.test(message.markdown)));
    assert.equal(toolbox.hasImages(messages), true);
});

test('Figures already written in the Markdown are not appended a second time', () => {
    const value = 'できました\n\n![絵](<https://www.genspark.ai/api/files/s/wiVTFgQX>)';
    const { toolbox } = setup([nestedWrapper(userTextTurn('q'), assistant(value), imageCard('https://www.genspark.ai/api/files/s/wiVTFgQX'))]);
    const messages = toolbox.extractConversation();
    assert.equal((messages[1].markdown.match(/api\/files\/s\//g) || []).length, 1);
    assert.equal(messages.at(-1).markdown, '');
    assert.equal(messages.at(-1).images.length, 1);
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
