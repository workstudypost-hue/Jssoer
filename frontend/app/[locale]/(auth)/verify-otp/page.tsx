'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
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
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleResend() {
    if (!identifier || resendCooldown > 0) return;
    setResendMessage(null);
    setResendLoading(true);
    try {
      await authApi.resendOtp(identifier);
      setResendMessage(t('verifyOtp.resendSuccess'));
      // 60 ثانية تهدئة على الواجهة - وقاية إضافية للتجربة، والحد الفعلي (3 كل
      // 10 دقائق) مُنفَّذ على الخادم بغض النظر عن هذا التبريد المحلي.
      setResendCooldown(60);
    } catch (err) {
      setResendMessage(err instanceof ApiError ? err.message : t('genericError'));
    } finally {
      setResendLoading(false);
    }
  }

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

      <p className="mt-6 text-center text-sm text-slate-500">
        {resendMessage ?? t('verifyOtp.noCodeNote')}
      </p>
      <button
        type="button"
        onClick={handleResend}
        disabled={resendLoading || resendCooldown > 0}
        className="mx-auto mt-2 block text-sm font-semibold text-navy-900 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
      >
        {resendCooldown > 0
          ? t('verifyOtp.resendCooldown', { seconds: resendCooldown })
          : t('verifyOtp.resendButton')}
      </button>
    </AuthShell>
  );
}
