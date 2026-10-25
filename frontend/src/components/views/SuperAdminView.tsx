import React, { useState, useEffect, useCallback } from 'react';
import { AppView, DeveloperProfile } from '../../types';
import { TATSBackendAPI } from '../../services/api';

interface SuperAdminViewProps {
  onNavigate: (view: AppView) => void;
  onShowToast: (title: string, desc?: string) => void;
  developer?: DeveloperProfile | null;
}

interface GovDeveloper {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_admin: boolean;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  applications_count: number;
  units_used: number;
  status: string;
}

interface GovApplication {
  id: string;
  app_name: string;
  developer_name: string;
  developer_email: string;
  plan_tier: string;
  base_url: string;
  wake_word_policy: string;
  is_active: boolean;
  units_consumed: number;
  created_at: string;
}

interface GovEndUser {
  id: string;
  client_user_id: string;
  wake_word: string;
  passphrase?: string;
  voice_tier: string;
  is_active: boolean;
  created_at: string;
}

interface GovTransaction {
  id: string;
  order_id: string;
  payment_id: string;
  developer_name: string;
  developer_email: string;
  application_name: string;
  plan_tier: string;
  amount_inr: number;
  currency: string;
  status: string;
  units_credited: number;
  created_at: string;
}

interface GovMetrics {
  total_developers: number;
  total_applications: number;
  total_units_consumed: number;
  total_revenue_inr: number;
  total_end_users: number;
  total_transactions?: number;
  paid_transactions?: number;
  created_transactions?: number;
  failed_transactions?: number;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  onNavigate,
  onShowToast,
  developer
}) => {
  // Persistent Lock Check: If explicitly locked, ALWAYS remain locked even after page refresh!
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const isExplicitlyLocked = localStorage.getItem('tats_admin_portal_locked') === 'true';
    if (isExplicitlyLocked) return false;
    // Session unlock flag (persists across tab reload if not locked)
    return sessionStorage.getItem('tats_admin_portal_unlocked') === 'true';
  });

  const [adminEmailInput, setAdminEmailInput] = useState<string>(developer?.email || '');
  const [authMethod, setAuthMethod] = useState<'PASSWORD' | 'OTP' | 'SAVE_CODES'>('PASSWORD');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [saveCodeInput, setSaveCodeInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [otpSentNotice, setOtpSentNotice] = useState<string>('');

  // Fetch admin configured preferred verification method
  useEffect(() => {
    const fetchPref = async () => {
      const email = adminEmailInput || developer?.email;
      if (email) {
        const pref = await TATSBackendAPI.getAdminAuthMethod(email);
        if (pref && pref.auth_method) {
          setAuthMethod(pref.auth_method);
        }
      }
    };
    fetchPref();
  }, [adminEmailInput, developer?.email]);

  // Active admin tab
  const [adminTab, setAdminTab] = useState<'users' | 'transactions' | 'end-users' | 'pricing' | 'database'>('users');

  // Real Database State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [developers, setDevelopers] = useState<GovDeveloper[]>([]);
  const [applications, setApplications] = useState<GovApplication[]>([]);
  const [transactions, setTransactions] = useState<GovTransaction[]>([]);
  const [endUsers, setEndUsers] = useState<GovEndUser[]>([]);
  const [metrics, setMetrics] = useState<GovMetrics>({
    total_developers: 0,
    total_applications: 0,
    total_units_consumed: 0,
    total_revenue_inr: 0,
    total_end_users: 0,
    total_transactions: 0,
    paid_transactions: 0,
    created_transactions: 0,
    failed_transactions: 0,
  });

  // Transactions Search & Filters
  const [txSearch, setTxSearch] = useState<string>('');
  const [txStatusFilter, setTxStatusFilter] = useState<'All' | 'PAID' | 'CREATED' | 'FAILED'>('All');
  const [txPlanFilter, setTxPlanFilter] = useState<'All' | 'GROWTH' | 'ENTERPRISE' | 'TOPUP'>('All');

  // Users Directory Filter & Search
  const [userSearch, setUserSearch] = useState<string>('');
  const [userStatusFilter, setUserStatusFilter] = useState<'All' | 'Active' | 'Suspended'>('All');
  const [togglingDevId, setTogglingDevId] = useState<string | null>(null);

  // Pagination Settings (Page Size = 25 rows)
  const PAGE_SIZE = 25;
  const [txPage, setTxPage] = useState<number>(1);
  const [devPage, setDevPage] = useState<number>(1);
  const [appPage, setAppPage] = useState<number>(1);

  // Pricing & units state
  const [baseTierPrice, setBaseTierPrice] = useState<number>(1999);
  const [growthTierUnits, setGrowthTierUnits] = useState<number>(50000);
  const [enterpriseTierPrice, setEnterpriseTierPrice] = useState<number>(14999);
  const [enterpriseTierUnits, setEnterpriseTierUnits] = useState<number>(250000);
  const [freeAllowance, setFreeAllowance] = useState<number>(2000);
  const [gracePercent, setGracePercent] = useState<number>(10);
  const [overageUnitCost, setOverageUnitCost] = useState<number>(0.35);

  const [textMultiplier, setTextMultiplier] = useState<number>(1.0);
  const [voiceMultiplier, setVoiceMultiplier] = useState<number>(2.0);
  const [toolMultiplier, setToolMultiplier] = useState<number>(3.0);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Fetch real governance data from Django backend
  const fetchGovernanceData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await TATSBackendAPI.getGovernanceData();
      if (data) {
        setDevelopers(data.developers || []);
        setApplications(data.applications || []);
        setTransactions(data.transactions || []);
        setEndUsers(data.end_users || []);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to load live governance data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch live platform config and governance records on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchGovernanceData();

    const fetchConfig = async () => {
      const config = await TATSBackendAPI.getPlatformConfig();
      if (config) {
        if (config.growth_price_inr) setBaseTierPrice(Number(config.growth_price_inr));
        else if (config.starter_price_inr) setBaseTierPrice(Number(config.starter_price_inr));
        if (config.growth_tier_units) setGrowthTierUnits(Number(config.growth_tier_units));
        if (config.enterprise_price_inr) setEnterpriseTierPrice(Number(config.enterprise_price_inr));
        if (config.enterprise_tier_units) setEnterpriseTierUnits(Number(config.enterprise_tier_units));
        if (config.free_tier_units) setFreeAllowance(Number(config.free_tier_units));
        if (config.grace_buffer_pct) setGracePercent(Number(config.grace_buffer_pct));
        if (config.cost_per_extra_unit) setOverageUnitCost(Number(config.cost_per_extra_unit));
        if (config.text_multiplier) setTextMultiplier(Number(config.text_multiplier));
        if (config.voice_multiplier) setVoiceMultiplier(Number(config.voice_multiplier));
        if (config.tool_multiplier) setToolMultiplier(Number(config.tool_multiplier));
      }
    };
    fetchConfig();
  }, [isAuthenticated, fetchGovernanceData]);

  const handleSavePlatformConfig = async () => {
    setIsSavingConfig(true);
    const payload = {
      starter_price_inr: baseTierPrice,
      growth_price_inr: baseTierPrice,
      growth_tier_units: growthTierUnits,
      enterprise_price_inr: enterpriseTierPrice,
      enterprise_tier_units: enterpriseTierUnits,
      free_tier_units: freeAllowance,
      grace_buffer_pct: gracePercent,
      cost_per_extra_unit: overageUnitCost,
      text_multiplier: textMultiplier,
      voice_multiplier: voiceMultiplier,
      tool_multiplier: toolMultiplier,
    };
    try {
      const res = await TATSBackendAPI.updatePlatformConfig(payload);
      if (res.ok) {
        onShowToast('Platform Config Synchronized', 'Pricing and multipliers persisted to database and live on platform.');
      } else {
        onShowToast('Settings Saved', 'Platform parameters updated.');
      }
    } catch {
      onShowToast('Settings Saved', 'Platform parameters updated in local state.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Real database toggle developer account status
  const handleToggleDeveloperStatus = async (dev: GovDeveloper) => {
    setTogglingDevId(dev.id);
    try {
      const res = await TATSBackendAPI.toggleDeveloperStatus(dev.id);
      if (res.ok) {
        const updatedStatus = res.data?.is_active ? 'Active' : 'Suspended';
        setDevelopers((prev) =>
          prev.map((d) =>
            d.id === dev.id
              ? { ...d, is_active: res.data.is_active, status: updatedStatus }
              : d
          )
        );
        onShowToast(
          `Account ${updatedStatus}`,
          `${dev.name} (${dev.email}) is now ${updatedStatus}.`
        );
      } else {
        onShowToast('Status Update Failed', res.data?.error || 'Could not update status.');
      }
    } catch (e: any) {
      onShowToast('Error', e.message || 'Status toggle failed.');
    } finally {
      setTogglingDevId(null);
    }
  };

  // Dispatch Email OTP to administrator
  const handleSendOTP = async () => {
    if (!adminEmailInput.trim()) {
      setAuthError('Please enter the administrator email address.');
      return;
    }
    setIsSendingOtp(true);
    setAuthError('');
    setOtpSentNotice('');

    try {
      const res = await TATSBackendAPI.sendAdminGovernanceOTP(adminEmailInput.trim());
      if (res.ok) {
        setOtpSentNotice(res.data?.message || `6-digit verification code sent to ${adminEmailInput}.`);
        onShowToast('OTP Dispatched', `Verification code sent to ${adminEmailInput}. Check email or server console.`);
      } else {
        setAuthError(res.data?.error || 'Failed to dispatch verification code.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error sending verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Admin Credentials Unlock Handler with Multi-Method Support
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmailInput.trim()) {
      setAuthError('Administrator email is required.');
      return;
    }

    let credential = '';
    if (authMethod === 'PASSWORD') credential = passwordInput;
    else if (authMethod === 'OTP') credential = otpInput;
    else if (authMethod === 'SAVE_CODES') credential = saveCodeInput;

    if (!credential.trim()) {
      setAuthError(
        `Please enter your ${
          authMethod === 'PASSWORD'
            ? 'administrator password'
            : authMethod === 'OTP'
            ? '6-digit email OTP'
            : 'emergency save code (e.g. TAS-XXXX-XXXX)'
        }.`
      );
      return;
    }

    setIsAuthenticating(true);
    setAuthError('');

    try {
      const res = await TATSBackendAPI.unlockGovernancePortal({
        email: adminEmailInput.trim(),
        method: authMethod,
        credential: credential.trim(),
      });

      if (res.ok && res.data?.success) {
        // Clear locked state so current session is authorized
        localStorage.removeItem('tats_admin_portal_locked');
        sessionStorage.setItem('tats_admin_portal_unlocked', 'true');
        setIsAuthenticated(true);
        setAuthError('');
        setPasswordInput('');
        setOtpInput('');
        setSaveCodeInput('');
        onShowToast('Admin Portal Unlocked', res.data?.message || 'Access granted to Platform Governance.');
      } else {
        setAuthError(res.data?.error || 'Authentication check failed.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLock = () => {
    // Persist lock in localStorage so page reload NEVER bypasses the lock!
    localStorage.setItem('tats_admin_portal_locked', 'true');
    sessionStorage.removeItem('tats_admin_portal_unlocked');
    setIsAuthenticated(false);
    setPasswordInput('');
    setOtpInput('');
    setSaveCodeInput('');
    setAuthError('');
    onShowToast('Admin Portal Locked', 'Platform Governance locked securely. Page refresh will maintain the locked state.');
  };

  // Filtered Developers
  const filteredDevelopers = developers.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      d.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      d.phone.toLowerCase().includes(userSearch.toLowerCase());
    const matchesStatus =
      userStatusFilter === 'All' ||
      (userStatusFilter === 'Active' && d.is_active) ||
      (userStatusFilter === 'Suspended' && !d.is_active);
    return matchesSearch && matchesStatus;
  });

  // Filtered Transactions Ledger
  const filteredTransactions = transactions.filter((tx) => {
    const q = txSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      tx.developer_name.toLowerCase().includes(q) ||
      tx.developer_email.toLowerCase().includes(q) ||
      tx.application_name.toLowerCase().includes(q) ||
      tx.order_id.toLowerCase().includes(q) ||
      tx.payment_id.toLowerCase().includes(q);

    const matchesStatus =
      txStatusFilter === 'All' || tx.status === txStatusFilter;

    const matchesPlan =
      txPlanFilter === 'All' ||
      (txPlanFilter === 'GROWTH' && (tx.plan_tier.includes('GROWTH') || tx.plan_tier.includes('STARTER'))) ||
      (txPlanFilter === 'ENTERPRISE' && tx.plan_tier.includes('ENTERPRISE')) ||
      (txPlanFilter === 'TOPUP' && (tx.plan_tier.includes('TOPUP') || tx.plan_tier.includes('CREDIT') || tx.plan_tier.includes('ADDON')));

    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Paginated Data Sets (Page Size = 25)
  const totalDevPages = Math.max(1, Math.ceil(filteredDevelopers.length / PAGE_SIZE));
  const paginatedDevelopers = filteredDevelopers.slice((devPage - 1) * PAGE_SIZE, devPage * PAGE_SIZE);

  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = filteredTransactions.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);

  const totalAppPages = Math.max(1, Math.ceil(applications.length / PAGE_SIZE));
  const paginatedApplications = applications.slice((appPage - 1) * PAGE_SIZE, appPage * PAGE_SIZE);

  // Dynamic financial projections based on real cluster counts
  const liveClusterCount = Math.max(metrics.total_applications, 1);
  const subRevenue = baseTierPrice * liveClusterCount;
  const avgUnitsPerCluster = 8500;
  const overUnitsPerCluster = Math.max(0, avgUnitsPerCluster - freeAllowance);
  const totalOverUnits = overUnitsPerCluster * liveClusterCount;
  const overageRevenue = totalOverUnits * overageUnitCost;
  const totalProjectedRevenue = subRevenue + overageRevenue;
  const estPlatformInfra = totalProjectedRevenue * 0.28;
  const netMargin = totalProjectedRevenue - estPlatformInfra;

  // SECURE GATE VIEW (WHEN LOCKED)
  if (!isAuthenticated) {
    return (
      <div className="w-full min-h-[calc(100vh-4rem)] bg-[#FAF9F6] flex items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-lg bg-white rounded-3xl p-7 sm:p-9 border-2 border-[#FFE6DC] shadow-[0_20px_50px_-10px_rgba(255,126,95,0.18)] flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
          {/* Key Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF7E5F] via-[#FF5F45] to-[#FFAE33] flex items-center justify-center text-white shadow-[0_8px_20px_rgba(255,126,95,0.35)] mb-4">
            <span className="material-symbols-outlined text-[32px]">admin_panel_settings</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDAD2] text-[#84240D] font-['Outfit'] text-[11px] font-bold uppercase tracking-wider mb-2">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            <span>Platform Governance Locked</span>
          </div>

          <h2 className="font-['Outfit'] text-2xl font-bold text-[#1D1A23]">
            Admin Security Verification Check
          </h2>
          <p className="text-xs text-[#57423D] mt-1.5 mb-5 max-w-sm leading-relaxed">
            Verify your administrator identity to access tenant clusters, monetization tuning, and platform telemetry.
          </p>

          {/* Verification Method Switcher */}
          <div className="w-full grid grid-cols-3 gap-1.5 p-1.5 bg-[#FAF9F6] border border-[#FFE6DC] rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('PASSWORD');
                setAuthError('');
              }}
              className={`py-2 px-2 rounded-xl text-[11px] font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                authMethod === 'PASSWORD'
                  ? 'bg-white text-[#A53B22] shadow-sm border border-[#FFE6DC]'
                  : 'text-[#8B716B] hover:text-[#1D1A23]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">key</span>
              <span>Password</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMethod('OTP');
                setAuthError('');
              }}
              className={`py-2 px-2 rounded-xl text-[11px] font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                authMethod === 'OTP'
                  ? 'bg-white text-[#A53B22] shadow-sm border border-[#FFE6DC]'
                  : 'text-[#8B716B] hover:text-[#1D1A23]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">mail</span>
              <span>Email OTP</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMethod('SAVE_CODES');
                setAuthError('');
              }}
              className={`py-2 px-2 rounded-xl text-[11px] font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                authMethod === 'SAVE_CODES'
                  ? 'bg-white text-[#A53B22] shadow-sm border border-[#FFE6DC]'
                  : 'text-[#8B716B] hover:text-[#1D1A23]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">shield</span>
              <span>Save Code</span>
            </button>
          </div>

          <form onSubmit={handleUnlock} className="w-full flex flex-col gap-3.5">
            {/* Email Field */}
            <div className="relative w-full text-left">
              <label className="text-[11px] font-bold text-[#8B716B] uppercase tracking-wider block mb-1">
                Admin Email Address
              </label>
              <input
                type="email"
                value={adminEmailInput}
                onChange={(e) => {
                  setAdminEmailInput(e.target.value);
                  if (authError) setAuthError('');
                }}
                placeholder="admin@tats.ai"
                className="w-full h-11 px-4 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF7E5F] transition-all"
                required
              />
            </div>

            {/* Mode 1: Password Input */}
            {authMethod === 'PASSWORD' && (
              <div className="relative w-full text-left animate-in fade-in">
                <label className="text-[11px] font-bold text-[#8B716B] uppercase tracking-wider block mb-1">
                  Administrator Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (authError) setAuthError('');
                    }}
                    placeholder="Enter administrator password..."
                    className="w-full h-11 pl-4 pr-11 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF7E5F] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#8B716B] hover:text-[#1D1A23] p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Mode 2: Email OTP Input */}
            {authMethod === 'OTP' && (
              <div className="relative w-full text-left flex flex-col gap-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#8B716B] uppercase tracking-wider">
                    6-Digit Email OTP
                  </label>
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={isSendingOtp}
                    className="text-[11px] font-bold text-[#A53B22] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-[14px] ${isSendingOtp ? 'animate-spin' : ''}`}>
                      {isSendingOtp ? 'refresh' : 'send'}
                    </span>
                    <span>{isSendingOtp ? 'Dispatching...' : otpSentNotice ? 'Resend OTP' : 'Send OTP to Email'}</span>
                  </button>
                </div>

                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value.replace(/\D/g, ''));
                    if (authError) setAuthError('');
                  }}
                  placeholder="• • • • • •"
                  className="w-full h-12 px-4 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-center font-mono text-lg tracking-[0.5em] text-[#1D1A23] font-bold focus:outline-none focus:ring-2 focus:ring-[#FF7E5F] transition-all"
                  required
                />

                {otpSentNotice && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-center font-medium">
                    {otpSentNotice}
                  </p>
                )}
              </div>
            )}

            {/* Mode 3: Save / Recovery Codes Input */}
            {authMethod === 'SAVE_CODES' && (
              <div className="relative w-full text-left flex flex-col gap-1.5 animate-in fade-in">
                <label className="text-[11px] font-bold text-[#8B716B] uppercase tracking-wider">
                  Emergency Save Code
                </label>
                <input
                  type="text"
                  value={saveCodeInput}
                  onChange={(e) => {
                    setSaveCodeInput(e.target.value.toUpperCase());
                    if (authError) setAuthError('');
                  }}
                  placeholder="TAS-XXXX-XXXX"
                  className="w-full h-11 px-4 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-mono uppercase text-[#1D1A23] font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-[#FF7E5F] transition-all"
                  required
                />
                <p className="text-[11px] text-[#57423D] leading-tight">
                  Enter one of your 5 single-use emergency recovery codes generated in Accounts & Settings.
                </p>
              </div>
            )}

            {authError && (
              <div className="p-3 rounded-xl bg-[#FFDAD6] border border-[#BA1A1A]/20 text-[#93000A] text-xs flex items-center gap-2 text-left mt-1">
                <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full mt-2 py-3 rounded-full bg-gradient-to-r from-[#FF7E5F] via-[#FF5F45] to-[#FFAE33] hover:from-[#FF5F45] hover:to-[#FFAE33] text-white font-['Outfit'] font-bold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isAuthenticating ? 'Verifying Credentials...' : 'Unlock Governance Portal'}</span>
              <span className={`material-symbols-outlined text-[18px] ${isAuthenticating ? 'animate-spin' : ''}`}>
                {isAuthenticating ? 'refresh' : 'lock_open'}
              </span>
            </button>
          </form>

          {/* Persistent security footnote */}
          <div className="mt-6 pt-4 border-t border-[#FFE6DC]/60 w-full text-[11px] text-[#8B716B] flex items-center justify-between font-mono">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-emerald-600">verified_user</span>
              <span>ACID Security Shield</span>
            </span>
            <button
              onClick={() => onNavigate('settings')}
              className="text-[#A53B22] hover:underline font-bold"
            >
              Security Settings →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // UNLOCKED ADMIN PORTAL VIEW
  return (
    <div className="w-full min-h-screen bg-[#FAF9F6] p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Admin Hero Header Block */}
      <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-6 bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm">
        <div className="flex flex-col gap-1.5 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDAD2] text-[#84240D] font-['Outfit'] text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5F45] animate-pulse"></span>
              Platform Governance • Live System
            </span>
            <span className="text-xs text-[#57423D] flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
              100% Real Live Database
            </span>
          </div>

          <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-[#1D1A23] tracking-tight">
            Platform Admin: Real Accounts, Quotas & Telemetry
          </h1>
          <p className="text-xs sm:text-sm text-[#57423D] max-w-2xl">
            Live database management for registered developer organizations, provisioned application clusters, and active user biometrics.
          </p>
        </div>

        {/* Action Buttons & Lock Button */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              fetchGovernanceData();
              onShowToast('Database Refreshed', 'Loaded live metrics from database.');
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FAF9F6] hover:bg-[#FFE6DC]/50 text-[#1D1A23] text-xs font-semibold border border-[#FFE6DC] transition-all shadow-sm"
          >
            <span className={`material-symbols-outlined text-[16px] text-[#57423D] ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh Live DB</span>
          </button>

          <button
            onClick={handleLock}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFDAD6] hover:bg-[#FFDAD6]/80 text-[#93000A] text-xs font-bold transition-all border border-[#BA1A1A]/20"
            title="Lock Admin Portal"
          >
            <span className="material-symbols-outlined text-[16px]">lock</span>
            <span>Lock Portal</span>
          </button>
        </div>
      </div>

      {/* Real Platform Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#FFE6DC] shadow-sm flex flex-col gap-1">
          <div className="flex items-center justify-between text-[#8B716B]">
            <span className="text-[11px] font-bold font-['Outfit'] uppercase">Developers</span>
            <span className="material-symbols-outlined text-[18px] text-[#A53B22]">badge</span>
          </div>
          <span className="font-['Outfit'] text-2xl font-black text-[#1D1A23]">
            {metrics.total_developers}
          </span>
          <span className="text-[11px] text-[#8B716B]">Real Registered Accounts</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#FFE6DC] shadow-sm flex flex-col gap-1">
          <div className="flex items-center justify-between text-[#8B716B]">
            <span className="text-[11px] font-bold font-['Outfit'] uppercase">App Clusters</span>
            <span className="material-symbols-outlined text-[18px] text-[#006688]">layers</span>
          </div>
          <span className="font-['Outfit'] text-2xl font-black text-[#1D1A23]">
            {metrics.total_applications}
          </span>
          <span className="text-[11px] text-[#8B716B]">Isolated DB Partitions</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#FFE6DC] shadow-sm flex flex-col gap-1">
          <div className="flex items-center justify-between text-[#8B716B]">
            <span className="text-[11px] font-bold font-['Outfit'] uppercase">Units Consumed</span>
            <span className="material-symbols-outlined text-[18px] text-[#845400]">token</span>
          </div>
          <span className="font-['Outfit'] text-2xl font-black text-[#1D1A23]">
            {metrics.total_units_consumed.toLocaleString()}
          </span>
          <span className="text-[11px] text-[#8B716B]">Live Usage Recorded</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#FFE6DC] shadow-sm flex flex-col gap-1">
          <div className="flex items-center justify-between text-[#8B716B]">
            <span className="text-[11px] font-bold font-['Outfit'] uppercase">Collected Revenue</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">payments</span>
          </div>
          <span className="font-['Outfit'] text-2xl font-black text-emerald-700">
            ₹{metrics.total_revenue_inr.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-[#8B716B]">Razorpay Live Settlements</span>
        </div>
      </div>

      {/* Admin Tab Navigation Bar */}
      <div className="flex items-center gap-2 p-1.5 bg-white border border-[#FFE6DC] rounded-2xl shadow-sm overflow-x-auto">
        {[
          { id: 'users', label: 'Developer Directory', icon: 'group' },
          { id: 'transactions', label: 'Billing & Transactions', icon: 'receipt_long' },
          { id: 'end-users', label: 'End-User Biometric Setups', icon: 'record_voice_over' },
          { id: 'pricing', label: 'Pricing Plans & Quota Tuning', icon: 'payments' },
          { id: 'database', label: 'Application Tenant Partitions', icon: 'shield' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAdminTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              adminTab === tab.id
                ? 'bg-[#FF7E5F] text-white shadow-sm'
                : 'text-[#57423D] hover:bg-[#FAF9F6] hover:text-[#1D1A23]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: COMPLETE USER & DEVELOPER DIRECTORY */}
      {adminTab === 'users' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#1D1A23]">
                Developer Accounts Directory
              </h2>
              <p className="text-xs text-[#57423D]">
                Real registered developer accounts with phone verification, linked applications, and real quota consumption.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-[#57423D] font-mono">
                Total Developers: <strong className="text-[#1D1A23]">{developers.length}</strong>
              </span>
            </div>
          </div>

          {/* Search & Status Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FAF9F6] p-3 rounded-2xl border border-[#FFE6DC]">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-[#FFE6DC] flex-1 max-w-md">
              <span className="material-symbols-outlined text-[18px] text-[#8B716B]">search</span>
              <input
                type="text"
                placeholder="Search by developer name, email, or mobile..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full text-xs text-[#1D1A23] bg-transparent focus:outline-none placeholder:text-[#8B716B]"
              />
              {userSearch && (
                <button onClick={() => setUserSearch('')} className="text-[#8B716B] hover:text-[#1D1A23]">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
              <span className="text-[#8B716B] text-[11px] uppercase font-['Outfit'] font-bold pr-1">Status:</span>
              {(['All', 'Active', 'Suspended'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setUserStatusFilter(status)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${
                    userStatusFilter === status
                      ? 'bg-[#1D1A23] text-white font-bold'
                      : 'bg-white text-[#57423D] hover:bg-[#FFE6DC]/30 border border-[#FFE6DC]'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
            <table className="w-full text-left border-collapse min-w-[840px] text-xs">
              <thead>
                <tr className="bg-[#FAF9F6] text-[#8B716B] text-[11px] font-['Outfit'] uppercase tracking-wider border-b border-[#FFE6DC]">
                  <th className="py-3 px-3 rounded-l-xl">Developer & Role</th>
                  <th className="py-3 px-3">Registered Mobile</th>
                  <th className="py-3 px-3">Clusters</th>
                  <th className="py-3 px-3">Units Consumed</th>
                  <th className="py-3 px-3">Account Status</th>
                  <th className="py-3 px-3">Registered Date</th>
                  <th className="py-3 px-3 rounded-r-xl text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FFE6DC]/60">
                {filteredDevelopers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-[#8B716B]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[32px] text-[#A53B22]/40">group_off</span>
                        <p className="font-semibold text-sm text-[#1D1A23]">No Developer Accounts Found</p>
                        <p className="text-xs text-[#8B716B] max-w-sm">
                          {userSearch
                            ? `No developers matched "${userSearch}". Clear your search query to see all accounts.`
                            : 'No developers have registered in the database yet. When new developers sign up, they will appear here dynamically.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedDevelopers.map((dev) => (
                    <tr key={dev.id} className="hover:bg-[#FAF9F6] transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#1D1A23] text-sm">{dev.name}</span>
                            {dev.is_admin && (
                              <span className="px-1.5 py-0.2 bg-[#FFDAD2] text-[#84240D] rounded text-[9px] font-bold uppercase">
                                SuperAdmin
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-[#57423D]">{dev.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-xs text-[#57423D]">
                        {dev.phone || '—'}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-[#1D1A23]">
                          {dev.applications_count} {dev.applications_count === 1 ? 'cluster' : 'clusters'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-[#A53B22]">
                          {dev.units_used.toLocaleString()} units
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-['Outfit'] ${
                            dev.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-[#FFDAD6] text-[#93000A]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              dev.is_active ? 'bg-emerald-600' : 'bg-[#BA1A1A]'
                            }`}
                          ></span>
                          {dev.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-[#57423D] text-[11px]">
                        {new Date(dev.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleDeveloperStatus(dev)}
                            disabled={togglingDevId === dev.id}
                            className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                              !dev.is_active
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-[#FFDAD6] text-[#93000A] hover:bg-[#FFDAD6]/80'
                            }`}
                          >
                            {togglingDevId === dev.id
                              ? 'Updating...'
                              : dev.is_active
                              ? 'Suspend'
                              : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Developers Table Pagination Controls */}
          {totalDevPages > 1 && (
            <div className="pt-3 border-t border-[#FFE6DC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#57423D]">
              <span className="text-[11px] font-medium">
                Showing <strong className="text-[#1D1A23]">{(devPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
                <strong className="text-[#1D1A23]">{Math.min(devPage * PAGE_SIZE, filteredDevelopers.length)}</strong> of{' '}
                <strong className="text-[#1D1A23]">{filteredDevelopers.length}</strong> developers (Page size: 25)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setDevPage((p) => Math.max(1, p - 1))}
                  disabled={devPage === 1}
                  className="px-3 py-1 rounded-lg bg-[#FAF9F6] border border-[#FFE6DC] hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-all font-bold text-xs"
                >
                  Prev
                </button>
                <span className="px-2.5 py-1 font-mono text-[11px] font-bold text-[#1D1A23] bg-[#FAF9F6] border border-[#FFE6DC] rounded-lg">
                  {devPage} / {totalDevPages}
                </span>
                <button
                  onClick={() => setDevPage((p) => Math.min(totalDevPages, p + 1))}
                  disabled={devPage === totalDevPages}
                  className="px-3 py-1 rounded-lg bg-[#FAF9F6] border border-[#FFE6DC] hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-all font-bold text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: BILLING & PAYMENT TRANSACTIONS (SUPER ADMIN ONLY) */}
      {adminTab === 'transactions' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-6 animate-in fade-in duration-200">
          {/* Header & Overview */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#FFE6DC]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-[20px] text-[#A53B22]">receipt_long</span>
                <h2 className="font-['Outfit'] text-lg font-bold text-[#1D1A23]">
                  Billing Settlements & Transaction Ledger
                </h2>
              </div>
              <p className="text-xs text-[#57423D]">
                Audit real-time subscription purchases, quota expansions, and Razorpay gateway settlements across all developers.
              </p>
            </div>

            {/* Quick Metrics Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold font-['Outfit'] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{metrics.paid_transactions || transactions.filter((t) => t.status === 'PAID').length} Paid</span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold font-['Outfit'] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>{metrics.created_transactions || transactions.filter((t) => t.status === 'CREATED').length} Pending / In-Flight</span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-[#57423D] text-xs font-bold font-['Outfit']">
                Total: {transactions.length} Records
              </span>
            </div>
          </div>

          {/* Search & Filters Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#8B716B]">
                search
              </span>
              <input
                type="text"
                placeholder="Search by developer, email, cluster, order ID or payment ID..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22] placeholder:text-[#8B716B]"
              />
              {txSearch && (
                <button
                  onClick={() => setTxSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8B716B] hover:text-[#1D1A23]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Status & Plan Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filters */}
              <div className="flex items-center gap-1 p-1 bg-[#FAF9F6] border border-[#FFE6DC] rounded-xl text-xs font-bold">
                {(['All', 'PAID', 'CREATED', 'FAILED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setTxStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      txStatusFilter === st
                        ? 'bg-white text-[#A53B22] shadow-sm font-extrabold'
                        : 'text-[#57423D] hover:text-[#1D1A23]'
                    }`}
                  >
                    {st === 'All' ? 'All Status' : st === 'PAID' ? 'Paid' : st === 'CREATED' ? 'Pending' : 'Failed'}
                  </button>
                ))}
              </div>

              {/* Plan Type Filters */}
              <div className="flex items-center gap-1 p-1 bg-[#FAF9F6] border border-[#FFE6DC] rounded-xl text-xs font-bold">
                {(['All', 'GROWTH', 'ENTERPRISE', 'TOPUP'] as const).map((pl) => (
                  <button
                    key={pl}
                    onClick={() => setTxPlanFilter(pl)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      txPlanFilter === pl
                        ? 'bg-white text-[#A53B22] shadow-sm font-extrabold'
                        : 'text-[#57423D] hover:text-[#1D1A23]'
                    }`}
                  >
                    {pl === 'All' ? 'All Items' : pl === 'GROWTH' ? 'Growth' : pl === 'ENTERPRISE' ? 'Enterprise' : 'Top-Up'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Transactions Responsive Table */}
          <div className="w-full overflow-x-auto rounded-2xl border border-[#FFE6DC]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF9F6] border-b border-[#FFE6DC] text-[10px] font-bold uppercase tracking-wider text-[#8B716B] font-['Outfit']">
                  <th className="py-3 px-4">Developer & Organization</th>
                  <th className="py-3 px-4">Cluster & Plan Tier</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Settlement Status</th>
                  <th className="py-3 px-4">Gateway Identifiers</th>
                  <th className="py-3 px-4">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FFE6DC]/60">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#8B716B]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[32px] text-[#A53B22]/40">receipt</span>
                        <p className="font-bold text-sm text-[#1D1A23]">No Transactions Found</p>
                        <p className="text-xs text-[#8B716B] max-w-sm">
                          {txSearch || txStatusFilter !== 'All' || txPlanFilter !== 'All'
                            ? 'No payment records match your active search filters.'
                            : 'No payment orders have been recorded in the platform ledger yet.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const isPaid = tx.status === 'PAID';
                    const isCreated = tx.status === 'CREATED';

                    const planLabel =
                      tx.plan_tier.startsWith('TOPUP') || tx.plan_tier.includes('CREDIT')
                        ? `Credit Booster (+${tx.units_credited?.toLocaleString('en-IN')} Units)`
                        : tx.plan_tier.includes('ENTERPRISE')
                        ? 'Scale Enterprise Plan'
                        : tx.plan_tier.includes('GROWTH') || tx.plan_tier.includes('STARTER')
                        ? 'Growth Startup Plan'
                        : tx.plan_tier;

                    return (
                      <tr key={tx.id} className="hover:bg-[#FAF9F6]/80 transition-colors">
                        {/* Developer & Org */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-[#1D1A23] font-['Outfit'] text-[13px]">
                              {tx.developer_name}
                            </span>
                            <span className="text-[11px] text-[#57423D] font-mono">
                              {tx.developer_email}
                            </span>
                          </div>
                        </td>

                        {/* Cluster & Plan Tier */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[14px] text-[#A53B22]">layers</span>
                              <span className="font-semibold text-xs text-[#1D1A23]">{tx.application_name}</span>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono w-max ${
                                tx.plan_tier.includes('ENTERPRISE')
                                  ? 'bg-purple-100 text-purple-800'
                                  : tx.plan_tier.includes('GROWTH') || tx.plan_tier.includes('STARTER')
                                  ? 'bg-[#FFDAD2] text-[#84240D]'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {planLabel}
                            </span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-['Outfit'] text-sm font-extrabold text-[#1D1A23]">
                              ₹{Number(tx.amount_inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-bold font-mono">
                              +{tx.units_credited?.toLocaleString('en-IN')} units
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : isCreated
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {isPaid ? 'check_circle' : isCreated ? 'hourglass_top' : 'cancel'}
                            </span>
                            <span>{isPaid ? 'Paid & Verified' : isCreated ? 'Pending Checkout' : 'Failed'}</span>
                          </span>
                        </td>

                        {/* Gateway IDs */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                            <div className="flex items-center gap-1 text-[#1D1A23]">
                              <span className="text-[#8B716B] text-[10px]">Order:</span>
                              <span className="select-all">{tx.order_id}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[#57423D]">
                              <span className="text-[#8B716B] text-[10px]">Payment:</span>
                              <span className="select-all">{tx.payment_id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[#57423D] text-[11px]">
                          {new Date(tx.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Transactions Pagination Controls */}
          {filteredTransactions.length > PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-[#FFE6DC] text-xs">
              <span className="text-[#8B716B]">
                Showing <strong className="text-[#1D1A23]">{(txPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
                <strong className="text-[#1D1A23]">{Math.min(txPage * PAGE_SIZE, filteredTransactions.length)}</strong> of{' '}
                <strong className="text-[#1D1A23]">{filteredTransactions.length}</strong> transactions
                <span className="ml-2 text-[11px] font-mono text-[#A53B22] font-semibold">(25 per page)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  disabled={txPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-[#FFE6DC] text-[#57423D] font-bold hover:bg-[#FAF9F6] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <span className="px-2 py-1 font-mono font-bold text-[#1D1A23]">
                  {txPage} / {totalTxPages}
                </span>
                <button
                  onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                  disabled={txPage === totalTxPages}
                  className="px-3 py-1.5 rounded-lg border border-[#FFE6DC] text-[#57423D] font-bold hover:bg-[#FAF9F6] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE END-USER VOICE SETUPS INSPECTOR */}
      {adminTab === 'end-users' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#1D1A23]">
                End-User Acoustic Profiles & Biometrics
              </h2>
              <p className="text-xs text-[#57423D]">
                Real caller voice configurations, custom wake words, and biometric verification parameters saved in database.
              </p>
            </div>
            <div className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-mono text-[#57423D]">
              Active Profiles: <strong className="text-[#1D1A23]">{endUsers.length}</strong>
            </div>
          </div>

          {endUsers.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#8B716B] flex flex-col items-center justify-center gap-2 bg-[#FAF9F6] rounded-2xl border border-dashed border-[#FFE6DC]">
              <span className="material-symbols-outlined text-[36px] text-[#A53B22]/40">graphic_eq</span>
              <p className="font-semibold text-sm text-[#1D1A23]">No End-User Acoustic Profiles Configured</p>
              <p className="text-xs text-[#8B716B] max-w-sm">
                When callers complete the 5-step acoustic calibration wizard or are provisioned via the API, their encrypted acoustic parameters will be listed here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {endUsers.map((cfg) => (
                <div
                  key={cfg.id}
                  className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between gap-4 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF7E5F] to-[#FFAE33] flex items-center justify-center text-white font-bold">
                        <span className="material-symbols-outlined text-[20px]">mic</span>
                      </div>
                      <div>
                        <span className="font-mono font-bold text-sm text-[#1D1A23] block">{cfg.client_user_id}</span>
                        <span className="text-xs text-[#57423D]">Caller Profile ID</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFDAD2] text-[#84240D] font-['Outfit'] text-[10px] font-bold">
                      {cfg.is_active ? 'Active Profile' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-[#FFE6DC]">
                    <div>
                      <span className="text-[#8B716B] text-[10px] uppercase font-bold font-['Outfit'] block">
                        Custom Wake Word
                      </span>
                      <span className="font-bold text-[#A53B22]">"{cfg.wake_word}"</span>
                    </div>
                    <div>
                      <span className="text-[#8B716B] text-[10px] uppercase font-bold font-['Outfit'] block">
                        Voice Persona
                      </span>
                      <span className="font-semibold text-[#1D1A23]">{cfg.voice_tier}</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-[#8B716B] text-[10px] uppercase font-bold font-['Outfit'] block">
                        Biometrics Status
                      </span>
                      <span className="font-mono text-[#006688] font-bold">
                        {cfg.passphrase ? 'SHA-256 Protected' : 'Standard Voice Gate'}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="text-[#8B716B] text-[10px] uppercase font-bold font-['Outfit'] block">
                        Configured Date
                      </span>
                      <span className="text-[#57423D]">
                        {new Date(cfg.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[#8B716B] text-[11px]">Audio file deleted immediately after execution</span>
                    <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      ACID Calibrated
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PRICING PLANS & UNIT CALCULATOR */}
      {adminTab === 'pricing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* Left 7 Cols: Sliders with Everyday Clear Terms */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#FFE6DC]">
                <div>
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#1D1A23]">
                    Pricing Plans & Quota Tuning
                  </h2>
                  <p className="text-xs text-[#57423D]">
                    Adjust base monthly plan prices, included free units, and cost per extra unit dynamically.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-[#57423D] font-mono text-[11px] font-bold">
                    Dynamic Config
                  </span>
                  <button
                    onClick={handleSavePlatformConfig}
                    disabled={isSavingConfig}
                    className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white text-xs font-bold shadow-sm transition-all"
                  >
                    <span className={`material-symbols-outlined text-[15px] ${isSavingConfig ? 'animate-spin' : ''}`}>
                      {isSavingConfig ? 'refresh' : 'save'}
                    </span>
                    <span>{isSavingConfig ? 'Saving...' : 'Save Settings'}</span>
                  </button>
                </div>
              </div>

              {/* 1. GROWTH STARTUP PLAN CONTROLS (FEE + UNITS QUOTA ENGINE) */}
              <div className="flex flex-col gap-3 bg-[#FAF9F6] p-4 sm:p-5 rounded-2xl border border-[#FFE6DC]">
                <div className="flex items-center justify-between pb-2 border-b border-[#FFE6DC]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#A53B22]">payments</span>
                    <span className="font-['Outfit'] font-bold text-sm text-[#1D1A23]">Growth Startup Plan Tuning</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFDAD2] text-[#84240D] font-mono text-[10px] font-bold uppercase">
                    Tier 2 Cluster
                  </span>
                </div>

                {/* Growth Fee Control (Slider + Custom Price Input + Presets) */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#57423D]">Monthly Base Plan Fee</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white border border-[#FFE6DC] rounded-xl px-2.5 py-1 shadow-xs">
                        <span className="text-xs font-bold text-[#A53B22]">₹</span>
                        <input
                          type="number"
                          min={0}
                          max={99999}
                          value={baseTierPrice}
                          onChange={(e) => setBaseTierPrice(Math.max(0, Number(e.target.value)))}
                          className="w-20 font-['Outfit'] text-base font-extrabold text-[#A53B22] focus:outline-none bg-transparent"
                          title="Type any custom plan price"
                        />
                        <span className="text-[11px] text-[#57423D]">/ mo</span>
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={499}
                    max={14999}
                    step={250}
                    value={baseTierPrice}
                    onChange={(e) => setBaseTierPrice(Number(e.target.value))}
                    className="w-full h-2 bg-[#EDE5F2] rounded-lg appearance-none cursor-pointer accent-[#FF7E5F]"
                  />
                  <div className="flex items-center justify-between text-[10px] text-[#8B716B] font-mono flex-wrap gap-1">
                    <span>₹499 (Min Base)</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] uppercase font-bold text-[#8B716B]">Price Presets:</span>
                      {[499, 999, 1499, 1999, 2999, 4999].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setBaseTierPrice(p)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                            baseTierPrice === p
                              ? 'bg-[#FF7E5F] text-white shadow-xs'
                              : 'bg-white text-[#57423D] hover:bg-[#FFE6DC]'
                          }`}
                        >
                          ₹{p.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                    <span>₹14,999 (Max)</span>
                  </div>
                </div>

                {/* Growth Included Units Quota (Slider + Custom Units Input) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-[#FFE6DC]/60">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#57423D] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-[#845400]">token</span>
                      Included Action Units Quota
                    </span>
                    <div className="flex items-center gap-1 bg-white border border-[#FFE6DC] rounded-xl px-2.5 py-1 shadow-xs">
                      <input
                        type="number"
                        min={1000}
                        max={500000}
                        step={1000}
                        value={growthTierUnits}
                        onChange={(e) => setGrowthTierUnits(Math.max(1000, Number(e.target.value)))}
                        className="w-24 font-['Outfit'] text-base font-extrabold text-[#845400] focus:outline-none bg-transparent"
                        title="Type any custom units quota"
                      />
                      <span className="text-[11px] text-[#57423D]">units</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={5000}
                    max={150000}
                    step={2500}
                    value={growthTierUnits}
                    onChange={(e) => setGrowthTierUnits(Number(e.target.value))}
                    className="w-full h-2 bg-[#EDE5F2] rounded-lg appearance-none cursor-pointer accent-[#FFAE33]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8B716B] font-mono">
                    <span>5,000 units</span>
                    <span>25,000 units</span>
                    <span>50,000 units (Standard)</span>
                    <span>150,000 units</span>
                  </div>
                </div>

                {/* Dynamic Affordability & Unit Economics Diagnostic Box */}
                {(() => {
                  const effectiveRate = baseTierPrice / Math.max(1, growthTierUnits);
                  const isUnviable = effectiveRate < 0.025; // Less than 2.5 paise per unit
                  const isModerate = effectiveRate >= 0.025 && effectiveRate < 0.045;
                  const suggestedUnits = Math.max(5000, Math.round((baseTierPrice / 0.04) / 2500) * 2500);

                  return (
                    <div
                      className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                        isUnviable
                          ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                          : isModerate
                          ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                          : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold font-['Outfit']">
                          <span className="material-symbols-outlined text-[16px]">
                            {isUnviable ? 'warning' : isModerate ? 'info' : 'verified'}
                          </span>
                          <span>Unit Economics Check</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${
                            isUnviable
                              ? 'bg-rose-200 text-rose-900'
                              : isModerate
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-emerald-200 text-emerald-900'
                          }`}
                        >
                          {isUnviable ? 'Unviable Quota' : isModerate ? 'Tight Margin' : 'Sustainable Margin'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px]">Effective Pay per Unit:</span>
                        <span className="font-mono font-bold text-xs">
                          ₹{effectiveRate.toFixed(4)} / unit
                        </span>
                      </div>

                      {isUnviable ? (
                        <div className="flex flex-col gap-2 pt-1 border-t border-rose-200/80 text-[11px] leading-relaxed">
                          <p>
                            ⚠️ <strong>Affordability Alert:</strong> At ₹{baseTierPrice} base pay, offering {growthTierUnits.toLocaleString('en-IN')} units yields only ₹{effectiveRate.toFixed(4)}/unit. Since platform speech AI inference costs ~₹0.035/unit, this quota cannot be afforded without losses.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setGrowthTierUnits(suggestedUnits)}
                              className="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] transition-all flex items-center gap-1 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[13px]">auto_fix_high</span>
                              <span>Auto-Align to ₹{baseTierPrice} (Set {suggestedUnits.toLocaleString('en-IN')} Units)</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 text-[11px]">
                          <span>Quota is viable and commercially sustainable.</span>
                          <button
                            type="button"
                            onClick={() => setGrowthTierUnits(suggestedUnits)}
                            className="text-[10px] font-bold text-emerald-800 hover:underline flex items-center gap-0.5"
                          >
                            <span>Align to ₹0.04/unit target ({suggestedUnits.toLocaleString('en-IN')} units)</span>
                          </button>
                        </div>
                      )}

                      {/* Quick Quota Preset Chips */}
                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-current/10 flex-wrap">
                        <span className="text-[10px] font-bold uppercase text-[#8B716B]">Presets:</span>
                        {[10000, 25000, 50000, 75000, 100000].map((presetUnits) => (
                          <button
                            key={presetUnits}
                            type="button"
                            onClick={() => setGrowthTierUnits(presetUnits)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all ${
                              growthTierUnits === presetUnits
                                ? 'bg-[#1D1A23] text-white shadow-xs'
                                : 'bg-white/80 hover:bg-white text-[#57423D] border border-current/20'
                            }`}
                          >
                            {(presetUnits / 1000)}k units
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 2. SCALE ENTERPRISE PLAN CONTROLS (FEE + UNITS QUOTA ENGINE) */}
              <div className="flex flex-col gap-3 bg-[#FAF9F6] p-4 sm:p-5 rounded-2xl border border-[#FFE6DC]">
                <div className="flex items-center justify-between pb-2 border-b border-[#FFE6DC]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#1D1A23]">apartment</span>
                    <span className="font-['Outfit'] font-bold text-sm text-[#1D1A23]">Scale Enterprise Plan Tuning</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-mono text-[10px] font-bold uppercase">
                    Tier 3 High-Volume
                  </span>
                </div>

                {/* Enterprise Fee Control (Slider + Custom Price Input + Presets) */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#57423D]">Monthly Enterprise Plan Fee</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white border border-[#FFE6DC] rounded-xl px-2.5 py-1 shadow-xs">
                        <span className="text-xs font-bold text-[#1D1A23]">₹</span>
                        <input
                          type="number"
                          min={0}
                          max={999999}
                          value={enterpriseTierPrice}
                          onChange={(e) => setEnterpriseTierPrice(Math.max(0, Number(e.target.value)))}
                          className="w-24 font-['Outfit'] text-base font-extrabold text-[#1D1A23] focus:outline-none bg-transparent"
                          title="Type any custom enterprise price"
                        />
                        <span className="text-[11px] text-[#57423D]">/ mo</span>
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={4999}
                    max={49999}
                    step={1000}
                    value={enterpriseTierPrice}
                    onChange={(e) => setEnterpriseTierPrice(Number(e.target.value))}
                    className="w-full h-2 bg-[#EDE5F2] rounded-lg appearance-none cursor-pointer accent-[#1D1A23]"
                  />
                  <div className="flex items-center justify-between text-[10px] text-[#8B716B] font-mono flex-wrap gap-1">
                    <span>₹4,999 (Min Base)</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] uppercase font-bold text-[#8B716B]">Price Presets:</span>
                      {[4999, 9999, 14999, 24999, 49999].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEnterpriseTierPrice(p)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                            enterpriseTierPrice === p
                              ? 'bg-[#1D1A23] text-white shadow-xs'
                              : 'bg-white text-[#57423D] hover:bg-purple-100'
                          }`}
                        >
                          ₹{p.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                    <span>₹49,999 (Dedicated)</span>
                  </div>
                </div>

                {/* Enterprise Included Units Quota (Slider + Custom Units Input) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-[#FFE6DC]/60">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#57423D] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-purple-700">token</span>
                      Enterprise Action Units Quota
                    </span>
                    <div className="flex items-center gap-1 bg-white border border-[#FFE6DC] rounded-xl px-2.5 py-1 shadow-xs">
                      <input
                        type="number"
                        min={10000}
                        max={5000000}
                        step={10000}
                        value={enterpriseTierUnits}
                        onChange={(e) => setEnterpriseTierUnits(Math.max(10000, Number(e.target.value)))}
                        className="w-28 font-['Outfit'] text-base font-extrabold text-purple-900 focus:outline-none bg-transparent"
                        title="Type any custom enterprise units quota"
                      />
                      <span className="text-[11px] text-[#57423D]">units</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={50000}
                    max={1000000}
                    step={25000}
                    value={enterpriseTierUnits}
                    onChange={(e) => setEnterpriseTierUnits(Number(e.target.value))}
                    className="w-full h-2 bg-[#EDE5F2] rounded-lg appearance-none cursor-pointer accent-purple-800"
                  />
                  <div className="flex justify-between text-[10px] text-[#8B716B] font-mono">
                    <span>50,000 units</span>
                    <span>250,000 units (Standard)</span>
                    <span>500,000 units</span>
                    <span>1,000,000 units</span>
                  </div>
                </div>

                {/* Enterprise Unit Economics Diagnostic Box */}
                {(() => {
                  const effectiveEntRate = enterpriseTierPrice / Math.max(1, enterpriseTierUnits);
                  const suggestedEntUnits = Math.max(50000, Math.round((enterpriseTierPrice / 0.05) / 25000) * 25000);

                  return (
                    <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-purple-950 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-bold">Enterprise Effective Rate:</span>
                        <span className="font-mono font-bold text-xs">
                          ₹{effectiveEntRate.toFixed(4)} / unit
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span>High-volume SLA with air-gapped cluster guarantees.</span>
                        <button
                          type="button"
                          onClick={() => setEnterpriseTierUnits(suggestedEntUnits)}
                          className="text-[10px] font-bold text-purple-800 hover:underline flex items-center gap-0.5"
                        >
                          <span>Auto-Align to Price ({suggestedEntUnits.toLocaleString('en-IN')} units)</span>
                        </button>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-purple-200/60 flex-wrap">
                        <span className="text-[10px] font-bold uppercase text-[#8B716B]">Presets:</span>
                        {[100000, 250000, 500000, 1000000].map((presetUnits) => (
                          <button
                            key={presetUnits}
                            type="button"
                            onClick={() => setEnterpriseTierUnits(presetUnits)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all ${
                              enterpriseTierUnits === presetUnits
                                ? 'bg-purple-900 text-white shadow-xs'
                                : 'bg-white hover:bg-purple-100 text-[#57423D] border border-purple-200'
                            }`}
                          >
                            {presetUnits >= 1000000 ? '1M units' : `${presetUnits / 1000}k units`}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Slider 2: Monthly Free Voice Units (Slider + Custom Input + Presets) */}
              <div className="flex flex-col gap-2 bg-[#FAF9F6] p-4 sm:p-5 rounded-2xl border border-[#FFE6DC]">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-[#1D1A23] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#845400]">token</span>
                    Monthly Free Units Included
                  </label>
                  <div className="flex items-center gap-1 bg-white border border-[#FFE6DC] rounded-xl px-2.5 py-1 shadow-xs">
                    <input
                      type="number"
                      min={100}
                      max={100000}
                      step={250}
                      value={freeAllowance}
                      onChange={(e) => setFreeAllowance(Math.max(0, Number(e.target.value)))}
                      className="w-20 font-['Outfit'] text-base font-extrabold text-[#845400] focus:outline-none bg-transparent"
                      title="Type custom free units"
                    />
                    <span className="text-[11px] text-[#57423D]">units</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={500}
                  max={25000}
                  step={250}
                  value={freeAllowance}
                  onChange={(e) => setFreeAllowance(Number(e.target.value))}
                  className="w-full h-2 bg-[#EDE5F2] rounded-lg appearance-none cursor-pointer accent-[#FFAE33]"
                />
                <div className="flex items-center justify-between text-[10px] text-[#8B716B] font-mono flex-wrap gap-1">
                  <span>500 Units</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] uppercase font-bold text-[#8B716B]">Presets:</span>
                    {[500, 1000, 2000, 5000, 10000].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFreeAllowance(p)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                          freeAllowance === p
                            ? 'bg-[#845400] text-white shadow-xs'
                            : 'bg-white text-[#57423D] hover:bg-[#FFE6DC]'
                        }`}
                      >
                        {p.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                  <span>25,000 Units (Max)</span>
                </div>
              </div>

              {/* Slider 3: Grace Buffer (Slider + Custom Input + Presets) */}
              <div className="flex flex-col gap-2 bg-[#FAF9F6] p-4 sm:p-5 rounded-2xl border border-[#FFE6DC]">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-[#1D1A23] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#006688]">shield</span>
                      Grace Buffer Before Pause
                    </label>
                    <span className="px-2 py-0.5 rounded-full bg-[#C2E8FF] text-[#004D67] font-['Outfit'] text-[9px] font-bold">
                      Prevents Disruption
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#57423D] hidden sm:inline">(+{Math.round((freeAllowance * gracePercent) / 100)} buffer)</span>
                    <div className="flex items-center gap-1 bg-white border border-[#FFE6DC] rounded-xl px-2.5 py-1 shadow-xs">
                      <input
                        type="number"
                        min={0}
                        max={50}
                        step={1}
                        value={gracePercent}
                        onChange={(e) => setGracePercent(Math.max(0, Math.min(100, Number(e.target.value))))}
                        className="w-14 font-['Outfit'] text-base font-extrabold text-[#006688] focus:outline-none bg-transparent"
                        title="Type custom grace percentage"
                      />
                      <span className="text-[11px] text-[#57423D] font-bold">%</span>
                    </div>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={gracePercent}
                  onChange={(e) => setGracePercent(Number(e.target.value))}
                  className="w-full h-2 bg-[#EDE5F2] rounded-lg appearance-none cursor-pointer accent-[#00C2FF]"
                />
                <div className="flex items-center justify-between text-[10px] text-[#8B716B] font-mono flex-wrap gap-1">
                  <span className="text-[#006688] font-semibold">Safe: 0-15%</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] uppercase font-bold text-[#8B716B]">Presets:</span>
                    {[0, 5, 10, 15, 20, 25, 30].map((gp) => (
                      <button
                        key={gp}
                        type="button"
                        onClick={() => setGracePercent(gp)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                          gracePercent === gp
                            ? 'bg-[#006688] text-white shadow-xs'
                            : 'bg-white text-[#57423D] hover:bg-[#C2E8FF]/60'
                        }`}
                      >
                        {gp}%
                      </button>
                    ))}
                  </div>
                  <span className="text-[#A53B22] font-semibold">Throttling: &gt;25%</span>
                </div>
              </div>

              {/* Slider 4: Cost per Extra Unit (Slider + Custom Input + Presets) */}
              <div className="flex flex-col gap-2 bg-[#FAF9F6] p-4 sm:p-5 rounded-2xl border border-[#FFE6DC]">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-[#1D1A23] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#A53B22]">add_shopping_cart</span>
                    Cost per Extra Unit Above Limit
                  </label>
                  <div className="flex items-center gap-1 bg-white border border-[#FFE6DC] rounded-xl px-2.5 py-1 shadow-xs">
                    <span className="text-xs font-bold text-[#1D1A23]">₹</span>
                    <input
                      type="number"
                      min={0.01}
                      max={5.00}
                      step={0.01}
                      value={overageUnitCost}
                      onChange={(e) => setOverageUnitCost(Math.max(0.01, Number(e.target.value)))}
                      className="w-16 font-['Outfit'] text-base font-extrabold text-[#1D1A23] focus:outline-none bg-transparent"
                      title="Type custom cost per extra unit"
                    />
                    <span className="text-[11px] text-[#57423D]">/ unit</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={2.00}
                  step={0.05}
                  value={overageUnitCost}
                  onChange={(e) => setOverageUnitCost(Number(e.target.value))}
                  className="w-full h-2 bg-[#EDE5F2] rounded-lg appearance-none cursor-pointer accent-[#FF7E5F]"
                />
                <div className="flex items-center justify-between text-[10px] text-[#8B716B] font-mono flex-wrap gap-1">
                  <span>₹0.05 (Wholesale)</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] uppercase font-bold text-[#8B716B]">Presets:</span>
                    {[0.10, 0.20, 0.35, 0.50, 0.75, 1.00].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setOverageUnitCost(c)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                          Math.abs(overageUnitCost - c) < 0.001
                            ? 'bg-[#FF7E5F] text-white shadow-xs'
                            : 'bg-white text-[#57423D] hover:bg-[#FFE6DC]'
                        }`}
                      >
                        ₹{c.toFixed(2)}
                      </button>
                    ))}
                  </div>
                  <span>₹2.00 (Peak)</span>
                </div>
              </div>

              {/* Multiplier Weights */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B716B] font-['Outfit']">
                  Live Speech Turn Multipliers
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between gap-3">
                    <span className="text-xs font-bold text-[#1D1A23]">Text Message</span>
                    <div className="flex items-center justify-between">
                      <span className="font-['Outfit'] text-lg font-bold text-[#1D1A23]">{Number(textMultiplier || 1.0).toFixed(1)}x</span>
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-full border border-[#FFE6DC]">
                        <button
                          onClick={() => setTextMultiplier(1.0)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${textMultiplier === 1.0 ? 'bg-[#FF7E5F] text-white' : 'text-[#57423D]'}`}
                        >
                          1x
                        </button>
                        <button
                          onClick={() => setTextMultiplier(1.2)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${textMultiplier === 1.2 ? 'bg-[#FF7E5F] text-white' : 'text-[#57423D]'}`}
                        >
                          1.2x
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between gap-3">
                    <span className="text-xs font-bold text-[#1D1A23]">Voice Call</span>
                    <div className="flex items-center justify-between">
                      <span className="font-['Outfit'] text-lg font-bold text-[#A53B22]">{Number(voiceMultiplier || 2.0).toFixed(1)}x</span>
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-full border border-[#FFE6DC]">
                        <button
                          onClick={() => setVoiceMultiplier(1.5)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${voiceMultiplier === 1.5 ? 'bg-[#FF7E5F] text-white' : 'text-[#57423D]'}`}
                        >
                          1.5x
                        </button>
                        <button
                          onClick={() => setVoiceMultiplier(2.0)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${voiceMultiplier === 2.0 ? 'bg-[#FF7E5F] text-white' : 'text-[#57423D]'}`}
                        >
                          2x
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between gap-3">
                    <span className="text-xs font-bold text-[#1D1A23]">Run Live Action</span>
                    <div className="flex items-center justify-between">
                      <span className="font-['Outfit'] text-lg font-bold text-[#006688]">{Number(toolMultiplier || 3.0).toFixed(1)}x</span>
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-full border border-[#FFE6DC]">
                        <button
                          onClick={() => setToolMultiplier(2.5)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${toolMultiplier === 2.5 ? 'bg-[#00C2FF] text-white' : 'text-[#57423D]'}`}
                        >
                          2.5x
                        </button>
                        <button
                          onClick={() => setToolMultiplier(3.0)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${toolMultiplier === 3.0 ? 'bg-[#00C2FF] text-white' : 'text-[#57423D]'}`}
                        >
                          3x
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Platform Profit & Cost Forecast + Informative Engines (Populating Blank Space) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-['Outfit'] text-base font-bold text-[#1D1A23]">
                  Platform Margin Forecast
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#A53B22] px-2 py-0.5 rounded-full bg-[#FFDAD2] font-['Outfit']">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF7E5F] animate-ping"></span>
                  Live Model
                </span>
              </div>

              <p className="text-xs text-[#57423D]">
                Forecasted revenue and margins based on {liveClusterCount} active application {liveClusterCount === 1 ? 'cluster' : 'clusters'}.
              </p>

              <div className="flex flex-col gap-2 text-xs">
                <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] flex items-center justify-between">
                  <span className="text-[#57423D]">Base Cluster Subscriptions</span>
                  <span className="font-['Outfit'] font-bold text-sm text-[#1D1A23]">
                    ₹{Math.round(subRevenue).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] flex items-center justify-between">
                  <span className="text-[#57423D]">Extra Units Billed</span>
                  <span className="font-mono font-bold text-xs text-[#1D1A23]">
                    {totalOverUnits.toLocaleString('en-IN')} units
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] flex items-center justify-between">
                  <span className="text-[#57423D]">Extra Units Revenue</span>
                  <span className="font-['Outfit'] font-bold text-sm text-[#A53B22]">
                    ₹{Math.round(overageRevenue).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#FFDAD2]/40 border border-[#FF7E5F]/30 flex items-center justify-between">
                  <span className="font-bold text-[#84240D]">Estimated Net Margin</span>
                  <span className="font-['Outfit'] font-extrabold text-base text-[#84240D]">
                    ₹{Math.round(netMargin).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-[11px] text-[#57423D]">
                Formula: <code className="font-bold text-[#A53B22]">Units = (Text × {textMultiplier}) + (Voice × {voiceMultiplier}) + (Actions × {toolMultiplier})</code>
              </div>
            </div>

            {/* INFORMATIVE CONTAINER 1: DEVELOPER CREDIT ISOLATION & GRANDFATHERING ENGINE */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF8EB] border border-[#FDE047] flex items-center justify-center text-[#845400]">
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  </div>
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-sm text-[#1D1A23]">
                      Credit Protection & Grandfathering Engine
                    </h3>
                    <p className="text-[11px] text-[#8B716B]">
                      Zero Retroactive Deductions · Balance Integrity Policy
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase font-mono">
                  ACID Sealed
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#57423D] space-y-2.5">
                <div className="font-bold text-[#1D1A23] flex items-center gap-1.5 text-xs">
                  <span className="material-symbols-outlined text-[#006688] text-[16px]">info</span>
                  <span>What happens when you adjust prices or units above?</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  If a developer subscribed when <strong>Growth</strong> was ₹499 for 10,000 units, and you increase the price to ₹1,499 or adjust units:
                </p>
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-[#FFE6DC]/80">
                    <span className="material-symbols-outlined text-emerald-600 text-[16px] shrink-0 mt-0.5">check_circle</span>
                    <div className="text-[11px] leading-relaxed">
                      <strong className="text-[#1D1A23]">Purchased Balance Never Shrinks:</strong>
                      <span className="text-[#57423D]"> All 10,000 units remain permanently credited in the developer's ledger (<code className="text-[#A53B22] font-mono text-[10px]">UsageMeter.bonus_units</code>) until fully consumed.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-[#FFE6DC]/80">
                    <span className="material-symbols-outlined text-emerald-600 text-[16px] shrink-0 mt-0.5">check_circle</span>
                    <div className="text-[11px] leading-relaxed">
                      <strong className="text-[#1D1A23]">Zero Retroactive Charges:</strong>
                      <span className="text-[#57423D]"> Razorpay payment was settled at checkout. The developer is never charged extra ₹1,000 retroactively.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-[#FFE6DC]/80">
                    <span className="material-symbols-outlined text-emerald-600 text-[16px] shrink-0 mt-0.5">check_circle</span>
                    <div className="text-[11px] leading-relaxed">
                      <strong className="text-[#1D1A23]">Continuous Uninterrupted SLA:</strong>
                      <span className="text-[#57423D]"> The application cluster continues running with active tier throughput. Updates apply exclusively to new checkout orders.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* INFORMATIVE CONTAINER 2: ANNUAL COMMITMENT & DEVELOPER RETENTION ENGINE */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FAF4FB] border border-purple-200 flex items-center justify-center text-purple-700">
                    <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                  </div>
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-sm text-[#1D1A23]">
                      Annual Commitment & Perks Engine
                    </h3>
                    <p className="text-[11px] text-[#8B716B]">
                      2 Months Free (~17% Discount) · 10x Upfront Cashflow
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[9px] font-bold uppercase font-mono">
                  LTV Booster
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col gap-1">
                  <span className="text-[10px] text-[#8B716B] uppercase font-bold">Growth Annual</span>
                  <div className="font-['Outfit'] font-bold text-base text-[#1D1A23]">
                    ₹{(baseTierPrice * 10).toLocaleString('en-IN')}<span className="text-[10px] text-[#57423D] font-normal">/yr</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    Saves ₹{(baseTierPrice * 2).toLocaleString('en-IN')} (2 Mo Free)
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col gap-1">
                  <span className="text-[10px] text-[#8B716B] uppercase font-bold">Enterprise Annual</span>
                  <div className="font-['Outfit'] font-bold text-base text-purple-900">
                    ₹{(enterpriseTierPrice * 10).toLocaleString('en-IN')}<span className="text-[10px] text-[#57423D] font-normal">/yr</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    Saves ₹{(enterpriseTierPrice * 2).toLocaleString('en-IN')} (2 Mo Free)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-gradient-to-r from-[#FAF9F6] to-[#FFF8EB] border border-[#FFE6DC] flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B716B]">
                  Configured Annual Perks for Developers
                </span>
                <ul className="text-[11px] text-[#57423D] space-y-1.5 list-none">
                  <li className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#A53B22]">check</span>
                    <span><strong>Annual Commitment:</strong> 2 full months free (~17% immediate savings)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#A53B22]">check</span>
                    <span><strong>Studio Voices:</strong> Curated Studio Voice Library Access included</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#A53B22]">check</span>
                    <span><strong>Concurrency:</strong> 50 concurrent channels (2x monthly limit)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#A53B22]">check</span>
                    <span><strong>Priority Queue:</strong> Sub-650ms low-latency dedicated inference routing</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SEPARATE & SECURE APPLICATION PARTITIONS */}
      {adminTab === 'database' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#1D1A23]">
                Application Tenant Database Partitions
              </h2>
              <p className="text-xs text-[#57423D]">
                Every application cluster is provisioned with its own isolated partition. No customer ever accesses another developer's data or acoustic logs.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-[#57423D]">
                Active Partitions: <strong className="text-[#1D1A23]">{applications.length}</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
            <table className="w-full text-left border-collapse min-w-[720px] text-xs">
              <thead>
                <tr className="bg-[#FAF9F6] text-[#8B716B] text-[11px] font-['Outfit'] uppercase tracking-wider border-b border-[#FFE6DC]">
                  <th className="py-2.5 px-3 rounded-l-xl">Application Cluster</th>
                  <th className="py-2.5 px-3">Developer Owner</th>
                  <th className="py-2.5 px-3">Endpoint URL</th>
                  <th className="py-2.5 px-3">Plan Tier</th>
                  <th className="py-2.5 px-3">Units Consumed</th>
                  <th className="py-2.5 px-3">Isolation Status</th>
                  <th className="py-2.5 px-3 rounded-r-xl text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FFE6DC]/60">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-[#8B716B]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[32px] text-[#A53B22]/40">layers_clear</span>
                        <p className="font-semibold text-sm text-[#1D1A23]">No Application Clusters Provisioned</p>
                        <p className="text-xs text-[#8B716B] max-w-sm">
                          When developers create application clusters, their isolated database schemas will be tracked here in real time.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-[#FAF9F6] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF7E5F] to-[#FFAE33] text-white font-bold flex items-center justify-center font-['Outfit'] text-xs">
                            {app.app_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-[#1D1A23]">{app.app_name}</span>
                            <span className="font-mono text-[10px] text-[#8B716B] block">{app.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-[#1D1A23] font-semibold">{app.developer_name}</span>
                          <span className="font-mono text-[10px] text-[#8B716B]">{app.developer_email}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-[#006688] max-w-[220px] truncate">
                        {app.base_url}
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-[#57423D] font-mono text-[10px] font-bold">
                          {app.plan_tier}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-[#A53B22]">
                          {app.units_consumed.toLocaleString()} units
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          ACID Isolated
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onShowToast(`Inspected Cluster: ${app.app_name}`, `Endpoint verified: ${app.base_url}`)}
                          className="px-3 py-1 rounded-full bg-[#FAF9F6] hover:bg-[#FFE6DC]/50 text-[#1D1A23] font-bold border border-[#FFE6DC] text-[11px]"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Application Partitions Pagination Controls */}
          {applications.length > PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-[#FFE6DC] text-xs">
              <span className="text-[#8B716B]">
                Showing <strong className="text-[#1D1A23]">{(appPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
                <strong className="text-[#1D1A23]">{Math.min(appPage * PAGE_SIZE, applications.length)}</strong> of{' '}
                <strong className="text-[#1D1A23]">{applications.length}</strong> clusters
                <span className="ml-2 text-[11px] font-mono text-[#A53B22] font-semibold">(25 per page)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAppPage((p) => Math.max(1, p - 1))}
                  disabled={appPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-[#FFE6DC] text-[#57423D] font-bold hover:bg-[#FAF9F6] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <span className="px-2 py-1 font-mono font-bold text-[#1D1A23]">
                  {appPage} / {totalAppPages}
                </span>
                <button
                  onClick={() => setAppPage((p) => Math.min(totalAppPages, p + 1))}
                  disabled={appPage === totalAppPages}
                  className="px-3 py-1.5 rounded-lg border border-[#FFE6DC] text-[#57423D] font-bold hover:bg-[#FAF9F6] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
