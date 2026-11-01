/* Top-level, user-consented directory export/settings page. No remote scripts. */
(function (root) {
    'use strict';
    const jobKey = id => 'directory-export:' + id;
    class ExportPage {
        constructor(options = {}) {
            this.document = options.document || root.document;
            this.browser = options.browser || root.chrome;
            this.store = options.store || root.GensparkDirectoryStore;
            this.writer = options.writer || root.GensparkDirectoryWriter;
            this.bundle = options.bundle || root.GensparkBundle;
            this.navigator = options.navigator || root.navigator;
            this.picker = options.picker || root.showDirectoryPicker?.bind(root);
            const location = options.location || root.location;
            this.jobId = new URLSearchParams(location?.search || '').get('job');
            this.elements = {};
            this.handle = null;
            this.permission = null;
            this.destination = 'directory';
            this.job = null;
            this.busy = false;
            this.loading = true;
            this.failed = false;
            this.supported = typeof this.picker === 'function' && typeof this.navigator?.locks?.request === 'function';
        }

        bind() {
            for (const id of ['chooseFolder', 'forgetFolder', 'useDownloads', 'grantPermission', 'retryExport',
                'folderName', 'destinationMode', 'status', 'result', 'jobTitle']) {
                this.elements[id] = this.document.getElementById(id);
            }
            this.elements.chooseFolder.addEventListener('click', () => this.chooseFolder());
            this.elements.forgetFolder.addEventListener('click', () => this.forgetFolder());
            this.elements.useDownloads.addEventListener('click', () => this.useDownloads());
            this.elements.grantPermission.addEventListener('click', () => this.allowAndSave());
            this.elements.retryExport.addEventListener('click', () => this.allowAndSave());
        }

        async init() {
            this.bind();
            try {
                const preferences = await this.browser.storage.local.get(['markdownExportDestination', 'markdownExportDirectoryName']);
                this.destination = preferences.markdownExportDestination === 'downloads' ? 'downloads' : 'directory';
                this.handle = await this.store.load();
                if (this.jobId) this.job = (await this.browser.storage.session.get(jobKey(this.jobId)))[jobKey(this.jobId)] || null;
                if (this.jobId && !this.job) throw new Error('保存データが見つかりません。Gensparkのページからもう一度保存してください。');
                this.loading = false;
                this.render();
                if (this.job?.status === 'completed') {
                    this.showResult(this.job.result, true);
                    return;
                }
                if (!this.supported) {
                    this.message('このブラウザはフォルダへの直接保存に対応していません。「通常のDownloads保存に戻す」を選び、Gensparkのページから再度保存してください。', 'info');
                    return;
                }
                if (this.handle) this.permission = await this.handle.queryPermission({ mode: 'readwrite' });
                this.render();
                if (!this.jobId) {
                    this.message(this.destination === 'downloads' ? '通常のDownloads保存を使用中です。フォルダを選ぶとフォルダ保存に切り替わります。' :
                        this.handle ? '保存先を設定しています。この設定ページだけではファイルは書き込みません。' : '「フォルダを選択/変更」から保存先を設定してください。', 'info');
                } else if (this.destination === 'downloads') {
                    this.message('現在は通常のDownloads保存が選択されています。フォルダに保存する場合は「フォルダを選択/変更」を押してください。この会話はまだ保存していません。', 'info');
                } else if (this.handle && this.permission === 'granted') {
                    await this.saveJob();
                } else {
                    this.showConsentNeeded();
                }
            } catch (error) {
                this.failed = true;
                this.message(this.errorText(error), 'error');
            } finally {
                this.loading = false;
                this.render();
            }
        }

        render() {
            const blocked = this.loading || this.busy;
            const pending = Boolean(this.jobId && this.job && this.job.status !== 'completed');
            this.elements.folderName.textContent = this.handle ? '選択中：' + this.handle.name : '保存先フォルダは未設定です。';
            this.elements.destinationMode.textContent = this.destination === 'downloads' ? '保存方式：通常のDownloads保存' : '保存方式：選択したフォルダへ直接保存';
            this.elements.chooseFolder.disabled = blocked || !this.supported;
            this.elements.forgetFolder.disabled = blocked || !this.handle;
            this.elements.useDownloads.disabled = blocked;
            this.elements.grantPermission.hidden = !pending || !this.handle || !this.supported || this.permission === 'granted';
            this.elements.grantPermission.disabled = blocked;
            this.elements.retryExport.hidden = !pending || !this.failed || !this.handle || !this.supported || this.permission !== 'granted';
            this.elements.retryExport.disabled = blocked;
            this.elements.jobTitle.hidden = !this.jobId;
            this.elements.jobTitle.textContent = this.job?.request?.title || this.job?.title || '';
        }

        message(text, kind = 'info') {
            this.elements.status.textContent = text;
            this.elements.status.dataset.kind = kind;
        }

        errorText(error) { return String(error?.message || error || '保存に失敗しました。'); }

        showConsentNeeded() {
            this.message(this.handle ? 'フォルダへの書き込み許可が必要です。「許可して保存」を押してください。許可するまでは保存しません。' :
                'まだ保存していません。「フォルダを選択/変更」で保存先フォルダを選んでください。', 'info');
            this.render();
        }

        async chooseFolder() {
            if (this.loading || this.busy || !this.supported) return;
            // This invocation must be in the original click's activation, before
            // awaiting storage, permission checks, or any other asynchronous work.
            let selection;
            try { selection = this.picker({ id: 'genspark-export', mode: 'readwrite' }); }
            catch (error) { this.pickerError(error); return; }
            this.busy = true;
            this.render();
            try {
                const handle = await selection;
                await this.store.save(handle);
                await this.browser.storage.local.set({ markdownExportDestination: 'directory', markdownExportDirectoryName: handle.name });
                this.handle = handle;
                this.destination = 'directory';
                this.permission = await handle.queryPermission({ mode: 'readwrite' });
                this.failed = false;
                this.busy = false;
                this.render();
                if (this.jobId && this.job?.status !== 'completed') {
                    if (this.permission === 'granted') await this.saveJob();
                    else this.showConsentNeeded();
                } else {
                    this.message('保存先フォルダを設定しました。次回のMarkdown保存でこのフォルダを使用します。', 'success');
                }
            } catch (error) { this.pickerError(error); }
            finally { this.busy = false; this.render(); }
        }

        pickerError(error) {
            if (error?.name === 'AbortError') {
                this.message('フォルダ選択をキャンセルしました。これまでの保存先は変更していません。', 'info');
            } else {
                this.failed = true;
                this.message(this.errorText(error), 'error');
            }
        }

        async allowAndSave() {
            if (this.loading || this.busy || !this.handle || !this.supported || !this.jobId || this.job?.status === 'completed') return;
            // Always request/recheck on the user's retry/consent click itself.
            // Never call requestPermission from init, a timer, or inside the lock.
            let permission;
            try { permission = this.handle.requestPermission({ mode: 'readwrite' }); }
            catch (error) { this.message(this.errorText(error), 'error'); return; }
            this.busy = true;
            this.render();
            try {
                this.permission = await permission;
                if (this.permission !== 'granted') {
                    this.message('書き込みは許可されませんでした。会話はまだ保存していません。許可するか別のフォルダを選んでください。', 'info');
                    return;
                }
                await this.browser.storage.local.set({ markdownExportDestination: 'directory', markdownExportDirectoryName: this.handle.name });
                this.destination = 'directory';
                this.busy = false;
                await this.saveJob();
            } catch (error) {
                this.failed = true;
                this.message(error?.name === 'AbortError' ? '許可をキャンセルしました。会話はまだ保存していません。' : this.errorText(error), error?.name === 'AbortError' ? 'info' : 'error');
            } finally { this.busy = false; this.render(); }
        }

        async saveJob() {
            if (this.busy || !this.handle || !this.jobId || this.destination !== 'directory') return;
            this.busy = true;
            this.failed = false;
            this.elements.result.hidden = true;
            this.message('Markdownと画像を保存中です。このタブを閉じないでください。', 'info');
            this.render();
            try {
                await this.navigator.locks.request('genspark-directory-export', async () => {
                    const key = jobKey(this.jobId);
                    const job = (await this.browser.storage.session.get(key))[key];
                    if (!job) throw new Error('保存データが見つかりません。Gensparkのページからもう一度保存してください。');
                    this.job = job;
                    if (job.status === 'completed') { this.showResult(job.result, true); return; }
                    if (!job.request) throw new Error('保存データに会話がありません。Gensparkのページからもう一度保存してください。');
                    this.permission = await this.handle.queryPermission({ mode: 'readwrite' });
                    if (this.permission !== 'granted') { this.showConsentNeeded(); return; }
                    const writer = this.writer.create(this.handle);
                    const result = await this.bundle.exportMarkdownBundle(job.request, { writer, browser: this.browser });
                    if (result?.markdownSaved) {
                        // Retain a reload-safe receipt, not the private conversation.
                        this.job = { createdAt: job.createdAt, title: job.request.title || '', status: 'completed', result, completedAt: Date.now() };
                        await this.browser.storage.session.set({ [key]: this.job });
                        this.showResult(result);
                    } else {
                        this.failed = true;
                        this.job = { ...job, status: 'pending', result };
                        await this.browser.storage.session.set({ [key]: this.job });
                        this.message(result?.error || result?.failed?.map(item => item.error).filter(Boolean).join('\n') || '保存を完了できませんでした。「保存を再試行」で再度お試しください。', 'error');
                    }
                });
            } catch (error) {
                this.failed = true;
                await this.recordPendingFailure(error);
                this.message(this.errorText(error), 'error');
            } finally { this.busy = false; this.render(); }
        }

        async recordPendingFailure(error) {
            // Keep diagnostics even for throws before the engine returns. Re-lock
            // and re-read: another tab may have completed this job after failure.
            try {
                await this.navigator.locks.request('genspark-directory-export', async () => {
                    const key = jobKey(this.jobId);
                    const current = (await this.browser.storage.session.get(key))[key];
                    if (!current) return;
                    if (current.status === 'completed') { this.job = current; return; }
                    this.job = { ...current, status: 'pending', result: { markdownSaved: false, error: this.errorText(error) } };
                    await this.browser.storage.session.set({ [key]: this.job });
                });
            } catch { /* Diagnostic persistence must not mask the original error. */ }
        }

        showResult(result, previous = false) {
            if (!result?.markdownSaved) {
                this.message('以前の保存結果を確認できません。Gensparkのページからもう一度保存してください。', 'error');
                return;
            }
            const failed = result.failed?.length || 0;
            this.message((previous ? 'この会話は保存済みです。重複して保存していません。' : 'Markdownを保存しました。') +
                (failed ? '\n画像 ' + failed + ' 枚は保存できなかったため、元の画像リンクを残しています。' : ''), failed ? 'warning' : 'success');
            this.elements.result.textContent = '保存先：' + (result.markdownPath || this.handle?.name || '') +
                '\n保存した画像：' + (result.downloadedImages || 0) + ' / ' + (result.totalImages || 0) + ' 枚' +
                (failed ? '\n' + result.failed.map(item => item.error).filter(Boolean).join('\n') : '');
            this.elements.result.hidden = false;
        }

        async forgetFolder() {
            if (this.loading || this.busy) return;
            this.busy = true;
            this.render();
            try {
                await this.store.clear();
                await this.browser.storage.local.remove('markdownExportDirectoryName');
                this.handle = null;
                this.permission = null;
                this.message('保存先フォルダを忘れました。フォルダ内のファイルは削除していません。', 'info');
            } catch (error) { this.message(this.errorText(error), 'error'); }
            finally { this.busy = false; this.render(); }
        }

        async useDownloads() {
            if (this.loading || this.busy) return;
            this.busy = true;
            this.render();
            try {
                await this.browser.storage.local.set({ markdownExportDestination: 'downloads' });
                this.destination = 'downloads';
                this.message('通常のDownloads保存に切り替えました。' + (this.jobId ? 'この会話はまだ保存していません。Gensparkのページに戻って再度ダウンロードしてください。' : ''), 'info');
            } catch (error) { this.message(this.errorText(error), 'error'); }
            finally { this.busy = false; this.render(); }
        }
    }
    root.GensparkExportPage = ExportPage;
    if (root.document?.addEventListener) root.document.addEventListener('DOMContentLoaded', () => {
        const page = new ExportPage();
        root.gensparkExportPage = page;
        page.init();
    });
})(globalThis);
