export function ComingSoonNotice({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
      <p className="mx-auto text-sm text-slate-500">{message}</p>
    </div>
  );
}
