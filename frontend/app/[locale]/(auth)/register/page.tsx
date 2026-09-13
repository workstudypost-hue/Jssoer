'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '../../../../lib/i18n-navigation';
import { authApi, ApiError, type UserRole } from '../../../../lib/api';
import type { AppLocale } from '../../../../i18n';
import { AuthShell } from '../../../../components/auth/AuthShell';
import { FormField } from '../../../../components/auth/FormField';
import { SubmitButton } from '../../../../components/auth/SubmitButton';
import { FormError } from '../../../../components/auth/FormError';
import { OAuthButtons } from '../../../../components/auth/OAuthButtons';
import { Divider } from '../../../../components/auth/Divider';
import { OptionToggle } from '../../../../components/auth/OptionToggle';

type ContactMethod = 'email' | 'phone';

export default function RegisterPage() {
  const t = useTranslations('Auth');
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [role, setRole] = useState<UserRole>('student');
  const [method, setMethod] = useState<ContactMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('register.passwordMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('validation.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.register({
        email: method === 'email' ? email.trim() : undefined,
        phone: method === 'phone' ? phone.trim() : undefined,
        password,
        preferredLocale: locale,
        requestedRole: role,
      });
      router.push({ pathname: '/verify-otp', query: { identifier: result.identifier } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('genericError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell panelTitle={t('panel.title')} panelSubtitle={t('panel.subtitle')}>
      <h2 className="text-2xl font-bold text-navy-950">{t('register.heading')}</h2>
      <p className="mt-1.5 text-[15px] text-slate-600">{t('register.subheading')}</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <FormError message={error} />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-navy-900">{t('register.roleLabel')}</span>
          <div className="grid grid-cols-2 gap-2">
            <OptionToggle
              active={role === 'student'}
              onClick={() => setRole('student')}
              label={t('register.roleStudent')}
            />
            <OptionToggle
              active={role === 'instructor'}
              onClick={() => setRole('instructor')}
              label={t('register.roleInstructor')}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-navy-900">{t('register.contactMethodLabel')}</span>
          <div className="grid grid-cols-2 gap-2">
            <OptionToggle
              active={method === 'email'}
              onClick={() => setMethod('email')}
              label={t('register.methodEmail')}
            />
            <OptionToggle
              active={method === 'phone'}
              onClick={() => setMethod('phone')}
              label={t('register.methodPhone')}
            />
          </div>
        </div>

        {method === 'email' ? (
          <FormField
            id="email"
            type="email"
            label={t('register.emailLabel')}
            placeholder={t('register.emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        ) : (
          <FormField
            id="phone"
            type="tel"
            label={t('register.phoneLabel')}
            placeholder={t('register.phonePlaceholder')}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            required
          />
        )}

        <FormField
          id="password"
          type="password"
          label={t('register.passwordLabel')}
          hint={t('register.passwordHint')}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        <FormField
          id="confirmPassword"
          type="password"
          label={t('register.confirmPasswordLabel')}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />

        <SubmitButton loading={loading} loadingLabel={t('register.submitting')}>
          {t('register.submit')}
        </SubmitButton>
      </form>

      <Divider label={t('common.orDivider')} />
      <OAuthButtons
        googleLabel={t('oauth.continueWithGoogle')}
        microsoftLabel={t('oauth.continueWithMicrosoft')}
      />

      <p className="mt-8 text-center text-[15px] text-slate-600">
        {t('register.haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-navy-900 hover:underline">
          {t('register.signIn')}
        </Link>
      </p>
    </AuthShell>
  );
}
