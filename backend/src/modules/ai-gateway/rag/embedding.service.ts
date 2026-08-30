import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Anthropic لا تُقدِّم Embeddings API خاصة بها، وتُوصي رسميًا باستخدام Voyage AI
 * كشريك للـ Embeddings ضمن نفس النظام (راجع توثيق Anthropic). نستخدم نموذج
 * "voyage-3" (1024 بُعد) - عام الغرض ومتعدد اللغات (يدعم العربية جيدًا).
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey = process.env.VOYAGE_API_KEY ?? '';
  private readonly model = 'voyage-3';

  async embedTexts(texts: string[], inputType: 'document' | 'query'): Promise<number[][]> {
    if (!this.apiKey) {
      this.logger.warn('[DEV_ONLY] VOYAGE_API_KEY غير مضبوط - سيتم إرجاع متجهات صفرية وهمية');
      return texts.map(() => new Array(1024).fill(0));
    }

    const response = await axios.post(
      'https://api.voyageai.com/v1/embeddings',
      { input: texts, model: this.model, input_type: inputType },
      { headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' } },
    );

    return response.data.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((d: any) => d.embedding as number[]);
  }

  async embedOne(text: string, inputType: 'document' | 'query'): Promise<number[]> {
    const [embedding] = await this.embedTexts([text], inputType);
    return embedding;
  }
}
