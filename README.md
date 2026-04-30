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

```powershell
composer install
Copy-Item .env.example .env
php artisan key:generate
New-Item -ItemType File database\database.sqlite -Force
php artisan migrate
php artisan db:seed
npm install
npm run build
php artisan serve
```

If `php` is not on PATH, the current machine has Herd PHP at:

```text
%USERPROFILE%\.config\herd\bin\php84\php.exe
```

## Tests

```powershell
vendor\bin\phpunit
npm run test
npm run build
npm run e2e
```

## Process Docs

Read `AGENTS.md` first when resuming this project. The durable implementation plan is saved at:

```text
%USERPROFILE%\Downloads\productimagesearch-admin\plan.md
```
