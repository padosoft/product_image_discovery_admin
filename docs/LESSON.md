# Lessons

## 2026-05-01

- Admin candidate review wrappers should mirror the package endpoints exactly: `GET /requests/{request}/candidates`, `POST /requests/{request}/candidates/{candidate}/approve`, `POST /requests/{request}/candidates/{candidate}/reject`, and `POST /requests/{request}/retry`.
- The request detail drawer is easier to keep honest when it loads candidates from the dedicated candidates endpoint instead of relying only on the `show` payload.
- When adding action modals to the shell, keep a single source of truth for transient action state so approve/reject/retry closures can reset the drawer and the modal cleanly.
- Risky reject reasons need notes in both backend validation and the UI, otherwise the shell can drift from the package rule set.
- Compare mode works better when the drawer carries the current candidate selection in state and falls back to the first loaded candidate after a refresh.
- Candidate comparison needs a direct source/open/copy path in the drawer, not only in the table row actions, or the operator has to jump between surfaces.
- For this Windows/Herd setup, direct PowerShell calls to `C:\Users\lopad\.config\herd\bin\php84\php.exe` or `php84.bat` may fail until the command prefix is trusted. Running PHP through the repo wrapper `npm run phpunit` consistently resolves Herd PHP 8.4.20 after approval and avoids falling back to XAMPP.
- Deterministic admin demo data is safer as direct seeded rows than as a shared fake-provider pipeline run because the package fake provider does not filter multi-product image results by product identity.
- Inline generated PNG data URIs are enough for candidate preview smoke data and avoid remote image downloads while still exercising the protected admin image endpoint.
- If `npm run phpunit -- --filter ...` fails to resolve Herd PHP and falls back to missing `php` on PATH, rerun the full `npm run phpunit` gate or set `PHP_BINARY` explicitly for the filtered run.
- Admin approve/reject wrappers need to maintain request candidate pointers, not just the clicked candidate row: approving should demote any prior selected candidate, and rejecting the current best/selected candidate should clear or recompute `best_candidate_id`, `selected_candidate_id`, and `final_score`.
- Server-side retry validation should use `ProductImageDiscoveryRequestStatus::isRetryable()` so direct admin JSON calls cannot requeue published, ready-to-publish, manual-review, or other non-retryable requests.
- Rejecting a non-selected candidate on a request that already has a valid selected candidate should preserve `ready_to_publish`/`published`; only rejecting the selected candidate should move the request back to review/rejected.
- Candidate approval should run in a transaction with row locks because demoting previous selections and promoting the new selection must be atomic under concurrent operators.
- Frontend wrapper URLs should derive from `window.PID_ADMIN.apiBase`; candidate image previews need the same configured route prefix handling as `pidFetch()`.
- If `npm run e2e` exits immediately after the Vite build with no Playwright output, run `node scripts/prepare-e2e.mjs` to confirm the setup phase; in this Codex session Herd PHP access checks returned denied/false outside the working `npm run phpunit` wrapper, so e2e was blocked before the browser runner.
- The PR loop requires GitHub Copilot Code Review, requested through the PR Reviewers menu or `gh pr edit <PR> --add-reviewer @copilot`; `@codex review` is not a valid substitute unless the user explicitly asks for it.
- Reject and retry admin mutations need the same transaction/row-lock treatment as approve: both derive request state from current row values and can otherwise lose updates under concurrent operators.
- On this repo, `gh pr edit 2 --add-reviewer '@copilot'` can fail before requesting Copilot because GitHub CLI queries PR project items and the token lacks `read:project`; bypass it with GraphQL `requestReviewsByLogin`, passing the PR node ID and `botLogins[]='copilot-pull-request-reviewer[bot]'` with `union=true`, then verify via `GET /repos/{owner}/{repo}/pulls/{number}/requested_reviewers`. The REST fallback `reviewers[]=copilot` is not equivalent: it can return 200 while leaving no visible Copilot reviewer.
- Overview data already fetches a compact request snapshot, so the broader request-list refresh effect should be gated to Requests/Manual Review pages to avoid duplicate `/requests/search` calls and background refetches on unrelated pages.
- Candidate approval should keep request-level `best_candidate_id`, `selected_candidate_id`, and `final_score` aligned; candidate pagination should include a deterministic secondary sort key after `final_score` so tied scores do not create unstable pages.
- Timeline display code should compose optional event message/level fields from filtered parts; direct template literals can render database nulls as visible `null` or `undefined`.
- Frontend tests for debounced behavior should use observable calls or fake timers, not real sleeps, or the suite becomes slower and timing-dependent.
- Drawer/detail fetch handlers need stale-response guards when operators can open records in quick succession; otherwise a slower earlier response can overwrite the newer selection.

## 2026-04-30

- `php` and `composer` may not be available on PATH; set `PHP_BINARY` to your PHP executable and use `composer` on PATH where possible instead of baking in one workstation path.
- On this machine, Herd PHP and Composer were available under `%USERPROFILE%\.config\herd\bin\`, but future sessions should prefer portable overrides instead of hard-coded local binaries.
- When the shell cannot resolve `php`, call Herd's concrete `php.exe` directly from `%USERPROFILE%\.config\herd\bin\php84\php.exe` for local PHPUnit runs instead of relying on `vendor\\bin\\phpunit` to resolve the interpreter.
- The neighboring package already had a populated `vendor` directory with Laravel 13 framework packages.
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
- Requests workflow slice: the manual review page should keep `manual_review_required=true` in the effective filter state and in the URL, not just in the fetch call.
- Requests workflow slice: add new filter controls only when the backend already accepts them, then cover them in the RTL smoke test so the shell stays aligned with the contract.
- API client slice: error normalization is easier to test when the response parsing and message extraction are separated from the fetch wrapper.
- Requests slice: route order matters when a static route such as `/requests/search` sits beside a wildcard like `/requests/{request}`; register the static route first or the wildcard will swallow it.
- Requests slice: initialize URL-driven filter state synchronously in `useState` instead of in a follow-up effect, or the page can fetch once with defaults and then immediately overwrite its own results.
- Requests slice: backend fixtures for detail views must satisfy all non-null columns, including `raw_payload`, even when the UI only needs a subset of the record.
- Toolchain slice: on this Windows machine, Vite/Vitest were failing in the `esbuild` service path with `spawn EPERM`. Upgrading to Vite 8 and Vitest 4 was necessary but not sufficient.
- Toolchain slice: Vite 8 still hits a Windows `execFile` realpath path during config bootstrap. A small preload that neutralizes `net use` calls lets the CLI boot here.
- Toolchain slice: Vitest 4 defaulted to the `forks` pool, which still spawned child processes and failed. For this repo, `pool: 'threads'` is the stable setting.
