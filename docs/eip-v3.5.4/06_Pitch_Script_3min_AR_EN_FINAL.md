# 06 — سكريبت العرض 3 دقايق (مطابق للشرايح) — إنجليزي + عربي
**الـDeck:** `AtMoS / EIP 3-Minute Pitch` (7 شرائح) **بعد التعديلات في القسم 1 تحت.** السكريبت مكتوب على النص المعدّل.
**السرعة:** حوالي 130 كلمة/دقيقة. **تدرب عليه بتوقيت**، وقص من الشريحة 5 أو 6 لو المدة أقصر (القسم 4).

## 1) تعديلات لازم تتعمل على الـDeck (عشان السكريبت يطابقه حرفياً)
| الشريحة | غيّر | إلى |
|---|---|---|
| 2 | «Increased risk of dispensing expired batches» | «Increased risk of **releasing** expired batches» |
| 4 | **«100% FAIL-CLOSED ACCURACY»** | **«102 / 102 INJECTED FAULTS BLOCKED»** |
| 4 | «CI validation includes normalized PostgreSQL, tenant isolation, and local OIDC protocol tests.» | «PostgreSQL, tenant-isolation and local OIDC tests run locally and are defined in CI.» |
| 5 | صندوق Target Customer | أضف سطر: «Economic buyer: head of operations or quality (hypothesis to validate)» |
| 6 | «Next Milestone: Staging Validation · Nov 2026 / Pilot Phase 1 · Dec 2026» | «**Target:** Staging validation Nov 2026 · Pilot Phase 1 Dec 2026 (subject to partner agreement)» |
| الكل | لا تعرض أي أرقام latency | — |

## 2) النص الإنجليزي (356 كلمة ≈ 2:45 بسرعة عادية، وفاضل هامش للوقفات)

**[Slide 1 · 0:00–0:10]**
"Good morning. I'm Ahmed, a solo founder from Egypt. AtMoS lets AI assist pharmaceutical operations without letting AI decide what enters your stock."

**[Slide 2 · 0:10–0:40] — Problem**
"Critical inventory decisions are hard to inspect. An AI can read an invoice and propose plausible but unsafe values: a wrong expiry, a wrong batch, a wrong quantity. Information moves between invoices, messages and legacy systems, and the decision trail is lost. And when a recall happens, finding and blocking the affected stock can take hours of manual reconstruction. Human review alone is an alert, not a control."

**[Slide 3 · 0:40–1:15] — Approach**
"Our approach has three steps. First, AI perception: a model extracts fields from invoice text, and we treat that output as untrusted. Second, a deterministic policy gate validates SKU, expiry, batch and the user's role before anything changes. Third, audit evidence: a hash-linked ledger and a state seal for every decision. The core rule is simple: the model never writes inventory balances. AI proposes; the deterministic core executes."

**[Slide 4 · 1:15–1:50] — What is proven**
"What is proven today? On a reproducible synthetic fixture, 2,000 workload transactions, with 102 faults injected on purpose: expired goods, batch mismatches, unauthorized roles. All 102 were blocked, with no change to the inventory state. To be clear: this is synthetic, deterministic data. It is not production data, and it is not a capacity claim. The code is open under Apache-2.0, and the tests run on PostgreSQL and a local OIDC simulation."

**[Slide 5 · 1:50–2:25] — Pilot**
"Our first customer is a mid-sized pharma distributor or pharmacy chain with a central warehouse. The pilot is a six-to-eight-week shadow deployment at one site. AtMoS runs in parallel with the existing system and has no operational authority. We measure evidence completeness, exception handling and manual rework against a baseline. Only after that do we discuss limited enforcement on selected high-risk receipt gates."

**[Slide 6 · 2:25–2:50] — Ask**
"Our ask is focused: fund validation, not complexity. A secure staging environment, real identity integration, one site, and user testing. The payoff is documented evidence on safety, efficiency and adoption. We're also looking for one distributor to be our design partner. We have no customers yet, and we'd rather prove value than promise it."

**[Slide 7 · 2:50–3:00] — Mission**
"Safer to inspect. Harder to bypass. Thank you."

## 3) النص العربي (للتدريب، ولو العرض بالعربي مقبول بعد سؤال الورشة رقم 6)

**[1]** «صباح الخير. أنا أحمد، مؤسس منفرد من مصر. AtMoS بيخلي الذكاء الاصطناعي يساعد في العمليات الدوائية من غير ما يقرر هو إيه اللي يدخل المخزون.»

**[2]** «قرارات المخزون الحرجة صعب مراجعتها. الذكاء الاصطناعي ممكن يقرا الفاتورة ويقترح قيم تبان منطقية بس مش آمنة: تاريخ صلاحية غلط، أو تشغيلة غلط، أو كمية غلط. والمعلومات بتتنقل بين فواتير ورسائل وأنظمة قديمة وبيضيع أثر القرار. ولما يحصل Recall، تحديد المخزون المتأثر ومنعه ممكن ياخد ساعات من إعادة البناء اليدوي. المراجعة البشرية لوحدها إنذار، مش تحكم.»

**[3]** «فكرتنا على ثلاث خطوات. أولاً الذكاء الاصطناعي بيقرا ويستخرج الحقول، وإحنا بنعتبر مخرجاته غير موثوقة. ثانياً بوابة قواعد حتمية بتتحقق من الصنف والصلاحية والتشغيلة ودور المستخدم قبل أي تغيير. ثالثاً دليل تدقيق: سجل مترابط بالـHash وختم للحالة لكل قرار. القاعدة الأساسية: النموذج عمره ما بيكتب أرصدة المخزون. هو يقترح، والنواة الحتمية تنفذ.»

**[4]** «إيه اللي اتثبت النهارده؟ على بيانات اصطناعية قابلة لإعادة التشغيل: 2000 معاملة، وحقنّا 102 خطأ عمداً: صلاحية منتهية، وتشغيلة غير مطابقة، ودور غير مصرح. الـ102 كلهم اتمنعوا، ومن غير أي تغيير في حالة المخزون. وللأمانة: دي بيانات اصطناعية حتمية، مش بيانات إنتاج، ومش ادعاء عن القدرة التشغيلية. الكود مفتوح بترخيص Apache-2.0، والاختبارات بتشتغل على PostgreSQL ومحاكاة OIDC محلية.»

**[5]** «أول عميل: موزع دوائي متوسط أو سلسلة صيدليات لها مخزن مركزي. الـPilot ست لتمان أسابيع Shadow في موقع واحد. AtMoS بيشتغل بالتوازي مع النظام الحالي وملوش أي سلطة تشغيلية. بنقيس اكتمال الأدلة ومعالجة الاستثناءات وإعادة العمل اليدوي مقابل خط أساس. وبعد كده بس نتناقش في تطبيق محدود على بوابات الاستلام عالية الخطورة.»

**[6]** «طلبنا محدد: تمويل التحقق، مش التعقيد. بيئة Staging آمنة، وتكامل هوية حقيقي، وموقع واحد، واختبار مستخدمين. العائد: دليل موثق عن الأمان والكفاءة والتبني. وبندوّر كمان على موزع واحد يكون شريك تصميم. لسه ما عندناش عملاء، وبنفضّل نثبت القيمة قبل ما نوعد بيها.»

**[7]** «أكثر قابلية للفحص. أصعب في التجاوز. شكراً.»

## 4) نسخ مقصوصة
- **دقيقتين:** احذف الشريحة 5 كلاماً (اكتفِ بجملة: «Six-to-eight-week shadow pilot at one site, no operational authority»)، واختصر الشريحة 2 لجملتين.
- **دقيقة (Elevator):** «AI reads, rules decide, evidence proves. Tested on 102 injected faults in a synthetic fixture: all blocked. Looking for one distributor design partner for a shadow pilot.»

## 5) نصائح أداء
- **قبل أي رقم، قول «synthetic».** مرة واحدة واضحة تكفي.
- ما تقولش «100%». قول «102 من 102».
- عند «We have no customers yet» وقفة نص ثانية. دي أقوى جملة صدق في العرض.
- تدرب 10 مرات: 3 قدام مراية، 3 بتسجيل صوت، 2 قدام شخص، 2 بالديمو.
