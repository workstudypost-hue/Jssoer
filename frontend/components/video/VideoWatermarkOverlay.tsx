'use client';

import { useEffect, useState } from 'react';

interface VideoWatermarkOverlayProps {
  /** نص التعريف الظاهر (مثلًا: بريد الطالب أو معرِّفه المختصر) - وليس معرِّفًا داخليًا خامًا */
  viewerLabel: string;
  sessionId: string;
}

/**
 * طبقة Watermark شفافة تتحرك دوريًا فوق الفيديو - جزء من المرحلة الأولى لحماية
 * الفيديو (Overlay Watermark + Signed URLs) كما اتُّفق عليه، قبل DRM الكامل لاحقًا.
 * الهدف: ردع تسجيل الشاشة ومشاركة الفيديو (وليس منعه تقنيًا بشكل كامل - Overlay
 * وحده لا يعادل DRM) عبر إظهار هوية المُشاهد بوضوح كافٍ لتتبع مصدر أي تسريب.
 * التحرك الدوري (كل 12-18 ثانية، لموضع عشوائي جديد) يمنع اقتصاص الفيديو
 * ببساطة لإزالة العلامة من زاوية ثابتة.
 */
export function VideoWatermarkOverlay({ viewerLabel, sessionId }: VideoWatermarkOverlayProps) {
  const [position, setPosition] = useState({ top: '10%', left: '10%' });

  useEffect(() => {
    const moveWatermark = () => {
      // نُبقي هامشًا 8%-85% حتى لا تخرج العلامة عن حدود الفيديو المرئية
      const top = `${8 + Math.random() * 77}%`;
      const left = `${8 + Math.random() * 77}%`;
      setPosition({ top, left });
    };

    moveWatermark();
    const intervalMs = 12000 + Math.random() * 6000; // 12-18 ثانية عشوائيًا
    const interval = setInterval(moveWatermark, intervalMs);
    return () => clearInterval(interval);
  }, []);

  const timestamp = new Date().toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        transition: 'top 1.5s ease-in-out, left 1.5s ease-in-out',
        pointerEvents: 'none',
        userSelect: 'none',
        color: 'rgba(255,255,255,0.35)',
        fontSize: '13px',
        fontWeight: 600,
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        whiteSpace: 'nowrap',
        zIndex: 10,
        direction: 'rtl',
      }}
      aria-hidden="true"
    >
      {viewerLabel} · {sessionId.slice(0, 8)} · {timestamp}
    </div>
  );
}
