# AtMoS v3.3.0 — المرحلة التشغيلية التالية

أغلقت هذه المرحلة فجوات التحقق التشغيلي التي كانت باقية بعد تنفيذ OIDC والمخطط المطبّع. أصبح CI يشغّل PostgreSQL 16 حقيقيًا، يطبق migration عبر `npm run db:migrate`، ثم يشغّل اختبارات التكامل الحقيقية، اختبار عزل المستأجرين، parity بين `pilot_state` والجداول المطبّعة، وBackup/Restore drill على قاعدة استعادة منفصلة.

أضيف `scripts/verify-normalized-parity.mjs`، وهو يقرأ كل tenant من `pilot_state` ويقارن counts المتوقعة من snapshot مع `pilot_users` و`pilot_sessions` و`pilot_recalls` و`pilot_dispositions` وapprovals وledger وaudit وidempotency. أي اختلاف يفشل العملية ويطبع تقريرًا JSON.

أضيف `tests/postgres-tenant-isolation.integration.test.mjs` لإثبات أن نفس `id` يمكن أن يوجد في مستأجرين مختلفين دون تصادم، وأن Foreign Key المركب يمنع ربط disposition بسجل من tenant آخر.

أضيف `scripts/backup-restore-drill.mjs`. الأداة تستخدم `pg_dump` بصيغة custom ثم `pg_restore` إلى قاعدة منفصلة، وتقيس زمن النسخ والاستعادة وتعرض `rtoSeconds` و`rpoSeconds` وcounts المصدر والمستعاد. لا تستخدم قاعدة الإنتاج، وتتطلب صراحة `DATABASE_URL` و`RESTORE_DATABASE_URL`.

## حدود هذه المرحلة

التشغيل المحلي الحالي لا يحتوي Docker أو PostgreSQL أو k6، ولذلك لم يتم تسجيل أرقام RTO/RPO فعلية أو نتائج ضغط HTTP من هذه الجلسة. هذه النتائج ستظهر في CI/staging بعد تشغيل Workflow، ولا يجوز اعتبار thresholds محققة قبل حفظ artifact الناتج من PostgreSQL وk6.

النسخة 3.3.0 هي Operational Readiness Candidate. اعتماد Production ما زال يتطلب تشغيل Workflow بنجاح، اختبار Entra بحسابات حقيقية لكل دور، backup/restore على staging، k6 موزع، ومراجعة أمنية مستقلة.
