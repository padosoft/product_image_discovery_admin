---
name: product-image-discovery-admin-plan
description: Continue or resume the Product Image Discovery Admin Laravel demo implementation. Use when working in product_image_discovery_admin, when context was compacted or lost, when following the saved plan, or when enforcing the branch, PR, Copilot review, documentation, testing, security, and UI rules for this admin app.
---

# Product Image Discovery Admin Plan

## Start Here

Read these files before editing application code:

1. `AGENTS.md`
2. `docs/RULES.md`
3. `docs/PROGRESS.md`
4. `docs/LESSON.md`

The canonical plan is saved at:

```text
C:\Users\lopad\Downloads\productimagesearch-admin\plan.md
```

If that file is unavailable, use the repo docs and the latest `docs/PROGRESS.md` entry to continue from the last completed slice.

## External References

- Headless package: `..\product_image_discovery`
- Package README/API contract: `..\product_image_discovery\README.md`
- Package admin UX guide: `..\product_image_discovery\docs\ADMIN_UI_UX_GUIDELINES.md`
- React prototype: `C:\Users\lopad\Downloads\productimagesearch-admin\project`

## Procedure

1. Re-read current files and `git status` before changing anything.
2. Keep changes scoped to the current macro/subtask from the plan.
3. Prefer existing package APIs and models over duplicating package behavior.
4. Preserve the package API at `/api/product-image-discovery/...`.
5. Add host-admin UI and wrappers under `/admin/product-image-discovery/...`.
6. Keep secrets write-only and fully redacted.
7. Run the relevant local gates.
8. Update `docs/PROGRESS.md` and `docs/LESSON.md`.
9. If PR/Copilot/CI steps cannot be executed locally, record the missing remote step clearly.

## Macro Order

1. Laravel App Foundation
2. Design System And React Shell
3. Operational Request Review
4. Configuration, Providers, Trusted Sources
5. Debug Flow, Reports, Health, API Workbench
6. Dashboard, Polish, CI, Release Readiness

Do not skip ahead unless a later item is required to verify the current slice.
