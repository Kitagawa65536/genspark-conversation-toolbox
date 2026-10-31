const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { diagnosticDocument } = require('./helpers/diagnostic-dom');

const text = value => ({ text: value });
const el = (tag, children = [], attributes = {}) => ({ tag, ...attributes, children });
const richAnswer = () => el('div', [
    el('h2', [text('見出し')]),
    el('p', [text('本文 '), el('strong', [text('太字')]), text(' / '),
        el('em', [text('強調')]), text(' '), el('a', [text('ドキュメント')], { href: '/docs?q=1' })]),
    el('ul', [el('li', [text('項目1')]), el('li', [text('項目2'),
        el('ol', [el('li', [text('子項目')])], { start: '3' })])]),
    el('table', [el('thead', [el('tr', [el('th', [text('サービス')]), el('th', [text('方法')])])]),
        el('tbody', [el('tr', [el('td', [text('AI')]), el('td', [el('code', [text('a|b')])])])])]),
    el('blockquote', [el('p', [text('引用')])]),
    el('pre', [el('code', [text('const a = 1;\n\n\nconsole.log(`a`);\n')], { class: 'language-js' }),
        el('button', [text('Copy')])]),
    el('p', [el('code', [text('`nested`')])]),
    el('button', [text('共有ボタン')]),
    el('script', [text('secret()')])
], { class: 'markdown-viewer' });

function setup(answer = richAnswer()) {
    const question = el('div', [el('div', [text('質問 **そのまま**')], { class: 'wb-msg-user-text' })], { class: 'wb-msg-user-row' });
    const document = diagnosticDocument(el('body', [
        el('nav', [el('h1', [text('ホーム')])]),
        el('div', [question, el('div', [el('div', [answer], { class: 'wb-asst-block' })], { class: 'sas-asst-msg' })],
            { class: 'conversation-wrapper' })
    ]));
    document.title = '会話タイトル - Genspark';
    const context = {
        document, window: { location: { href: 'https://www.genspark.ai/agents?id=sample' } },
        URL, Blob, console,
        Node: { DOCUMENT_POSITION_FOLLOWING: 4, DOCUMENT_POSITION_PRECEDING: 2 }
    };
    for (const file of ['markdown.js', 'content.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
    return { context, document, toolbox: context.window.gensparkConversationManager, markdown: context.GensparkMarkdown };
}

test('HTML becomes Markdown headings, links, lists, tables, quotes and fenced code', () => {
    const { toolbox } = setup();
    const messages = toolbox.extractConversation();
    const md = messages[1].markdown;
    assert.match(md, /^## 見出し/);
    assert.ok(md.includes('**太字** / *強調* [ドキュメント](<https://www.genspark.ai/docs?q=1>)'));
    assert.ok(md.includes('- 項目1\n- 項目2\n  \n  3. 子項目'));
    assert.ok(md.includes('| サービス | 方法 |\n| --- | --- |\n| AI | `a\\|b` |'));
    assert.ok(md.includes('> 引用'));
    assert.ok(md.includes('```js\nconst a = 1;\n\n\nconsole.log(`a`);\n```'));
    assert.ok(md.includes('`` `nested` ``'));
    assert.ok(!/Copy|共有ボタン|secret/.test(md));
    assert.equal(messages[0].markdown, '質問 **そのまま**');
});

test('frontmatter and speaker headings match the reference style without inventing source dates', () => {
    const { toolbox, markdown } = setup();
    const result = markdown.renderConversation({ title: 'タイトル "引用"\n次行',
        url: 'https://www.genspark.ai/agents?id=sample', messages: toolbox.extractConversation(), exportedAt: '2026-10-31T15:00:00.000Z' });
    assert.ok(result.startsWith('---\ntitle: "タイトル \\"引用\\"\\n次行"\n'));
    assert.ok(result.includes('conversation_id: "sample"'));
    assert.ok(result.includes('exported_at: "2026-10-31T15:00:00.000Z"'));
    assert.ok(!/\n(created|updated):/.test(result));
    assert.ok(result.includes('\n## You\n\n質問 **そのまま**\n\n## Genspark\n\n## 見出し'));
    assert.ok(!result.includes('# ホーム'));
    assert.ok(markdown.renderConversation({ messages: [{ type: 'assistant', content: '旧データ' }] }).includes('旧データ'));
});

test('browser conversation title takes priority over Home navigation and filenames are safe', () => {
    const { toolbox, markdown } = setup();
    assert.equal(toolbox.getPageTitle(), '会話タイトル');
    const filename = markdown.filename('タイトル: a/b?* "引用"', new Date(2026, 9, 31));
    assert.equal(filename, '2026-10-31-タイトル_ a_b__ _引用_.md');
    assert.ok(!/[<>:"/\\|?*]/.test(filename));
});

test('MD is the default download format and uses Markdown MIME and a dated title', async () => {
    const { toolbox } = setup();
    const downloads = [];
    toolbox.downloadBlob = (blob, filename) => downloads.push({ blob, filename });
    assert.equal((await toolbox.downloadConversation()).success, true);
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].blob.type, 'text/markdown;charset=utf-8');
    assert.match(downloads[0].filename, /^\d{4}-\d{2}-\d{2}-会話タイトル\.md$/);
    const content = await downloads[0].blob.text();
    assert.ok(content.includes('## You'));
    assert.ok(content.includes('| サービス | 方法 |'));
});

test('assistant messages include all content blocks without nested duplicate extraction', () => {
    const { toolbox } = setup(el('div', [richAnswer(), richAnswer()]));
    const md = toolbox.extractConversation()[1].markdown;
    assert.equal(md.match(/## 見出し/g).length, 2);
});

test('unsafe links are omitted and literal Markdown text is escaped', () => {
    const { markdown, document } = setup(el('p', [text('a*b_[x] '),
        el('a', [text('危険')], { href: 'javascript:alert(1)' }),
        el('img', [], { src: '/image.png', alt: '画像' })]));
    const answer = document.querySelector('.wb-asst-block');
    const result = markdown.fromElement(answer);
    assert.ok(result.includes('a\\*b\\_\\[x\\]'));
    assert.ok(!result.includes('javascript:'));
    assert.ok(result.includes('![画像](<https://www.genspark.ai/image.png>)'));
});
