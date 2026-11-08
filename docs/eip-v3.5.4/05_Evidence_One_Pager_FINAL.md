# 05 — ورقة الأدلة (صفحة واحدة): كل رقم في الـDeck ← الملف ← الأمر
**المسار:** `code/AtMoS_v3.5.4/` · **التحضير:** `npm ci` مرة واحدة. **افتح الورقة دي في أي سؤال «دليلك إيه؟»**

> **القاعدة:** قول الرقم + قيده في نفس الجملة. مثال: «102 من 102 فخ اصطناعي اتمنعوا، على fixture حتمي مش بيانات إنتاج.»

## أ) أرقام الشرايح
| الرقم/الادعاء في الـDeck | الدليل (ملف) | الأمر اللي بيثبته | النتيجة المتوقعة | القيد (لازم يتقال) |
|---|---|---|---|---|
| **2,000** معاملة workload | `fixtures/synthetic-workload-report.json` → `workloadMetrics.totalWorkloadTransactions` | `npm run test:synthetic` | 3 pass / 0 fail | Fixture حتمي (seed 20261020)، مش إنتاج |
| **1,899** أمر اتنشأ واتنفذ | نفس الملف → `salesOrdersCreated` | نفسه | — | اصطناعي |
| **102** فخ مُحقن (صلاحية منتهية، تشغيلة غلط، دور غير مصرح) | → `chaosScenariosInjected` | نفسه | — | اصطناعي |
| **102 من 102** اتمنعوا | → `hardBlocksEnforced` | نفسه | 102 = 102 | **لا تقل «100% دقة»**. دي داخل السيناريو ده بس |
| **صفر تغيير في الحالة عند الخطأ** | → `stateMutationOnFault: 0` | نفسه | 0 | داخل السيناريو فقط |
| **سلامة Ledger وAudit** (1,906 قيد، 13,989 حدث) | → `cryptographicProof` | `npm run test:stress` | `ledgerIntegrity: true`, `auditIntegrity: true` | الـHash **بيكشف التلاعب**، مش تشفير ولا توقيع قانوني |
| **«AI يقترح، القواعد تقرر»** | `domain.mjs` + `amd_omni_pipeline.mjs` | `npm test` | exit 0 | ليس اعتماداً تنظيمياً |
| **دفعة منتهية الصلاحية ممنوعة** `EXPIRED_GOODS` | `tests.mjs` | `npm test` | exit 0 | بوابة الصلاحية على الأصناف الدوائية فقط |
| **Recall: حجر + منع Pick** `RECALLED_BATCH` | `tests.mjs` + `tests/disposition-stress.mjs` | `npm run test:stress` | 500 محاولة: **1 نجاح، 499 رفض** | نطاق مخزن محدد، مش Multi-warehouse |
| **التصرف في Recall بموافقتين + منفذ ثالث** | `domain.mjs` (Disposition) + `tests/pilot-rbac-persistence.test.mjs` | `npm run test:pilot` | pass | بيانات تجريبية |
| **PostgreSQL حقيقي** (معاملات، قفل، Tenant isolation، جداول مفككة) | `pilot-postgres.mjs`, `normalized-postgres.mjs`, `tests/*integration*` | `DATABASE_URL=... npm run test:postgres` | 5/5 | **شغّلته محلياً**؛ مش HA ولا Staging |
| **Backup/Restore** | `scripts/backup-restore-drill.mjs` | `npm run db:backup-drill` | `pass: true`, RPO = 0 | حجم بيانات صغير جداً |
| **OIDC** (توقيع، nonce، tenant، roles) | `oidc.mjs`, `tests/oidc*.test.mjs` | `npm run test:oidc` | pass | **محاكاة محلية**، مش Entra حي |
| **12 ادعاء/حد متحقق منهم** | `PITCH_EVIDENCE_PACK_AR.md` + `scripts/verify-pitch-evidence.mjs` | `npm run verify:pitch` | `PASS: 12 claims/limits` | — |
| **الإصدار سليم** (160 ملف، SHA-256) | `RELEASE_MANIFEST.json` | `npm run verify:release` | `Release verification PASS` | — |
| **Shadow أولاً، `NOT_READY`** | `pilot-governance-status.json` | افتح الملف | `"pilotStatus": "NOT_READY"` | يعني: ما فيش Pilot قائم |
| **Apache-2.0** | `LICENSE` + `package.json` | افتح الملف | — | — |

## ب) أرقام السوق (من برّه الكود)
| الرقم | المصدر | قيده |
|---|---|---|
| 56,710 صيدلية سجّلت، 20,321,303 وحدة منتهية | تصريحات هيئة الدواء المصرية (مبادرة 2025، قرارات 47/389/519) | بتثبت إن المشكلة وطنية. **مش** عدد وحدات بوابتنا هتمنعها |
| سحب 17,247,051 وحدة (94.2%) في مرحلة الموزعين | نفسه | أغلبها كان على رفوف الصيدليات |

## ج) اللي **ما عندوش دليل** (ما تقولوش كحقيقة)
عملاء/LOIs · إيراد · أسعار · حجم سوق قابل للاستهداف · k6 على Staging · Entra حي · GitHub CI (تأكد إنه أخضر بنفسك) · أي أداء حقيقي بالـms · خبرة مخازن سابقة · اعتماد تنظيمي · Multi-warehouse Recall · مرتجعات العملاء.

## د) 10 ثواني قبل العرض
1. `npm test` يطلع exit 0. 2. `npm run verify:pitch` PASS. 3. شارة `SYNTHETIC / NOT PRODUCTION` ظاهرة. 4. الديمو بوضع الطيران. 5. افتح الورقة دي في تبويب.
