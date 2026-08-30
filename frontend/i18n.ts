import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

// اللغات الأربع المدعومة كما اتُّفق عليه في التصميم المعماري
export const locales = ['ar', 'en', 'fr', 'tl'] as const;
export type AppLocale = (typeof locales)[number];

// العربية اللغة الافتراضية - تُعرض مع بادئة صريحة /ar/ لتفادي غموض hreflang
export const defaultLocale: AppLocale = 'ar';

export const rtlLocales: AppLocale[] = ['ar'];

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as AppLocale)) notFound();

  return {
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
