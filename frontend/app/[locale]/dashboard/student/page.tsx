'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthGuard } from '../../../../lib/use-auth-guard';
import { usersApi, ApiError, type UserProfile } from '../../../../lib/api';
import { DashboardShell } from '../../../../components/dashboard/DashboardShell';
import { DashboardCard } from '../../../../components/dashboard/DashboardCard';
import { ProfileSummary } from '../../../../components/dashboard/ProfileSummary';
import { CustomRequestsPanel } from '../../../../components/dashboard/CustomRequestsPanel';
import { ComingSoonNotice } from '../../../../components/dashboard/ComingSoonNotice';

export default function StudentDashboardPage() {
  const t = useTranslations('Dashboard');
  const { ready, logout } = useAuthGuard();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    usersApi
      .getMe()
      .then(setProfile)
      .catch((err) => {
        // 401 هنا يعني التوكن منتهي/غير صالح - أوضح استجابة هي إعادة تسجيل
        // الدخول مباشرة بدل ترك المستخدم أمام رسالة خطأ صامتة.
        if (err instanceof ApiError && err.status === 401) {
          logout();
          return;
        }
        setError(err instanceof ApiError ? err.message : t('genericError'));
      });
  }, [ready, logout, t]);

  if (!ready) return null;

  return (
    <DashboardShell
      userLabel={profile?.email ?? profile?.phone ?? ''}
      logoutLabel={t('logout')}
      onLogout={logout}
    >
      <h1 className="text-2xl font-bold text-navy-950">{t('welcomeTitle')}</h1>
      <p className="mt-1.5 text-[15px] text-slate-600">{t('welcomeSubtitle')}</p>

      <div className="mt-8 flex flex-col gap-6">
        <DashboardCard title={t('profile.title')}>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : profile ? (
            <ProfileSummary profile={profile} />
          ) : (
            <p className="text-sm text-slate-500">{t('loading')}</p>
          )}
        </DashboardCard>

        <DashboardCard title={t('courses.title')}>
          <ComingSoonNotice message={t('courses.comingSoon')} />
        </DashboardCard>

        <DashboardCard title={t('customRequests.title')}>
          <CustomRequestsPanel />
        </DashboardCard>
      </div>
    </DashboardShell>
  );
}
