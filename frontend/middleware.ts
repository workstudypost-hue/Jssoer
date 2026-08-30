import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  // البادئة دائمًا صريحة لكل اللغات (بما فيها العربية /ar/)
  // لتفادي غموض hreflang كما اتُّفق عليه في استراتيجية الـ SEO
  localePrefix: 'always',
});

export const config = {
  // تطبيق الـ Middleware على كل المسارات عدا الملفات الثابتة وواجهة الـ API
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
