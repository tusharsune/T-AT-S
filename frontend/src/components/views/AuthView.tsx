import { TASLogoIcon } from '../TASLogo';
import React, { useState, useEffect, useRef } from 'react';
import { TATSBackendAPI } from '../../services/api';

interface AuthViewProps {
  onAuthSuccess: (developer: any) => void;
  onReturnHome: () => void;
  initialMode?: 'signin' | 'register';
  bannerNotice?: string;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onAuthSuccess,
  onReturnHome,
  initialMode = 'signin',
  bannerNotice = '',
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'register' | 'admin'>(initialMode);
  const [step, setStep] = useState<'form' | 'otp' | 'recover_email'>('form');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  // Forgot Email State
  const [recoverPhone, setRecoverPhone] = useState('');
  const [recoveredEmail, setRecoveredEmail] = useState<string | null>(null);
  const [recoveredName, setRecoveredName] = useState<string | null>(null);

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState(bannerNotice);
  const [isFirstUserAdmin, setIsFirstUserAdmin] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Check system status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      const status = await TATSBackendAPI.checkSystemStatus();
      if (status) {
        setIsFirstUserAdmin(Boolean(status.first_user_becomes_admin));
        if (status.first_user_becomes_admin && !bannerNotice) {
          setSuccessMessage('Welcome to T@S! The first registered account automatically becomes the Platform Administrator.');
        }
      }
    };
    fetchStatus();
  }, [bannerNotice]);

  // OTP cooldown countdown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Clean messages when inputs change
  useEffect(() => {
    setErrorMessage('');
  }, [email, phone, name, password, activeTab, recoverPhone]);

  // Indian Phone validator (+91 10-digit)
  const validateIndianPhone = (raw: string): boolean => {
    const cleaned = raw.replace(/[\s\-()]/g, '');
    return /^(?:(?:\+|0{0,2})91)?[6789]\d{9}$/.test(cleaned);
  };

  // ==========================================
  // Passwordless Login: Request OTP
  // ==========================================
  const handleRequestLoginOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid developer email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await TATSBackendAPI.loginRequestOTP(cleanEmail);
      if (res.ok) {
        setStep('otp');
        setOtpCooldown(30);
        setSuccessMessage(`A 6-digit login verification code has been dispatched to ${cleanEmail}.`);
      } else {
        setErrorMessage(res.data.error || 'Failed to send login code. Please check your email or create an account.');
      }
    } catch {
      setErrorMessage('Unable to connect to the backend server. Please verify Django is running.');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // Admin / Superuser Login with Password
  // ==========================================
  const handleAdminPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your administrator email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await TATSBackendAPI.login(cleanEmail, password);
      if (res.ok && res.data.developer) {
        onAuthSuccess(res.data.developer);
      } else {
        setErrorMessage(res.data.error || 'Invalid administrator credentials. Please check your email and password.');
      }
    } catch {
      setErrorMessage('Network error during administrator authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // Registration: Request OTP
  // ==========================================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!validateIndianPhone(cleanPhone)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g. +91 9876543210 or 9876543210).');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await TATSBackendAPI.register(cleanName, cleanEmail, cleanPhone, password || undefined);
      if (res.ok) {
        setStep('otp');
        setOtpCooldown(30);
        setSuccessMessage(`Account initialized. Enter the 6-digit verification code sent to ${cleanEmail}.`);
      } else {
        setErrorMessage(res.data.error || res.data.message || 'Registration failed. Please review your details.');
      }
    } catch {
      setErrorMessage('Unable to connect to the backend server. Please verify Django is running.');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // Verify OTP
  // ==========================================
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('').trim();
    if (fullOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    const purpose = activeTab === 'signin' ? 'LOGIN' : 'REGISTER';

    try {
      const res = await TATSBackendAPI.verifyOTP(email.trim().toLowerCase(), fullOtp, purpose);
      if (res.ok && res.data.developer) {
        onAuthSuccess(res.data.developer);
      } else {
        setErrorMessage(res.data.error || 'Invalid or expired 6-digit code. Please try again or request a new code.');
      }
    } catch {
      setErrorMessage('Network connection error while verifying code.');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // Recover Registered Email via Phone
  // ==========================================
  const handleRecoverEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateIndianPhone(recoverPhone)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setRecoveredEmail(null);

    try {
      const res = await TATSBackendAPI.recoverEmail(recoverPhone);
      if (res.ok && res.data.email) {
        setRecoveredEmail(res.data.email);
        setRecoveredName(res.data.name);
      } else {
        setErrorMessage(res.data.error || 'No registered account found with this mobile number.');
      }
    } catch {
      setErrorMessage('Failed to connect to recovery service.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (otpCooldown > 0) return;
    setIsLoading(true);
    setErrorMessage('');

    const purpose = activeTab === 'signin' ? 'LOGIN' : 'REGISTER';

    try {
      const res = await TATSBackendAPI.resendOTP(email.trim().toLowerCase(), purpose);
      if (res.ok) {
        setOtpCooldown(30);
        setSuccessMessage(`A fresh 6-digit verification code was dispatched to ${email}.`);
      } else {
        setErrorMessage(res.data.error || 'Failed to resend code.');
      }
    } catch {
      setErrorMessage('Network error while requesting new code.');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Box inputs handler
  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[index] = val.slice(-1);
    setOtp(newOtp);

    if (val && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1D1A23] flex flex-col font-['Manrope'] selection:bg-[#FF7E5F]/20 selection:text-[#721702]">
      {/* Top Navbar */}
      <header className="h-16 px-6 sm:px-10 border-b border-[#FFE6DC]/60 flex items-center justify-between bg-white/85 backdrop-blur-xl z-20 shadow-[0_1px_8px_rgba(30,27,36,0.03)]">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onReturnHome();
          }}
          aria-label="T@S home"
          className="group flex items-center gap-[12px] text-left focus:outline-none transition-transform duration-200 ease-out hover:scale-[1.04] motion-reduce:hover:scale-100"
        >
          <img
            src="/tas_final_logo_mark_small.svg"
            alt=""
            className="h-[36px] md:h-[44px] w-auto aspect-square shrink-0 select-none object-contain"
          />
          <div className="flex flex-col justify-center leading-none select-none">
            <span className="font-['Plus_Jakarta_Sans',Outfit,sans-serif] font-extrabold text-[20px] md:text-[22px] tracking-[0.12em] text-[#1a1520] leading-none">
              T<span className="text-[#ff6b4a]">@</span>S
            </span>
            <span className="font-['Plus_Jakarta_Sans',Outfit,sans-serif] text-[9px] md:text-[9.5px] uppercase font-semibold tracking-[0.2em] text-[#6b6470] leading-none mt-1">
              TALK · DECIDE · SOLVE
            </span>
          </div>
        </a>

        <button
          onClick={onReturnHome}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white hover:bg-[#F3EBF8] border border-[#DEC0B9]/60 text-xs font-bold text-[#57423D] hover:text-[#1D1A23] transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Return to Home</span>
        </button>
      </header>

      {/* Main Split Layout in Main UI Warm Theme */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Brand Showcase & Human-Feel Image Space (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col justify-center space-y-6 lg:pr-6">
          <div>
            <h1 className="font-['Outfit'] font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1D1A23] leading-tight">
              Talk. Decide. Solve.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-[#57423D] max-w-xl leading-relaxed">
              Universal AI Voice Agents engineered with zero-hallucination deterministic action routing, sub-100ms ultra-low latency, and cryptographically verified execution.
            </p>
          </div>

          {/* =========================================================================
              HIGH-QUALITY HUMAN-FEEL BRAND IMAGE SHOWCASE CONTAINER
              Dedicated space for your high-res human-feel brand asset in main UI theme.
              Replace the placeholder inside with: <img src="/your-image.png" alt="Human Voice AI" />
             ========================================================================= */}
          <div className="relative rounded-3xl border border-[#FFE6DC] bg-white p-6 shadow-xl shadow-[#FFE6DC]/40 overflow-hidden">
            <div className="relative z-10 flex flex-col items-center text-center py-6 px-4">
              {/* Graphic / Photo Frame */}
              <div className="w-full max-w-md h-56 rounded-2xl border-2 border-dashed border-[#FFDAD2] bg-[#FFF8F6] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                {/* Voice waveform simulation */}
                <div className="flex items-center gap-1.5 mb-4">
                  {[24, 40, 68, 88, 52, 76, 96, 64, 48, 80, 56, 32].map((height, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-gradient-to-t from-[#FF7E5F] to-[#FFAE33]"
                      style={{ height: `${height * 0.45}px` }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#FFE6DC] text-[11px] font-semibold text-[#A53B22] shadow-sm">
                  <span className="material-symbols-outlined text-[15px] text-[#FF7E5F]">record_voice_over</span>
                  <span>Human Resonance & Voice Intelligence</span>
                </div>

                <p className="mt-3 text-xs text-[#8B716B] max-w-xs">
                  Space reserved for your high-resolution brand image asset (human voice engineer, acoustic portrait, or product graphic).
                </p>
              </div>

              {/* Verified Platform Capabilities */}
              <div className="grid grid-cols-3 gap-3 w-full mt-6 pt-5 border-t border-[#FFE6DC]">
                <div className="flex flex-col items-center text-center">
                  <span className="font-['Outfit'] font-extrabold text-lg sm:text-xl text-[#1D1A23]">10,000+</span>
                  <span className="text-[10px] text-[#8B716B] uppercase font-bold tracking-wider mt-0.5">Daily Operations</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <span className="font-['Outfit'] font-extrabold text-lg sm:text-xl text-[#A53B22]">&lt;85ms</span>
                  <span className="text-[10px] text-[#8B716B] uppercase font-bold tracking-wider mt-0.5">P99 Latency</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <span className="font-['Outfit'] font-extrabold text-lg sm:text-xl text-emerald-700">100%</span>
                  <span className="text-[10px] text-[#8B716B] uppercase font-bold tracking-wider mt-0.5">Secure OTP</span>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonial Quote */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FFF8EB] border border-[#FDE047] text-xs text-[#854D0E]">
            <span className="material-symbols-outlined text-[#CA8A04] text-[20px]">verified</span>
            <span>
              <strong>Deterministic Voice Logic:</strong> Conversational voice turns straight into verified real-world backend executions without hallucination.
            </span>
          </div>
        </section>

        {/* Right Column: Authentication Card (5 Cols) */}
        <section className="lg:col-span-5 w-full">
          <div className="bg-white border border-[#FFE6DC] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#FFE6DC]/50 relative overflow-hidden">
            {/* Header / Admin Banner */}
            {isFirstUserAdmin && (
              <div className="mb-5 p-3 rounded-2xl bg-[#FFF8EB] border border-[#FDE047] text-[#854D0E] flex items-center gap-2.5 text-xs font-semibold">
                <span className="material-symbols-outlined text-[#CA8A04] text-[18px]">admin_panel_settings</span>
                <span>Initial Platform Setup: The first account becomes Platform Administrator.</span>
              </div>
            )}

            {/* Tab Switcher (Sign In OTP vs Register vs Admin Password) */}
            {step === 'form' && (
              <div className="flex items-center p-1 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] mb-5">
                <button
                  type="button"
                  onClick={() => { setActiveTab('signin'); setErrorMessage(''); }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'signin'
                      ? 'bg-white text-[#A53B22] shadow-sm'
                      : 'text-[#8B716B] hover:text-[#1D1A23]'
                  }`}
                >
                  Sign In (OTP)
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setErrorMessage(''); }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'register'
                      ? 'bg-white text-[#A53B22] shadow-sm'
                      : 'text-[#8B716B] hover:text-[#1D1A23]'
                  }`}
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('admin'); setErrorMessage(''); }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'admin'
                      ? 'bg-white text-[#A53B22] shadow-sm'
                      : 'text-[#8B716B] hover:text-[#1D1A23]'
                  }`}
                  title="Sign in with administrator password"
                >
                  Admin Login
                </button>
              </div>
            )}

            {/* Compact Inline Alert (No layout shifts, never hides buttons) */}
            {errorMessage ? (
              <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-in fade-in">
                <span className="material-symbols-outlined text-[16px] text-red-600">error</span>
                <span className="truncate">{errorMessage}</span>
              </div>
            ) : successMessage ? (
              <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-in fade-in">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                <span className="truncate">{successMessage}</span>
              </div>
            ) : null}

            {/* ======================================================== */}
            {/* STEP 1A: SIGN IN FORM (STRICTLY EMAIL + OTP) */}
            {/* ======================================================== */}
            {step === 'form' && activeTab === 'signin' && (
              <form onSubmit={handleRequestLoginOTP} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#1D1A23] font-['Outfit']">
                      Developer Email Address
                    </label>
                    <button
                      type="button"
                      onClick={() => { setStep('recover_email'); setErrorMessage(''); }}
                      className="text-[11px] text-[#A53B22] hover:underline font-semibold"
                    >
                      Forgot Registered Email?
                    </button>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#8B716B]">
                      mail
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="engineer@company.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-[#1D1A23] placeholder-[#8B716B] text-xs focus:outline-none focus:border-[#A53B22] transition-colors"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#8B716B]">
                    A 6-digit authentication code will be dispatched to your inbox. No passwords required.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] text-white text-xs font-bold shadow-md shadow-[#FF5F45]/20 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span>Send 6-Digit Login Code</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ======================================================== */}
            {/* STEP 1B: ADMIN LOGIN (EMAIL + PASSWORD CREATED IN SUPERUSER) */}
            {/* ======================================================== */}
            {step === 'form' && activeTab === 'admin' && (
              <form onSubmit={handleAdminPasswordLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#1D1A23] font-['Outfit'] mb-1">
                    Administrator Email
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#8B716B]">
                      admin_panel_settings
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@tats.ai"
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-[#1D1A23] placeholder-[#8B716B] text-xs focus:outline-none focus:border-[#A53B22] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1D1A23] font-['Outfit'] mb-1">
                    Password (Created during Superuser / Admin Setup)
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#8B716B]">
                      lock
                    </span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-[#1D1A23] placeholder-[#8B716B] text-xs focus:outline-none focus:border-[#A53B22] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span>Sign In as Platform Administrator</span>
                      <span className="material-symbols-outlined text-[18px]">verified_user</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ======================================================== */}
            {/* STEP 1C: FORGOT EMAIL RECOVERY (BY INDIAN PHONE) */}
            {/* ======================================================== */}
            {step === 'recover_email' && (
              <form onSubmit={handleRecoverEmail} className="space-y-4 animate-in fade-in">
                <div className="text-center pb-1">
                  <div className="w-10 h-10 rounded-xl bg-[#FF7E5F]/15 text-[#A53B22] mx-auto flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-[20px]">phone_iphone</span>
                  </div>
                  <h3 className="text-sm font-bold text-[#1D1A23] font-['Outfit']">Recover Registered Email</h3>
                  <p className="text-[11px] text-[#8B716B] mt-0.5">
                    Enter your registered Indian mobile number to find your account email.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1D1A23] font-['Outfit'] mb-1">
                    Registered Indian Mobile (+91)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 flex items-center gap-1 text-xs font-bold text-[#A53B22] font-mono select-none pointer-events-none">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      value={recoverPhone}
                      onChange={(e) => setRecoverPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full pl-16 pr-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-mono text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
                    />
                  </div>
                </div>

                {recoveredEmail && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 animate-in fade-in">
                    <p className="font-bold">Account Found for {recoveredName}:</p>
                    <p className="font-mono text-sm text-[#A53B22] font-bold mt-1">{recoveredEmail}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(recoveredEmail);
                        setStep('form');
                        setActiveTab('signin');
                      }}
                      className="mt-2.5 w-full py-2 rounded-xl bg-[#A53B22] text-white text-xs font-bold shadow-sm"
                    >
                      Sign In with this Email →
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setStep('form'); setRecoveredEmail(null); }}
                    className="flex-1 py-2 rounded-full border border-[#DEC0B9] text-xs font-bold text-[#57423D] hover:bg-[#FAF9F6]"
                  >
                    Back to Sign In
                  </button>
                  {!recoveredEmail && (
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2 rounded-full bg-[#A53B22] text-white text-xs font-bold shadow-sm hover:opacity-90 disabled:opacity-50"
                    >
                      {isLoading ? 'Searching...' : 'Find Email'}
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* ======================================================== */}
            {/* STEP 1D: REGISTER FORM (NAME + INDIAN PHONE + EMAIL) */}
            {/* ======================================================== */}
            {step === 'form' && activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#1D1A23] font-['Outfit'] mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#8B716B]">
                      person
                    </span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rohan Sharma"
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] placeholder-[#8B716B] focus:outline-none focus:border-[#A53B22]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1D1A23] font-['Outfit'] mb-1">
                    Indian Mobile Number
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 flex items-center gap-1 text-xs font-bold text-[#A53B22] font-mono select-none pointer-events-none">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full pl-16 pr-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-mono text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1D1A23] font-['Outfit'] mb-1">
                    Official Email Address
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#8B716B]">
                      mail
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rohan@techcorp.in"
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] placeholder-[#8B716B] focus:outline-none focus:border-[#A53B22]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1D1A23] font-['Outfit'] mb-1">
                    Password (Optional)
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#8B716B]">
                      lock
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Optional strong password"
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] placeholder-[#8B716B] focus:outline-none focus:border-[#A53B22]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] text-white text-xs font-bold shadow-md shadow-[#FF5F45]/20 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span>{isFirstUserAdmin ? 'Initialize Platform Admin & Send OTP' : 'Register & Send Verification OTP'}</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ======================================================== */}
            {/* STEP 2: 6-DIGIT OTP VERIFICATION SCREEN */}
            {/* ======================================================== */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-5 animate-in fade-in">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFDAD2] text-[#A53B22] mx-auto flex items-center justify-center mb-2.5">
                    <span className="material-symbols-outlined text-[24px]">mark_email_read</span>
                  </div>
                  <h3 className="text-base font-bold text-[#1D1A23] font-['Outfit']">Verify 6-Digit Code</h3>
                  <p className="text-xs text-[#57423D] mt-0.5">
                    Enter the code sent to <strong className="text-[#A53B22]">{email}</strong>
                  </p>
                  {email.toLowerCase().includes('demo@tats.ai') && (
                    <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono">
                      ⚡ QA Reviewer Demo Code: <strong>123456</strong>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="text-[11px] text-[#A53B22] hover:underline font-semibold mt-1"
                  >
                    Change Email Address
                  </button>
                </div>

                {/* 6 Digit Input Boxes */}
                <div className="flex justify-center gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpInputsRef.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-10 h-12 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-center text-lg font-bold font-mono text-[#1D1A23] focus:outline-none focus:border-[#A53B22] transition-all"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.join('').length !== 6}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] text-white text-xs font-bold shadow-md shadow-[#FF5F45]/20 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {isLoading ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span>Verify & Enter Console</span>
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </>
                  )}
                </button>

                {/* Resend Action */}
                <div className="text-center pt-2 border-t border-[#FFE6DC]">
                  {otpCooldown > 0 ? (
                    <span className="text-xs text-[#8B716B] font-mono">
                      Resend code in {otpCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      className="text-xs text-[#A53B22] hover:underline font-bold"
                    >
                      Resend 6-Digit Code
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Footer Guarantee */}
            <div className="mt-5 pt-3 border-t border-[#FFE6DC] flex items-center justify-between text-[11px] text-[#8B716B]">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                <span>SHA-256 Encrypted</span>
              </span>
              <span className="font-mono">Real-time Verified</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
