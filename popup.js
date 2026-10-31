/**
 * Genspark Conversation Manager v2.6 - Popup Script
 * לוגיקת ממשק המשתמש של התוסף
 */

// Translation System
const translations = {
    ja: {
        appName: 'Genspark Conversation Manager', version: 'バージョン',
        checkingConnection: '接続を確認しています...', searchingTab: 'Genspark のタブを探しています...',
        connectedSuccess: '接続しました', extensionActive: '拡張機能は有効です',
        notOnGenspark: 'Genspark のページではありません', onlyOnGenspark: 'この拡張機能は genspark.ai で利用できます',
        connectionError: '接続エラー', cannotConnect: '拡張機能に接続できません',
        messagesInConv: '会話内のメッセージ', savedConversations: '保存済みの会話',
        search: '検索', searchInConv: '現在の会話', searchAll: 'すべての会話',
        searchPlaceholderConv: '会話内を検索', searchPlaceholderAll: 'すべての会話を検索', searchBtn: '検索',
        noResults: '検索結果がありません', searching: '検索中...', resultsFound: '{count} 件の結果が見つかりました',
        conversationManager: '会話マネージャー', saveCurrentConv: '現在の会話を保存',
        viewSavedConvs: '保存済みの会話を表示', downloadAllConvs: '保存済みの会話をすべてダウンロード',
        noSavedConvs: '保存済みの会話はありません', saveConvToStart: '現在の会話を保存して始めましょう',
        openConv: '会話を開く', deleteConv: '会話を削除', confirmDelete: 'この会話を削除しますか？',
        confirmDownloadAll: '保存済みの会話をすべてダウンロードしますか？',
        downloadConvBtn: '会話をダウンロード（JSON + TXT）', downloadJsonBtn: 'JSON のみダウンロード',
        downloadTxtBtn: 'TXT のみダウンロード', refreshBtn: 'データを更新', searchInConvBtn: '会話を検索',
        downloadingConv: '会話をダウンロード中...', convDownloaded: '会話をダウンロードしました', downloadError: 'ダウンロードエラー',
        savingConv: '会話を保存中...', convSaved: '会話を保存しました', messages: '件のメッセージ',
        convDeleted: '会話を削除しました', downloadingAll: 'すべての会話をダウンロード中...',
        allConvsDownloaded: '{count} 件の会話をダウンロードしました', noConvsToDownload: 'ダウンロードする保存済みの会話がありません',
        openingInNewTab: '会話を新しいタブで開いています...', noUrlAvailable: 'この会話の URL がありません',
        navigatingToConv: '会話に移動中...', navigationComplete: '会話に移動しました', navigationError: '会話への移動に失敗しました',
        enterSearchText: '検索する文字を入力してください', searchError: '検索エラー', scrollToMessage: 'メッセージに移動しました',
        refreshingData: 'データを更新中...', dataRefreshed: 'データを更新しました', noConnection: '拡張機能に接続されていません',
        loadingSavedConvs: '保存済みの会話を読み込み中...', loadingError: '保存済みの会話を読み込めませんでした',
        deleteError: '会話を削除できませんでした', saveError: '会話を保存できませんでした',
        exactMatch: '完全一致', partialMatch: '部分一致', footerText: '会話の検索、ダウンロード、管理', loading: '読み込み中...'
    },
    he: {
        // Header
        appName: 'Genspark Conversation Manager',
        version: 'גרסה',

        // Status
        checkingConnection: 'בודק חיבור...',
        searchingTab: 'מחפש טאב פעיל של Genspark...',
        connectedSuccess: 'מחובר בהצלחה',
        extensionActive: 'התוסף פועל',
        notOnGenspark: 'לא בדף Genspark',
        onlyOnGenspark: 'התוסף פועל רק באתר genspark.ai',
        connectionError: 'שגיאת חיבור',
        cannotConnect: 'לא ניתן להתחבר לתוסף',

        // Stats
        messagesInConv: 'הודעות בשיחה',
        savedConversations: 'שיחות שמורות',

        // Search
        search: 'חיפוש',
        searchInConv: 'בשיחה הנוכחית',
        searchAll: 'בכל השיחות',
        searchPlaceholderConv: 'הקלד טקסט או מילה לחיפוש בשיחה...',
        searchPlaceholderAll: 'הקלד טקסט או מילה לחיפוש בכל השיחות...',
        searchBtn: 'חפש',
        noResults: 'לא נמצאו תוצאות',
        searching: 'מחפש...',
        resultsFound: 'נמצאו {count} תוצאות',

        // Conversation Manager
        conversationManager: 'מנהל שיחות',
        saveCurrentConv: 'שמור שיחה נוכחית',
        viewSavedConvs: 'צפה בשיחות שמורות',
        downloadAllConvs: 'הורד את כל השיחות',

        // Saved Conversations List
        noSavedConvs: 'אין שיחות שמורות',
        saveConvToStart: 'שמור שיחה נוכחית כדי להתחיל',
        openConv: 'פתח שיחה',
        deleteConv: 'מחק שיחה',
        confirmDelete: 'האם אתה בטוח שברצונך למחוק שיחה זו?',
        confirmDownloadAll: 'האם אתה בטוח שברצונך להוריד את כל השיחות השמורות?',

        // Download Buttons
        downloadConvBtn: 'הורד שיחה (JSON + TXT)',
        downloadJsonBtn: 'הורד JSON בלבד',
        downloadTxtBtn: 'הורד TXT בלבד',
        refreshBtn: 'רענן נתונים',
        searchInConvBtn: 'חיפוש בשיחה',

        // Messages
        downloadingConv: 'מוריד שיחה...',
        convDownloaded: 'השיחה הורדה בהצלחה!',
        downloadError: 'שגיאה בהורדה',
        savingConv: 'שומר שיחה...',
        convSaved: 'שיחה נשמרה בהצלחה!',
        messages: 'הודעות',
        convDeleted: 'שיחה נמחקה בהצלחה',
        downloadingAll: 'מוריד את כל השיחות...',
        allConvsDownloaded: '{count} שיחות הורדו בהצלחה!',
        noConvsToDownload: 'אין שיחות שמורות להורדה',
        openingInNewTab: 'פותח שיחה בטאב חדש...',
        noUrlAvailable: 'אין URL זמין לשיחה זו',
        navigatingToConv: 'מנווט לשיחה...',
        navigationComplete: 'ניווט לשיחה הושלם',
        navigationError: 'שגיאה בניווט לשיחה',
        enterSearchText: 'נא להזין טקסט לחיפוש',
        searchError: 'שגיאה בחיפוש',
        scrollToMessage: 'גלילה להודעה',
        refreshingData: 'מרענן נתונים...',
        dataRefreshed: 'נתונים עודכנו',
        noConnection: 'אין חיבור לתוסף',
        loadingSavedConvs: 'טוען שיחות שמורות...',
        loadingError: 'שגיאה בטעינת שיחות שמורות',
        deleteError: 'שגיאה במחיקת שיחה',
        saveError: 'שגיאה בשמירת שיחה',

        // Match scores
        exactMatch: 'התאמה מלאה',
        partialMatch: 'התאמה חלקית',

        // Footer
        footerText: 'חיפוש, הורדה וניהול שיחות מתקדם',

        // Loading
        loading: 'טוען...'
    },
    en: {
        // Header
        appName: 'Genspark Conversation Manager',
        version: 'Version',

        // Status
        checkingConnection: 'Checking connection...',
        searchingTab: 'Searching for active Genspark tab...',
        connectedSuccess: 'Connected successfully',
        extensionActive: 'Extension is active',
        notOnGenspark: 'Not on Genspark page',
        onlyOnGenspark: 'Extension only works on genspark.ai',
        connectionError: 'Connection error',
        cannotConnect: 'Cannot connect to extension',

        // Stats
        messagesInConv: 'Messages in conversation',
        savedConversations: 'Saved conversations',

        // Search
        search: 'Search',
        searchInConv: 'In current conversation',
        searchAll: 'In all conversations',
        searchPlaceholderConv: 'Type text or word to search in conversation...',
        searchPlaceholderAll: 'Type text or word to search in all conversations...',
        searchBtn: 'Search',
        noResults: 'No results found',
        searching: 'Searching...',
        resultsFound: '{count} results found',

        // Conversation Manager
        conversationManager: 'Conversation Manager',
        saveCurrentConv: 'Save current conversation',
        viewSavedConvs: 'View saved conversations',
        downloadAllConvs: 'Download all conversations',

        // Saved Conversations List
        noSavedConvs: 'No saved conversations',
        saveConvToStart: 'Save current conversation to get started',
        openConv: 'Open conversation',
        deleteConv: 'Delete conversation',
        confirmDelete: 'Are you sure you want to delete this conversation?',
        confirmDownloadAll: 'Are you sure you want to download all saved conversations?',

        // Download Buttons
        downloadConvBtn: 'Download conversation (JSON + TXT)',
        downloadJsonBtn: 'Download JSON only',
        downloadTxtBtn: 'Download TXT only',
        refreshBtn: 'Refresh data',
        searchInConvBtn: 'Search in conversation',

        // Messages
        downloadingConv: 'Downloading conversation...',
        convDownloaded: 'Conversation downloaded successfully!',
        downloadError: 'Download error',
        savingConv: 'Saving conversation...',
        convSaved: 'Conversation saved successfully!',
        messages: 'messages',
        convDeleted: 'Conversation deleted successfully',
        downloadingAll: 'Downloading all conversations...',
        allConvsDownloaded: '{count} conversations downloaded successfully!',
        noConvsToDownload: 'No saved conversations to download',
        openingInNewTab: 'Opening conversation in new tab...',
        noUrlAvailable: 'No URL available for this conversation',
        navigatingToConv: 'Navigating to conversation...',
        navigationComplete: 'Navigation completed',
        navigationError: 'Navigation error',
        enterSearchText: 'Please enter text to search',
        searchError: 'Search error',
        scrollToMessage: 'Scroll to message',
        refreshingData: 'Refreshing data...',
        dataRefreshed: 'Data updated',
        noConnection: 'No connection to extension',
        loadingSavedConvs: 'Loading saved conversations...',
        loadingError: 'Error loading saved conversations',
        deleteError: 'Error deleting conversation',
        saveError: 'Error saving conversation',

        // Match scores
        exactMatch: 'Exact match',
        partialMatch: 'Partial match',

        // Footer
        footerText: 'Advanced search, download and conversation management',

        // Loading
        loading: 'Loading...'
    }
};

Object.assign(translations.ja, {
    downloadMdBtn: 'Markdown をダウンロード (.md)', savedDownloadFormat: '保存済み会話の出力形式',
    diagnosticsBtn: '抽出診断を保存', collectingDiagnostics: 'ページ構造を確認しています...',
    diagnosticsSaved: '診断ファイルを保存しました', diagnosticsError: '診断ファイルを保存できませんでした',
    extractionHint: '会話を検出できません。会話が表示されている場合は「抽出診断を保存」で診断ファイルを取得してください。',
    noActiveTab: 'アクティブなタブが見つかりません', notResponding: '拡張機能から応答がありません',
    injectionFailed: 'ページへの接続に失敗しました', unknown: '不明', user: 'ユーザー',
    highlightError: 'メッセージを表示できませんでした', noMessages: '会話にメッセージが見つかりません',
    exportTitle: '保存済みの会話', exportDate: '出力日時', totalConversations: '会話の総数',
    conversation: '会話', savedAt: '保存日時', messageCount: 'メッセージ数', title: 'タイトル', date: '日時'
});
Object.assign(translations.en, {
    downloadMdBtn: 'Download Markdown (.md)', savedDownloadFormat: 'Saved conversation export format',
    diagnosticsBtn: 'Save extraction diagnostics', collectingDiagnostics: 'Inspecting page structure...',
    diagnosticsSaved: 'Diagnostic file saved', diagnosticsError: 'Could not save diagnostic file',
    extractionHint: 'No messages detected. If the conversation is visible, use “Save extraction diagnostics” to collect a diagnostic file.',
    noActiveTab: 'No active tab found', notResponding: 'Extension is not responding',
    injectionFailed: 'Failed to connect to the page', unknown: 'Unknown', user: 'User',
    highlightError: 'Failed to highlight message', noMessages: 'No conversation messages found',
    exportTitle: 'Saved conversations', exportDate: 'Export date', totalConversations: 'Total conversations',
    conversation: 'Conversation', savedAt: 'Saved at', messageCount: 'Message count', title: 'Title', date: 'Date'
});
Object.assign(translations.he, {
    downloadMdBtn: 'הורד Markdown (.md)', savedDownloadFormat: 'פורמט ייצוא שיחות שמורות',
    diagnosticsBtn: 'שמור אבחון חילוץ', collectingDiagnostics: 'בודק את מבנה הדף...',
    diagnosticsSaved: 'קובץ האבחון נשמר', diagnosticsError: 'לא ניתן לשמור את קובץ האבחון',
    extractionHint: 'לא זוהו הודעות. אם השיחה מוצגת, השתמשו בשמירת אבחון חילוץ כדי ליצור קובץ אבחון.',
    noActiveTab: 'לא נמצא טאב פעיל', notResponding: 'התוסף לא מגיב',
    injectionFailed: 'כשל בהזרקת הסקריפט', unknown: 'לא ידוע', user: 'משתמש',
    highlightError: 'שגיאה בהדגשת הודעה', noMessages: 'לא נמצאו הודעות בשיחה',
    exportTitle: 'שיחות שמורות', exportDate: 'תאריך ייצוא', totalConversations: 'סך הכל שיחות',
    conversation: 'שיחה', savedAt: 'נשמר ב', messageCount: 'כמות הודעות', title: 'כותרת', date: 'תאריך'
});

class PopupManager {
    constructor() {
        this.isConnected = false;
        this.currentTab = null;
        this.stats = { messageCount: 0 };
        this.currentSearchMode = 'conversation'; // 'conversation' or 'all'
        this.currentLang = 'ja';

        this.elements = {};
        this.init();
    }

    async init() {
        // Load language preference
        await this.loadLanguage();

        this.bindElements();
        this.attachEventListeners();
        this.checkConnection();
        this.updateUILanguage();

        console.log('🎛️ Popup Manager אותחל');
    }

    async loadLanguage() {
        try {
            const stored = await chrome.storage.local.get(['language']);
            this.currentLang = Object.hasOwn(translations, stored.language) ? stored.language : 'ja';
        } catch (error) {
            console.error('Failed to load language:', error);
            this.currentLang = 'ja';
        }
    }

    async setLanguage(lang) {
        if (!Object.hasOwn(translations, lang)) {
            console.error('Invalid language:', lang);
            return;
        }

        this.currentLang = lang;

        // Save to storage
        try {
            await chrome.storage.local.set({ language: lang });
        } catch (error) {
            console.error('Failed to save language:', error);
        }

        // Update UI
        this.updateUILanguage();
        this.checkConnection();
        if (this.elements.savedConversationsContainer.style.display !== 'none') this.viewSavedConversations();
        this.elements.searchResults.innerHTML = '';
        this.elements.message.style.display = 'none';
        console.log(`Language changed to: ${lang}`);
    }

    t(key, params = {}) {
        // Translation function
        let text = translations[this.currentLang][key] || key;

        // Replace parameters
        Object.keys(params).forEach(paramKey => {
            text = text.replace(`{${paramKey}}`, params[paramKey]);
        });

        return text;
    }

    updateUILanguage() {
        // Update direction
        const isRTL = this.currentLang === 'he';
        document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
        document.documentElement.setAttribute('lang', this.currentLang);

        // Update all text elements
        this.updateStaticTexts();
        this.updateButtonTexts();

        // Update language selector buttons
        if (this.elements.langHe && this.elements.langEn) {
            this.elements.langHe.classList.toggle('active', this.currentLang === 'he');
            this.elements.langEn.classList.toggle('active', this.currentLang === 'en');
            this.elements.langJa.classList.toggle('active', this.currentLang === 'ja');
        }
    }

    updateStaticTexts() {
        // Update header
        const versionText = document.querySelector('.version');
        if (versionText) {
            versionText.textContent = `${this.t('version')} 2.6`;
        }

        // Update stats labels
        const messageLabel = document.querySelector('.stat-label');
        if (messageLabel) {
            messageLabel.textContent = this.t('messagesInConv');
        }

        const savedLabel = document.querySelectorAll('.stat-label')[1];
        if (savedLabel) {
            savedLabel.textContent = this.t('savedConversations');
        }

        // Update search title
        const searchTitle = document.querySelector('.search-title');
        if (searchTitle) {
            searchTitle.textContent = `🔍 ${this.t('search')}`;
        }
        document.querySelector('#savedConversationsContainer .search-title').textContent = `📚 ${this.t('savedConversations')}`;
        document.querySelector('#loading div:last-child').textContent = this.t('loading');
        this.elements.extractionHint.textContent = this.t('extractionHint');
        if (this.elements.savedDownloadFormatLabel) {
            this.elements.savedDownloadFormatLabel.textContent = this.t('savedDownloadFormat');
        }

        // Update section title
        const sectionTitle = document.querySelector('.section-title');
        if (sectionTitle) {
            sectionTitle.textContent = `📚 ${this.t('conversationManager')}`;
        }

        // Update footer
        const footerText = document.querySelector('.footer div:last-child');
        if (footerText) {
            footerText.textContent = this.t('footerText');
        }
    }

    updateButtonTexts() {
        // Update all buttons with data-i18n attribute or specific IDs
        if (this.elements.toggleSearchBtn) {
            this.elements.toggleSearchBtn.innerHTML = `<span class="icon">🔍</span> ${this.t('searchInConvBtn')}`;
        }

        if (this.elements.downloadMdBtn) {
            this.elements.downloadMdBtn.innerHTML = `<span class="icon">📥</span> ${this.t('downloadMdBtn')}`;
        }

        if (this.elements.downloadBtn) {
            this.elements.downloadBtn.innerHTML = `<span class="icon">📥</span> ${this.t('downloadConvBtn')}`;
        }

        if (this.elements.downloadJsonBtn) {
            this.elements.downloadJsonBtn.innerHTML = `<span class="icon">📄</span> ${this.t('downloadJsonBtn')}`;
        }

        if (this.elements.downloadTxtBtn) {
            this.elements.downloadTxtBtn.innerHTML = `<span class="icon">📝</span> ${this.t('downloadTxtBtn')}`;
        }

        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.innerHTML = `<span class="icon">🔄</span> ${this.t('refreshBtn')}`;
        }
        if (this.elements.diagnosticsBtn) {
            this.elements.diagnosticsBtn.innerHTML = `<span class="icon">🔎</span> ${this.t('diagnosticsBtn')}`;
        }

        if (this.elements.saveConversationBtn) {
            this.elements.saveConversationBtn.innerHTML = `<span class="icon">💾</span> ${this.t('saveCurrentConv')}`;
        }

        if (this.elements.viewSavedBtn) {
            this.elements.viewSavedBtn.innerHTML = `<span class="icon">📚</span> ${this.t('viewSavedConvs')}`;
        }

        if (this.elements.downloadAllBtn) {
            this.elements.downloadAllBtn.innerHTML = `<span class="icon">📦</span> ${this.t('downloadAllConvs')}`;
        }

        if (this.elements.searchBtn) {
            this.elements.searchBtn.innerHTML = `<span class="icon">🔎</span> ${this.t('searchBtn')}`;
        }

        if (this.elements.searchModeConversation) {
            this.elements.searchModeConversation.textContent = `💬 ${this.t('searchInConv')}`;
        }

        if (this.elements.searchModeAll) {
            this.elements.searchModeAll.textContent = `📋 ${this.t('searchAll')}`;
        }

        // Update placeholders
        if (this.elements.searchInput) {
            this.elements.searchInput.placeholder = this.currentSearchMode === 'conversation'
                ? this.t('searchPlaceholderConv')
                : this.t('searchPlaceholderAll');
        }
    }

    bindElements() {
        this.elements = {
            statusCard: document.getElementById('statusCard'),
            statusTitle: document.getElementById('statusTitle'),
            statusInfo: document.getElementById('statusInfo'),
            statsGrid: document.getElementById('statsGrid'),
            messageCount: document.getElementById('messageCount'),
            savedCount: document.getElementById('savedCount'),
            downloadMdBtn: document.getElementById('downloadMdBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            savedDownloadFormat: document.getElementById('savedDownloadFormat'),
            savedDownloadFormatLabel: document.getElementById('savedDownloadFormatLabel'),
            downloadJsonBtn: document.getElementById('downloadJsonBtn'),
            downloadTxtBtn: document.getElementById('downloadTxtBtn'),
            refreshBtn: document.getElementById('refreshBtn'),
            diagnosticsBtn: document.getElementById('diagnosticsBtn'),
            extractionHint: document.getElementById('extractionHint'),
            toggleSearchBtn: document.getElementById('toggleSearchBtn'),
            searchContainer: document.getElementById('searchContainer'),
            searchInput: document.getElementById('searchInput'),
            searchBtn: document.getElementById('searchBtn'),
            closeSearch: document.getElementById('closeSearch'),
            searchResults: document.getElementById('searchResults'),
            searchModeConversation: document.getElementById('searchModeConversation'),
            searchModeAll: document.getElementById('searchModeAll'),
            managerSection: document.getElementById('managerSection'),
            saveConversationBtn: document.getElementById('saveConversationBtn'),
            viewSavedBtn: document.getElementById('viewSavedBtn'),
            downloadAllBtn: document.getElementById('downloadAllBtn'),
            savedConversationsContainer: document.getElementById('savedConversationsContainer'),
            savedConversationsList: document.getElementById('savedConversationsList'),
            closeSaved: document.getElementById('closeSaved'),
            langHe: document.getElementById('langHe'),
            langEn: document.getElementById('langEn'),
            langJa: document.getElementById('langJa'),
            loading: document.getElementById('loading'),
            message: document.getElementById('message')
        };
    }

    attachEventListeners() {
        this.elements.downloadMdBtn?.addEventListener('click', () => {
            this.downloadConversation('md');
        });
        this.elements.diagnosticsBtn?.addEventListener('click', () => {
            this.saveExtractionDiagnostics();
        });
        // כפתור הורדה כללית
        this.elements.downloadBtn?.addEventListener('click', () => {
            this.downloadConversation('both');
        });

        // הורדת JSON בלבד
        this.elements.downloadJsonBtn?.addEventListener('click', () => {
            this.downloadConversation('json');
        });

        // הורדת TXT בלבד
        this.elements.downloadTxtBtn?.addEventListener('click', () => {
            this.downloadConversation('txt');
        });

        // כפתור רענון
        this.elements.refreshBtn?.addEventListener('click', () => {
            this.refreshData();
        });

        // כפתור פתיחת חיפוש
        this.elements.toggleSearchBtn?.addEventListener('click', () => {
            this.toggleSearch();
        });

        // כפתור סגירת חיפוש
        this.elements.closeSearch?.addEventListener('click', () => {
            this.closeSearchPanel();
        });

        // כפתור חיפוש
        this.elements.searchBtn?.addEventListener('click', () => {
            this.performSearch();
        });

        // חיפוש בלחיצה על Enter
        this.elements.searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // מצב חיפוש - בשיחה הנוכחית
        this.elements.searchModeConversation?.addEventListener('click', () => {
            this.setSearchMode('conversation');
        });

        // מצב חיפוש - בכל השיחות
        this.elements.searchModeAll?.addEventListener('click', () => {
            this.setSearchMode('all');
        });

        // כפתור שמירת שיחה
        this.elements.saveConversationBtn?.addEventListener('click', () => {
            this.saveConversation();
        });

        // כפתור צפייה בשיחות שמורות
        this.elements.viewSavedBtn?.addEventListener('click', () => {
            this.viewSavedConversations();
        });

        // כפתור הורדת כל השיחות
        this.elements.downloadAllBtn?.addEventListener('click', () => {
            this.downloadAllConversations();
        });

        // כפתור סגירת רשימת שיחות שמורות
        this.elements.closeSaved?.addEventListener('click', () => {
            this.closeSavedConversations();
        });

        // Language selection buttons
        this.elements.langHe?.addEventListener('click', () => {
            this.setLanguage('he');
        });

        this.elements.langEn?.addEventListener('click', () => {
            this.setLanguage('en');
        });
        this.elements.langJa?.addEventListener('click', () => {
            this.setLanguage('ja');
        });
    }

    async checkConnection() {
        try {
            this.showLoading(true);
            this.updateStatus('🔍', this.t('checkingConnection'), this.t('searchingTab'));

            // קבל את הטאב הנוכחי
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];

            if (!this.currentTab) {
                throw new Error(this.t('noActiveTab'));
            }

            // בדוק אם זה דף של Genspark
            if (!this.currentTab.url?.includes('genspark.ai')) {
                this.isConnected = false;
                this.updateStatus('⚠️', this.t('notOnGenspark'), this.t('onlyOnGenspark'));
                this.setButtonsEnabled(false);
                return;
            }

            // נסה לשלוח ping לתוסף
            const response = await this.sendMessageToTab('ping');

            if (response && response.status === 'active') {
                this.isConnected = true;
                this.updateStatus('✅', this.t('connectedSuccess'), `${this.t('extensionActive')} (${response.version || this.t('unknown')})`);
                this.setButtonsEnabled(true);
                await this.loadStats();
                await this.loadSavedConversationsCount();
            } else {
                throw new Error(this.t('notResponding'));
            }

        } catch (error) {
            console.error('Connection failed:', error);
            this.isConnected = false;
            this.updateStatus('❌', this.t('connectionError'), error.message || this.t('cannotConnect'));
            this.setButtonsEnabled(false);
        } finally {
            this.showLoading(false);
        }
    }

    async sendMessageToTab(action, data = {}) {
        if (!this.currentTab?.id) {
            throw new Error(this.t('noActiveTab'));
        }

        try {
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: action,
                ...data
            });

            return response;
        } catch (error) {
            // נסה להזריק את הסקריפט אם הוא לא קיים
            if (error.message?.includes('Could not establish connection')) {
                await this.injectContentScript();

                // נסה שוב אחרי הזרקה
                return await chrome.tabs.sendMessage(this.currentTab.id, {
                    action: action,
                    ...data
                });
            }

            console.error('Message sending failed:', error);
            throw error;
        }
    }

    async injectContentScript() {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: this.currentTab.id },
                files: ['markdown.js', 'content.js']
            });

            // המתן קצת לאתחול
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error('Script injection failed:', error);
            throw new Error(this.t('injectionFailed'));
        }
    }

    async loadStats() {
        try {
            const response = await this.sendMessageToTab('getStats');

            if (response) {
                this.stats = {
                    messageCount: response.messageCount || 0
                };

                this.updateStatsDisplay();
            }

        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    updateStatsDisplay() {
        if (this.elements.extractionHint) {
            this.elements.extractionHint.textContent = this.t('extractionHint');
            this.elements.extractionHint.style.display = this.stats.messageCount === 0 ? 'block' : 'none';
        }
        if (this.elements.messageCount) {
            this.elements.messageCount.textContent = this.stats.messageCount;
        }

        // הצג נתונים
        if (this.elements.statsGrid) {
            this.elements.statsGrid.style.display = 'grid';
        }
    }

    async downloadConversation(format = 'md') {
        try {
            if (!this.isConnected) {
                throw new Error(this.t('noConnection'));
            }

            this.showLoading(true);
            this.showMessage(this.t('downloadingConv'), 'info');

            const response = await this.sendMessageToTab('download', { format, language: this.currentLang, labels: {
                conversation: this.t('conversation'), title: this.t('title'), date: this.t('date'),
                messageCount: this.t('messageCount'), user: this.t('user')
            } });

            if (response && response.success) {
                this.showMessage('✅ ' + this.t('convDownloaded'), 'success');

                // רענן נתונים
                setTimeout(() => this.loadStats(), 1000);
            } else {
                throw new Error(response?.errorCode ? this.t(response.errorCode) : this.t('downloadError'));
            }

        } catch (error) {
            console.error('Download failed:', error);
            this.showMessage('❌ ' + this.t('downloadError') + ': ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async refreshData() {
        this.showMessage(this.t('refreshingData'), 'info');
        await this.checkConnection();
        if (this.isConnected) this.showMessage('✅ ' + this.t('dataRefreshed'), 'success');
    }

    toggleSearch() {
        if (!this.isConnected) {
            this.showMessage('❌ ' + this.t('noConnection'), 'error');
            return;
        }

        const isVisible = this.elements.searchContainer.style.display !== 'none';

        if (isVisible) {
            this.closeSearchPanel();
        } else {
            this.openSearchPanel();
        }
    }

    openSearchPanel() {
        this.elements.searchContainer.style.display = 'block';
        this.elements.searchInput.value = '';
        this.elements.searchResults.innerHTML = '';
        this.elements.searchInput.focus();
    }

    closeSearchPanel() {
        this.elements.searchContainer.style.display = 'none';
        this.elements.searchInput.value = '';
        this.elements.searchResults.innerHTML = '';
    }

    setSearchMode(mode) {
        this.currentSearchMode = mode;

        // עדכן כפתורי מצב
        if (mode === 'conversation') {
            this.elements.searchModeConversation?.classList.add('active');
            this.elements.searchModeAll?.classList.remove('active');
            this.elements.searchInput.placeholder = this.t('searchPlaceholderConv');
        } else {
            this.elements.searchModeConversation?.classList.remove('active');
            this.elements.searchModeAll?.classList.add('active');
            this.elements.searchInput.placeholder = this.t('searchPlaceholderAll');
        }

        // נקה תוצאות קודמות
        this.elements.searchResults.innerHTML = '';
        this.elements.searchInput.value = '';

        console.log(`🔍 מצב חיפוש שונה ל: ${mode === 'conversation' ? 'שיחה נוכחית' : 'כל השיחות'}`);
    }

    async performSearch() {
        const query = this.elements.searchInput.value.trim();

        if (!query) {
            this.showMessage('⚠️ ' + this.t('enterSearchText'), 'error');
            return;
        }

        try {
            this.showLoading(true);
            this.elements.searchResults.innerHTML = `<div class="search-no-results">${this.t('searching')}</div>`;

            if (this.currentSearchMode === 'conversation') {
                // חיפוש בשיחה הנוכחית
                const response = await this.sendMessageToTab('search', { query });

                if (response && response.success) {
                    this.displaySearchResults(response.results, query);
                } else {
                    throw new Error(this.t('searchError'));
                }
            } else {
                // חיפוש בכל השיחות
                const response = await this.sendMessageToTab('searchAll', { query });

                if (response && response.success) {
                    this.displayAllSearchResults(response.results, query);
                } else {
                    throw new Error(this.t('searchError'));
                }
            }

        } catch (error) {
            console.error('Search failed:', error);
            this.showMessage('❌ ' + this.t('searchError') + ': ' + error.message, 'error');
            this.elements.searchResults.innerHTML = `<div class="search-no-results">${this.t('searchError')}</div>`;
        } finally {
            this.showLoading(false);
        }
    }

    displaySearchResults(results, query) {
        if (!results || results.length === 0) {
            this.elements.searchResults.innerHTML = `<div class="search-no-results">${this.t('noResults')}</div>`;
            return;
        }

        let html = '';

        results.forEach((result) => {
            const typeLabel = result.type === 'user' ? `👤 ${this.t('user')}` : '🤖 AI';

            // הדגש את המילה שחיפשנו
            const highlightedSnippet = this.highlightText(result.snippet, query);

            html += `
                <div class="search-result-item" data-index="${result.index}">
                    <div class="search-result-type">${typeLabel}</div>
                    <div class="search-result-content">${highlightedSnippet}</div>
                </div>
            `;
        });

        this.elements.searchResults.innerHTML = html;

        // הוסף event listeners לתוצאות
        this.elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.highlightMessageInPage(index);
            });
        });

        this.showMessage('✅ ' + this.t('resultsFound', { count: results.length }), 'success');
    }

    displayAllSearchResults(results, query) {
        if (!results || results.length === 0) {
            this.elements.searchResults.innerHTML = `<div class="search-no-results">${this.t('noResults')}</div>`;
            return;
        }

        let html = '';

        results.forEach((result) => {
            // הדגש את המילה שחיפשנו
            const highlightedSnippet = this.highlightText(result.snippet, query);
            const highlightedTitle = this.highlightText(result.title, query);

            // תצוגת ציון התאמה
            let matchBadge = '';
            if (result.score >= 100) {
                matchBadge = `<span class="search-match-score">⭐ ${this.t('exactMatch')}</span>`;
            } else if (result.score >= 80) {
                matchBadge = `<span class="search-match-score">✓ ${this.t('partialMatch')}</span>`;
            }

            html += `
                <div class="search-result-item" data-conversation-id="${result.conversationId}">
                    <div class="search-result-type">
                        ${matchBadge}
                        💬 ${highlightedTitle}
                    </div>
                    <div class="search-result-content">${highlightedSnippet}</div>
                </div>
            `;
        });

        this.elements.searchResults.innerHTML = html;

        // הוסף event listeners לתוצאות
        this.elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const conversationId = item.dataset.conversationId;
                this.navigateToConversation(conversationId);
            });
        });

        this.showMessage('✅ ' + this.t('resultsFound', { count: results.length }), 'success');
    }

    async navigateToConversation(conversationId) {
        try {
            this.showMessage(this.t('navigatingToConv'), 'info');

            await this.sendMessageToTab('navigateToConversation', { conversationId });

            this.showMessage('✅ ' + this.t('navigationComplete'), 'success');

            // סגור את פאנל החיפוש אחרי כמה שניות
            setTimeout(() => {
                this.closeSearchPanel();
            }, 1500);

        } catch (error) {
            console.error('Navigation failed:', error);
            this.showMessage('❌ ' + this.t('navigationError'), 'error');
        }
    }

    highlightText(text, query) {
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);

        if (index === -1) return text;

        const before = text.substring(0, index);
        const match = text.substring(index, index + query.length);
        const after = text.substring(index + query.length);

        return `${before}<span class="search-highlight">${match}</span>${after}`;
    }

    async highlightMessageInPage(index) {
        try {
            await this.sendMessageToTab('highlightMessage', { index });
            this.showMessage('✅ ' + this.t('scrollToMessage'), 'success');
        } catch (error) {
            console.error('Highlight failed:', error);
            this.showMessage('❌ ' + this.t('highlightError'), 'error');
        }
    }

    updateStatus(icon, title, info) {
        if (this.elements.statusTitle) {
            this.elements.statusTitle.textContent = title;
            const iconSpan = this.elements.statusTitle.parentElement.querySelector('.icon');
            if (iconSpan) iconSpan.textContent = icon;
        }

        if (this.elements.statusInfo) {
            this.elements.statusInfo.textContent = info;
        }

        // שנה צבע כרטיס הסטטוס
        if (this.elements.statusCard) {
            this.elements.statusCard.style.borderRightColor = 
                icon === '✅' ? '#28a745' : 
                icon === '❌' ? '#dc3545' : 
                icon === '⚠️' ? '#ffc107' : '#007bff';
        }
    }

    setButtonsEnabled(enabled) {
        const buttons = [
            this.elements.downloadMdBtn,
            this.elements.downloadBtn,
            this.elements.downloadJsonBtn,
            this.elements.downloadTxtBtn,
            this.elements.toggleSearchBtn,
            this.elements.saveConversationBtn,
            this.elements.viewSavedBtn,
            this.elements.downloadAllBtn,
            this.elements.diagnosticsBtn
        ];

        buttons.forEach(button => {
            if (button) {
                button.disabled = !enabled;
            }
        });

        // הצג את מנהל השיחות אם יש חיבור
        if (this.elements.managerSection) {
            this.elements.managerSection.style.display = enabled ? 'block' : 'none';
        }
        if (!enabled && this.elements.extractionHint) this.elements.extractionHint.style.display = 'none';
    }

    showLoading(show) {
        if (this.elements.loading) {
            this.elements.loading.style.display = show ? 'block' : 'none';
        }
    }

    showMessage(text, type = 'info') {
        if (!this.elements.message) return;

        this.elements.message.textContent = text;
        this.elements.message.className = type;
        this.elements.message.style.display = 'block';

        // הסתר הודעה אחרי 3 שניות
        setTimeout(() => {
            if (this.elements.message) {
                this.elements.message.style.display = 'none';
            }
        }, 3000);
    }

    // Conversation Manager Functions
    async saveExtractionDiagnostics() {
        let url;
        try {
            this.showLoading(true);
            this.showMessage(this.t('collectingDiagnostics'), 'info');
            const response = await this.sendMessageToTab('getExtractionDiagnostics');
            if (!response?.success || !response.diagnostics) throw new Error(this.t('diagnosticsError'));
            const blob = new Blob([JSON.stringify(response.diagnostics, null, 2)], { type: 'application/json;charset=utf-8' });
            url = URL.createObjectURL(blob);
            await chrome.downloads.download({
                url,
                filename: `genspark-diagnostics_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
                saveAs: true
            });
            this.showMessage(this.t('diagnosticsSaved'), 'success');
        } catch (error) {
            console.error('Extraction diagnostics failed:', error);
            this.showMessage(`${this.t('diagnosticsError')}: ${error.message}`, 'error');
        } finally {
            if (url) URL.revokeObjectURL(url);
            this.showLoading(false);
        }
    }

    async saveConversation() {
        try {
            if (!this.isConnected) {
                throw new Error(this.t('noConnection'));
            }

            this.showLoading(true);
            this.showMessage(this.t('savingConv'), 'info');

            const response = await this.sendMessageToTab('saveConversation');

            if (response && response.success) {
                this.showMessage(`✅ ${this.t('convSaved')} (${response.messageCount} ${this.t('messages')})`, 'success');
                await this.loadSavedConversationsCount();
            } else {
                throw new Error(response.errorCode ? this.t(response.errorCode) : (response.error || this.t('saveError')));
            }

        } catch (error) {
            console.error('Save conversation failed:', error);
            this.showMessage('❌ ' + this.t('saveError') + ': ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadSavedConversationsCount() {
        try {
            const stored = await chrome.storage.local.get(['savedConversations']);
            const savedConversations = stored.savedConversations || [];

            if (this.elements.savedCount) {
                this.elements.savedCount.textContent = savedConversations.length;
            }

            return savedConversations.length;

        } catch (error) {
            console.error('Failed to load saved conversations count:', error);
            return 0;
        }
    }

    async viewSavedConversations() {
        try {
            this.showLoading(true);

            const stored = await chrome.storage.local.get(['savedConversations']);
            const savedConversations = stored.savedConversations || [];

            if (savedConversations.length === 0) {
                this.elements.savedConversationsList.innerHTML = `
                    <div class="no-saved-conversations">
                        ${this.t('noSavedConvs')}<br>
                        ${this.t('saveConvToStart')}
                    </div>
                `;
            } else {
                let html = '';

                savedConversations.forEach((conv, index) => {
                    const savedDate = new Date(conv.savedAt);
                    const dateStr = savedDate.toLocaleDateString(this.currentLang);
                    const timeStr = savedDate.toLocaleTimeString(this.currentLang, { hour: '2-digit', minute: '2-digit' });

                    html += `
                        <div class="saved-conversation-item" data-index="${index}" data-id="${conv.id}">
                            <div class="saved-conversation-header">
                                <div class="saved-conversation-title">${conv.title}</div>
                                <div class="saved-conversation-actions">
                                    <button class="saved-conversation-action open" title="${this.t('openConv')}" data-index="${index}">
                                        🔗
                                    </button>
                                    <button class="saved-conversation-action delete" title="${this.t('deleteConv')}" data-index="${index}">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                            <div class="saved-conversation-meta">
                                <span>📅 ${dateStr}</span>
                                <span>⏰ ${timeStr}</span>
                                <span>💬 ${conv.messageCount} ${this.t('messages')}</span>
                            </div>
                        </div>
                    `;
                });

                this.elements.savedConversationsList.innerHTML = html;

                // הוסף event listeners לפעולות
                this.elements.savedConversationsList.querySelectorAll('.saved-conversation-action.open').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const index = parseInt(btn.dataset.index);
                        this.openConversation(savedConversations[index]);
                    });
                });

                this.elements.savedConversationsList.querySelectorAll('.saved-conversation-action.delete').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const index = parseInt(btn.dataset.index);
                        this.deleteConversation(index);
                    });
                });
            }

            // הצג את הקונטיינר
            this.elements.savedConversationsContainer.style.display = 'block';

        } catch (error) {
            console.error('Failed to view saved conversations:', error);
            this.showMessage('❌ ' + this.t('loadingError'), 'error');
        } finally {
            this.showLoading(false);
        }
    }

    closeSavedConversations() {
        this.elements.savedConversationsContainer.style.display = 'none';
    }

    async deleteConversation(index) {
        try {
            if (!confirm(this.t('confirmDelete'))) {
                return;
            }

            this.showLoading(true);

            const stored = await chrome.storage.local.get(['savedConversations']);
            const savedConversations = stored.savedConversations || [];

            savedConversations.splice(index, 1);

            await chrome.storage.local.set({ savedConversations: savedConversations });

            this.showMessage('✅ ' + this.t('convDeleted'), 'success');

            // רענן את התצוגה
            await this.loadSavedConversationsCount();
            await this.viewSavedConversations();

        } catch (error) {
            console.error('Failed to delete conversation:', error);
            this.showMessage('❌ ' + this.t('deleteError'), 'error');
        } finally {
            this.showLoading(false);
        }
    }

    openConversation(conversation) {
        if (conversation.url) {
            chrome.tabs.create({ url: conversation.url });
            this.showMessage('✅ ' + this.t('openingInNewTab'), 'success');
        } else {
            this.showMessage('⚠️ ' + this.t('noUrlAvailable'), 'error');
        }
    }

    async downloadAllConversations(format = this.elements.savedDownloadFormat?.value || 'md') {
        try {
            if (!confirm(this.t('confirmDownloadAll'))) {
                return;
            }

            this.showLoading(true);
            this.showMessage(this.t('downloadingAll'), 'info');

            const stored = await chrome.storage.local.get(['savedConversations']);
            const savedConversations = stored.savedConversations || [];

            if (savedConversations.length === 0) {
                throw new Error(this.t('noConvsToDownload'));
            }

            const selectedFormat = ['md', 'json', 'txt', 'both'].includes(format) ? format : 'md';
            const filename = `genspark_all_conversations_${new Date().toISOString().split('T')[0]}`;
            if (selectedFormat === 'md') {
                await this.downloadExportBlob(this.convertAllConversationsToMarkdown(savedConversations),
                    'text/markdown;charset=utf-8', `${filename}.md`);
            }
            if (selectedFormat === 'json' || selectedFormat === 'both') {
                const allConversationsData = {
                    exportDate: new Date().toISOString(),
                    totalConversations: savedConversations.length,
                    conversations: savedConversations
                };
                await this.downloadExportBlob(JSON.stringify(allConversationsData, null, 2),
                    'application/json;charset=utf-8', `${filename}.json`);
            }
            if (selectedFormat === 'txt' || selectedFormat === 'both') {
                await this.downloadExportBlob(this.convertAllConversationsToText(savedConversations),
                    'text/plain;charset=utf-8', `${filename}.txt`);
            }

            this.showMessage('✅ ' + this.t('allConvsDownloaded', { count: savedConversations.length }), 'success');

        } catch (error) {
            console.error('Download all conversations failed:', error);
            this.showMessage('❌ ' + this.t('downloadError') + ': ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async downloadExportBlob(content, type, filename) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        try {
            await chrome.downloads.download({ url, filename, saveAs: true });
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    convertAllConversationsToMarkdown(conversations) {
        const header = `# ${this.t('exportTitle')}\n\n${this.t('totalConversations')}: ${conversations.length}\n\n`;
        return header + conversations.map(conversation => globalThis.GensparkMarkdown.renderConversation({
            title: conversation.title,
            url: conversation.url,
            messages: (conversation.messages || []).map(message => ({
                ...message, content: message.content ?? message.text ?? ''
            }))
        })).join('\n\n---\n\n');
    }

    convertAllConversationsToText(conversations) {
        let text = '='.repeat(80) + '\n';
        text += `${this.t('exportTitle')} - Genspark Conversation Manager\n`;
        text += `${this.t('exportDate')}: ${new Date().toLocaleString(this.currentLang)}\n`;
        text += `${this.t('totalConversations')}: ${conversations.length}\n`;
        text += '='.repeat(80) + '\n\n';

        conversations.forEach((conv, index) => {
            text += `\n${'='.repeat(80)}\n`;
            text += `${this.t('conversation')} #${index + 1}: ${conv.title}\n`;
            text += `${this.t('savedAt')}: ${new Date(conv.savedAt).toLocaleString(this.currentLang)}\n`;
            text += `${this.t('messageCount')}: ${conv.messageCount}\n`;
            text += `URL: ${conv.url}\n`;
            text += '='.repeat(80) + '\n\n';

            conv.messages.forEach((msg, msgIndex) => {
                const type = msg.type === 'user' ? this.t('user') : 'AI';
                text += `[${msgIndex + 1}] ${type}:\n`;
                text += `${msg.content ?? msg.text ?? ''}\n`;
                text += '-'.repeat(80) + '\n';
            });

            text += '\n';
        });

        return text;
    }
}

// אתחול כאשר הדף נטען
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});

// טיפול בשגיאות גלובליות
window.addEventListener('error', (event) => {
    console.error('Popup error:', event.error);
});

// Log לצורך דיבוג
console.log('🎮 Genspark Conversation Manager Popup v2.6 נטען');
