# AtMoS v3.4.2 — Deterministic Policy Experts

هذه المرحلة تنقل فكرة Policy Experts من توصية معمارية إلى واجهة حتمية قابلة للاختبار، من دون تغيير سلوك النواة الحالية أو الادعاء بزمن استجابة صفري.

## ما تمت إضافته

- `policy-experts.mjs`: سجل خبراء مستقل بلا I/O أو اعتماد على نموذج احتمالي.
- اختيار الخبراء بترتيب ثابت: `priority` ثم `id`.
- تقييم lazy: لا يتم تحميل أو تنفيذ الخبير إلا عندما يطابق سياق العملية.
- خبراء أساسيون:
  - `fefo-expiry`: يمنع التشغيلة المنتهية.
  - `cold-chain`: يتحقق من مجال الحرارة وقراءة القياس.
  - `controlled-substance`: يفرض موافقتين من منفذين مختلفين.
- `buildDeterministicPrefetchPlan`: ينتج مفاتيح قراءة ثابتة للـHot/Warm/Policy state مع إزالة التكرار.
- `policy-shadow.mjs`: وضعا `shadow` و`enforce` خلف opt-in flag؛ الوضع الافتراضي `off`.
- مسارات `createReceipt` و`allocateSO` و`confirmPick` تجري مقارنة shadow قبل أي mutation، ولا تغيّر دفتر الحالة أو `toJSON()`.

## قرار السلامة

الوضع الافتراضي لا يستبدل قواعد `domain.mjs`. عند تمرير `new OmNiCore({ policyExpertsMode: 'shadow' })` تُسجّل المقارنة في `policyShadowReport()` من دون رفض العملية. وعند استخدام `enforce` فقط تُمنع المخالفة الجديدة التي لا يمنعها الحارس القديم. لا تُضمّن إحصاءات shadow داخل `toJSON()` ولا داخل hash دفتر الحالة.

## حدود الأداء

خطة prefetch تصف المفاتيح المطلوبة ولا تنفذ قراءة من SQLite أو PostgreSQL أو UFS. لذلك لا يوجد ادعاء `0ms latency`. القياس الحقيقي يجب أن يستخدم بيانات تشغيل كبيرة، جهاز staging مماثل، وقياسات p50/p95/p99 مع استهلاك الذاكرة.

## تشغيل الاختبارات

```bash
npm test
node --test tests/policy-experts.test.mjs
```

## الخطوات التالية بعد هذه المرحلة

1. توصيل plan بالـread model أو cache خلف feature flag.
2. إضافة shadow evaluation لمسارات `allocateSO` و`pickSO` بعد جمع عينات كافية من `createReceipt`.
3. إنشاء بيانات staging غير حساسة لاختبار k6 الموزع.
4. اختبار Entra ID الحقيقي لكل دور قبل تعطيل المسار المحلي نهائيًا.
