/**
 * T@S Backend API Client.
 * Connects the dashboard, playground, and billing directly to the Django Acoustic Action Engine.
 */

const getBaseUrl = (): string => {
  const raw = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
  const clean = raw.trim().replace(/\/+$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
};

const API_BASE = getBaseUrl();

export class TATSBackendAPI {
  public static getApiKey(): string | null {
    return localStorage.getItem('tats_api_key');
  }

  public static setApiKey(key: string): void {
    localStorage.setItem('tats_api_key', key);
  }

  public static clearApiKey(): void {
    localStorage.removeItem('tats_api_key');
  }

  public static getToken(): string | null {
    return localStorage.getItem('tats_dev_token');
  }

  public static setToken(token: string): void {
    localStorage.setItem('tats_dev_token', token);
  }

  public static clearToken(): void {
    localStorage.removeItem('tats_dev_token');
    localStorage.removeItem('tats_dev_profile');
    localStorage.removeItem('tats_api_key');
  }

  private static getHeaders(customAuth?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (customAuth) {
      headers['Authorization'] = customAuth.startsWith('Bearer ') ? customAuth : `Bearer ${customAuth}`;
    } else {
      const devToken = this.getToken();
      if (devToken) {
        headers['Authorization'] = `Bearer ${devToken}`;
      } else {
        const apiKey = this.getApiKey();
        if (apiKey) {
          headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
        }
      }
    }

    return headers;
  }

  // ==========================================
  // Health & System Status
  // ==========================================
  public static async checkHealth(): Promise<{ status: string; service: string } | null> {
    try {
      const res = await fetch(`${API_BASE}/health/`, { method: 'GET' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  public static async checkSystemStatus(): Promise<{
    is_initialized: boolean;
    admin_exists: boolean;
    developers_count: number;
    first_user_becomes_admin: boolean;
  } | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/system-status/`, { method: 'GET' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // ==========================================
  // Developer Auth & OTP Verification
  // ==========================================
  public static async register(name: string, email: string, phone: string, password?: string) {
    const res = await fetch(`${API_BASE}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password: password || undefined }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async loginRequestOTP(email: string) {
    const res = await fetch(`${API_BASE}/auth/login-request-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async verifyOTP(email: string, otp: string, purpose: string = 'REGISTER') {
    const res = await fetch(`${API_BASE}/auth/verify-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, purpose }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      this.setToken(data.token);
      if (data.developer) {
        this.setCurrentDeveloper(data.developer);
      }
    }
    return { ok: res.ok, status: res.status, data };
  }

  public static async resendOTP(email: string, purpose: string = 'REGISTER') {
    const res = await fetch(`${API_BASE}/auth/resend-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async recoverEmail(phone: string) {
    const res = await fetch(`${API_BASE}/auth/recover-email/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async forgotPassword(email: string) {
    const res = await fetch(`${API_BASE}/auth/forgot-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async resetPassword(email: string, otp: string, newPassword: string) {
    const res = await fetch(`${API_BASE}/auth/reset-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      this.setToken(data.token);
      if (data.developer) {
        this.setCurrentDeveloper(data.developer);
      }
    }
    return { ok: res.ok, status: res.status, data };
  }

  public static async login(identifier: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identifier, password }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      this.setToken(data.token);
      if (data.developer) {
        this.setCurrentDeveloper(data.developer);
      }
    }
    return { ok: res.ok, status: res.status, data };
  }

  public static async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout/`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } finally {
      this.clearToken();
    }
  }

  public static async getProfile() {
    const res = await fetch(`${API_BASE}/auth/me/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  }

  public static async updateProfile(payload: { name?: string; phone?: string }) {
    const res = await fetch(`${API_BASE}/auth/me/`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.developer) {
      this.setCurrentDeveloper(data.developer);
    }
    return { ok: res.ok, status: res.status, data };
  }

  public static async changePassword(payload: { old_password: string; new_password: string }) {
    const res = await fetch(`${API_BASE}/auth/change-password/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  // ==========================================
  // Application Management
  // ==========================================
  public static async getApplications() {
    const token = this.getToken();
    if (!token) return null;

    const res = await fetch(`${API_BASE}/apps/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  }

  public static async createApplication(appName: string, baseUrl: string, wakeWordPolicy: string = 'CUSTOM') {
    const res = await fetch(`${API_BASE}/apps/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ app_name: appName, base_url: baseUrl, wake_word_policy: wakeWordPolicy }),
    });
    return { ok: res.ok, data: await res.json() };
  }

  public static async updateApplication(appId: string, payload: { app_name?: string; base_url?: string; wake_word_policy?: string }) {
    const res = await fetch(`${API_BASE}/apps/${appId}/`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async regenerateAppKey(appId: string) {
    const res = await fetch(`${API_BASE}/apps/${appId}/regenerate-keys/`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return { ok: res.ok, data: await res.json() };
  }

  // ==========================================
  // Dynamic Real Notifications
  // ==========================================
  public static async getNotifications(params?: { limit?: number; type?: string; unread?: boolean; q?: string }) {
    const token = this.getToken();
    if (!token) return { unread_count: 0, notifications: [] };

    try {
      const url = new URL(`${API_BASE}/notifications/`);
      if (params?.limit) url.searchParams.append('limit', String(params.limit));
      if (params?.type && params.type !== 'ALL') url.searchParams.append('type', params.type);
      if (params?.unread) url.searchParams.append('unread', 'true');
      if (params?.q) url.searchParams.append('q', params.q);

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!res.ok) return { unread_count: 0, notifications: [] };
      return await res.json();
    } catch {
      return { unread_count: 0, notifications: [] };
    }
  }

  public static async markNotificationRead(id: string) {
    const res = await fetch(`${API_BASE}/notifications/${id}/read/`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return { ok: res.ok, data: await res.json() };
  }

  public static async markAllNotificationsRead() {
    const res = await fetch(`${API_BASE}/notifications/mark-all-read/`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return { ok: res.ok, data: await res.json() };
  }

  public static async deleteNotification(id: string) {
    const res = await fetch(`${API_BASE}/notifications/${id}/delete/`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return { ok: res.ok, data: await res.json() };
  }

  public static async clearAllNotifications() {
    const res = await fetch(`${API_BASE}/notifications/clear-all/`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return { ok: res.ok, data: await res.json() };
  }

  // ==========================================
  // Razorpay Payments & Subscriptions
  // ==========================================
  public static async createRazorpayOrder(planTier: string = 'GROWTH_STARTUP', appId?: string, units?: number) {
    const res = await fetch(`${API_BASE}/payments/create-order/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ plan_tier: planTier, app_id: appId, units: units || undefined }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async addBonusUnits(appId: string, units: number, reason: string = 'Developer Credit Topup') {
    const res = await fetch(`${API_BASE}/apps/${appId}/add-bonus/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ units, reason }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async verifyRazorpayPayment(payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    app_id?: string;
  }) {
    const res = await fetch(`${API_BASE}/payments/verify/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async upgradeAppPlan(appId: string, plan: string) {
    const res = await fetch(`${API_BASE}/apps/${appId}/upgrade/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ plan }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  // ==========================================
  // Tool Registry
  // ==========================================
  public static async getTools(apiKey?: string | null, appId?: string) {
    const validAppId = appId && appId !== 'undefined' && appId !== 'null' ? appId : undefined;
    const url = validAppId ? `${API_BASE}/tools/?app_id=${encodeURIComponent(validAppId)}` : `${API_BASE}/tools/`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(apiKey || undefined),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  public static async deleteTool(apiKey?: string | null, toolIdOrName?: string, appId?: string) {
    const validAppId = appId && appId !== 'undefined' && appId !== 'null' ? appId : undefined;
    try {
      const res = await fetch(`${API_BASE}/tools/`, {
        method: 'DELETE',
        headers: this.getHeaders(apiKey || undefined),
        body: JSON.stringify({ id: toolIdOrName, name: toolIdOrName, app_id: validAppId }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err: any) {
      return { ok: false, status: 500, data: { error: err.message } };
    }
  }

  public static async registerTool(apiKey?: string | null, toolData?: {
    name: string;
    description: string;
    endpoint: string;
    method?: string;
    parameters_schema?: Record<string, any>;
    app_id?: string;
  }) {
    const validAppId = toolData?.app_id && toolData.app_id !== 'undefined' && toolData.app_id !== 'null' ? toolData.app_id : undefined;
    try {
      const res = await fetch(`${API_BASE}/tools/register/`, {
        method: 'POST',
        headers: this.getHeaders(apiKey || undefined),
        body: JSON.stringify({
          ...toolData,
          app_id: validAppId,
        }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err: any) {
      return { ok: false, status: 500, data: { error: err.message } };
    }
  }

  // ==========================================
  // Agent Chat / Voice Execution
  // ==========================================
  public static async chat(apiKey?: string | null, payload?: {
    client_user_id: string;
    session_id: string;
    message: string;
    passphrase?: string;
    is_voice?: boolean;
    app_id?: string;
  }) {
    const validAppId = payload?.app_id && payload.app_id !== 'undefined' && payload.app_id !== 'null' ? payload.app_id : undefined;
    try {
      const res = await fetch(`${API_BASE}/chat/`, {
        method: 'POST',
        headers: this.getHeaders(apiKey || undefined),
        body: JSON.stringify({
          ...(payload || {}),
          app_id: validAppId,
          is_voice: payload?.is_voice ?? true,
        }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || 'Server returned invalid response' };
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err: any) {
      return { ok: false, status: 500, data: { error: err.message || 'Network error' } };
    }
  }

  // ==========================================
  // Session Telemetry
  // ==========================================
  public static async getSessionTelemetry(appId: string) {
    const res = await fetch(`${API_BASE}/apps/${appId}/sessions/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  }

  // ==========================================
  // End User Config
  // ==========================================
  public static async getUserConfig(clientUserId: string = 'default_user') {
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(clientUserId)}/config/`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  public static async saveUserConfig(clientUserId: string, config: {
    wake_word: string;
    passphrase?: string;
    voice_tier?: string;
  }) {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(clientUserId)}/config/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(config),
    });
    return { ok: res.ok, data: await res.json() };
  }

  // ==========================================
  // Dynamic Platform Config, Quotas & Live Cache
  // ==========================================
  private static readonly CONFIG_CACHE_KEY = 'tats_platform_config';

  public static getCachedPlatformConfig(): any {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(this.CONFIG_CACHE_KEY);
        if (cached) return JSON.parse(cached);
      }
    } catch {}
    return null;
  }

  public static setCachedPlatformConfig(cfg: any): void {
    try {
      if (typeof window !== 'undefined' && cfg) {
        localStorage.setItem(this.CONFIG_CACHE_KEY, JSON.stringify(cfg));
      }
    } catch {}
  }

  public static async getPlatformConfig() {
    // 1. Try public platform-config endpoint first (works for visitors, developers & admins)
    try {
      const pubRes = await fetch(`${API_BASE}/platform-config/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      if (pubRes.ok) {
        const data = await pubRes.json();
        this.setCachedPlatformConfig(data);
        return data;
      }
    } catch {}

    // 2. Try admin endpoint if authenticated
    try {
      const res = await fetch(`${API_BASE}/admin/config/`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        this.setCachedPlatformConfig(data);
        return data;
      }
    } catch {}

    // 3. Fallback to cached config if available
    return this.getCachedPlatformConfig();
  }

  public static async updatePlatformConfig(config: Record<string, any>) {
    const res = await fetch(`${API_BASE}/admin/config/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (res.ok) {
      const newConfig = data?.config || config;
      this.setCachedPlatformConfig(newConfig);
      // Dispatch real-time global event so open views instantly update without reload
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tats_config_updated', { detail: newConfig }));
      }
    }
    return { ok: res.ok, data };
  }

  public static async getGovernanceData() {
    const res = await fetch(`${API_BASE}/admin/governance/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  }

  public static async toggleDeveloperStatus(devId: string) {
    const res = await fetch(`${API_BASE}/admin/developers/${encodeURIComponent(devId)}/toggle-status/`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return { ok: res.ok, data: await res.json() };
  }

  // ==========================================
  // Platform Governance Security & Verification Check
  // ==========================================
  public static async getGovernanceSecurityConfig() {
    const res = await fetch(`${API_BASE}/admin/governance/security/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async updateGovernanceSecurityMethod(method: string) {
    const res = await fetch(`${API_BASE}/admin/governance/security/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ action: 'update_method', method }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async generateGovernanceSaveCodes() {
    const res = await fetch(`${API_BASE}/admin/governance/security/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ action: 'generate_save_codes' }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async updateAdminGovernancePassword(payload: { old_password: string; new_password: string }) {
    const res = await fetch(`${API_BASE}/admin/governance/security/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ action: 'update_password', ...payload }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async getAdminAuthMethod(email: string) {
    try {
      const res = await fetch(`${API_BASE}/admin/governance/unlock/?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  public static async sendAdminGovernanceOTP(email: string) {
    const res = await fetch(`${API_BASE}/admin/governance/send-otp/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  public static async unlockGovernancePortal(payload: {
    email: string;
    method: 'PASSWORD' | 'OTP' | 'SAVE_CODES' | 'SAVE_CODE';
    credential: string;
  }) {
    const res = await fetch(`${API_BASE}/admin/governance/unlock/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  // ==========================================
  // Developer Profile Local Storage
  // ==========================================
  public static getCurrentDeveloper(): {
    id: string;
    name: string;
    email: string;
    phone?: string;
    is_admin?: boolean;
    is_verified?: boolean;
  } | null {
    const item = localStorage.getItem('tats_dev_profile');
    if (!item) return null;
    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  }

  public static setCurrentDeveloper(profile: any): void {
    if (profile) {
      localStorage.setItem('tats_dev_profile', JSON.stringify(profile));
    } else {
      localStorage.removeItem('tats_dev_profile');
    }
  }
}
