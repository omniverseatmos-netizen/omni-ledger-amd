# Changelog — OmNi-Ledger Judge Edition 3.0.1

## Usability and evidence exports

- Exposed the already-implemented readable HTML trace report as a visible export action on the Audit Evidence page. The previous release had the export handler and documentation, but no UI button to invoke it.
- Added automated regression tests that confirm JSON, CSV, and HTML actions are present, invoke the delegated actions, and inspect the generated report payloads.
- Updated small-screen evidence-header actions to wrap cleanly rather than forcing three export labels into one narrow row.

## Verification

- Preserved the deterministic warehouse core and its existing regression suites.
- Full verification is recorded in `VERIFY_LOG.txt`; checksum and file inventory are regenerated for this release.
- The local test suite covers fixture mode only. Live AMD-hosted inference and deployment still require the user's private account access and target hosting.
