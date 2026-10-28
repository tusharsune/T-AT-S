import React from 'react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  isMicActive?: boolean;
  isAdmin?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  applications?: any[];
  activeAppId?: string;
  onSelectApp?: (app: any) => void;
  onOpenCreateApp?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isMicActive,
  isAdmin,
  isMobileOpen,
  onCloseMobile,
  applications = [],
  activeAppId,
  onSelectApp,
  onOpenCreateApp,
  onLogout
}) => {
  const rawNavItems: { path: AppView; label: string; icon: string }[] = [
    { path: 'developer-dashboard', label: 'Developer Dashboard', icon: 'monitoring' },
    { path: 'visual-tool-builder', label: 'Visual Tool Builder', icon: 'account_tree' },
    { path: 'live-voice-playground', label: 'Live Voice Playground', icon: 'mic' },
    { path: 'component-wizard', label: 'Component Wizard', icon: 'auto_awesome' },
    ...(isAdmin
      ? [
          { path: 'super-admin' as AppView, label: 'Platform Governance', icon: 'admin_panel_settings' },
          { path: 'subscription-pricing' as AppView, label: 'Subscription & Plans', icon: 'payments' },
        ]
      : [{ path: 'subscription-pricing' as AppView, label: 'Subscription & Plans', icon: 'payments' }]),
    { path: 'notifications' as AppView, label: 'Notifications & Alerts', icon: 'notifications' },
    { path: 'settings' as AppView, label: 'Account & Settings', icon: 'settings' },
  ];

  const navItems = rawNavItems.map((item, idx) => ({
    ...item,
    shortcut: String(idx + 1),
  }));

  const activeApp = applications.find((a) => a.id === activeAppId) || applications[0];

  const renderNavButtons = (isMobile: boolean = false) => (
    <nav className="flex flex-col gap-1 mt-1">
      {navItems.map((item) => {
        const isActive = currentView === item.path;
        return (
          <button
            key={item.path}
            onClick={() => {
              onNavigate(item.path);
              if (isMobile && onCloseMobile) {
                onCloseMobile();
              }
            }}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-xs font-semibold group text-left cursor-pointer ${
              isActive
                ? 'bg-[#FF7E5F] text-white shadow-[0_4px_16px_-2px_rgba(255,126,95,0.35)] font-bold'
                : 'text-[#57423D] hover:bg-[#EDE5F2] hover:text-[#1D1A23]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`material-symbols-outlined text-[19px] transition-colors ${
                  isActive ? 'text-white' : 'text-[#8B716B] group-hover:text-[#A53B22]'
                }`}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>
            {!isMobile && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-white/20 text-white' : 'text-[#8B716B] opacity-0 group-hover:opacity-100'
                }`}
              >
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* ======================================================== */}
      {/* 1. DESKTOP PERMANENT SIDEBAR (>= 1024px) */}
      {/* ======================================================== */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#F8F1FE]/80 backdrop-blur-xl z-30 flex-col justify-between py-4 border-r border-[#FFE6DC]/60 shadow-[0_4px_20px_-2px_rgba(30,27,36,0.03)] hidden lg:flex">
        {/* Workspace Menu */}
        <div className="flex flex-col gap-1 px-3">
          <div className="px-3 py-1 flex items-center justify-between">
            <span className="font-['Outfit'] text-[11px] font-bold text-[#57423D] uppercase tracking-wider">
              Workspaces
            </span>
            <span className="text-[10px] text-[#8B716B] font-mono">1-{navItems.length}</span>
          </div>
          {renderNavButtons(false)}
        </div>

        {/* Workspace Quick Hub Box */}
        <div className="px-4">
          <div className="p-3.5 rounded-2xl bg-white/95 border border-[#FFE6DC] shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#1D1A23]">
                <span className="material-symbols-outlined text-[16px] text-[#A53B22]">terminal</span>
                <span className="font-['Outfit'] text-[11px] font-bold uppercase tracking-wider">
                  Voice Engine
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Active
              </span>
            </div>
            <p className="text-[11px] text-[#57423D] leading-snug">
              Zero-hallucination deterministic action routing connected to backend.
            </p>
            <button
              onClick={() => onNavigate('live-voice-playground')}
              className="w-full mt-0.5 py-1.5 px-2.5 rounded-xl bg-[#FAF9F6] hover:bg-[#FFDAD2] text-[#A53B22] text-[11px] font-bold border border-[#FFE6DC] transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">mic</span>
              <span>Test Live Voice</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MOBILE RESPONSIVE DRAWER OVERLAY (< 1024px) */}
      {/* ======================================================== */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Slide-In Menu Panel */}
          <div className="relative w-72 max-w-[85vw] bg-[#FAF9F6] h-full shadow-2xl flex flex-col justify-between py-4 px-3 border-r border-[#FFE6DC] z-10 animate-in slide-in-from-left duration-200 overflow-y-auto">
            <div className="flex flex-col gap-3">
              {/* Drawer Top Header: Logo + Close */}
              <div className="flex items-center justify-between pb-3 px-1 border-b border-[#FFE6DC]/60">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/tas_final_logo_mark_small.svg"
                    alt="T@S"
                    className="h-8 w-8 aspect-square object-contain"
                  />
                  <div className="flex flex-col leading-none">
                    <span className="font-['Plus_Jakarta_Sans',Outfit,sans-serif] font-extrabold text-[17px] tracking-[0.12em] text-[#1a1520]">
                      T<span className="text-[#ff6b4a]">@</span>S
                    </span>
                    <span className="font-['Plus_Jakarta_Sans',Outfit,sans-serif] text-[8px] uppercase font-semibold tracking-[0.18em] text-[#6b6470] mt-0.5">
                      TALK · DECIDE · SOLVE
                    </span>
                  </div>
                </div>
                <button
                  onClick={onCloseMobile}
                  className="p-1.5 rounded-full hover:bg-white text-[#57423D] transition-colors"
                  aria-label="Close navigation"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Mobile App Cluster Selector */}
              {applications.length > 0 && (
                <div className="bg-white p-2.5 rounded-2xl border border-[#FFE6DC] shadow-xs">
                  <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold text-[#8B716B] uppercase font-['Outfit']">
                    <span>Active App Cluster</span>
                    <span className="text-[#A53B22] font-mono">{applications.length} Apps</span>
                  </div>
                  <select
                    value={activeApp?.id || ''}
                    onChange={(e) => {
                      const sel = applications.find((a) => a.id === e.target.value);
                      if (sel && onSelectApp) onSelectApp(sel);
                    }}
                    className="w-full text-xs font-semibold p-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-[#1D1A23] focus:outline-none focus:border-[#A53B22] cursor-pointer"
                  >
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.app_name}
                      </option>
                    ))}
                  </select>
                  {onOpenCreateApp && (
                    <button
                      onClick={() => {
                        if (onCloseMobile) onCloseMobile();
                        onOpenCreateApp();
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-[#A53B22] hover:bg-[#FFDAD2]/20 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">add_circle</span>
                      <span>+ Create New Application</span>
                    </button>
                  )}
                </div>
              )}

              {/* Navigation Items */}
              <div className="px-1 flex items-center justify-between">
                <span className="font-['Outfit'] text-[11px] font-bold text-[#57423D] uppercase tracking-wider">
                  Workspaces
                </span>
                <span className="text-[10px] text-[#8B716B] font-mono">1-{navItems.length}</span>
              </div>
              {renderNavButtons(true)}
            </div>

            {/* Bottom Status & Sign Out */}
            <div className="pt-3 border-t border-[#FFE6DC]/60 flex flex-col gap-2 mt-4">
              <div className="p-2.5 rounded-xl bg-white border border-[#FFE6DC] flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-1.5 text-[#1D1A23]">
                  <span className="material-symbols-outlined text-[15px] text-[#A53B22]">terminal</span>
                  <span className="font-['Outfit'] text-[10px] font-bold uppercase tracking-wider">
                    Voice Engine Active
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>

              {onLogout && (
                <button
                  onClick={() => {
                    if (onCloseMobile) onCloseMobile();
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
