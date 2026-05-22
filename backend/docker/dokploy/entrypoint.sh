#!/usr/bin/env bash
set -euo pipefail

cd /var/www/html

mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

if [[ ! -L public/storage && ! -e public/storage ]]; then
    php artisan storage:link || true
fi

php artisan package:discover --ansi || true
php artisan optimize:clear || true

if [[ "${RUN_MIGRATIONS:-false}" == "true" ]]; then
    php artisan migrate --force || true
fi

php artisan config:cache || true

exec "$@"
