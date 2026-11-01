# Changelog

All notable changes to Genspark Conversation Manager.

## [2.6.3 fork] - 2026-11-01

- Choose an arbitrary Markdown export directory in a dedicated page and remember its File System Access handle in IndexedDB; request renewed permission only on user action.
- Save Markdown and sibling images directly beneath the chosen directory without per-file download dialogs; retain explicit legacy Downloads mode.
- Share the existing image/Markdown engine between worker downloads and direct directory writes. Check on-disk name collisions, await file close, and serialize extension-tab exports with Web Locks.
- Keep transient jobs in session storage, release source payloads after success, and prevent duplicate writes on completed-page reload. Expose save-page results in extraction diagnostics.
- Add directory storage/writer/page/routing tests and real-Chrome OPFS handle persistence/write/reload smoke coverage; native OS picker interaction is not automated.

## [2.6.2 fork] - 2026-11-01

- Preserve the actual download exception in the popup instead of replacing it with a generic error; keep failures visible.
- Include the last export result/errors and browser user agent in optional extraction diagnostics.
- Add an opt-in isolated real-Chrome messaging/download/filesystem smoke test. Network data is substituted; authenticated Genspark requests and the reported user's failure remain unconfirmed.

## [2.6.1 fork] - 2026-11-01

- Match reference exports: sibling `<date>-<title>.md` and `<date>-<title>-assets/images/`, with a Generated images appendix and original links.
- Extract component-rendered illustrations without model icons, tool controls, duplicate previews, or missing answer blocks; retain input-reference links.
- Determine image extensions from file bytes, wait for actual download completion, and retain remote links on failure.
- Reserve collision-safe names for whole bundles and bound service-worker download time; no arbitrary absolute vault writes.
- Restore Japanese UI controls and remove unfinished archive/ZIP/vault additions from this repair.
- Add sanitized supplied-diagnostic replay and mocked download-failure/completion regression tests. Live Chrome verification remains necessary.

## [3.0] - 2026-01-12 (Pending Release)

### Added
- Folder manager with sidebar integration
- Full English/Hebrew UI translation (200+ strings)
- Quick vs Full download modes
- Bulk folder operations
- Sidebar folder button injection

### Changed
- Improved download UX
- Better RTL/LTR handling
- Simplified i18n architecture with data-i18n attributes

## [2.9] - 2025-12

### Added
- Initial folder system
- Hebrew language support

## [2.8] - 2025-12

### Added
- Tab-based extraction for reliable full content
- ZIP download for all sidebar conversations
- Full vs Quick extraction modes

### Fixed
- Content extraction reliability
- Memory issues with large conversations

## [2.7] - 2025-11

### Added
- Bulk download all sidebar conversations
- Progress indicators for batch operations

## [2.0] - 2025-10

### Added
- Search functionality
- Local storage for saved conversations
- JSON and TXT export formats

## [1.0] - 2025-09

### Added
- Initial release
- Basic conversation download
- Popup interface
