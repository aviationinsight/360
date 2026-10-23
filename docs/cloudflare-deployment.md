# نشر Aviation Insight على Cloudflare Workers

## إعداد Cloudflare

1. أنشئ حاوية R2 باسم `aviation-insight-files` (قد يطلب Cloudflare تفعيل R2 والفوترة).
2. فعّل Browser Run / Browser Rendering في الحساب لتوليد صور التقارير.
3. في إعدادات بناء Worker المرتبط بمستودع GitHub:
   - Project name: `aviation-insight`
   - Root directory: جذر المستودع
   - Build command: `npm run build:cloudflare`
   - Deploy command: `npx wrangler deploy`
4. أضف متغيرات التشغيل والأسرار أدناه من Settings → Variables and Secrets، ثم أعد النشر. متغيرات Build وحدها لا تكفي.

| الاسم | القيمة |
| --- | --- |
| `PUBLIC_ORIGIN` | رابط Worker الكامل أو الدومين النهائي، بدون شرطة مائلة في النهاية |
| `TURSO_DATABASE_URL` | نفس رابط قاعدة Turso في Railway (`libsql://…`) |
| `TURSO_AUTH_TOKEN` | نفس رمز Turso، كـ Secret |
| `BETTER_AUTH_SECRET` | نفس سر المصادقة في Railway، كـ Secret |
| `REPORT_SYNC_SECRET` | نفس سر مزامنة التقارير، كـ Secret |
| `SYNC_ORIGIN` | رابط خدمة مزامنة البيانات إذا اختلف عن القيمة الافتراضية |

لا تضع الأسرار في GitHub أو ملفات الإعدادات. قاعدة Turso الحالية تبقى كما هي؛ لا تعِد استيرادها أو تهيئتها. ترحيلات قاعدة البيانات عند الحاجة تُنفّذ بشكل منفصل بالأوامر الحالية؛ Workers لا يشغّل Railway preDeployCommand.

## البريد

استعادة كلمة المرور على Workers تستخدم Resend عبر HTTPS. أضف `RESEND_API_KEY` كـ Secret، و`SMTP_FROM` بعنوان مرسل موثّق في Resend. لا تحتاج كلمات مرور SMTP على Workers. مسار Railway يحتفظ بنقل SMTP الحالي.

إرسال التقارير يبقى عبر `REPORT_EMAIL_HOOK` الحالي. يبدأ النشر بـ `REPORT_EMAIL_ENABLED=false` لمنع الإرسال قبل اكتمال التحقق. بعد اختبار التقارير، اضبط الخطاف وأعد تفعيل الإرسال عند الحاجة. حدّث نظام الجدولة الخارجي الذي يستدعي `report:tick` بالرابط الجديد والسر نفسه عند الانتقال.

## نقل الملفات والتحقق

محتوى قرص Railway لا ينتقل تلقائيًا إلى R2. انسخ الملفات الحالية من `DATA_DIR` إلى الحاوية مع الحفاظ على المفاتيح/المسارات قبل إيقاف Railway، خصوصًا لقطات وتقارير الأرشيف. صفحات لوحات البيانات الخاصة مضمنة داخل كود Worker، ولا تُنشر ضمن الملفات العامة.

اختبر `/health/live` و`/health/ready`، تسجيل الدخول والخروج، صلاحيات حساب موظف، اللوحات، تنزيل Excel، وتوليد صور التقارير. اختبر استعادة كلمة المرور بعد إعداد Resend. حدّث `PUBLIC_ORIGIN` عند ربط الدومين ثم أعد النشر. لا توقف Railway حتى تنتهي هذه الاختبارات ونقل الملفات والجدولة.

## فحص محلي

```sh
npm run build:cloudflare
npx wrangler deploy --dry-run
npx tsc -p workers/tsconfig.json --noEmit
```

الفحص الجاف يتحقق من الحزمة والإعدادات، لكنه لا يثبت صلاحية أسرار الحساب أو تفعيل R2 والمتصفح. اختبارات التشغيل الفعلية مطلوبة بعد نشر تجريبي.
