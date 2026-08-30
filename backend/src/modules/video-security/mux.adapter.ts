import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

/**
 * تكامل Mux Video (Signed Playback URLs) - المرحلة الأولى من حماية الفيديو
 * (Overlay Watermark + Signed URLs) كما اتُّفق عليه، قبل الانتقال لاحقًا لـ DRM
 * الكامل للمحتوى عالي القيمة. Mux يتطلب توقيع JWT بمفتاح Signing Key مُنشأ من
 * لوحة Mux (مختلف عن Playback ID العام) - راجع: https://docs.mux.com/guides/secure-video-playback
 */
@Injectable()
export class MuxAdapter {
  private readonly logger = new Logger(MuxAdapter.name);
  private signingKeyId = process.env.MUX_SIGNING_KEY_ID ?? '';
  private signingKeyPrivate = (process.env.MUX_SIGNING_KEY_PRIVATE ?? '').replace(/\\n/g, '\n');

  /**
   * يُنتج رابط HLS موقَّع صالح لمدة قصيرة (يُطابق عمر playback_token في
   * VideoSecurityService - كلاهما يُجدَّد سويًا عبر نفس الـ Heartbeat).
   */
  generateSignedPlaybackUrl(muxPlaybackId: string, expiresInMinutes: number, viewerId: string): string {
    if (!this.signingKeyId || !this.signingKeyPrivate) {
      this.logger.warn('[DEV_ONLY] مفاتيح Mux Signing غير مضبوطة - إرجاع رابط تشغيل عام غير موقَّع');
      return `https://stream.mux.com/${muxPlaybackId}.m3u8`;
    }

    const token = jwt.sign(
      {
        sub: muxPlaybackId,
        aud: 'v', // 'v' = video playback (وليس 't' thumbnail أو 'g' gif)
        // يُضمَّن معرِّف المُشاهد في الـ payload لأغراض التتبع/audit فقط - Mux لا يتحقق منه،
        // لكنه يظهر في سجلات فك التوقيع اليدوي عند التحقيق بحادثة تسريب محتوى
        kid: this.signingKeyId,
        viewer: viewerId,
      },
      this.signingKeyPrivate,
      { algorithm: 'RS256', keyid: this.signingKeyId, expiresIn: `${expiresInMinutes}m` },
    );

    return `https://stream.mux.com/${muxPlaybackId}.m3u8?token=${token}`;
  }

  generateThumbnailToken(muxPlaybackId: string): string | null {
    if (!this.signingKeyId || !this.signingKeyPrivate) return null;
    return jwt.sign(
      { sub: muxPlaybackId, aud: 't', kid: this.signingKeyId },
      this.signingKeyPrivate,
      { algorithm: 'RS256', keyid: this.signingKeyId, expiresIn: '1h' },
    );
  }
}
