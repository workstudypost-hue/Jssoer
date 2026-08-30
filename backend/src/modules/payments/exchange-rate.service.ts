import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(private prisma: PrismaService) {}

  /** السعر الحالي لعملة مقابل USD - يُستخدم للعرض وتجميد سعر خطط الدفع الجديدة */
  async getCurrentRate(targetCurrency: string): Promise<number> {
    if (targetCurrency === 'USD') return 1;

    const cached = await this.prisma.currentExchangeRate.findUnique({
      where: { targetCurrency },
    });
    if (!cached) {
      throw new Error(`لا يوجد سعر صرف مُحدَّث لعملة ${targetCurrency} - تحقق من Cron التحديث`);
    }
    return Number(cached.rate);
  }

  /**
   * Cron يومي/كل 6-24 ساعة: يسحب أسعار الصرف فعليًا من Open Exchange Rates API
   * ويحفظ نسخة تاريخية كاملة (exchange_rates) + يُحدِّث الكاش السريع (current_exchange_rates).
   * عند فشل الاستدعاء (مفتاح API غير صالح، انقطاع شبكة) نُبقي آخر سعر مُخزَّن كما هو
   * (Fail-Open آمن - سعر صرف قديم بيوم واحد أفضل من فشل كامل لخطط الدفع الجديدة).
   */
  async refreshRatesFromProvider(): Promise<void> {
    const SUPPORTED_CURRENCIES = ['SAR', 'AED', 'KWD', 'EUR', 'PHP', 'EGP', 'JOD'];
    const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;

    let liveRates: Record<string, number>;

    if (!appId) {
      this.logger.warn('[DEV_ONLY] OPEN_EXCHANGE_RATES_APP_ID غير مضبوط - استخدام أسعار تقريبية ثابتة');
      liveRates = { SAR: 3.75, AED: 3.6725, KWD: 0.307, EUR: 0.92, PHP: 58.5, EGP: 48.5, JOD: 0.709 };
    } else {
      try {
        const response = await axios.get('https://openexchangerates.org/api/latest.json', {
          params: { app_id: appId, base: 'USD', symbols: SUPPORTED_CURRENCIES.join(',') },
        });
        liveRates = response.data.rates;
      } catch (error) {
        this.logger.error(
          `فشل جلب أسعار الصرف من Open Exchange Rates - سيُحتفَظ بآخر سعر مُخزَّن: ${(error as Error).message}`,
        );
        return; // Fail-Open: لا نُحدِّث شيئًا، الكاش الحالي يبقى ساريًا كما هو
      }
    }

    for (const currency of SUPPORTED_CURRENCIES) {
      const rate = liveRates[currency];
      if (!rate) continue; // المزود لم يُرجع سعرًا لهذه العملة تحديدًا - تخطَّها بأمان دون كسر البقية

      await this.prisma.exchangeRate.create({
        data: { targetCurrency: currency, rate, source: 'openexchangerates' },
      });
      await this.prisma.currentExchangeRate.upsert({
        where: { targetCurrency: currency },
        update: { rate },
        create: { targetCurrency: currency, rate },
      });
    }

    this.logger.log(`تم تحديث أسعار الصرف لـ ${SUPPORTED_CURRENCIES.length} عملة`);
  }
}
