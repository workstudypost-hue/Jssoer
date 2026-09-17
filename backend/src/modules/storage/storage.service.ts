import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

/**
 * خدمة تخزين موحّدة تُستخدم لكل رفع ملفات في المنصة (مرفقات الطلبات الخاصة
 * حاليًا؛ قابلة لإعادة الاستخدام لاحقًا لأي موديول آخر يحتاج رفع ملفات).
 *
 * تعتمد على Supabase Storage عبر مكتبتها الرسمية (@supabase/supabase-js)
 * مباشرة - وليس عبر طبقة توافق S3 الخاصة بها. جُرِّب الاتصال عبر بروتوكول S3
 * أولًا (نفس نمط Cloudflare R2) لكنه فشل بخطأ `SignatureDoesNotMatch` رغم
 * صحة بيانات الاعتماد؛ هذا خلل موثَّق ومعروف في تكامل عدة عملاء S3 القياسيين
 * (AWS SDK ضمنها) مع طبقة توافق S3 عند Supabase تحديدًا. الـ REST API
 * الأصلي أكثر موثوقية هنا لأنه المسار الذي تختبره Supabase نفسها بشكل أساسي.
 *
 * النمط يبقى كما هو: الـ Backend لا يستقبل الملف نفسه إطلاقًا - يُصدر رابطًا
 * موقَّعًا صالحًا لمدة قصيرة، يرفع العميل مباشرة عليه (PUT عادي، بدون توقيع
 * إضافي من طرف العميل)، ثم يُبلِّغ الـ Backend بالمفتاح النهائي فقط.
 */
@Injectable()
export class StorageService {
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET_UPLOADS ?? 'raw-uploads';
    this.client = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
      auth: { persistSession: false },
    });
  }

  /**
   * يُصدر رابط رفع موقَّعًا (PUT مباشر، بدون Authorization header إضافي - التوكن
   * مُضمَّن بالرابط نفسه كـ query param) - المفتاح يتضمن مسارًا منظَّمًا
   * (custom-requests/{ownerId}/{nanoid}-{filename}) لتفادي تصادم الأسماء
   * وتسهيل تتبّع/تدقيق أي ملف لاحقًا.
   */
  async generateUploadUrl(ownerId: string, filename: string, _contentType: string, prefix = 'custom-requests') {
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${prefix}/${ownerId}/${nanoid(10)}-${safeFilename}`;

    const { data, error } = await this.client.storage.from(this.bucket).createSignedUploadUrl(key);
    if (error) throw error;

    return { uploadUrl: data.signedUrl, key };
  }

  /** رابط تحميل مؤقت للملف بعد رفعه (لعرضه للمراجع/المدرب دون جعل الـ Bucket عامًا) */
  async generateDownloadUrl(key: string, bucket?: string) {
    const { data, error } = await this.client.storage.from(bucket ?? this.bucket).createSignedUrl(key, 900);
    if (error) throw error;
    return data.signedUrl;
  }

  /**
   * رفع مباشر من الخادم نفسه (وليس رابطًا موقَّعًا للعميل) - يُستخدم فقط للملفات
   * التي يُنشئها الخادم داخليًا (مثل تقارير PDF/XLSX المولَّدة عبر Puppeteer/exceljs)
   * وليس لمرفقات يرفعها المستخدم مباشرة (تلك تبقى عبر generateUploadUrl حصريًا).
   */
  async uploadBuffer(key: string, buffer: Buffer, contentType: string, bucket?: string) {
    const { error } = await this.client.storage
      .from(bucket ?? this.bucket)
      .upload(key, buffer, { contentType, upsert: true });
    if (error) throw error;
    return { key };
  }
}
