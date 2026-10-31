// Small read-only DOM adapter for replaying the diagnostic structure in Node.
// Supports only the class, tag, attribute and descendant selectors used by the extractor.
function diagnosticDocument(structure) {
    let order = 0;
    const matches = (node, selector) => {
        const parts = selector.trim().split(/\s+/);
        const simple = (element, part) => {
            if (!element || element.nodeType !== 1) return false;
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
            contains(other) {
                for (let current = other; current; current = current.parentNode) if (current === this) return true;
                return false;
            },
            compareDocumentPosition(other) { return this.order < other.order ? 4 : this.order > other.order ? 2 : 0; },
            querySelectorAll(selector) {
                const result = [];
                const visit = current => {
                    for (const child of current.childNodes) {
                        if (selector.split(',').some(part => matches(child, part))) result.push(child);
                        visit(child);
                    }
                };
                visit(this);
                return result;
            },
            querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
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
