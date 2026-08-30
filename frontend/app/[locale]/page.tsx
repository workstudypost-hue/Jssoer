import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '../../i18n';

export default function HomePage({ params: { locale } }: { params: { locale: AppLocale } }) {
  setRequestLocale(locale);
  const t = useTranslations('Home');

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">{t('title')}</h1>
        <p className="text-gray-600">{t('subtitle')}</p>
      </div>
    </main>
  );
}
