# Home Graph Architecture

## Overview

The Home Graph is the canonical structured memory of a house. Every system, component, warranty, repair, replacement, permit, recommendation, and timeline event is an explicit entity with relationships, provenance tracking, and a unified chronological view.

## Entity Relationship Model

```
Home (1)
 ├── System (many)          e.g. Roof, HVAC, Plumbing
 │    ├── Component (many)   e.g. Shingles, Compressor, Thermostat
 │    ├── Warranty (many)    e.g. 25-year manufacturer warranty
 │    ├── Permit (many)      e.g. Roofing permit BLD-2018-04521
 │    ├── Repair (many)      e.g. Gutter repair after hailstorm
 │    ├── Replacement (many) e.g. Water heater replaced 2021
 │    └── Recommendation (many) e.g. "Schedule roof inspection"
 ├── TimelineEvent (many)    Materialized chronological view
 ├── MaintenanceTask (many)  Existing task lifecycle
 ├── Document (many)         Existing document storage
 └── InspectionReport (many) Existing inspection pipeline
```

## New Tables (7)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `components` | Sub-parts of systems | systemId, name, componentType, material, condition |
| `warranties` | Warranty tracking | systemId, warrantyProvider, warrantyType, expiryDate, isTransferable |
| `permits` | Building permits | systemId, permitNumber, permitType, status, issuingAuthority |
| `repairs` | Repair history | systemId, title, repairDate, cost, outcome |
| `replacements` | Replacement events | systemId, replacedSystemName, replacementDate, cost, reason |
| `recommendations` | AI/inspector recommendations | systemId, source, urgency, confidence, status |
| `timeline_events` | Unified chronological view | eventDate, category, title, entityType, entityId, cost |

## Provenance Model

Every Home Graph entity includes:
- `provenance_source`: How the data was entered
  - `manual` — User typed it in
  - `ai-inferred` — AI deduced it from context
  - `document-extracted` — Extracted from an uploaded document
  - `inspection` — Came from an inspection report
- `provenance_confidence`: 0-100 integer (null for manual entries)

This enables the UI to show provenance badges and supports future AI extraction pipelines.

## Event Sourcing Extensions

### New Aggregate Types
- `component`, `warranty`, `recommendation`

### New Event Types (13)
- ComponentCreated, ComponentUpdated, ComponentDeleted
- WarrantyCreated, WarrantyUpdated, WarrantyDeleted
- RecommendationCreated, RecommendationAccepted, RecommendationDismissed
- RepairRecorded, ReplacementRecorded, PermitCreated, TimelineEventRecorded

### State Machine
- **Recommendation**: open → accepted | dismissed (accepted → completed)
- **Component, Warranty**: Stateless (additive, no lifecycle)

### Timeline Materialization
Domain events (RepairRecorded, ReplacementRecorded, PermitCreated) automatically create `timeline_events` rows as a side effect in the projection applier. This keeps the timeline in sync without a separate job.

## API Endpoints

### Components
- `GET /v2/systems/:systemId/components`
- `POST /v2/systems/:systemId/components`
- `PUT /v2/components/:id`
- `DELETE /v2/components/:id`

### Warranties
- `GET /v2/homes/:homeId/warranties`
- `POST /v2/homes/:homeId/warranties`
- `PUT /v2/warranties/:id`
- `DELETE /v2/warranties/:id`

### Permits, Repairs, Replacements
- `GET/POST /v2/homes/:homeId/permits`
- `GET/POST /v2/homes/:homeId/repairs`
- `GET/POST /v2/homes/:homeId/replacements`

### Recommendations
- `GET /v2/homes/:homeId/recommendations`
- `POST /v2/recommendations/:id/accept`
- `POST /v2/recommendations/:id/dismiss`

### Timeline
- `GET /v2/homes/:homeId/timeline?category=&page=&limit=`

All mutations require `Idempotency-Key` header and ownership verification.

## Frontend Pages

### Timeline Page (`/timeline`)
- Chronological "Your Home's Story" with category filter pills
- Vertical timeline with icons, descriptions, costs, provenance badges
- Categories: Repairs, Replacements, Maintenance, Inspections, Purchases, Permits, Warranties, Milestones

### System Detail (enhanced)
- **Components section**: Sub-parts with condition badges, add/delete
- **Warranties section**: Expiry countdown (green/yellow/red), transferable badges
- **Repair History**: Cost, date, outcome badges
- **Recommendations**: Accept (creates task) / Dismiss with confidence indicators

## Seed Data

Run `npx tsx server/seed-home-graph.ts` to populate a demo home:
- 6 systems, 12 components, 4 warranties, 2 permits
- 4 repairs, 2 replacements, 3 recommendations, 13 timeline events
- Realistic Portland OR colonial home, built 2005

## Key Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | All 7 new tables + relations |
| `server/eventing/types.ts` | Event type catalog |
| `server/domain/stateMachine.ts` | Recommendation state machine |
| `server/projections/applyEvent.ts` | Event → table materialization |
| `server/routes_v2.ts` | API endpoints |
| `client/src/lib/api.ts` | Client API types + fetch functions |
| `client/src/pages/timeline.tsx` | Timeline page |
| `client/src/components/home-graph/` | UI components |
| `server/seed-home-graph.ts` | Demo seed data |
