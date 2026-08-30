import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const geoip = require('geoip-lite');

/**
 * تحويل IP → كود دولة فعليًا عبر geoip-lite (قاعدة بيانات مُضمَّنة محليًا في الحزمة
 * نفسها - لا استدعاء شبكة خارجي، مناسب لحجم استعلامات video security المرتفع).
 * دقة geoip-lite على مستوى الدولة جيدة جدًا (~99%) رغم كونها أقل دقة من MaxMind
 * التجاري على مستوى المدينة - وهو كافٍ تمامًا لحالة الاستخدام هنا (كشف نمط
 * "نفس الحساب من عدة دول" وليس تحديد موقع دقيق).
 */
@Injectable()
export class GeoIpService {
  resolveCountry(ipAddress?: string | null): string | null {
    if (!ipAddress) return null;
    // عناوين محلية (127.0.0.1, ::1) شائعة في بيئة التطوير - لا تُرجع دولة حقيقية
    if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.')) {
      return null;
    }
    const result = geoip.lookup(ipAddress);
    return result?.country ?? null;
  }
}
