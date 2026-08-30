'use client';

import { useEffect, useRef, useState } from 'react';
import { VideoWatermarkOverlay } from './VideoWatermarkOverlay';

interface SecurePlayerProps {
  lessonId: string;
  viewerLabel: string;
  apiBaseUrl: string;
  accessToken: string;
}

interface PlaybackState {
  sessionId: string;
  signedPlaybackUrl: string | null;
  expiresInMinutes: number;
}

const HEARTBEAT_INTERVAL_MS = 30_000; // كل 30 ثانية كما اتُّفق عليه في التصميم

/**
 * مشغّل فيديو آمن يدمج: بدء جلسة تشغيل موقَّعة من الخادم، تجديد دوري (Heartbeat)،
 * Watermark ديناميكي فوق الفيديو، وكشف أساسي لفتح DevTools (يُبلَّغ للخادم دون
 * أي إجراء عقابي فوري على الواجهة - القرار يبقى بيد Security Review Queue).
 */
export function SecurePlayer({ lessonId, viewerLabel, apiBaseUrl, accessToken }: SecurePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  // بدء الجلسة عند التحميل
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const deviceFingerprint = await getOrCreateDeviceFingerprint();
        const response = await fetch(`${apiBaseUrl}/videos/playback-session`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ lessonId, deviceFingerprint }),
        });
        if (!response.ok) throw new Error('تعذَّر بدء جلسة التشغيل');
        const data = await response.json();
        if (!cancelled) {
          setPlayback({
            sessionId: data.sessionId,
            signedPlaybackUrl: data.signedPlaybackUrl,
            expiresInMinutes: data.expiresInMinutes,
          });
        }
      } catch (err) {
        if (!cancelled) setError('تعذَّر تحميل الفيديو - حاول تحديث الصفحة');
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // تحميل مصدر HLS عبر hls.js (لأي متصفح غير Safari) بعد توفر signedPlaybackUrl
  useEffect(() => {
    if (!playback?.signedPlaybackUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari يدعم HLS أصليًا دون أي مكتبة إضافية
      video.src = playback.signedPlaybackUrl;
      return;
    }

    let hlsInstance: any;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    import('hls.js').then(({ default: Hls }) => {
      if (Hls.isSupported()) {
        hlsInstance = new Hls();
        hlsInstance.loadSource(playback.signedPlaybackUrl!);
        hlsInstance.attachMedia(video);
      }
    });

    return () => hlsInstance?.destroy();
  }, [playback?.signedPlaybackUrl]);

  // Heartbeat دوري لتجديد صلاحية الرابط الموقَّع قبل انتهائها
  useEffect(() => {
    if (!playback?.sessionId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/videos/playback-session/${playback.sessionId}/heartbeat`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({}),
        });
        if (!response.ok) return;
        const data = await response.json();
        setPlayback((prev) => (prev ? { ...prev, signedPlaybackUrl: data.signedPlaybackUrl } : prev));
      } catch {
        // فشل تجديد واحد ليس حرجًا - سيُعاد المحاولة في الدورة التالية
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [playback?.sessionId]);

  // كشف أساسي لفتح أدوات المطوّر (Heuristic - فرق حجم النافذة الخارجي/الداخلي) -
  // ليس مضمونًا 100% (لا توجد طريقة موثوقة بالكامل من المتصفح)، لكنه رادع إضافي
  // ضمن استراتيجية دفاع متعدد الطبقات (Overlay + Signed URL + هذا الكشف).
  useEffect(() => {
    const threshold = 160;
    let wasOpen = false;

    const check = async () => {
      const isOpen =
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold;

      if (isOpen && !wasOpen && playback?.sessionId) {
        wasOpen = true;
        await fetch(`${apiBaseUrl}/videos/security-events`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ lessonId, eventType: 'devtools_opened' }),
        }).catch(() => undefined);
      } else if (!isOpen) {
        wasOpen = false;
      }
    };

    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [lessonId, playback?.sessionId]);

  // إنهاء الجلسة عند مغادرة الصفحة
  useEffect(() => {
    return () => {
      if (playback?.sessionId) {
        navigator.sendBeacon?.(
          `${apiBaseUrl}/videos/playback-session/${playback.sessionId}/end`,
          new Blob([], { type: 'application/json' }),
        );
      }
    };
  }, [playback?.sessionId]);

  if (error) {
    return <div style={{ color: '#b91c1c', padding: '1rem' }}>{error}</div>;
  }

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
      <video
        ref={videoRef}
        controls
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        style={{ width: '100%', height: '100%' }}
      />
      {playback?.sessionId && <VideoWatermarkOverlay viewerLabel={viewerLabel} sessionId={playback.sessionId} />}
    </div>
  );
}

/**
 * بصمة جهاز مبسّطة ومستقرة (مُخزَّنة محليًا) - كافية لأغراض ربط جلسة التشغيل
 * بجهاز محدد (منع نسخ playback_token واستخدامه من جهاز آخر عبر مطابقة الخادم
 * لهذا الحقل)، وليست بديلاً عن حل بصمة متقدم (مثل FingerprintJS Pro) إن احتاجت
 * المنصة دقة أعلى مستقبلًا.
 */
async function getOrCreateDeviceFingerprint(): Promise<string> {
  const storageKey = 'ws_device_fp';
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;

  const raw = `${navigator.userAgent}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
  const fingerprint = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  localStorage.setItem(storageKey, fingerprint);
  return fingerprint;
}
