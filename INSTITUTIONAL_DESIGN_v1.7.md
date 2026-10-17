# OmNi Institutional Ledger v1.7 — Design Baseline

## الهدف
إضافة طبقة محاسبية/رقابية مؤسسية فوق OmNi WMS دون تغيير مصدر الحقيقة التشغيلي الحالي.

## حدود الإصدار
- Double-entry journal بالقرش كعدد صحيح.
- Chart of Accounts أساسي.
- Open/Close periods.
- Maker/Checker.
- Idempotency عبر externalRef.
- Reversal بدل تعديل القيد المرحّل.
- Trial Balance.
- Reconciliation workflow رقمي.
- SHA-256 audit chain.
- Bridge استلام WMS → Inventory/GRNI.
- Bridge صرف WMS → COGS/Inventory فقط إذا كانت تكلفة الصرف محددة.

## مبادئ التحكم
1. WMS ledger وInstitutional journal ليسا سجلًا واحدًا.
2. لا قيد محاسبي غير متوازن.
3. لا ترحيل في فترة مقفولة.
4. Maker لا يعتمد قيده.
5. التكرار الخارجي لا ينشئ قيدًا ثانيًا.
6. التصحيح يتم بعكس قيد، لا بتعديل صامت.
7. كل bridge له externalRef ثابت.
8. التكلفة غير المعروفة لا يتم اختراعها.

## ما لم يتم ادعاؤه
- لا يوجد حتى الآن تكامل ERP فعلي.
- لا يوجد Tax/VAT engine.
- لا يوجد Multi-currency.
- لا توجد Consolidation أو intercompany.
- لا توجد سياسة costing نهائية (FIFO/weighted average/standard) معتمدة ميدانيًا.
- لا توجد صلاحيات مؤسسية مرتبطة بمزوّد هوية خارجي.
- لا يوجد اعتماد قانوني/محاسبي.

## قرار معماري
لن نخلط physical layout المؤجل للقياس مع الطبقة المحاسبية. القياسات الميدانية ستدخل لاحقًا كـMaster Data موثقة ومؤرخة، مع provenance.
