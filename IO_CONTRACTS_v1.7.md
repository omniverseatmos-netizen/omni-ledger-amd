# OmNi I/O Contracts v1.7

الغرض: منع الإدخال/الإخراج الحر من كسر الحقيقة التشغيلية أو المحاسبية.

## Input pipeline
`RAW INPUT → SCHEMA VALIDATION → MASTER DATA CHECK → BUSINESS RULES → AUTHORIZATION → IDEMPOTENCY → COMMIT → AUDIT`

أي مرحلة فاشلة = لا Commit.

## Canonical identifiers
- Item: `itemCode`
- Batch: `batch`
- Warehouse: `warehouseCode`
- Location: `locationKey`
- Purchase Order: `PO-*`
- Goods Receipt: `GR-*`
- Sales Order: `SO-*`
- Journal: `JE-*`
- Reconciliation: `REC-*`

## External reference rule
كل تكامل خارجي يجب أن يرسل `externalRef` ثابتًا. تكرار نفس المرجع لا ينشئ حركة ثانية.

## Output envelope (design baseline)
```json
{
  "schemaVersion": "1.0",
  "requestId": "...",
  "status": "OK|BLOCKED|ERROR",
  "data": {},
  "errors": [],
  "warnings": [],
  "evidence": {"sourceType":"...","sourceId":"..."}
}
```

هذا envelope مواصفة تصميمية في v1.7؛ لا توجد طبقة HTTP/API فعلية في هذا الإصدار.

## Error principles
- Error codes ثابتة وقابلة للبرمجة.
- الرسالة العربية للإنسان، والكود للآلة.
- لا fallback صامت.
- لا تخمين في هوية الصنف/التشغيلة/الحساب.
- أي Block يجب أن يوضح سبب المنع ومصدره.
