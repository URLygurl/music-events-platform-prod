#!/bin/bash
# Run database migrations first, then start the app
echo "Running database migrations..."
npx drizzle-kit push --config=drizzle.config.ts 2>&1 || echo "Migration warning (may already exist)"
echo "Starting server..."
NODE_ENV=production node dist/index.cjs
