# AtMoS Pitch Evidence Pack — النسخة الآمنة للورشة

## قاعدة العرض الأساسية

**كل ما يلي دليل prototype قابل لإعادة الإنتاج، وليس اعتمادًا إنتاجيًا أو موافقة تنظيمية.**

يجب نطق العبارة التالية عند عرض أرقام المحاكاة:

> “These workload and resilience figures come from a deterministic synthetic workshop fixture. They are not production measurements, customer data, or live capacity claims.”

## مصفوفة الادعاءات

| الادعاء | الدليل القابل لإعادة التشغيل | الحالة | الحد الذي يجب ذكره |
|---|---|---|---|
| الذكاء الاصطناعي لا يملك سلطة تغيير المخزون | `domain.mjs` + policy guards + tests | مثبت داخل النواة | ليس اعتمادًا تنظيميًا |
| الاستلام المنتهي يُمنع | `tests.mjs` و`simulate-workload.mjs` | مثبت على fixture | ليس اختبارًا ميدانيًا |
| Recall يفرض فصل الصلاحيات ويحرك المتاح للحجر | `recallBatch` + recall tests | مثبت داخل النواة | النطاق مخزن محدد، لا multi-warehouse |
| سلسلة Ledger وAudit قابلة للتحقق | `verifyLedgerIntegrity` و`verifyAuditIntegrity` | مثبت محليًا وداخل CI | hash chain ليست توقيعًا قانونيًا أو تشفيرًا |
| 2000 معاملة و102 فخ و100% منع | `fixtures/synthetic-workload-report.json` | Synthetic deterministic | ليست production capacity أو SLO |
| latency p50/p95/p99 | `logical-ms` model في fixture | نموذج منطقي حتمي | ليست wall-clock benchmark |
| PostgreSQL normalized schema يعمل في التكامل | GitHub CI PostgreSQL job | مثبت في container CI | ليس HA production evidence |
| OIDC يراجع signature/nonce/tenant/roles | `tests/oidc.integration.test.mjs` | محاكاة محلية RSA/JWKS | ليس اختبار Entra tenant حيًا |
| k6 موزع جاهز | `.github/workflows/staging-loadtest.yml` | جاهز يدويًا | لم يُشغّل بدون staging secrets |

## إضافة Levenshtein في نسخة الحكام v3.5.5
- `levenshtein.mjs` يحسب مسافة التحرير ويعرض مصفوفة البرمجة الديناميكية، ويصنف أسماء اصطناعية للشرح فقط.
- النتيجة اقتراح فقط (candidate suggestion)؛ لا توجد عتبة قبول أو اختيار تلقائي، ولا تُكتب حركة في المخزون.
- أضيفت اختبارات وحدة تغطي المسافات الأساسية، التطبيع، Unicode، أبعاد المصفوفة، وترتيب التعادل.
- لا ندعي أن Levenshtein وحده يثبت هوية الدواء أو ملاءمته؛ يجب التحقق من القوة والشكل والدفعة والصلاحية عبر المسار الحتمي ومراجعة بشرية.

## الأرقام الرسمية المعروضة

من التقرير الاصطناعي المثبت:

- 2,000 معاملة workload.
- 1,899 أمرًا منشأ ومكتملًا في السيناريو.
- 102 فخ اصطناعي.
- 102 منعًا ناجحًا.
- `100.00%` fail-closed accuracy داخل هذا السيناريو فقط.
- `stateMutationOnFault: 0` داخل هذا السيناريو فقط.
- `logical-ms`: p50 = 0.43، p95 = 0.52، p99 = 0.60.
- سلامة Ledger وAudit: `true`.

## ما لا نقوله

لا نقول: “production-ready”، “regulator-approved”، “patient-level traceability”، “real Giza network”، “real customer data”، “zero latency”، أو “100% safety in production”.

لا نعرض `WH-OCT6` أو أسماء الصيدليات الاصطناعية كجهات أو مواقع حقيقية. المعرفات هنا سيناريو عرض فقط.

## ترتيب العرض المقترح — 120 ثانية

1. **0–15 ثانية — المشكلة والحد الأمني:** النموذج يقترح؛ النواة الحتمية تقرر.
2. **15–35 ثانية — receiving gate:** اعرض fixture الصلاحية المنتهية، ثم قرار `EXPIRED_GOODS`.
3. **35–60 ثانية — recall:** اعرض reference، فصل الصلاحيات، نقل المتاح إلى quarantine، ومنع pick للتشغيلة المستدعاة.
4. **60–80 ثانية — evidence:** اعرض Ledger/Audit integrity وstate seal، مع عبارة أن hash chain ليست توقيعًا قانونيًا.
5. **80–100 ثانية — synthetic workload:** اعرض التقرير مع شارة `SYNTHETIC / NOT PRODUCTION`، واشرح seed وإمكانية إعادة التشغيل.
6. **100–115 ثانية — architecture readiness:** normalized PostgreSQL، tenant isolation، backup/restore، وOIDC integration test.
7. **115–120 ثانية — الخطوة التالية:** staging مصرح به، بيانات مجهولة، ثم k6 تدريجي؛ لا توجد مطالبة capacity قبل ذلك.

## قائمة قبل التسجيل

- شغّل `npm run verify:pitch`.
- شغّل `npm run test:synthetic`.
- اترك شارة `SYNTHETIC / NOT PRODUCTION` ظاهرة.
- لا تعرض أسرارًا أو cookies أو بريدًا شخصيًا.
- لا تعرض Workflow k6 كأنه نتيجة؛ هو readiness gate جاهز ولم يُشغّل دون staging.
- إذا سُئلت عن Entra، قل: “البروتوكول مغطى بمحاكاة RSA/JWKS محلية؛ الاختبار الحي مع tenant الحقيقي هو خطوة staging لاحقة.”
