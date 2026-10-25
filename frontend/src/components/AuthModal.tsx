import React, { useState, useEffect } from 'react';
import { TATSBackendAPI } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (developer: any) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning') => void;
  initialMode?: 'login' | 'register';
  bannerNotice?: string;
}

type AuthMode = 'login' | 'register' | 'verify_otp' | 'forgot_password' | 'reset_password';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onShowToast,
  initialMode = 'login',
  bannerNotice
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [systemStatus, setSystemStatus] = useState<{
    is_initialized: boolean;
    admin_exists: boolean;
    first_user_becomes_admin: boolean;
  } | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'REGISTER' | 'LOGIN' | 'FORGOT_PASSWORD'>('REGISTER');

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Check system status on mount/open
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMessage('');
      TATSBackendAPI.checkSystemStatus().then((status) => {
        if (status) setSystemStatus(status);
      });
    }
  }, [isOpen, initialMode]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Indian Phone Validator
  const isIndianPhoneValid = (val: string): boolean => {
    const cleaned = val.replace(/[\s\-\(\)]/g, '');
    return /^(?:(?:\+|0{0,2})91(\s*[\-]\s*)?|[0]?)?([6789]\d{9})$/.test(cleaned);
  };

  // Password Strength Check
  const getPasswordCriteria = (pwd: string) => ({
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /\d/.test(pwd),
    special: /[@$!%*?&#^_\-+=]/.test(pwd),
  });

  const pwdCriteria = getPasswordCriteria(password);
  const isPasswordStrong = Object.values(pwdCriteria).every(Boolean);

  // ==========================================
  // Form Submission Handlers
  // ==========================================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!isIndianPhoneValid(phone)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g., 9876543210 or +91 9876543210).');
      return;
    }
    if (!isPasswordStrong) {
      setErrorMessage('Password does not meet security criteria (min 8 chars, uppercase, lowercase, number, special char).');
      return;
    }

    setIsLoading(true);
    try {
      const res = await TATSBackendAPI.register(name, email, phone, password);
      if (res.ok && res.data.requires_otp) {
        setOtpPurpose('REGISTER');
        setMode('verify_otp');
        setResendCooldown(30);
        onShowToast('Verification Code Sent', `A 6-digit code was sent to ${email}`, 'info');
      } else {
        setErrorMessage(res.data.error || 'Registration failed.');
      }
    } catch {
      setErrorMessage('Unable to communicate with authentication engine.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the complete 6-digit code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await TATSBackendAPI.verifyOTP(email, otpCode, otpPurpose);
      if (res.ok && res.data.token && res.data.developer) {
        onSuccess(res.data.developer);
        onShowToast(
          res.data.developer.is_admin ? 'Admin Console Initialized' : 'Account Verified!',
          `Welcome to T@S, ${res.data.developer.name}. Your workspace is live.`,
          'success'
        );
        onClose();
      } else {
        setErrorMessage(res.data.error || 'Verification failed.');
      }
    } catch {
      setErrorMessage('Failed to connect to authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await TATSBackendAPI.resendOTP(email, otpPurpose);
      if (res.ok) {
        setResendCooldown(30);
        onShowToast('Code Resent', `Fresh verification code sent to ${email}`, 'info');
      } else {
        setErrorMessage(res.data.error || 'Failed to resend code.');
      }
    } catch {
      setErrorMessage('Network error while resending code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email/mobile and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await TATSBackendAPI.login(email, password);
      if (res.ok && res.data.token && res.data.developer) {
        onSuccess(res.data.developer);
        onShowToast(
          `Welcome back, ${res.data.developer.name}!`,
          res.data.developer.is_admin ? 'Platform Admin Access Granted.' : 'Connected to T@S Engine.',
          'success'
        );
        onClose();
      } else if (res.status === 403 && res.data.requires_otp) {
        setOtpPurpose('LOGIN');
        setMode('verify_otp');
        setResendCooldown(30);
        onShowToast('Verification Required', 'Please enter the 6-digit code sent to your email.', 'info');
      } else {
        setErrorMessage(res.data.error || 'Invalid credentials.');
      }
    } catch {
      setErrorMessage('Connection failed. Please ensure the backend engine is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter the email address linked to your account.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await TATSBackendAPI.forgotPassword(email);
      if (res.ok) {
        setOtpPurpose('FORGOT_PASSWORD');
        setMode('reset_password');
        setResendCooldown(30);
        onShowToast('Reset Code Dispatched', `Password reset instructions sent to ${email}`, 'info');
      } else {
        setErrorMessage(res.data.error || 'Failed to initiate password reset.');
      }
    } catch {
      setErrorMessage('Network error during password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit code received via email.');
      return;
    }
    if (!isPasswordStrong) {
      setErrorMessage('New password does not meet security criteria.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await TATSBackendAPI.resetPassword(email, otpCode, password);
      if (res.ok && res.data.developer) {
        onSuccess(res.data.developer);
        onShowToast('Password Reset Complete', 'Your account has been secured and logged in.', 'success');
        onClose();
      } else {
        setErrorMessage(res.data.error || 'Password reset failed.');
      }
    } catch {
      setErrorMessage('Network error during password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-[0_24px_64px_-12px_rgba(30,27,36,0.25)] border border-[#FFE6DC] p-5 sm:p-8 max-h-[92vh] overflow-y-auto z-10 animate-in zoom-in-95 duration-200 flex flex-col gap-5">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#FFE6DC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF7E5F] to-[#FFAE33] flex items-center justify-center text-white shadow-sm">
              <span className="material-symbols-outlined text-[22px]">
                {mode === 'verify_otp' ? 'mark_email_read' : mode === 'forgot_password' || mode === 'reset_password' ? 'lock_reset' : 'security'}
              </span>
            </div>
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#1D1A23]">
                {mode === 'login' && 'Developer Sign In'}
                {mode === 'register' && (systemStatus?.first_user_becomes_admin ? 'Setup Platform Admin' : 'Create Account')}
                {mode === 'verify_otp' && 'Verify Email OTP'}
                {mode === 'forgot_password' && 'Reset Password'}
                {mode === 'reset_password' && 'Set New Password'}
              </h2>
              <p className="text-xs text-[#57423D]">
                {mode === 'login' && 'Access clusters, live keys, and metrics'}
                {mode === 'register' && 'Indian Mobile + Email verification required'}
                {mode === 'verify_otp' && `Enter 6-digit code sent to ${email}`}
                {mode === 'forgot_password' && 'We will send a 6-digit reset code'}
                {mode === 'reset_password' && 'Enter verified code and new strong password'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8B716B] hover:bg-[#FAF9F6] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* First Time Admin Notice Banner */}
        {systemStatus?.first_user_becomes_admin && mode === 'register' && (
          <div className="p-3 rounded-2xl bg-[#FFF8EB] border border-[#FDE047] flex items-start gap-2.5 text-xs text-[#854D0E]">
            <span className="material-symbols-outlined text-[#CA8A04] text-[18px] shrink-0 mt-0.5">verified_user</span>
            <div>
              <div className="font-bold font-['Outfit']">Primary Administrator Initializer</div>
              <div>No admin registered yet. This first account will become the platform master administrator.</div>
            </div>
          </div>
        )}

        {/* Custom Context Banner (e.g. from Pricing / Wizard click) */}
        {bannerNotice && (
          <div className="p-2.5 rounded-2xl bg-[#F8F1FE] border border-[#DEC0B9]/50 flex items-center gap-2 text-xs text-[#A53B22] font-medium">
            <span className="material-symbols-outlined text-[16px]">info</span>
            <span>{bannerNotice}</span>
          </div>
        )}

        {/* Navigation Tabs (Login vs Register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex rounded-full bg-[#FAF9F6] p-1 border border-[#FFE6DC]">
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMessage(''); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
                mode === 'login'
                  ? 'bg-white text-[#A53B22] shadow-sm'
                  : 'text-[#8B716B] hover:text-[#1D1A23]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMessage(''); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
                mode === 'register'
                  ? 'bg-white text-[#A53B22] shadow-sm'
                  : 'text-[#8B716B] hover:text-[#1D1A23]'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2 text-xs text-[#DC2626] animate-in fade-in">
            <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODE 1: SIGN IN FORM */}
        {/* ======================================================== */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#1D1A23] mb-1 font-['Outfit']">
                Email Address or Indian Mobile Number
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dev@tats.ai or 9876543210"
                className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#1D1A23] font-['Outfit']">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot_password'); setErrorMessage(''); }}
                  className="text-[11px] text-[#A53B22] hover:underline font-semibold"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-['Outfit'] font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : 'Sign In to Workspace'}
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* MODE 2: REGISTER FORM (Indian Mobile + Strong Password) */}
        {/* ======================================================== */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1D1A23] mb-1 font-['Outfit']">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1D1A23] mb-1 font-['Outfit']">
                Work Email Address (OTP will be sent here)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@company.com"
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#1D1A23] font-['Outfit']">
                  Indian Mobile Number
                </label>
                <span className="text-[10px] text-[#8B716B] font-mono">10 digits (+91)</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-[#8B716B]">+91</span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  className="w-full pl-12 pr-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1D1A23] mb-1 font-['Outfit']">
                Strong Master Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, 1 upper, 1 digit, 1 special (@$!%*?&#^)"
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
              />

              {/* Password Strength Checklist */}
              {password && (
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] font-medium text-[#57423D] bg-[#FAF9F6] p-2 rounded-xl border border-[#FFE6DC]">
                  <span className={pwdCriteria.length ? 'text-green-600 font-bold' : 'text-red-500'}>
                    ✓ 8+ Characters
                  </span>
                  <span className={pwdCriteria.upper ? 'text-green-600 font-bold' : 'text-red-500'}>
                    ✓ Uppercase (A-Z)
                  </span>
                  <span className={pwdCriteria.lower ? 'text-green-600 font-bold' : 'text-red-500'}>
                    ✓ Lowercase (a-z)
                  </span>
                  <span className={pwdCriteria.number ? 'text-green-600 font-bold' : 'text-red-500'}>
                    ✓ Number (0-9)
                  </span>
                  <span className={`${pwdCriteria.special ? 'text-green-600 font-bold' : 'text-red-500'} col-span-2`}>
                    ✓ Special symbol (@$!%*?&#^_-+=)
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-['Outfit'] font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {isLoading ? 'Creating Account & Generating OTP...' : 'Send Verification OTP'}
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* MODE 3: VERIFY EMAIL OTP */}
        {/* ======================================================== */}
        {mode === 'verify_otp' && (
          <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4 text-center">
            <div className="text-xs text-[#57423D]">
              We have dispatched a 6-digit cryptographic verification code to:
              <div className="font-bold text-[#1D1A23] font-mono mt-0.5">{email}</div>
            </div>

            <div>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="0 0 0 0 0 0"
                className="w-48 mx-auto px-4 py-3 rounded-2xl bg-[#FAF9F6] border-2 border-[#A53B22] text-center text-xl font-mono tracking-widest font-bold text-[#1D1A23] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6}
              className="w-full py-3 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-['Outfit'] font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {isLoading ? 'Verifying Code...' : 'Verify & Launch Workspace'}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-[#8B716B] hover:text-[#1D1A23]"
              >
                ← Back to Sign In
              </button>

              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendCooldown > 0}
                className="text-[#A53B22] font-semibold disabled:text-[#8B716B]"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* MODE 4: FORGOT PASSWORD */}
        {/* ======================================================== */}
        {mode === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#1D1A23] mb-1 font-['Outfit']">
                Enter your registered Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dev@tats.ai"
                className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-['Outfit'] font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {isLoading ? 'Sending Code...' : 'Send Password Reset Code'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMessage(''); }}
              className="text-xs text-[#8B716B] hover:text-[#1D1A23] text-center"
            >
              ← Return to Sign In
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* MODE 5: RESET PASSWORD */}
        {/* ======================================================== */}
        {mode === 'reset_password' && (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1D1A23] mb-1 font-['Outfit']">
                6-Digit Reset Code (From Email)
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-mono font-bold text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1D1A23] mb-1 font-['Outfit']">
                New Master Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, uppercase, lowercase, number, symbol"
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1D1A23] mb-1 font-['Outfit']">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs text-[#1D1A23] focus:outline-none focus:border-[#A53B22]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-['Outfit'] font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {isLoading ? 'Updating Password...' : 'Reset Password & Log In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
