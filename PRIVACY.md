# Privacy Policy — Genspark Conversation Manager

Last updated: November 1, 2026

## Local processing

The extension extracts conversations from Genspark pages when you use its features.
Saved conversations and interface preferences stay in Chrome storage on your device.
There are no analytics, tracking services, or uploads of your conversations to an extension-operated server.

## Image downloads

When you export Markdown with images, the extension requests the image URLs found in that conversation. These requests go to Genspark or the image's hosting service, which receives the request and ordinary network information such as your IP address. Genspark requests may use your existing login cookies, subject to Chrome's cookie policies; requests to other image hosts omit credentials.

For the current conversation's Markdown export, the extension opens a dedicated save page. You choose a folder with Chrome's File System Access picker and grant write access. Markdown and images are then written directly under that chosen folder. A structured directory handle is stored in the extension's IndexedDB, with the folder's display name and mode in local storage, so the choice can be reused. Chrome may require permission again. Absolute filesystem paths are not collected through a text field. The page checks for existing files and chooses a new bundle name instead of overwriting them.

You can forget the remembered folder, choose another one, or explicitly switch to ordinary Downloads saving. Forgetting a handle does not revoke Chrome's permission by itself and does not remove files. Existing active save tabs must be closed to stop their writes. Legacy Downloads mode, JSON/TXT, diagnostics, and saved-conversation bulk exports still use Chrome's downloads API. The legacy mode records local export-name reservations. Uninstalling the extension does not delete files already written.

## Permissions

- **storage**: Save preferences, conversations, and export-name reservations locally. Existing background settings also use Chrome's sync storage and may follow your browser's sync settings; conversation bodies are stored in local storage.
- **downloads**: Save Markdown and images and check completion, interruptions, and filename collisions.
- **activeTab / scripting**: Read the selected Genspark conversation and inject the extractor when necessary.
- **tabs**: Locate Genspark tabs and open saved conversation links or the dedicated folder-settings/save page.
- **Folder write permission**: Granted separately through Chrome's native folder picker and permission prompts. The extension only writes into the chosen directory; it does not gain unrestricted filesystem access.
- **HTTP/HTTPS host access**: Fetch images from the hosts used by a conversation, including external image CDNs. Automatic content-script injection remains restricted to Genspark pages; the extension does not crawl other websites or upload conversation data. Exporting an image can contact its host, so only export conversations and image links you trust.

## Temporary export jobs

Conversation data is handed from the content script to the dedicated save page through Chrome's session storage (not sync storage). On a completed save, the source conversation payload is replaced with a result receipt. Pending jobs remain available for retry during the browser session; jobs older than 24 hours are pruned when another export is opened. Session data is cleared by Chrome when the browser session ends. No export job is sent to an extension-operated server.

## Diagnostic files

The optional extraction diagnostic contains the page URL, DOM structure, short conversation text samples, frame information, image URLs, the browser user agent, and the most recent export result/errors (which can include download paths). Signed image URLs may grant access to private images. Diagnostics are downloaded locally, not automatically transmitted. Review them before sharing. Scripts, input field values, and inline base64 image data are excluded.

## Your controls

You can delete saved conversations, change the interface language, revoke the extension's site access, or uninstall the extension. Revoking image-host access can prevent images from downloading; failed images retain their original links in the Markdown and a warning is shown.

Issues: https://github.com/Kitagawa65536/genspark-conversation-toolbox/issues
