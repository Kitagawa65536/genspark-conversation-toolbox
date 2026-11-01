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
この修正版は拡張機能バージョン **2.6.3**、診断ファイルの `extractorRevision` は `dom-6-directory` です。
保存に失敗した場合は、表示される具体的なエラー全文を確認してください。エラー直後にページを再読み込みせず「抽出診断を保存」を押すと、
`lastExport` に直近の保存結果・失敗理由が含まれます（ページ再読み込みで消えます）。
開発版を読み込むときは、このREADMEと `manifest.json` があるリポジトリ直下を選択してください。

### 保存先フォルダの選択・記憶（2.6.3）

1. 拡張機能とGensparkの対象ページを再読み込みします。
2. 拡張機能の「保存先フォルダを設定」を押し、開いた専用タブの「フォルダを選択/変更」で保存したいフォルダを選びます。ObsidianのVaultなども選べます。
3. Gensparkのページから「Markdown + 画像をダウンロード (.md)」を押すと、専用タブで選択先の直下へ保存します。設定前に押した場合も、そのタブで初回のフォルダ選択ができます。
4. 次回以降は保存先を記憶しています。書き込み許可が必要な場合だけ「許可して保存」を押してください。権限が有効なら自動で保存を開始します。

- フォルダの記憶には、Chromeが発行するディレクトリハンドルを拡張機能のIndexedDBへ保存します。絶対パスを手入力する方式ではありません。
- 直接保存では `chrome.downloads` を使わないため、画像ごとの保存ダイアログは出ません。保存中の専用タブは閉じないでください。
- 「保存先を忘れる」は設定だけを解除し、選んだフォルダ内のファイルは削除しません。ブラウザの許可自体の解除はブラウザ側の設定から行います。
- 非対応ブラウザや従来方式を使いたい場合は、設定タブの「通常のDownloads保存に戻す」で明示的に切り替えます。失敗時に勝手にDownloadsへ保存先を変更することはありません。
- フォルダ設定の対象は現在の会話のMarkdown保存です。JSON/TXT・抽出診断・保存済み会話の一括出力は従来のダウンロード方式です。

### Markdown保存

- 「Markdown + 画像をダウンロード (.md)」が通常の保存ボタンです。本文中の画像も自動で保存します。JSON/TXTの保存も引き続き利用できます。
- `YYYY-MM-DD-会話タイトル.md` として、タイトル・URL・会話ID・取得元・書き出し日時の
  YAML frontmatter、`# タイトル`、`## You` / `## Genspark` の発言見出しを出力します。
- AI回答の見出し、強調、リンク、リスト、表、引用、コードブロックをDOMからMarkdownに変換します。
  保存できた画像は相対リンクに置き換え、取得に失敗した画像は元のリンクを保持します。
- 保存先は選択したフォルダの直下です（`genspark-md-files` をさらに追加することはありません）。
  Markdown と画像フォルダは、次のように同じ階層に保存されます。移動するときは両方を一緒に移動してください。
  画像のない会話は同じ保存先へ Markdown ファイルのみを保存します。
  「通常のDownloads保存」に切り替えた場合だけ、ダウンロードフォルダ内の `genspark-md-files/` 以下へ保存します。

  ```text
  選択したフォルダ/
    YYYY-MM-DD-会話タイトル.md
    YYYY-MM-DD-会話タイトル-assets/
      images/
        generated-image-1.png
        generated-image-2.jpeg
  ```

  タイトルの空白はハイフンに変換します。生成画像は本文末尾の `### Generated images` にまとめ、
  `Open saved image`（ローカル画像）と `Open original`（元画像）のリンクを付けます。
  入力に添付した参照画像は元URLへのリンクを残します。モデルのアイコン・背景用の重複画像・ツールの操作表示は除外します。
  画像の実データからPNG/JPEGなどの拡張子を判定します。同名の再保存時はMarkdownと画像フォルダの両方に同じ連番を付けます。
  保存完了を確認してからローカルリンクへ書き換えます。画像の保存に失敗すると警告を表示し、元URLを残します。
  大量・低速なダウンロードは処理時間を制限し、残りの画像は元URLを残します。保存先の確認が出た場合は既定のフォルダ構成を維持してください。
  更新後は `chrome://extensions` で拡張機能を再読み込みし、Genspark の対象ページも再読み込みしてください。
  フォルダ保存では、既存のMarkdownや画像フォルダを確認して連番を付け、既存ファイルを上書きしません。
  保存途中で閉じた場合、一部のファイルが残ることがあります。拡張機能のタブ同士は保存を直列化しますが、外部アプリによる同時編集まではロックできません。
- 作成日時・更新日時はDOMから正確に取得できないため捏造せず、`exported_at`（書き出し日時）のみ記録します。
- 表示中の途中の回答も省略せず保存します。見本の他拡張と発言数が異なる場合があります。
- 保存済み会話の一括ダウンロードも形式を選択できます（Markdownは1ファイルにまとめます）。
  以前プレーンテキストで保存した会話では、失われたリンクURL・表などの書式は復元できません。
  書式を保持するには、修正版で対象ページから保存し直してください。

回帰テストは `node --test tests` で実行できます。
提供された解析JSONの会話構造を匿名化したフィクスチャで、質問3件・回答本文8ブロック・生成画像4枚の抽出と保存処理を検証しています。
初回の解析JSONには画像の `src` がないため、固定フィクスチャでは画像URLを補っています。
実Chromeの独立プロファイルで `node scripts/browser-download-smoke.cjs` を実行すると、ネットワークのみ代用し、
実際の拡張機能メッセージ・ダウンロードAPI・保存ファイルと相対リンクを検証できます（CDPによる拡張読み込み対応Chromeが必要）。
同じテストで実OPFSディレクトリハンドルを使い、IndexedDBへの記憶・ページ再読み込み・直接書き込み・重複防止も検証します。
OPFSはブラウザ内のテスト用領域であり、OSのフォルダ選択ダイアログ自体を自動操作しているわけではありません。
Chrome実ページでの認証付き画像取得や、利用中の他拡張・ダウンロード設定との競合は別途確認が必要です。
画像の取得先が外部CDNになる場合に備えてHTTP/HTTPSのホストアクセス権を使用します。自動スクリプトの実行対象はGensparkのみです。

## 会話を検出できない場合（日本語）

1. `chrome://extensions` で拡張機能を再読み込みし、対象の Genspark ページも再読み込みします。
2. 会話本文が表示された状態で、拡張機能の「抽出診断を保存」を押します。
3. 保存された `genspark-diagnostics_*.json` を、不具合の調査用に共有してください。

診断ファイルには、現在の抽出条件に一致した要素の数、ページの HTML 要素の構造、
短い本文の抜粋、画像URL、iframe と Shadow DOM の情報が含まれます。
画像URLに非公開画像へのアクセス情報が含まれる場合があるため、共有前に内容を確認してください。
ファイルは手元に保存され、自動送信はされません。スクリプトや入力欄の値は収集しません。

## License

MIT
