import { authApi } from '../../lib/api';

export function OAuthButtons({ googleLabel, microsoftLabel }: { googleLabel: string; microsoftLabel: string }) {
  return (
    <div className="flex flex-col gap-3">
      {/* روابط تصفّح حقيقية (ليست fetch) - تُنقل المستخدم فعليًا لبدء تدفّق OAuth على الخادم */}
      <a
        href={authApi.googleLoginUrl()}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white py-2.5 text-[15px] font-medium text-navy-900 transition-colors hover:bg-navy-50"
      >
        <GoogleIcon />
        {googleLabel}
      </a>
      <a
        href={authApi.microsoftLoginUrl()}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white py-2.5 text-[15px] font-medium text-navy-900 transition-colors hover:bg-navy-50"
      >
        <MicrosoftIcon />
        {microsoftLabel}
      </a>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#F25022" d="M1 1h7.5v7.5H1z" />
      <path fill="#7FBA00" d="M9.5 1H17v7.5H9.5z" />
      <path fill="#00A4EF" d="M1 9.5h7.5V17H1z" />
      <path fill="#FFB900" d="M9.5 9.5H17V17H9.5z" />
    </svg>
  );
}
