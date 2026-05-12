@echo off
cd /d C:\Users\andys\Downloads\Home-Buddy\Home-Buddy
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/home_buddy
set PORT=5000
set NODE_ENV=development
set SESSION_SECRET=local-dev-session-secret-change-me
set AI_INTEGRATIONS_OPENAI_API_KEY=YOUR_OPENAI_KEY_HERE
set R2_ACCOUNT_ID=YOUR_R2_ACCOUNT_ID
set R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
set R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
set R2_BUCKET=homebuddy-prod
set R2_ENDPOINT=https://YOUR_R2_ACCOUNT_ID.r2.cloudflarestorage.com
node_modules\.bin\tsx server/index.ts
