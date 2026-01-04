# Home Buddy - Home Maintenance Assistant

## Overview
Home Buddy is a home maintenance assistant web application with OAuth authentication, home profile management, AI-powered maintenance task tracking, chat assistant interface, and comprehensive budget/funds tracking. Now configured as a Progressive Web App (PWA) ready for browser installation and potential Google Play Store submission.

## Current State
- Full authentication system with Replit Auth
- Complete database schema with all tables
- All API routes with structured logging and error handling
- Authorization checks on all routes (users can only access their own data)
- AI-powered chat with streaming responses (GPT-4o)
- Budget tracker with funds, allocations, and expenses
- Contact form with email notifications (Resend)
- Environment validation at startup (fail-fast on missing required vars)
- Unit tests with Vitest (36 passing tests)
- PWA with service worker and manifest for installability

## Recent Changes
- 2026-01-04: Updated AI system prompt with comprehensive operating instructions covering response structure, safety escalation, tone guidelines, budget handling, provider research rules, and photo analysis
- 2026-01-04: Added photo upload to chat with Vision API, consent modal, Terms page, and high-risk topic filtering
- 2026-01-04: Added onboarding tour for new users with tooltips, spotlight highlights, and guided steps through key features (home status, quick stats, maintenance plan, budget, inspections, assistant)
- 2026-01-04: Major UX overhaul implementing comprehensive audit findings:
  - Replaced numeric Home Health Score with tier-based status (Healthy/Watch/Needs Attention)
  - De-templated Budget page to focus on "Repair Readiness" and coverage
  - Toned down Assistant with calm, professional, anxiety-centered greeting
  - Enhanced Inspections with "Why this matters" expandable explanations
  - Grouped findings by Fix Now / Plan Soon / Address Later
  - Added Angi provider research integration points (optional, non-pushy)
  - Improved navigation with emotional sublabels (What needs attention, etc.)
  - Better empty states with value props and reassurance messaging
- 2026-01-04: Added PWA manifest, service worker, app icons, and Play Store submission guide
- 2026-01-04: Added AI chat with streaming, environment validation, email notifications, authorization tests, fixed nested anchor tag hydration errors

## Architecture

### Database Tables
- users (Replit Auth)
- homes (user's home profile)
- systems (HVAC, plumbing, etc.)
- maintenanceTasks (maintenance items)
- chatMessages (chat history)
- funds (budget tracking)
- fundAllocations (money earmarked for tasks)
- expenses (actual spending)
- contactMessages (contact form submissions)

### Key Files
- `shared/schema.ts` - Database schema with Drizzle ORM
- `server/routes.ts` - All API endpoints with logging
- `server/storage.ts` - Database operations with authorization helpers
- `server/lib/logger.ts` - Structured logging with pino
- `server/lib/ai-chat.ts` - AI chat with streaming responses
- `server/lib/env-validation.ts` - Environment validation at startup
- `server/lib/email.ts` - Email notifications with Resend
- `client/src/pages/` - React pages (Dashboard, Budget, Chat, Contact)

## Environment Variables

### Required
- DATABASE_URL - PostgreSQL connection (auto-provided)

### Optional (features disabled if not set)
- AI_INTEGRATIONS_OPENAI_API_KEY - AI chat (auto-provided by Replit)
- VITE_GOOGLE_PLACES_API_KEY - Address autocomplete
- USPS_CLIENT_ID, USPS_CLIENT_SECRET - Address verification
- RESEND_API_KEY - Email notifications

## User Preferences
- Design: "Modern Utility" aesthetic with construction orange (#f97316)
- Typography: Plus Jakarta Sans (headings), Inter (UI)
- UX: Emotional design, no-shame budgeting approach, anxiety-aware
- Style: Minimalist, no cards, split-hero layouts, pill-style components
- Tone: Calm professional, not "friendly startup" - empathetic but grounded
- AI Messaging: Always include disclaimers that estimates are ranges, user is in control
- Provider Integration: Angi for contractor research, opt-in only, never pushy

## Running Tests
```bash
npx vitest run
```

## Database Commands
```bash
npm run db:push   # Push schema changes to database
```
