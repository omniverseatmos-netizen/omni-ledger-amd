# v3.5.4 (20 أكتوبر 2026)
- Fix: `normalized-postgres.mjs` ledger/audit `sequence_no` من موضع الصف (كان 0 لكل الصفوف).
- Fix: `pilot-server.mjs` يحوّل DomainError إلى 409/404 بدل 500.
- Perf (قراءة فقط): `pilot-service.mjs` dashboard يعيد استخدام Core المُتحقَّق منه لكل نسخة.
- Add: `scripts/e2e-http-postgres.mjs` (25 فحص HTTP)، `scripts/seed-pilot-loadtest.mjs`، اختبار `normalized-real-core`.
- Fix: `loadtests/recall-disposition.js` (READ_TOKEN، 409 متوقع، مدد قابلة للضبط).
- Docs: LOCAL_K6_RESULTS.md، DEMO_AIRPLANE_MODE_CHECKLIST_AR.md، TRY_IT_YOURSELF.md.
