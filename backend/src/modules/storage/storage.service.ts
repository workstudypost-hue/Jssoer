import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
/**
 * خدمة تخزين موحّدة متوافقة مع S3 (تعمل أيضًا مع Cloudflare R2 وأي بديل متوافق
 * عبر ضبط STORAGE_ENDPOINT) - تُستخدم لكل رفع ملفات في المنصة (مرفقات الطلبات
 * الخاصة حاليًا؛ قابلة لإعادة الاستخدام لاحقًا لأي موديول آخر يحتاج رفع ملفات).
 * النمط: الـ Backend لا يستقبل الملف نفسه إطلاقًا - يُصدر رابطًا موقَّعًا صالحًا
 * لمدة قصيرة، يرفع العميل مباشرة عليه، ثم يُبلِّغ الـ Backend بالمفتاح النهائي فقط.
 */
@Injectable()
export class StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET_UPLOADS ?? 'raw-uploads';
    this.client = new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT,
      region: process.env.STORAGE_REGION ?? 'auto',
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY ?? '',
        secretAccessKey: process.env.STORAGE_SECRET_KEY ?? '',
      },
      forcePathStyle: true, // مطلوب لـ R2 وأغلب بدائل S3 المتوافقة
    });
  }

  /**
   * يُصدر رابط رفع موقَّعًا (PUT) صالحًا لمدة قصيرة (10 دقائق) - المفتاح يتضمن
   * مسارًا منظَّمًا (custom-requests/{ownerId}/{nanoid}-{filename}) لتفادي تصادم
   * الأسماء وتسهيل تتبّع/تدقيق أي ملف لاحقًا.
   */
  async generateUploadUrl(ownerId: string, filename: string, contentType: string, prefix = 'custom-requests') {
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${prefix}/${ownerId}/${nanoid(10)}-${safeFilename}`;

    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 600 });

    return { uploadUrl, key };
  }

  /** رابط تحميل مؤقت للملف بعد رفعه (لعرضه للمراجع/المدرب دون جعل الـ Bucket عامًا) */
  async generateDownloadUrl(key: string, bucket?: string) {
    const command = new GetObjectCommand({ Bucket: bucket ?? this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: 900 });
  }

  /**
   * رفع مباشر من الخادم نفسه (وليس رابطًا موقَّعًا للعميل) - يُستخدم فقط للملفات
   * التي يُنشئها الخادم داخليًا (مثل تقارير PDF/XLSX المولَّدة عبر Puppeteer/exceljs)
   * وليس لمرفقات يرفعها المستخدم مباشرة (تلك تبقى عبر generateUploadUrl حصريًا).
   */
  async uploadBuffer(key: string, buffer: Buffer, contentType: string, bucket?: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket ?? this.bucket, Key: key, Body: buffer, ContentType: contentType }),
    );
    return { key };
  }
}
