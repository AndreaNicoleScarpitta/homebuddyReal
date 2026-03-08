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
- **Data Management**: Event-sourced architecture for critical aggregates (Homes, Systems, Tasks, Reports, Findings, Assistant Actions, Circuit Maps). Data immutability enforced on the event log.
- **API**: Versioned API endpoints (`/v2`) with idempotency keys, state machine guards, and ownership verification for data security.
- **AI Integration — File Upload & Analysis Pipeline**: 3-stage AI pipeline (Pre-Processor → Contractor Analysis → Reasoning Engine) in `server/lib/analysis-pipeline/`. Supports PDF, PNG, JPG, JPEG, HEIC, DOCX, TXT uploads. Stage 1 (GPT-4o) extracts structured signals (systems, equipment, issues, recommendations, attributes, safety). Stage 2 matches findings to existing systems, creates proposed tasks, identifies suggested new systems (approval-first). Stage 3 infers follow-up tasks from contractor language patterns (19 patterns: end-of-life, monitor, professional eval, debris, shingle damage, install dates, periodic inspection, water damage, code violations, safety hazards, structural cracks/settling, grading/drainage, wood rot, caulking, failed window seals, improper venting, corrosion/rust, insulation deficiencies, known-risk materials). Patterns are tightened to prevent false positives — monitor requires a recommendation verb context, professional eval requires action verbs, code violation requires explicit code/standard context. Unknown systems require user approval before tasks/attributes are created. Declining removes all pending data. Image files use GPT-4o vision for OCR. DOCX uses mammoth for text extraction. Routes: `POST /v2/homes/:homeId/file-analysis`, `GET /v2/homes/:homeId/suggestions`, `POST /v2/suggestions/:id/approve`, `POST /v2/suggestions/:id/decline`, `POST /v2/homes/:homeId/confirm-matched-tasks`.
- **Universal System-Scoped Attributes**: ALL attributes across the entire system are namespaced. The shared module `server/lib/attribute-namespace.ts` provides `generateInstancePrefix()` for instance-level uniqueness (e.g., two HVAC units → `hvac_main_floor_ac` vs `hvac_upstairs_heat_pump`), `namespaceTaskAttributes()`/`denamespaceTaskAttributes()` for round-trip encoding, and `validateInstanceNamespace()` for cross-instance isolation. Applied to: document analysis, manual task creation (QuickAddTaskDialog), AI task analysis (`/v2/tasks/analyze`), system wizard suggestions (`/v2/systems/suggest-tasks`), and batch task creation. Tasks carry a `namespacePrefix` field. Maintenance cards display the namespace badge when present.
- **Circuit Panel Mapping**: Photograph breaker panels, AI-powered breaker identification (GPT-4o vision), structured annotation editor with room/amperage fields, event-sourced with CircuitMapCreated/Annotated/Deleted events. Accessible from Dashboard → Home Info → Circuit Panel Map button (requires Electrical system).
- **Document Storage**: Object storage integration (GCS) for home documents (insurance, warranties, permits, receipts) with presigned URL upload flow.
- **Background Processing**: A job queue system handles asynchronous tasks like report analysis, digest generation, and reconciliation checks for overdue tasks.
- **PWA Capabilities**: Service worker, manifest, and app icons for installability and offline access.
- **Security**: Comprehensive security hardening including input sanitization, security headers (Helmet), rate limiting (express-rate-limit), and robust error handling to prevent data leakage.
- **Systems Inventory + Review**: Dashboard shows per-type count pills in `SystemsSummary` component. `/systems` directory page with search, filter-by-type chips, sort options, and type instances view (review existing vs add new). `/systems/:id` detail page with editable attributes, notes, related tasks, maintenance history placeholder, and documents placeholder. GA4 events: `systems_directory_opened`, `system_type_opened`, `system_instance_opened`, `system_instance_add_started`, `system_instance_created`. Max 2 clicks from Dashboard to any system detail.
- **Maintenance Schedule Generation**: After adding any system, the wizard presents best-practice maintenance tasks. Known system types (HVAC, Roof, Plumbing, Electrical, etc.) use predefined task templates with cadence, urgency, cost estimates, and safety warnings. "Other" system types use GPT-4o to research and suggest tasks via NLP. Users approve/deny individual tasks before they're created. Recurring schedule toggle enables automatic cadence-based reminders. Tasks are created via batch through the V2 event-sourced pipeline.
- **AI Task Analysis**: When manually adding tasks, GPT-4o auto-determines urgency (priority), DIY safety level, estimated cost, description, and safety warnings based on the task title and category. Debounced analysis triggers after 800ms of typing. Fallback to manual entry if AI analysis fails.
- **Contractor Mode**: User setting (in Profile → Contractor Mode toggle) that unlocks manual DIY level overrides on tasks. When OFF, users cannot change the AI-determined DIY level. Stored in notification_preferences as `contractorMode` boolean.
- **Dynamic Health Score**: Home health score is computed client-side from system conditions when no server-side score exists. Condition-weighted average (Great=100, Good=90, Fair=70, Poor=40, Unknown=80) with task urgency/overdue penalties. Prevents false "Needs Attention" alerts for homes with only good-condition systems.
- **Tooltip + Definitions System**: In-product help system with reusable FieldTooltip component (hover/tap/focus), Definitions Drawer (search, categories, detail views with related terms), 50+ structured term definitions covering all dropdowns and fields. Entry points: sidebar help icon (desktop), header help icon (mobile), and "Learn more" links from any tooltip. Privacy-safe analytics (term_slug only, no user data). Content stored as typed JSON in `client/src/data/definitions.ts`.
- **Swipe Gestures on Tasks**: SwipeableTask wrapper component (framer-motion drag) applied to both Dashboard MaintenanceCards and Maintenance Log TaskRows. Swipe left → immediately completes the task (optimistic update + log entry + persistence). Swipe right → deletes the task (optimistic removal + persistence). Threshold: 100px displacement or 500px/s velocity. Disabled for already-completed tasks. Action lock prevents duplicate rapid swipes. Visual affordances: green "Done" background on left, red "Delete" background on right. State machine allows TaskCompleted from all active states (proposed, approved, scheduled, in_progress, overdue). Dashboard filters completed tasks out of urgency groups; maintenance-log moves them to Completed tab.
- **UI/UX**: React-based frontend with a "Modern Utility" design, featuring onboarding tours, rich text rendering, and responsive components.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Passport.js**: For OAuth-based social login (Google, Facebook, Instagram).
- **GPT-4o (OpenAI API)**: Powers the AI chat assistant and vision capabilities.
- **Resend**: For sending email notifications (e.g., contact form submissions).
- **Angi**: Integrated for contractor research and suggestions (opt-in only).
- **Google Places API**: Used for address autocomplete functionality.
- **USPS API**: Removed — address verification is no longer used.
- **connect-pg-simple**: PostgreSQL session store.
- **express-rate-limit**: Middleware for API rate limiting.
- **pino**: Structured logging library.
- **Vitest**: Unit testing framework.