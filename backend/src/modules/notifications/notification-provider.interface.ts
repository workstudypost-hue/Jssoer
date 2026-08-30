/**
 * واجهة موحّدة لأي مزود إرسال (SMS/WhatsApp/Email) - نفس نمط Adapter المستخدم
 * في بوابات الدفع. يسمح بإضافة مزود بديل مستقبلًا (مثل Unifonic لأرقام السعودية
 * محليًا) دون لمس أي كود آخر في OtpService.
 */
export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  rawResponse?: unknown;
}

export interface NotificationProvider {
  send(to: string, body: string): Promise<SendResult>;
}
