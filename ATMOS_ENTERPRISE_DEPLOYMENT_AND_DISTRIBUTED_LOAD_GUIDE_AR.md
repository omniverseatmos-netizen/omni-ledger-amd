# دليل نشر AtMoS المؤسسي
## PostgreSQL عبر Docker والانتقال من التجربة إلى الإنتاج

> **تحديث الحالة:** أصبح `pilot-postgres.mjs` موجوداً ويُفعَّل بـ`PERSISTENCE=postgres`. هو يحفظ Snapshot النواة في `pilot_state` (JSONB) داخل معاملة حقيقية مع `SELECT ... FOR UPDATE` و`version` متزايد وإعادة محاولة عند Deadlock. تم اختباره على PostgreSQL 16 حقيقي (30 معاملة متزامنة بلا فقد تحديث، وRollback كامل عند الخطأ، وتسجيل Bootstrap وLogin عبر HTTP). **لم يتم** اختبار حمل HTTP موزع (k6) عليه، ولا تفكيك الكيانات إلى جداول Normalized، ولا OIDC. لذلك هو Pilot-ready وليس Production-ready. مكتبة `pg` تُحمَّل ديناميكياً فقط في وضع postgres، فالوضع الملفي يظل بلا أي اعتماديات.

## 1. قرار البنية

### بيئة التجربة

```text
Developer / CI
    ↓
Docker Compose
    ├── PostgreSQL 16
    ├── Pilot API (file adapter أو adapter تجريبي)
    └── k6 load test profile
```

### بيئة الإنتاج المؤسسية المفضلة

```text
Load Balancer / TLS
        ↓
AtMoS API replicas (stateless)
        ↓
PostgreSQL primary + managed backups/PITR
        ↓
Read replica / observability / alerting
```

لا يجب نشر PostgreSQL على نفس آلة API في الإنتاج إلا كحل مؤقت موثق. الأفضل استخدام PostgreSQL مُدار مع:

- Multi-AZ أو ما يعادله.
- Point-in-time recovery.
- تشفير أثناء النقل والتخزين.
- Private networking.
- مراقبة replication lag.
- نافذة صيانة واختبار Restore دوري.

## 2. المتطلبات

- Docker Engine وDocker Compose v2.
- Node 22 لتشغيل اختبارات النواة.
- k6 0.51+ على جهاز الاختبار أو صورة Docker.
- نطاق TLS وReverse Proxy في الإنتاج.
- Secret Manager أو Vault/KMS.
- PostgreSQL 15+؛ الاختبار الموصى به PostgreSQL 16.

## 3. تشغيل PostgreSQL محلياً

من جذر المشروع:

```bash
mkdir -p deploy/secrets
umask 077
openssl rand -base64 32 > deploy/secrets/postgres_password.txt
cp deploy/.env.example deploy/.env
# عدّل deploy/.env ولا تضعه في Git

docker compose --env-file deploy/.env \
  -f deploy/compose.postgres.yml \
  up -d postgres

docker compose --env-file deploy/.env \
  -f deploy/compose.postgres.yml \
  ps
```

تحقق من الصحة:

```bash
docker compose --env-file deploy/.env \
  -f deploy/compose.postgres.yml \
  exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

لا يتم نشر المنفذ `5432` إلى الإنترنت. في Compose الشبكة `pilot_private` داخلية، والوصول يكون من خدمة API فقط.

## 4. تهيئة المخطط

المخطط موجود في:

```text
schema/pilot-postgres.sql
```

في بيئة التجربة، يقوم Postgres بتشغيله أول مرة عبر `docker-entrypoint-initdb.d`. في بيئة موجودة مسبقاً لا تعيد تشغيل الملف تلقائياً؛ استخدم migration versioned:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f schema/pilot-postgres.sql
```

بعد كل تغيير في المخطط:

1. اكتب migration مرقمة، ولا تعدّل migration مطبقة.
2. شغّلها على نسخة staging من Backup حديث.
3. نفّذ `EXPLAIN` للاستعلامات الحساسة.
4. اختبر rollback أو خطة forward-fix.
5. نفّذها في نافذة تغيير موثقة.

## 5. تفعيل PostgreSQL Adapter قبل Production

يجب أن يقوم الـAdapter الإنتاجي بالآتي:

- تحويل كل `disposition` إلى صف في `disposition_requests`.
- استخدام `tenant_id` في كل استعلام بلا استثناء.
- قفل `recalls` وطلبات التصرف والتخصيصات المتأثرة داخل Transaction.
- تطبيق optimistic `version` مع `WHERE version = previous_version`.
- استخدام unique key في `idempotency_keys`.
- تسجيل Ledger وAudit داخل نفس Transaction.
- تنفيذ Outbox event بعد Commit، لا قبل Commit.
- عدم تخزين `PILOT_TOKEN` أو كلمات المرور في ملفات Image أو Git.

المعاملة المرجعية:

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

SELECT id, version, status
FROM recalls
WHERE tenant_id = $1 AND item_code = $2 AND batch = $3
FOR UPDATE;

SELECT id, status, version, approvals
FROM disposition_requests
WHERE tenant_id = $1 AND id = $4
FOR UPDATE;

INSERT INTO idempotency_keys(tenant_id, key, operation, request_hash, response)
VALUES ($1, $5, $6, $7, '{}'::jsonb)
ON CONFLICT (tenant_id, key, operation) DO NOTHING;

-- تحقق RBAC، فصل الصلاحيات، حالة الطلب، والرصد.
-- اكتب Ledger + Audit + تحديث disposition في نفس المعاملة.
COMMIT;
```

### ترتيب القفل

استخدم ترتيباً ثابتاً في كل مسار:

```text
tenant → recall → disposition → sales-order/allocation → ledger aggregate
```

هذا يقلل Deadlocks. عند `40001` أو `40P01` أعد المحاولة بعد backoff عشوائي محدود، لكن لا تعِد محاولة إجراء غير Idempotent من دون مفتاح Idempotency.

## 6. الأسرار والهوية

في الإنتاج:

- استبدل Login المحلي بـ OIDC/Entra ID/SAML.
- خزّن `external_subject` لا كلمة مرور محلية.
- خزّن الأسرار في Secret Manager.
- استخدم TLS بين API وPostgreSQL (`sslmode=verify-full`).
- أنشئ مستخدم PostgreSQL للتطبيق بصلاحيات DML محدودة.
- لا تمنح API صلاحيات `CREATE EXTENSION` أو superuser.
- غيّر `PILOT_BOOTSTRAP_TOKEN` بعد أول إنشاء Admin أو عطّل endpoint.
- دوّر مفاتيح TLS وSecrets دورياً.

## 7. النسخ الاحتياطي والاستعادة

### Backup منطقي للتجربة

```bash
mkdir -p backups
chmod 700 backups
docker compose --env-file deploy/.env -f deploy/compose.postgres.yml \
  exec -T postgres pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB" \
  > "backups/atmos-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

### Restore إلى قاعدة اختبار جديدة

```bash
createdb atmos_restore_test
pg_restore --clean --if-exists --no-owner \
  -d atmos_restore_test backups/FILE.dump
```

لا يكفي نجاح أمر `pg_dump`. يجب اختبار:

- Restore كامل.
- فحص عدد الصفوف.
- فحص Ledger/Audit integrity.
- تشغيل `test:pilot` ضد البيئة المستعادة.
- قياس RTO وRPO.
- توثيق النتيجة والتاريخ.

## 8. ترقية Staging إلى Production

### Gate A — قبل النشر

- [ ] PostgreSQL Adapter مكتمل ويستخدم `DATABASE_URL` فعلياً.
- [ ] Migrations مطبقة على نسخة Staging.
- [ ] OIDC/RBAC مُراجع.
- [ ] TLS وSecret Manager جاهزان.
- [ ] Backup وRestore ناجحان.
- [ ] Tenant isolation test ناجح.
- [ ] k6 load test داخل الحدود.
- [ ] Runbook للـrollback جاهز.

### Gate B — Canary

1. انشر نسخة واحدة من API.
2. وجّه 1% من الطلبات غير الحرجة.
3. راقب 15–30 دقيقة.
4. تحقق من latency و5xx وlock waits وdeadlocks.
5. لا تفتح `DESTROY` في Canary.

### Gate C — التوسع

- 10% ثم 25% ثم 50% ثم 100%.
- لا تنتقل للمرحلة التالية إذا فشل أي threshold.
- استخدم expand/contract migrations عند تغيير المخطط.
- نفّذ rollback للتطبيق دون rollback تلقائي لبيانات ناجحة؛ البيانات تحتاج forward-fix آمن.

## 9. تشغيل اختبار الأداء الموزع باستخدام k6

الملف:

```text
loadtests/recall-disposition.js
```

الاختبار ينفذ مزيجاً من:

- إنشاء Disposition/HOLD لطلبات Recall موجودة مسبقاً.
- قراءة Dashboard.
- Idempotency key فريد لكل طلب.
- قياس business outcomes والتأخير.

### تشغيل محلي عبر k6

```bash
export BASE_URL=https://staging.example.com
export PILOT_TOKEN='short-lived-load-test-token'
export RECALL_BATCHES='BATCH-A,BATCH-B,BATCH-C,BATCH-D'
export START_RATE=20
export RAMP_RATE=200
export HOLD_RATE=500
export PREALLOCATED_VUS=100
export MAX_VUS=2000

k6 run loadtests/recall-disposition.js
```

### تشغيل عبر Compose

```bash
docker compose --env-file deploy/.env \
  -f deploy/compose.postgres.yml \
  --profile loadtest run --rm k6
```

لا تشغّل اختبار الحمل على Production الحقيقي قبل موافقة Change Management. استخدم Tenant وبيانات اختبار منفصلة.

## 10. سيناريوهات الحمل المقترحة

### Baseline

- 10 requests/sec لمدة 10 دقائق.
- الهدف: خط أساس latency وconnection pool.

### Ramp-up

- 20 → 200 requests/sec خلال دقيقتين.
- ثم 500 requests/sec لمدة 5 دقائق.
- ثم ramp-down خلال دقيقتين.

### Contention

- نفس `item|batch|warehouse` من آلاف الطلبات.
- النتيجة الصحيحة ليست نجاح الجميع؛ المتوقع نجاح واحد ورفض الباقي بشكل business-safe، من دون 5xx أو Ledger corruption.

### Approval storm

- طلبات موافقة لنفس Disposition من أدوار مختلفة.
- يجب أن تنجح موافقتان فقط، ويُرفض تكرار الدور.

### Retry storm

- إعادة إرسال نفس Idempotency-Key عدة مرات.
- يجب أن تعود نفس النتيجة دون duplicate Ledger/Audit.

### Failure injection

اختبر في Staging فقط:

- إيقاف API أثناء Transaction.
- قطع الاتصال بقاعدة البيانات.
- زيادة lock contention.
- قتل worker قبل Commit وبعد Commit.
- إعادة المحاولة بعد timeout.

ثم تحقق من عدم وجود حالة نصف منفذة.

## 11. معايير النجاح

ابدأ بهذه الحدود، ثم عدّلها بعد Baseline حقيقي:

```text
HTTP 5xx rate             < 1%
HTTP p95                  < 500 ms
HTTP p99                  < 1,000 ms
Business-safe outcomes    > 99%
Idempotency duplicates    0 duplicate effects
Ledger integrity          PASS
Audit integrity           PASS
Deadlocks                 0 غير مُعالج
Lock timeout              < 0.1%
Database CPU              < 70% في steady state
Connection pool           < 80% من الحد
Replication lag           < 5 seconds
```

يجب التفريق بين HTTP success وBusiness success: `409` المتوقع بسبب طلب تصرف موجود قد يكون نتيجة سليمة، بينما `500` أو Ledger mismatch فشل حقيقي.

## 12. قراءة النتائج

احفظ:

- نسخة الكود والـimage digest.
- إعدادات k6 كاملة.
- عدد VUs وarrival rate.
- زمن الاختبار.
- PostgreSQL CPU/RAM/IOPS.
- pool utilization.
- locks وdeadlocks.
- p50/p95/p99.
- error codes.
- عدد Ledger/Audit events قبل وبعد.

لا تعتمد على متوسط latency وحده؛ القرار يكون من p95/p99 وBusiness invariants.

## 13. قرار الانتقال النهائي

لا يصبح AtMoS جاهزاً للإنتاج المؤسسي إلا بعد تحقق الآتي معاً:

```text
OIDC/RBAC حقيقي
+ PostgreSQL Adapter فعلي
+ Transactions مع FOR UPDATE
+ Idempotency وRetry policy
+ Backup/Restore مجرّب
+ k6 موزع داخل Staging
+ Tenant isolation
+ Observability وAlerting
+ Canary وRollback runbook
= Production readiness
```
