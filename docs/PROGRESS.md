# Progress

## 2026-05-01

- Continued `task/request-review-workflows` with candidate review wrappers.
- Added admin routes for:
  - request candidates index
  - candidate approve
  - candidate reject
  - request retry
- Extended the Requests/Manual Review drawer to load candidate rows from the dedicated wrapper endpoint and expose approve/reject/retry actions.
- Added a reject modal with note requirements for risky reasons and a toast for mutation feedback.
- Added feature coverage for candidate index sorting, approve/reject behavior, reject validation, and request retry.
- Extended the request drawer with compare mode, selected-vs-under-review candidate cards, image previews, and source/open/copy actions.
- Added RTL coverage for the compare-mode branch in the request drawer.
- Completed the local deterministic demo data slice for Macro Task 3:
  - Added `pid-admin:seed-demo` with `--fresh` support.
  - Added Herno, Nike, and New Balance demo scenarios for manual review, selected-image, and retry/no-candidate workflows.
  - Seeded a no-secret `fake-demo` provider plus trusted demo sources to keep the dataset offline.
  - Added generated inline PNG candidate images so image previews work without live URLs.
  - Added `npm run phpunit` as a Herd-aware PHP runner for this Windows setup.
- Verification passed after the demo data slice:
  - `npm run phpunit`
  - `npm run test`
  - `npm run build`
  - `npm run e2e`
- Resolved the still-open Macro Task 1 PR loop on GitHub:
  - Pushed `b6925b9` to `task/foundation-laravel-admin-app`.
  - Addressed and resolved the remaining Copilot threads for normalized admin route prefix, dashboard aggregate counts, JsonViewer clipboard handling, and shell body memoization.
  - Confirmed no GitHub Actions workflow runs/status checks were configured for the PR head.
  - Merged PR #1 into `main` at merge commit `3b2142f`.
- Cherry-picked the foundation review fixes into `task/request-review-workflows` as `2ae421b`.
- Verification passed after carrying those fixes into Macro Task 3:
  - `npm run phpunit`
  - `npm run test`
  - `npm run build`
  - `npm run e2e`
- Opened PR #2 for Macro Task 3 into `main`, then merged `origin/main` into the branch to make the PR mergeable.
- Addressed automated review comments on PR #2:
  - approving a candidate now demotes any previously selected candidate row for the same request
  - rejecting a candidate now clears/recomputes stale best/selected candidate pointers and `final_score`
  - retry now rejects non-retryable request statuses server-side using the package status enum
  - the drawer retry action is enabled only for retryable failed/no-candidates requests
- Verification passed after PR #2 review fixes:
  - `npm run phpunit`
  - `npm run test`
  - `npm run build`
  - `npm run e2e`
- Addressed the follow-up automated review comment on PR #2:
  - rejecting a non-selected candidate now preserves `ready_to_publish`/`published` when the selected candidate remains valid
  - rejecting the current best candidate still recomputes `best_candidate_id` and `final_score`
- Verification passed after the follow-up PR #2 review fix:
  - `npm run phpunit` => 27 tests, 174 assertions
  - `npm run test` => 4 files, 16 tests
  - `npm run build`
  - `npm run e2e` => 4 Playwright tests
- Addressed the next automated review comments on PR #2:
  - candidate approval now runs inside a DB transaction and locks the request/candidate rows before mutating selection state
  - candidate preview image URLs now use `window.PID_ADMIN.apiBase` instead of a hard-coded admin prefix
- Verification after resuming and finishing the atomic approval/configured image URL fixes:
  - `npm run phpunit` => 27 tests, 174 assertions
  - `npm run test` => 4 files, 18 tests
  - `npm run build`
  - `npm run e2e -- --reporter=line` blocked after the Vite build because `node scripts/prepare-e2e.mjs` could not execute Herd PHP in this session; direct `php`, `php.bat`, and `php84` access returned denied/not found outside the working `npm run phpunit` wrapper.
- Corrected the review workflow docs to require GitHub Copilot Code Review instead of `@codex review`.
- Attempted to request Copilot review on PR #2:
  - `gh pr edit 2 --add-reviewer '@copilot'` was blocked by GitHub CLI GraphQL 401
  - REST reviewer reads returned no pending reviewers
  - GitHub connector reviewer request returned without error, but the normalized PR snapshot still did not expose a pending Copilot reviewer
- The earlier `@codex review` trigger produced a new Codex review on commit `731330f`; it is not treated as a Copilot substitute, but its two actionable race-condition findings were addressed:
  - candidate rejection now runs inside a DB transaction with locked request/candidate rows
  - retry now locks the request row while validating status, incrementing attempts, and recording the audit event
- Verification passed after the reject/retry concurrency fixes:
  - `npm run phpunit` => 27 tests, 174 assertions
  - `npm run test` => 4 files, 18 tests
  - `npm run build`
- Resumed the PR #2 loop after `gh auth login` was refreshed by the user:
  - the last code-fix head before status documentation was `e456ebc`; subsequent pushes are documentation-only PR-loop status updates
  - `gh auth status` succeeds for `lopadova`
  - thread-aware review polling found 8 review threads, with 0 unresolved non-outdated threads; the 4 unresolved threads are all outdated against the current head
  - GitHub Actions/status checks are still unavailable for the branch (`gh pr checks 2` reports no checks, and the Actions runs API returns 0 workflow runs)
- Verification passed after the resumed PR #2 loop:
  - `npm run phpunit` => 27 tests, 174 assertions
  - `npm run test` => 4 files, 18 tests
  - `npm run build`
  - `npm run e2e` => 4 Playwright tests
- Attempted to request GitHub Copilot Code Review on PR #2 after the final local gates:
  - `gh pr edit 2 --add-reviewer '@copilot'` is blocked by a missing `read:project` token scope
  - `gh auth refresh -h github.com -s read:project` timed out waiting for interactive auth
  - REST fallback `POST /repos/padosoft/product_image_discovery_admin/pulls/2/requested_reviewers` with `reviewers[]=copilot` returned 200, but subsequent API reads still expose no pending reviewer, so Copilot review could not be verified from CLI/API

## 2026-04-30

- User confirmed the full implementation plan is saved at `%USERPROFILE%\Downloads\productimagesearch-admin\plan.md`.
- Created process docs before application code, per user instruction.
- Added durable repo instructions in `AGENTS.md`.
- Added a local skill at `skills/product-image-discovery-admin-plan/SKILL.md`.
- Created and switched to branch `task/foundation-laravel-admin-app`.
- Implemented Macro Task 1 first vertical slice:
  - Laravel 13 app scaffold.
  - Composer path dependency to `../product_image_discovery`.
  - SQLite/env defaults and app config.
  - Package provider registration, app migrations, seeder wiring.
  - Admin shell at `/admin/product-image-discovery`.
  - Admin wrapper endpoints for dashboard summary, request search, request events, and candidate images.
  - React/Vite shell using the exported prototype as baseline direction.
  - PHPUnit, Vitest, Vite, and Playwright smoke coverage.
- Used approved background agents:
  - `gpt-5.4 high` for frontend shell polish and tests.
  - `gpt-5.5 high` for backend wrapper hardening and tests.
- Verification passed:
  - `composer validate --strict`
  - `vendor\bin\phpunit --configuration phpunit.xml` => 11 tests, 59 assertions
  - `npm run test` => 2 files, 4 tests
  - `npm run build`
  - `npm run e2e` => 4 Playwright tests

## Open Items

- Request/verify GitHub Copilot Code Review manually from the PR Reviewers menu if the API-visible reviewer state remains empty, or refresh `gh` with `gh auth refresh -h github.com -s read:project` in an interactive shell and retry `gh pr edit 2 --add-reviewer '@copilot'`.
- Continue polling PR #2 for a Copilot review result; current API-visible review threads have no unresolved non-outdated comments.
- GitHub Actions/status checks remain unavailable for PR #2; do not treat CI as green, only as unconfigured.

## 2026-04-30 - Macro 2 Slice

- Began Macro Task 2 by extracting shared React primitives from the shell:
  - `DataTable`
  - `EmptyState`
  - `LoadingState`
  - `JsonViewer`
  - `FilterBar`
  - `Drawer`
  - `ConfirmModal`
  - `Toast`
  - `Timeline`
  - `ImageTile`
- Improved the API client with shared error normalization and safer payload parsing.
- Updated the shell to consume the shared table/filter/viewer primitives instead of rendering everything inline.
- Verification passed for this slice:
  - `npm run test`
  - `npm run build`
  - `npm run e2e`

## 2026-04-30 - Requests Workflow Slice

- Added `GET /admin/product-image-discovery/requests/{request}` for request detail payloads with loaded best/selected candidates and candidate collection data.
- Reordered admin routes so `/requests/search` stays ahead of `/requests/{request}` and is not captured by the wildcard route.
- Added request filter helpers for query-string sync and active chip rendering.
- The Requests page now initializes filter state from the URL, keeps the query string in sync, and renders a filter bar plus detail drawer scaffolding.
- Added tests for request detail, request filter serialization, and the URL-driven Requests page state.
- Verification passed after the Requests slice fixes:
  - `vendor\bin\phpunit --configuration phpunit.xml`
  - `npm run test`
  - `npm run build`
  - `npm run e2e`

## 2026-04-30 - Toolchain Recovery

- Upgraded the frontend toolchain to the current major line:
  - `vite` `^8.0.10`
  - `@vitejs/plugin-react` `^6.0.1`
  - `laravel-vite-plugin` `^3.1.0`
  - `vitest` `^4.1.5`
- Added a small Node preload at `scripts/no-net-use.cjs` to neutralize the Windows `net use` call that was breaking Vite bootstrap.
- Forced Vitest to use `pool: 'threads'` so it stops spawning the failing forks worker on this machine.
- Verification passed after the toolchain recovery:
  - `npm run test`
  - `npm run build`
  - `npm run e2e`

## 2026-04-30 - PR Review Fixes

- Addressed remaining Copilot comments on the active PR:
  - `pidFetch()` now rejects cross-origin absolute URLs and handles non-JSON responses without assuming `response.text()` exists.
  - Request detail drawers stay open while loading or after a load failure, instead of closing as soon as the fetch starts.
  - Request detail event payloads are paginated with a default limit instead of loading the full event list.
  - `npm run e2e` now builds the Vite assets before it starts the bootstrap and browser smoke.
- Added regression coverage for the fetch safety changes and the request detail drawer behavior.
- Verification passed after the review fixes:
  - `npm run test`
  - `npm run build`
  - `npm run e2e`
  - `C:\\Users\\lopad\\.config\\herd\\bin\\php84\\php.exe vendor\\bin\\phpunit --configuration phpunit.xml`

## 2026-04-30 - Requests Workflow Slice 2

- Expanded the Requests/Manual Review shell with the next batch of workflow filters:
  - client, ERP model, ERP model color, EAN/barcode, rejection reason
  - candidate/selected-image toggles
  - created/updated date bounds
- Switched the request event timeline to the shared `Timeline` primitive.
- Kept `manual_review_required=true` pinned in the effective review filter state and the browser URL on the review page.
- Added a manual review banner so the pinned filter is visible in the UI.
- Added RTL coverage for the extra filters and the review-page pinned-filter behavior.
- Verification passed after this slice:
  - `npm run test`
  - `npm run build`
  - `npm run e2e`
  - `C:\\Users\\lopad\\.config\\herd\\bin\\php84\\php.exe vendor\\bin\\phpunit --configuration phpunit.xml`
