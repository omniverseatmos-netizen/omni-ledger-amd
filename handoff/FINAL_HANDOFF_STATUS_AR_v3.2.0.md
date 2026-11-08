# حالة التسليم النهائية — AtMoS v3.2.0

## ما تم إغلاقه

- تم إصلاح عزل المستأجر في مخطط PostgreSQL المطبّع: كل الجداول normalized تستخدم `PRIMARY KEY (tenant_id, id)`، وكل العلاقات العابرة للمستأجر تستخدم مفاتيح مركبة.
- تم إصلاح dual-write من `ON CONFLICT (id)` إلى `ON CONFLICT (tenant_id, id)` لمنع تصادم سجلات مستأجرين مختلفين.
- تم تقوية migration ليعمل داخل transaction مع advisory lock، ويحوّل قواعد البيانات التي أنشأت المخطط القديم إلى المفاتيح المركبة مع rollback عند الفشل.
- تم تنفيذ Phase 3 لتكامل OIDC/Entra ID: Authorization Code + PKCE، توقيع state، nonce، issuer/audience/expiry، JWKS signature، tenant allowlist، role claims، وإنشاء مستخدم/جلسة tenant-scoped.
- عند `AUTH_MODE=oidc` يصبح `/v1/auth/login` موقوفًا ويرجع `LOCAL_PASSWORD_DISABLED`. وفي الإنتاج يفشل الإقلاع إذا لم يكن `AUTH_MODE=oidc` أو كانت إعدادات OIDC ناقصة.
- أضيف اختبار k6 موزع بمسارين للكتابة والقراءة، قابل للتشغيل مع `docker compose --scale pilot-api=3`، مع thresholds p95/p99 وملخص JSON.
- أضيفت اختبارات OIDC وملف تشغيل المرحلة الثالثة وملف تشغيل اختبار الحمل.

## نتائج التحقق في هذه البيئة

- `npm test`: **22 ناجحًا، 0 فشل، 3 متخطاة**؛ المتخطاة هي اختبارات PostgreSQL التي تتطلب `DATABASE_URL` وPostgreSQL تشغيلية.
- `npm run verify:release`: **PASS**.
- فحص الصياغة: **50/50 ES modules**.
- Manifest: **133 ملفًا، SHA-256 والحجم متطابقان**.
- HTTP smoke، CSP، method guard، dotfile guard، path traversal guard: **PASS**.
- اختبار OIDC المباشر: **3/3 PASS**.
- لم يتم الادعاء بتنفيذ PostgreSQL integration أو k6 فعليًا؛ البيئة الحالية لا تحتوي Docker/PostgreSQL/k6.

## التشغيل المطلوب قبل اعتماد Pilot حقيقي

1. شغّل PostgreSQL 16 وطبّق `npm run db:migrate` على قاعدة اختبارية، ثم شغّل `ATMOS_POSTGRES_INTEGRATION=1 npm run test:postgres`.
2. أنشئ تسجيل تطبيق Entra ID مع redirect URI HTTPS مطابق، وapp roles محددة، واضبط القيم في `deploy/.env.example` عبر secret manager.
3. اختبر حسابًا لكل دور، مستخدمًا معطلاً، tenant غير مسموح، token بتوقيع خاطئ، وtoken من issuer/audience غير صحيح.
4. شغّل `docker compose -f deploy/compose.postgres.yml up -d --build --scale pilot-api=3` على بيئة اختبارية، ثم نفّذ `loadtests/distributed-recall.js` واحفظ JSON وقياسات PostgreSQL CPU/IOPS/locks/connections.
5. نفّذ backup/restore drill مستقلًا وسجّل RTO/RPO قبل أي بيانات حقيقية.

هذه النسخة **جاهزة كمرشح Pilot تقني** بعد إتمام تشغيل PostgreSQL/Entra الفعليين، وليست شهادة production أو penetration test.
