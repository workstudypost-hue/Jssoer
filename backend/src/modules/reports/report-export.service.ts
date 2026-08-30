import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Locale } from '@prisma/client';

/**
 * توليد ملف PDF فعلي عبر Puppeteer (HTML → PDF) أو XLSX عبر exceljs، ثم رفعه
 * للتخزين وتحديث GeneratedReport.fileUrl. يُستدعى من ReportExportProcessor
 * (BullMQ) وليس مباشرة من الـ Controller - التوليد قد يأخذ ثوانٍ لتقارير كبيرة،
 * لذلك request التصدير يُرجع فورًا 'generating' والملف يجهز بالخلفية.
 */
@Injectable()
export class ReportExportService {
  private readonly logger = new Logger(ReportExportService.name);
  private readonly EXPORT_EXPIRY_HOURS = 72;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async exportReport(generatedReportId: string) {
    const report = await this.prisma.generatedReport.findUniqueOrThrow({
      where: { id: generatedReportId },
      include: { requestedBy: true },
    });

    try {
      const format = (report.filters as any)?.exportFormat as 'pdf' | 'xlsx';
      const data = (report.filters as any)?.__cachedData ?? [];
      const locale = report.requestedBy.preferredLocale;

      const fileBuffer =
        format === 'xlsx'
          ? await this.generateXlsx(report.reportKey, data)
          : await this.generatePdf(report.reportKey, data, locale);

      const extension = format === 'xlsx' ? 'xlsx' : 'pdf';
      const contentType =
        format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf';

      const key = `reports/${report.requestedById}/${report.id}.${extension}`;
      const reportsBucket = process.env.STORAGE_BUCKET_REPORTS ?? 'generated-reports';
      await this.storage.uploadBuffer(key, fileBuffer, contentType, reportsBucket);
      const downloadUrl = await this.storage.generateDownloadUrl(key, reportsBucket);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.EXPORT_EXPIRY_HOURS);

      await this.prisma.generatedReport.update({
        where: { id: generatedReportId },
        data: { fileUrl: downloadUrl, status: 'ready', expiresAt },
      });

      this.logger.log(`اكتمل تصدير التقرير ${generatedReportId} (${extension})`);
    } catch (error) {
      this.logger.error(`فشل تصدير التقرير ${generatedReportId}: ${(error as Error).message}`);
      await this.prisma.generatedReport.update({
        where: { id: generatedReportId },
        data: { status: 'failed' },
      });
    }
  }

  /**
   * Puppeteer يُشغِّل Chromium headless لتحويل HTML بسيط (قالب مضمّن مباشرة -
   * وليس Handlebars منفصل، تفاديًا لتبعية إضافية غير ضرورية لحجم القوالب الحالي)
   * إلى PDF. يدعم RTL/LTR حسب لغة طالب التقرير.
   */
  private async generatePdf(reportKey: string, data: unknown[], locale: Locale): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');
    const isRtl = locale === 'ar';

    const rows = Array.isArray(data) ? data : [];
    const columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];

    const tableRows = rows
      .map(
        (row: any) =>
          `<tr>${columns.map((col) => `<td>${escapeHtml(String(row[col] ?? ''))}</td>`).join('')}</tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html dir="${isRtl ? 'rtl' : 'ltr'}" lang="${locale}">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 24px; color: #1f2937; }
          h1 { font-size: 18px; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: ${isRtl ? 'right' : 'left'}; }
          th { background: #f3f4f6; font-weight: 600; }
          .meta { color: #6b7280; font-size: 11px; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(reportKey)}</h1>
        <div class="meta">${new Date().toISOString()}</div>
        <table>
          <thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      // يعتمد على Chrome/Chromium مثبَّت على مستوى النظام (راجع .puppeteerrc.cjs -
      // تنزيل Puppeteer الخاص مُعطَّل عمدًا لأنه يفشل في بيئات الشبكة المقيَّدة).
      // إن لم يُضبَط المتغير، Puppeteer يحاول العثور على Chrome في المسارات المعتادة
      // تلقائيًا، وإلا يفشل بخطأ واضح يوجّه لتثبيته - راجع production-notes.md.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private async generateXlsx(reportKey: string, data: unknown[]): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(reportKey.slice(0, 30));

    const rows = Array.isArray(data) ? data : [];
    if (rows.length > 0) {
      const columns = Object.keys(rows[0] as object);
      sheet.columns = columns.map((c) => ({ header: c, key: c, width: 22 }));
      sheet.getRow(1).font = { bold: true };
      rows.forEach((row) => sheet.addRow(row));
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
