# Home Buddy - Home Maintenance Assistant

## Overview
Home Buddy is a home maintenance assistant web application designed to simplify home management. It features OAuth authentication, comprehensive home profile management, AI-powered maintenance task tracking, a chat assistant with session history, document storage via object storage, and inspection report management. It is configured as a Progressive Web App (PWA) for installability across devices. The project aims to provide a reliable, anxiety-aware tool for homeowners to manage their properties efficiently.

## User Preferences
- Design: "Modern Utility" aesthetic with construction orange (#f97316)
- Typography: Plus Jakarta Sans (headings), Inter (UI)
- UX: Emotional design, anxiety-aware
- Style: Minimalist, no cards, split-hero layouts, pill-style components
- Tone: Calm professional, not "friendly startup" - empathetic but grounded
- AI Messaging: Always include disclaimers that estimates are ranges, user is in control
- Provider Integration: Angi for contractor research, opt-in only, never pushy

## System Architecture
The application employs a robust architecture featuring social login authentication (Google, Facebook, Instagram via Passport.js) and a PostgreSQL database. It utilizes Drizzle ORM for schema management. All API routes are secured with authorization checks, structured logging, and comprehensive error handling. A key architectural decision is the adoption of an event-driven pattern for core functionalities, using an event log and projection tables for data consistency and scalability.

Core features include:
- **Authentication**: Passport.js for OAuth, session-based with PostgreSQL session store.
- **Data Management**: Event-sourced architecture for critical aggregates (Homes, Systems, Tasks, Reports, Findings, Assistant Actions). Data immutability enforced on the event log.
- **API**: Versioned API endpoints (`/v2`) with idempotency keys, state machine guards, and ownership verification for data security.
- **AI Integration**: AI chat with streaming responses (GPT-4o), vision API capabilities for photo analysis, privacy controls for data storage opt-out, and chat session management with history sidebar.
- **Document Storage**: Object storage integration (GCS) for home documents (insurance, warranties, permits, receipts) with presigned URL upload flow.
- **Background Processing**: A job queue system handles asynchronous tasks like report analysis, digest generation, and reconciliation checks for overdue tasks.
- **PWA Capabilities**: Service worker, manifest, and app icons for installability and offline access.
- **Security**: Comprehensive security hardening including input sanitization, security headers (Helmet), rate limiting (express-rate-limit), and robust error handling to prevent data leakage.
- **UI/UX**: React-based frontend with a "Modern Utility" design, featuring onboarding tours, rich text rendering, and responsive components.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Passport.js**: For OAuth-based social login (Google, Facebook, Instagram).
- **GPT-4o (OpenAI API)**: Powers the AI chat assistant and vision capabilities.
- **Resend**: For sending email notifications (e.g., contact form submissions).
- **Angi**: Integrated for contractor research and suggestions (opt-in only).
- **Google Places API**: Used for address autocomplete functionality.
- **USPS API**: Utilized for address verification.
- **connect-pg-simple**: PostgreSQL session store.
- **express-rate-limit**: Middleware for API rate limiting.
- **pino**: Structured logging library.
- **Vitest**: Unit testing framework.