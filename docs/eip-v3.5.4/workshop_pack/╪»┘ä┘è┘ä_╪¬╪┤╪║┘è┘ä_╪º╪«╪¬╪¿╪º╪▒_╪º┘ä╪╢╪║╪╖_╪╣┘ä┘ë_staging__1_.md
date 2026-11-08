# دليل تشغيل اختبار الضغط على staging

## ما تم تجهيزه

أصبح Workflow `AtMoS staging distributed load test` يدويًا فقط عبر `workflow_dispatch`. يجب تفعيل اختيار `confirm_nonproduction` صراحة، ويمر أولًا عبر `/healthz` وقراءة dashboard قبل بدء k6. لا يعمل تلقائيًا على push ولا يستهدف الإنتاج. يستخدم `loadtests/distributed-recall.js` ويحمّل readiness ونتيجة JSON كـArtifact.

## أسرار البيئة المطلوبة

يجب إنشاء هذه الأسرار داخل GitHub Environment باسم `staging`:

- `ATMOS_STAGING_BASE_URL`: رابط staging فقط.
- `ATMOS_STAGING_PILOT_TOKEN`: token لحساب اختبار محدود الصلاحيات.
- `ATMOS_STAGING_RECALL_BATCHES`: قائمة تشغيلات اختبارية مفصولة بفواصل، مثل `K6-B1,K6-B2`.
- `ATMOS_STAGING_TENANT_ID`: معرف tenant للاختبار.

لا تُرسل الأسرار كـworkflow inputs ولا تُضع في الملفات أو logs.

## التشغيل الآمن

ابدأ بالقيم الافتراضية، ثم ارفع الحمل تدريجيًا. لا تعتمد نتيجة واحدة. يجب حفظ Artifact `k6-distributed-summary` مع CPU وIOPS وlocks واتصالات PostgreSQL من staging. إذا فشل health check أو dashboard smoke يجب عدم إعادة المحاولة قبل فحص سبب الفشل.

## OIDC / Entra ID

أضيف اختبار تكاملي محلي يحاكي discovery وJWKS وتوقيع RSA وتبادل token والتحقق من `nonce` و`tenant_id` و`roles`، من دون أسرار حقيقية. نجاحه لا يغني عن اختبار Entra tenant حقيقي، لكنه يمنع regressions في البروتوكول قبل استخدام بيانات الاعتماد الفعلية.

معايير التوقف المقترحة:

- `http_req_failed < 1%`.
- `p95 < 500ms` و`p99 < 1000ms`.
- `business_success > 99%`.
- لا توجد deadlocks غير معالجة أو نمو غير محدود في connection pool.

هذه thresholds أولية وليست SLO إنتاجيًا حتى تُقاس على حجم بيانات واقعي.

## Tiered Prefetch Cache

`policy-prefetch-cache.mjs` هو cache محدود لا يمثل مصدر الحقيقة. يحتفظ بطبقتي Hot/Warm، يروّج القراءة من Warm إلى Hot، ويطبق eviction حتميًا. لا يجب استخدامه لتجاوز PostgreSQL أو الدفتر؛ عند الفقد يجب العودة إلى read model الموثوق.
