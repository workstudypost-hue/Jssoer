import type { ReactNode } from 'react';
import { BrandMark } from '../auth/AuthShell';

export function DashboardShell({
  userLabel,
  logoutLabel,
  onLogout,
  children,
}: {
  userLabel: string;
  logoutLabel: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 lg:px-10">
        <BrandMark light />
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{userLabel}</span>
          <button
            onClick={onLogout}
            className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-navy-900 transition-colors hover:bg-navy-50"
          >
            {logoutLabel}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 lg:px-10">{children}</main>
    </div>
  );
}
