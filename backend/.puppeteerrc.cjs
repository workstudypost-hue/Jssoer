/**
 * يمنع Puppeteer من تحميل نسخته الخاصة من Chromium (~300 ميجا) أثناء npm install -
 * هذا التحميل يفشل دائمًا في أي بيئة شبكة مقيّدة (CI/CD، Docker builds خلف بروكسي،
 * بيئات تطوير بلا وصول مباشر لـ googleapis.com) ويُسقط التثبيت بالكامل حتى لو كانت
 * كل بقية الحزم سليمة تمامًا.
 *
 * البديل: الاعتماد على Chromium/Google Chrome مثبَّت على مستوى النظام (يُثبَّت مرة
 * واحدة عبر apt/الحاوية الأساسية)، ويُمرَّر مساره عبر PUPPETEER_EXECUTABLE_PATH -
 * راجع .env.example وreport-export.service.ts.
 */
module.exports = {
  skipDownload: true,
};
