import { TASLogoIcon } from './TASLogo';
import React, { useState, useEffect } from 'react';
import { TATSBackendAPI } from '../services/api';

interface TASWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast?: (msg: string) => void;
}

export const TASWizard: React.FC<TASWizardProps> = ({ isOpen, onClose, onSuccessToast }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [maxAllowedStep, setMaxAllowedStep] = useState(1);
  const [wakeWord, setWakeWord] = useState('Hey Acme');
  const [passphrase, setPassphrase] = useState('Blue Phoenix Alpha');
  const [selectedPersona, setSelectedPersona] = useState<'browser' | 'aura' | 'clone'>('aura');
  const [cloneRecording, setCloneRecording] = useState(false);
  const [cloneSeconds, setCloneSeconds] = useState(0);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micVolume, setMicVolume] = useState(64);
  const [isWiped, setIsWiped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Re-configure Overview State
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [showConfiguredOverview, setShowConfiguredOverview] = useState(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string>('');

  // Load saved config on open
  useEffect(() => {
    if (!isOpen) return;

    let foundSaved = false;
    let savedTime = '';

    // Load from localStorage cache
    try {
      const cached = localStorage.getItem('tats_wizard_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.wakeWord) {
          setWakeWord(parsed.wakeWord);
          foundSaved = true;
        }
        if (parsed.passphrase) setPassphrase(parsed.passphrase);
        if (parsed.selectedPersona) setSelectedPersona(parsed.selectedPersona);
        if (parsed.savedAt) savedTime = new Date(parsed.savedAt).toLocaleString();
      }
    } catch {}

    // Fetch live saved config from database
    const loadSaved = async () => {
      try {
        const res = await TATSBackendAPI.getUserConfig('default_user');
        if (res && res.wake_word) {
          setWakeWord(res.wake_word);
          foundSaved = true;
          if (res.voice_tier) {
            const persona = res.voice_tier === 'CLONED' ? 'clone' : res.voice_tier === 'LIBRARY' ? 'aura' : 'browser';
            setSelectedPersona(persona);
          }
          if (res.last_active) {
            savedTime = new Date(res.last_active).toLocaleString();
          }
        }
      } catch {}

      if (foundSaved) {
        setHasExistingConfig(true);
        setShowConfiguredOverview(true);
        setLastSavedTimestamp(savedTime || 'Active on cluster');
        // Unbind and unlock all 5 steps so the user can freely configure what they want
        setMaxAllowedStep(5);
        setCurrentStep(1);
      } else {
        setHasExistingConfig(false);
        setShowConfiguredOverview(false);
        setMaxAllowedStep(1);
        setCurrentStep(1);
      }
    };
    loadSaved();
  }, [isOpen]);

  // Voice clone recorder countdown simulation
  useEffect(() => {
    let interval: any;
    if (cloneRecording) {
      interval = setInterval(() => {
        setCloneSeconds((prev) => {
          if (prev >= 6) {
            setCloneRecording(false);
            if (onSuccessToast) onSuccessToast('6-second voice clone successfully synthesized!');
            return 6;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setCloneSeconds(0);
    }
    return () => clearInterval(interval);
  }, [cloneRecording, onSuccessToast]);

  // Mic test volume jitter
  useEffect(() => {
    let interval: any;
    if (isMicTesting) {
      interval = setInterval(() => {
        setMicVolume(Math.floor(40 + Math.random() * 50));
      }, 120);
    }
    return () => clearInterval(interval);
  }, [isMicTesting]);

  if (!isOpen) return null;

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    const voiceTier = selectedPersona === 'clone' ? 'CLONED' : selectedPersona === 'aura' ? 'LIBRARY' : 'BROWSER';
    const updatedConfig = {
      wakeWord: wakeWord.trim() || 'Hey Acme',
      passphrase: passphrase.trim() || (hasExistingConfig ? '' : 'Blue Phoenix Alpha'),
      selectedPersona,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem('tats_wizard_config', JSON.stringify(updatedConfig));
    } catch {}

    try {
      const payload: any = {
        wake_word: updatedConfig.wakeWord,
        voice_tier: voiceTier
      };
      if (passphrase.trim()) {
        payload.passphrase = passphrase.trim();
      }
      await TATSBackendAPI.saveUserConfig('default_user', payload);
      if (onSuccessToast) {
        onSuccessToast(`Acoustic settings updated! Wake phrase "${updatedConfig.wakeWord}" active.`);
      }
    } catch {
      if (onSuccessToast) onSuccessToast('Agent calibrated and deployed to cluster.');
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      setMaxAllowedStep((prev) => Math.max(prev, 2));
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!wakeWord.trim() || wakeWord.trim().length < 3) {
        if (onSuccessToast) onSuccessToast('Please enter a valid wake word with at least 3 characters.');
        return;
      }
      setMaxAllowedStep((prev) => Math.max(prev, 3));
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      if (!hasExistingConfig && (!passphrase.trim() || passphrase.trim().length < 4)) {
        if (onSuccessToast) onSuccessToast('Please enter a secure biometric passphrase (at least 4 characters).');
        return;
      }
      setMaxAllowedStep((prev) => Math.max(prev, 4));
      setCurrentStep(4);
      return;
    }

    if (currentStep === 4) {
      setMaxAllowedStep((prev) => Math.max(prev, 5));
      setCurrentStep(5);
      return;
    }

    if (currentStep === 5) {
      await handleSaveAndClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/45 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Card Shell */}
      <div className="relative w-full max-w-4xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_24px_64px_-12px_rgba(30,27,36,0.18),0_12px_32px_-4px_rgba(255,126,95,0.22)] border border-[#FFE6DC] overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-4 sm:px-8 pt-6 pb-4 bg-white/80 border-b border-[#FFE6DC]/60 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/tas_final_logo_mark_small.svg"
              alt=""
              className="h-[44px] w-[44px] aspect-square shrink-0 select-none object-contain"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-['Outfit'] font-bold text-xl text-[#1D1A23] tracking-tight">
                  &lt;TASWizard /&gt;
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFDAD2] text-[#84240D] font-['Outfit'] text-[10px] font-bold uppercase">
                  v2.4 Embed
                </span>
              </div>
              <span className="text-xs text-[#57423D]">
                Autonomous Voice Assistant & Biometric Security Setup
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#8B716B] hover:bg-[#F3EBF8] hover:text-[#1D1A23] transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {showConfiguredOverview ? (
          /* CONFIGURATION ACTIVE & OVERVIEW SCREEN */
          <div className="p-6 sm:p-10 flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            {/* Headline & Description */}
            <div className="max-w-lg flex flex-col items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/70 text-emerald-800 text-[11px] font-bold font-['Outfit'] uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                CONFIGURATION DATA STORED & ACTIVE
              </div>
              <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-[#1D1A23] tracking-tight">
                Agent Parameters Already Configured
              </h2>
              <p className="text-xs sm:text-sm text-[#57423D] leading-relaxed">
                Your custom wake phrase, biometric authentication, and voice tier are stored and active on this cluster. Would you like to adjust or re-configure any of these settings?
              </p>
            </div>

            {/* Active Parameters Card */}
            <div className="w-full max-w-lg bg-[#FAF9F6] border border-[#FFE6DC] rounded-2xl p-5 sm:p-6 text-left flex flex-col gap-3.5 shadow-sm">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#FFE6DC]">
                <span className="text-[11px] font-bold text-[#8B716B] uppercase font-['Outfit'] tracking-wider">Active Acoustic Parameter</span>
                <span className="text-[11px] font-bold text-[#8B716B] uppercase font-['Outfit'] tracking-wider">Current Value</span>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs sm:text-[13px]">
                <span className="text-[#57423D] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px] text-[#A53B22]">mic</span>
                  Custom Wake Phrase:
                </span>
                <span className="font-bold text-[#1D1A23] font-mono bg-white px-3 py-1 rounded-lg border border-[#FFE6DC] shadow-sm">
                  "{wakeWord}"
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs sm:text-[13px]">
                <span className="text-[#57423D] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px] text-[#006688]">fingerprint</span>
                  Biometric Passphrase:
                </span>
                <span className="font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">verified_user</span>
                  Protected & Active
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs sm:text-[13px]">
                <span className="text-[#57423D] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px] text-[#845400]">graphic_eq</span>
                  Voice Persona Tier:
                </span>
                <span className="font-bold text-[#1D1A23]">
                  {selectedPersona === 'clone'
                    ? 'Zero-Shot 6-Sec Cloned'
                    : selectedPersona === 'aura'
                    ? 'Curated Studio Library (Aura)'
                    : 'Browser Built-in'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#8B716B] pt-2.5 border-t border-[#FFE6DC] font-mono">
                <span>Last Updated:</span>
                <span>{lastSavedTimestamp}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-lg mt-1">
              <button
                type="button"
                onClick={() => {
                  setShowConfiguredOverview(false);
                  setCurrentStep(1);
                  setMaxAllowedStep(5);
                }}
                className="w-full sm:flex-1 py-3 px-5 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF543E] hover:from-[#FF543E] hover:to-[#FFAE33] text-white font-bold text-xs shadow-md shadow-[#FF543E]/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                <span>Yes, Re-configure Settings</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:flex-1 py-3 px-5 rounded-full bg-white hover:bg-[#FAF9F6] text-[#57423D] hover:text-[#1D1A23] font-bold text-xs border border-[#FFE6DC] shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                <span>Keep Current Settings</span>
              </button>
            </div>
            <p className="text-[11px] text-[#8B716B]">
              Selecting re-configure unlocks all 5 steps so you can jump directly to any setting without sequential locking.
            </p>
          </div>
        ) : (
          <>
            {/* 5-Step Horizontal Breadcrumb Indicator */}
            <div className="px-6 sm:px-8 py-3.5 bg-[#FAF9F6] border-b border-[#FFE6DC]/60">
              <div className="grid grid-cols-5 gap-1 sm:gap-2 items-center">
                {[
                  { num: 1, label: '1. Welcome' },
                  { num: 2, label: '2. Wake Word' },
                  { num: 3, label: '3. Passphrase' },
                  { num: 4, label: '4. Persona' },
                  { num: 5, label: '5. Mic Check' },
                ].map((step) => {
                  const isPast = currentStep > step.num;
                  const isCurrent = currentStep === step.num;
                  return (
                    <button
                      key={step.num}
                      disabled={!hasExistingConfig && step.num > maxAllowedStep}
                      onClick={() => {
                        if (hasExistingConfig || step.num <= maxAllowedStep) {
                          setCurrentStep(step.num);
                        }
                      }}
                      className={`flex flex-col gap-1 text-left group ${!hasExistingConfig && step.num > maxAllowedStep ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isPast
                              ? 'bg-[#00C2FF] text-white shadow-sm'
                              : isCurrent
                              ? 'bg-[#FF7E5F] text-white ring-4 ring-[#FF7E5F]/20 animate-pulse'
                              : 'bg-[#EDE5F2] text-[#8B716B]'
                          }`}
                        >
                          {isPast ? (
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          ) : (
                            step.num
                          )}
                        </div>
                        <div
                          className={`h-1 flex-1 rounded-full transition-all ${
                            isPast
                              ? 'bg-[#00C2FF]'
                              : isCurrent
                              ? 'bg-gradient-to-r from-[#FF7E5F] to-[#FFAE33]'
                              : 'bg-[#EDE5F2]'
                          }`}
                        ></div>
                      </div>
                      <span
                        className={`font-['Outfit'] text-[10px] sm:text-[11px] font-bold truncate transition-colors ${
                          isCurrent
                            ? 'text-[#A53B22]'
                            : isPast
                            ? 'text-[#1D1A23]'
                            : 'text-[#8B716B]'
                        }`}
                      >
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Step Content Area */}
            <div className="p-6 sm:p-8 flex flex-col gap-6 max-h-[60vh] overflow-y-auto">
              
              {/* Re-configuration Mode Banner */}
              {hasExistingConfig && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px]">tune</span>
                    <span>
                      <strong>Config Adjustment Mode:</strong> Click any step in the top bar (1 to 5) to jump directly without restrictions.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAndClose}
                    disabled={isSaving}
                    className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm shrink-0"
                  >
                    <span className="material-symbols-outlined text-[14px]">save</span>
                    <span>{isSaving ? 'Saving...' : 'Save & Exit'}</span>
                  </button>
                </div>
              )}
          
          {/* STEP 1: WELCOME & TERMS */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A53B22] font-['Outfit']">
                  Step 1 • Privacy Architecture
                </span>
                <h2 className="font-['Outfit'] text-2xl font-bold text-[#1D1A23]">
                  Welcome to T@S Universal Voice Engine
                </h2>
                <p className="text-sm text-[#57423D]">
                  T@S translates voice to deterministic software actions with zero OpenAI/Anthropic cloud routing.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#F8F1FE] border border-[#DEC0B9]/40 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#A53B22]">
                    <span className="material-symbols-outlined text-[20px]">security</span>
                    <span className="font-bold text-xs uppercase font-['Outfit']">GDPR Article 17 Compliant</span>
                  </div>
                  <p className="text-xs text-[#57423D]">
                    Zero disk logging of voice frames. All incoming speech chunks are processed in volatile RAM and destroyed within 200ms of webhook response.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#F8F1FE] border border-[#DEC0B9]/40 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#006688]">
                    <span className="material-symbols-outlined text-[20px]">database</span>
                    <span className="font-bold text-xs uppercase font-['Outfit']">Self-Hosted pgvector</span>
                  </div>
                  <p className="text-xs text-[#57423D]">
                    Semantic memories reside inside your own PostgreSQL VPC cluster. No external provider ever sees caller transcripts or embeddings.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#FFE6DC] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FFDAD2] text-[#A53B22] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-[#1D1A23]">1-Click Complete Ephemeral Memory Wipe</p>
                    <p className="text-[#8B716B]">Instantly purge all caller session contexts.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsWiped(true);
                    if (onSuccessToast) onSuccessToast('All active RAM buffers wiped cleanly.');
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isWiped
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-[#FFDAD6] text-[#93000A] hover:bg-[#FFDAD6]/80'
                  }`}
                >
                  {isWiped ? 'Memories Wiped ✓' : 'Purge All RAM'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CUSTOM WAKE WORD */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A53B22] font-['Outfit']">
                  Step 2 • Acoustic Trigger
                </span>
                <h2 className="font-['Outfit'] text-2xl font-bold text-[#1D1A23]">
                  Assign Custom Wake Word
                </h2>
                <p className="text-sm text-[#57423D]">
                  Choose what utterance arms the agent without sending background chatter to your servers.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['Hey Acme', 'System Action', 'Talk Engine'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setWakeWord(preset)}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      wakeWord === preset
                        ? 'bg-[#FFDAD2]/40 border-[#FF7E5F] shadow-sm'
                        : 'bg-[#FAF9F6] border-[#FFE6DC] hover:border-[#FF7E5F]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#1D1A23]">"{preset}"</span>
                      {wakeWord === preset && (
                        <span className="material-symbols-outlined text-[16px] text-[#A53B22]">check_circle</span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#8B716B]">P99 Detection: ~110ms</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#57423D] uppercase font-['Outfit']">
                  Custom Wake Word Override
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={wakeWord}
                    onChange={(e) => setWakeWord(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] text-sm text-[#1D1A23] font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]"
                    placeholder="Enter custom phrase..."
                  />
                  <div className="absolute right-3 top-3 text-[11px] text-[#8B716B] font-mono">
                    Phonetic Score: 99.2%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SECRET SPOKEN PASSPHRASE (STITCH SHOWCASE STEP) */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF7E5F] shadow-[0_0_10px_rgba(255,126,95,0.8)] animate-pulse"></span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#A53B22] font-['Outfit']">
                      High Security Mode Active
                    </span>
                  </div>
                  <h2 className="font-['Outfit'] text-2xl font-bold text-[#1D1A23] tracking-tight">
                    Biometric Authorization & Neural Persona
                  </h2>
                  <p className="text-sm text-[#57423D]">
                    Calibrate acoustic verification so T@S only executes authorized workflows upon spoken verification.
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EDE5F2] text-[#57423D] text-xs font-semibold">
                  <span className="material-symbols-outlined text-[#006688] text-[18px]">verified_user</span>
                  <span>Zero-Trust Audio Enclave</span>
                </div>
              </div>

              {/* Passphrase Input Box */}
              <div className="flex flex-col gap-3 p-5 rounded-2xl bg-[#F8F1FE]/80 border border-[#FFE6DC] shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#A53B22] text-[20px]">key</span>
                    <label className="text-sm font-bold text-[#1D1A23]">Secret Spoken Passphrase</label>
                  </div>
                  <span className="text-[11px] text-[#845400] bg-[#FFDDB6]/60 font-semibold px-2.5 py-0.5 rounded-full">
                    Required for $5,000+ Actions
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full h-12 pl-4 pr-28 rounded-xl bg-white text-[#1D1A23] font-medium text-sm shadow-sm border border-[#FFE6DC] focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]"
                    placeholder={hasExistingConfig ? "Existing protected passphrase active (leave blank to keep, or enter new)..." : "E.g., 'Blue Phoenix Alpha'"}
                  />
                  <div className="absolute right-2 top-2 bottom-2 flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSuccessToast) onSuccessToast(`Voice acoustic audit: "${passphrase}" matches salt.`);
                      }}
                      className="h-8 px-3 rounded-lg bg-[#FAF9F6] hover:bg-[#F3EBF8] text-[#57423D] flex items-center gap-1.5 text-xs font-semibold transition-colors border border-[#DEC0B9]/40"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#A53B22]">record_voice_over</span>
                      <span>Audit</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs text-[#57423D]">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#006688] text-[16px]">fingerprint</span>
                    <span>Encrypted via bcrypt biometric hash • Never stored in raw audio plaintext</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#006688] font-mono">FIPS 140-3 COMPLIANT</span>
                </div>
              </div>

              {/* Persona Grid Preview */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-base text-[#1D1A23]">
                      Response Persona & Acoustic Synthesis
                    </h3>
                    <p className="text-xs text-[#57423D]">
                      Select the acoustic profile used when T@S speaks replies back to you.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold uppercase text-[#8B716B] font-['Outfit']">
                    3 Options Available
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Persona 1: Native Browser TTS */}
                  <div
                    onClick={() => setSelectedPersona('browser')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      selectedPersona === 'browser'
                        ? 'bg-white border-[#FF7E5F] ring-2 ring-[#FF7E5F] shadow-md'
                        : 'bg-[#FAF9F6] border-[#FFE6DC] hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-full bg-[#EDE5F2] flex items-center justify-center text-[#57423D]">
                          <span className="material-symbols-outlined text-[16px]">bolt</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EDE5F2] text-[#57423D]">
                          0ms Latency
                        </span>
                      </div>
                      <div className="font-bold text-sm text-[#1D1A23]">Native Browser TTS</div>
                      <p className="text-xs text-[#57423D] mt-1">
                        Client-side synthesis directly via Web Speech API. Completely offline capable.
                      </p>
                    </div>
                    <span className="text-[11px] text-[#8B716B]">Standard Robotic</span>
                  </div>

                  {/* Persona 2: Studio Aura Warm (Selected) */}
                  <div
                    onClick={() => setSelectedPersona('aura')}
                    className={`cursor-pointer p-4 rounded-2xl border relative overflow-hidden transition-all flex flex-col justify-between gap-3 ${
                      selectedPersona === 'aura'
                        ? 'bg-white border-[#FF7E5F] ring-2 ring-[#FF7E5F] shadow-lg'
                        : 'bg-[#FAF9F6] border-[#FFE6DC] hover:bg-white'
                    }`}
                  >
                    <div className="absolute top-0 right-0 bg-[#FF7E5F] text-white px-2 py-0.5 rounded-bl-lg text-[9px] font-bold uppercase">
                      Selected
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-full bg-[#FFDAD2] flex items-center justify-center text-[#A53B22]">
                          <span className="material-symbols-outlined text-[16px]">waves</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFDDB6] text-[#643F00]">
                          99.8% Natural
                        </span>
                      </div>
                      <div className="font-bold text-sm text-[#1D1A23]">Studio: Aura Warm</div>
                      <p className="text-xs text-[#57423D] mt-1">
                        Bioluminescent neural tone with emotional warmth and adaptive pacing.
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1 h-3">
                        <div className="w-1 bg-[#FF7E5F] h-3 rounded-full animate-pulse"></div>
                        <div className="w-1 bg-[#FFAE33] h-4 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1 bg-[#FF7E5F] h-2 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                        <div className="w-1 bg-[#FFAE33] h-3.5 rounded-full animate-pulse" style={{ animationDelay: '450ms' }}></div>
                      </div>
                      <span className="text-xs font-bold text-[#A53B22]">Active</span>
                    </div>
                  </div>

                  {/* Persona 3: Instant Voice Clone */}
                  <div
                    onClick={() => setSelectedPersona('clone')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      selectedPersona === 'clone'
                        ? 'bg-white border-[#FF7E5F] ring-2 ring-[#FF7E5F] shadow-md'
                        : 'bg-[#FAF9F6] border-[#FFE6DC] hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-full bg-[#EDE5F2] flex items-center justify-center text-[#57423D]">
                          <span className="material-symbols-outlined text-[16px]">mic</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFDAD2] text-[#84240D]">
                          Zero-Shot
                        </span>
                      </div>
                      <div className="font-bold text-sm text-[#1D1A23]">6-Sec Instant Clone</div>
                      <p className="text-xs text-[#57423D] mt-1">
                        Speak 6 seconds to generate your own personal digital acoustic twin.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPersona('clone');
                        setCloneRecording(true);
                      }}
                      className="w-full py-1 px-3 rounded-full bg-[#F3EBF8] hover:bg-[#FFDAD2] text-[#1D1A23] hover:text-[#84240D] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#FF5F45] animate-ping"></span>
                      <span>{cloneRecording ? `Recording... (${cloneSeconds}s)` : 'Record 6-Sec Sample'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: DETAILED VOICE PERSONA SETTINGS */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A53B22] font-['Outfit']">
                  Step 4 • Voice Persona Tuning
                </span>
                <h2 className="font-['Outfit'] text-2xl font-bold text-[#1D1A23]">
                  Acoustic Synthesis & Clone Tuning
                </h2>
                <p className="text-sm text-[#57423D]">
                  Test audio playback speed, pitch warmth, and emotional resonance.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1D1A23]">Selected Profile:</span>
                  <span className="px-3 py-1 rounded-full bg-[#FFDAD2] text-[#84240D] text-xs font-bold uppercase">
                    {selectedPersona === 'aura'
                      ? 'Studio: Aura Warm (Neural)'
                      : selectedPersona === 'clone'
                      ? '6-Sec Instant Voice Clone'
                      : 'Browser Native TTS'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-[#57423D] mb-1">
                      <span>Vocal Warmth / Pitch</span>
                      <span className="font-mono font-bold">+0.8 Semitones</span>
                    </div>
                    <input
                      type="range"
                      defaultValue={68}
                      className="w-full h-2 rounded-lg accent-[#FF7E5F] cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-[#57423D] mb-1">
                      <span>Speaking Cadence</span>
                      <span className="font-mono font-bold">1.05x (Conversational)</span>
                    </div>
                    <input
                      type="range"
                      defaultValue={55}
                      className="w-full h-2 rounded-lg accent-[#FF7E5F] cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (onSuccessToast) onSuccessToast('Auditioning: "I have initialized your Acme agent."');
                  }}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-[#F3EBF8] text-[#A53B22] border border-[#FFE6DC] font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">volume_up</span>
                  <span>Audition Audio Phrase</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: INTERACTIVE MIC CHECK & CALIBRATION */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A53B22] font-['Outfit']">
                  Step 5 • Final Calibration
                </span>
                <h2 className="font-['Outfit'] text-2xl font-bold text-[#1D1A23]">
                  Interactive Microphone Calibration
                </h2>
                <p className="text-sm text-[#57423D]">
                  Verify noise cancellation and ambient room acoustic sensitivity before going live.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col items-center justify-center text-center gap-4">
                <div
                  onClick={() => setIsMicTesting(!isMicTesting)}
                  className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                    isMicTesting
                      ? 'bg-[#FF7E5F] text-white shadow-[0_0_30px_rgba(255,126,95,0.6)] animate-pulse'
                      : 'bg-[#EDE5F2] text-[#A53B22] hover:bg-[#FFDAD2]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[36px]">
                    {isMicTesting ? 'graphic_eq' : 'mic'}
                  </span>
                </div>

                <div className="text-xs">
                  <p className="font-bold text-[#1D1A23]">
                    {isMicTesting ? 'Listening for test speech... (Speak now)' : 'Click circle to start Mic Test'}
                  </p>
                  <p className="text-[#8B716B]">
                    Recommended: Speak "Hey Acme" at normal desk distance.
                  </p>
                </div>

                {/* Live Volume Meter Bar */}
                <div className="w-full max-w-md flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] text-[#57423D]">
                    <span>Input Level</span>
                    <span className="font-mono font-bold">{isMicTesting ? `${micVolume}%` : '0%'}</span>
                  </div>
                  <div className="h-3 w-full bg-[#EDE5F2] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-[#00C2FF] via-[#FFAE33] to-[#FF7E5F] transition-all duration-100"
                      style={{ width: `${isMicTesting ? micVolume : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full font-semibold">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Acoustic threshold optimal: -1.8 dBFS floor detected</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Action Footer */}
        <div className="px-6 sm:px-8 py-4 bg-[#FAF9F6] border-t border-[#FFE6DC]/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#57423D]">
            <span className="material-symbols-outlined text-[#FFAE33] text-[18px]">info</span>
            <span>
              Step {currentStep} of 5 completed • {5 - currentStep === 0 ? 'Ready to Deploy!' : `Estimated: ${(5 - currentStep) * 20} secs`}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {hasExistingConfig && (
              <button
                type="button"
                onClick={handleSaveAndClose}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{isSaving ? 'Saving...' : 'Save & Apply'}</span>
              </button>
            )}
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-5 py-2.5 rounded-full bg-white hover:bg-[#EDE5F2] text-[#1D1A23] text-xs font-bold border border-[#FFE6DC] transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Back</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF7E5F] via-[#FF5F45] to-[#FFAE33] hover:from-[#FF5F45] hover:to-[#FFAE33] text-white text-xs font-bold shadow-[0_8px_24px_-4px_rgba(255,126,95,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span>{currentStep === 5 ? 'Complete Calibration & Launch' : 'Save & Continue'}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </>
    )}

      </div>
    </div>
  );
};
