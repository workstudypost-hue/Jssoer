# ملاحظات الإنتاج والخطوات التالية

هذا الملف مرجع لأي جلسة تطوير لاحقة (خصوصًا عبر Claude Code) — يلخّص كل قرار معماري
اتُّخذ خلال التصميم، وما تم تنفيذه فعليًا في هذا الـ Scaffold، وما تبقى.

## تدقيق ذاتي دوري (مهم لأي جلسة قادمة)

عند إضافة أي ميزة جديدة، تحقق دائمًا من هذه الأنماط من الثغرات التي ظهرت فعليًا هنا:
1. **"الحالة الافتراضية موجودة لكن لا يوجد Endpoint لتغييرها"** — مثال حقيقي: كان
   `instructor_profiles.account_status` يُضبط تلقائيًا على `pending_approval` لكن لا يوجد
   أي مسار API للموافقة/الرفض الفعلي، فيبقى المدرب عالقًا للأبد. تم إصلاحه الآن عبر
   `InstructorApprovalService` + صلاحية `users.approve_instructor` الجديدة.
2. **"فصل الأدوار المزعوم في التعليق فقط، لا في الصلاحيات الفعلية"** — مثال حقيقي: الموافقة
   الثانية على مستحقات المدربين كانت تعتمد على صلاحية `instructor_payouts.approve` نفسها
   التي يملكها `finance_manager` أيضًا، فلو وُجد أكثر من موظف مالي لأمكن لأحدهم تمرير
   الموافقتين. تم إصلاحه بفصل صلاحية `instructor_payouts.approve_second` الممنوحة لـ
   `super_admin` حصريًا (عبر مجموعة الصلاحيات الكاملة)، مع إبقاء فحص "شخص مختلف" في
   الخدمة كطبقة حماية إضافية.
3. **"TODO مكتوب في تعليق لكن الكود سيفشل فعليًا عند التشغيل، وليس فقط ناقص الميزة"** —
   مثال حقيقي وأخطر: مسار Stripe webhook كان يعتمد على `req.body` كـ Buffer خام لحساب
   توقيع HMAC، لكن `main.ts` لم يكن يُفعِّل `express.raw()` إطلاقًا - Nest يُطبِّق
   `express.json()` تلقائيًا بأسبقية أعلى، فكان `stripe.webhooks.constructEvent()`
   سيفشل **دائمًا وليس أحيانًا** فور أول محاولة تشغيل فعلية. تم إصلاحه بإنشاء التطبيق
   بـ `bodyParser: false` وتسجيل `express.raw()` لمسار Stripe تحديدًا **قبل**
   `express.json()` العام، بالترتيب الصحيح - راجع `main.ts`.

---

## 1) القرارات المعمارية الثابتة (لا تُغيَّر بدون سبب قوي)

- **Tech Stack**: Next.js 14 (Frontend) + NestJS (Backend) + PostgreSQL + Redis + BullMQ
- **قاعدة البيانات**: نمط Base Table + Translation Table لكل محتوى متعدد اللغات (courses, chapters...)
- **المصادقة مزدوجة تمامًا**: `/auth/staff/*` (دعوة فقط، لا تسجيل ذاتي أبدًا) مقابل `/auth/public/*`
  (تسجيل ذاتي + OTP إلزامي، طلاب ومدربون فقط)
- **المدرب**: بعد OTP يبقى `instructor_profiles.account_status = 'active_pending_approval'`
  حتى موافقة إدارية صريحة — لا ينشر أي دورة قبلها
- **RBAC ديناميكي بالكامل من DB** — لا صلاحيات مُثبَّتة بالكود، كل شيء عبر
  `roles` / `permissions` / `role_permissions` + `PermissionsGuard`
- **العملة**: USD كمصدر حقيقة وحيد، تحويل تلقائي للعرض، **تجميد سعر الصرف** عند إنشاء أي `payment_plan`
- **التعثر عن السداد**: مهلة سماح 7 أيام → حجب جزئي (المحتوى المُكمَل يبقى متاحًا، الجديد يُحجب)
- **الموافقة المزدوجة على مستحقات المدربين**: إلزامية لأي `payout` ≥ 500$ (شخصان مختلفان إلزاميًا)
- **عمولة بوابة الدفع تُخصم أولًا** من المبلغ الإجمالي، ثم يُقسَّم الصافي بين المدرب والمنصة
- **حماية الفيديو**: نهج متدرج — Signed URLs + Overlay Watermark فقط في MVP،
  DRM الكامل (Widevine/FairPlay) لاحقًا للمحتوى عالي القيمة فقط
- **الأمان السلوكي (تسريب فيديو/تواصل)**: تنبيه بشري فقط عبر `security_review_cases`،
  **بدون أي إجراء تلقائي** على حساب المستخدم
- **الذكاء الاصطناعي**: توجيه متعدد النماذج حسب الحساسية (Haiku للمهام البسيطة/الحجم الكبير،
  Sonnet للمتوسطة، Opus للحرجة كبنك الأسئلة والتسعير) + حدود استخدام مرنة بالكامل من لوحة الإدارة
  (لا أرقام ثابتة بالكود) + RAG محصور بمحتوى الدورة فقط للطالب

---

## 2) المُنفَّذ فعليًا في هذا الـ Scaffold

- Prisma Schema: `User`, `AuthProvider`, `UserDevice`, `OtpVerification`, `Role`,
  `Permission`, `RolePermission`, `UserRole`, `StaffInvitation`, `ActivityLog`,
  `InstructorProfile`, `Course` + `CourseTranslation`, `Chapter`, `Lesson`, `Enrollment`,
  `CustomRequest` + ملفاتها وسجل حالتها، `RequestStatusTransition`
- **النظام المالي (جديد)**: `ExchangeRate`/`CurrentExchangeRate`, `PaymentGateway`,
  `SavedPaymentMethod`, `PaymentPlan` + `Installment` + `PaymentPlanAdjustment`,
  `Payment`, `Refund`, `CommissionPolicy`, `InstructorCommissionAgreement`,
  `InstructorEarning`, `InstructorPayout`, `InstructorDeduction`, `DualApprovalThreshold`
- **الأمان (جديد)**: `VideoPlaybackSession`, `VideoSecurityEvent`, `SecurityReviewCase`,
  `Message`, `CommunicationViolation`
- Auth: تسجيل ذاتي + OTP (منطق كامل، الإرسال الفعلي Stub)، دعوة موظفين + قبول + دخول منفصل،
  JWT (Access + Refresh)، `PermissionsGuard` + `@RequirePermissions`
- **المدفوعات (جديد)**: `PaymentGatewayAdapter` interface موحّد + `StripeAdapter` (فعلي عبر
  Stripe SDK، يحسب `gatewayFeeUsd` من `balance_transaction.fee` الحقيقي وليس تقديرًا) +
  `TabbyAdapter` (Stub جاهز البنية لـ BNPL) + `PaymentGatewayFactory` لاختيار الـ Adapter ديناميكيًا
- **خطط التقسيط (جديد)**: `PaymentPlansService` يُجمِّد سعر الصرف لحظة الإنشاء، يولّد الأقساط
  الشهرية تلقائيًا، ودالة `processDueInstallments()` كهيكل جاهز لـ Cron التحصيل (منطق Dunning
  الفعلي مؤجَّل - راجع القسم 3)
- **مستحقات المدربين (جديد)**: `InstructorPayoutsService` بمعادلة الاحتساب الصحيحة
  (gross → خصم عمولة البوابة → تقسيم النسبة حسب أولوية اتفاقية خاصة/عامة/سياسة افتراضية)،
  وworkflow الموافقة المزدوجة الكامل (حد 500$، منع تطابق المُوافِق الأول والثاني برمجيًا)
- Seed: كل الأدوار السبعة + الصلاحيات + سياسات العمولة الافتراضية + حد الموافقة المزدوجة
  (500$) + بوابتا Stripe وTabby + **26 قاعدة انتقال حالة كاملة للطلبات الخاصة** + أول `super_admin`
- **الطلبات الخاصة (جديد)**: `RequestTransitionService` كمحرك مركزي وحيد لتغيير أي حالة
  (يقرأ القواعد من `request_status_transitions` في DB، يدعم دور خاص `'self'` يُفسَّر كصاحب
  الطلب أو المدرب المُسند)، و`CustomRequestsService` يغطي كل المراحل: إنشاء → رفع ملفات →
  إرسال → مراجعة/توضيح → تسعير → موافقة الطالب → دفع → إسناد → إنتاج → مراجعة داخلية →
  تسليم → تأكيد/نزاع، مع Endpoints كاملة في `CustomRequestsController`
- Frontend: توجيه `next-intl` لـ 4 لغات، RTL تلقائي للعربية، middleware، صفحة رئيسية تجريبية

---

## 3) غير مُنفَّذ بعد — بالترتيب المقترح للتنفيذ

### أ) استكمال المصادقة
✅ **مكتمل بالكامل الآن** (جلسة إضافية):
- OTP فعلي عبر Twilio (SMS/WhatsApp) وSendGrid (Email) — `notifications/` module جديد
  بنمط Adapter (`TwilioProvider`, `SendGridProvider`)، مع محاكاة آمنة تُسجَّل كتحذير فقط
  عند غياب مفاتيح API (بيئة تطوير) بدل فشل التسجيل بالكامل.
- `GoogleOAuthStrategy` و`MicrosoftOAuthStrategy` + Guards + منطق Account Linking الآمن
  في `PublicAuthService.handleOAuthLogin()`: ربط تلقائي فقط لبريد `email_verified_at`
  موجود مسبقًا، وإلا رسالة صريحة للطالب لتأكيد بريده أولًا (يمنع الاستيلاء على حساب
  بريد غير مُتحقَّق عبر انتحال OAuth).
- Refresh Token Rotation فعلي: نموذج `RefreshToken` جديد (family_id لكل سلسلة)،
  `RefreshTokenService.rotate()` يكتشف إعادة استخدام Token مُبطَل ويُبطل السلسلة
  كاملة فورًا (مؤشر سرقة جلسة)، Endpoints `/auth/public/refresh` و`/auth/public/logout`.
- `DeviceService` ينفذ فعليًا قيد `MAX_ACTIVE_DEVICES_PER_USER` (افتراضيًا 1) بنمط LRU:
  تسجيل دخول من جهاز جديد بعد تجاوز الحد يُنهي أقدم جلسة نشطة بدل رفض صريح مربك.

المتبقي فعليًا (تفاصيل صغيرة، ليست حرجة):
- [ ] Refresh Token Rotation لمسار `/auth/staff/*` أيضًا (حاليًا فقط `/auth/public/*` يستخدم
      `RefreshTokenService` الجديد — الموظفون لا يزالون على التوكن البسيط القديم)
- [ ] واجهة Frontend فعلية لصفحة `/auth/oauth-callback` لاستقبال التوكنات من الـ Fragment

### ب) الوحدة المالية (الأضخم)
✅ **مكتمل بالكامل الآن** (جلسة إضافية):
- `PayPalAdapter` (Orders API v2: create/capture/refund + التحقق من Webhook) و
  `TamaraAdapter` (Checkout API: authorise/capture/refund + توقيع Notification Token) —
  كلاهما فعليان تمامًا عبر `axios`، ليسا Stub.
- `TabbyAdapter` أُعيدت كتابته بالكامل: استدعاءات Tabby Checkout API v2 الحقيقية
  (لم يعد Stub) — التحقق من الـ Webhook يعيد استعلام الحالة من Tabby مباشرة (دفاع
  ضد تزوير الـ payload، لأن Tabby لا توفر توقيع HMAC معياريًا).
- **التحصيل الفعلي من بطاقة محفوظة**: `PaymentPlansService.attemptInstallmentCollection()`
  جديدة — تستدعي `StripeAdapter.chargeSavedPaymentMethod()` (PaymentIntent Off-Session
  فعلي) لكل قسط مستحق، تُنشئ سجل `Payment` وتُحدِّث حالة القسط بناءً على النتيجة الفعلية.
  لم يعد القسط يبقى `'due'` معلَّقًا بلا محاولة تحصيل حقيقية.
- `WebhooksController` يعالج الآن `payment_failed` و`refund_completed` أيضًا (كان يعالج
  `payment_succeeded` فقط) عبر `confirmPaymentFailure()`/`confirmRefundCompleted()` الجديدتين.
- `createInstructorEarning()` تدعم الآن `custom_request` أيضًا وليس `course_enrollment`
  فقط — تُستدعى فعليًا من `confirmPaymentSuccess()`، وأُضيف حقل `customRequestId` مسار
  كامل مستقل لحساب العمولة (بلا `courseLevel`، يعتمد على اتفاقية المدرب العامة أو
  سياسة افتراضية `professional`).
- `onPaymentConfirmed()` في `CustomRequestsService` أصبح مربوطًا فعليًا من
  `PaymentsService.confirmPaymentSuccess()` (كان جاهزًا لكن غير مُستدعى — فجوة موثقة سابقًا).

المتبقي فعليًا:
- [ ] مستندات ضريبية تلقائية (`instructor_tax_documents`) + فواتير الطلاب (`invoices`)
- [ ] احترام `payout_frequency` الفردي لكل مدرب بدل نافذة 30 يومًا موحّدة
- [ ] Open Exchange Rates API فعلي بدل الأسعار الثابتة الداخلية الحالية

### ج) الطلبات الخاصة (State Machine)
✅ **مُنفَّذ بالكامل** (26 قاعدة انتقال + State Machine Guard + كل الـ Endpoints).
✅ **إصلاح جديد**: `onPaymentConfirmed()` أصبح مربوطًا فعليًا (راجع قسم ب أعلاه).
المتبقي فعليًا:
- [ ] رفع الملفات عبر Presigned URLs فعلية (S3/R2) بدل استقبال `fileUrl` مباشرة
      (موسوم `TODO(production)` في `custom-requests.controller.ts`)
- [ ] ربط AI Gateway لصياغة الـ Brief عند الإنشاء واقتراح التسعير للمراجع
- [ ] تفعيل `NotificationsService` الموسوم كـ TODO في `request-transition.service.ts`
      (إشعار تلقائي لكل انتقال حسب `notification_triggers`) — الخدمة نفسها أصبحت
      جاهزة وفعلية الآن (راجع قسم أ)، فقط يبقى ربطها هنا تحديدًا
- [ ] استدعاء `RefundsService` فعليًا عند `resolveDispute` بقرار `partial_refund`/`full_refund`

### د) حماية الفيديو
✅ **مكتمل بالكامل الآن** (جلسة إضافية):
- `MuxAdapter` جديد: يُوقِّع Playback URL فعليًا عبر Mux Signing Key (RS256 JWT) —
  `videoAssetId` يُعامَل كـ Mux Playback ID مباشرة. `startPlayback()`/`heartbeat()`
  في `VideoSecurityService` يُرجعان الآن `signedPlaybackUrl` فعليًا وليس فقط الـ ID الخام.
- `GeoIpService` جديد عبر `geoip-lite`: `checkEscalation()` يحسب الآن **عدد الدول
  المميزة الفعلي** من عناوين IP (وليس عدّ IPs الخام كتقريب - كان يُنتج تصعيدات كاذبة
  لنفس المستخدم بتغيير IP محليًا دون تغيير دولة).
- Overlay Watermark ديناميكي فعلي على الـ Frontend: `components/video/VideoWatermarkOverlay.tsx`
  (يتحرك لموضع عشوائي كل 12-18 ثانية، يعرض هوية المُشاهد + معرِّف الجلسة + الوقت) و
  `components/video/SecurePlayer.tsx` (يجمع: بدء الجلسة، تحميل HLS عبر `hls.js`،
  Heartbeat دوري كل 30 ثانية، كشف أساسي لفتح DevTools عبر مقارنة أبعاد النافذة،
  `sendBeacon` لإنهاء الجلسة عند مغادرة الصفحة). أُضيف `hls.js` لـ `package.json`.

المتبقي فعليًا:
- [ ] DRM كامل (Widevine/FairPlay) لاحقًا للمحتوى عالي القيمة فقط - غير مطلوب لـ MVP
- [ ] رفع الفيديو الفعلي لـ Mux (Direct Upload API) من لوحة المدرب - حاليًا `videoAssetId`
      يُفترض إدخاله يدويًا بعد رفع خارجي، لا يوجد مسار Upload متكامل بعد

### هـ) الذكاء الاصطناعي
✅ **مكتمل بالكامل الآن** (جلسة إضافية):
- **RAG فعلي بالكامل**: `prisma/sql/pgvector-setup.sql` (تفعيل `pgvector` + عمود
  `embedding vector(1024)` + فهرس HNSW - يُشغَّل يدويًا مرة واحدة لكل بيئة، موثق بالكامل
  في الملف). `EmbeddingService` (Voyage AI - `voyage-3`, الموصى به رسميًا من Anthropic
  كشريك Embeddings). `ChunkingService` (تقطيع بالجمل مع تداخل 40 كلمة، مصمَّم للعربية).
  `ContentIngestionService` (فهرسة درس/دورة كاملة - Endpoint `POST /ai/courses/:id/reindex`).
  `RetrievalService` (بحث Cosine Distance فعلي محصور بالدورة عبر JOIN على
  `chapters.course_id` - قيد أمني جوهري يمنع تسريب محتوى دورات أخرى، مع عتبة
  `MAX_DISTANCE=0.55` لرفض سياق ضعيف الصلة). `retrieveContextStub()` القديم اختفى تمامًا.
  أُضيف نموذج `LessonContent` جديد لـ schema (نص/transcript الدرس لكل لغة - لم يكن
  موجودًا أصلًا، وبدونه لا مصدر نصي حقيقي للفهرسة).
- **حساب `costUsd` فعلي**: `CostCalculatorService` بجدول أسعار حقيقي لكل نموذج
  (Haiku/Sonnet/Opus بالدولار لكل مليون توكن) - لم يعد `costUsd` مُثبَّتًا على 0.
- **كشف Prompt Injection فعلي**: `PromptInjectionDetectorService` (طبقة Heuristic -
  أنماط عربية/إنجليزية لتجاهل التعليمات، انتحال دور، استخراج الـ System Prompt).
  severity='high' يحظر الاستدعاء بالكامل قبل الوصول لـ Claude API ويُسجِّل
  `AiModerationFlag`؛ severity='medium' يُسجَّل فقط (Alert-only) دون حظر.
- **Layer 2 لكشف تسريب التواصل مُفعَّل فعليًا**: `MessagesService.classifyWithAi()` تستدعي
  `AiGatewayService` (ميزة `contact_leak_detection`, نموذج Haiku مُهيَّأ مسبقًا في الـ Seed)
  فقط عند ثقة Regex منخفضة، بسياسة Fail-Open صريحة (خطأ تقني = لا حظر، تفاديًا لحظر
  رسائل بريئة بسبب عطل). كان تمريرًا صامتًا كاملاً سابقًا.

المتبقي فعليًا:
- [ ] لوحة إدارة AI Usage (واجهة Frontend لتعديل `ai_usage_limits`/`ai_model_routing` مباشرة)
- [ ] ربط `ContentIngestionService.ingestCourseContent()` تلقائيًا عند نشر دورة (لا يوجد
      موديول `courses` متكامل بعد في هذا الـ Scaffold — حاليًا Endpoint يدوي فقط)
- [ ] معايرة عتبات `PromptInjectionDetectorService` وتوسيع الأنماط بمراجعة دورية

### و) الرقابة على التواصل
✅ **Layer 1 (Regex) + Layer 2 (AI) مُنفَّذان بالكامل الآن** + `security_review_cases`
موحّدة مع الفيديو + تصعيد تراكمي. تحذير تلقائي عند الوصول تحديدًا لعتبة 3 مخالفات
(`WARNING_THRESHOLD`) أصبح يُنشئ سجل مراجعة `severity='low'` فعليًا (كان TODO سابقًا).
المتبقي فعليًا:
- [ ] Layer 3: OCR للصور المرفقة (Tesseract/Google Vision) - غير مُنفَّذ بعد

### ز) التقارير
✅ **مكتمل بالكامل الآن** (جلسة إضافية):
- تصدير PDF فعلي عبر Puppeteer (`report-export.service.ts` - قالب HTML مضمَّن يدعم
  RTL/LTR ديناميكيًا حسب `preferredLocale` لطالب التقرير، وليس Handlebars منفصلًا -
  تبسيط مقصود لتفادي تبعية إضافية غير ضرورية لحجم القوالب الحالي) وتصدير XLSX فعلي
  عبر `exceljs`. كلاهما يعمل بالخلفية عبر BullMQ (`ReportExportProcessor`, طابور
  `REPORT_EXPORTS` جديد) - الـ Endpoint `POST /reports/generate` يُرجع فورًا
  `status:'generating'` عند طلب `exportFormat='pdf'/'xlsx'`، والـ Frontend يستخدم
  `GET /reports/:id/status` (Polling) حتى يجهز `fileUrl`.
- `StorageService.uploadBuffer()` جديدة (رفع مباشر من الخادم للملفات المولَّدة داخليًا -
  مختلف عن `generateUploadUrl()` المخصص لرفع المستخدم المباشر عبر presigned URL).

المتبقي فعليًا:
- [ ] Read Replica منفصلة (أو الاكتفاء بالوضع الحالي على القاعدة الأساسية للمرحلة الأولى)
- [ ] `report_schedules` Cron فعلي (إرسال دوري تلقائي عبر البريد)
- [ ] Materialized Views للتقارير الثقيلة متكررة الطلب (مثل `course_performance_summary`)
- [ ] QR Code للتحقق العام من الشهادات/كشوف الأداء الأكاديمي

### ح) مستحقات المدربين - التنفيذ الفعلي والتكرار الفردي
✅ **مكتمل بالكامل الآن** (جلسة إضافية):
- `InstructorPayoutsService.generateDuePayouts()` يحترم الآن `payout_frequency` الفردي
  لكل مدرب (`weekly`/`biweekly`/`monthly`) عبر حقل جديد `lastPayoutGeneratedAt` على
  `InstructorProfile` - لم تعد نافذة 30 يومًا موحّدة على الجميع.
- `executePayout()` يُنفِّذ التحويل الفعلي حسب `preferredPayoutMethod`: Stripe Connect
  Transfer الفعلي (`stripe.transfers.create`) أو PayPal Payouts API الفعلي (نقطة API
  مختلفة تمامًا عن Orders API المستخدَمة للتحصيل)، مع حقول جديدة على `InstructorProfile`:
  `stripeConnectAccountId`, `paypalPayoutEmail`, `preferredPayoutMethod`. التحويل البنكي
  اليدوي يبقى `awaiting_manual_confirmation` (لا API ممكن لهذا النوع أصلًا).
المتبقي فعليًا:
- [ ] مسار Stripe Connect Onboarding الفعلي من لوحة المدرب (حاليًا `stripeConnectAccountId`
      يُفترض إدخاله يدويًا بعد Onboarding خارجي - لا توجد شاشة onboarding مدمجة بعد)

### ط) سعر الصرف
✅ **مكتمل بالكامل الآن**: `ExchangeRateService.refreshRatesFromProvider()` يستدعي
Open Exchange Rates API فعليًا (`OPEN_EXCHANGE_RATES_APP_ID` في `.env`)، بسياسة
Fail-Open صريحة عند فشل الاستدعاء (يُبقي آخر سعر مُخزَّن كما هو بدل كسر خطط الدفع الجديدة).

### ي) الطلبات الخاصة - تفاصيل متبقية صغيرة
✅ **مكتمل الآن**: التقسيط الفعلي لطلب خاص (`respondToPrice` مع `paymentOption='installments'`
يُنشئ `PaymentPlan` فعليًا بـ 3 أقساط شهرية افتراضية) + بدء عدّاد `clearance_date` لأرباح
المدرب من لحظة `confirmDelivery` تحديدًا (وليس من لحظة الدفع الأولى كما كان ضمنيًا سابقًا).
المتبقي فعليًا:
- [ ] حقل صريح لعدد الأقساط يختاره الطالب بدل الافتراضي الثابت (3 أقساط)

---

## 4) تنبيه أمني دائم

أي جدول/Endpoint جديد يُضاف مستقبلًا يجب أن يمر عبر نفس الأنماط المُتَّبعة هنا:
- لا صلاحيات مُثبَّتة — تُضاف عبر `permissions` + `role_permissions` في الـ seed
- أي نطاق بيانات شخصي (مالي/أكاديمي) يُحقن شرطه (`WHERE user_id = current_user.id`)
  من الخادم عبر الـ JWT، وليس من مدخلات الطلب أبدًا
- كل عملية حساسة (مالية، صلاحيات، حذف) تُسجَّل في `activity_logs`
