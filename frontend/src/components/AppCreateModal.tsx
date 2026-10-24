import React, { useState } from 'react';
import { TATSBackendAPI } from '../services/api';

interface AppCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (app: any) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning') => void;
}

export const AppCreateModal: React.FC<AppCreateModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onShowToast
}) => {
  const [appName, setAppName] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:8000');
  const [wakeWordPolicy, setWakeWordPolicy] = useState('CUSTOM');
  const [isLoading, setIsLoading] = useState(false);
  const [createdKeys, setCreatedKeys] = useState<{ apiKey: string; serviceKey: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;

    setIsLoading(true);
    try {
      const res = await TATSBackendAPI.createApplication(appName, baseUrl, wakeWordPolicy);
      if (res.ok && res.data && res.data.application) {
        const apiKey = res.data.credentials?.api_key || res.data.application?.api_key || '';
        const serviceKey = res.data.credentials?.service_key || res.data.application?.service_key || '';
        setCreatedKeys({
          apiKey,
          serviceKey,
        });
        if (apiKey) {
          TATSBackendAPI.setApiKey(apiKey);
        }
        onCreated(res.data.application);
        onShowToast('Application Cluster Created!', `Provisioned "${appName}" with 256-bit API keys.`);
      } else {
        const errMsg = res?.data?.error || res?.data?.message || 'Server error occurred.';
        onShowToast('Failed to Create Application', String(errMsg), 'warning');
      }
    } catch (err: any) {
      onShowToast('Application Error', err?.message || 'Could not complete cluster provisioning.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onShowToast('Copied to clipboard', `${label} copied successfully.`);
  };

  const handleFinish = () => {
    setCreatedKeys(null);
    setAppName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={handleFinish} />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-[0_24px_64px_-12px_rgba(30,27,36,0.22)] border border-[#FFE6DC] p-6 sm:p-8 overflow-hidden z-10 animate-in zoom-in-95 duration-200 flex flex-col gap-5">
        <div className="flex items-center justify-between pb-2 border-b border-[#FFE6DC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00C2FF] to-[#006688] flex items-center justify-center text-white shadow-sm">
              <span className="material-symbols-outlined text-[22px]">dns</span>
            </div>
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#1D1A23]">
                {createdKeys ? 'Cluster Credentials' : 'New Application Cluster'}
              </h2>
              <p className="text-xs text-[#57423D]">
                {createdKeys ? 'Save these keys securely. They will not be shown again.' : 'Connect a new software service to the T@S Acoustic Engine'}
              </p>
            </div>
          </div>
          <button
            onClick={handleFinish}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8B716B] hover:bg-[#FAF9F6] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {createdKeys ? (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5">verified</span>
              <div>
                <p className="font-bold">Cluster Provisioned Successfully</p>
                <p className="text-[11px] text-emerald-700">Use this API key to authenticate voice & tool calls from your web app or backend SDK.</p>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#57423D]">Live API Key (tas_live_...)</label>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] font-mono text-xs">
                <span className="text-[#1D1A23] truncate max-w-xs">{createdKeys.apiKey}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdKeys.apiKey, 'API Key')}
                  className="p-1 text-[#8B716B] hover:text-[#1D1A23]"
                  title="Copy"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#57423D]">Service Secret Key (tas_srv_...)</label>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] font-mono text-xs">
                <span className="text-[#1D1A23] truncate max-w-xs">{createdKeys.serviceKey}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdKeys.serviceKey, 'Service Key')}
                  className="p-1 text-[#8B716B] hover:text-[#1D1A23]"
                  title="Copy"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full mt-2 py-2.5 rounded-full bg-[#1D1A23] hover:bg-[#342D3D] text-white text-xs font-bold transition-all"
            >
              Done & Open Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#57423D]">Application Name</label>
              <input
                type="text"
                required
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. Acme Inventory & POS"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:ring-2 focus:ring-[#00C2FF]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#57423D]">Application Root Base URL</label>
              <input
                type="url"
                required
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.acme.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:ring-2 focus:ring-[#00C2FF]"
              />
              <span className="text-[10px] text-[#8B716B]">The HTTP target where tool actions will be dispatched.</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#57423D]">Wake Word Policy</label>
              <select
                value={wakeWordPolicy}
                onChange={(e) => setWakeWordPolicy(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:ring-2 focus:ring-[#00C2FF]"
              >
                <option value="CUSTOM">Allow End-Users Custom Wake Word ("Hey Acme", "Hey Alex")</option>
                <option value="LOCKED">Locked to App Name Only</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 rounded-full bg-gradient-to-r from-[#00C2FF] to-[#006688] hover:from-[#006688] hover:to-[#004D67] text-white text-xs font-bold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                  <span>Generating 256-bit Keys...</span>
                </>
              ) : (
                <span>Provision Application Cluster</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

