import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// مصفوفة الصلاحيات كما اتُّفق عليها عبر جلسة التصميم الكاملة
const PERMISSIONS: Array<{ resource: string; action: string }> = [
  { resource: 'users', action: 'manage_staff' },
  { resource: 'users', action: 'read' },
  { resource: 'users', action: 'approve_instructor' },
  { resource: 'courses', action: 'create' },
  { resource: 'courses', action: 'edit' },
  { resource: 'courses', action: 'publish' },
  { resource: 'custom_requests', action: 'review' },
  { resource: 'custom_requests', action: 'price' },
  { resource: 'custom_requests', action: 'assign' },
  { resource: 'custom_requests', action: 'approve_final' },
  { resource: 'custom_requests', action: 'create' },
  { resource: 'payments', action: 'read' },
  { resource: 'payments', action: 'export' },
  { resource: 'refunds', action: 'approve' },
  { resource: 'instructor_payouts', action: 'read' },
  { resource: 'instructor_payouts', action: 'approve' },
  { resource: 'instructor_payouts', action: 'approve_second' },
  { resource: 'marketing_campaigns', action: 'manage' },
  { resource: 'activity_logs', action: 'read' },
];

const ROLES: Array<{ name: string; isSystemRole: boolean; permissions: string[] }> = [
  {
    name: 'super_admin',
    isSystemRole: true,
    permissions: PERMISSIONS.map((p) => `${p.resource}.${p.action}`), // كل الصلاحيات
  },
  {
    name: 'content_admin',
    isSystemRole: true,
    permissions: ['courses.create', 'courses.edit', 'courses.publish', 'custom_requests.review'],
  },
  {
    name: 'requests_reviewer',
    isSystemRole: true,
    permissions: ['custom_requests.review', 'custom_requests.price', 'custom_requests.assign'],
  },
  {
    name: 'finance_manager',
    isSystemRole: true,
    permissions: [
      'payments.read',
      'payments.export',
      'refunds.approve',
      'instructor_payouts.read',
      'instructor_payouts.approve',
    ],
  },
  {
    name: 'marketing_manager',
    isSystemRole: true,
    permissions: ['marketing_campaigns.manage'],
  },
  {
    name: 'support_agent',
    isSystemRole: true,
    permissions: ['users.read', 'activity_logs.read'],
  },
  {
    name: 'student',
    isSystemRole: true,
    permissions: ['custom_requests.create'],
  },
  {
    name: 'instructor',
    isSystemRole: true,
    permissions: [],
  },
];

async function main() {
  console.log('🌱 بدء تهيئة البيانات الأساسية...');

  // 1) إنشاء الصلاحيات
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      update: {},
      create: perm,
    });
  }

  // 2) إنشاء الأدوار وربطها بالصلاحيات
  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {},
      create: { name: roleDef.name, isSystemRole: roleDef.isSystemRole },
    });

    for (const permKey of roleDef.permissions) {
      const [resource, action] = permKey.split('.');
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { resource_action: { resource, action } },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
    console.log(`  ✓ دور "${roleDef.name}" جاهز بـ ${roleDef.permissions.length} صلاحية`);
  }

  // 3) إنشاء أول super_admin للدخول الأولي للنظام
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@platform.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        isStaff: true,
        registrationType: 'staff_invitation',
        preferredLocale: 'ar',
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });
    const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: superAdminRole.id } });
    console.log(`  ✓ تم إنشاء super_admin: ${adminEmail} / ${adminPassword}`);
    console.log('  ⚠️  غيّر كلمة المرور فورًا بعد أول دخول');
  } else {
    console.log('  ℹ️  super_admin موجود مسبقًا، تم التخطي');
  }

  // 4) السياسات المالية الافتراضية (كما اتُّفق عليه عبر جلسة التصميم)

  // نسب العمولة الافتراضية لكل مستوى دورة (70% مدرب / 30% منصة كمثال ابتدائي معقول)
  const commissionDefaults: Array<{ level: 'university' | 'professional' | 'prep' | 'short'; instructorPct: number }> = [
    { level: 'university', instructorPct: 70 },
    { level: 'professional', instructorPct: 70 },
    { level: 'prep', instructorPct: 65 },
    { level: 'short', instructorPct: 60 },
  ];
  for (const c of commissionDefaults) {
    const existing = await prisma.commissionPolicy.findFirst({
      where: { courseLevel: c.level, effectiveTo: null },
    });
    if (!existing) {
      await prisma.commissionPolicy.create({
        data: {
          courseLevel: c.level,
          instructorSharePercent: c.instructorPct,
          platformSharePercent: 100 - c.instructorPct,
          effectiveFrom: new Date(),
          createdBy: 'system_seed',
        },
      });
    }
  }
  console.log('  ✓ سياسات العمولة الافتراضية جاهزة');

  // حد الموافقة المزدوجة على مستحقات المدربين: 500$ (القرار المعتمد)
  const existingThreshold = await prisma.dualApprovalThreshold.findFirst({ where: { isActive: true } });
  if (!existingThreshold) {
    await prisma.dualApprovalThreshold.create({
      data: {
        minAmountUsd: 500,
        requiredRoles: ['finance_manager', 'super_admin'],
        isActive: true,
      },
    });
    console.log('  ✓ حد الموافقة المزدوجة: 500$ (finance_manager + super_admin)');
  }

  // بوابات الدفع الأساسية (Stripe عالمي، Tabby للخليج كـ BNPL)
  const gateways: Array<{
    provider: 'stripe' | 'paypal' | 'tabby' | 'tamara';
    countries: string[];
    currencies: string[];
  }> = [
    { provider: 'stripe', countries: ['*'], currencies: ['USD', 'EUR', 'SAR', 'AED', 'PHP', 'JOD', 'EGP'] },
    { provider: 'tabby', countries: ['SA', 'AE', 'KW'], currencies: ['SAR', 'AED', 'KWD'] },
  ];
  for (const g of gateways) {
    await prisma.paymentGateway.upsert({
      where: { provider: g.provider },
      update: {},
      create: {
        provider: g.provider,
        isActive: true,
        supportedCountries: g.countries,
        supportedCurrencies: g.currencies,
      },
    });
  }
  console.log('  ✓ بوابات الدفع الأساسية (Stripe, Tabby) جاهزة');

  // 5) قواعد انتقالات حالة الطلبات الخاصة (State Machine الكاملة كما صُمِّمت)
  // 'self' تعني: صاحب الطلب (الطالب) أو المدرب المُسند - يُفسَّرها RequestTransitionService
  const transitions: Array<{
    from: string;
    to: string;
    roles: string[];
    condition?: string;
  }> = [
    { from: 'draft', to: 'submitted', roles: ['self'] },
    { from: 'submitted', to: 'under_review', roles: ['requests_reviewer', 'super_admin'] },
    { from: 'under_review', to: 'clarification_needed', roles: ['requests_reviewer', 'super_admin'] },
    { from: 'clarification_needed', to: 'under_review', roles: ['self'] }, // الطالب يردّ
    { from: 'under_review', to: 'priced', roles: ['requests_reviewer', 'super_admin'], condition: 'has_price_set' },
    { from: 'under_review', to: 'rejected', roles: ['requests_reviewer', 'super_admin'] },
    { from: 'priced', to: 'awaiting_student_approval', roles: ['requests_reviewer', 'super_admin'] },
    { from: 'awaiting_student_approval', to: 'awaiting_payment', roles: ['self'] },
    { from: 'awaiting_student_approval', to: 'rejected', roles: ['self'] },
    { from: 'awaiting_payment', to: 'approved', roles: ['system'], condition: 'payment_confirmed' },
    { from: 'approved', to: 'assigned', roles: ['requests_reviewer', 'super_admin'] },
    { from: 'assigned', to: 'in_production', roles: ['self'] }, // المدرب المُسند
    { from: 'in_production', to: 'in_internal_review', roles: ['self'] },
    { from: 'in_internal_review', to: 'revision_requested', roles: ['content_admin', 'super_admin'] },
    { from: 'in_internal_review', to: 'delivered', roles: ['content_admin', 'super_admin'] },
    { from: 'revision_requested', to: 'in_internal_review', roles: ['self'] },
    { from: 'delivered', to: 'completed', roles: ['self'] },
    { from: 'delivered', to: 'disputed', roles: ['self'] },
    { from: 'disputed', to: 'in_production', roles: ['super_admin'] },
    { from: 'disputed', to: 'completed', roles: ['super_admin'] },
    // الإلغاء مسموح من أي حالة سابقة للموافقة
    { from: 'draft', to: 'cancelled', roles: ['self'] },
    { from: 'submitted', to: 'cancelled', roles: ['self'] },
    { from: 'under_review', to: 'cancelled', roles: ['self'] },
    { from: 'awaiting_student_approval', to: 'cancelled', roles: ['self'] },
    { from: 'awaiting_payment', to: 'cancelled', roles: ['self'] },
  ];

  for (const t of transitions) {
    await prisma.requestStatusTransition.upsert({
      where: { fromStatus_toStatus: { fromStatus: t.from, toStatus: t.to } },
      update: { allowedRoles: t.roles, requiresCondition: t.condition },
      create: {
        fromStatus: t.from,
        toStatus: t.to,
        allowedRoles: t.roles,
        requiresCondition: t.condition,
      },
    });
  }
  console.log(`  ✓ ${transitions.length} قاعدة انتقال لحالة الطلبات الخاصة جاهزة`);

  // 6) توجيه النماذج (كما اتُّفق عليه: Haiku للبسيط/الحجم الكبير، Sonnet للمتوسط، Opus للحرج)
  // fallback: عند ازدحام النموذج الأساسي، يتحوّل تلقائيًا لنموذج أخف بدل فشل الطلب كليًا
  const modelRoutings: Array<{
    featureType: string;
    modelId: string;
    fallbackModelId?: string;
    maxTokens: number;
    requiresReview: boolean;
  }> = [
    { featureType: 'lesson_qa', modelId: 'claude-sonnet-5', fallbackModelId: 'claude-haiku-4-5-20251001', maxTokens: 1024, requiresReview: false },
    { featureType: 'summarization', modelId: 'claude-haiku-4-5-20251001', maxTokens: 1024, requiresReview: false },
    { featureType: 'question_bank_gen', modelId: 'claude-opus-4-8', fallbackModelId: 'claude-sonnet-5', maxTokens: 4096, requiresReview: true },
    { featureType: 'custom_request_brief', modelId: 'claude-sonnet-5', fallbackModelId: 'claude-haiku-4-5-20251001', maxTokens: 1024, requiresReview: false },
    { featureType: 'pricing_suggestion', modelId: 'claude-opus-4-8', fallbackModelId: 'claude-sonnet-5', maxTokens: 1024, requiresReview: true },
    { featureType: 'campaign_draft', modelId: 'claude-sonnet-5', fallbackModelId: 'claude-haiku-4-5-20251001', maxTokens: 2048, requiresReview: false },
    { featureType: 'support_reply_draft', modelId: 'claude-haiku-4-5-20251001', maxTokens: 1024, requiresReview: false },
    { featureType: 'contact_leak_detection', modelId: 'claude-haiku-4-5-20251001', maxTokens: 256, requiresReview: false },
  ];
  for (const m of modelRoutings) {
    await prisma.aiModelRouting.upsert({
      where: { featureType: m.featureType },
      update: {},
      create: {
        featureType: m.featureType,
        modelId: m.modelId,
        fallbackModelId: m.fallbackModelId,
        maxTokens: m.maxTokens,
        requiresHumanReview: m.requiresReview,
      },
    });
  }
  console.log(`  ✓ توجيه النماذج لـ ${modelRoutings.length} ميزة ذكاء اصطناعي جاهز`);

  // 7) كتالوج التقارير الأساسية (كل استعلام مربوط باستعلام Whitelisted في الكود)
  const reportDefs: Array<{
    key: string;
    category: 'academic' | 'administrative' | 'financial';
    roles: string[];
    query: string;
  }> = [
    { key: 'student_academic_transcript', category: 'academic', roles: ['student'], query: 'student_academic_transcript' },
    { key: 'instructor_course_performance', category: 'academic', roles: ['instructor'], query: 'instructor_course_performance' },
    { key: 'student_payments_statement', category: 'financial', roles: ['student'], query: 'student_payments_statement' },
    { key: 'instructor_earnings_statement', category: 'financial', roles: ['instructor'], query: 'instructor_earnings_statement' },
    { key: 'platform_revenue_summary', category: 'financial', roles: ['finance_manager', 'super_admin'], query: 'platform_revenue_summary' },
    { key: 'platform_user_growth', category: 'administrative', roles: ['marketing_manager', 'super_admin'], query: 'platform_user_growth' },
    { key: 'instructor_payouts_liability', category: 'financial', roles: ['finance_manager', 'super_admin'], query: 'instructor_payouts_liability' },
  ];
  for (const r of reportDefs) {
    await prisma.reportDefinition.upsert({
      where: { reportKey: r.key },
      update: {},
      create: {
        reportKey: r.key,
        category: r.category,
        applicableRoles: r.roles,
        dataSourceQuery: r.query,
        supportsExportFormats: ['view', 'pdf'],
      },
    });
  }
  console.log(`  ✓ كتالوج التقارير (${reportDefs.length} تقرير) جاهز`);

  console.log('✅ اكتملت التهيئة');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
