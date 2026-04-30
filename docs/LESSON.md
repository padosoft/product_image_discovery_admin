# Lessons

## 2026-04-30

- `php` and `composer` are not available on PATH in this shell.
- Herd PHP is available at `%USERPROFILE%\.config\herd\bin\php84\php.exe` and was used by the neighboring package.
- Herd Composer is available at `%USERPROFILE%\.config\herd\bin\composer.bat`.
- The neighboring package already has a populated `vendor` directory with Laravel 13 framework packages.
- Creating `.agents/skills/product-image-discovery-admin-plan` was blocked by the sandbox, so the repo-local skill was created under `skills/product-image-discovery-admin-plan`.
- The plan path in Downloads can be slow or blocked to read through the sandbox; `AGENTS.md` records the path so a future session can retry or use the plan already pasted in chat.
- `composer validate --strict` rejects unbound constraints, so the path package is pinned as `padosoft/product-image-discovery: dev-main`.
- Running `npm install`, Vite, Vitest, Playwright, Composer, and Herd PHP often requires escalation because the sandbox blocks child process spawning or external binaries.
- `public/index.php` must not call `send()` after `Application::handleRequest()`, because Laravel already sends the response; double-sending caused fatal header errors in Playwright.
- Playwright WebKit was not installed locally, so the tablet smoke uses Chromium with a tablet-sized viewport.
- The candidate image wrapper should use raw provider secret columns only for booleans and must not expose decrypted or partial secrets.
- Review feedback: E2E helper scripts must not default to machine-specific Herd paths on non-Windows. Use a platform-aware default: local Herd PHP on Windows, `php` elsewhere, and still allow `PHP_BINARY` override.
- Review feedback: Admin `*_to` date filters must include the full day for date-only inputs. Convert `YYYY-MM-DD` upper bounds to `endOfDay()` and lower bounds to `startOfDay()` before querying timestamp columns.
- Review feedback: JSON rendering rules must honor configurable route prefixes. Avoid hard-coded `admin/product-image-discovery/*` checks when routes are configured through `pid-admin.route_prefix`.
- Review feedback: `NaN` scores should be treated as neutral in status mapping instead of being forced into a low-risk color.
- Review feedback: Remote image redirects must reject localhost, private, and reserved literal IP targets unless the URL is explicitly trusted.
- Review feedback: Root redirects should follow `pid-admin.route_prefix` instead of hard-coding the admin path.
- Review feedback: Use `node:path` helpers such as `join()` for portable file paths in JS helpers, rather than embedding platform-specific separators.
- React shell slice: extracting shared primitives early makes later request/detail/configuration pages cheaper to build and keeps the shell from becoming a single oversized component.
- React shell slice: `JsonViewer` should guard clipboard writes so the viewer still renders cleanly in environments where `navigator.clipboard` is missing.
- API client slice: error normalization is easier to test when the response parsing and message extraction are separated from the fetch wrapper.
