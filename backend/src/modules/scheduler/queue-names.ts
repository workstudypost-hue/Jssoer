export const QUEUE_NAMES = {
  INSTALLMENTS: 'installments-processing',
  EXCHANGE_RATES: 'exchange-rates-refresh',
  INSTRUCTOR_PAYOUTS: 'instructor-payouts-generation',
  REPORT_EXPORTS: 'report-exports',
} as const;

export const JOB_NAMES = {
  PROCESS_DUE_INSTALLMENTS: 'process-due-installments',
  REFRESH_RATES: 'refresh-rates',
  GENERATE_PAYOUTS: 'generate-due-payouts',
  EXPORT_REPORT: 'export-report',
} as const;
