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
- On this machine, use Herd PHP for PHPUnit; do not use XAMPP PHP for this repo.
- Prefer `npm run phpunit`, which calls `scripts/run-php.mjs` and resolves Herd PHP 8.4.20 through `%USERPROFILE%\.config\herd\bin\php84.bat` / `php84\php.exe`.
- Direct PowerShell calls to `%USERPROFILE%\.config\herd\bin\php84.bat` or `php84\php.exe` can fail with access/trust errors on first use in Codex; rerun the approved prefix or use `npm run phpunit`.
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
4. Request GitHub Copilot review.
5. Wait for CI and Copilot comments.
6. Fix until green and comments are resolved.
7. Merge, then repeat for the macro PR into `main`.

Copilot review means GitHub Copilot Code Review through the PR Reviewers menu or `gh pr edit <PR> --add-reviewer @copilot`. Do not use `@codex review` as a substitute unless the user explicitly asks for Codex review.

If `gh pr edit <PR> --add-reviewer @copilot` fails before requesting the review because GitHub CLI queries PR project items and requires `read:project`, bypass `gh pr edit` with GitHub's GraphQL reviewer mutation. Resolve the PR node ID with `gh pr view <PR> --json id`, then request the Copilot review bot with:

```powershell
$query = @'
mutation RequestReviewsByLogin($pullRequestId: ID!, $botLogins: [String!], $union: Boolean!) {
  requestReviewsByLogin(input: {pullRequestId: $pullRequestId, botLogins: $botLogins, union: $union}) {
    clientMutationId
  }
}
'@
gh api graphql -f query="$query" -F pullRequestId='<PR_NODE_ID>' -F botLogins[]='copilot-pull-request-reviewer[bot]' -F union=true
gh api repos/padosoft/product_image_discovery_admin/pulls/<PR>/requested_reviewers
```

The REST requested-reviewer endpoint with `reviewers[]=copilot` is not equivalent; it can return 200 without creating a visible Copilot Code Review request.

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

All six planned macro tasks have been implemented, reviewed, and merged into `main`.

- Macro Task 1: Laravel app foundation.
- Macro Task 2: React admin shell and shared UI primitives.
- Macro Task 3: request review workflows.
- Macro Task 4: settings, providers, and trusted sources.
- Macro Task 5: diagnostics, debug reports, health, and API workbench.
- Macro Task 6: dashboard polish, CSV/report exports, saved filters, and GitHub Actions CI.

Current merged release state:

- `main`, `origin/main`, `task/dashboard-polish-ci`, and `origin/task/dashboard-polish-ci` are aligned at merge commit `12c8249`.
- PR #10 completed the final Macro Task 6 loop with GitHub Actions green, Copilot Code Review complete, and all review threads resolved.
- No implementation PRs are open as of the final handoff.

Next priority is maintenance or a new feature slice. For any follow-up, create a fresh branch, run the relevant local gates, open a PR, request Copilot Code Review, wait for CI/review feedback, and merge only after the loop is resolved.
