'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * تستقبل هذه الصفحة access_token/refresh_token من URL Fragment (وليس Query String)
 * بعد نجاح OAuth Callback في الخادم (راجع public-auth.controller.ts:redirectWithTokens).
 * استخدام الـ Fragment (#) مقصود: لا يُرسَل للخادم في أي طلب لاحق ولا يظهر في
 * سجلات الوصول، مما يقلل خطر تسريب التوكن عبر Referer headers.
 *
 * لهذا السبب بالتحديد يجب قراءة window.location.hash من الـ Client مباشرة (Server
 * Components لا ترى الـ Fragment إطلاقًا - لا يصل للخادم أساسًا) - الصفحة كاملة
 * Client Component عمدًا.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const t = useTranslations('Auth');
  const [status, setStatus] = useState<'processing' | 'error'>('processing');

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setStatus('error');
      return;
    }

    // تخزين التوكنات - في تطبيق إنتاجي فعلي يُفضَّل الاعتماد على Cookie httpOnly
    // مُعيَّن من الخادم مباشرة بدل localStorage (أكثر أمانًا ضد XSS)؛ هنا نستخدم
    // localStorage تبسيطًا للتوافق مع بقية عميل الـ API الحالي في هذا الـ Scaffold.
    localStorage.setItem('ws_access_token', accessToken);
    localStorage.setItem('ws_refresh_token', refreshToken);

    // تنظيف الـ Fragment من شريط العنوان فورًا (لا يبقى التوكن ظاهرًا في السجل/الـ History)
    window.history.replaceState(null, '', window.location.pathname);

    router.replace('/dashboard/student');
  }, [router]);

  if (status === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">{t('oauthCallbackError')}</h1>
          <p className="text-gray-600">{t('oauthCallbackErrorHint')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600">{t('oauthCallbackProcessing')}</p>
      </div>
    </main>
  );
}
