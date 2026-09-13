'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '../../../../lib/i18n-navigation';
import { authApi, ApiError, setTokens } from '../../../../lib/api';
import { getDeviceFingerprint } from '../../../../lib/device-fingerprint';
import { AuthShell } from '../../../../components/auth/AuthShell';
import { FormField } from '../../../../components/auth/FormField';
import { SubmitButton } from '../../../../components/auth/SubmitButton';
import { FormError } from '../../../../components/auth/FormError';
import { OAuthButtons } from '../../../../components/auth/OAuthButtons';
import { Divider } from '../../../../components/auth/Divider';

export default function LoginPage() {
  const t = useTranslations('Auth');
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await authApi.login({
        identifier: identifier.trim(),
        password,
        deviceFingerprint: getDeviceFingerprint(),
      });
      setTokens(session.accessToken, session.refreshToken);
      // لا توجد لوحات تحكّم فعلية بعد بهذه المرحلة من البناء - المسار موجود
      // للتناسق مع صفحة oauth-callback وسيُفعَّل فعليًا عند بناء لوحات الطلاب/المدربين.
      router.push('/dashboard/student');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('genericError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell panelTitle={t('panel.title')} panelSubtitle={t('panel.subtitle')}>
      <h2 className="text-2xl font-bold text-navy-950">{t('login.heading')}</h2>
      <p className="mt-1.5 text-[15px] text-slate-600">{t('login.subheading')}</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <FormError message={error} />
        <FormField
          id="identifier"
          label={t('login.identifierLabel')}
          placeholder={t('login.identifierPlaceholder')}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          required
        />
        <FormField
          id="password"
          type="password"
          label={t('login.passwordLabel')}
          placeholder={t('login.passwordPlaceholder')}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <SubmitButton loading={loading} loadingLabel={t('login.submitting')}>
          {t('login.submit')}
        </SubmitButton>
      </form>

      <Divider label={t('common.orDivider')} />
      <OAuthButtons
        googleLabel={t('oauth.continueWithGoogle')}
        microsoftLabel={t('oauth.continueWithMicrosoft')}
      />

      <p className="mt-8 text-center text-[15px] text-slate-600">
        {t('login.noAccount')}{' '}
        <Link href="/register" className="font-semibold text-navy-900 hover:underline">
          {t('login.createAccount')}
        </Link>
      </p>
    </AuthShell>
  );
}
