# Product Image Discovery Admin

Laravel 13 admin/demo application for the local headless package `padosoft/product-image-discovery`.

The app consumes the package from a Composer path repository at `../product_image_discovery`, uses SQLite by default, and renders the admin console at:

```text
/admin/product-image-discovery
```

The package API remains available at:

```text
/api/product-image-discovery
```

## Local Setup

Keep the headless package checked out beside this app:

```text
..\product_image_discovery
..\product_image_discovery_admin
```

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

If `php` is not on PATH, the current machine has Herd PHP at:

```text
%USERPROFILE%\.config\herd\bin\php84\php.exe
```

## Tests

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
- `npm run e2e`
- upload Playwright traces/screenshots on failure

## Process Docs

Read `AGENTS.md` first when resuming this project. The durable implementation plan is saved at:

```text
%USERPROFILE%\Downloads\productimagesearch-admin\plan.md
```
