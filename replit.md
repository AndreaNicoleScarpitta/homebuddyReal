# HomeBuddy — historical Replit project notes

This repository previously ran on Replit. The original long-form notes described older architecture and features, including obsolete authentication, contractor, navigation and billing decisions. **Do not use those notes for current implementation.**

Current sources of truth:

- [README.md](README.md) — product description, stack, local start, common commands.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Home, Plan, My House, eventing, auth and integrations.
- [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) — safe local PostgreSQL and optional sandbox credentials.
- [CONTRIBUTING.md](CONTRIBUTING.md) — test, review and protected staging → production workflow.
- [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md) — actual Railway topology.
- [docs/OPERATIONS_RECOVERY.md](docs/OPERATIONS_RECOVERY.md) — backup, PITR and Stripe operations.

HomeBuddy is a mobile-first PWA and the intelligent operating record of a home. New user billing is limited to **one-time donations**; paid plan upgrades are discontinued. The production application is on Railway rather than Replit. Replit-named legacy source modules are still present for compatibility; a historical module name does not imply its historical deployment model is active.
