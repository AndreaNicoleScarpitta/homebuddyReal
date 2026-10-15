# Intelligent home operating record — implementation notes

## Product boundaries

Exactly three persistent destinations: **Overview**, **My House**, **Plan**. Ask Home Buddy is a
separate global action opening the existing assistant; this avoids duplicating the chat
streaming/session implementation. The `/chat` deep link intentionally remains functional.
Overview summarizes status and priority actions; My House owns durable property knowledge;
Plan owns maintenance execution and completed work.

## Contextual routes

- `/dashboard`: Overview.
- `/house`: property knowledge; search systems and files.
- `/house/systems`: complete searchable system list and Add System Wizard.
- `/systems/:id`: system profile with existing warranties, intelligence, repairs and linked files.
- `/house?section=files`: house-wide searchable document browser, preview/download/upload/delete.
- `/house?section=coverage`: warranties and insurance, including home-level coverage.
- `/house?section=services`: utility provider details.
- `/house?section=history`: home timeline.
- `/house?section=tools`: transfer export and document analysis.
- `/maintenance-log`: Plan. `/calendar` remains a contextual planning action.

Legacy routes are kept as redirects; bookmarked `/records?type=...` links retain their
category context, and `/systems?type=...` keeps the filter.

## Migration

`migrations/0005_link_house_documents_to_systems.sql` adds a **nullable** `system_id`
column to legacy `home_documents`, an index, and a foreign-key constraint with
`ON DELETE SET NULL NOT VALID`. No documents are deleted or forced to associate.
The reference is a legacy integer `systems.id`, not a projection UUID; new V2-only systems
without a legacy key keep their files at house level until a verified mapping exists.

**Before deploying**: take a database backup, apply reviewed migrations with
`npm run db:migrate` in a controlled job, verify the drift check passes, and only then
roll out the web service. Railway currently uses a direct Node startup override after
previous migration-runner shutdown problems; do NOT assume a web deployment applies
migrations automatically. Do not run `db:push` on production.

## Authorization

Document reads and deletes use the existing home-ownership checks and object storage ACLs.
Creating a document with `systemId` and PATCHing `/api/documents/:id/system` both check
that the legacy system belongs to the **same** home as the document. No cross-user or
cross-home reassociation is permitted. Document selection/upload in the system UI uses
the system's legacy ID, and the library remains independently searchable.

## Validation

- GitHub CI: TypeScript, unit/integration tests, production build, Playwright.
- Integration tests must exercise cross-home association denial with the CI-only test auth header.
- Browser tests with mocked authenticated API data verify navigation, legacy redirects and file linking.
- Manual staging checks: login/session, all 3 primary destinations on desktop/mobile, system
  profile, upload/preview/download/delete, coverage, services, transfer export, Plan task changes,
  calendar, AI streaming/history, and document analysis.
- R2 credentials were previously missing on Railway: do not claim successful real upload,
  preview, or download validation until the storage provider is configured.

No production environment changes are part of this PR.
