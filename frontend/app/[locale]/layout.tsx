import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Tajawal, Inter } from 'next/font/google';
import { locales, rtlLocales, type AppLocale } from '../../i18n';
import '../globals.css';

// نحمّل الوزنين المستخدمين فعليًا فقط (عادي + عريض/شبه أسود للعناوين) بدل العائلة
// كاملة، لتقليل الحجم المُحمَّل. next/font يُضمّن الخط ذاتيًا (لا طلب خارجي وقت
// التصفح، ولا استغلال بيانات المستخدم عبر Google Fonts مباشرة).
const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-tajawal',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

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
    <html lang={locale} dir={direction} className={`${tajawal.variable} ${inter.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
