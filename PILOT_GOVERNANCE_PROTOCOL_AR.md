# AtMoS Pilot Governance Protocol

## الحالة الافتراضية

```text
PILOT_STATUS: NOT_READY
OPERATING_MODE: SYNTHETIC_OR_DESKTOP_DEMO_ONLY
```

لا يجوز تغيير الحالة إلى `SHADOW_APPROVED` أو `ENFORCE_APPROVED` إلا بعد استكمال الحقول والتوقيعات والمراجعة البشرية. وجود هذا الملف لا يعني أن هناك Pilot ميدانيًا قائمًا.

## بوابة الموافقات

| البند | الحالة الابتدائية | المطلوب قبل التشغيل |
|---|---|---|
| تحديد الشريك والموقع | `MISSING` | اسم الجهة ونطاق الموقع كتابةً |
| إذن القياس | `MISSING` | مرجع إذن مكتوب وتاريخ ووردية ومسؤول |
| الخصوصية | `MISSING` | سياسة بيانات، أكواد مستخدمين، ومن يملك الوصول |
| الملكية الفكرية | `MISSING` | مراجعة حقوق الكود والاستخدام والمشاركة |
| مصدر البيانات | `MISSING` | نوع المصدر، owner، فترة البيانات، موافقة الاستخدام |
| baseline | `MISSING` | تعريف metric وطريقة القياس والفترة قبل Pilot |
| خطة الإيقاف | `MISSING` | من يوقف التجربة وكيف تحفظ الأدلة |
| خطة الحوادث | `MISSING` | جهة الاتصال والتصعيد وحفظ السجل |
| Shadow approval | `MISSING` | موافقة صريحة على التشغيل الموازي دون كتابة |
| Enforce approval | `NOT_ALLOWED` | لا يُراجع قبل اكتمال Shadow evidence |

## قواعد التشغيل

1. يبدأ Pilot في `SHADOW` فقط، ويظل النظام خارج مصدر الحقيقة التشغيلي للشريك.
2. لا توجد كتابة إلى ERP/WMS أو تغيير تلقائي في قرارات المخزن خلال Shadow.
3. كل سجل يستخدم `pilotRunId` و`permitRef` و`dataClassification`.
4. يستخدم النظام أقل قدر ممكن من البيانات، ولا تُستخدم بيانات مرضى.
5. يفضل استخدام أكواد للمستخدمين، ولا تعرض تقارير الأداء الفردي دون موافقة واضحة.
6. أي نتيجة بلا baseline تُسجل كـ`OBSERVATION` وليست نسبة تحسن.
7. أقل من 30 عينة لكل فئة ينتج `INSUFFICIENT_SAMPLE`.
8. أي فشل سلامة أو خصوصية يوقف التشغيل ويحفظ نسخة الأدلة قبل التحقيق.
9. لا يتم تفعيل Enforce إلا بقرار منفصل بعد مراجعة Shadow report.
10. أي تغيير في النطاق يعيد الموافقات المتأثرة إلى `MISSING`.

## بطاقة Pilot Run

```yaml
pilotRunId: "PILOT-YYYY-MM-DD-001"
partner: "TO_BE_FILLED"
site: "TO_BE_FILLED"
warehouse: "TO_BE_FILLED"
permitRef: "TO_BE_FILLED"
mode: "SHADOW"
dataClassification: "SYNTHETIC | ANONYMIZED | APPROVED_OPERATIONAL"
startDate: "TO_BE_FILLED"
endDate: "TO_BE_FILLED"
owners:
  business: "TO_BE_FILLED"
  quality: "TO_BE_FILLED"
  technical: "TO_BE_FILLED"
sourceOfTruth: "PARTNER_SYSTEM_UNCHANGED"
externalWrites: false
patientData: false
baselineRef: "TO_BE_FILLED"
stopOwner: "TO_BE_FILLED"
status: "NOT_READY"
```

## تصنيف الأدلة

- `SYNTHETIC`: بيانات مولدة محليًا للعرض أو الاختبار.
- `DEMO_FIXTURE`: سيناريو ثابت لا يمثل تشغيلًا حيًا.
- `OBSERVATION`: ملاحظة من مقابلة أو تشغيل، لا تكفي وحدها لإثبات أثر.
- `BASELINE`: قياس قبل Pilot بطريقة متفق عليها.
- `SHADOW_RESULT`: نتيجة تشغيل موازٍ مصرح به دون كتابة.
- `PRODUCTION_RESULT`: نتيجة تشغيل حقيقي بعد موافقة وإجراءات تشغيلية مستقلة.

لا يجوز دمج هذه التصنيفات في رقم واحد أو استبدال أحدها بالآخر.

## قرار الانتقال

### من Demo إلى Shadow

يتطلب: موافقة الموقع، إذن القياس، الخصوصية، IP review، مصدر بيانات معتمد، baseline plan، وخطة إيقاف.

### من Shadow إلى Enforce محدود

يتطلب: تقرير Shadow مختوم، سلامة السجلات، عينة كافية، عدم وجود حادث مفتوح، موافقة الجودة والعمليات، ونطاق enforce مكتوب مع rollback.

### من Pilot إلى Scale

يتطلب: مؤشرات نجاح متفق عليها، تقرير نهائي، مراجعة أمن وخصوصية، خطة دعم، وتأكيد أن النتائج ليست خاصة بموقع واحد فقط أو تفسيرًا زائدًا للعينة.

## سجل قرار مختصر

لكل قرار اكتب:

```text
Decision ID:
Date:
Scope:
Decision: CONTINUE | PAUSE | STOP | APPROVE_LIMITED_ENFORCE
Evidence refs:
Risks accepted:
Owner:
Reviewer:
Next review date:
```
