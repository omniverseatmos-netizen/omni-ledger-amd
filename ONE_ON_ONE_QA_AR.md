# بنك Q&A لجلسة 1-on-1 — AtMoS

## قاعدة الإجابة

ابدأ بما هو مثبت، افصل بين prototype وPilot والإنتاج، ثم اختم بخطوة قابلة للقياس. لا تحاول ربح السؤال بادعاء أكبر من الدليل.

## 1) ما المختلف عن نظام WMS أو ERP عادي؟

AtMoS ليس بديلًا عن WMS/ERP في هذه المرحلة. هو control boundary يركز على القرارات الحساسة: هل يمكن قبول الحركة؟ هل batch صالح؟ هل recall يمنع الالتقاط؟ ومن صاحب الصلاحية؟ القيمة المقترحة هي جعل AI طبقة اقتراح لا طبقة قرار، وإضافة evidence قابل للمراجعة حول انتقالات الحالة.

## 2) هل أنت تقول إن الذكاء الاصطناعي غير موثوق؟

لا. أستخدمه حيث يفيد: استخراج حقول الفاتورة وتقليل العمل اليدوي. لكن استخراج النص ليس هو authorization. لذلك أفصل بين perception وvalidation وcontrol وproof، وأصمم النظام بحيث لا يستطيع model output وحده تغيير المخزون.

## 3) أين الدليل أن الحل يعمل؟

في النسخة v3.5.4 توجد بوابة deterministic قابلة للتجربة، واختبارات محلية، واختبارات PostgreSQL حقيقية، وHTTP E2E من 25 حالة، وparity وbackup/restore. في الديمو، fixture منتهي الصلاحية يرجع `EXPIRED_GOODS`، وبعد recall يمنع pick بـ`RECALLED_BATCH`، وتظل الأحداث قابلة للتحقق. هذه أدلة prototype، وليست دليل production أو عميل مدفوع.

## 4) لماذا تقول 42 اختبارًا وليس 100%؟

لأنني أريد أن يكون الرقم قابلًا للتدقيق: تقرير الإصدار يسجل 42 نجاحًا و0 فشل و6 حالات متخطاة عندما لا تكون PostgreSQL متاحة، بينما suite PostgreSQL المنفصل اجتاز 6/6. لا أختصر ذلك في شعار 100%.

## 5) هل أرقام 70 و30 حقيقية؟

لا. هي fictional demonstration records داخل سيناريو محلي لتوضيح الفرق بين المتاح الذي تم حجزه والشحنات المسجلة سابقًا. لا تمثل عميلًا أو مخزنًا حقيقيًا.

## 6) هل لديك عميل أو خطاب نوايا؟

ليس لدي عميل مدفوع أو خطاب نوايا أقدمه كدليل. المرحلة الصحيحة الآن هي design partner من موزع واحد، بإذن وبيانات مجهّأة، ثم baseline وShadow Mode قبل أي enforcement.

## 7) ما أول Pilot منطقي؟

نطاق صغير: موزع واحد، workflow واحد مثل receiving + recall، وعدد محدود من المستخدمين والأدوار. يبدأ بـ read-only أو Shadow Mode، مع baseline لزمن المعالجة، عدد الاستثناءات، محاولات الحركة المرفوضة، ونسبة الحالات التي احتاجت مراجعة بشرية. لا نربط القرار بنتائج غير قابلة للعكس قبل موافقة واضحة.

## 8) ما مؤشرات النجاح؟

أقيس أربع مجموعات: سلامة التحكم، مثل عدم وجود حركة مقبولة تتجاوز قاعدة مفعّلة؛ دقة التشغيل، مثل false-positive review rate؛ زمن العمل، مثل زمن invoice-to-decision ووقت حل الاستثناء؛ وقابلية التدقيق، مثل اكتمال evidence ووضوح من وافق ومتى. يحدد الشريك baseline والعتبات قبل التجربة.

## 9) هل النظام جاهز للإنتاج؟

لا. هو technical-evaluation prototype قوي نسبيًا مع normalized PostgreSQL وtenant isolation وOIDC ومسارات load testing، لكن production يحتاج شريكًا، بيانات حقيقية مجهّأة، مراجعة أمن مستقلة، HA، staging حقيقي، Entra حي، وSLO مقاسًا على حمل واقعي.

## 10) ماذا عن الأداء؟

اختبار k6 المحلي سجل صفر أخطاء، لكن p95 تجاوز 500ms؛ لذلك لا أقدمه كـSLO إنتاجي. يوجد workflow موزع يدوي للـstaging لكنه لا يُشغّل بدون بيئة staging disposable وموافقة صريحة بعدم استهداف الإنتاج. الخطوة التالية هي قياس bottlenecks على بيانات وحجم شريك فعلي.

## 11) كيف تمنع الإنسان من تجاوز النظام؟

الواجهة لا تعدل المخزون مباشرة. الاستثناء له role وclaim وresolution مسجلان، وdisposition يحتاج موافقتين منفصلتين ثم operations executor. حتى حل المراجعة لا يمحو deterministic block ولا يكتب ledger خارج انتقال الحالة المسموح.

## 12) هل evidence يعني blockchain أو توقيعًا قانونيًا؟

لا. الموجود hash chains وstate seal وMerkle-root داخل النموذج لإظهار tamper-evident integrity وقابلية المراجعة. هذا ليس encryption ولا external attestation ولا legal digital signature.

## 13) هل لديك traceability كاملة حتى المريض؟

لا. ما هو منفذ حاليًا batch-level حتى warehouse dispatch المسجل. لا أدعي patient-level أو downstream sub-pharmacy أو individual GS1 serial tracking.

## 14) لماذا لا تجعل النظام offline بالكامل؟

لأن «offline بالكامل» ادعاء أوسع من الدليل. الديمو المحلي deterministic ولا يحتاج network من المتصفح، لكن live AMD inference مسار منفصل يحتاج بيئة وtoken. أقول بدقة: browser demo local؛ live inference خارج المتصفح.

## 15) ما دور AMD/Gemma؟

Gemma عبر AMD Token Factory يساعد في استخراج حقول الفاتورة. لا نضعه في final decision boundary. التحقق والقواعد وحركة المخزون تتم في deterministic core، ويمكن اختبار fixture محليًا بلا network. الـlive path يجب عرضه فقط عندما يكون token والبيئة متاحين وبشكل آمن.

## 16) لماذا PostgreSQL normalized الآن؟

لأن التوسع المؤسسي يحتاج فصلًا واضحًا للكيانات، tenant isolation، معاملات، parity، restore، ومفاتيح وعلاقات قابلة للتدقيق. تم الحفاظ على compatibility snapshot خلال migration window بدل إزالة المسار القديم فجأة.

## 17) ما خطة monetization أو business model؟

لا أحتاج أن أبيع قصة نهائية قبل إثبات workflow. الفرضية الأولية B2B pilot مدفوع أو design partnership لموزع واحد، ثم pricing مرتبط بعدد المواقع أو workflows أو حجم العمليات بعد معرفة تكلفة التشغيل وقيمة خفض المخاطر. لا أقدم revenue forecast غير مبني على بيانات.

## 18) ما الذي تحتاجه مني كخبير؟

أحتاج نقدًا في ثلاثة أمور: هل اختيار workflow الأول صحيح؟ ما الحد الأدنى من evidence المقبول في بيئة موزع؟ وما KPI الذي يوازن بين تقليل المخاطر وعدم تعطيل العمليات؟ كما أحتاج توجيهًا إلى design partner مناسب.

## 19) ما أكبر مخاطرة؟

ليست كتابة الكود فقط؛ بل إثبات ملاءمة workflow والحوكمة مع مستخدم حقيقي دون overclaiming. لذلك frozen scope وShadow Mode والموافقات والـbaseline أهم من إضافة مزايا كثيرة قبل وجود شريك.

## 20) ما الخطوة التالية خلال 30 يومًا؟

تثبيت شريك design واحد، توقيع حدود الوصول والخصوصية والملكية، mapping للعملية الحالية، تعريف baseline وacceptance criteria، تجهيز staging منفصل، تشغيل shadow read-only، ثم تقرير يجيب: ما الذي اكتشفه النظام؟ ما الذي منعه؟ كم تكلفة المراجعة؟ وهل يريد الشريك الانتقال إلى Pilot أضيق؟
