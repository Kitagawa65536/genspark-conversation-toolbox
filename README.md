# Genspark Conversation Manager

A Chrome extension for managing Genspark AI conversations with advanced organization features.

---

## Version 3.0 (Under Review)

> **Note:** v3.0 has been submitted to Chrome Web Store. Code will be released after approval.

### New Features

- **Folder Manager** - Organize conversations into custom folders with sidebar integration
- **Full i18n Support** - Complete English/Hebrew UI translation (200+ strings)
- **Quick & Full Downloads** - Choose between metadata-only or full content extraction
- **Bulk Operations** - Select and manage multiple conversations at once
- **Improved RTL/LTR** - Better support for right-to-left languages

### Screenshots

![Folders - English UI](screenshots/folders-en.png)

![Folders - Hebrew UI](screenshots/folders-he.png)

---

## Features

- Download conversations as Markdown, JSON or TXT
- Search within current conversation or all saved
- Save conversations locally with Chrome storage
- Organize with folder system
- Full English and Hebrew interface
- ZIP export for bulk downloads

## Installation

1. Download from [Chrome Web Store](https://chromewebstore.google.com/) (pending v3.0 approval)
2. Or load unpacked from `v2.8-FINAL/` folder for development

## Usage

1. Navigate to [genspark.ai](https://genspark.ai)
2. Click the extension icon to open popup
3. Use folder button in sidebar to organize conversations
4. Download, search, or save as needed

## 会話の抽出（日本語）

SAS v2 の会話画面（`/agents?id=...` など）では、質問の `.wb-msg-user-row` と
AI回答の `.sas-asst-msg` / `.wb-asst-block` を抽出します。
作業ログ・思考プロセスの Markdown は回答として収集しません。
抽出修正を反映するには、拡張機能と対象ページの**両方**を再読み込みしてください。
診断ファイルの `extractorRevision` が `dom-4-md` なら、Markdown対応版が動作しています。

### Markdown保存

- 「Markdownで保存」が通常の保存ボタンです。JSON/TXTの保存も引き続き利用できます。
- `YYYY-MM-DD-会話タイトル.md` として、タイトル・URL・会話ID・取得元・書き出し日時の
  YAML frontmatter、`# タイトル`、`## You` / `## Genspark` の発言見出しを出力します。
- AI回答の見出し、強調、リンク、リスト、表、引用、コードブロックをDOMからMarkdownに変換します。
  添付画像はURL参照で、画像ファイルそのものはダウンロードしません。
- 作成日時・更新日時はDOMから正確に取得できないため捏造せず、`exported_at`（書き出し日時）のみ記録します。
- 表示中の途中の回答も省略せず保存します。見本の他拡張と発言数が異なる場合があります。
- 保存済み会話の一括ダウンロードも形式を選択できます（Markdownは1ファイルにまとめます）。
  以前プレーンテキストで保存した会話では、失われたリンクURL・表などの書式は復元できません。
  書式を保持するには、修正版で対象ページから保存し直してください。

回帰テストは `node --test tests/*.test.js` で実行できます。

## 会話を検出できない場合（日本語）

1. `chrome://extensions` で拡張機能を再読み込みし、対象の Genspark ページも再読み込みします。
2. 会話本文が表示された状態で、拡張機能の「抽出診断を保存」を押します。
3. 保存された `genspark-diagnostics_*.json` を、不具合の調査用に共有してください。

診断ファイルには、現在の抽出条件に一致した要素の数、ページの HTML 要素の構造、
短い本文の抜粋、iframe と Shadow DOM の情報が含まれます。
ファイルは手元に保存され、自動送信はされません。スクリプトや入力欄の値は収集しません。

## License

MIT
