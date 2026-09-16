'use client';

import { useEffect, useState } from 'react';
import { useRouter } from './i18n-navigation';
import { getAccessToken, clearTokens } from './api';

/**
 * حراسة بسيطة من جهة العميل للصفحات المحمية: تتحقق من وجود access token
 * محليًا، وتُحوِّل لصفحة الدخول فورًا إن لم يوجد. هذا تحقق شكلي فقط لتحسين
 * التجربة (منع وميض محتوى محمي قبل التحويل) - التحقق الحقيقي والوحيد الموثوق
 * يبقى على الخادم عبر JwtAuthGuard في كل طلب API فعلي، تمامًا كما ينص مبدأ
 * "Double validation everywhere" الموثَّق لهذا المشروع.
 */
export function useAuthGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  function logout() {
    clearTokens();
    router.replace('/login');
  }

  return { ready, logout };
}
