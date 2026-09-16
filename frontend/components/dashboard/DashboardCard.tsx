import type { ReactNode } from 'react';

export function DashboardCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
