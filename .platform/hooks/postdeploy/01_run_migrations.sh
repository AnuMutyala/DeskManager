#!/bin/bash
# Run database migrations after deployment

cd /var/app/current
npm install
npm run db:push
