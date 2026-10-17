import { OmNiCore, seedDemo } from './domain.mjs';

// 1. الرابط الرسمي المعتمد من توثيق AMD Radeon Cloud
const AMD_API_KEY = process.env.AMD_TOKENFACTORY_API_KEY;
const AMD_BASE_URL = process.env.AMD_BASE_URL || "https://developer.amd.com.cn/radeon/api/v1";
const MODEL_NAME = "Gemma-4-31B-IT"; // نموذج جوجل المعتمد على AMD

function fresh() {
  const c = seedDemo(new OmNiCore());
  c.today = '2026-10-17';
  return c;
}

function processInvoiceIntoCore(core, data) {
  const po = core.createPO({
    supplierCode: 'SUP-001',
    warehouseCode: 'WH-OCT6',
    actor: 'procurement_buyer',
    lines: [{ itemCode: data.itemCode, orderedQty: data.qty, unitCostQirsh: data.unitPrice }]
  });
  core.poAction(po.id, 'SUBMITTED', 'procurement_buyer');
  core.poAction(po.id, 'APPROVED', 'warehouse_manager');
  
  const gr = core.createReceipt({
    poId: po.id,
    locationKey: 'WH-OCT6/A-01-01',
    actor: 'receiving_clerk',
    lines: [{
      poLineId: po.lines[0].id,
      receivedQty: data.qty,
      rejectedQty: 0,
      batch: data.batch,
      expiryDate: data.expiryDate
    }]
  });
  core.submitReceipt(gr.id, 'receiving_clerk');
  core.startInspection(gr.id, 'qc_officer');
  core.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: true }], 'qc_officer');
  core.postReceipt(gr.id, 'qc_officer');
  return gr;
}

async function extractInvoiceWithAMD(invoiceText) {
  console.log(`\n======================================================`);
  console.log(`[1/4] إرسال المستند إلى AMD Developer Cloud (ROCm GPU Acceleration)...`);
  console.log(`[Base URL]:    ${AMD_BASE_URL}`);
  console.log(`[Target Model]: ${MODEL_NAME}`);

  const systemPrompt = `You are a strict data extraction engine running on AMD Radeon Cloud.
Extract the inventory invoice into pure JSON only (no markdown, no backticks, no reasoning):
{"itemCode":"PARA-500","batch":"string","qty":100,"unitPrice":1250,"expiryDate":"YYYY-MM-DD"}`;

  const response = await fetch(`${AMD_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AMD_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: invoiceText }
      ],
      temperature: 0.0
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`AMD API Error: ${response.status} -> ${errBody}`);
  }

  const resJson = await response.json();
  const raw = resJson.choices[0].message.content.trim().replace(/```json|```/g, "");
  return JSON.parse(raw);
}

async function runDemo() {
  console.log("🚀 تشغيل منظومة OmNi-Ledger المدعومة بـ Gemma على معالجات AMD...");
  const core = fresh();
  console.log(`رصيد المخزن المبدئي لـ PARA-500: ${core.getBalance('PARA-500')} علبة`);

  // سيناريو 1: فاتورة مشبوهة بتاريخ منتهي (إثبات المنع الحتمي)
  const invoice1 = "فاتورة توريد دواء PARA-500 تشغيلة BATCH-EXP-99 كمية 50 تاريخ الصلاحية 2024-01-01 السعر 1250 قرش";
  const data1 = await extractInvoiceWithAMD(invoice1);
  console.log(`[2/4] تم الاستخراج بنجاح من نموذج Gemma:`, data1);
  console.log(`[3/4] فحص الفاتورة عبر محرك OmNi الحتمي (Deterministic Gate)...`);

  try {
    processInvoiceIntoCore(core, data1);
  } catch (err) {
    console.log(`\n🛡️ [HARD BLOCK ENFORCED]: السيستم رفض العملية حتمياً ومنع دخول الدواء!`);
    console.log(`السبب: [${err.code}] -> ${err.message}`);
  }

  // سيناريو 2: فاتورة سليمة معتمدة
  const invoice2 = "فاتورة توريد دواء PARA-500 تشغيلة BATCH-2027-OK كمية 100 تاريخ الصلاحية 2027-12-31 السعر 1250 قرش";
  console.log(`\n------------------------------------------------------`);
  const data2 = await extractInvoiceWithAMD(invoice2);
  console.log(`[2/4] تم الاستخراج بنجاح من نموذج Gemma:`, data2);
  console.log(`[4/4] اعتماد الشحنة وتسجيلها في الـ SHA-256 Ledger المشفر...`);

  processInvoiceIntoCore(core, data2);

  console.log(`\n✅ [شحنة معتمدة بنجاح]`);
  console.log(`الرصيد الفعلي الجديد في المخزن: ${core.getBalance('PARA-500')} علبة`);

  const lastEvent = core.audit[core.audit.length - 1];
  console.log(`\n📜 [سجل التدقيق المشفر - SHA-256 Event Chain]:`);
  console.log(`- Event ID:     ${lastEvent.id}`);
  console.log(`- Event Hash:   ${lastEvent.hash}`);
  console.log(`- Prev Hash:    ${lastEvent.prevHash}`);

  const seal = core.createSeal();
  console.log(`\n🔒 [ختم النزاهة المؤسسي - Merkle Root Seal]:`);
  console.log(`- Merkle Root:  ${seal.merkleRoot}`);
  console.log(`- State Hash:   ${seal.stateHash}`);
}

runDemo().catch(console.error);
