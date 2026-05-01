<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$vendorAutoload = $root.'/vendor/autoload.php';
$fallbackAutoload = dirname($root).'/product_image_discovery/vendor/autoload.php';

if (is_file($vendorAutoload)) {
    require $vendorAutoload;
} elseif (is_file($fallbackAutoload)) {
    require $fallbackAutoload;
} else {
    throw new RuntimeException('Composer dependencies are missing. Run composer install from this repository.');
}

$registerPsr4 = static function (string $prefix, string $baseDir): void {
    spl_autoload_register(static function (string $class) use ($prefix, $baseDir): void {
        if (! str_starts_with($class, $prefix)) {
            return;
        }

        $relative = substr($class, strlen($prefix));
        $file = rtrim($baseDir, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.str_replace('\\', DIRECTORY_SEPARATOR, $relative).'.php';

        if (is_file($file)) {
            require $file;
        }
    }, prepend: true);
};

$registerPsr4('App\\', $root.'/app');
$registerPsr4('Database\\Seeders\\', $root.'/database/seeders');
$registerPsr4('Tests\\', $root.'/tests');
