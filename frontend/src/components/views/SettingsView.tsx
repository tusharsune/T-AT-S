import React, { useState, useEffect } from 'react';
import { AppView, DeveloperProfile } from '../../types';
import { TATSBackendAPI } from '../../services/api';

interface SettingsViewProps {
  onNavigate: (view: AppView) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning') => void;
  developer: DeveloperProfile | null;
  applications: any[];
  activeAppId: string;
  onSelectApp: (app: any) => void;
  onRefreshApps: () => Promise<void>;
  onOpenCreateApp: () => void;
  onUpdateDeveloperProfile: (dev: any) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onNavigate,
  onShowToast,
  developer,
  applications,
  activeAppId,
  onSelectApp,
  onRefreshApps,
  onOpenCreateApp,
  onUpdateDeveloperProfile
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'model-setup' | 'governance-security'>('account');

  // Account State
  const [name, setName] = useState(developer?.name || '');
  const [phone, setPhone] = useState(developer?.phone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Super Admin Governance Security State (Admin Only)
  const [govAuthMethod, setGovAuthMethod] = useState<'PASSWORD' | 'OTP' | 'SAVE_CODES'>('PASSWORD');
  const [govSaveCodes, setGovSaveCodes] = useState<string[]>([]);
  const [isSavingGovMethod, setIsSavingGovMethod] = useState<boolean>(false);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState<boolean>(false);
  const [copiedCodes, setCopiedCodes] = useState<boolean>(false);

  // Admin Master Password State
  const [adminCurrentPassword, setAdminCurrentPassword] = useState<string>('');
  const [adminNewPassword, setAdminNewPassword] = useState<string>('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState<string>('');
  const [adminPasswordError, setAdminPasswordError] = useState<string>('');
  const [isUpdatingAdminPassword, setIsUpdatingAdminPassword] = useState<boolean>(false);

  // Agent & Cluster State
  const activeApp = applications.find((a) => a.id === activeAppId) || applications[0];
  const [appName, setAppName] = useState(activeApp?.app_name || '');
  const [baseUrl, setBaseUrl] = useState(activeApp?.base_url || '');
  const [wakeWordPolicy, setWakeWordPolicy] = useState<'CUSTOM' | 'LOCKED'>(
    (activeApp?.wake_word_policy as any) || 'CUSTOM'
  );
  const [defaultPersona, setDefaultPersona] = useState<'BROWSER' | 'LIBRARY' | 'CLONED'>('LIBRARY');
  const [silenceTimeoutMs, setSilenceTimeoutMs] = useState<number>(800);
  const [isSavingApp, setIsSavingApp] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);

  // Small in-app confirmation modal states (replaces browser window.confirm)
  const [showSaveCodesConfirm, setShowSaveCodesConfirm] = useState(false);
  const [showApiKeyConfirm, setShowApiKeyConfirm] = useState(false);

  useEffect(() => {
    if (developer) {
      setName(developer.name || '');
      setPhone(developer.phone || '');
    }
  }, [developer]);

  useEffect(() => {
    if (activeApp) {
      setAppName(activeApp.app_name || '');
      setBaseUrl(activeApp.base_url || '');
      setWakeWordPolicy(activeApp.wake_word_policy || 'CUSTOM');
    }
  }, [activeApp]);

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast('Name Required', 'Please enter your developer name.', 'warning');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await TATSBackendAPI.updateProfile({ name: name.trim(), phone: phone.trim() });
      if (res.ok) {
        onUpdateDeveloperProfile(res.data.developer);
        onShowToast('Profile Updated', 'Your developer account details have been saved.', 'success');
      } else {
        onShowToast('Update Failed', res.data?.error || 'Could not update profile.', 'warning');
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Network error updating profile.', 'warning');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!oldPassword || !newPassword) {
      setPasswordError('Please fill out all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await TATSBackendAPI.changePassword({
        old_password: oldPassword,
        new_password: newPassword
      });

      if (res.ok) {
        onShowToast('Password Changed', 'Your password has been successfully updated.', 'success');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(res.data?.error || 'Password update failed.');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Could not update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle Save Agent & Model Settings
  const handleSaveAgentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApp) {
      onShowToast('No Cluster', 'Please provision an application cluster first.', 'warning');
      return;
    }

    setIsSavingApp(true);
    try {
      // 1. Update application cluster settings
      const appRes = await TATSBackendAPI.updateApplication(activeApp.id, {
        app_name: appName.trim(),
        base_url: baseUrl.trim(),
        wake_word_policy: wakeWordPolicy
      });

      // 2. Update default voice config
      await TATSBackendAPI.saveUserConfig('default_user', {
        wake_word: wakeWordPolicy === 'LOCKED' ? appName.trim() : 'Hey T@S',
        voice_tier: defaultPersona
      });

      if (appRes.ok) {
        await onRefreshApps();
        onShowToast('Agent Settings Synchronized', `Saved parameters for cluster "${appName}".`, 'success');
      } else {
        onShowToast('Update Notice', appRes.data?.error || 'Settings updated.', 'info');
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Failed to save settings.', 'warning');
    } finally {
      setIsSavingApp(false);
    }
  };

  // Handle Regenerate Key (Opens small in-app modal)
  const handleRegenerateKey = () => {
    if (!activeApp) return;
    setShowApiKeyConfirm(true);
  };

  const executeRegenerateKey = async () => {
    if (!activeApp) return;
    setIsRegeneratingKey(true);
    try {
      const res = await TATSBackendAPI.regenerateAppKey(activeApp.id);
      if (res.ok && res.data?.api_key) {
        const newKey = typeof res.data.api_key === 'string' ? res.data.api_key : (res.data.api_key?.key || String(res.data.api_key));
        TATSBackendAPI.setApiKey(newKey);
        await onRefreshApps();
        onShowToast('New API Key Generated', `New Key: ${newKey.substring(0, 16)}••••`, 'success');
      } else {
        onShowToast('Regeneration Failed', res.data?.error || 'Could not regenerate key.', 'warning');
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Key regeneration error.', 'warning');
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  // Load governance security settings on mount if admin
  useEffect(() => {
    if (developer?.is_admin) {
      loadGovernanceSecurityConfig();
    }
  }, [developer?.is_admin]);

  const loadGovernanceSecurityConfig = async () => {
    try {
      const res = await TATSBackendAPI.getGovernanceSecurityConfig();
      if (res.ok && res.data) {
        if (res.data.auth_method) {
          setGovAuthMethod(res.data.auth_method);
        }
        if (Array.isArray(res.data.save_codes)) {
          setGovSaveCodes(res.data.save_codes);
        }
      }
    } catch (err) {
      console.error('Failed to load governance security config:', err);
    }
  };

  // Admin: Update Governance Auth Method
  const handleUpdateGovMethod = async (method: 'PASSWORD' | 'OTP' | 'SAVE_CODES') => {
    setIsSavingGovMethod(true);
    try {
      const res = await TATSBackendAPI.updateGovernanceSecurityMethod(method);
      if (res.ok) {
        setGovAuthMethod(method);
        const methodLabel = method === 'PASSWORD' ? 'Master Password' : method === 'OTP' ? 'Email OTP' : 'Save Codes';
        onShowToast('Verification Check Updated', `Platform Governance access mode changed to ${methodLabel}.`, 'success');
      } else {
        onShowToast('Update Failed', res.data?.error || 'Could not update verification check.', 'warning');
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Failed to update verification check.', 'warning');
    } finally {
      setIsSavingGovMethod(false);
    }
  };

  // Admin: Request Save Codes Regeneration (Opens small in-app modal)
  const handleGenerateSaveCodes = () => {
    if (govSaveCodes.length > 0) {
      setShowSaveCodesConfirm(true);
      return;
    }
    executeGenerateSaveCodes();
  };

  const executeGenerateSaveCodes = async () => {
    setIsGeneratingCodes(true);
    try {
      const res = await TATSBackendAPI.generateGovernanceSaveCodes();
      if (res.ok && res.data?.save_codes) {
        setGovSaveCodes(res.data.save_codes);
        onShowToast('Save Codes Generated', `${res.data.save_codes.length} new emergency recovery codes created.`, 'success');
      } else {
        onShowToast('Generation Failed', res.data?.error || 'Could not generate save codes.', 'warning');
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Failed to generate codes.', 'warning');
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  // Admin: Copy Codes
  const handleCopyCodes = () => {
    if (!govSaveCodes.length) return;
    const text = `T@S PLATFORM GOVERNANCE EMERGENCY SAVE CODES\nGenerated: ${new Date().toLocaleString()}\nAdmin: ${developer?.email}\n\n` + govSaveCodes.map((c, i) => `${i + 1}. ${c}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 3000);
    onShowToast('Codes Copied', 'Emergency recovery codes copied to clipboard.', 'info');
  };

  // Admin: Update Master Password
  const handleUpdateAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasswordError('');
    if (!adminCurrentPassword || !adminNewPassword) {
      setAdminPasswordError('Please enter both current and new password.');
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      setAdminPasswordError('New passwords do not match.');
      return;
    }
    if (adminNewPassword.length < 8) {
      setAdminPasswordError('New password must be at least 8 characters long.');
      return;
    }

    setIsUpdatingAdminPassword(true);
    try {
      const res = await TATSBackendAPI.updateAdminGovernancePassword({
        old_password: adminCurrentPassword,
        new_password: adminNewPassword,
      });
      if (res.ok) {
        onShowToast('Admin Password Updated', 'Platform Governance master password successfully changed.', 'success');
        setAdminCurrentPassword('');
        setAdminNewPassword('');
        setAdminConfirmPassword('');
      } else {
        setAdminPasswordError(res.data?.error || 'Failed to update admin password.');
      }
    } catch (err: any) {
      setAdminPasswordError(err.message || 'Error updating password.');
    } finally {
      setIsUpdatingAdminPassword(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#FAF9F6] p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Hero Header */}
      <div className="relative bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="flex flex-col gap-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDAD2] text-[#84240D] font-['Outfit'] text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5F45]"></span>
              Developer Account & Model Setup
            </span>
            <span className="text-xs text-[#57423D] flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
              Live Database Config
            </span>
          </div>

          <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-[#1D1A23] tracking-tight">
            Developer Settings & Agent Configuration
          </h1>
          <p className="text-xs sm:text-sm text-[#57423D] leading-relaxed">
            Manage your developer profile credentials, security passwords, application clusters, and acoustic inference thresholds in real time.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 p-1.5 bg-[#FAF9F6] border border-[#FFE6DC] rounded-2xl overflow-x-auto whitespace-nowrap max-w-full">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'account'
                ? 'bg-[#FF7E5F] text-white shadow-sm'
                : 'text-[#57423D] hover:bg-white hover:text-[#1D1A23]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">person</span>
            <span>Profile & Account</span>
          </button>
          <button
            onClick={() => setActiveTab('model-setup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'model-setup'
                ? 'bg-[#FF7E5F] text-white shadow-sm'
                : 'text-[#57423D] hover:bg-white hover:text-[#1D1A23]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Model & Agent Setup</span>
          </button>
          {developer?.is_admin && (
            <button
              onClick={() => setActiveTab('governance-security')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'governance-security'
                  ? 'bg-[#A53B22] text-white shadow-sm'
                  : 'text-[#A53B22] hover:bg-white hover:text-[#84240D]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              <span>Platform Governance Security</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: ACCOUNT & SECURITY */}
      {activeTab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
          {/* Left Column: Profile Info Form */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#FFE6DC]">
                <div>
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#1D1A23]">
                    Personal & Organization Details
                  </h2>
                  <p className="text-xs text-[#57423D]">
                    Update your display name and contact phone number.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-mono text-[#57423D]">
                  {developer?.is_admin ? 'Platform Admin' : 'Developer Account'}
                </span>
              </div>

              <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#1D1A23]">Developer Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full h-11 px-4 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#1D1A23]">Registered Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={developer?.email || ''}
                      disabled
                      className="w-full h-11 pl-4 pr-24 rounded-xl bg-[#FAF9F6]/60 border border-[#FFE6DC] text-xs font-mono text-[#57423D] cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-2.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Verified
                    </span>
                  </div>
                  <span className="text-[10px] text-[#8B716B]">Email is locked to your account credentials.</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#1D1A23]">Indian Mobile Number (+91)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210 or +91 9876543210"
                    className="w-full h-11 px-4 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-mono text-[#1D1A23] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]"
                  />
                  <span className="text-[10px] text-[#8B716B]">Used for secure account lookups and critical billing notifications.</span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] hover:from-[#FF5F45] hover:to-[#FFAE33] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isSavingProfile ? 'animate-spin' : ''}`}>
                      {isSavingProfile ? 'refresh' : 'save'}
                    </span>
                    <span>{isSavingProfile ? 'Saving...' : 'Save Profile Details'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Password Change Form */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#FFE6DC]">
                <div>
                  <h2 className="font-['Outfit'] text-base font-bold text-[#1D1A23]">
                    Security & Password
                  </h2>
                  <p className="text-xs text-[#57423D]">
                    Change your master authentication password.
                  </p>
                </div>
                <span className="material-symbols-outlined text-[#A53B22] text-[20px]">lock</span>
              </div>

              <form onSubmit={handleChangePassword} className="flex flex-col gap-3.5 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#1D1A23]">Current Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Enter current password..."
                    className="w-full h-11 px-4 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#1D1A23]">New Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 chars with uppercase, number & symbol..."
                    className="w-full h-11 px-4 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#1D1A23]">Confirm New Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password..."
                    className="w-full h-11 px-4 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]"
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="text-[#8B716B] hover:text-[#1D1A23] flex items-center gap-1 font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {showPasswords ? 'visibility_off' : 'visibility'}
                    </span>
                    <span>{showPasswords ? 'Hide passwords' : 'Show passwords'}</span>
                  </button>
                </div>

                {passwordError && (
                  <div className="p-3 rounded-xl bg-[#FFDAD6] border border-[#BA1A1A]/20 text-[#93000A] text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                    <span>{passwordError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full mt-2 py-2.5 rounded-full bg-[#1D1A23] hover:bg-[#2E2A36] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isChangingPassword ? 'animate-spin' : ''}`}>
                    {isChangingPassword ? 'refresh' : 'lock_reset'}
                  </span>
                  <span>{isChangingPassword ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MODEL & AGENT SETUP */}
      {activeTab === 'model-setup' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          {/* Cluster Selection & Quick Provision Bar */}
          <div className="p-4 sm:p-6 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B716B] font-['Outfit']">
                Currently Configuring Cluster
              </span>
              <div className="flex items-center gap-2 mt-1">
                {applications.length > 0 ? (
                  <select
                    value={activeAppId}
                    onChange={(e) => {
                      const found = applications.find((a) => a.id === e.target.value);
                      if (found) onSelectApp(found);
                    }}
                    className="h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-bold text-[#1D1A23] focus:outline-none cursor-pointer"
                  >
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.app_name} ({app.plan_tier || 'FREE'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold text-[#A53B22]">No application clusters found</span>
                )}
              </div>
            </div>

            <button
              onClick={onOpenCreateApp}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] text-white font-['Outfit'] font-bold text-xs shadow-sm hover:scale-[1.02] transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>+ Create New Cluster</span>
            </button>
          </div>

          {activeApp ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Application Model & Endpoint Settings */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <form onSubmit={handleSaveAgentConfig} className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-6">
                  <div className="flex items-center justify-between pb-3 border-b border-[#FFE6DC]">
                    <div>
                      <h2 className="font-['Outfit'] text-lg font-bold text-[#1D1A23]">
                        Agent Parameters & Routing
                      </h2>
                      <p className="text-xs text-[#57423D]">
                        Configure model personas, wake words, and backend endpoint URLs.
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      ACID Partition
                    </span>
                  </div>

                  <div className="flex flex-col gap-4 text-xs">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-[#1D1A23]">Application Cluster Name</label>
                      <input
                        type="text"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        placeholder="e.g. ShopFlow Voice Assistant"
                        className="w-full h-11 px-4 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-[#1D1A23]">Developer Base API Endpoint URL</label>
                      <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://api.yourdomain.com"
                        className="w-full h-11 px-4 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-mono text-[#006688] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]"
                        required
                      />
                      <span className="text-[10px] text-[#8B716B]">Registered tool webhooks will dispatch deterministic actions to this base URL.</span>
                    </div>

                    {/* Wake Word Policy Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-[#1D1A23]">Wake Word Policy</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                          wakeWordPolicy === 'CUSTOM'
                            ? 'bg-[#FFDAD2]/30 border-[#FF7E5F]'
                            : 'bg-[#FAF9F6] border-[#FFE6DC]'
                        }`}>
                          <input
                            type="radio"
                            name="wakeWordPolicy"
                            checked={wakeWordPolicy === 'CUSTOM'}
                            onChange={() => setWakeWordPolicy('CUSTOM')}
                            className="mt-0.5 accent-[#FF7E5F]"
                          />
                          <div>
                            <span className="font-bold text-xs text-[#1D1A23] block">Allow Custom Wake Words</span>
                            <span className="text-[11px] text-[#57423D]">Callers can set personalized wake words via calibration.</span>
                          </div>
                        </label>

                        <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                          wakeWordPolicy === 'LOCKED'
                            ? 'bg-[#FFDAD2]/30 border-[#FF7E5F]'
                            : 'bg-[#FAF9F6] border-[#FFE6DC]'
                        }`}>
                          <input
                            type="radio"
                            name="wakeWordPolicy"
                            checked={wakeWordPolicy === 'LOCKED'}
                            onChange={() => setWakeWordPolicy('LOCKED')}
                            className="mt-0.5 accent-[#FF7E5F]"
                          />
                          <div>
                            <span className="font-bold text-xs text-[#1D1A23] block">Locked to App Name</span>
                            <span className="text-[11px] text-[#57423D]">Enforces branding (wake word must match "{appName || 'App'}").</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Default Model Persona Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-[#1D1A23]">Primary Speech Persona Tier</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { id: 'LIBRARY', name: 'Edge Library', desc: 'Pre-calibrated neural voice personas.' },
                          { id: 'CLONED', name: '6-Sec Neural Clone', desc: 'Synthesized zero-shot reference voice.' },
                          { id: 'BROWSER', name: 'Browser Native', desc: 'Zero-latency local OS synthesis.' }
                        ].map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setDefaultPersona(p.id as any)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              defaultPersona === p.id
                                ? 'bg-[#FFDAD2]/40 border-[#FF7E5F]'
                                : 'bg-[#FAF9F6] border-[#FFE6DC] hover:bg-white'
                            }`}
                          >
                            <span className="font-bold text-xs text-[#1D1A23] block">{p.name}</span>
                            <span className="text-[10px] text-[#57423D]">{p.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Edge Turn Timeout Slider */}
                    <div className="flex flex-col gap-2 bg-[#FAF9F6] p-4 rounded-2xl border border-[#FFE6DC]">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-[#1D1A23] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-[#A53B22]">timer</span>
                          Edge Speech Turn Timeout
                        </label>
                        <span className="font-mono font-bold text-[#A53B22] text-sm">
                          {silenceTimeoutMs}ms
                        </span>
                      </div>
                      <input
                        type="range"
                        min={400}
                        max={2000}
                        step={100}
                        value={silenceTimeoutMs}
                        onChange={(e) => setSilenceTimeoutMs(Number(e.target.value))}
                        className="w-full h-2 bg-[#EDE5F2] rounded-lg appearance-none cursor-pointer accent-[#FF7E5F]"
                      />
                      <div className="flex justify-between text-[10px] text-[#8B716B] font-mono">
                        <span>400ms (Fast)</span>
                        <span>800ms (Recommended)</span>
                        <span>2000ms (Relaxed)</span>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingApp}
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <span className={`material-symbols-outlined text-[16px] ${isSavingApp ? 'animate-spin' : ''}`}>
                          {isSavingApp ? 'refresh' : 'check'}
                        </span>
                        <span>{isSavingApp ? 'Saving Parameters...' : 'Save Agent Setup'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Right 5 Cols: Security & API Keys */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#FFE6DC]">
                    <h2 className="font-['Outfit'] text-base font-bold text-[#1D1A23]">
                      Cluster Credentials & Keys
                    </h2>
                    <span className="material-symbols-outlined text-[#845400] text-[20px]">vpn_key</span>
                  </div>

                  <div className="flex flex-col gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase text-[#8B716B]">Live API Key</span>
                      <span className="font-mono font-bold text-[#1D1A23] text-xs">
                        {activeApp.api_key_prefix || 'tas_live_••••••••'}
                      </span>
                      <span className="text-[10px] text-[#8B716B]">Authorize streaming audio frames & webhook actions.</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase text-[#8B716B]">Service Verification Key</span>
                      <span className="font-mono text-[11px] text-[#57423D] truncate">
                        SHA-256 HMAC Encrypted
                      </span>
                      <span className="text-[10px] text-[#8B716B]">Used in backend middleware to verify incoming caller payloads.</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleRegenerateKey}
                      disabled={isRegeneratingKey}
                      className="w-full mt-2 py-2.5 rounded-full bg-[#FAF9F6] hover:bg-[#FFDAD6] text-[#93000A] font-bold text-xs border border-[#FFE6DC] hover:border-[#BA1A1A]/30 transition-all flex items-center justify-center gap-2"
                    >
                      <span className={`material-symbols-outlined text-[16px] ${isRegeneratingKey ? 'animate-spin' : ''}`}>
                        {isRegeneratingKey ? 'refresh' : 'autorenew'}
                      </span>
                      <span>{isRegeneratingKey ? 'Regenerating...' : 'Regenerate API Key'}</span>
                    </button>
                  </div>

                  {/* Zero-Storage Architecture Box */}
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
                      <span>100% Volatile RAM Execution</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Voice frames are processed purely inside volatile RAM and wiped instantly after completion. Zero audio file disk logging adheres strictly to GDPR Article 17.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-[#FFE6DC] flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-[36px] text-[#A53B22]/40">dns</span>
              <p className="font-bold text-sm text-[#1D1A23]">No Application Cluster Selected</p>
              <p className="text-xs text-[#8B716B] max-w-sm">
                Provision a new application cluster to configure wake word policies, model personas, and custom base URLs.
              </p>
              <button
                onClick={onOpenCreateApp}
                className="mt-2 px-5 py-2.5 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>+ Create Your First Cluster</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PLATFORM GOVERNANCE SECURITY (STRICTLY ADMIN ONLY) */}
      {developer?.is_admin && activeTab === 'governance-security' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
          {/* Left Column: Access Verification Check Settings & Emergency Save Codes */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Card 1: Verification Mode Selection */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#FFE6DC]">
                <div>
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#1D1A23] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#A53B22]">security</span>
                    Platform Governance Verification Check Mode
                  </h2>
                  <p className="text-xs text-[#57423D]">
                    Choose the primary authentication challenge required to unlock the Platform Governance portal when locked.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#FFDAD2] text-[#84240D] text-[11px] font-bold font-mono">
                  {govAuthMethod === 'PASSWORD' ? 'Master Password' : govAuthMethod === 'OTP' ? 'Email OTP' : 'Save Codes'}
                </span>
              </div>

              {/* Method Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Mode 1: Password */}
                <div
                  onClick={() => handleUpdateGovMethod('PASSWORD')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2 relative ${
                    govAuthMethod === 'PASSWORD'
                      ? 'border-[#A53B22] bg-[#FFF5F2] ring-2 ring-[#A53B22]/20'
                      : 'border-[#FFE6DC] bg-[#FAF9F6] hover:border-[#FF7E5F]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="material-symbols-outlined text-[20px] text-[#A53B22]">password</span>
                    {govAuthMethod === 'PASSWORD' && (
                      <span className="material-symbols-outlined text-[16px] text-[#A53B22]">check_circle</span>
                    )}
                  </div>
                  <h4 className="font-['Outfit'] font-bold text-xs text-[#1D1A23]">Master Password</h4>
                  <p className="text-[11px] text-[#57423D] leading-relaxed">
                    Verify via your administrator password set during superuser creation or updated below.
                  </p>
                </div>

                {/* Mode 2: OTP */}
                <div
                  onClick={() => handleUpdateGovMethod('OTP')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2 relative ${
                    govAuthMethod === 'OTP'
                      ? 'border-[#A53B22] bg-[#FFF5F2] ring-2 ring-[#A53B22]/20'
                      : 'border-[#FFE6DC] bg-[#FAF9F6] hover:border-[#FF7E5F]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="material-symbols-outlined text-[20px] text-[#A53B22]">mark_email_read</span>
                    {govAuthMethod === 'OTP' && (
                      <span className="material-symbols-outlined text-[16px] text-[#A53B22]">check_circle</span>
                    )}
                  </div>
                  <h4 className="font-['Outfit'] font-bold text-xs text-[#1D1A23]">Email OTP</h4>
                  <p className="text-[11px] text-[#57423D] leading-relaxed">
                    A single-use 6-digit OTP code dispatched to <span className="font-mono text-[#1D1A23]">{developer.email}</span>.
                  </p>
                </div>

                {/* Mode 3: Save Codes */}
                <div
                  onClick={() => handleUpdateGovMethod('SAVE_CODES')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2 relative ${
                    govAuthMethod === 'SAVE_CODES'
                      ? 'border-[#A53B22] bg-[#FFF5F2] ring-2 ring-[#A53B22]/20'
                      : 'border-[#FFE6DC] bg-[#FAF9F6] hover:border-[#FF7E5F]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="material-symbols-outlined text-[20px] text-[#A53B22]">vpn_key</span>
                    {govAuthMethod === 'SAVE_CODES' && (
                      <span className="material-symbols-outlined text-[16px] text-[#A53B22]">check_circle</span>
                    )}
                  </div>
                  <h4 className="font-['Outfit'] font-bold text-xs text-[#1D1A23]">Save Codes</h4>
                  <p className="text-[11px] text-[#57423D] leading-relaxed">
                    Single-use offline recovery codes (e.g. TAS-XXXX-XXXX). Auto-consumed on use.
                  </p>
                </div>
              </div>

              {isSavingGovMethod && (
                <div className="flex items-center gap-2 text-xs text-[#A53B22] font-semibold">
                  <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                  <span>Saving verification check preferences...</span>
                </div>
              )}
            </div>

            {/* Card 2: Save Codes Management */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#FFE6DC]">
                <div>
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#1D1A23] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#A53B22]">pin</span>
                    Emergency Save / Offline Recovery Codes
                  </h2>
                  <p className="text-xs text-[#57423D]">
                    Keep these single-use codes offline in case you lose access or require isolated portal access.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-mono text-[#57423D]">
                  {govSaveCodes.length} {govSaveCodes.length === 1 ? 'Code' : 'Codes'} Available
                </span>
              </div>

              {govSaveCodes.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {govSaveCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] font-mono text-xs font-bold text-[#1D1A23] text-center tracking-wider select-all"
                      >
                        {code}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCopyCodes}
                      className="px-4 py-2 rounded-xl bg-[#FAF9F6] hover:bg-[#FFE6DC] text-[#1D1A23] text-xs font-bold border border-[#FFE6DC] transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {copiedCodes ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedCodes ? 'Copied to Clipboard!' : 'Copy All Save Codes'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateSaveCodes}
                      disabled={isGeneratingCodes}
                      className="px-4 py-2 rounded-xl bg-[#A53B22] hover:bg-[#84240D] text-white text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <span className={`material-symbols-outlined text-[16px] ${isGeneratingCodes ? 'animate-spin' : ''}`}>
                        refresh
                      </span>
                      <span>{isGeneratingCodes ? 'Generating...' : 'Regenerate New Codes'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[#FAF9F6] border border-dashed border-[#FFE6DC] flex flex-col items-center justify-center gap-3 text-center">
                  <span className="material-symbols-outlined text-[32px] text-[#A53B22]/50">vpn_key_off</span>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-bold text-[#1D1A23]">No Save Codes Generated Yet</p>
                    <p className="text-[11px] text-[#57423D] max-w-sm">
                      Generate 6 emergency single-use tokens to unlock the platform even without an email service or password.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateSaveCodes}
                    disabled={isGeneratingCodes}
                    className="px-4 py-2 rounded-xl bg-[#A53B22] hover:bg-[#84240D] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isGeneratingCodes ? 'animate-spin' : ''}`}>
                      vpn_key
                    </span>
                    <span>{isGeneratingCodes ? 'Generating...' : 'Generate 6 Save Codes'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Update Super Admin Master Password */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-5">
              <div className="pb-3 border-b border-[#FFE6DC]">
                <h3 className="font-['Outfit'] text-lg font-bold text-[#1D1A23] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#A53B22]">lock_reset</span>
                  Update Super Admin Master Password
                </h3>
                <p className="text-xs text-[#57423D]">
                  Change the root administrative password used for Platform Governance and system maintenance.
                </p>
              </div>

              {adminPasswordError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-red-600">error</span>
                  <span>{adminPasswordError}</span>
                </div>
              )}

              <form onSubmit={handleUpdateAdminPassword} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#1D1A23]">Current Admin Password</label>
                  <input
                    type="password"
                    value={adminCurrentPassword}
                    onChange={(e) => setAdminCurrentPassword(e.target.value)}
                    placeholder="Enter current password..."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#1D1A23]">New Admin Password</label>
                  <input
                    type="password"
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters..."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#1D1A23]">Confirm New Password</label>
                  <input
                    type="password"
                    value={adminConfirmPassword}
                    onChange={(e) => setAdminConfirmPassword(e.target.value)}
                    placeholder="Repeat new password..."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingAdminPassword}
                  className="w-full mt-2 py-3 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isUpdatingAdminPassword ? 'animate-spin' : ''}`}>
                    {isUpdatingAdminPassword ? 'refresh' : 'verified_user'}
                  </span>
                  <span>{isUpdatingAdminPassword ? 'Updating Master Password...' : 'Save Admin Password'}</span>
                </button>
              </form>

              {/* Security Advisory */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="material-symbols-outlined text-[16px] text-amber-600">admin_panel_settings</span>
                  <span>Administrator Privilege Isolation</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  These security configurations are strictly restricted to verified platform administrators. Standard developer accounts cannot view or modify these controls.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Small Screen Popup 1: Regenerate Offline Recovery Codes */}
      {showSaveCodesConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setShowSaveCodesConfirm(false)} />
          <div className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-[#FFE6DC] shadow-2xl flex flex-col items-center text-center gap-4 z-10 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-[#FFDAD2] text-[#A53B22] flex items-center justify-center shadow-md shadow-[#FF7E5F]/15">
              <span className="material-symbols-outlined text-[28px]">vpn_key_alert</span>
            </div>
            <div>
              <h3 className="font-['Outfit'] text-lg font-bold text-[#1D1A23]">
                Invalidate & Regenerate Codes?
              </h3>
              <p className="text-xs text-[#57423D] mt-1.5 leading-relaxed">
                Generating new save codes will permanently invalidate all existing unused recovery codes. Continue?
              </p>
            </div>
            <div className="flex items-center gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => setShowSaveCodesConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-full bg-[#FAF9F6] hover:bg-[#F3EBF8] text-[#57423D] font-bold text-xs border border-[#FFE6DC] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveCodesConfirm(false);
                  executeGenerateSaveCodes();
                }}
                disabled={isGeneratingCodes}
                className="flex-1 py-2.5 px-4 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-bold text-xs shadow-md shadow-[#A53B22]/20 transition-all flex items-center justify-center gap-1.5"
              >
                {isGeneratingCodes ? (
                  <>
                    <span className="material-symbols-outlined text-[15px] animate-spin">refresh</span>
                    <span>Generating...</span>
                  </>
                ) : (
                  <span>Regenerate Codes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Small Screen Popup 2: Rotate Application API Key */}
      {showApiKeyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setShowApiKeyConfirm(false)} />
          <div className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-[#FFE6DC] shadow-2xl flex flex-col items-center text-center gap-4 z-10 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-md shadow-amber-500/15">
              <span className="material-symbols-outlined text-[28px]">key</span>
            </div>
            <div>
              <h3 className="font-['Outfit'] text-lg font-bold text-[#1D1A23]">
                Rotate Application API Key?
              </h3>
              <p className="text-xs text-[#57423D] mt-1.5 leading-relaxed">
                Are you sure you want to regenerate the API key for "{activeApp?.app_name}"? Existing integrations will stop working until updated with the new token.
              </p>
            </div>
            <div className="flex items-center gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => setShowApiKeyConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-full bg-[#FAF9F6] hover:bg-[#F3EBF8] text-[#57423D] font-bold text-xs border border-[#FFE6DC] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowApiKeyConfirm(false);
                  executeRegenerateKey();
                }}
                disabled={isRegeneratingKey}
                className="flex-1 py-2.5 px-4 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] hover:from-[#FF5F45] hover:to-[#FFAE33] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {isRegeneratingKey ? (
                  <>
                    <span className="material-symbols-outlined text-[15px] animate-spin">refresh</span>
                    <span>Rotating...</span>
                  </>
                ) : (
                  <span>Rotate Key</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

