import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { locales, rtlLocales, type AppLocale } from '../../i18n';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: AppLocale };
}) {
  // يُفعّل الـ Static Rendering لكل الصفحات تحت هذا الـ Layout بدل الوقوع بالخطأ
  // إلى Dynamic Rendering (next-intl يقرأ headers() داخليًا لتحديد اللغة ما لم
  // نُخبره صراحةً بالـ locale الحالي عبر هذا الاستدعاء - يجب أن يُستدعى أولًا).
  setRequestLocale(locale);

  const messages = await getMessages();
  const direction = rtlLocales.includes(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={direction}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
