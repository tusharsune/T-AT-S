import React, { useState, useEffect, useRef } from 'react';
import { AppView } from '../types';
import { TATSBackendAPI } from '../services/api';
import { TASLogoIcon } from './TASLogo';

interface HeaderProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenCommand: () => void;
  onOpenWizard: () => void;
  developer: {
    id?: string;
    name: string;
    email: string;
    phone?: string;
    is_admin?: boolean;
    is_verified?: boolean;
  } | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  applications: any[];
  activeAppId: string;
  onSelectApp: (app: any) => void;
  onOpenCreateApp: () => void;
  selectedServiceId?: string | null;
  onSelectService?: (serviceId: string | null) => void;
  isMobileNavOpen?: boolean;
  onToggleMobileNav?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenCommand,
  onOpenWizard,
  developer,
  onOpenAuth,
  onLogout,
  applications,
  activeAppId,
  onSelectApp,
  onOpenCreateApp,
  selectedServiceId,
  onSelectService,
  isMobileNavOpen,
  onToggleMobileNav
}) => {
  const [showMobileGuestMenu, setShowMobileGuestMenu] = useState(false);
  const mobileGuestMenuRef = useRef<HTMLDivElement>(null);
  const [showEnvDropdown, setShowEnvDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickstartModal, setShowQuickstartModal] = useState(false);
  const [quickstartLang, setQuickstartLang] = useState<'python' | 'node' | 'curl'>('python');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);

  const quickstartData = {
    python: {
      install: 'pip install tats-ai',
      code: `from tats import AcousticAgent

agent = AcousticAgent(api_key="tas_live_...")
response = agent.execute_voice(audio_stream)`
    },
    node: {
      install: 'npm i @tats/sdk',
      code: `import { AcousticAgent } from '@tats/sdk';

const agent = new AcousticAgent({ apiKey: 'tas_live_...' });
const response = await agent.executeVoice(audioStream);`
    },
    curl: {
      install: '# Zero install needed - standard cURL command',
      code: `curl -X POST https://api.tats.internal/v1/voice/execute \\
  -H "Authorization: Bearer tas_live_..." \\
  -F "audio=@recording.wav"`
    }
  };

  const handleCopyInstall = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };
  const [showServicesDropdown, setShowServicesDropdown] = useState(false);
  const servicesDropdownRef = useRef<HTMLDivElement>(null);

  // Dynamic Real Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Click Outside References
  const envDropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const activeApp = applications.find((a) => a.id === activeAppId) || applications[0];
  // Navigation handler for landing section anchors (About, Services, Pricing, Contact)
  const handleNavClick = (sectionId: string) => {
    if (currentView !== 'landing') {
      onNavigate('landing');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fetchNotifications = async () => {
    if (!developer) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    const res = await TATSBackendAPI.getNotifications();
    if (res) {
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    }
  };

  useEffect(() => {
    fetchNotifications();
    if (developer) {
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [developer]);

  // Click outside listener: Automatically closes header dropdowns when user clicks anywhere else
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showEnvDropdown && envDropdownRef.current && !envDropdownRef.current.contains(target)) {
        setShowEnvDropdown(false);
      }
      if (showNotifications && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
      if (showServicesDropdown && servicesDropdownRef.current && !servicesDropdownRef.current.contains(target)) {
        setShowServicesDropdown(false);
      }
      if (showMobileGuestMenu && mobileGuestMenuRef.current && !mobileGuestMenuRef.current.contains(target)) {
        setShowMobileGuestMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEnvDropdown, showNotifications, showUserMenu, showServicesDropdown]);

  const handleMarkAllRead = async () => {
    await TATSBackendAPI.markAllNotificationsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setTimeout(() => {
      setShowNotifications(false);
    }, 300);
  };

  const scrollToAnchor = (anchorId: string) => {
    if (currentView !== 'landing') {
      onNavigate('landing');
      setTimeout(() => {
        const el = document.getElementById(anchorId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-40 bg-[#FFFFFF]/85 backdrop-blur-xl border-b border-[#FFE6DC]/60 shadow-[0_1px_8px_rgba(30,27,36,0.03)]">
      <div className="h-16 w-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-max">
          {developer && currentView !== 'landing' && (
            <button
              onClick={onToggleMobileNav}
              className="lg:hidden p-1.5 -ml-1 rounded-xl text-[#57423D] hover:text-[#1D1A23] hover:bg-[#F3EBF8] transition-colors focus:outline-none cursor-pointer"
              aria-label="Toggle navigation drawer"
              title="Workspaces Menu"
            >
              <span className="material-symbols-outlined text-[24px]">
                {isMobileNavOpen ? 'close' : 'menu'}
              </span>
            </button>
          )}

          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate(developer ? 'developer-dashboard' : 'landing');
            }}
            aria-label="T@S home"
            className="group flex items-center gap-[8px] sm:gap-[12px] text-left focus:outline-none transition-transform duration-200 ease-out hover:scale-[1.03] motion-reduce:hover:scale-100"
          >
            <img
              src="/tas_final_logo_mark_small.svg"
              alt=""
              className="h-[32px] sm:h-[36px] md:h-[44px] w-auto aspect-square shrink-0 select-none object-contain"
            />
            <div className="flex flex-col justify-center leading-none select-none">
              <span className="font-['Plus_Jakarta_Sans',Outfit,sans-serif] font-extrabold text-[18px] sm:text-[20px] md:text-[22px] tracking-[0.12em] text-[#1a1520] leading-none">
                T<span className="text-[#ff6b4a]">@</span>S
              </span>
              <span className="font-['Plus_Jakarta_Sans',Outfit,sans-serif] text-[8px] sm:text-[9px] md:text-[9.5px] uppercase font-semibold tracking-[0.18em] sm:tracking-[0.2em] text-[#6b6470] leading-none mt-1">
                TALK · DECIDE · SOLVE
              </span>
            </div>
          </a>
        </div>

        {/* Header Center: Command Search when Logged-in / Clean Anchor Nav on Landing */}
        {developer && currentView !== 'landing' ? (
          <div className="hidden md:flex items-center flex-1 max-w-xs lg:max-w-md mx-2">
            <button
              onClick={onOpenCommand}
              className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-full bg-[#F3EBF8]/50 hover:bg-[#F3EBF8] border border-[#DEC0B9]/40 text-[#57423D] hover:text-[#1D1A23] transition-all text-xs font-medium group"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#A53B22]">search</span>
                <span>Search tools, routes, or commands...</span>
              </div>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-white/80 border border-[#DEC0B9]/60 text-[10px] font-mono text-[#57423D]">
                ⌘K
              </kbd>
            </button>
          </div>
        ) : (
          <div className="flex-1 flex justify-center">
            <nav className="hidden md:flex items-center gap-1 sm:gap-2 px-3 py-1 rounded-full bg-[#FAF9F6]/80 border border-[#FFE6DC]/60 backdrop-blur-xs">
              <button
                onClick={() => scrollToAnchor('features')}
                className="px-3 py-1 rounded-full text-xs font-semibold text-[#57423D] hover:text-[#A53B22] hover:bg-[#FFE6DC]/50 transition-all cursor-pointer"
              >
                Features
              </button>
              <button
                onClick={() => scrollToAnchor('architecture')}
                className="px-3 py-1 rounded-full text-xs font-semibold text-[#57423D] hover:text-[#A53B22] hover:bg-[#FFE6DC]/50 transition-all cursor-pointer"
              >
                Architecture
              </button>
              <button
                onClick={() => scrollToAnchor('quickstart')}
                className="px-3 py-1 rounded-full text-xs font-semibold text-[#57423D] hover:text-[#A53B22] hover:bg-[#FFE6DC]/50 transition-all cursor-pointer"
              >
                API &amp; SDK
              </button>
              <button
                onClick={() => scrollToAnchor('faq')}
                className="px-3 py-1 rounded-full text-xs font-semibold text-[#57423D] hover:text-[#A53B22] hover:bg-[#FFE6DC]/50 transition-all cursor-pointer"
              >
                FAQ
              </button>
            </nav>
          </div>
        )}


        {/* Status Indicators & Profile Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">

          {/* Real Application Cluster Selector Dropdown (When Logged In) */}
          {developer && (
            <div ref={envDropdownRef} className="relative">
              <button
                onClick={() => setShowEnvDropdown(!showEnvDropdown)}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F8F1FE] hover:bg-[#EDE5F2] border border-[#DEC0B9]/30 text-[#1D1A23] text-xs font-semibold transition-all shadow-[0_1px_4px_rgba(255,126,95,0.04)]"
              >
                <span className="material-symbols-outlined text-[#845400] text-[16px]">dns</span>
                <span className="truncate max-w-[170px]">{activeApp ? activeApp.app_name : 'No App Selected'}</span>
                <span className="material-symbols-outlined text-[16px] text-[#8B716B]">expand_more</span>
              </button>

              {showEnvDropdown && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-72 max-w-xs bg-white rounded-xl shadow-xl border border-[#FFE6DC] p-1.5 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-[#8B716B] uppercase font-['Outfit'] border-b border-[#FFE6DC]/50">
                    <span>Your App Clusters</span>
                    <span className="font-mono text-[#A53B22]">{applications.length} Active</span>
                  </div>
                  <div className="py-1 max-h-56 overflow-y-auto">
                    {applications.length === 0 ? (
                      <div className="px-3 py-3 text-center text-xs text-[#8B716B]">
                        No application clusters yet. Click below to provision one.
                      </div>
                    ) : (
                      applications.map((app) => (
                        <button
                          key={app.id}
                          onClick={() => {
                            onSelectApp(app);
                            setShowEnvDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                            activeApp?.id === app.id
                              ? 'bg-[#FFDAD2]/40 text-[#A53B22] font-semibold'
                              : 'hover:bg-[#FAF9F6] text-[#1D1A23]'
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-semibold">{app.app_name}</span>
                            <span className="font-mono text-[10px] text-[#8B716B] truncate">{app.api_key_prefix || 'tas_live_...'}</span>
                          </div>
                          {activeApp?.id === app.id && (
                            <span className="material-symbols-outlined text-[16px] text-[#A53B22]">check</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="pt-1 border-t border-[#FFE6DC]/60">
                    <button
                      onClick={() => {
                        setShowEnvDropdown(false);
                        onOpenCreateApp();
                      }}
                      className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#A53B22] hover:bg-[#FFDAD2]/30 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      <span>+ Create New Application</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wizard Launcher Icon Button (Logged In Only) */}
          {developer && (
            <button
              onClick={onOpenWizard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF7E5F]/15 to-[#FFAE33]/15 hover:from-[#FF7E5F]/25 hover:to-[#FFAE33]/25 text-[#A53B22] border border-[#FF7E5F]/30 text-xs font-semibold transition-all"
              title="Open End-User Setup Wizard"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span className="hidden sm:inline font-mono text-[11px]">&lt;TASWizard /&gt;</span>
            </button>
          )}

          {/* Dynamic Real Notifications Dropdown (Top 10 Notifications) */}
          {developer && (
            <div ref={notificationsRef} className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-full text-[#57423D] hover:text-[#1D1A23] hover:bg-[#F3EBF8] transition-colors"
                title="Real-Time Notifications"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-[#FF5F45] text-white text-[9px] font-bold font-mono">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-2xl border border-[#FFE6DC] p-3 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-[#FFE6DC]/60 mb-2">
                    <span className="text-xs font-bold text-[#1D1A23] font-['Outfit'] uppercase">
                      Notifications & Alerts
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-[#A53B22] hover:underline font-bold"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 text-xs max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-[#8B716B]">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            if (!notif.is_read) {
                              TATSBackendAPI.markNotificationRead(notif.id);
                              setNotifications((prev) =>
                                prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
                              );
                              setUnreadCount((c) => Math.max(0, c - 1));
                            }
                            if (notif.link) {
                              setShowNotifications(false);
                              if (notif.link.includes('billing') || notif.link.includes('pricing')) {
                                onNavigate('subscription-pricing');
                              } else {
                                onNavigate('developer-dashboard');
                              }
                            }
                          }}
                          className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                            notif.is_read
                              ? 'bg-[#FAF9F6] border-[#FFE6DC]/40 text-[#57423D] hover:bg-[#FAF9F6]/80'
                              : 'bg-[#FFF8EB] border-[#FDE047] text-[#1D1A23] hover:bg-[#FEF3C7]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-xs font-['Outfit']">{notif.title}</span>
                            <span className="text-[10px] text-[#8B716B] font-mono">
                              {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed line-clamp-2">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Complete History Link Footer */}
                  <div className="pt-2.5 border-t border-[#FFE6DC]/60 mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-[#8B716B]">
                      Showing top {Math.min(10, notifications.length)} of {notifications.length}
                    </span>
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        onNavigate('notifications');
                      }}
                      className="text-xs text-[#A53B22] hover:text-[#84240D] font-bold flex items-center gap-1 hover:underline"
                    >
                      <span>View All History</span>
                      <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Profile or Sign In Button */}
          {developer ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 pl-1.5 focus:outline-none group"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF7E5F] to-[#00C2FF] p-0.5 shadow-sm">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-xs text-[#A53B22] uppercase">
                    {developer.name ? developer.name.slice(0, 2) : 'DV'}
                  </div>
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-[#1D1A23] leading-none group-hover:text-[#A53B22] transition-colors">
                    {developer.name}
                  </span>
                  <span className="text-[10px] text-[#57423D] leading-none mt-1 font-mono">
                    {developer.is_admin ? 'Admin' : 'Developer'}
                  </span>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-[#FFE6DC] p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-[#FFE6DC]/50">
                    <p className="text-xs font-bold text-[#1D1A23]">{developer.name}</p>
                    <p className="text-[11px] text-[#57423D] truncate">{developer.email}</p>
                    {developer.phone && (
                      <p className="text-[10px] text-[#8B716B] font-mono">{developer.phone}</p>
                    )}
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavigate('notifications');
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#1D1A23] hover:bg-[#F8F1FE] rounded-lg flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[15px] text-[#A53B22]">notifications</span>
                        <span>Notifications History</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#FF5F45] text-white text-[9px] font-bold font-mono">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenCreateApp();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#1D1A23] hover:bg-[#F8F1FE] rounded-lg flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[15px] text-[#006688]">add_circle</span>
                      <span>New Application</span>
                    </button>
                    <button
                      onClick={() => {
                        onNavigate('developer-dashboard');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#1D1A23] hover:bg-[#F8F1FE] rounded-lg flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[15px] text-[#A53B22]">dashboard</span>
                      <span>Workspace Dashboard</span>
                    </button>

                    <button
                      onClick={() => {
                        onNavigate('subscription-pricing');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#1D1A23] hover:bg-[#F8F1FE] rounded-lg flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[15px] text-[#006688]">payments</span>
                      <span>Subscription & Plans</span>
                    </button>

                    {/* ONLY VISIBLE TO DESIGNATED PLATFORM ADMIN */}
                    {developer.is_admin && (
                      <button
                        onClick={() => {
                          onNavigate('super-admin');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-[#845400] font-bold hover:bg-[#FFF8EB] rounded-lg flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[15px] text-[#845400]">admin_panel_settings</span>
                        <span>Platform Governance</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onNavigate('settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#1D1A23] hover:bg-[#F8F1FE] rounded-lg flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[15px] text-[#A53B22]">settings</span>
                      <span>Account & Agent Settings</span>
                    </button>

                    <div className="my-1 border-t border-[#FFE6DC]/60"></div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 font-semibold"
                    >
                      <span className="material-symbols-outlined text-[15px] text-red-600">logout</span>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Desktop Nav Actions (>= md) */}
              <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
                {/* About Button */}
                <button
                  onClick={() => onNavigate('about')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                    currentView === 'about'
                      ? 'border-[#A53B22] text-[#A53B22] bg-white shadow-xs'
                      : 'border-[#DEC0B9]/60 hover:border-[#A53B22] text-[#57423D] hover:text-[#A53B22] bg-[#FAF9F6]'
                  }`}
                  title="About T@S, our mission and benefits"
                >
                  <span>About</span>
                </button>

                {/* Contact Button */}
                <button
                  onClick={() => handleNavClick('contact')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#DEC0B9]/60 hover:border-[#A53B22] text-[#57423D] hover:text-[#A53B22] text-xs font-semibold bg-[#FAF9F6] transition-all cursor-pointer"
                  title="Contact the T@S Team"
                >
                  <span>Contact</span>
                </button>

                {/* Services Button with Dropdown */}
                <div ref={servicesDropdownRef} className="relative">
                  <button
                    onClick={() => setShowServicesDropdown(!showServicesDropdown)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                      currentView === 'services' || showServicesDropdown
                        ? 'border-[#A53B22] text-[#A53B22] bg-white shadow-xs'
                        : 'border-[#DEC0B9]/60 hover:border-[#A53B22] text-[#57423D] hover:text-[#A53B22] bg-[#FAF9F6]'
                    }`}
                    title="Explore T@S Services & Capabilities"
                  >
                    <span>Services</span>
                    <span className={`material-symbols-outlined text-[15px] transition-transform duration-200 ${showServicesDropdown ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>

                {showServicesDropdown && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-xs bg-white rounded-2xl shadow-2xl border border-[#FFE6DC] p-2 z-50 animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto">
                    <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-[#8B716B] uppercase tracking-wider border-b border-[#FFE6DC]/60 mb-1">
                      <span>Platform Services</span>
                      <span className="font-mono text-[10px] text-[#A53B22]">6 Architectures</span>
                    </div>
                    <div className="space-y-1">
                      {[
                        {
                          id: 'telephony',
                          title: 'Phone & Web Calls',
                          desc: 'SIP trunks, WebRTC & sub-850ms audio',
                          icon: 'call'
                        },
                        {
                          id: 'voice_synthesis',
                          title: 'Custom AI Voices',
                          desc: 'Natural brand voices ready in 6 seconds',
                          icon: 'graphic_eq'
                        },
                        {
                          id: 'tool_calling',
                          title: 'Automated API Calling',
                          desc: 'Deterministic tool execution without guessing',
                          icon: 'build'
                        },
                        {
                          id: 'cluster_isolation',
                          title: 'Private by Default',
                          desc: 'Air-gapped VPCs & in-memory audio buffers',
                          icon: 'security'
                        },
                        {
                          id: 'telemetry_metering',
                          title: 'Action Unit Accounting',
                          desc: 'Fair billing with automatic session cleanup',
                          icon: 'speed'
                        },
                        {
                          id: 'developer_sdk',
                          title: 'Developer SDKs & Templates',
                          desc: 'FastAPI, Django, Express & React libraries',
                          icon: 'terminal'
                        }
                      ].map((svc) => {
                        const isActive = currentView === 'services' && selectedServiceId === svc.id;
                        return (
                          <button
                            key={svc.id}
                            onClick={() => {
                              setShowServicesDropdown(false);
                              if (onSelectService) {
                                onSelectService(svc.id);
                              } else {
                                localStorage.setItem('tats_selected_service', svc.id);
                                window.dispatchEvent(new CustomEvent('tats_service_selected', { detail: svc.id }));
                                onNavigate('services');
                              }
                            }}
                            className={`w-full text-left p-2 rounded-xl transition-colors flex items-start justify-between gap-2.5 group cursor-pointer ${
                              isActive
                                ? 'bg-[#FFF6F3] border border-[#FFDAD2]'
                                : 'hover:bg-[#FAF9F6] border border-transparent'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${
                                isActive ? 'text-[#A53B22]' : 'text-[#8B716B] group-hover:text-[#A53B22]'
                              }`}>
                                {svc.icon}
                              </span>
                              <div className="min-w-0">
                                <div className={`text-xs font-bold truncate ${
                                  isActive ? 'text-[#A53B22]' : 'text-[#1D1A23] group-hover:text-[#A53B22]'
                                }`}>
                                  {svc.title}
                                </div>
                                <div className="text-[11px] text-[#57423D] truncate">{svc.desc}</div>
                              </div>
                            </div>
                            {isActive && (
                              <span className="material-symbols-outlined text-[16px] text-[#A53B22] shrink-0 mt-0.5">check</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-2 pt-2 border-t border-[#FFE6DC]">
                      <button
                        onClick={() => {
                          setShowServicesDropdown(false);
                          if (onSelectService) {
                            onSelectService(null);
                          } else {
                            localStorage.removeItem('tats_selected_service');
                            window.dispatchEvent(new CustomEvent('tats_service_selected', { detail: null }));
                            onNavigate('services');
                          }
                        }}
                        className={`w-full text-center py-2 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                          currentView === 'services' && !selectedServiceId
                            ? 'bg-[#A53B22] text-white shadow-xs'
                            : 'bg-[#FAF9F6] hover:bg-[#F3EBF8] text-[#A53B22]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">grid_view</span>
                        <span>Explore All Services Catalog</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Useful In-App SDK Quickstart Button */}
              <button
                onClick={() => setShowQuickstartModal(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F6] hover:bg-[#F3EBF8] border border-[#DEC0B9]/60 hover:border-[#A53B22] text-[#57423D] hover:text-[#1D1A23] text-xs font-semibold transition-all shadow-xs cursor-pointer"
                title="View SDK installation and quickstart guide"
              >
                <span className="material-symbols-outlined text-[15px] text-[#A53B22]">terminal</span>
                <span>SDK Quickstart</span>
              </button>

              {/* Plans Button */}
              <button
                onClick={() => {
                  if (currentView !== 'landing') {
                    onNavigate('landing');
                    setTimeout(() => {
                      const el = document.getElementById('pricing');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  } else {
                    const pricingEl = document.getElementById('pricing');
                    if (pricingEl) {
                      pricingEl.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      onNavigate('subscription-pricing');
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#DEC0B9]/60 hover:border-[#A53B22] text-[#57423D] hover:text-[#A53B22] text-xs font-semibold bg-[#FAF9F6] transition-all cursor-pointer"
                title="View Transparent Pricing Plans"
              >
                <span className="material-symbols-outlined text-[15px] text-[#A53B22]">payments</span>
                <span>Plans</span>
              </button>
            </div>

            {/* Sign In Button (Visible on all screens) */}
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] text-white text-xs font-bold shadow-sm shadow-[#FF5F45]/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">login</span>
              <span>Sign In</span>
            </button>

            {/* Mobile Guest Menu Toggle (< md) */}
            <div ref={mobileGuestMenuRef} className="relative md:hidden">
              <button
                onClick={() => setShowMobileGuestMenu(!showMobileGuestMenu)}
                className="p-1.5 rounded-xl text-[#57423D] hover:text-[#1D1A23] hover:bg-[#F3EBF8] transition-colors cursor-pointer"
                aria-label="Toggle navigation menu"
              >
                <span className="material-symbols-outlined text-[24px]">
                  {showMobileGuestMenu ? 'close' : 'menu'}
                </span>
              </button>

              {showMobileGuestMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-[#FFE6DC] p-2.5 z-50 animate-in fade-in zoom-in-95 flex flex-col gap-1 max-h-[80vh] overflow-y-auto">
                  <button
                    onClick={() => { setShowMobileGuestMenu(false); onNavigate('about'); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#FAF9F6] text-[#1D1A23] flex items-center gap-2.5"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#A53B22]">info</span>
                    <span>About T@S Platform</span>
                  </button>
                  <button
                    onClick={() => { setShowMobileGuestMenu(false); onNavigate('services'); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#FAF9F6] text-[#1D1A23] flex items-center gap-2.5"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#A53B22]">grid_view</span>
                    <span>Services & Architectures</span>
                  </button>
                  <button
                    onClick={() => { setShowMobileGuestMenu(false); scrollToAnchor('features'); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#FAF9F6] text-[#1D1A23] flex items-center gap-2.5"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#A53B22]">featured_play_list</span>
                    <span>Features</span>
                  </button>
                  <button
                    onClick={() => { setShowMobileGuestMenu(false); scrollToAnchor('architecture'); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#FAF9F6] text-[#1D1A23] flex items-center gap-2.5"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#A53B22]">hub</span>
                    <span>Architecture & Latency</span>
                  </button>
                  <button
                    onClick={() => { setShowMobileGuestMenu(false); scrollToAnchor('quickstart'); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#FAF9F6] text-[#1D1A23] flex items-center gap-2.5"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#A53B22]">code</span>
                    <span>API & SDK</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileGuestMenu(false);
                      if (currentView !== 'landing') {
                        onNavigate('landing');
                        setTimeout(() => {
                          const el = document.getElementById('pricing');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      } else {
                        const el = document.getElementById('pricing');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#FAF9F6] text-[#1D1A23] flex items-center gap-2.5"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#A53B22]">payments</span>
                    <span>Plans & Pricing</span>
                  </button>
                  <button
                    onClick={() => { setShowMobileGuestMenu(false); handleNavClick('contact'); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#FAF9F6] text-[#1D1A23] flex items-center gap-2.5"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#A53B22]">mail</span>
                    <span>Contact Team</span>
                  </button>
                  <div className="pt-2 border-t border-[#FFE6DC]/60 mt-1 flex flex-col gap-1.5">
                    <button
                      onClick={() => { setShowMobileGuestMenu(false); setShowQuickstartModal(true); }}
                      className="w-full text-center py-2 text-xs font-bold rounded-xl bg-[#FAF9F6] text-[#57423D] border border-[#DEC0B9]/60 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#A53B22]">terminal</span>
                      <span>SDK Quickstart</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Useful Interactive SDK Quickstart Modal (Streamlined & Simple) */}
      {showQuickstartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="fixed inset-0" onClick={() => setShowQuickstartModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#FFE6DC] p-6 sm:p-7 z-10 animate-in zoom-in-95">
            {/* Header: Title + Language Switcher */}
            <div className="flex flex-wrap items-center justify-between pb-3.5 border-b border-[#FFE6DC] gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#A53B22]/10 text-[#A53B22] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">terminal</span>
                </div>
                <div>
                  <h3 className="font-['Outfit'] font-bold text-base text-[#1D1A23]">Quickstart</h3>
                  <p className="text-[11px] text-[#8B716B]">Run in 2 quick steps</p>
                </div>
              </div>

              {/* Language Pills (Python / Node / cURL) */}
              <div className="flex items-center gap-1 p-0.5 bg-[#FAF9F6] border border-[#DEC0B9]/60 rounded-full">
                {(['python', 'node', 'curl'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setQuickstartLang(lang)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      quickstartLang === lang
                        ? 'bg-[#1D1A23] text-white shadow-xs'
                        : 'text-[#57423D] hover:text-[#1D1A23]'
                    }`}
                  >
                    {lang === 'python' ? 'Python' : lang === 'node' ? 'Node.js' : 'cURL'}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean 2-Step Content (No over-content) */}
            <div className="mt-4 space-y-4">
              {/* Step 1: Install */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-['Outfit'] font-bold text-xs text-[#1D1A23]">
                    1. Install Package
                  </span>
                  <span className="text-[10px] text-[#8B716B]">
                    {quickstartLang === 'curl' ? 'Zero dependencies' : 'Official SDK'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#191720] text-[#FAF9F6] font-mono text-xs border border-white/10">
                  <span className="truncate">{quickstartData[quickstartLang].install}</span>
                  {quickstartLang !== 'curl' && (
                    <button
                      onClick={() => handleCopyInstall(quickstartData[quickstartLang].install)}
                      className="ml-2 flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[#FAF9F6] text-[11px] font-sans font-bold transition-colors cursor-pointer"
                      title="Copy install command"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {copiedInstall ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedInstall ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Step 2: Code Snippet */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-['Outfit'] font-bold text-xs text-[#1D1A23]">
                    2. Execute Voice Stream
                  </span>
                  <button
                    onClick={() => handleCopySnippet(quickstartData[quickstartLang].code)}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#A53B22] hover:text-[#1D1A23] transition-colors cursor-pointer"
                    title="Copy code to clipboard"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copiedSnippet ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedSnippet ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#191720] text-[#FAF9F6] font-mono text-xs border border-white/10 overflow-x-auto leading-relaxed shadow-inner">
                  <pre className="text-[11.5px] leading-relaxed">
                    {quickstartData[quickstartLang].code}
                  </pre>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-5 pt-3.5 border-t border-[#FFE6DC] flex items-center justify-between">
              <button
                onClick={() => {
                  setShowQuickstartModal(false);
                  onNavigate('live-voice-playground');
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-[#A53B22] hover:text-[#1D1A23] transition-colors cursor-pointer"
              >
                <span>Try Voice in Playground</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>

              <button
                onClick={() => setShowQuickstartModal(false)}
                className="px-4 py-1.5 rounded-full bg-[#1D1A23] hover:bg-[#342F3E] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
