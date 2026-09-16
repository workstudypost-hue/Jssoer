'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { customRequestsApi, ApiError, type CustomRequest } from '../../lib/api';
import { FormField } from '../auth/FormField';
import { SubmitButton } from '../auth/SubmitButton';
import { FormError } from '../auth/FormError';

const STORAGE_KEY = 'ws_custom_requests';

function loadStoredRequests(): CustomRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomRequest[]) : [];
  } catch {
    return [];
  }
}

function saveStoredRequests(requests: CustomRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

export function CustomRequestsPanel() {
  const t = useTranslations('Dashboard.customRequests');

  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    setRequests(loadStoredRequests());
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError(t('fileRequired'));
      return;
    }

    setSubmitting(true);
    try {
      setProgressLabel(t('progressCreating'));
      const created = await customRequestsApi.create(title.trim(), notes.trim());

      setProgressLabel(t('progressUploading'));
      const { uploadUrl, key } = await customRequestsApi.requestUploadUrl(created.id, file.name, file.type);
      await customRequestsApi.uploadFile(uploadUrl, file);
      await customRequestsApi.addFile(created.id, key, file.type);

      setProgressLabel(t('progressSubmitting'));
      const submitted = await customRequestsApi.submit(created.id);

      const updated = [submitted, ...requests];
      setRequests(updated);
      saveStoredRequests(updated);
      setTitle('');
      setNotes('');
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('genericError'));
    } finally {
      setSubmitting(false);
      setProgressLabel(null);
    }
  }

  async function refreshStatus(id: string) {
    setRefreshingId(id);
    try {
      const fresh = await customRequestsApi.getDetails(id);
      const updated = requests.map((r) => (r.id === id ? fresh : r));
      setRequests(updated);
      saveStoredRequests(updated);
    } catch {
      // فشل تحديث حالة طلب واحد ليس خطأً حرجًا يستحق مقاطعة الصفحة - يبقى العرض بآخر حالة معروفة محليًا
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        <FormField
          id="request-title"
          label={t('titleLabel')}
          placeholder={t('titlePlaceholder')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="request-notes" className="text-sm font-medium text-navy-900">
            {t('notesLabel')}
          </label>
          <textarea
            id="request-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('notesPlaceholder')}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-slate-400 focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="request-file" className="text-sm font-medium text-navy-900">
            {t('fileLabel')}
          </label>
          <input
            id="request-file"
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none file:me-3 file:rounded-md file:border-0 file:bg-navy-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-navy-900"
          />
          <p className="text-sm text-slate-500">{t('fileHint')}</p>
        </div>
        <SubmitButton
          loading={submitting}
          loadingLabel={progressLabel ?? t('submitting')}
          className="sm:w-auto sm:self-start sm:px-8"
        >
          {t('submit')}
        </SubmitButton>
      </form>

      {requests.length === 0 ? (
        <p className="text-sm text-slate-500">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
            >
              <div>
                <p className="font-medium text-navy-950">{request.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{t(`status.${request.status}`)}</p>
              </div>
              <button
                onClick={() => refreshStatus(request.id)}
                disabled={refreshingId === request.id}
                className="shrink-0 text-sm font-semibold text-navy-900 hover:underline disabled:text-slate-400"
              >
                {refreshingId === request.id ? t('refreshing') : t('refresh')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
