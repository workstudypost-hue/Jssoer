export function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-xs text-slate-500">{label}</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
