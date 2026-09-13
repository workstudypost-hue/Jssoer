import type { AppLocale } from '../i18n';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';

const ACCESS_TOKEN_KEY = 'ws_access_token';
const REFRESH_TOKEN_KEY = 'ws_refresh_token';

/** خطأ موحّد من الـ API - يحافظ على status الأصلي لتمييز الأخطاء (مثلًا 401 مقابل 409) عند الحاجة. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // نحاول قراءة الجسم كـ JSON دائمًا (حتى عند الفشل) لأن NestJS يُرجع تفاصيل
  // الخطأ (message/statusCode) بصيغة JSON منظّمة - لكن نبقى صامدين لو رجع نص فاضي (204 مثلًا).
  const rawBody = await res.text();
  const body = rawBody ? JSON.parse(rawBody) : null;

  if (!res.ok) {
    // class-validator يُرجع message كمصفوفة أحيانًا (عدة أخطاء تحقق دفعة وحدة)
    const message = Array.isArray(body?.message) ? body.message.join('، ') : body?.message;
    throw new ApiError(res.status, message ?? 'حدث خطأ غير متوقع، حاول مجددًا');
  }

  return body as T;
}

// ============ تخزين التوكنات ============

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ============ أنواع بيانات المصادقة (مطابقة لـ DTOs الخادم بالضبط) ============

export type UserRole = 'student' | 'instructor';

export interface RegisterPayload {
  email?: string;
  phone?: string;
  password: string;
  preferredLocale: AppLocale;
  requestedRole: UserRole;
}

export interface RegisterResponse {
  userId: string;
  message: string;
  identifier: string;
}

export interface VerifyOtpPayload {
  identifier: string;
  code: string;
  deviceFingerprint?: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
  deviceFingerprint?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  deviceSessionToken?: string;
}

// ============ نقاط نهاية المصادقة العامة (auth/public) ============

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<RegisterResponse>('/auth/public/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyOtp: (payload: VerifyOtpPayload) =>
    request<AuthSession>('/auth/public/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginPayload) =>
    request<AuthSession>('/auth/public/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  refresh: (refreshToken: string) =>
    request<AuthSession>('/auth/public/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  resendOtp: (identifier: string) =>
    request<{ message: string; identifier: string }>('/auth/public/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),

  logout: (refreshToken: string, sessionToken?: string) =>
    request<void>('/auth/public/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken, sessionToken }),
    }),

  /** روابط بدء تدفّق OAuth - Redirect مباشر للمتصفح، ليست طلب fetch */
  googleLoginUrl: () => `${API_BASE_URL}${API_PREFIX}/auth/public/google`,
  microsoftLoginUrl: () => `${API_BASE_URL}${API_PREFIX}/auth/public/microsoft`,
};
