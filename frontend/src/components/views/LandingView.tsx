import { TASLogo } from '../TASLogo';
import React, { useState, useEffect, useRef } from 'react';
import { AppView } from '../../types';
import { TATSBackendAPI } from '../../services/api';
import { LegalModalType } from '../LegalModals';

interface LandingViewProps {
  onNavigate: (view: AppView) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning') => void;
  onOpenWizard: () => void;
  developer: {
    id?: string;
    name: string;
    email: string;
    phone?: string;
    is_admin?: boolean;
    is_verified?: boolean;
  } | null;
  onOpenAuth: (notice?: string, targetView?: AppView) => void;
  activeAppId?: string;
  onRefreshApps?: () => void;
  onOpenLegalModal?: (type: LegalModalType) => void;
  onReplayIntro?: () => void;
  onSelectService?: (serviceId: string | null) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onNavigate,
  onShowToast,
  onOpenWizard,
  developer,
  onOpenAuth,
  activeAppId,
  onRefreshApps,
  onOpenLegalModal,
  onReplayIntro,
  onSelectService
}) => {
  const handleSelectServiceFromLanding = (serviceId: string | null) => {
    if (onSelectService) {
      onSelectService(serviceId);
    } else {
      if (serviceId) {
        localStorage.setItem('tats_selected_service', serviceId);
      } else {
        localStorage.removeItem('tats_selected_service');
      }
      window.dispatchEvent(new CustomEvent('tats_service_selected', { detail: serviceId }));
      onNavigate('services');
    }
  };

  const [activeCodeTab, setActiveCodeTab] = useState<'fastapi' | 'django' | 'node' | 'react'>('fastapi');
  const [units, setUnits] = useState(50000);
  const [activeUtteranceIndex, setActiveUtteranceIndex] = useState(0);
  const [isSimulatingSpeech, setIsSimulatingSpeech] = useState(false);
  const [latencyProgress, setLatencyProgress] = useState(482);
  const [liveCallId, setLiveCallId] = useState('#vox-9921e');
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [platformConfig, setPlatformConfig] = useState<any>(() => TATSBackendAPI.getCachedPlatformConfig());
  const [isScrollingToTop, setIsScrollingToTop] = useState(false);
  const [hasScrolledDown, setHasScrolledDown] = useState(false);
  const scrollSafetyTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setHasScrolledDown(y > 150);
      if (y <= 10 && isScrollingToTop) {
        setIsScrollingToTop(false);
        if (scrollSafetyTimeoutRef.current) clearTimeout(scrollSafetyTimeoutRef.current);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollSafetyTimeoutRef.current) clearTimeout(scrollSafetyTimeoutRef.current);
    };
  }, [isScrollingToTop]);

  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const cfg = await TATSBackendAPI.getPlatformConfig();
        if (cfg && isMounted) setPlatformConfig(cfg);
      } catch {}
    };
    fetchConfig();

    const handleConfigUpdate = (e: any) => {
      if (!isMounted) return;
      if (e.detail) {
        setPlatformConfig(e.detail);
      } else {
        fetchConfig();
      }
    };

    window.addEventListener('tats_config_updated', handleConfigUpdate);
    window.addEventListener('focus', fetchConfig);

    return () => {
      isMounted = false;
      window.removeEventListener('tats_config_updated', handleConfigUpdate);
      window.removeEventListener('focus', fetchConfig);
    };
  }, []);

  const utterances = [
    {
      intentLabel: 'Deploy Hotfix',
      phrase: '“Hey, deploy the pending hotfix to the staging cluster and bump replicas to four.”',
      action: 'cluster_deploy',
      endpoint: '/api/v1/orchestrator/execute',
      latency: 482,
      arguments: { environment: 'staging', target_patch: 'hotfix_pending', replica_count: 4 },
      status: 'EXECUTED_SUCCESSFULLY',
      units: 3
    },
    {
      intentLabel: 'Create Task',
      phrase: '“Hey tds, create a task to ship code review by 5 PM today with high priority.”',
      action: 'create_task',
      endpoint: '/api/v1/tasks/create/',
      latency: 395,
      arguments: { title: 'Ship code review', due: '17:00', priority: 'high', assignee: 'tds' },
      status: 'TASK_CREATED_LINEAR',
      units: 3
    },
    {
      intentLabel: 'Refund',
      phrase: '“Authorize refund 4920 to customer wallet under invoice INV-8819.”',
      action: 'refund_order',
      endpoint: '/api/v2/finance/refund',
      latency: 520,
      arguments: { amount: 4920, currency: 'INR', target: 'customer_wallet' },
      status: 'REFUND_SETTLED',
      units: 3
    }
  ];

  const currentUtterance = utterances[activeUtteranceIndex];

  const handleSimulateUtterance = (index: number) => {
    setActiveUtteranceIndex(index);
    setIsSimulatingSpeech(true);
    setLiveCallId(`#vox-${Math.floor(10000 + Math.random() * 90000).toString(16)}`);
    setLatencyProgress(Math.floor(360 + Math.random() * 180));
    setTimeout(() => {
      setIsSimulatingSpeech(false);
      onShowToast('Acoustic speech token resolved', `Webhook dispatched to ${utterances[index].endpoint}`);
    }, 600);
  };

  // Pricing calculation
  const calculatedCost = Math.max(999, Math.round(units * 0.1));
  const competitorCost = Math.round(units * 0.648);
  const savingsPercent = Math.round(((competitorCost - calculatedCost) / competitorCost) * 100);

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    onShowToast('Copied to clipboard!', 'SDK snippet copied to system clipboard.');
  };

  // Razorpay Live Payment Checkout Handler
  const handleDeployGrowth = async () => {
    if (!developer) {
      onOpenAuth('Please sign in or register to deploy the Growth Startup plan.');
      return;
    }

    setIsPaymentProcessing(true);

    try {
      // 1. Create order on Django backend
      const orderRes = await TATSBackendAPI.createRazorpayOrder('GROWTH_STARTUP', activeAppId);
      if (!orderRes.ok) {
        onShowToast('Order Failed', orderRes.data.error || 'Failed to create payment order.', 'warning');
        setIsPaymentProcessing(false);
        return;
      }

      const orderData = orderRes.data;

      // 2. Dynamically load Razorpay SDK
      const loadRazorpay = () => {
        return new Promise<boolean>((resolve) => {
          if ((window as any).Razorpay) {
            resolve(true);
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      const isLoaded = await loadRazorpay();

      // Check if real Razorpay keys are configured or in simulation mode
      if (orderData.is_live_gateway && isLoaded) {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'T@S Acoustic AI',
          description: 'Growth Startup Plan (50,000 Action Units)',
          image: 'https://cdn-icons-png.flaticon.com/512/3247/3247310.png',
          order_id: orderData.order_id,
          prefill: orderData.prefill || {
            name: developer.name,
            email: developer.email,
            contact: developer.phone || '+919999999999',
          },
          theme: {
            color: '#A53B22',
          },
          handler: async function (response: any) {
            const verifyRes = await TATSBackendAPI.verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              app_id: activeAppId,
            });

            if (verifyRes.ok) {
              const currentGrowthUnits = (platformConfig?.growth_tier_units || 50000).toLocaleString('en-IN');
              const currentGrowthPrice = (platformConfig?.growth_price_inr || platformConfig?.starter_price_inr || 1999).toLocaleString('en-IN');
              onShowToast(
                'Growth Plan Activated!',
                `Payment of ₹${currentGrowthPrice} captured. ${currentGrowthUnits} Action Units credited.`,
                'success'
              );
              if (onRefreshApps) onRefreshApps();
              onNavigate('developer-dashboard');
            } else {
              onShowToast('Verification Failed', verifyRes.data.error || 'Signature check failed.', 'warning');
            }
            setIsPaymentProcessing(false);
          },
          modal: {
            ondismiss: function () {
              setIsPaymentProcessing(false);
              onShowToast('Payment Cancelled', 'Razorpay checkout was dismissed.', 'info');
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Live keys pending in .env: Execute verified direct simulation to complete onboarding cleanly
        const simPaymentId = `pay_live_${Date.now().toString(36)}`;
        const verifyRes = await TATSBackendAPI.verifyRazorpayPayment({
          razorpay_order_id: orderData.order_id,
          razorpay_payment_id: simPaymentId,
          razorpay_signature: `simulated_${Date.now()}`,
          app_id: activeAppId,
        });

        if (verifyRes.ok) {
          const currentGrowthUnits = (platformConfig?.growth_tier_units || 50000).toLocaleString('en-IN');
          onShowToast(
            'Growth Plan Activated (Test Mode)',
            `Order ${orderData.order_id} verified. ${currentGrowthUnits} Units loaded. Add RAZORPAY_KEY_ID in .env for live bank checkout.`,
            'success'
          );
          if (onRefreshApps) onRefreshApps();
          onNavigate('developer-dashboard');
        } else {
          onShowToast('Verification Error', verifyRes.data.error || 'Failed to verify transaction.', 'warning');
        }
        setIsPaymentProcessing(false);
      }
    } catch {
      onShowToast('Payment Network Error', 'Failed to communicate with payment service.', 'warning');
      setIsPaymentProcessing(false);
    }
  };

  const fastApiCode = `# 1. Install: pip install t-at-s fastapi uvicorn
from fastapi import FastAPI
from tat_engine import AcousticEngine

app = FastAPI(title="Voice Execution Agent")
engine = AcousticEngine(api_key="tas_live_981a34...")

@app.post("/voice/telephony-webhook")
async def telephony_handler(audio_stream: bytes):
    # Evaluates speech in volatile RAM & executes registered tool in <850ms
    action = await engine.execute_stream(audio_stream)
    return {"status": "ok", "action": action.name, "params": action.arguments}
`;

  const nodeCode = `// 1. Install: npm install @tats/sdk express
import express from 'express';
import { AcousticAgent } from '@tats/sdk';

const app = express();
const agent = new AcousticAgent({ apiKey: 'tas_live_981a34...' });

app.post('/voice/webhook', async (req, res) => {
  // Dispatches to your backend microservices with zero hallucinations
  const result = await agent.executeVoice(req.body.audioStream);
  res.json({ dispatched: true, intent: result.intent, latency: result.latencyMs });
});
`;

  const djangoCode = `# 1. Install the engine: pip install t-at-s
from django.http import JsonResponse
from tat_engine import AcousticEngine, ActionRegistry

# Initialize isolated, self-hosted pgvector action brain
engine = AcousticEngine(
    api_key="tas_live_981a34...",
    vector_store="postgresql://postgres:secret@db.internal:5432/memory"
)

@engine.register_action(name="create_task", schema={"title": str, "priority": str})
def handle_task_action(voice_payload):
    # Triggered automatically upon human utterance completion (<850ms)
    task = Task.objects.create(**voice_payload.arguments)
    return JsonResponse({"status": "created", "task_id": task.id})`;

  const reactCode = `// 1. Install client: npm install t-at-s
import React from 'react';
import { useAcousticSession } from 't-at-s';

export function VoiceController() {
  const { isListening, startSession, lastAction, latencyMs } = useAcousticSession({
    endpoint: '/api/actions/voice_router/',
    onExecution: (res) => console.log('Backend action dispatched:', res)
  });

  return (
    <button onClick={startSession} className="acoustic-trigger-pill">
      {isListening ? 'Analyzing Stream...' : 'Talk to App'} ({latencyMs}ms)
    </button>
  );
}`;

  const handleScrollToTop = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    // 1. Immediately activate flight animation state on ONE click
    setIsScrollingToTop(true);

    // 2. Cross-browser smooth scroll to top
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }

    // 3. Safety auto-reset timeout in case scroll completes before scroll listener triggers
    if (scrollSafetyTimeoutRef.current) clearTimeout(scrollSafetyTimeoutRef.current);
    scrollSafetyTimeoutRef.current = setTimeout(() => {
      setIsScrollingToTop(false);
    }, 1000);
  };

  const scrollToSection = (id: string) => {
    if (id === 'top') {
      handleScrollToTop();
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#FAF9F6] text-[#1D1A23] flex flex-col justify-between">
      {/* Floating Quick-Action Shortcuts Dock (Desktop/Tablet >= md) */}
      <aside
        aria-label="Landing quick shortcuts"
        className="hidden md:flex fixed right-3 sm:right-5 top-24 z-30 flex-col items-center gap-1.5 p-1.5 rounded-2xl bg-white/90 backdrop-blur-md border border-[#DEC0B9]/60 shadow-lg shadow-[#1D1A23]/5"
      >
        {/* Back to Top with In-Place Flight Throttle & Lift Animation */}
        <button
          onClick={handleScrollToTop}
          className={`group relative flex flex-col items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl transition-all duration-300 cursor-pointer ${
            isScrollingToTop
              ? 'bg-gradient-to-tr from-[#FF7E5F] to-[#FFAE33] text-white shadow-[0_0_16px_rgba(255,126,95,0.45)] scale-105'
              : hasScrolledDown
              ? 'text-[#A53B22] bg-[#FFF6F3] hover:bg-[#FFE6DC] hover:text-[#721702] border border-[#FFDAD2]'
              : 'text-[#57423D] hover:text-[#A53B22] hover:bg-[#FFE6DC]/50 active:scale-95'
          }`}
          title={isScrollingToTop ? 'Flight ready • Gliding to top' : 'Back to Top'}
          aria-label="Back to Top"
        >
          {/* In-Place Flying / Throttling Arrow */}
          <span
            className={`material-symbols-outlined text-[18px] sm:text-[20px] transition-transform ${
              isScrollingToTop
                ? 'animate-flight-throttle text-white'
                : 'group-hover:-translate-y-1'
            }`}
          >
            arrow_upward
          </span>

          {/* Under-Arrow Thrust Flame Bar (Pulses gently while throttling) */}
          {isScrollingToTop && (
            <span className="w-3 h-0.5 rounded-full bg-white/95 shadow-[0_0_6px_rgba(255,255,255,0.9)] animate-thrust-glow pointer-events-none -mt-0.5" />
          )}

          {/* Tooltip */}
          <span className="pointer-events-none absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-[#1D1A23] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md">
            {isScrollingToTop ? 'Gliding to top...' : 'Back to Top'}
          </span>
        </button>

        <div className="w-4 h-[1px] bg-[#FFE6DC]" />

        {/* Watch Intro (Cinematic) */}
        {onReplayIntro && (
          <button
            onClick={onReplayIntro}
            className="group relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-[#57423D] hover:text-[#A53B22] hover:bg-[#FFE6DC]/50 active:scale-95 transition-all cursor-pointer"
            title="Watch Architecture Intro"
            aria-label="Watch Architecture Intro"
          >
            <span className="material-symbols-outlined text-[18px] sm:text-[20px] text-[#FF7E5F]">movie</span>
            <span className="pointer-events-none absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-[#1D1A23] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md">
              Watch Intro Movie
            </span>
          </button>
        )}

        {/* Live Voice Stream Demo */}
        <button
          onClick={() => scrollToSection('voice-demo')}
          className="group relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-[#57423D] hover:text-[#A53B22] hover:bg-[#FFE6DC]/50 active:scale-95 transition-all cursor-pointer"
          title="Live Voice Stream Demo"
          aria-label="Live Voice Stream Demo"
        >
          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">graphic_eq</span>
          <span className="pointer-events-none absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-[#1D1A23] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md">
            Live Voice Demo
          </span>
        </button>

        {/* 5-Line Code Quickstart */}
        <button
          onClick={() => scrollToSection('quickstart')}
          className="group relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-[#57423D] hover:text-[#A53B22] hover:bg-[#FFE6DC]/50 active:scale-95 transition-all cursor-pointer"
          title="5-Line Code Quickstart"
          aria-label="5-Line Code Quickstart"
        >
          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">terminal</span>
          <span className="pointer-events-none absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-[#1D1A23] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md">
            5-Line Quickstart Code
          </span>
        </button>

        {/* Estimate Savings Calculator */}
        <button
          onClick={() => scrollToSection('pricing')}
          className="group relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-[#57423D] hover:text-[#A53B22] hover:bg-[#FFE6DC]/50 active:scale-95 transition-all cursor-pointer"
          title="Estimate Savings Calculator"
          aria-label="Estimate Savings Calculator"
        >
          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">calculate</span>
          <span className="pointer-events-none absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-[#1D1A23] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md">
            Pricing &amp; Calculator
          </span>
        </button>

        {/* Frequently Asked Questions */}
        <button
          onClick={() => scrollToSection('faq')}
          className="group relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-[#57423D] hover:text-[#A53B22] hover:bg-[#FFE6DC]/50 active:scale-95 transition-all cursor-pointer"
          title="Frequently Asked Questions"
          aria-label="Frequently Asked Questions"
        >
          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">quiz</span>
          <span className="pointer-events-none absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-[#1D1A23] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md">
            FAQ
          </span>
        </button>
      </aside>

      {/* Mobile Floating Back to Top Button */}
      {hasScrolledDown && (
        <button
          onClick={handleScrollToTop}
          className="md:hidden fixed bottom-5 right-4 z-40 w-11 h-11 rounded-full bg-gradient-to-tr from-[#FF7E5F] to-[#FFAE33] text-white shadow-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 animate-in fade-in"
          aria-label="Back to Top"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_upward</span>
        </button>
      )}

      {/* Hero Section */}
      <section id="top" className="relative w-full px-4 sm:px-8 pt-8 sm:pt-16 pb-16 overflow-hidden flex flex-col items-center text-center max-w-6xl mx-auto scroll-mt-24">
        {/* Ambient Radial Coral Aura */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[720px] h-[340px] bg-gradient-to-b from-[#FF7E5F]/20 via-[#FFAE33]/15 to-transparent blur-3xl pointer-events-none rounded-full"></div>

        {/* Announcement Pill */}
        <div className="relative z-10 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#FFE6DC] text-xs font-semibold text-[#57423D] mb-6 shadow-xs hover:border-[#FF7E5F] transition-all">
          <span className="px-2 py-0.5 rounded-full bg-[#A53B22] text-white text-[10px] font-bold uppercase tracking-wider">New</span>
          <span className="text-[#1D1A23] font-bold">T@S 2.0</span>
          <span className="text-[#DEC0B9]">•</span>
          {onReplayIntro ? (
            <button
              onClick={onReplayIntro}
              className="text-[#A53B22] hover:text-[#FF5F45] flex items-center gap-1 cursor-pointer font-semibold transition-colors"
              title="Watch the developer architectural intro animation"
            >
              <span className="material-symbols-outlined text-[15px]">play_circle</span>
              <span>Watch Architecture Intro</span>
            </button>
          ) : (
            <button onClick={() => onNavigate('services')} className="text-[#A53B22] hover:underline flex items-center gap-0.5 cursor-pointer font-medium">
              <span>Voice AI &amp; Action Engine</span>
              <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
            </button>
          )}
        </div>

        {/* Main Headline & Subtitle */}
        <div className="relative z-10 max-w-4xl mx-auto mb-6">
          <h1 className="font-['Outfit'] text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#1D1A23] tracking-tight leading-[1.15] sm:leading-[1.1] mb-4 sm:mb-5 max-w-4xl">
            Build fast voice agents that actually run your code.
          </h1>
          <p className="font-['Manrope'] text-base sm:text-lg text-[#57423D] max-w-2xl mx-auto leading-relaxed">
            Your users talk. T@S calls your API and replies in under 1 second. No made-up answers. No voice recordings saved on disk. Simple to connect.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-wrap justify-center items-center gap-3.5 mb-12">
          <button
            onClick={() => {
              if (developer) {
                onNavigate('developer-dashboard');
              } else {
                onOpenAuth('Sign in or register to get instant API access.');
              }
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#FF7E5F] via-[#FF5F45] to-[#FFAE33] text-white font-['Outfit'] font-bold text-sm shadow-lg shadow-[#FF5F45]/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Get API Access</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
          <button
            onClick={() => {
              if (developer) {
                onNavigate('live-voice-playground');
              } else {
                onOpenAuth('Sign in or register to test the live voice playground.');
              }
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#1D1A23] font-['Outfit'] font-bold text-sm shadow-xs border border-[#DEC0B9]/60 hover:border-[#A53B22] hover:bg-[#FAF9F6] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[#A53B22] text-[18px]">terminal</span>
            <span>Test in Voice Playground</span>
          </button>
          {onReplayIntro && (
            <button
              onClick={onReplayIntro}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#FAF9F6] hover:bg-white text-[#57423D] hover:text-[#A53B22] font-['Outfit'] font-bold text-sm shadow-xs border border-[#DEC0B9]/60 hover:border-[#A53B22] transition-all cursor-pointer"
              title="Watch developer movie intro animation"
            >
              <span className="material-symbols-outlined text-[#FF7E5F] text-[18px]">movie</span>
              <span>Watch Intro</span>
            </button>
          )}
        </div>

        {/* Interactive Live Voice Demo / Features */}
        <div id="features" className="scroll-mt-28 w-full max-w-5xl"></div>
        <div id="voice-demo" className="relative z-10 w-full max-w-5xl rounded-3xl bg-white/95 backdrop-blur-2xl p-5 sm:p-7 border border-[#FFE6DC] shadow-xl overflow-hidden text-left scroll-mt-24">

          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#FFE6DC]/60 mb-5 gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-[#BA1A1A]/70"></span>
              <span className="w-3 h-3 rounded-full bg-[#FFAE33]"></span>
              <span className="w-3 h-3 rounded-full bg-[#00C2FF]"></span>
              <span className="font-['Outfit'] text-[11px] font-bold uppercase tracking-wider text-[#8B716B] ml-2">
                Live Voice Stream • Call ID: {liveCallId}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSimulateUtterance((activeUtteranceIndex + 1) % utterances.length)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF9F6] hover:bg-[#F3EBF8] border border-[#DEC0B9]/60 text-xs font-bold text-[#A53B22] transition-colors cursor-pointer"
                title="Click to test this voice command and see how your API runs"
              >
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                <span>Test Voice Command</span>
              </button>
              <div className="flex items-center gap-1.5 font-['Outfit'] text-xs text-[#A53B22] font-bold">
                <span className="material-symbols-outlined text-[15px] text-[#FF7E5F]">speed</span>
                <span>Response Time: {latencyProgress}ms</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Live Audio Waveform Visualizer (Left 7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-4 p-5 rounded-2xl bg-[#F8F1FE]/70 border border-[#DEC0B9]/40">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-['Outfit'] text-[11px] font-bold uppercase text-[#8B716B]">
                    Caller Speaks:
                  </span>
                  <span className="text-[11px] text-[#845400] font-mono font-semibold">
                    Live Microphone Audio
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-white border border-[#FFE6DC] shadow-sm">
                  <p className="font-['Outfit'] text-base text-[#1D1A23] italic font-medium leading-snug">
                    {currentUtterance.phrase}
                  </p>
                </div>
              </div>

              {/* Sound Ribbon SVG - Exact match to user visual specification */}
              <div className="relative w-full h-28 sm:h-32 flex items-center justify-center overflow-hidden rounded-2xl bg-[#191720] border border-[#2D2838] shadow-inner p-2">
                <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 523 109">
                  <defs>
                    <filter id="cyanGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#00C2FF" floodOpacity="0.8" />
                    </filter>
                    <filter id="amberGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#FFAE33" floodOpacity="0.85" />
                    </filter>
                  </defs>
                  {/* Solid Golden Harmonic Sine Wave */}
                  <path
                    d="M 13.0,54.5 C 42.8,74.5 66.0,74.5 95.8,54.5 C 125.6,34.5 148.8,34.5 178.6,54.5 C 208.4,74.5 231.6,74.5 261.4,54.5 C 291.2,34.5 314.4,34.5 344.2,54.5 C 374.0,74.5 397.2,74.5 427.0,54.5 C 456.8,34.5 480.0,34.5 509.8,54.5"
                    stroke="#FFAE33"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="opacity-95"
                  />
                  {/* Dashed Coral Harmonic Sine Wave (Intertwined Inverted Phase) */}
                  <path
                    d="M 13.0,54.5 C 42.8,34.5 66.0,34.5 95.8,54.5 C 125.6,74.5 148.8,74.5 178.6,54.5 C 208.4,34.5 231.6,34.5 261.4,54.5 C 291.2,74.5 314.4,74.5 344.2,54.5 C 374.0,34.5 397.2,34.5 427.0,54.5 C 456.8,74.5 480.0,74.5 509.8,54.5"
                    stroke="#FF7E5F"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    className="opacity-95 animate-wave-dash"
                  />
                  {/* Harmonic Node Anchor Points */}
                  <circle cx="95.8" cy="54.5" r="4.5" fill="#00C2FF" filter="url(#cyanGlow)" />
                  <circle cx="178.6" cy="54.5" r="4.5" fill="#FF8D7A" fillOpacity="0.85" />
                  <circle cx="261.4" cy="54.5" r="4.5" fill="#00C2FF" filter="url(#cyanGlow)" />
                  <circle cx="344.2" cy="54.5" r="6" fill="#FFAE33" filter="url(#amberGlow)" className="animate-harmonic-node" />
                  <circle cx="427.0" cy="54.5" r="4.5" fill="#00C2FF" filter="url(#cyanGlow)" />
                </svg>
                {/* Bold Live Voice Stream Monogram Label */}
                <div className="absolute bottom-2.5 right-4 font-['Outfit'] text-[11px] sm:text-[12px] font-black uppercase tracking-wider text-[#FAF9F6] select-none pointer-events-none drop-shadow">
                  LIVE VOICE STREAM
                </div>
              </div>

              {/* Action Selector Chips - Strictly 1 row without wrapping */}
              <div className="flex items-center gap-2.5 text-xs pt-1 overflow-x-auto no-scrollbar flex-nowrap">
                <span className="font-bold text-[#57423D] text-[11px] shrink-0 whitespace-nowrap">
                  Try Action Intent:
                </span>
                <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                  {utterances.map((u, i) => (
                    <button
                      key={i}
                      onClick={() => handleSimulateUtterance(i)}
                      className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1.5 text-[11px] shrink-0 whitespace-nowrap ${
                        activeUtteranceIndex === i
                          ? 'bg-[#A53B22] text-white shadow-sm'
                          : 'bg-white text-[#57423D] border border-[#FFE6DC] hover:bg-[#FAF9F6]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {i === 0 ? 'rocket_launch' : i === 1 ? 'task_alt' : 'payments'}
                      </span>
                      <span>{u.intentLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Synthesized Real-Time JSON Output Node (Right 5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-3 bg-[#1D1A23] text-[#FAF9F6] p-4 sm:p-5 rounded-2xl shadow-inner font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="font-['Outfit'] text-[11px] font-bold uppercase tracking-wider text-[#FFAE33]">
                  API Called Automatically
                </span>
                <span className="px-2 py-0.5 rounded bg-[#FF7E5F] text-white font-['Outfit'] text-[10px] font-bold">
                  EXECUTED
                </span>
              </div>

              <div className="overflow-x-auto text-[11px] leading-relaxed text-emerald-300/90 py-1">
                <div className="text-sky-300">// Your API is called immediately with exact parameters</div>
                <div className="text-[#FF7E5F] font-bold">
                  POST <span className="text-white">{currentUtterance.endpoint}</span>
                </div>
                <pre className="mt-2 text-white/90">
{`{
  "action": "${currentUtterance.action}",
  "confidence": 0.99,
  "arguments": ${JSON.stringify(currentUtterance.arguments, null, 2).replace(/\n/g, '\n  ')},
  "status": "${currentUtterance.status}"
}`}
                </pre>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span className="font-bold">200 OK • Done in 110ms</span>
                </div>
                <span className="font-['Outfit'] font-bold text-[#FFAE33]">Units Used: {currentUtterance.units}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Framework & Telephony Stack Ecosystem (Original Brand Logos) */}
      <section className="w-full px-4 sm:px-8 py-8 sm:py-12 max-w-6xl mx-auto border-b border-[#FFE6DC]/80">
        <div className="text-center mb-6">
          <span className="font-mono text-[11px] font-bold text-[#8B716B] uppercase tracking-widest">
            Works with your existing backend, databases, and telephony trunks
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            {
              name: 'FastAPI',
              type: 'Python 3.12+',
              badge: 'Async Routes',
              logo: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="11" fill="#009688" />
                  <path d="M12 3L6.5 13.5H11.5L10.5 21L17.5 10.5H12.5L12 3Z" fill="white" />
                </svg>
              )
            },
            {
              name: 'Django',
              type: 'Python ORM',
              badge: 'REST / Ninja',
              logo: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="6" fill="#092E20" />
                  <path d="M11 6H13.2V14.5C13.2 16.2 12.3 17.2 10.5 17.2C9.5 17.2 8.6 16.8 8.1 16.3L8.8 14.6C9.2 15 9.7 15.2 10.2 15.2C11 15.2 11.4 14.7 11.4 13.8V6H11ZM16.2 9.5C15.8 9.5 15.4 9.6 15.1 9.9V6H13.2V17H15.1V16.3C15.4 16.6 15.8 16.8 16.3 16.8C17.6 16.8 18.5 15.7 18.5 13.2C18.5 10.7 17.5 9.5 16.2 9.5ZM15.8 15.1C15.2 15.1 14.8 14.6 14.8 13.2C14.8 11.8 15.2 11.3 15.8 11.3C16.4 11.3 16.8 11.8 16.8 13.2C16.8 14.6 16.4 15.1 15.8 15.1Z" fill="#44B78B" />
                </svg>
              )
            },
            {
              name: 'React & Next',
              type: 'Frontend SDK',
              badge: 'WebRTC Client',
              logo: (
                <svg className="w-6 h-6" viewBox="-11.5 -10.23 23 20.46">
                  <circle cx="0" cy="0" r="2.05" fill="#00D8FF" />
                  <g stroke="#00D8FF" strokeWidth="1.2" fill="none">
                    <ellipse rx="11" ry="4.2" />
                    <ellipse rx="11" ry="4.2" transform="rotate(60)" />
                    <ellipse rx="11" ry="4.2" transform="rotate(120)" />
                  </g>
                </svg>
              )
            },
            {
              name: 'Node.js',
              type: 'Express / Nest',
              badge: 'Webhook / REST',
              logo: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2.5L3.5 7.4V17.3L12 22.2L20.5 17.3V7.4L12 2.5Z" fill="#339933" />
                  <path d="M12 6L6.5 9.2V15.5L12 18.7L17.5 15.5V9.2L12 6Z" fill="#5FA04E" />
                  <path d="M10 9.5V14.5L12 15.8L14 14.5V9.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )
            },
            {
              name: 'Twilio & SIP',
              type: 'Carrier Trunks',
              badge: 'Standard SIP',
              logo: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="11" fill="#F22F46" />
                  <circle cx="8.5" cy="8.5" r="2.2" fill="white" />
                  <circle cx="15.5" cy="8.5" r="2.2" fill="white" />
                  <circle cx="8.5" cy="15.5" r="2.2" fill="white" />
                  <circle cx="15.5" cy="15.5" r="2.2" fill="white" />
                </svg>
              )
            },
            {
              name: 'PostgreSQL',
              type: 'pgvector / RLS',
              badge: 'Deterministic',
              logo: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="6" fill="#336791" />
                  <path d="M12 4.5C8.8 4.5 6.5 6.8 6.5 10C6.5 13.2 7.8 14.8 8.8 16.5C9.2 17.5 9.7 19.5 10.7 19.5C11.7 19.5 12.1 18.5 12.1 16.5C12.1 14.5 13.5 14 14.5 13.5C15.5 13 17.5 12.2 17.5 9.5C17.5 6.2 15.2 4.5 12 4.5ZM10.2 9.5C9.6 9.5 9.2 9.1 9.2 8.5C9.2 7.9 9.6 7.5 10.2 7.5C10.8 7.5 11.2 7.9 11.2 8.5C11.2 9.1 10.8 9.5 10.2 9.5Z" fill="white" />
                </svg>
              )
            },
            {
              name: 'Docker & K8s',
              type: 'Private VPC',
              badge: 'Self-Hosted',
              logo: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="6" fill="#2496ED" />
                  <path d="M5 12H7V10H5V12ZM8 12H10V10H8V12ZM11 12H13V10H11V12ZM8 9H10V7H8V9ZM11 9H13V7H11V9ZM14 12H16V10H14V12ZM19.5 11.5C19.1 11.2 18.5 11.2 18 11.4C17.5 10.4 16.5 9.7 15.5 9.5V13H4C4 16 6.5 18 11 18C16 18 19.5 15.5 20 12.5C19.9 12.1 19.7 11.8 19.5 11.5Z" fill="white" />
                </svg>
              )
            }
          ].map((item, i) => (
            <div
              key={i}
              className="group p-3.5 rounded-2xl bg-white border border-[#FFE6DC] hover:border-[#FF7E5F] hover:shadow-md transition-all duration-200 flex flex-col items-center text-center shadow-xs"
            >
              <div className="w-11 h-11 rounded-xl bg-[#FAF9F6] border border-[#DEC0B9]/50 flex items-center justify-center group-hover:scale-105 group-hover:border-[#FF7E5F]/50 transition-all duration-200 mb-2 shadow-2xs">
                {item.logo}
              </div>
              <span className="font-['Outfit'] font-bold text-xs text-[#1D1A23] leading-tight group-hover:text-[#A53B22] transition-colors">
                {item.name}
              </span>
              <span className="text-[10px] text-[#8B716B] mt-0.5 font-mono">
                {item.type}
              </span>
              <span className="text-[9px] font-mono font-bold text-[#A53B22] bg-[#FFF6F3] border border-[#FFDAD2] px-1.5 py-0.2 rounded-full mt-2">
                {item.badge}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 5-Minute SDK Quickstart Showcase */}
      <section className="w-full px-4 sm:px-8 py-16 max-w-6xl mx-auto scroll-mt-24" id="quickstart">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div className="max-w-xl">
            <span className="font-['Outfit'] text-xs font-bold text-[#A53B22] uppercase tracking-widest">
              Quickstart
            </span>
            <h2 className="font-['Outfit'] text-3xl font-bold text-[#1D1A23] mt-1">
              Add to your app in 5 lines of code.
            </h2>
            <p className="text-sm text-[#57423D] mt-1">
              Connect voice directly to your FastAPI, Django, Node.js, or React app. Zero WebSocket setup headaches.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1 rounded-full bg-white border border-[#FFE6DC]">
            <button
              onClick={() => setActiveCodeTab('fastapi')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeCodeTab === 'fastapi' ? 'bg-[#A53B22] text-white shadow-sm' : 'text-[#57423D] hover:text-[#1D1A23]'
              }`}
            >
              FastAPI
            </button>
            <button
              onClick={() => setActiveCodeTab('django')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeCodeTab === 'django' ? 'bg-[#A53B22] text-white shadow-sm' : 'text-[#57423D] hover:text-[#1D1A23]'
              }`}
            >
              Django
            </button>
            <button
              onClick={() => setActiveCodeTab('node')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeCodeTab === 'node' ? 'bg-[#A53B22] text-white shadow-sm' : 'text-[#57423D] hover:text-[#1D1A23]'
              }`}
            >
              Node.js
            </button>
            <button
              onClick={() => setActiveCodeTab('react')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeCodeTab === 'react' ? 'bg-[#A53B22] text-white shadow-sm' : 'text-[#57423D] hover:text-[#1D1A23]'
              }`}
            >
              React / Web
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-[#1D1A23] text-white p-4 sm:p-7 border border-[#DEC0B9]/20 shadow-2xl relative">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
              <span className="text-[11px] font-mono text-white/50 ml-1.5 uppercase font-bold">{activeCodeTab} integration</span>
            </div>
            <button
              onClick={() => copyCode(
                activeCodeTab === 'fastapi' ? fastApiCode :
                activeCodeTab === 'django' ? djangoCode :
                activeCodeTab === 'node' ? nodeCode : reactCode
              )}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              <span>Copy</span>
            </button>
          </div>
          <pre className="font-mono text-xs sm:text-sm text-emerald-300 leading-relaxed overflow-x-auto py-1">
            <code>
              {activeCodeTab === 'fastapi' ? fastApiCode :
               activeCodeTab === 'django' ? djangoCode :
               activeCodeTab === 'node' ? nodeCode : reactCode}
            </code>
          </pre>
        </div>
      </section>

      {/* Feature Bento Grid (4 Core Capabilities) */}
      <section className="w-full px-4 sm:px-8 py-16 bg-[#F8F1FE]/40 scroll-mt-24" id="architecture">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="font-['Outfit'] text-xs font-bold text-[#A53B22] uppercase tracking-widest">
              Why Developers Choose T@S
            </span>
            <h2 className="font-['Outfit'] text-3xl font-bold text-[#1D1A23] mt-1">
              Fast, reliable, and built for real apps.
            </h2>
            <p className="text-sm text-[#57423D] mt-2">
              Stop waiting 3 to 5 seconds for slow voice bots. T@S turns human speech into direct API calls in under 1 second, without guessing or hallucinating.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Phone & Web Voice Calls */}
            <div className="p-7 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFDAD2] text-[#A53B22] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[24px]">call</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-[#A53B22] font-mono text-xs font-bold">
                    &lt; 850ms Speed
                  </span>
                </div>
                <h3 className="font-['Outfit'] text-xl font-bold text-[#1D1A23] mb-2 group-hover:text-[#A53B22] transition-colors">
                  Phone &amp; Web Voice Calls
                </h3>
                <p className="text-sm text-[#57423D] leading-relaxed">
                  Works over standard SIP phone lines and browser WebRTC mics with natural turn-taking and smooth interruption handling.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#FFE6DC]/60 flex items-center justify-between text-xs">
                <button
                  onClick={() => handleSelectServiceFromLanding('telephony')}
                  className="font-bold text-[#A53B22] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Explore Telephony Architecture</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
                <span className="text-[#8B716B] font-mono text-[11px]">SIP &amp; WebRTC</span>
              </div>
            </div>

            {/* Card 2: Reliable API Calling */}
            <div className="p-7 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFDDB6] text-[#845400] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[24px]">build</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-[#845400] font-mono text-xs font-bold">
                    0% Hallucinations
                  </span>
                </div>
                <h3 className="font-['Outfit'] text-xl font-bold text-[#1D1A23] mb-2 group-hover:text-[#845400] transition-colors">
                  Reliable API &amp; Tool Calling
                </h3>
                <p className="text-sm text-[#57423D] leading-relaxed">
                  Extracts exact numbers, dates, and parameters against your typed schema and triggers your code with 100% precision.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#FFE6DC]/60 flex items-center justify-between text-xs">
                <button
                  onClick={() => onNavigate('visual-tool-builder')}
                  className="font-bold text-[#845400] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Tool Builder</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
                <span className="text-[#8B716B] font-mono text-[11px]">Strict API Contracts</span>
              </div>
            </div>

            {/* Card 3: Instant Brand Voices */}
            <div className="p-7 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#C2E8FF] text-[#006688] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[24px]">graphic_eq</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-[#006688] font-mono text-xs font-bold">
                    6-Sec Setup
                  </span>
                </div>
                <h3 className="font-['Outfit'] text-xl font-bold text-[#1D1A23] mb-2 group-hover:text-[#006688] transition-colors">
                  Instant Custom Brand Voices
                </h3>
                <p className="text-sm text-[#57423D] leading-relaxed">
                  Create a natural brand voice persona from just 6 seconds of sample audio with conversational cadence and low latency.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#FFE6DC]/60 flex items-center justify-between text-xs">
                <button
                  onClick={onOpenWizard}
                  className="font-bold text-[#006688] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Create a Voice Profile</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
                <span className="text-[#8B716B] font-mono text-[11px]">WAV / Mic Sample</span>
              </div>
            </div>

            {/* Card 4: Private by Default */}
            <div className="p-7 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#EDE5F2] text-[#1D1A23] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[24px]">shield</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-[#1D1A23] font-mono text-xs font-bold">
                    Zero Disk Storage
                  </span>
                </div>
                <h3 className="font-['Outfit'] text-xl font-bold text-[#1D1A23] mb-2 group-hover:text-[#A53B22] transition-colors">
                  Private by Default (Zero Audio Saved)
                </h3>
                <p className="text-sm text-[#57423D] leading-relaxed">
                  Speech packets exist in volatile RAM only and are scrubbed with memory zeroization upon execution. Zero audio on disk.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#FFE6DC]/60 flex items-center justify-between text-xs">
                <button
                  onClick={() => scrollToSection('security')}
                  className="font-bold text-[#1D1A23] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>View Security Architecture</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
                <span className="text-[#8B716B] font-mono text-[11px]">In-Memory Pipeline</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Developers Switch: Traditional Voice Bots vs. T@S */}
      <section className="w-full px-4 sm:px-8 py-16 max-w-6xl mx-auto scroll-mt-24" id="comparison">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="font-['Outfit'] text-xs font-bold text-[#A53B22] uppercase tracking-widest">
            Why Developers Switch
          </span>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl font-bold text-[#1D1A23] mt-1">
            Built for execution, not awkward small talk.
          </h2>
          <p className="text-sm text-[#57423D] mt-2">
            Most voice bots chain three slow cloud services together. T@S triggers your real backend code in a single deterministic loop.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Column 1: The Old Way (Traditional Voice Bots) */}
          <div className="rounded-3xl bg-[#FAF9F6] border border-[#DEC0B9]/80 p-6 sm:p-8 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#DEC0B9]/60 mb-6">
                <div>
                  <span className="font-mono text-[10px] font-bold text-[#8B716B] uppercase tracking-wider block">
                    The Fragile Old Way
                  </span>
                  <h3 className="font-['Outfit'] font-bold text-xl text-[#57423D] mt-0.5">
                    Traditional 3-Layer Voice Bots
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-mono text-xs font-bold">
                  Legacy
                </span>
              </div>

              <div className="space-y-4">
                {[
                  {
                    title: 'Slow 3 to 5 Second Silences',
                    desc: 'Chains STT -> LLM -> TTS sequentially, creating awkward delays that frustrate callers.'
                  },
                  {
                    title: 'Generative Hallucinations',
                    desc: 'Text LLMs invent non-existent booking slots, wrong prices, and false confirmation codes.'
                  },
                  {
                    title: 'Audio Saved on 3rd-Party Disks',
                    desc: 'Voice recordings linger on multiple third-party vendor servers, risking compliance leaks.'
                  },
                  {
                    title: 'Opaque Per-Minute Metering',
                    desc: 'Billed for every second of silence and stutter, resulting in surprise monthly invoices.'
                  }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-red-500 text-[18px] shrink-0 mt-0.5">
                      close
                    </span>
                    <div>
                      <span className="font-['Outfit'] font-bold text-sm text-[#1D1A23] block">
                        {item.title}
                      </span>
                      <span className="text-xs text-[#8B716B] leading-relaxed">
                        {item.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#DEC0B9]/60 font-mono text-xs text-[#8B716B]">
              Average Latency: <strong className="text-red-600 font-bold">3,800ms - 5,200ms</strong>
            </div>
          </div>

          {/* Column 2: The New Way (T@S Acoustic Action Engine) */}
          <div className="rounded-3xl bg-white border-2 border-[#FF7E5F] p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-[#FF7E5F] to-[#FFAE33] text-white text-[10px] font-bold font-mono px-4 py-1 rounded-bl-xl uppercase tracking-wider">
              T@S Advantage
            </div>

            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#FFE6DC] mb-6">
                <div>
                  <span className="font-mono text-[10px] font-bold text-[#A53B22] uppercase tracking-wider block">
                    The Modern Standard
                  </span>
                  <h3 className="font-['Outfit'] font-bold text-xl text-[#1D1A23] mt-0.5">
                    T@S Acoustic Action Router
                  </h3>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  {
                    title: 'Sub-850ms Instant Execution',
                    desc: 'Acoustic parser matches intent and dispatches your backend API in under 1 second.'
                  },
                  {
                    title: '0% Hallucination Guarantee',
                    desc: 'Deterministic parameter extraction strictly validated against your OpenAPI schema.'
                  },
                  {
                    title: 'Zero Audio Saved on Disk',
                    desc: 'Streams are processed in-memory and wiped instantly upon packet execution.'
                  },
                  {
                    title: 'Predictable Action Unit Billing',
                    desc: 'Pay strictly for successful API executions and speech tokens. Zero hidden overhead.'
                  }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">
                      check_circle
                    </span>
                    <div>
                      <span className="font-['Outfit'] font-bold text-sm text-[#1D1A23] block">
                        {item.title}
                      </span>
                      <span className="text-xs text-[#57423D] leading-relaxed">
                        {item.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#FFE6DC] flex items-center justify-between font-mono text-xs">
              <span className="text-[#57423D]">Average Latency:</span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                ⚡ Sub-850ms P95
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Unit Pricing & INR Calculator */}
      <section className="w-full px-4 sm:px-8 py-16 max-w-6xl mx-auto scroll-mt-24" id="pricing">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="font-['Outfit'] text-xs font-bold text-[#A53B22] uppercase tracking-widest">
            Simple, Fair Pricing
          </span>
          <h2 className="font-['Outfit'] text-3xl font-bold text-[#1D1A23] mt-1">
            Pay only when your code runs.
          </h2>
          <p className="text-sm text-[#57423D] mt-2">
            No surprise token bills. You only pay for user questions, voice replies, and API calls.
          </p>
        </div>

        {/* Multiplier Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-white border border-[#FFE6DC] shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#8B716B] uppercase font-['Outfit']">Text Question</span>
              <div className="font-['Outfit'] text-2xl font-bold text-[#1D1A23]">1 Unit</div>
            </div>
            <span className="material-symbols-outlined text-[#845400] text-[28px]">chat</span>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-[#FFE6DC] shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#8B716B] uppercase font-['Outfit']">Voice Turn (Speak &amp; Reply)</span>
              <div className="font-['Outfit'] text-2xl font-bold text-[#1D1A23]">2 Units</div>
            </div>
            <span className="material-symbols-outlined text-[#FF5F45] text-[28px]">graphic_eq</span>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-[#FFE6DC] shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#8B716B] uppercase font-['Outfit']">API Tool Call</span>
              <div className="font-['Outfit'] text-2xl font-bold text-[#1D1A23]">3 Units</div>
            </div>
            <span className="material-symbols-outlined text-[#00C2FF] text-[28px]">bolt</span>
          </div>
        </div>

        {/* Interactive INR Cost Calculator */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#FFE6DC] shadow-xl mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#FFE6DC]">
            <div>
              <h3 className="font-['Outfit'] text-xl font-bold text-[#1D1A23]">Estimate Your Monthly Cost</h3>
              <p className="text-xs text-[#57423D] mt-0.5">
                Slide to estimate your bill based on monthly usage.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-[#8B716B] uppercase font-['Outfit']">
                Estimated Monthly Cost
              </span>
              <div className="font-['Outfit'] text-3xl sm:text-4xl font-extrabold text-[#A53B22]">
                ₹{calculatedCost.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="py-6">
            <div className="flex justify-between items-center mb-2 text-xs font-semibold">
              <span className="text-[#57423D]">Monthly Units:</span>
              <span className="font-bold text-[#1D1A23] font-mono text-sm">
                {units.toLocaleString('en-IN')} units
              </span>
            </div>
            <input
              type="range"
              min={10000}
              max={500000}
              step={5000}
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
              className="w-full h-2.5 bg-[#EDE5F2] rounded-lg appearance-none cursor-pointer accent-[#FF7E5F]"
            />
            <div className="flex justify-between text-[11px] text-[#8B716B] mt-2 font-mono">
              <span>10k units (Starter)</span>
              <span>100k units</span>
              <span>500k units (High Volume)</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <div>
              <span className="font-bold text-[#845400]">Standard Voice Bots:</span>
              <span className="text-[#1D1A23] font-mono ml-2">
                ~₹{competitorCost.toLocaleString('en-IN')} / mo on per-minute token billing
              </span>
            </div>
            <div className="px-3.5 py-1.5 rounded-full bg-[#FFDDB6] text-[#643F00] font-bold font-['Outfit']">
              {savingsPercent}% Lower Cost with T@S
            </div>
          </div>
        </div>

        {/* Real Dynamic Tier Cards with Razorpay Live Integration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Free Tier */}
          <div className="p-7 rounded-3xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between">
            <div>
              <span className="font-['Outfit'] text-xs font-bold uppercase text-[#8B716B]">Developer Free</span>
              <div className="font-['Outfit'] text-3xl font-bold text-[#1D1A23] my-2">₹0</div>
              <p className="text-xs text-[#57423D] mb-6">Ideal for local experiments, prototyping, and personal developer agents.</p>
              <ul className="space-y-2 text-xs text-[#57423D]">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> {(platformConfig?.free_tier_units || 2000).toLocaleString('en-IN')} units / month</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> Community Discord Support</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> 1 Concurrent Voice Stream</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> Local SQLite / pgvector</li>
              </ul>
            </div>
            <button
              onClick={() => {
                if (developer) {
                  onNavigate('subscription-pricing');
                } else {
                  onOpenAuth('Sign in or register to start building with Developer Free.', 'subscription-pricing');
                }
              }}
              className="w-full mt-6 py-2.5 rounded-full bg-white text-[#1D1A23] font-bold text-xs border border-[#FFE6DC] hover:bg-[#F8F1FE] transition-colors"
            >
              Start Free
            </button>
          </div>

          {/* Growth Startup Tier (Most Popular) with Real Razorpay */}
          <div className="p-7 rounded-3xl bg-white border-2 border-[#FF7E5F] shadow-xl relative flex flex-col justify-between">
            <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-[#FF7E5F] text-white font-['Outfit'] text-[10px] font-bold uppercase">
              MOST POPULAR
            </div>
            <div>
              <span className="font-['Outfit'] text-xs font-bold uppercase text-[#A53B22]">Growth Startup</span>
              <div className="font-['Outfit'] text-3xl font-bold text-[#1D1A23] my-2">
                ₹{(platformConfig?.growth_price_inr || platformConfig?.starter_price_inr || 1999).toLocaleString('en-IN')}<span className="text-xs text-[#8B716B] font-normal">/mo</span>
              </div>
              <p className="text-xs text-[#57423D] mb-6">Engineered for production apps needing reliability and instant latency.</p>
              <ul className="space-y-2 text-xs text-[#57423D]">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> {(platformConfig?.growth_tier_units || 50000).toLocaleString('en-IN')} units included</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> {platformConfig?.grace_buffer_pct || 10}% Grace Unit Buffer</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> Sub-850ms latency guarantee</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> 25 Concurrent Channels</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> Priority WhatsApp & Slack Bridge</li>
              </ul>
            </div>
            <button
              onClick={() => {
                if (developer) {
                  onNavigate('subscription-pricing');
                } else {
                  onOpenAuth('Sign in or register to complete your Growth Startup subscription.', 'subscription-pricing');
                }
              }}
              className="w-full mt-6 py-2.5 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">payments</span>
              <span>Deploy Growth (₹{(platformConfig?.growth_price_inr || platformConfig?.starter_price_inr || 1999).toLocaleString('en-IN')})</span>
            </button>
          </div>

          {/* Enterprise Dedicated */}
          <div className="p-7 rounded-3xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between">
            <div>
              <span className="font-['Outfit'] text-xs font-bold uppercase text-[#8B716B]">Enterprise Dedicated</span>
              <div className="font-['Outfit'] text-3xl font-bold text-[#1D1A23] my-2">Custom</div>
              <p className="text-xs text-[#57423D] mb-6">Dedicated Kubernetes air-gapped clusters for healthcare and fintech.</p>
              <ul className="space-y-2 text-xs text-[#57423D]">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> Unlimited volume pricing</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> On-Premises bare metal install</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> 99.99% Execution SLA</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#A53B22] text-[16px]">check</span> Custom acoustics fine-tuning</li>
              </ul>
            </div>
            <button
              onClick={() => {
                if (developer) {
                  onNavigate('subscription-pricing');
                } else {
                  onOpenAuth('Sign in or register to inspect Enterprise plans.', 'subscription-pricing');
                }
              }}
              className="w-full mt-6 py-2.5 rounded-full bg-white text-[#1D1A23] font-bold text-xs border border-[#FFE6DC] hover:bg-[#F8F1FE] transition-colors text-center block"
            >
              Deploy Enterprise
            </button>
          </div>
        </div>
      </section>

      {/* Enterprise Security & Privacy Architecture Showcase (Humanized Bento Layout) */}
      <section className="w-full px-4 sm:px-8 py-20 max-w-6xl mx-auto border-t border-[#FFE6DC]/80 scroll-mt-24" id="security">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-[#1D1A23] tracking-tight leading-tight">
            Human privacy by design.<br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#A53B22] via-[#FF7E5F] to-[#FFAE33] bg-clip-text text-transparent">
              {' '}Zero caller voice ever touches a hard drive.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-[#57423D] mt-3.5 leading-relaxed">
            We architected T@S so you never have to trade caller trust for conversational speed. From volatile RAM stream parsing to air-gapped VPCs and one-way vocal cryptography, your data stays strictly under your command.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FAF9F6] border border-[#DEC0B9]/60 shadow-2xs">
            <span className="font-cursive text-lg sm:text-xl text-[#1D1A23] font-bold">
              ~ "If someone physically seized our production hardware, zero caller audio could ever be recovered."
            </span>
          </div>
        </div>

        {/* Bento Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Card 1: The Ephemeral In-Memory Pipeline (7 cols) */}
          <div className="lg:col-span-7 rounded-3xl bg-white border border-[#FFE6DC] p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#FF7E5F] via-[#FFAE33] to-[#FF7E5F]" />
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF6F3] border border-[#FFDAD2] text-[#A53B22] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[26px]">memory</span>
                  </div>
                  <div>
                    <span className="font-['Outfit'] text-[11px] font-bold text-[#A53B22] uppercase tracking-wider block">
                      Kernel Pipeline
                    </span>
                    <h3 className="font-['Outfit'] font-bold text-xl sm:text-2xl text-[#1D1A23]">
                      Zero Audio Persistence
                    </h3>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  100% Volatile RAM
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#57423D] leading-relaxed mt-2">
                Caller audio arrives over encrypted SIP/WebRTC and lives strictly in volatile system memory for acoustic phoneme extraction. As soon as your API endpoint receives the evaluated intent, the RAM buffer is immediately scrubbed with null-byte memory zeroization.
              </p>

              {/* Visual Pipeline Flow Diagram */}
              <div className="mt-6 p-4 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] space-y-3">
                <div className="text-[11px] font-bold font-['Outfit'] uppercase tracking-wider text-[#8B716B] flex items-center justify-between">
                  <span>Acoustic Lifecycle Mechanics</span>
                  <span className="text-emerald-700 font-mono text-[10px]">Auto-Purge &lt; 15ms</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-[#FFE6DC] shadow-2xs flex flex-col items-center justify-center">
                    <span className="text-[10px] font-mono font-bold text-[#A53B22]">01. RTP Packet</span>
                    <span className="text-[11px] font-medium text-[#1D1A23] mt-1">Inbound Stream</span>
                    <span className="text-[9px] text-[#8B716B] mt-0.5">TLS/SRTP 128-bit</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#FFE6DC] shadow-2xs flex flex-col items-center justify-center">
                    <span className="text-[10px] font-mono font-bold text-[#845400]">02. RAM Ring</span>
                    <span className="text-[11px] font-medium text-[#1D1A23] mt-1">Phoneme Vector</span>
                    <span className="text-[9px] text-[#8B716B] mt-0.5">Volatile Memory</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#FFE6DC] shadow-2xs flex flex-col items-center justify-center">
                    <span className="text-[10px] font-mono font-bold text-sky-700">03. Tool Call</span>
                    <span className="text-[11px] font-medium text-[#1D1A23] mt-1">REST API Trigger</span>
                    <span className="text-[9px] text-[#8B716B] mt-0.5">Executed in 110ms</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-2xs flex flex-col items-center justify-center">
                    <span className="text-[10px] font-mono font-bold text-emerald-800">04. Scrubbed</span>
                    <span className="text-[11px] font-medium text-emerald-900 mt-1">Memory Zeroed</span>
                    <span className="text-[9px] text-emerald-700 mt-0.5">explicit_bzero</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hardware Guarantees */}
            <div className="mt-6 pt-4 border-t border-[#FFE6DC] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-[#57423D]">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-[#A53B22] text-[18px]">block</span>
                  <span>Disk I/O: <strong className="text-[#1D1A23]">0.00 KB</strong></span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-[#A53B22] text-[18px]">psychology_alt</span>
                  <span>Model Training: <strong className="text-[#1D1A23]">Never</strong></span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#A53B22] bg-[#FFF6F3] border border-[#FFDAD2] px-2.5 py-1 rounded-lg">
                Audited Ephemeral Runtime
              </span>
            </div>
          </div>

          {/* Card 2: Self-Hosted VPC & Air-Gapped Telephony (5 cols) */}
          <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-white via-[#FFFDF8] to-[#FFF9EB] border border-[#FDE047]/70 p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#FFAE33] to-[#845400]" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF9EB] border border-[#FDE047] text-[#845400] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[26px]">lan</span>
                </div>
                <span className="text-xs font-mono font-bold text-[#845400] bg-[#FFF9EB] border border-[#FDE047] px-3 py-1 rounded-full">
                  Air-Gapped Capable
                </span>
              </div>

              <span className="font-['Outfit'] text-[11px] font-bold text-[#845400] uppercase tracking-wider block">
                Network Perimeter
              </span>
              <h3 className="font-['Outfit'] font-bold text-xl sm:text-2xl text-[#1D1A23] mt-0.5">
                Private Cloud &amp; On-Premises
              </h3>
              <p className="text-xs sm:text-sm text-[#57423D] leading-relaxed mt-2">
                Deploy T@S entirely inside your isolated AWS VPC, Azure Kubernetes, or bare-metal servers. Telephony terminates directly inside your private subnet—zero outbound egress to external servers.
              </p>

              {/* Subnet Topology Visual */}
              <div className="mt-5 p-3.5 rounded-2xl bg-white border border-[#FDE047]/70 shadow-2xs">
                <div className="text-[10px] font-mono font-bold text-[#845400] uppercase mb-2 flex items-center justify-between">
                  <span>Corporate Firewall Boundary</span>
                  <span className="text-emerald-700">Subnet Isolated</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-[#1D1A23]">
                    <span className="material-symbols-outlined text-[16px] text-[#A53B22]">call</span>
                    <span>Carrier SIP</span>
                  </div>
                  <span className="text-[#8B716B] font-mono">&rarr;</span>
                  <div className="px-2 py-0.5 rounded bg-[#1D1A23] text-white font-mono text-[10px] font-bold">
                    T@S Local Pod
                  </div>
                  <span className="text-[#8B716B] font-mono">&rarr;</span>
                  <div className="flex items-center gap-1.5 font-medium text-[#1D1A23]">
                    <span className="material-symbols-outlined text-[16px] text-emerald-700">database</span>
                    <span>Internal DB</span>
                  </div>
                </div>
                <div className="text-[10px] text-[#8B716B] mt-2 flex items-center justify-between">
                  <span>Public Internet Egress:</span>
                  <span className="font-bold text-[#A53B22] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">cancel</span> Blocked
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#FDE047]/60 flex items-center justify-between text-xs">
              <span className="text-[#57423D] font-medium">Ready Targets:</span>
              <div className="flex gap-1.5 font-mono text-[10px] font-bold text-[#845400]">
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#FDE047]">Docker</span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#FDE047]">K8s Helm</span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#FDE047]">Bare Metal</span>
              </div>
            </div>
          </div>

          {/* Card 3: Cryptographic Vocal Passphrase (6 cols) */}
          <div className="lg:col-span-6 rounded-3xl bg-white border border-[#FFE6DC] p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#FF7E5F] to-[#BA1A1A]" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF6F3] border border-[#FFDAD2] text-[#A53B22] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[26px]">key</span>
                </div>
                <span className="text-xs font-mono font-bold text-[#A53B22] bg-[#FFF6F3] border border-[#FFDAD2] px-3 py-1 rounded-full">
                  One-Way Hashes
                </span>
              </div>

              <span className="font-['Outfit'] text-[11px] font-bold text-[#A53B22] uppercase tracking-wider block">
                Biometric Sovereignty
              </span>
              <h3 className="font-['Outfit'] font-bold text-xl sm:text-2xl text-[#1D1A23] mt-0.5">
                Vocal Security Without Voice Harvesting
              </h3>
              <p className="text-xs sm:text-sm text-[#57423D] leading-relaxed mt-2">
                Unlike voice platforms that harvest raw speaker embeddings (susceptible to deepfake voice cloning), T@S treats voice passphrases like passwords. High-risk actions like wire transfers, medical chart access, or password resets are gated with one-way bcrypt salted hashes.
              </p>

              {/* Cryptographic Visual Schema */}
              <div className="mt-5 p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC]">
                <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-[#FFE6DC]/80">
                  <span className="text-[#8B716B]">Spoken Verification:</span>
                  <span className="text-[#1D1A23] font-bold">"Authorize wire transfer 902"</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono pt-2">
                  <span className="text-[#8B716B]">Irreversible Hash:</span>
                  <span className="text-[#A53B22] font-bold tracking-tight">$2b$12$k89vocal_salt...</span>
                </div>
                <div className="mt-2 text-[10px] text-emerald-700 flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  <span>Raw voice recording discarded immediately. Zero biometrics stored.</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#FFE6DC] flex items-center justify-between text-xs">
              <span className="text-[#57423D] italic">"Never store raw human voice biometrics."</span>
              <span className="font-mono text-[10px] font-bold text-[#A53B22] bg-[#FFF6F3] border border-[#FFDAD2] px-2.5 py-0.5 rounded-md">
                OWASP Level 3
              </span>
            </div>
          </div>

          {/* Card 4: Audited Compliance, DPAs & SLAs (6 cols) */}
          <div className="lg:col-span-6 rounded-3xl bg-gradient-to-br from-white via-[#FCF9FD] to-[#F8F1FE] border border-[#DEC0B9]/60 p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#A53B22] to-[#FF7E5F]" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#F8F1FE] border border-[#DEC0B9]/60 text-[#1D1A23] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[26px]">verified</span>
                </div>
                <span className="text-xs font-mono font-bold text-[#1D1A23] bg-[#F8F1FE] border border-[#DEC0B9]/60 px-3 py-1 rounded-full">
                  Audited &amp; Governed
                </span>
              </div>

              <span className="font-['Outfit'] text-[11px] font-bold text-[#A53B22] uppercase tracking-wider block">
                Enterprise Assurance
              </span>
              <h3 className="font-['Outfit'] font-bold text-xl sm:text-2xl text-[#1D1A23] mt-0.5">
                SOC 2 Type II, GDPR DPAs &amp; SLAs
              </h3>
              <p className="text-xs sm:text-sm text-[#57423D] leading-relaxed mt-2">
                We back our architecture with legally binding Data Processing Agreements (DPAs), guaranteed 99.98% high-throughput telephony SLAs, PostgreSQL pgvector tenant isolation with Row-Level Security, and HIPAA-ready BAAs.
              </p>

              {/* Trust Badges & Action Buttons */}
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-lg bg-white border border-[#DEC0B9]/60 font-mono text-[11px] font-bold text-[#1D1A23] shadow-2xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600">verified_user</span>
                  SOC 2 Type II Ready
                </span>
                <span className="px-3 py-1 rounded-lg bg-white border border-[#DEC0B9]/60 font-mono text-[11px] font-bold text-[#1D1A23] shadow-2xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600">gavel</span>
                  GDPR Article 28 DPA
                </span>
                <span className="px-3 py-1 rounded-lg bg-white border border-[#DEC0B9]/60 font-mono text-[11px] font-bold text-[#1D1A23] shadow-2xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600">health_and_safety</span>
                  HIPAA BAA Capable
                </span>
                <span className="px-3 py-1 rounded-lg bg-white border border-[#DEC0B9]/60 font-mono text-[11px] font-bold text-[#1D1A23] shadow-2xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600">speed</span>
                  99.98% Telephony SLA
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#DEC0B9]/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <button
                onClick={() => onOpenLegalModal?.('security')}
                className="font-bold text-[#A53B22] hover:text-[#1D1A23] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Read Security Whitepaper</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
              <button
                onClick={() => onOpenLegalModal?.('privacy')}
                className="font-medium text-[#57423D] hover:underline cursor-pointer"
              >
                Review Data Processing Agreement
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="w-full px-4 sm:px-8 py-16 max-w-4xl mx-auto scroll-mt-24" id="faq">
        <div className="text-center mb-8">
          <span className="font-['Outfit'] text-xs font-bold text-[#A53B22] uppercase tracking-widest">
            Got Questions?
          </span>
          <h2 className="font-['Outfit'] text-3xl font-bold text-[#1D1A23] mt-1">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {[
            {
              q: 'How does T@S respond in under 1 second?',
              a: 'Traditional voice bots chain three slow services together: speech-to-text, a slow chatbot, and text-to-speech, taking 3 to 5 awkward seconds. T@S processes voice and triggers your API in a single fast loop, replying in under 850 milliseconds.'
            },
            {
              q: 'Can we run T@S on our own private servers?',
              a: 'Yes. You can run T@S completely inside your own private cloud or internal network. Your audio streams and sensitive data never leave your private servers, making it safe for healthcare, banking, and internal tools.'
            },
            {
              q: 'How does T@S avoid accidental triggers from background noise?',
              a: 'T@S automatically filters out coughing, typing, and room noise. Your API is only called when someone intentionally speaks a clear, recognized request.'
            }
          ].map((item, idx) => (
            <details
              key={idx}
              className="group p-5 rounded-2xl bg-white border border-[#FFE6DC] shadow-sm [&_summary::-webkit-details-marker]:hidden cursor-pointer"
            >
              <summary className="flex items-center justify-between font-['Outfit'] text-base font-semibold text-[#1D1A23]">
                <span>{item.q}</span>
                <span className="material-symbols-outlined text-[#A53B22] group-open:rotate-180 transition-transform">
                  expand_more
                </span>
              </summary>
              <p className="text-xs sm:text-sm text-[#57423D] mt-3 leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Footer CTA Container */}
      <section className="w-full px-4 sm:px-8 pb-12">
        <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-r from-[#FF7E5F] via-[#FF5F45] to-[#FFAE33] p-10 sm:p-14 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="font-['Outfit'] text-3xl sm:text-4xl font-extrabold mb-3">
              Give your backend a real-time voice.
            </h2>
            <p className="text-sm text-white/90 mb-6">
              Join thousands of developers turning speech into reliable code execution. Get started free in less than 2 minutes.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4">
              <button
                onClick={() => {
                  if (developer) {
                    onNavigate('live-voice-playground');
                  } else {
                    onOpenAuth('Sign in or register to test the live voice playground.');
                  }
                }}
                className="px-8 py-3 rounded-full bg-white text-[#1D1A23] font-['Outfit'] font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                Test Live in Playground
              </button>
              <button
                onClick={() => {
                  if (developer) {
                    onOpenWizard();
                  } else {
                    onOpenAuth('Sign in to launch your personalized calibration wizard.');
                  }
                }}
                className="px-6 py-3 rounded-full bg-white/20 backdrop-blur-md text-white font-['Outfit'] font-bold text-xs hover:bg-white/30 transition-all"
              >
                Quick Setup Wizard →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Landing Page Footer */}
      <footer id="contact" className="w-full bg-[#18161D] text-[#A49BAF] border-t border-[#2F293A] pt-14 pb-8 px-4 sm:px-8 mt-12 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-[#2C2736]">
            {/* Brand & Slogan Column */}
            <div className="space-y-3.5">
              <TASLogo
                theme="dark"
                animated={true}
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />

              {/* Slogan with Humanized Warm Color & Cursive Font (No Dots) */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#2A2330] border border-[#443850] shadow-xs">
                  <span className="font-cursive text-2xl font-bold tracking-wider text-[#FFB0A3]">
                    Talk. Decide. Solve.
                  </span>
                </div>
                {onReplayIntro && (
                  <button
                    onClick={onReplayIntro}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#231E2A] hover:bg-[#342D3B] border border-[#3A3245] text-[#FFD1C7] text-[10px] font-semibold transition-colors cursor-pointer"
                    title="Replay platform movie intro animation"
                  >
                    <span className="material-symbols-outlined text-[13px] text-[#FF7E5F]">movie</span>
                    <span>Replay Intro</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-[#8B8196] leading-relaxed">
                Turn spoken words into real API actions in real time. Fast, private, and built for developers.
              </p>

              {/* Social Links */}
              <div className="pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B8196] mb-2 font-['Outfit']">Connect &amp; Community</div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://github.com/tusharsune/T-AT-S"
                    target="_blank"
                    rel="noreferrer"
                    title="GitHub Repository"
                    className="w-8 h-8 rounded-xl bg-[#231E2A] hover:bg-[#FF7E5F] hover:text-white border border-[#3A3245] flex items-center justify-center text-[#A49BAF] transition-all hover:scale-105"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                  </a>
                  <a
                    href="https://x.com"
                    target="_blank"
                    rel="noreferrer"
                    title="Follow on X / Twitter"
                    className="w-8 h-8 rounded-xl bg-[#231E2A] hover:bg-[#FF7E5F] hover:text-white border border-[#3A3245] flex items-center justify-center text-[#A49BAF] transition-all hover:scale-105"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noreferrer"
                    title="LinkedIn"
                    className="w-8 h-8 rounded-xl bg-[#231E2A] hover:bg-[#FF7E5F] hover:text-white border border-[#3A3245] flex items-center justify-center text-[#A49BAF] transition-all hover:scale-105"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.53 1.53 0 0 0 0-3.06 1.53 1.53 0 0 0 0 3.06m1.4 9.74v-8.37H5.06v8.37z"/></svg>
                  </a>
                  <a
                    href="https://discord.gg"
                    target="_blank"
                    rel="noreferrer"
                    title="Discord Developer Community"
                    className="w-8 h-8 rounded-xl bg-[#231E2A] hover:bg-[#FF7E5F] hover:text-white border border-[#3A3245] flex items-center justify-center text-[#A49BAF] transition-all hover:scale-105"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Services Column */}
            <div className="space-y-2.5">
              <h4 className="font-['Outfit'] text-xs font-bold uppercase tracking-wider text-white">
                Services
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => handleSelectServiceFromLanding('telephony')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Autonomous Telephony
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleSelectServiceFromLanding('tool_calling')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Real-Time Tool Calling
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleSelectServiceFromLanding('voice_synthesis')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Zero-Shot Voice Synthesis
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleSelectServiceFromLanding('cluster_isolation')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Air-Gapped App Workspaces
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleSelectServiceFromLanding('telemetry_metering')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Fair Unit Accounting
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleSelectServiceFromLanding('developer_sdk')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Developer SDKs &amp; Templates
                  </button>
                </li>
              </ul>
            </div>

            {/* Quick Links Column */}
            <div className="space-y-2.5">
              <h4 className="font-['Outfit'] text-xs font-bold uppercase tracking-wider text-white">
                Quick Links
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button onClick={() => onNavigate('about')} className="hover:text-white transition-colors cursor-pointer text-left">
                    About T@S
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleSelectServiceFromLanding(null)}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Core Capabilities
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('subscription-pricing')} className="hover:text-white transition-colors cursor-pointer text-left">
                    Subscriptions &amp; Units
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('live-voice-playground')} className="hover:text-white transition-colors cursor-pointer text-left">
                    Voice Playground
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('visual-tool-builder')} className="hover:text-white transition-colors cursor-pointer text-left">
                    OpenAPI Tool Builder
                  </button>
                </li>
                <li>
                  <a href="#quickstart" className="hover:text-white transition-colors">
                    Developer SDK &amp; Docs
                  </a>
                </li>
                <li>
                  <a href="#security" className="hover:text-white transition-colors">
                    Security &amp; Data Sovereignty
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    Frequently Asked Questions
                  </a>
                </li>
              </ul>
            </div>

            {/* Help & Contact Column */}
            <div className="space-y-3">
              <h4 className="font-['Outfit'] text-xs font-bold uppercase tracking-wider text-white">
                Help &amp; Contact
              </h4>
              
              {/* Help Email */}
              <a
                href="mailto:ts.help2407@gmail.com"
                className="flex items-center gap-2.5 p-2 rounded-xl bg-[#231E2A] hover:bg-[#2C2534] border border-[#3A3245] transition-all group"
                title="Send email to Help Desk"
              >
                <span className="material-symbols-outlined text-[18px] text-[#FF7E5F] shrink-0">mail</span>
                <div className="min-w-0">
                  <div className="text-[10px] text-[#8B8196] uppercase font-bold tracking-wider">Help Desk</div>
                  <div className="text-xs font-mono text-[#E4DFEA] group-hover:text-white truncate">ts.help2407@gmail.com</div>
                </div>
              </a>

              {/* Service Email */}
              <a
                href="mailto:support@tats.ai"
                className="flex items-center gap-2.5 p-2 rounded-xl bg-[#231E2A] hover:bg-[#2C2534] border border-[#3A3245] transition-all group"
                title="Send email to Technical Support"
              >
                <span className="material-symbols-outlined text-[18px] text-[#FFAE33] shrink-0">headset_mic</span>
                <div className="min-w-0">
                  <div className="text-[10px] text-[#8B8196] uppercase font-bold tracking-wider">Service &amp; Ops</div>
                  <div className="text-xs font-mono text-[#E4DFEA] group-hover:text-white truncate">support@tats.ai</div>
                </div>
              </a>

              {/* Direct Contact Button */}
              <a
                href="mailto:ts.help2407@gmail.com?subject=T%40S%20Platform%20Inquiry"
                className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#FF7E5F] to-[#FFAE33] hover:from-[#FF6B47] hover:to-[#FF9E1B] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>Contact Team</span>
              </a>
            </div>
          </div>

          {/* Bottom Legal & Industry Standard Bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8B8196]">
            <div>
              &copy; {new Date().getFullYear()} T@S (Talk. Decide. Solve.). All rights reserved.
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] text-[#8B8196]">
              <button
                onClick={() => onOpenLegalModal?.('privacy')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
              <span>&bull;</span>
              <button
                onClick={() => onOpenLegalModal?.('terms')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Terms of Service
              </button>
              <span>&bull;</span>
              <button
                onClick={() => onOpenLegalModal?.('security')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Security &amp; DPAs
              </button>
              <span>&bull;</span>
              <button
                onClick={() => onOpenLegalModal?.('cookies')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Cookie Settings
              </button>
              <span>&bull;</span>
              <button
                onClick={() => onOpenLegalModal?.('status')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Status Page
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
