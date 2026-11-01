/* Shared Markdown export for the content script and popup. No remote dependencies. */
(function (root) {
    'use strict';
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'BUTTON', 'SVG', 'INPUT', 'TEXTAREA', 'SELECT']);
    const escapeText = text => String(text).replace(/\s+/g, ' ').replace(/([\\`*_[\]<>])/g, '\\$1');
    const children = node => Array.from(node.childNodes || []);
    const tag = node => (node.tagName || '').toUpperCase();
    const attr = (node, name) => node.getAttribute?.(name) || '';
    const clean = text => text.trim();
    function safeUrl(value, base) {
        if (!value) return '';
        try {
            const url = new URL(value, base);
            if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) return '';
            return url.href.replace(/[<>\s()]/g, character => encodeURIComponent(character));
        } catch { return ''; }
    }
    function fromElement(element, base = root.location?.href || 'https://www.genspark.ai/') {
        function render(node) {
            if (node.nodeType === 3) return escapeText(node.textContent || '');
            const name = tag(node);
            if (skipTags.has(name) || attr(node, 'aria-hidden') === 'true' ||
                /(?:^|\s)(?:using-tool-call|inline-component|model-label|edit-buttons-wrapper)(?:\s|$)/.test(attr(node, 'class'))) return '';
            const inside = () => children(node).map(render).join('');
            if (name === 'BR') return '\n';
            if (name === 'HR') return '\n\n---\n\n';
            if (name === 'PRE') {
                const code = node.querySelector('code') || node;
                const value = (code.textContent || '').replace(/\n$/, '');
                const runs = value.match(/`+/g) || [];
                const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
                const language = (attr(code, 'class').match(/(?:^|\s)language-([\w+-]+)/) || [])[1] || '';
                return `\n\n${fence}${language}\n${value}\n${fence}\n\n`;
            }
            if (name === 'CODE') {
                const value = (node.textContent || '').replace(/\n/g, ' ');
                const fence = '`'.repeat(Math.max(1, ...(value.match(/`+/g) || []).map(run => run.length + 1)));
                const pad = /^`|`$|^ .* $/.test(value) ? ' ' : '';
                return `${fence}${pad}${value}${pad}${fence}`;
            }
            if (name === 'STRONG' || name === 'B') return `**${inside().trim()}**`;
            if (name === 'EM' || name === 'I') return `*${inside().trim()}*`;
            if (name === 'DEL' || name === 'S') return `~~${inside().trim()}~~`;
            if (name === 'A') {
                const label = inside().trim();
                const href = safeUrl(attr(node, 'href'), base);
                return href ? `[${label || href}](<${href}>)` : label;
            }
            if (name === 'IMG') {
                // Prefer the full-resolution source when Genspark serves a thumbnail.
                const src = safeUrl(attr(node, 'data-src') || attr(node, 'data-original') || attr(node, 'src'), base);
                return src ? `![${escapeText(attr(node, 'alt'))}](<${src}>)` : escapeText(attr(node, 'alt'));
            }
            if (/^H[1-6]$/.test(name)) return `\n\n${'#'.repeat(Number(name[1]))} ${inside().trim()}\n\n`;
            if (name === 'BLOCKQUOTE') return `\n\n${clean(inside()).split('\n').map(line => `> ${line}`).join('\n')}\n\n`;
            if (name === 'UL' || name === 'OL') {
                const start = Number.parseInt(attr(node, 'start'), 10) || 1;
                const items = children(node).filter(child => tag(child) === 'LI');
                return '\n\n' + items.map((item, index) => {
                    const marker = name === 'OL' ? `${start + index}. ` : '- ';
                    const value = clean(children(item).map(render).join(''));
                    return marker + value.replace(/\n/g, '\n' + ' '.repeat(marker.length));
                }).join('\n') + '\n\n';
            }
            if (name === 'TABLE') {
                const rows = [];
                const collect = current => {
                    for (const child of children(current)) {
                        if (tag(child) === 'TR') rows.push(child);
                        else if (['THEAD', 'TBODY', 'TFOOT'].includes(tag(child))) collect(child);
                    }
                };
                collect(node);
                const cells = rows.map(row => children(row).filter(cell => ['TH', 'TD'].includes(tag(cell)))
                    .map(cell => clean(children(cell).map(render).join('')).replace(/\|/g, '\\|').replace(/\n+/g, '<br>')));
                if (!cells.length) return '';
                const width = Math.max(...cells.map(row => row.length));
                const line = row => '| ' + Array.from({ length: width }, (_, index) => row[index] || '').join(' | ') + ' |';
                return '\n\n' + [line(cells[0]), line(Array(width).fill('---')), ...cells.slice(1).map(line)].join('\n') + '\n\n';
            }
            if (['P', 'DIV', 'SECTION', 'ARTICLE', 'FIGURE', 'FIGCAPTION', 'DL', 'DT', 'DD'].includes(name)) {
                return '\n\n' + inside() + '\n\n';
            }
            return inside();
        }
        // Collapse wrapper spacing without changing blank lines inside fenced code.
        const output = render(element).trim();
        const fenced = /(^|\n)(`{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g;
        let result = '', cursor = 0;
        for (const match of output.matchAll(fenced)) {
            result += output.slice(cursor, match.index).replace(/\n{3,}/g, '\n\n') + match[0];
            cursor = match.index + match[0].length;
        }
        return (result + output.slice(cursor).replace(/\n{3,}/g, '\n\n')).trim();
    }
    function renderConversation({ title = 'Genspark conversation', url = '', messages = [], exportedAt = new Date().toISOString(), created = '', includeImages = true }) {
        let parsed;
        try { parsed = new URL(url); } catch { /* Old saved conversations may lack a URL. */ }
        const fields = { title, url, conversation_id: parsed?.searchParams.get('id') || '',
            source: parsed?.hostname || 'genspark.ai' };
        if (created) fields.created = created;
        fields.exported_at = exportedAt;
        const metadata = Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(String(value))}`).join('\n');
        const heading = String(title).replace(/[\r\n]+/g, ' ');
        const turns = messages.filter(message => message.markdown || message.content).map(message => `## ${message.type === 'user' ? 'You' : 'Genspark'}\n\n${message.markdown || message.content || ''}`);
        let result = `---\n${metadata}\n---\n\n# ${heading}\n\n${turns.join('\n\n')}\n`;
        // Saved-conversation exports have no live download worker. Preserve
        // their generated-image metadata as remote links rather than lose it.
        if (includeImages) {
            const images = [...new Set(messages.flatMap(message => message.images || [])
                .map(image => safeUrl(typeof image === 'string' ? image : image.url, url)).filter(source => /^https?:/.test(source)))];
            if (images.length) result += `\n### Generated images\n\n${images.map((source, index) =>
                `![generated-image-${index + 1}](<${source}>)\n\n[Open original](<${source}>)`).join('\n\n')}\n`;
        }
        return result;
    }

    const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    // Windows- and Obsidian-safe name segment: no path separators, wildcards,
    // control characters, wiki-link brackets or leading/trailing dots and spaces.
    function safeName(value, fallback = 'Genspark conversation', limit = 100) {
        const normalized = String(value || '').normalize('NFC')
            .replace(/[<>:"/\\|?*\x00-\x1f[\]#^]/g, '_').replace(/\s+/g, ' ').trim()
            .replace(/^[. ]+|[. ]+$/g, '');
        return Array.from(normalized).slice(0, limit).join('') || fallback;
    }
    function filename(title, date = new Date(), extension = 'md') {
        return `${localDate(date)}-${safeName(title, 'Genspark conversation', 160)}.${extension}`;
    }
    root.GensparkMarkdown = { fromElement, renderConversation, filename, safeName };
})(globalThis);
