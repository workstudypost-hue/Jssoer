# ملف تسليم — منصة edu-platform

> **إلى من يهمه الأمر:** هذا ملف تسليم تقني كامل لمنصة تعليمية إلكترونية عربية أولاً (Arabic-first)، جاهزة من ناحية الكود بنسبة كبيرة، لكنها لم تُختبر بعد بتشغيل فعلي محلياً (`npm install` / `npm run build`). مهمتك الأساسية أولاً: **تشغيل المشروع محلياً والتأكد أنه يبني بنجاح**، ثم مراجعة نقاط الأمان المفتوحة.

---

## 1. نظرة عامة على المشروع

منصة تعليم إلكتروني متعددة اللغات (عربي RTL أساسي + إنجليزي/فرنسي/فلبيني)، تستهدف 4 فئات مستخدمين (طلاب، مدرّسين، موظفين، مدراء)، مع:
- مصادقة مزدوجة (دعوة للموظفين، تسجيل ذاتي + OTP للطلاب/المدرّسين)
- 4 مزوّدي دفع (Stripe, PayPal, Tamara, Tabby) بأقساط وعمولات مدرّسين
- فيديو محمي (Mux) بمستويين: علامة مائية + روابط موقّعة، أو DRM كامل للمحتوى عالي القيمة
- مساعد AI/RAG (pgvector + Voyage AI + Claude API)

**المستودع:** `github.com/workstudypost-hue/Jssoer`

## 2. المكدّس التقني (Tech Stack)

| الطبقة | التقنية |
|---|---|
| Backend | NestJS |
| Frontend | Next.js 14 + next-intl (i18n) |
| ORM | Prisma v6+ (نمط `queryCompiler` + `driverAdapters` — **ليس** المحرك الأصلي التقليدي) |
| قاعدة البيانات | PostgreSQL عبر Supabase (+ pgvector لـ RAG) |
| كاش/طوابير | Redis + BullMQ عبر Upstash (منطقة فرانكفورت، TLS) |
| فيديو | Mux (DRM: Widevine/FairPlay/PlayReady + روابط موقّعة + علامة مائية) |
| الدفع | Stripe, PayPal Orders API v2, Tamara, Tabby |
| AI | Claude API (توزيع Haiku/Sonnet/Opus)، Voyage AI (embeddings 1024-dim) |
| الاستضافة المستهدفة | Render (backend) + Vercel (frontend) |

## 3. حالة النشر الحالية

- Supabase و Upstash مُعدّان وجاهزان
- بناء الواجهة الأمامية نجح على كل اللغات الأربع
- **لم يُشغَّل المشروع محلياً بعد** — هذه أول مهمة مطلوبة منك
- إعدادات Render الجاهزة:
  - Build Command: `npm install --include=dev && npx prisma generate && npm run build`
  - Start Command: `npm run start:prod`
  - Root Directory: `backend`
- آخر commit لتصحيح Prisma schema كان يحتاج GitHub token جديداً للدفع — تحقق من حالة الدفع الفعلية على المستودع

### مشاكل معروفة سبق حلّها (موثّقة، لا تُعِد حلّها):
- Prisma رُقّي لنمط driver adapter لتفادي تحميل binaries أصلية
- مسار استيراد `exchange-rate.service.ts` صُحِّح
- أُضيف `@types/passport-google-oauth20` المفقود
- مسار رسائل `frontend/i18n.ts` واستدعاءات `setRequestLocale()` صُحِّحا
- خطأ `nest: not found` على Render حُلّ بإضافة `--include=dev`
- علاقة Prisma المفقودة `PaymentGateway ↔ SavedPaymentMethod` أُضيفت
- Puppeteer مُعدّ بـ `skipDownload: true` عبر `.puppeteerrc.cjs`

## 4. أول مهمة عملية لك

```powershell
# 1. تأكد من التثبيت
node --version   # يُفضَّل LTS (v20.x أو v22.x)
npm --version

# 2. استنسخ المستودع إن لم يكن موجوداً بعد
git clone https://github.com/workstudypost-hue/Jssoer.git
cd Jssoer/backend

# 3. أول تثبيت
npm install --include=dev

# 4. Prisma
npx prisma generate

# 5. أول build
npm run build
```

راقب تحديداً: تحميل محرّكات Prisma الأصلية (يجب أن يكون معطّلاً)، وفشل Puppeteer بتنزيل Chromium (يجب أن يكون معطّلاً). أي خطأ آخر — راجع القائمة أعلاه أولاً قبل البحث من الصفر.

## 5. الأنظمة المُسلَّمة (كود كامل، جاهز للدمج)

جميع الحزم التالية سُلِّمت كملفات كود فعلية مع أدلة دمج مرفقة. الأسماء بين قوسين هي المجلدات كما سُلِّمت:

| النظام | الحالة | ملاحظة دمج رئيسية |
|---|---|---|
| DRM كامل للفيديوهات عالية القيمة (`drm-implementation/`) | كود كامل، غير مدموج بعد | نقطتان معلَّمتان صراحة تحتاجان ربطاً يدوياً بأسماء خدماتكم الفعلية (MuxAdapter الحالي وخدمة توقيع الروابط) |
| حماية DRM Access + اختبار وصول (`drm-access-security/`) | كود + اختبارات e2e | قارنوا `EnrollmentGuard` المُسلَّم بأي نسخة موجودة عندكم قبل الاستبدال |
| أمان Webhooks الأربعة (`webhook-security/`) | كود كامل | ⚠️ يتطلب إعداد raw body لـ Stripe في `main.ts` — أكثر خطأ شائع في تكاملات Stripe، موثّق بالتفصيل في الدليل |
| تحسين الأداء (`perf-optimization/`) | كود + توصيات فهرسة | شغّلوا `pg_stat_statements` أولاً لقياس حقيقي قبل تطبيق أي فهرس |
| عزل RAG بين الكورسات (`rag-isolation-security/`) | كود + اختبار عدائي | قارنوا `RetrievalService` المرجعي بكودكم — الفرق الحاسم: فلترة `courseId` داخل SQL لا بعده |
| حد OTP (`otp-rate-limiting/`) | كود كامل | حدّان منفصلان: cooldown+حد ساعي/يومي للإرسال، وحد محاولات منفصل للتحقق |
| سلامة السعر (`price-integrity-security/`) | كود + اختبار محاكاة هجوم | `PricingService` هو المصدر الوحيد المسموح لأي سعر يُرسَل لمزوّد دفع |
| توثيق عام (`edu-platform-docs/`) | مراجعة أمنية شاملة 33 بنداً | نقطة انطلاق ممتازة لمراجعة شاملة لاحقة |
| تشديد مالي إضافي (`financial-hardening/`) | كود كامل | معالجة 3D Secure للأقساط off-session + سجل تدقيق مالي append-only |
| تعزيز المصادقة (`auth-hardening/`) | كود كامل | حماية OAuth من CSRF (state server-side) + تصحيح تضارب طرد LRU لجلسات الأجهزة |
| تشديد الفيديو/الرفع (`video-upload-hardening/`) | كود كامل | فحص magic bytes للملفات المرفوعة + إيقاف تشغيل فعلي عند اكتشاف DevTools |
| تشديد البنية التحتية (`infra-hardening/`) | كود كامل | رؤوس أمان CSP، منع تسرّب الأخطاء في الإنتاج، rate limiting عام متدرّج |
| خطة الاختبارات الآلية الشاملة (`testing-strategy/`) | خطة + CI + factories | يضم `docker-compose.test.yml`، `.github/workflows/ci.yml` جاهز، ومصانع بيانات اختبار (`TestFactories`) تُقلّل تكرار كل ملفات الاختبار الأمنية المُسلَّمة |
| ميزة الاختبارات والواجبات (`quiz-assignments-feature/`) | كود كامل (ميزة جديدة، لا تشديد أمني) | تصحيح تلقائي للأسئلة الموضوعية + تصحيح يدوي للمقالية، مع تحقق server-side من حد الوقت + مهمة BullMQ مجدولة (`forceSubmitExpiredAttempts`) **يجب جدولتها يدوياً** وإلا فهي كود ميت |
| شهادات إتمام قابلة للتحقق (`certificates-feature/`) | كود كامل (ميزة جديدة) | رقم شهادة عشوائي غير متسلسل (أهم قرار أمني فيها — لا تُحوَّل لصيغة تسلسلية أبداً)، تحقق علني بلا مصادقة + rate limiting، PDF عبر Puppeteer+QR بنفس نمط تصدير PDF/XLSX الموجود، **يحتاج ربطاً يدوياً صريحاً بنهاية `QuizService.submitAttempt()`** وإلا لن تُصدَر الشهادات تلقائياً |
| تقييمات ومراجعات الكورسات (`reviews-feature/`) | كود كامل (ميزة جديدة) | مراجعة "موثّقة" تتطلب enrollment نشط، متوسط مُخزَّن على `Course` يُحدَّث ذرّياً، **يحتاج تحديث `CourseCatalogService` من `perf-optimization/`** لعرض التقييم + استدعاء `CacheService.invalidateNamespace` عند أي تعديل |
| تتبّع تقدم مشاهدة الفيديو (`progress-tracking-feature/`) | كود كامل (ميزة جديدة) | heartbeat دوري من المشغّل، نسبة إكمال متوسطة لا "الكل أو لا شيء"، **يُغلق فجوة موثَّقة سابقاً في `certificates-feature/`** — يحتاج تحديث `CourseCompletionService` هناك ليشمل شرط الفيديو |
| واجهة إنشاء الاختبارات للمدرّس (`quiz-builder-extension/`) | كود كامل (توسعة لميزة موجودة) | تحقق مزدوج (واجهة + خادم) من بنية الأسئلة، **يرفض تعديل اختبار له محاولات طلاب مُسلَّمة بالفعل** لمنع حذف نتائجهم بصمت — يُضاف بجانب ملفات `quiz-assignments-feature/` في نفس الموديول |
| لوحة تصحيح المدرّس (`instructor-grading-dashboard/`) | كود كامل (يسدّ فجوة في ميزة موجودة) | يسدّ فجوة كانت في `quiz-assignments-feature/`: `gradeShortAnswer()` كان بلا أي قائمة تعرض الإجابات المعلَّقة — تبويبان (واجبات/أسئلة مقالية) في واجهة واحدة |
| حماية أدق ضد الغش في تتبّع التقدم (`progress-anticheat-upgrade/`) | كود كامل (يستبدل جزءاً من `progress-tracking-feature/`) | يستبدل "أقصى موضع" بفترات تشغيل فعلية بين أحداث play/pause/seeking حقيقية + فحص معقولية زمنية ضد تعديل الطلب مباشرة — **يستبدل `useVideoProgressHeartbeat` بـ `useVideoWatchTracking`**، ويضيف حقولاً على `VideoProgress` دون حذف القديم |
| مراجعة شاملة لكل تسليمات الجلسة (`SESSION_WIDE_AUDIT.md`) | تدقيق | افتراضات أسماء حقول متكررة عبر 4-6 حزم (`Course.instructorId`, قيد `Enrollment` المركّب, `User.name`) — **اقرأوه قبل بدء الدمج** |

> **✅ بهذه الحزمة تكون كل الـ 33 بنداً من `SECURITY_HARDENING_REVIEW.md` قد عولجت بالكود** (🔴 الخمسة الحرجة + 🟡 المهمة). القسم 7 أدناه لا يزال يمثّل أولوية الاختبار الفعلي بعد الدمج، لا عملاً متبقياً غير مُنجَز.

> **⚠️ قبل بدء الدمج، اقرأوا `SESSION_WIDE_AUDIT.md`** — يحوي 3 أوامر `grep` بسيطة تتحقق من افتراضات أسماء حقول (`Course.instructorId`, `Enrollment` unique constraint, `User.name`) مستخدَمة عبر 4-6 حزم مختلفة كل واحدة. فحصها مرة واحدة أرخص بكثير من اكتشاف خطأ متكرر لاحقاً حزمة تلو الأخرى.

> **كل هذه الحزم مبنية بدون وصول مباشر لكودكم الفعلي** — أي مسار استيراد معلَّم بتعليق `// عدّل المسار` يحتاج تعديلاً يدوياً بسيطاً ليطابق هيكل مشروعكم الحقيقي.

## 6. الأنظمة المكتملة من جلسات سابقة (موجودة في الكود، لم تُراجَع هذه الجلسة)

- DRM أساسي: `MuxDrmService`, `VideoProtectionPolicyService`, `VideoUploadOrchestratorService` (idempotency)، `DrmWebhookHandler`، `SecureDrmPlayer.tsx`، `VideoPlayer.tsx` موحّد
- حراس أمان webhook الأربعة + `WebhookIdempotencyService` (Redis atomic SET NX، Fail-Closed للعمليات المالية)
- `CacheService` (Fail-Open، إبطال بـ namespace عبر SCAN)، pagination بالمؤشر، توصيات فهرسة
- OTP كامل (Twilio SMS/WhatsApp، SendGrid)، OAuth (Google/Microsoft) مع ربط حسابات، تدوير refresh token مع كشف إعادة الاستخدام، حد أجهزة (LRU)
- PayPal Orders API v2، Tamara Checkout API، محوّل Tabby، Stripe off-session charges
- خط أنابيب RAG كامل (pgvector)، `EmbeddingService` (Voyage AI 1024-dim)، تقطيع نص عربي، `RetrievalService` بقيد JOIN لكل كورس
- تصدير PDF/XLSX (Puppeteer + exceljs عبر BullMQ)، أسعار صرف حية (Open Exchange Rates، Fail-Open)، تنفيذ Stripe Connect + PayPal Payouts

## 7. أخطر النقاط التي تحتاج تحققاً فورياً منك (بالأولوية)

1. 🔴 هل `express.raw()` مُعَدّ فعلاً قبل body-parser العام في `main.ts` لمسار Stripe؟ (بدونه، Stripe webhooks لن تعمل أبداً مهما كان الكود صحيحاً)
2. 🔴 هل `EnrollmentGuard` مطبَّق فعلياً على نقطة تشغيل فيديو DRM، ويتحقق من `courseId` الصحيح تحديداً (لا مجرد "أي تسجيل نشط")؟
3. 🔴 هل فلتر `courseId` في `RetrievalService` داخل استعلام SQL نفسه، لا فلترة لاحقة على النتائج؟
4. 🔴 هل يوجد حد لمحاولات/معدّل OTP فعلياً مطبَّق حالياً؟
5. 🔴 هل يوجد أي endpoint دفع يستقبل مبلغاً جاهزاً من body الطلب بدل حسابه من `courseId`؟

مراجعة أمنية كاملة بـ 33 بنداً (بما فيها بنود 🟡 و🟢 أقل خطورة) موجودة في `edu-platform-docs/SECURITY_HARDENING_REVIEW.md`.

## 8. متغيرات البيئة الجديدة المطلوبة هذه الجلسة (بالإضافة لما هو موجود مسبقاً)

```
# DRM (Mux)
MUX_DRM_CONFIGURATION_ID=

# Webhooks
STRIPE_WEBHOOK_SIGNING_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_API_BASE=
TAMARA_NOTIFICATION_TOKEN=
TABBY_WEBHOOK_HEADER_NAME=
TABBY_WEBHOOK_HEADER_VALUE=
```

الحزم الأربع الأخيرة (`financial-hardening/`, `auth-hardening/`, `video-upload-hardening/`, `infra-hardening/`) لا تحتاج متغيرات بيئة جديدة — تعتمد على `REDIS_URL` و`DATABASE_URL` الموجودين مسبقاً. تحتاج فقط: `npm install helmet @nestjs/throttler jsonwebtoken` (`@types/jsonwebtoken` كـ dev dependency).

`testing-strategy/` و`quiz-assignments-feature/` أيضاً بلا متغيرات بيئة جديدة — الأولى تحتاج Docker مثبَّتاً محلياً فقط (لتشغيل `docker-compose.test.yml`)، والثانية لا تحتاج أي حزمة npm إضافية.

`certificates-feature/` تحتاج `npm install qrcode` (+ `@types/qrcode` كـ dev dependency) فقط — لا متغيرات بيئة جديدة، تعتمد على `NEXT_PUBLIC_APP_URL` الموجود مسبقاً (لبناء رابط QR) وPuppeteer الموجود أصلاً في المشروع.

`reviews-feature/` بلا أي حزمة npm أو متغير بيئة جديد — تعتمد بالكامل على `CacheService` و`PrismaService` الموجودين مسبقاً.

`progress-tracking-feature/` أيضاً بلا أي حزمة npm أو متغير بيئة جديد.

## 9. خطوات مقترحة بالترتيب لك

1. تثبيت Node.js + أول `npm install` + `npm run build` (القسم 4 أعلاه)
2. دمج حزمة `webhook-security/` أولاً — أخطر نقطة مالية
3. دمج حزمة `drm-access-security/` — تشغيل اختبارات e2e المرفقة فوراً
4. دمج حزمة `rag-isolation-security/` وتشغيل الاختبار العدائي
5. دمج `otp-rate-limiting/` و`price-integrity-security/`
6. دمج `financial-hardening/` (3D Secure + سجل تدقيق مالي)
7. دمج `auth-hardening/` (CSRF لـ OAuth + تصحيح LRU) — اختبروا سيناريو "3 أجهزة نشطة معاً" يدوياً
8. دمج `video-upload-hardening/` و`infra-hardening/` معاً — ⚠️ اختبروا CSP على staging فوراً بعد الدمج، هذا التغيير يكسر أشياء بصمت (فيديو/Stripe Elements لا يظهران) دون خطأ واضح في الواجهة
9. إعداد `testing-strategy/` — `docker-compose.test.yml` + خط CI جاهز، شغّلوا `test:security-critical` فوراً بعد الدمج كتحقق نهائي شامل لكل ما سبق
10. دمج `drm-implementation/` (الميزة الجديدة الأولى، أقل إلحاحاً أمنياً من كل ما سبق)
11. دمج `quiz-assignments-feature/` (ميزة جديدة ثانية) — لا تنسوا جدولة `forceSubmitExpiredAttempts()` عبر BullMQ، مذكورة صراحة في دليلها كخطوة لا تُترَك
12. دمج `certificates-feature/` (ميزة جديدة ثالثة، تعتمد على الاختبارات) — لا تنسوا سطر الربط الصريح في `QuizService.submitAttempt()`، و`npm install qrcode`
13. دمج `reviews-feature/` (ميزة جديدة رابعة) — حدّثوا `CourseCatalogService` من `perf-optimization/` لعرض `avgRating`/`reviewCount`
14. دمج `progress-tracking-feature/` (ميزة جديدة خامسة) — بعد دمجها، عودوا لـ `certificates-feature/` وحدّثوا `CourseCompletionService` بشرط إكمال الفيديو (الكود جاهز في دليل التقدّم)
15. دمج `quiz-builder-extension/` (توسعة اختبارات) — يضيف واجهة إنشاء الاختبارات، يعتمد على `quiz-assignments-feature/` (خطوة 11) فلا تدمجوه قبلها
16. دمج `instructor-grading-dashboard/` — يعتمد أيضاً على `quiz-assignments-feature/` (خطوة 11)، يمكن دمجه بالتوازي مع خطوة 15
17. دمج `progress-anticheat-upgrade/` — بعد `progress-tracking-feature/` (خطوة 14)، يستبدل الـ hook الأمامي فقط ويضيف حقولاً، لا يحذف شيئاً
18. تطبيق توصيات `perf-optimization/` بعد قياس فعلي بـ `pg_stat_statements`
19. نشر Render (backend) ثم Vercel (frontend)

بهذا الترتيب، كل الـ 33 بنداً الأمنية (🔴 و🟡 معاً) تُدمَج قبل الميزة الجديدة (DRM) وقبل تحسينات الأداء — الأولوية دائماً: أمان أولاً، ميزات وأداء بعدها.

---

*هذا الملف من إعداد Claude بالتنسيق مع صاحب المشروع، بناءً على كامل تاريخ الجلسات السابقة. لأي سؤال حول قرار معماري معيّن غير موضّح هنا، راجع `production-notes.md` في المستودع إن وُجد.*
