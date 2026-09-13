'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '../../../../lib/i18n-navigation';
import { authApi, ApiError, setTokens } from '../../../../lib/api';
import { getDeviceFingerprint } from '../../../../lib/device-fingerprint';
import { AuthShell } from '../../../../components/auth/AuthShell';
import { FormField } from '../../../../components/auth/FormField';
import { SubmitButton } from '../../../../components/auth/SubmitButton';
import { FormError } from '../../../../components/auth/FormError';

export default function VerifyOtpPage() {
  // useSearchParams يتطلّب حدود Suspense صريحة في App Router وإلا يفشل البناء
  // الثابت (راجع تحذير Next.js: "useSearchParams() should be wrapped in a suspense boundary").
  return (
    <Suspense fallback={null}>
      <VerifyOtpForm />
    </Suspense>
  );
}

function VerifyOtpForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const identifier = searchParams.get('identifier');

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!identifier) return;
    setError(null);
    setLoading(true);
    try {
      const session = await authApi.verifyOtp({
        identifier,
        code: code.trim(),
        deviceFingerprint: getDeviceFingerprint(),
      });
      setTokens(session.accessToken, session.refreshToken);
      router.push('/dashboard/student');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('genericError'));
    } finally {
      setLoading(false);
    }
  }

  if (!identifier) {
    return (
      <AuthShell panelTitle={t('panel.title')} panelSubtitle={t('panel.subtitle')}>
        <FormError message={t('verifyOtp.missingIdentifier')} />
        <Link
          href="/register"
          className="mt-4 inline-block font-semibold text-navy-900 hover:underline"
        >
          {t('verifyOtp.backToRegister')}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell panelTitle={t('panel.title')} panelSubtitle={t('panel.subtitle')}>
      <h2 className="text-2xl font-bold text-navy-950">{t('verifyOtp.heading')}</h2>
      <p className="mt-1.5 text-[15px] text-slate-600">
        {t('verifyOtp.subheading', { identifier })}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <FormError message={error} />
        <FormField
          id="code"
          inputMode="numeric"
          maxLength={6}
          label={t('verifyOtp.codeLabel')}
          hint={t('verifyOtp.expiryNote')}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className="text-center text-lg tracking-[0.5em]"
          autoComplete="one-time-code"
          required
        />
        <SubmitButton
          loading={loading}
          loadingLabel={t('verifyOtp.submitting')}
          disabled={code.length !== 6}
        >
          {t('verifyOtp.submit')}
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">{t('verifyOtp.noCodeNote')}</p>
    </AuthShell>
  );
}
