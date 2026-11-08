# AtMoS EIP Workshop Pack

هذه الحزمة هي نقطة العمل الموحدة من ورشة 21 و24 أكتوبر حتى تسليم الـPitch في 29 أكتوبر والحضور في المؤتمر من 6 إلى 8 نوفمبر.

## الملفات

1. [خطة التنفيذ من الورشة إلى المؤتمر](EIP_EXECUTION_PLAN_AR.md)
2. [دليل مقابلات المخازن والجودة والعمليات](PILOT_USER_INTERVIEW_GUIDE_AR.md)
3. [Pilot Brief من صفحة واحدة](PILOT_BRIEF_ONE_PAGE_AR.md)
4. [Pitch إنجليزي لمدة 3 دقائق والرسالة الموحدة](PITCH_3_MINUTES_AND_UNIFIED_MESSAGE_EN.md)
5. [حزمة أدلة الـPitch وحدود الادعاءات](PITCH_EVIDENCE_PACK_AR.md)
6. [تقرير الـSynthetic Workload](fixtures/synthetic-workload-report.json)
7. [مراجعة نسخة ابن سينا والدروس القابلة للدمج](IBNSINA_LESSONS_AND_GAPS_AR.md)
8. [بروتوكول حوكمة Pilot وبوابة الموافقات](PILOT_GOVERNANCE_PROTOCOL_AR.md)
9. [حالة الحوكمة الحالية](pilot-governance-status.json)

## طريقة الاستخدام

قبل الورشة، راجع خطة التنفيذ ونص الـPitch. خلال المقابلات، استخدم دليل الأسئلة وسجّل كل معلومة على أنها `FACT` أو `OPINION` أو `ASSUMPTION` أو `TO_VALIDATE`. قبل إرسال الـdeck، طابق كل رقم مع مصدره، ثم شغّل:

```bash
npm run verify:pitch
npm test
npm run verify:release
npm run verify:pilot-governance
```

لا تُضاف أي نتيجة مقابلة إلى الـPitch كحقيقة عامة إلا بعد تسجيل مصدرها المجهول، وتكرارها، وما إذا كانت فرضية أو دليلًا. لا تُستخدم بيانات مرضى أو أسرار تجارية في نماذج الورشة.

تجربة ابن سينا السابقة تُستخدم كخبرة تصميمية ومنهج Pilot، لا كبيانات benchmark أو كادعاء نتائج إنتاجية. قبل أي تشغيل ميداني يجب توثيق الإذن والخصوصية والملكية الفكرية وتشغيل Shadow وbaseline.
