# AtMoS Pilot — RBAC وPersistence وConcurrency

## النطاق

هذه طبقة Pilot منفصلة عن نسخة المسابقة. `pilot-server.mjs` يشغل API على المنفذ 4180 افتراضياً، بينما تظل `server.mjs` واجهة الحكم الثابتة كما هي.

## الهوية والصلاحيات

الخدمة الحالية تستخدم هوية محلية Pilot للتجربة الآمنة:

- كلمات المرور تُخزّن كـ scrypt hash، ولا تُخزّن بصورتها الأصلية.
- الجلسة تحمل opaque bearer token، ويُخزّن SHA-256 digest فقط.
- مدة الجلسة 8 ساعات.
- كل جلسة مرتبطة بـ tenant وuser.
- الصلاحيات مبنية على أدوار دقيقة:
  - `recall_operator`: إنشاء Recall/Disposition.
  - `quality_officer`: اعتماد الجودة.
  - `qa_manager`: اعتماد QA.
  - `operations_manager`: التنفيذ.
  - `auditor`: القراءة والأدلة.
  - `pilot_admin`: إدارة كاملة في Pilot فقط.

في الإنتاج لا يُفضّل إبقاء كلمة المرور المحلية؛ يُستبدل login بـ OIDC/SAML/Entra ID ويصل `external_subject` إلى جدول users.

## API

```text
POST /v1/bootstrap
POST /v1/auth/login
GET  /v1/me
GET  /v1/dispositions/dashboard
POST /v1/dispositions
POST /v1/dispositions/:id/approve
POST /v1/dispositions/:id/execute
```

كل عملية تغيير تتطلب `Idempotency-Key` لا يقل عن 16 حرفاً. إعادة إرسال الطلب بنفس المفتاح تعيد نفس النتيجة ولا تنفذ الأثر مرة ثانية.
استخدام نفس المفتاح مع Payload مختلف يُرفض كـ `IDEMPOTENCY_CONFLICT`. نقطة `bootstrap` مغلقة افتراضياً؛ في بيئة الإنتاج يلزم `PILOT_BOOTSTRAP_TOKEN` سري بطول 32 حرفاً على الأقل عبر header اسمه `x-bootstrap-token`.

## Persistence الحالي

`PilotStore` هو adapter آمن بلا dependencies خارجية:

1. قفل ملف حصري `state.json.lock`.
2. قراءة أحدث Snapshot بعد الحصول على القفل.
3. تنفيذ transaction على نسخة عميقة.
4. زيادة `meta.version`.
5. كتابة ملف مؤقت بصلاحية 0600.
6. `rename` ذري إلى Snapshot النهائي.
7. تحرير القفل.

هذا مناسب لبيئة Demo/Pilot أحادية العملية، وليس قاعدة بيانات إنتاج متعددة العقد.

## تصميم الإنتاج

المخطط المرجعي موجود في `schema/pilot-postgres.sql` ويحتوي على:

- tenants/users/sessions.
- roles/permissions/user_roles/role_permissions.
- recalls/disposition_requests.
- idempotency_keys.

المعاملة الصحيحة تقفل بالترتيب الثابت:

```sql
BEGIN;
SELECT * FROM recalls WHERE tenant_id = $1 AND item_code = $2 AND batch = $3 FOR UPDATE;
SELECT * FROM disposition_requests WHERE tenant_id = $1 AND id = $2 FOR UPDATE;
-- فحص RBAC وversion وidempotency
-- كتابة Ledger وDisposition في نفس المعاملة
COMMIT;
```

لا يتم قفل زر الواجهة فقط. يجب قفل Recall والتخصيصات/الأرصدة المتأثرة بترتيب ثابت لمنع deadlock، مع optimistic `version` وunique constraint على `(tenant_id, item_code, batch)`.

## اختبارات التشغيل

```bash
npm run test:pilot
npm run test:stress
PILOT_PORT=4180 npm run pilot:serve
```

اختبارات Pilot تثبت:

- رفض كلمة المرور الخاطئة.
- رفض مستخدم بلا صلاحية Dashboard.
- منع إنشاء Disposition دون Idempotency-Key.
- إعادة نفس النتيجة عند replay.
- منع منشئ الطلب من اعتماده.
- منع دور الاعتماد المكرر.
- تنفيذ الطلب بعد موافقتين مختلفتين.
- 100 transaction متزامنة مع version متسلسل دون فقدان تحديث.

## الانتقال إلى Pilot مؤسسي

قبل استخدام بيانات حقيقية: OIDC، PostgreSQL، migrations، secret manager، TLS/reverse proxy، rate limits، audit export، backups، recovery drill، k6 HTTP load test، وtenant isolation review.
