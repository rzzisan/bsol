#!/bin/bash
#
# Migration Helper Script for Dokploy Deployments
# Run this on dokploy when database migrations need to be executed
#
# Usage: bash run-migrations.sh
#

set -e

echo "======================================"
echo "Running Database Migrations"
echo "======================================"

# Check if we're in the correct directory
if [ ! -f "artisan" ]; then
    echo "ERROR: artisan file not found. Please run this script from the backend directory."
    exit 1
fi

# Ensure environment is set
export APP_ENV=production
export APP_DEBUG=false

echo "✓ Environment: $APP_ENV"
echo "✓ Debug: $APP_DEBUG"

# Run migrations with fresh flag for first time
echo ""
echo "Running migrations..."
php artisan migrate --force

echo ""
echo "======================================"
echo "✅ Migrations completed successfully!"
echo "======================================"
echo ""
echo "Tables created:"
echo "  - landing_page_visits"
echo "  - landing_page_statistics"
echo "  - landing_page_visit_orders"
echo ""
echo "Next steps:"
echo "  1. Restart PHP-FPM: supervisorctl restart bsol_php_fpm"
echo "  2. Restart Laravel: supervisorctl restart bsol_laravel"
echo "  3. Test the analytics endpoint: curl -H 'Authorization: Bearer TOKEN' https://your-domain.com/api/landing/analytics/5/statistics"
echo ""
