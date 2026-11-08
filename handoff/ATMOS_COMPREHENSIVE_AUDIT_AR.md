# تقرير التدقيق الشامل لمشروع AtMoS

**تاريخ التدقيق:** 20 أكتوبر 2026
**النطاق:** حزمة AtMoS المرفقة، مصدر v3.1، الحزمة النهائية `AtMoS_Final_v3.1.0_pilot_postgres-2.zip`، مخطط PostgreSQL، اختبارات Pilot، وثائق EIP، وحالة مستودع OmNi-Ledger العام.

## الحكم العام

الحزمة النهائية سليمة كـ **Pilot/Reference Implementation**. الفحوص المحلية نجحت: فحص صياغة 45 وحدة ES Module، مجموعة الاختبارات الكاملة، بوابة الإصدار، فحص HTTP، سياسة CSP، وmanifest SHA-256. نتائج الاختبار الآلي داخل Node هي 19 اختبارًا ناجحًا و0 فاشل، مع اختبارين PostgreSQL حقيقيين متخطّيين لأن بيئة التدقيق لا تحتوي `DATABASE_URL` ولا PostgreSQL تشغيلية.

لا يصح وصف النسخة الحالية بأنها Enterprise-ready أو أنها نفذت المرحلة الثانية والثالثة والرابعة بالكامل. الموجود الآن هو PostgreSQL-backed snapshot adapter مع معاملات وقفل صف وإعادة محاولة، فوقه Pilot RBAC وIdempotency. أما التطبيع الكامل للجداول، OIDC/Entra ID، واختبار k6 موزع ضد عدة replicas وقاعدة فعلية، فما زال في خارطة الطريق.

## ما تم إنجازه بشكل جيد

- المعاملة في `pilot-postgres.mjs` تستخدم `BEGIN` و`SET LOCAL lock_timeout` و`statement_timeout` و`SELECT ... FOR UPDATE` وتزيد version داخل المعاملة ثم تعمل `COMMIT`.
- تتم إعادة المحاولة على `40001` و`40P01`، ويحوّل lock timeout إلى نتيجة `409` واضحة.
- تخزين كلمة المرور يستخدم scrypt، والجلسات تخزّن digest للرمز بدل الرمز نفسه في الحالة.
- اختبارات Pilot تغطي RBAC، idempotency، فصل الأدوار، التزامن داخل الذاكرة، ومسار rollback نظريًا.
- خادم Pilot يتحقق من bootstrap secret في production ويضع حدود حجم الطلب وبعض HTTP security headers.
- الحزمة تفصل بوضوح بين Demo UI المحلي وبين AMD/Gemma CLI، ولا تضع مفتاح AMD في الواجهة.
- README وSCOPE_AND_LIMITATIONS صريحان بشأن كون البيانات خيالية وأن التتبع batch-level وأن النسخة ليست نظامًا دوائيًا معتمدًا.
- الحزمة تحتوي `JUDGE_QUICKSTART.md` وملفات تشغيل ونشر واختبارات، وهذا جيد للاستخدام أمام شريك Pilot.

## النتائج ذات الأولوية

### P0 — يجب إصلاحه قبل أي استخدام إنتاجي

#### 1. الأسرار الافتراضية ما زالت قابلة للعمل خارج development

في `pilot-rbac.mjs` توجد قيم افتراضية لـ`ATMOS_PASSWORD_PEPPER` و`ATMOS_TOKEN_SECRET`. قيمة pepper الافتراضية ثابتة ومعروفة داخل المصدر. صحيح أن `pilot-server.mjs` يفرض `PILOT_BOOTSTRAP_TOKEN` في production، لكنه لا يوقف التشغيل إذا بقي pepper الافتراضي.

**الإصلاح:** عند `NODE_ENV=production` يجب رفض الإقلاع إذا لم يكن `ATMOS_PASSWORD_PEPPER` و`ATMOS_TOKEN_SECRET` موجودين، عشوائيين، وطويلين بما يكفي. لا تعتمد على قيمة fallback في الإنتاج.

#### 2. اختبار PostgreSQL الحقيقي غير منفذ في هذه الحزمة

الاختباران `tests/postgres-adapter.integration.test.mjs` متخطّيان بدون `ATMOS_POSTGRES_INTEGRATION=1` و`DATABASE_URL`. لذلك لا يوجد من هذا التدقيق دليل مستقل على PostgreSQL 15/16، أو deadlocks حقيقية، أو lock timeout حقيقي، أو rollback حقيقي.

**الإصلاح:** إضافة PostgreSQL service في GitHub Actions، تشغيل schema migration، ثم تشغيل `npm run test:postgres` ورفع النتائج كـCI artifact. بعد ذلك نفّذ اختبار staging منفصلًا بقاعدة PostgreSQL حقيقية.

#### 3. خلط أخطاء الخادم الداخلية في الاستجابة

`pilot-server.mjs` يعيد `error.message` مباشرة حتى لأخطاء 5xx. في بيئة حقيقية قد يكشف ذلك تفاصيل قاعدة البيانات أو المسارات أو إعدادات داخلية.

**الإصلاح:** أعد رسالة عامة للأخطاء 5xx، وسجّل التفاصيل داخليًا مع request/correlation ID. اسمح برسالة domain آمنة فقط للأخطاء المعروفة.

### P1 — يجب إنجازه قبل Pilot متعدد العملاء

#### 4. المرحلة الثانية ليست Normalized PostgreSQL Repository بعد

المخطط يحتوي `pilot_state` الذي يخزن Snapshot كاملًا في JSONB. كما أن `approvals` داخل `disposition_requests` عمود JSONB. هذا يثبت persistence والمعاملة على Snapshot، لكنه لا يحقق نقل كل الكيانات إلى صفوف مطبّعة.

المفقود أو غير المطبّع بالكامل يشمل:

- recall rows كجدول تشغيلي مكتمل.
- disposition approval rows بدل مصفوفة JSON.
- ledger events.
- audit events.
- idempotency keys كمسار فعلي مستخدم بدل نسخة الحالة فقط.
- sessions كمخزن فعلي بدل جزء من Snapshot.

**الإصلاح:** نفّذ migrations وجداول منفصلة، واجعل المعاملة تكتب recall/disposition/approval/ledger/audit/idempotency في نفس transaction، مع مفاتيح وفهارس وقيود uniqueness.

#### 5. عزل المستأجرين في schema يحتاج قيودًا مركبة

`user_roles` يحتوي `tenant_id` و`user_id`، لكنه لا يفرض بمرجع مركب أن المستخدم نفسه تابع لذلك tenant. كذلك بعض العلاقات الأساسية لا تستخدم مفاتيح مركبة تمنع ربط سجل من tenant بآخر.

**الإصلاح:** استخدم مفاتيح مركبة أو قيودًا فريدة مركبة مثل `(tenant_id, id)` ثم مفاتيح خارجية مركبة في الجداول التابعة. لا تعتمد على فحص التطبيق وحده.

#### 6. OIDC/Entra ID لم يبدأ بعد

وجود عمود `external_subject` في schema لا يعني أن OIDC أو SSO أو MFA أو role/tenant claims تعمل. المسار الحالي ما زال local password login.

**الإصلاح:** أضف OIDC Authorization Code + PKCE، تحقق من issuer/audience/signature/expiry، اربط `external_subject` مع tenant، ولا تقبل claims القادمة من العميل. بعد نجاح المسار، عطّل local password login في production أو اجعله emergency break-glass منفصلًا ومراقبًا.

#### 7. لا توجد rate limits أو حماية brute-force كافية لمسار login

المسار يطبق scrypt لكنه لا يطبق حدًا لمحاولات الدخول، ولا backoff، ولا lockout، ولا سجلًا واضحًا للمحاولات الفاشلة.

**الإصلاح:** rate limit على IP وemail/tenant، backoff، audit event، وإدارة جلسات/إبطال واضحة.

### P2 — قبل التوسع والقياس

#### 8. اختبار k6 الموزع لم يُنفذ

ملف `loadtests/recall-disposition.js` موجود، لكنه لا يثبت تشغيلًا ضد عدة API replicas وconnection pool حقيقي وlock contention وp95/p99 وdatabase CPU/IOPS وreplica lag.

**الإصلاح:** شغّل staging فيه أكثر من replica خلف reverse proxy، PostgreSQL حقيقية، pool limits معروفة، k6 thresholds، ومراقبة DB/replica. سجّل نتائج baseline ثم نتائج بعد التحسين.

#### 9. backup/restore وRTO/RPO غير مثبتين

الوثائق تذكر backup/restore كشرط انتقال، لكن لا توجد في الحزمة نتيجة drill قابلة للتحقق.

**الإصلاح:** نفّذ restore إلى بيئة منفصلة، تحقق من hash/event continuity، وسجّل زمن RTO ونقطة RPO والنتيجة.

#### 10. لا توجد migrations versioned كاملة

الـschema الحالي ملف إنشاء idempotent، وليس مسار migrations مُرقّمًا مع rollback/forward strategy.

**الإصلاح:** استخدم أداة migrations، اجعل كل تغيير schema قابلًا للتتبع، وأضف smoke test من قاعدة فارغة إلى أحدث نسخة.

## تقييم ترتيب المراحل المقترح

الترتيب العام صحيح، لكن المرحلة الأولى يجب وصفها بدقة بأنها **PostgreSQL transactional snapshot pilot** وليست بعد normalized repository.

الترتيب التنفيذي الأفضل هو:

1. تثبيت production secret fail-fast، sanitization للأخطاء، migrations، وCI PostgreSQL حقيقي.
2. تنفيذ Normalized Repository مع composite tenant constraints وledger/audit/idempotency rows.
3. تنفيذ OIDC/Entra ID وclaims validation وMFA عبر مزود الهوية.
4. تنفيذ k6 متعدد replicas بعد ثبات schema والهوية.
5. بعد ذلك backup/restore drill، observability، tenant-isolation review، security review مستقل، وcanary/rollback.

لا تبدأ k6 الموزع قبل اكتمال normalized repository؛ وإلا ستقيس Snapshot adapter لا المنتج المستهدف.

## الرخصة

أضفت Apache License 2.0 إلى الحزمة النهائية ومصدر v3.1، كما أضفتها إلى مستودع OmNi-Ledger العام مع فقرة تحدد أن الكود المصدر هو المقصود، وأن أسماء المشاريع والشعارات ومواد العرض والعلامات التابعة لا يمنحها الترخيص كعلامات تجارية.

ملاحظة قانونية مهمة: GitHub يوضح أن غياب LICENSE يترك الحقوق الافتراضية محفوظة لصاحبها، مع بقاء حق GitHub في العرض والـfork وفق شروط الخدمة؛ لكنه لا يجعل الكود مفتوح المصدر للاستخدام العام. وApache 2.0 يمنح حقوق النسخ والتعديل والتوزيع، ويتضمن patent grant وإخلاء ضمان وحد مسؤولية، لكنه لا يمنح حقوق العلامات التجارية ولا يعني أن المشروع مناسب تلقائيًا لكل استخدام طبي أو مؤسسي.

إذا كان الهدف الاحتفاظ بالنواة كملكية تجارية مغلقة، فلا تستخدم Apache 2.0 على كل المستودع؛ استخدم ترخيصًا تجاريًا أو Source-Available مصاغًا قانونيًا. أما إذا كان الهدف تمكين الشركات من تجربة الكود وإعادة استخدامه مع حماية براءات واضحة، فـApache 2.0 اختيار مناسب للـsource code بعد مراجعة محامٍ.

## حالة التسليم

- `npm ci`: ناجح.
- `npm test`: ناجح، 19 passed و0 failed و2 skipped لاختبارات PostgreSQL الحقيقية.
- `npm run verify:release`: ناجح.
- syntax check: 45/45 وحدة ناجحة.
- HTTP smoke/CSP/manifest: ناجحة.
- live AMD: لم يُشغّل في بيئة التدقيق لأنه يحتاج مفتاحًا خاصًا.
- لا يوجد مستودع GitHub باسم `omniverse-atmos` ظاهر في الحساب؛ لذلك لا يمكن ربط حزمة AtMoS به أو رفعها إليه حتى يتم إنشاء المستودع أو إعطاء الاسم الصحيح.

## توصية التسليم

اعتمد الحزمة الحالية كـPilot release موثق، لا كإعلان جاهزية إنتاج. قبل إنشاء `omniverse-atmos` العام، نفّذ P0 أولًا، ثم أعد بناء الحزمة والـmanifest، وأرفق تقرير PostgreSQL الحقيقي وk6 والـbackup/restore بدل الاكتفاء بالاختبارات mock. أبقِ ملفات pitch/architecture منفصلة عن الكود، وراجع أي عبارة مثل “tamper-proof” أو “zero latency” أو “autonomous ERP replacement” لتصبح وصفًا مستقبليًا لا قدرة مثبتة حاليًا.

## مصادر الرخصة

[1]: https://docs.github.com/articles/licensing-a-repository "GitHub Licensing a repository"
[2]: https://www.apache.org/licenses/LICENSE-2.0 "Apache License 2.0"
[3]: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-license-to-a-repository "GitHub Adding a license to a repository"
