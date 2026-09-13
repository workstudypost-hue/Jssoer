const DEVICE_FINGERPRINT_KEY = 'ws_device_fingerprint';

/**
 * بصمة جهاز بسيطة ومستقرة (UUID مُولَّد مرة واحدة ومخزَّن محليًا)، تُستخدم فقط
 * لتمييز "هذا المتصفح تحديدًا" بغرض إنفاذ سياسة عدد الأجهزة النشطة على الخادم
 * (راجع device.service.ts) - ليست بصمة جهاز حقيقية (canvas/WebGL fingerprinting)
 * ولا تحتاج أن تكون كذلك، فالخادم لا يثق بها لأي غرض أمني حسّاس أعمق من هذا.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return '';

  let fingerprint = localStorage.getItem(DEVICE_FINGERPRINT_KEY);
  if (!fingerprint) {
    fingerprint =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `fp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint);
  }
  return fingerprint;
}
