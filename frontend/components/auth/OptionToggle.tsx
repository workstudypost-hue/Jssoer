export function OptionToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border py-2.5 text-[14px] font-medium transition-colors ${
        active
          ? 'border-navy-900 bg-navy-900 text-white'
          : 'border-slate-300 bg-white text-navy-900 hover:bg-navy-50'
      }`}
    >
      {label}
    </button>
  );
}
