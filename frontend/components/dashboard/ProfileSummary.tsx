import { useTranslations } from 'next-intl';
import type { UserProfile } from '../../lib/api';

export function ProfileSummary({ profile }: { profile: UserProfile }) {
  const t = useTranslations('Dashboard.profile');
  const roleNames = profile.roles.map((r) => r.role.name).join('، ');

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={t('identifier')} value={profile.email ?? profile.phone ?? '—'} />
      <Field label={t('role')} value={roleNames || '—'} />
      <Field label={t('status')} value={t(`statusValues.${profile.status}`)} />
      <Field label={t('joinedAt')} value={new Date(profile.createdAt).toLocaleDateString()} />
    </dl>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-navy-950">{value}</dd>
    </div>
  );
}
