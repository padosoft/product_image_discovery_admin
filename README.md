# Product Image Discovery Admin

[![CI](https://github.com/padosoft/product_image_discovery_admin/actions/workflows/ci.yml/badge.svg)](https://github.com/padosoft/product_image_discovery_admin/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/padosoft/product_image_discovery_admin?style=flat-square)](https://github.com/padosoft/product_image_discovery_admin/releases)
[![PHP](https://img.shields.io/badge/PHP-8.3%2B-777bb4.svg?style=flat-square)](https://www.php.net/)
[![Laravel](https://img.shields.io/badge/Laravel-13.x-ff2d20.svg?style=flat-square)](https://laravel.com/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg?style=flat-square)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg?style=flat-square)](https://vite.dev/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square)](LICENSE)

Professional Laravel admin console for [`padosoft/product-image-discovery`](https://github.com/padosoft/product_image_discovery): inspect discovery requests, approve or reject candidates, tune provider configuration, run diagnostics, and ship safer product-image workflows without building a back office from scratch.

![Product Image Discovery Admin overview](resources/screenshoots/ProductImageSearch-dashboard.png)

## Table of Contents

- [Why Teams Use It](#why-teams-use-it)
- [What You Get](#what-you-get)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Local Setup](#local-setup)
- [Demo Data](#demo-data)
- [Testing](#testing)
- [CI](#ci)
- [Security Model](#security-model)
- [Admin Routes](#admin-routes)
- [Relationship To The Package](#relationship-to-the-package)
- [Process Docs](#process-docs)
- [License](#license)

## Why Teams Use It

Product images are operational data. A wrong product-color image can leak into ERP, PIM, marketplaces, catalogs, feeds, and customer-facing storefronts. This admin app gives catalog and operations teams a dense, production-shaped cockpit for the conservative discovery pipeline in `padosoft/product-image-discovery`.

- Review uncertain matches before they publish.
- Compare candidates with source, score, AI, quality, and audit evidence.
- Manage thresholds, providers, trusted sources, and client overrides.
- Run debug flows against real or fake providers.
- Inspect health, queues, storage, AI configuration, and redacted reports.
- Export filtered request data and keep demo operator filters locally.

## What You Get

- **Operations dashboard** with KPI cards, score distribution, provider readiness, queue phase health, latest attention items, and shortcuts.
- **Requests and Manual Review** pages with dense filters, pagination, CSV export, detail drawer, compare mode, protected image previews, approve/reject/retry flows, and audit timeline.
- **Configuration tools** for settings, search providers, provider credential status, trusted sources, trust scores, policies, scopes, and URL patterns.
- **Diagnostics suite** with guided debug-flow runner, report viewer, JSON search, redacted report download, health checks, and API workbench.
- **Offline demo path** with deterministic seeded data for Herno, Nike, and New Balance scenarios.
- **Release gate** through PHPUnit, Vitest, Vite, Playwright, Composer validation, and GitHub Actions.

## Screenshots

### Overview Dashboard

![Overview dashboard](resources/screenshoots/ProductImageSearch-dashboard.png)

### Request Search

![Request search](resources/screenshoots/ProductImageSearch-request.png)

### Request Detail And Candidate Review

![Request detail](resources/screenshoots/ProductImageSearch-request-details.png)

### API Test Workbench

![API test workbench](resources/screenshoots/ProductImageSearch-API.png)

### Debug Flow

![Debug flow setup](resources/screenshoots/ProductImageSearch-test-flow.png)

### Debug Flow Results

![Debug flow results](resources/screenshoots/ProductImageSearch-test-flow-results.png)

### Scoring Configuration

![Scoring configuration](resources/screenshoots/ProductImageSearch-configuration-scoring.png)

### Trusted Sources Configuration

![Trusted sources configuration](resources/screenshoots/ProductImageSearch-configuration-trusted-sources.png)

## Architecture

This repository is a Laravel 13 admin/demo application, not a reusable UI package. It consumes the sibling headless package through a Composer path repository:

```text
..\product_image_discovery
..\product_image_discovery_admin
```

The stack is intentionally boring and inspectable:

- Laravel 13 host app.
- SQLite by default for local development and tests.
- Blade shell at the admin route.
- Vite + React for the operator UI.
- Session/CSRF-protected admin JSON wrappers.
- Package API left available under its own prefix.
- Playwright browser smoke coverage for desktop and tablet layouts.

## Local Setup

Keep the headless package checked out beside this app:

```text
..\product_image_discovery
..\product_image_discovery_admin
```

Install and bootstrap the app:

```powershell
composer install
Copy-Item .env.example .env -ErrorAction SilentlyContinue
php artisan key:generate --ansi
New-Item -ItemType File database\database.sqlite -Force
php artisan migrate
php artisan pid-admin:seed-demo --fresh
npm ci
npm run build
php artisan serve
```

Open:

```text
http://127.0.0.1:8000/admin/product-image-discovery
```

If `php` is not on PATH, this Windows/Herd workstation uses:

```text
%USERPROFILE%\.config\herd\bin\php84\php.exe
```

## Demo Data

The local seeder gives you deterministic, offline-friendly scenarios:

- Herno manual-review fashion request.
- Nike candidate review and retry/no-candidate workflows.
- New Balance ready/selected-image example.
- Fake demo provider and trusted demo sources.
- Inline generated candidate images so previews work without live downloads.

Reset the demo state with:

```powershell
php artisan pid-admin:seed-demo --fresh
```

## Testing

Run the full local release gate:

```powershell
composer validate --strict
npm run phpunit
npm run test
npm run build
npm run e2e
```

`npm run phpunit` is the preferred PHP test entry point on this machine because it resolves Herd PHP 8.4 before falling back to `php` on PATH.

## CI

GitHub Actions runs the same release gate on pushes and pull requests:

- checkout this admin app and the sibling `padosoft/product_image_discovery` package
- `composer validate --strict`
- `composer install`
- `npm ci`
- `npm run phpunit`
- `npm run test`
- `npm run build`
- `npm run e2e:ci`
- upload Playwright traces/screenshots on failure

## Security Model

- Provider credentials are write-only.
- JSON responses expose credential booleans such as `has_api_key`, never raw secrets or partial previews.
- Debug reports and stored artifacts are redacted before display/download.
- Admin wrappers use same-origin fetch and CSRF/session protection.
- High-impact debug/request creation endpoints support stricter configurable middleware and throttling.
- Candidate source URLs are normalized before browser navigation.
- CSV exports neutralize spreadsheet formula prefixes in untrusted text cells.

## Admin Routes

The admin console lives at:

```text
/admin/product-image-discovery
```

Admin JSON wrappers live under:

```text
/admin/product-image-discovery/...
```

The package API remains available at:

```text
/api/product-image-discovery/...
```

## Relationship To The Package

Use this app when you want the ready-made professional admin experience. Use [`padosoft/product-image-discovery`](https://github.com/padosoft/product_image_discovery) directly when you only need the headless API, models, jobs, configuration, and package-level integration surface.

The admin app intentionally stays close to the package contracts and avoids exposing implementation-only secrets or internal raw payloads.

## Process Docs

Read `AGENTS.md` first when resuming this project. The durable implementation plan is saved at:

```text
%USERPROFILE%\Downloads\productimagesearch-admin\plan.md
```

The project history and non-obvious setup lessons are tracked in:

- [`docs/PROGRESS.md`](docs/PROGRESS.md)
- [`docs/LESSON.md`](docs/LESSON.md)
- [`docs/RULES.md`](docs/RULES.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
