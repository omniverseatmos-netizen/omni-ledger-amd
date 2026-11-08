# حالة التسليم النهائية — AtMoS v3.2.0

## الحكم

هذه هي أحدث حزمة AtMoS الخاصة. المشروع منفصل عن مستودع OmNi-Ledger المقدم في مسابقة LabLab. آخر commit في مسار AtMoS هو:

```text
f0538b5db7e62e4274f131697208565d5d0d3158
```

## ما تم تثبيته

- Hardening المرحلة الأولى: أسرار production إلزامية، dependency `pg` مثبتة، وعدم إعادة أخطاء 5xx الداخلية للعميل.
- PostgreSQL schema أساسي ومطبّع.
- Dual-write داخل نفس transaction بين `pilot_state` والجداول المطبّعة.
- جداول users وsessions وrecalls وdispositions وapprovals وledger وaudit وidempotency.
- Composite tenant constraints وforeign keys وunique indexes.
- `npm run db:migrate` لتطبيق الـschema.
- Dockerfile وCompose محدثان لدعم `NORMALIZED_REPOSITORY=1`.
- CI حقيقي يستخدم PostgreSQL 16 ويشغل اختبارات التكامل المطبّعة.

## إثبات التحقق

آخر GitHub Actions ناجح:

https://github.com/omniverseatmos-netizen/omniverse-atmos/actions/runs/39381191348

النتيجة:

```text
Apply PostgreSQL schema: SUCCESS
Run release verification: SUCCESS
Run real PostgreSQL integration tests: SUCCESS
19 local tests passed
0 failed
```

## حد المرحلة

النسخة تستخدم dual-write عمدًا. لم يتم حذف `pilot_state` بعد. الإزالة لا تتم إلا بعد parity report وbackup/restore drill وtenant-isolation review وقياس أداء. OIDC/Entra ID وMFA وk6 الموزع هي المراحل التالية وليست ادعاءات مكتملة داخل هذه الحزمة.

## التشغيل

```bash
npm ci
npm test
npm run verify:release

export DATABASE_URL="postgresql://..."
npm run db:migrate
NORMALIZED_REPOSITORY=1 npm run pilot:serve
```

لا توجد مفاتيح AMD أو أسرار خاصة داخل الحزمة.
