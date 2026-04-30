# Product Image Discovery Admin Agent Guide

This repository is the Laravel admin/demo application for the headless package at:

```text
..\product_image_discovery
```

The durable implementation plan is saved at:

```text
%USERPROFILE%\Downloads\productimagesearch-admin\plan.md
```

If context is missing, read that plan first, then read:

- `docs/RULES.md`
- `docs/PROGRESS.md`
- `docs/LESSON.md`
- `skills/product-image-discovery-admin-plan/SKILL.md`

## Operating Rules

- Treat this as a Laravel 13 admin/demo app, not a reusable UI package.
- Consume the local package with a Composer path repository pointing to `../product_image_discovery`.
- Keep the package API available at `/api/product-image-discovery/...`.
- Add the admin shell at `/admin/product-image-discovery`.
- Add admin JSON wrappers under `/admin/product-image-discovery/...`.
- Use SQLite by default for local development and tests.
- Use Blade + Vite + React for the admin UI because the approved prototype is React.
- Reuse the exported prototype at `%USERPROFILE%\Downloads\productimagesearch-admin\project` as the visual/product baseline.
- Never expose secrets. Provider credentials are write-only and JSON responses must expose only configured/missing booleans.
- Keep UI dense and operational: no landing page, no marketing hero, no nested cards, radius <= 8px.
- Use inline SVG icon buttons or the existing project icon set until an icon package is explicitly added.
- Update `docs/PROGRESS.md` after meaningful implementation steps.
- Update `docs/LESSON.md` when discovering anything that would save the next agent time.

## Branch And PR Loop

Follow the plan's branch strategy:

- Foundation: `task/foundation-laravel-admin-app`
- React shell: `task/react-admin-shell`
- Request review workflows: `task/request-review-workflows`
- Configuration management: `task/configuration-management`
- Diagnostics/debug/health: `task/diagnostics-debug-health`
- Dashboard/polish/CI: `task/dashboard-polish-ci`

For each subtask, the intended process is:

1. Implement the smallest coherent subtask.
2. Run the relevant PHP, Node, Vitest, Vite, and Playwright gates.
3. Open a subtask PR into the macro branch.
4. Request Copilot review.
5. Wait for CI and Copilot comments.
6. Fix until green and comments are resolved.
7. Merge, then repeat for the macro PR into `main`.

Do not stop after a push or review request. Keep polling PR status, CI, and review comments until the loop is resolved or GitHub access is unavailable.

If GitHub/Copilot access is unavailable in the current session, do not fake the loop. Record the local status and next required remote step in `docs/PROGRESS.md`.

## Background Agent Strategy

The user approved model-specific background workers to save cost without reducing quality.

- Use `gpt-5.5` high/xhigh for backend workflows where correctness, security, secrets, approval/reject behavior, debug jobs, or package contracts are at risk.
- Use `gpt-5.4` high for bounded React/CSS/Vitest/Playwright UI slices.
- Keep one main integrator responsible for reviewing worker output, resolving conflicts, and running the final gates.
- Give workers explicit ownership/write scopes and remind them they are not alone in the codebase.
- Do not run broad parallel workers over the same files.

## Current Priority

Macro Task 1 foundation has a first vertical slice implemented locally:

1. Laravel 13 app scaffold.
2. Composer path repository dependency for `padosoft/product-image-discovery`.
3. SQLite defaults, app config, package provider registration, migrations and seeding.
4. Admin shell and initial JSON wrapper routes.
5. Focused PHPUnit, Vitest, Vite, and Playwright smoke tests.

Next priority is either opening the Macro 1 PR loop, or continuing into Macro Task 2 if remote PR/Copilot work is deferred.
