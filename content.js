/**
 * Genspark Conversation Manager v2.6 - Content Script
 * ניהול מתקדם של שיחות Genspark - הורדה, חיפוש, שמירה וניהול שיחות
 */

class GensparkRTLToolbox {
    constructor() {
        this.isInitialized = false;
        this.conversations = [];

        // סלקטורים מתוקנים עבור Genspark
        this.selectors = {
            // ממשק עיקרי
            mainContent: 'main, [role="main"], .main-content, #main-content',
            chatContainer: '.chat-container, .conversation-container, .messages-container, [data-testid="chat-container"]',

            // הודעות משתמש ו-AI
            userMessage: [
                '.wb-msg-user-row',
                '.conversation-item-desc.user',
                '.conversation-statement.user',
                '[data-testid="user-message"]',
                '.user-message',
                '[role="user"]',
                '.message[data-role="user"]',
                '.message.user',
                '.user-bubble',
                'div[data-message-type="user"]'
            ],

            assistantMessage: [
                '.sas-asst-msg',
                '.wb-asst-block',
                '.conversation-item-desc.assistant',
                '.conversation-item-desc.ai',
                '.conversation-statement.assistant',
                '[data-testid="assistant-message"]', 
                '[data-testid="ai-message"]',
                '.assistant-message',
                '.ai-message',
                '[role="assistant"]',
                '.message[data-role="assistant"]',
                '.message.assistant',
                '.ai-bubble',
                'div[data-message-type="assistant"]',
                'div[data-message-type="ai"]'
            ],

            messageContent: [
                '.message-content',
                '[data-testid="message-content"]',
                '.content',
                '.text-content',
                'p, span, div[class*="text"]'
            ],

            // כותרות ומידע נוסף
            chatTitle: [
                'h1',
                '.chat-title',
                '[data-testid="chat-title"]',
                '.conversation-title',
                'header h1, header h2',
                '.title'
            ],

            timestamp: [
                '.timestamp',
                '[data-testid="timestamp"]',
                '.message-time',
                '.time',
                'time'
            ]
        };

        this.init();
    }

    async init() {
        if (this.isInitialized) return;

        console.log('🚀 Genspark Conversation Manager v2.6 מתחיל...');

        // המתן לטעינת הדף
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }

        this.isInitialized = true;
    }

    setup() {
        this.setupMessageListeners();
        this.observeChanges();

        console.log('✅ Genspark Conversation Manager v2.6 הופעל בהצלחה');
    }

    // זיהוי הודעות עם סלקטורים מרובים
    findElements(selectorList, parent = document) {
        const elements = [];

        if (Array.isArray(selectorList)) {
            for (const selector of selectorList) {
                try {
                    const found = parent.querySelectorAll(selector);
                    elements.push(...found);
                } catch (e) {
                    console.warn(`Selector failed: ${selector}`, e);
                }
            }
        } else {
            try {
                const found = parent.querySelectorAll(selectorList);
                elements.push(...found);
            } catch (e) {
                console.warn(`Selector failed: ${selectorList}`, e);
            }
        }

        // הסרת כפילויות
        return [...new Set(elements)];
    }

    getMessageEntries() {
        const candidates = [
            ...this.findElements(this.selectors.userMessage).map(element => ({ element, type: 'user' })),
            ...this.findElements(this.selectors.assistantMessage).map(element => ({ element, type: 'assistant' }))
        ];

        // A message may match several selectors at different nesting levels.
        // Keep the outer message container, not its matching descendants.
        const entries = candidates.filter((entry, index) => !candidates.some((other, otherIndex) =>
            otherIndex !== index && other.type === entry.type && other.element !== entry.element &&
            other.element.contains(entry.element)
        ));
        entries.sort((a, b) => {
            const position = a.element.compareDocumentPosition(b.element);
            return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0;
        });

        return entries.map(({ element, type }, index) => ({
            element,
            message: {
                type,
                content: this.extractMessageContent(element, type),
                markdown: this.extractMessageMarkdown(element, type),
                timestamp: this.extractTimestamp(element),
                order: index,
                index
            }
        })).filter(entry => entry.message.content);
    }

    extractConversation() {
        return this.getMessageEntries().map(entry => entry.message);
    }

    getExtractionDiagnostics() {
        const limits = { nodes: 12000, depth: 80, textLength: 300 };
        const state = { nodes: 0, truncated: false };
        // Capture structure and short text samples, not scripts, form values or
        // arbitrary data attributes (which may contain application state).
        const attributes = ['id', 'class', 'role', 'data-testid', 'data-role', 'data-message-type', 'data-message-author-role'];
        const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'INPUT', 'TEXTAREA', 'SELECT', 'SVG']);
        const selectors = [...this.selectors.userMessage, ...this.selectors.assistantMessage,
            '.markdown-viewer', '.markdown-body', 'iframe'];
        const frames = [];
        const visit = (node, depth) => {
            if (state.nodes >= limits.nodes || depth > limits.depth) {
                state.truncated = true;
                return null;
            }
            state.nodes++;
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                return text ? { text: text.slice(0, limits.textLength), truncated: text.length > limits.textLength } : null;
            }
            if (node.nodeType !== Node.ELEMENT_NODE || skipTags.has(node.tagName)) return null;
            const result = { tag: node.tagName.toLowerCase() };
            for (const name of attributes) {
                const value = node.getAttribute(name);
                if (value) result[name] = value.slice(0, 500);
            }
            const children = [];
            for (const child of node.childNodes) {
                if (state.nodes >= limits.nodes) {
                    state.truncated = true;
                    break;
                }
                const captured = visit(child, depth + 1);
                if (captured) children.push(captured);
            }
            if (children.length) result.children = children;
            if (node.shadowRoot) {
                result.shadowRoot = Array.from(node.shadowRoot.children, child => visit(child, depth + 1)).filter(Boolean);
            }
            if (node.tagName === 'IFRAME') {
                const frame = { src: node.getAttribute('src') || '', accessible: false };
                frames.push(frame);
                try {
                    const frameDocument = node.contentDocument;
                    if (frameDocument?.body) {
                        frame.accessible = true;
                        frame.selectorCounts = countSelectors(frameDocument);
                        result.frameBody = visit(frameDocument.body, depth + 1);
                    }
                } catch {
                    // A cross-origin frame is reported but cannot be inspected.
                }
            }
            return result;
        };
        const countSelectors = root => Object.fromEntries(selectors.map(selector => [selector, root.querySelectorAll(selector).length]));
        const selectorCounts = countSelectors(document);
        const structure = document.body ? visit(document.body, 0) : null;
        return {
            schemaVersion: 1,
            extensionVersion: chrome.runtime.getManifest().version,
            extractorRevision: 'dom-4-md',
            capturedAt: new Date().toISOString(),
            url: window.location.href,
            title: document.title,
            readyState: document.readyState,
            extractedMessageCount: this.extractConversation().length,
            selectorCounts,
            frames,
            limits,
            visitedNodes: state.nodes,
            truncated: state.truncated,
            structure
        };
    }

    // חילוץ תוכן מהודעה בודדת
    extractMessageContent(messageElement, type) {
        const selectors = type === 'user'
            ? ['.wb-msg-user-text', '.content code', '[data-testid="message-content"]', '.message-content', '.content', '.text-content']
            : ['.markdown-viewer', '.markdown-body', '[data-testid="message-content"]', '.message-content', '.content', '.text-content'];
        for (const selector of selectors) {
            const element = messageElement.querySelector(selector);
            const text = element && (element.innerText || element.textContent || '').trim();
            if (text) return text;
        }
        return this.filterUIElements(messageElement.innerText || messageElement.textContent || '').trim();
    }

    extractMessageMarkdown(messageElement, type) {
        // User prompts are plain text, not rendered Markdown. Do not reinterpret
        // the prompt's code or Markdown punctuation while exporting it.
        if (type === 'user' || !globalThis.GensparkMarkdown) return this.extractMessageContent(messageElement, type);
        for (const selector of ['.markdown-viewer', '.markdown-body', '[data-testid="message-content"]', '.message-content', '.content', '.text-content']) {
            const roots = Array.from(messageElement.querySelectorAll(selector));
            const outer = roots.filter(element => !roots.some(other => other !== element && other.contains(element)));
            const parts = outer.map(element => GensparkMarkdown.fromElement(element)).filter(Boolean);
            if (parts.length) return parts.join('\n\n');
        }
        return GensparkMarkdown.fromElement(messageElement) || this.extractMessageContent(messageElement, type);
    }

    // סינון אלמנטי ממשק
    filterUIElements(text) {
        const uiPatterns = [
            /^(copy|העתק|שתף|share|like|אהבתי|download|הורד|reply|השב)$/i,
            /^\d+\s*(likes?|אהבות?)$/i,
            /^(\d{1,2}:\d{2}|\d{1,2}:\d{2}:\d{2})$/,
            /^(today|היום|yesterday|אתמול)$/i,
            /^[\s\n]*$/
        ];

        const lines = text.split('\n').filter(line => {
            const cleaned = line.trim();
            if (!cleaned) return false;

            return !uiPatterns.some(pattern => pattern.test(cleaned));
        });

        return lines.join('\n');
    }

    // חילוץ זמן
    extractTimestamp(element) {
        const timestampElements = this.findElements(this.selectors.timestamp, element);

        if (timestampElements.length > 0) {
            return timestampElements[0].textContent || timestampElements[0].getAttribute('datetime') || '';
        }

        return new Date().toISOString();
    }

    // קבלת סדר האלמנט בדף
    getElementOrder(element) {
        const rect = element.getBoundingClientRect();
        return rect.top + (rect.left * 0.001); // מיון לפי מיקום בדף
    }

    // הורדת השיחה
    async downloadConversation(format = 'md', language = 'en', labels = {}) {
        try {
            const conversations = this.extractConversation();

            if (conversations.length === 0) {
                return { success: false, errorCode: 'noMessages' };
            }

            const title = this.getPageTitle();
            const timestamp = new Date().toISOString().split('T')[0];

            if (format === 'md') {
                await this.downloadMarkdown(conversations);
            }

            if (format === 'json' || format === 'both') {
                await this.downloadJSON(conversations, `${title}_${timestamp}.json`);
            }

            if (format === 'txt' || format === 'both') {
                await this.downloadTXT(conversations, `${title}_${timestamp}.txt`, language, labels);
            }

            console.log(`✅ השיחה הורדה בהצלחה (${conversations.length} הודעות)`);
            return { success: true };

        } catch (error) {
            console.error('❌ שגיאה בהורדת השיחה:', error);
            return { success: false, errorCode: 'downloadError' };
        }
    }

    async downloadMarkdown(conversations) {
        const title = this.getPageTitle();
        const content = GensparkMarkdown.renderConversation({ title, url: window.location.href, messages: conversations });
        this.downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), GensparkMarkdown.filename(title));
    }

    async downloadJSON(conversations, filename) {
        const data = {
            title: this.getPageTitle(),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            messageCount: conversations.length,
            conversations: conversations
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json;charset=utf-8'
        });

        this.downloadBlob(blob, filename);
    }

    async downloadTXT(conversations, filename, language = 'en', labels = {}) {
        let content = `${labels.conversation || 'Conversation'} - Genspark.ai\n`;
        content += `${labels.title || 'Title'}: ${this.getPageTitle()}\n`;
        content += `URL: ${window.location.href}\n`;
        content += `${labels.date || 'Date'}: ${new Date().toLocaleString(language)}\n`;
        content += `${labels.messageCount || 'Message count'}: ${conversations.length}\n`;
        content += `${'='.repeat(50)}\n\n`;

        conversations.forEach((msg, index) => {
            const speaker = msg.type === 'user' ? `👤 ${labels.user || 'User'}` : '🤖 AI';
            content += `${speaker} (${index + 1}):\n`;
            content += `${msg.content}\n\n`;
            content += `${'-'.repeat(30)}\n\n`;
        });

        const blob = new Blob([content], {
            type: 'text/plain;charset=utf-8'
        });

        this.downloadBlob(blob, filename);
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getPageTitle() {
        // Global h1/.title selectors also match the sidebar's "Home" label.
        // The browser title contains the actual conversation title on SAS v2.
        const generic = /^(?:genspark(?:\.ai)?|home|ホーム|דף הבית)$/i;
        const pageTitle = (document.title || '').replace(/\s*[-|–—]\s*Genspark(?:\.ai)?\s*$/i, '').trim();
        if (pageTitle && !generic.test(pageTitle)) return pageTitle;
        const scope = document.querySelector('main, [role="main"], .conversation-wrapper, .chat-wrapper');
        if (scope) {
            for (const element of this.findElements(this.selectors.chatTitle, scope)) {
                const title = (element.textContent || '').trim();
                if (title && !generic.test(title)) return title;
            }
        }
        const first = this.getMessageEntries().find(entry => entry.message.type === 'user')?.message.content;
        return first ? first.replace(/\s+/g, ' ').slice(0, 80) : 'Genspark conversation';
    }

    // חיפוש בשיחות (בשיחה הנוכחית)
    searchConversation(query) {
        if (!query || query.trim() === '') {
            return [];
        }

        const conversations = this.extractConversation();
        const searchQuery = query.toLowerCase().trim();
        const results = [];

        conversations.forEach((msg, index) => {
            const content = msg.content.toLowerCase();

            if (content.includes(searchQuery)) {
                // מצא את המיקום של המילה
                const startIndex = content.indexOf(searchQuery);

                // קח קטע מסביב למילה (50 תווים לפני ואחרי)
                const start = Math.max(0, startIndex - 50);
                const end = Math.min(msg.content.length, startIndex + searchQuery.length + 50);
                let snippet = msg.content.substring(start, end);

                // הוסף ... אם יש עוד טקסט
                if (start > 0) snippet = '...' + snippet;
                if (end < msg.content.length) snippet = snippet + '...';

                results.push({
                    index: index,
                    type: msg.type,
                    content: msg.content,
                    snippet: snippet,
                    matchPosition: startIndex
                });
            }
        });

        console.log(`🔍 נמצאו ${results.length} תוצאות עבור: "${query}"`);
        return results;
    }

    // חילוץ כל השיחות מהסיידבר
    extractAllConversations() {
        console.log('📋 מחלץ כל השיחות מהסיידבר...');

        const conversations = [];

        // סלקטורים לאיתור פריטי תפריט בסיידבר
        const sidebarSelectors = [
            '.menu-item',
            '[class*="menu-item"]',
            '[class*="conversation-item"]',
            '[class*="chat-item"]',
            'li[role="menuitem"]',
            '.sidebar-item',
            '[data-conversation-id]'
        ];

        let menuItems = [];

        // נסה למצוא פריטי תפריט
        for (const selector of sidebarSelectors) {
            try {
                const items = document.querySelectorAll(selector);
                if (items.length > 0) {
                    menuItems = Array.from(items);
                    console.log(`✅ נמצאו ${items.length} פריטים עם הסלקטור: ${selector}`);
                    break;
                }
            } catch (e) {
                console.warn(`Selector failed: ${selector}`, e);
            }
        }

        // אם לא נמצא, חפש בצורה יותר כללית
        if (menuItems.length === 0) {
            console.log('🔍 מחפש פריטים בדרך כללית...');
            const sidebar = document.querySelector('aside, [role="navigation"], .sidebar, nav');
            if (sidebar) {
                menuItems = Array.from(sidebar.querySelectorAll('li, div[role="button"], a'));
                console.log(`📌 נמצאו ${menuItems.length} פריטים פוטנציאליים בסיידבר`);
            }
        }

        menuItems.forEach((item, index) => {
            try {
                // חלץ טקסט
                const text = item.textContent || item.innerText || '';

                // דלג על פריטים ריקים או קצרים מדי
                if (text.trim().length < 3) return;

                // נסה לחלץ כותרת
                const titleElement = item.querySelector('h1, h2, h3, h4, h5, h6, .title, [class*="title"], strong, b');
                const title = titleElement ? titleElement.textContent.trim() : text.split('\n')[0].trim();

                // נסה לחלץ תאריך
                const dateElement = item.querySelector('time, .date, [class*="date"], [class*="time"], small');
                const date = dateElement ? dateElement.textContent.trim() : '';

                // נסה לחלץ URL או ID
                const link = item.querySelector('a');
                const url = link ? link.href : '';
                const id = item.getAttribute('data-conversation-id') ||
                          item.getAttribute('data-id') ||
                          item.id ||
                          `item-${index}`;

                // שמור את האלמנט DOM למטרת ניווט
                conversations.push({
                    id: id,
                    title: title,
                    date: date,
                    fullText: text.trim(),
                    url: url,
                    element: item,
                    index: index
                });

            } catch (e) {
                console.warn('שגיאה בעיבוד פריט:', e);
            }
        });

        console.log(`✅ חולצו ${conversations.length} שיחות מהסיידבר`);
        return conversations;
    }

    // חיפוש חכם בכל השיחות (סיידבר)
    searchAllConversations(query) {
        if (!query || query.trim() === '') {
            return [];
        }

        const allConversations = this.extractAllConversations();
        const searchQuery = query.toLowerCase().trim();
        const results = [];

        // פונקצית התאמה גמישה
        const fuzzyMatch = (text, query) => {
            const lowerText = text.toLowerCase();

            // התאמה מדויקת
            if (lowerText.includes(query)) {
                return { match: true, score: 100, exactMatch: true };
            }

            // התאמה חלקית - מילים נפרדות
            const queryWords = query.split(/\s+/);
            const matchedWords = queryWords.filter(word =>
                lowerText.includes(word) && word.length > 2
            );

            if (matchedWords.length > 0) {
                const score = (matchedWords.length / queryWords.length) * 80;
                return { match: true, score: score, exactMatch: false };
            }

            // התאמה fuzzy - אותיות סמוכות
            let matchScore = 0;
            let lastIndex = -1;

            for (const char of query) {
                const index = lowerText.indexOf(char, lastIndex + 1);
                if (index > lastIndex) {
                    matchScore++;
                    lastIndex = index;
                }
            }

            const fuzzyScore = (matchScore / query.length) * 60;
            if (fuzzyScore > 40) {
                return { match: true, score: fuzzyScore, exactMatch: false };
            }

            return { match: false, score: 0 };
        };

        allConversations.forEach((conversation) => {
            // חפש בכותרת
            const titleMatch = fuzzyMatch(conversation.title, searchQuery);

            // חפש בטקסט המלא
            const textMatch = fuzzyMatch(conversation.fullText, searchQuery);

            // קח את ההתאמה הטובה ביותר
            const bestMatch = titleMatch.score > textMatch.score ? titleMatch : textMatch;

            if (bestMatch.match) {
                // צור snippet עם הקשר
                let snippet = '';
                const lowerFullText = conversation.fullText.toLowerCase();
                const matchIndex = lowerFullText.indexOf(searchQuery);

                if (matchIndex !== -1) {
                    const start = Math.max(0, matchIndex - 40);
                    const end = Math.min(conversation.fullText.length, matchIndex + searchQuery.length + 40);
                    snippet = conversation.fullText.substring(start, end);

                    if (start > 0) snippet = '...' + snippet;
                    if (end < conversation.fullText.length) snippet = snippet + '...';
                } else {
                    // אם אין התאמה מדויקת, קח את ההתחלה
                    snippet = conversation.title;
                }

                results.push({
                    ...conversation,
                    snippet: snippet,
                    matchScore: bestMatch.score,
                    exactMatch: bestMatch.exactMatch,
                    matchedIn: titleMatch.score > textMatch.score ? 'title' : 'content'
                });
            }
        });

        // מיין לפי ציון התאמה
        results.sort((a, b) => b.matchScore - a.matchScore);

        console.log(`🔍 נמצאו ${results.length} שיחות עבור: "${query}"`);
        return results;
    }

    // ניווט לשיחה בסיידבר
    navigateToConversation(conversationId) {
        const allConversations = this.extractAllConversations();
        const conversation = allConversations.find(c => c.id === conversationId);

        if (!conversation || !conversation.element) {
            console.error('❌ לא נמצאה שיחה עם ID:', conversationId);
            return;
        }

        // גלול לשיחה בסיידבר
        conversation.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // הדגש את השיחה
        const originalBg = conversation.element.style.backgroundColor;
        const originalBorder = conversation.element.style.border;

        conversation.element.style.transition = 'all 0.3s';
        conversation.element.style.backgroundColor = '#fff3cd';
        conversation.element.style.border = '2px solid #667eea';

        setTimeout(() => {
            conversation.element.style.backgroundColor = originalBg;
            conversation.element.style.border = originalBorder;
        }, 2000);

        // אם יש לינק, לחץ עליו לפתיחת השיחה
        const link = conversation.element.querySelector('a');
        if (link) {
            setTimeout(() => {
                link.click();
                console.log('✅ נווטתי לשיחה:', conversation.title);
            }, 500);
        }
    }

    // הדגשת הודעה בדף (בשיחה הנוכחית)
    highlightMessage(messageIndex) {
        const entries = this.getMessageEntries();

        if (messageIndex < 0 || messageIndex >= entries.length) {
            console.error('אינדקס הודעה לא תקין:', messageIndex);
            return;
        }

        if (entries[messageIndex]) {
            const element = entries[messageIndex].element;

            // גלול אל ההודעה
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // הוסף הדגשה זמנית
            element.style.transition = 'background-color 0.3s';
            const originalBg = element.style.backgroundColor;
            element.style.backgroundColor = '#fff3cd';

            setTimeout(() => {
                element.style.backgroundColor = originalBg;
            }, 2000);

            console.log('✅ הודעה הודגשה בהצלחה');
        }
    }

    // מאזין לשינויים בדף
    observeChanges() {
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldUpdate = true;
                }
            });

            // שינויים נוספים יכולים להתווסף כאן במידת הצורך
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    setupMessageListeners() {
        // מאזין להודעות מהפופאפ ומהbackground
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('📨 הודעה התקבלה:', request);

            switch (request.action) {
                case 'ping':
                    sendResponse({ status: 'active', version: chrome.runtime.getManifest().version, extractorRevision: 'dom-4-md' });
                    break;

                case 'getExtractionDiagnostics':
                    try {
                        sendResponse({ success: true, diagnostics: this.getExtractionDiagnostics() });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'download':
                    this.downloadConversation(request.format || 'md', request.language, request.labels)
                        .then(sendResponse)
                        .catch(() => sendResponse({ success: false, errorCode: 'downloadError' }));
                    return true;

                case 'getStats':
                    const conversations = this.extractConversation();
                    sendResponse({
                        messageCount: conversations.length
                    });
                    break;

                case 'search':
                    const searchResults = this.searchConversation(request.query);
                    sendResponse({
                        success: true,
                        results: searchResults
                    });
                    break;

                case 'searchAll':
                    const allResults = this.searchAllConversations(request.query);
                    sendResponse({
                        success: true,
                        results: allResults
                    });
                    break;

                case 'navigateToConversation':
                    this.navigateToConversation(request.conversationId);
                    sendResponse({ success: true });
                    break;

                case 'getAllConversations':
                    const allConversations = this.extractAllConversations();
                    sendResponse({
                        success: true,
                        count: allConversations.length,
                        conversations: allConversations.map(c => ({
                            id: c.id,
                            title: c.title,
                            date: c.date
                        }))
                    });
                    break;

                case 'saveConversation':
                    this.saveCurrentConversation()
                        .then(result => sendResponse(result))
                        .catch(error => sendResponse({ success: false, errorCode: error.message === 'NO_MESSAGES' ? 'noMessages' : 'saveError' }));
                    return true; // Keep connection open for async response
                    break;

                case 'highlightMessage':
                    this.highlightMessage(request.index);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }

            return true; // שמור על החיבור עבור תגובה אסינכרונית
        });
    }

    async saveCurrentConversation() {
        try {
            console.log('💾 שומר שיחה נוכחית...');

            // חלץ את השיחה הנוכחית
            const messages = this.extractConversation();

            if (!messages || messages.length === 0) {
                throw new Error('NO_MESSAGES');
            }

            // צור מזהה ייחודי לשיחה
            const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // חלץ כותרת שיחה
            const title = this.getPageTitle();

            // צור אובייקט שיחה
            const conversation = {
                id: conversationId,
                title: title,
                url: window.location.href,
                savedAt: new Date().toISOString(),
                messageCount: messages.length,
                messages: messages
            };

            // שמור ב-chrome.storage.local
            const stored = await chrome.storage.local.get(['savedConversations']);
            const savedConversations = stored.savedConversations || [];

            savedConversations.push(conversation);

            await chrome.storage.local.set({ savedConversations: savedConversations });

            console.log('✅ שיחה נשמרה בהצלחה:', conversationId);

            return {
                success: true,
                conversationId: conversationId,
                messageCount: messages.length,
                title: title
            };

        } catch (error) {
            console.error('❌ שגיאה בשמירת שיחה:', error);
            throw error;
        }
    }

    getConversationTitle() {
        // נסה למצוא כותרת שיחה
        for (const selector of this.selectors.chatTitle) {
            const titleElement = document.querySelector(selector);
            if (titleElement && titleElement.textContent.trim()) {
                return titleElement.textContent.trim();
            }
        }

        // אם לא נמצא כותרת, השתמש בהודעה הראשונה
        const firstMessage = this.extractConversation()[0];
        if (firstMessage && firstMessage.text) {
            return firstMessage.text.substring(0, 50) + (firstMessage.text.length > 50 ? '...' : '');
        }

        return null;
    }
}

// אתחול התוסף
if (typeof window !== 'undefined') {
    // וודא שהתוסף לא רץ כבר
    if (!window.gensparkConversationManager) {
        window.gensparkConversationManager = new GensparkRTLToolbox();
        console.log('🎯 Genspark Conversation Manager v2.6 אותחל');
    }
}
