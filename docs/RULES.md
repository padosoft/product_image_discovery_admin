# Project Rules

## Source Of Truth

- The canonical plan lives at `%USERPROFILE%\Downloads\productimagesearch-admin\plan.md`.
- The headless package contract lives in `../product_image_discovery/README.md`.
- Admin UX rules live in `../product_image_discovery/docs/ADMIN_UI_UX_GUIDELINES.md`.
- The React prototype baseline lives at `%USERPROFILE%\Downloads\productimagesearch-admin\project`.

## Implementation Defaults

- Laravel 13, PHP `^8.3`.
- SQLite default database: `database/database.sqlite`.
- Queue default: `sync`.
- Frontend: Blade shell + Vite + React.
- Admin route middleware is configurable through `pid-admin.route_middleware`, defaulting to `web`.
- Admin JSON endpoints use session/CSRF, not browser-held Sanctum tokens.
- Package API remains under `/api/product-image-discovery/...`.

## UI Rules

- Build the actual admin console as the first screen.
- Prefer compact tables, panels, drawers, modals, and toasts.
- Use cards only for repeated items, candidate tiles, modals, or genuinely framed tools.
- Do not nest cards.
- Keep border radius at 8px or less.
- Use neutral admin colors with status/score accents.
- Every icon-only button needs an accessible label and tooltip/title.
- Text must not overlap or overflow at desktop, narrow desktop, tablet, 125% zoom, or 150% zoom.

## Security Rules

- Never return API keys, secrets, authorization headers, tokens, or partial secret previews in JSON or UI.
- Provider resources expose only `has_api_key` and `has_api_secret`.
- Write-only secret forms must omit unchanged empty values and must use explicit Replace/Clear actions.
- Sanitized errors only: no stack traces or raw provider payloads in operator-facing JSON.

## Testing Rules

Every completed slice should run the relevant subset of:

```text
composer validate --strict
vendor/bin/phpunit
npm run build
npm run test
npm run e2e
```

- On this Windows/Herd machine, use `npm run phpunit` for the PHPUnit gate. It routes through `scripts/run-php.mjs` and Herd PHP 8.4.20, avoiding stale PATH resolution and avoiding XAMPP PHP.
- Do not use XAMPP PHP for this repo; its installed versions/extensions do not match the Laravel 13/PHP 8.3+ requirement.
- If a direct Herd PHP PowerShell command fails with access or trust errors, rerun the approved prefix or use `npm run phpunit` before marking the PHP gate blocked.

If a tool is unavailable, blocked by sandbox/network, or requires remote CI, record the exact blocker in `docs/PROGRESS.md`.

## Documentation Rules

- Update `docs/PROGRESS.md` after meaningful work.
- Update `docs/LESSON.md` after finding a non-obvious setup fact, API contract detail, or test workaround.
- Keep entries dated with `YYYY-MM-DD`.

## Review Rules

- Request GitHub Copilot Code Review through the PR Reviewers menu or `gh pr edit <PR> --add-reviewer @copilot`.
- Do not use `@codex review` as a replacement for Copilot review unless the user explicitly asks for Codex review.

## Agent Model Rules

- Use `gpt-5.5` high/xhigh for backend/package/security slices.
- Use `gpt-5.4` high for bounded frontend UI, CSS, Vitest, and Playwright slices.
- Keep the main agent as integrator and final reviewer.
- Worker write scopes must be disjoint.
