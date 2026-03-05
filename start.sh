#!/bin/bash
# Migrations are handled inline at startup via seed.ts
echo "Starting server..."
NODE_ENV=production node dist/index.cjs
