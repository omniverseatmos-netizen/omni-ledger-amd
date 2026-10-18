# Changelog — OmNi-Ledger Judge Edition v3.0.7

## Maintenance release

- Added a minimal npm lockfile so `npm ci` succeeds reproducibly; the project has no third-party Node dependencies.
- Added a restrictive Content Security Policy to both static judge entry pages, and added a release-gate check that requires it in the source and built English page.
- Corrected publication-status wording in the README, submission checklist, and release documentation.
- Updated the pitch deck's engineering-honesty slide to distinguish the verified v3.0.6 public baseline from this not-yet-published reissue, and to state that live AMD inference was not re-run in this audit.
- No warehouse-domain rules or inventory behavior changed.
