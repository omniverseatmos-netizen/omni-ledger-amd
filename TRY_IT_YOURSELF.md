# جرّب بنفسك — أمر واحد (Node ≥ 20، بدون PostgreSQL)
```bash
npm ci && npm run verify:all
```
النتيجة المتوقعة: `npm test` بدون فشل (الاختبارات اللي محتاجة PostgreSQL بتتخطى)، و`verify:pitch` PASS (12 ادعاء/حد)، و`verify:release` PASS.

## مع PostgreSQL (اختياري، قاعدة بيانات للتجربة فقط — بتمسح Tenant T1)
```bash
export DATABASE_URL=postgres://USER:PASS@127.0.0.1:5432/atmos_pilot
export RESTORE_DATABASE_URL=postgres://USER:PASS@127.0.0.1:5432/atmos_restore
npm run db:migrate
npm run test:postgres        # 6 اختبارات
npm run test:e2e:http        # 25 فحص عبر HTTP: Recall ← Disposition ← موافقتين ← تنفيذ منفصل
npm run db:parity && npm run db:backup-drill
```
**كل نتيجة هنا محلية على بيانات اصطناعية، مش Staging.** نتيجة k6 والحدود في `LOCAL_K6_RESULTS.md`.
