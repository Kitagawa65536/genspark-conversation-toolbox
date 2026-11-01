// Small read-only DOM adapter for replaying the diagnostic structure in Node.
// Supports only the class, tag, attribute and descendant selectors used by the extractor.
// Elements are nodes built from a tag; text leaves are everything else.

function diagnosticDocument(structure) {
    let order = 0;
    const isElement = node => Boolean(node) && node.nodeType === 1 && typeof node.tagName === 'string';
    const matches = (node, selector) => {
        const parts = selector.trim().split(/\s+/);
        const simple = (element, part) => {
            if (!isElement(element)) return false;
            if (part.startsWith('.')) {
                const classes = (element.getAttribute('class') || '').split(/\s+/);
                return part.slice(1).split('.').every(name => classes.includes(name));
            }
            const attribute = part.match(/^(\w+)?\[([\w-]+)="([^"]*)"\]$/);
            if (attribute) return (!attribute[1] || element.tagName.toLowerCase() === attribute[1]) &&
                element.getAttribute(attribute[2]) === attribute[3];
            return /^[\w-]+$/.test(part) && element.tagName.toLowerCase() === part;
        };
        if (!simple(node, parts.pop())) return false;
        let ancestor = node.parentNode;
        while (parts.length) {
            const part = parts.pop();
            while (ancestor && !simple(ancestor, part)) ancestor = ancestor.parentNode;
            if (!ancestor) return false;
            ancestor = ancestor.parentNode;
        }
        return true;
    };
    function build(data, parentNode = null) {
        const node = {
            nodeType: data.tag ? 1 : 3,
            tagName: data.tag?.toUpperCase(),
            parentNode, order: order++, childNodes: [],
            getAttribute(name) { return data[name] || null; },
            // Spec shape: a.contains(b) asks whether `a` contains `b`.
            contains(other) {
                if (!isElement(other)) return false;
                const descends = (current, target) => current === target ||
                    (isElement(current) && current.childNodes.some(child => descends(child, target)));
                return descends(this, other);
            },
            // DOM spec: the *argument* is DOCUMENT_POSITION_FOLLOWING (4) when it
            // comes later in the document, PRECEDING (2) when it comes first.
            compareDocumentPosition(other) { return this.order < other.order ? 4 : this.order > other.order ? 2 : 0; },
            // Turns are ordered by document position; distinct values make the
            // fixture behave like the live page.
            getBoundingClientRect() { return { top: this.order, left: 0, width: 0, height: 0 }; },
            // A comma-separated list is a union of selectors, as in the DOM.
            querySelectorAll(selector) {
                const parts = String(selector).split(',').map(part => part.trim()).filter(Boolean);
                const result = [];
                const visit = current => {
                    // Text nodes have no children and never match selectors.
                    for (const child of current.childNodes) {
                        if (!isElement(child)) continue;
                        if (parts.some(part => matches(child, part)) && !result.includes(child)) result.push(child);
                        visit(child);
                    }
                };
                if (!isElement(this)) return result;
                visit(this);
                return result;
            },
            querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
            closest(selector) {
                const parts = String(selector).split(',').map(part => part.trim()).filter(Boolean);
                for (let current = this; current; current = current.parentNode) {
                    if (isElement(current) && parts.some(part => matches(current, part))) return current;
                }
                return null;
            },
            get textContent() { return data.tag ? this.childNodes.map(child => child.textContent).join('') : data.text || ''; },
            get innerText() { return this.textContent; }
        };
        node.childNodes = (data.children || []).map(child => build(child, node));
        return node;
    }
    const body = build(structure);
    return {
        body, readyState: 'loading', title: 'Test conversation', addEventListener() {},
        querySelectorAll: selector => body.querySelectorAll(selector),
        querySelector: selector => body.querySelector(selector)
    };
}
module.exports = { diagnosticDocument };
