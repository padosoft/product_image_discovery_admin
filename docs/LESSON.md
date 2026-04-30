# Lessons

## 2026-04-30

- `php` and `composer` are not available on PATH in this shell.
- Herd PHP is available at `C:\Users\lopad\.config\herd\bin\php84\php.exe` and was used by the neighboring package.
- Herd Composer is available at `C:\Users\lopad\.config\herd\bin\composer.bat`.
- The neighboring package already has a populated `vendor` directory with Laravel 13 framework packages.
- Creating `.agents/skills/product-image-discovery-admin-plan` was blocked by the sandbox, so the repo-local skill was created under `skills/product-image-discovery-admin-plan`.
- The plan path in Downloads can be slow or blocked to read through the sandbox; `AGENTS.md` records the path so a future session can retry or use the plan already pasted in chat.
- `composer validate --strict` rejects unbound constraints, so the path package is pinned as `padosoft/product-image-discovery: dev-main`.
- Running `npm install`, Vite, Vitest, Playwright, Composer, and Herd PHP often requires escalation because the sandbox blocks child process spawning or external binaries.
- `public/index.php` must not call `send()` after `Application::handleRequest()`, because Laravel already sends the response; double-sending caused fatal header errors in Playwright.
- Playwright WebKit was not installed locally, so the tablet smoke uses Chromium with a tablet-sized viewport.
- The candidate image wrapper should use raw provider secret columns only for booleans and must not expose decrypted or partial secrets.
