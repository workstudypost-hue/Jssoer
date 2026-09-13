import { createNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from '../i18n';

/**
 * أدوات تنقّل واعية باللغة الحالية (Link / useRouter / usePathname / redirect) -
 * تُضيف بادئة اللغة تلقائيًا لكل الروابط الداخلية بدل كتابتها يدويًا في كل صفحة،
 * وتمنع نسيان البادئة عند التنقل البرمجي (router.push) وهي أكثر مصدر أخطاء شائع
 * في التطبيقات متعددة اللغات.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
