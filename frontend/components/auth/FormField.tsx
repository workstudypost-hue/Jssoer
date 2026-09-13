import { forwardRef } from 'react';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-navy-900">
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-slate-400 focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15 ${
            error ? 'border-red-400' : 'border-slate-300'
          } ${className ?? ''}`}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : hint ? (
          <p className="text-sm text-slate-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);
FormField.displayName = 'FormField';
