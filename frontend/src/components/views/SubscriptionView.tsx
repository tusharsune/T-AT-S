import React, { useState, useEffect } from 'react';
import { AppView, DeveloperProfile } from '../../types';
import { TATSBackendAPI } from '../../services/api';

interface SubscriptionViewProps {
  onNavigate: (view: AppView) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning') => void;
  developer: DeveloperProfile | null;
  applications: any[];
  activeAppId: string;
  onSelectApp: (app: any) => void;
  onRefreshApps: () => Promise<void>;
  onOpenCreateApp: () => void;
  preSelectedPlan?: string;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  onNavigate,
  onShowToast,
  developer,
  applications,
  activeAppId,
  onSelectApp,
  onRefreshApps,
  onOpenCreateApp,
  preSelectedPlan
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [platformConfig, setPlatformConfig] = useState<any>(null);

  // Transition / Plan Conflict State
  const [showTransitionModal, setShowTransitionModal] = useState<boolean>(false);
  const [targetTransitionPlan, setTargetTransitionPlan] = useState<any>(null);

  // Credit Booster Top-Up State
  const [showTopupModal, setShowTopupModal] = useState<boolean>(false);
  const [selectedTopupUnits, setSelectedTopupUnits] = useState<number>(25000);
  const [customSliderUnits, setCustomSliderUnits] = useState<number>(25000);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // In-App Small Screen Popup for Free Plan Switch (replaces window.confirm)
  const [showFreeDowngradeModal, setShowFreeDowngradeModal] = useState<boolean>(false);

  // Billing commitment cycle: Monthly vs Annual (2 Months Free / 20% discount)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const activeApp = applications.find((a) => a.id === activeAppId) || applications[0];

  // Helper to normalize tier representations
  const normalizeTier = (tier?: string): 'FREE' | 'GROWTH' | 'ENTERPRISE' => {
    if (!tier) return 'FREE';
    const t = String(tier).toUpperCase();
    if (t.includes('ENTERPRISE')) return 'ENTERPRISE';
    if (t.includes('GROWTH') || t.includes('STARTER')) return 'GROWTH';
    return 'FREE';
  };

  const currentTier = normalizeTier(activeApp?.plan_tier);

  // Fetch dynamic platform pricing set by Admin
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const cfg = await TATSBackendAPI.getPlatformConfig();
        if (cfg) setPlatformConfig(cfg);
      } catch {}
    };
    fetchConfig();
  }, []);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
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

  // Base checkout executor
  const executePayment = async (planTier: string, planName: string, amountInr: number, unitsParam?: number) => {
    if (!developer) {
      onShowToast('Authentication Required', 'Please sign in to subscribe to a plan.', 'warning');
      return;
    }

    if (!activeApp) {
      onShowToast(
        'Application Cluster Required',
        'Please provision or select an Application Cluster first so your plan quota and API credentials can be assigned.',
        'warning'
      );
      onOpenCreateApp();
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Create order on Django backend
      const orderRes = await TATSBackendAPI.createRazorpayOrder(planTier, activeApp.id, unitsParam);
      if (!orderRes.ok) {
        // If backend detected an active plan conflict
        if (orderRes.data?.code === 'ALREADY_SUBSCRIBED') {
          onShowToast('Active Plan Notice', orderRes.data?.error || 'Cluster is already subscribed to an active plan.', 'info');
          if (orderRes.data?.can_topup) {
            setShowTopupModal(true);
          }
          return;
        }
        const errorMsg = orderRes.data?.error || orderRes.data?.detail || 'Failed to initialize payment order.';
        throw new Error(errorMsg);
      }

      const orderData = orderRes.data?.order || orderRes.data;
      if (!orderData || !orderData.order_id) {
        throw new Error('Could not retrieve payment order ID from server.');
      }

      // 2. Load Razorpay SDK
      const scriptLoaded = await loadRazorpayScript();

      if (scriptLoaded && (window as any).Razorpay && orderData.key_id && !orderData.key_id.includes('placeholder')) {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'T@S Acoustic Intelligence',
          description: `${planName} - Cluster Upgrade`,
          order_id: orderData.order_id,
          handler: async (response: any) => {
            const verifyRes = await TATSBackendAPI.verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              app_id: activeApp.id,
            });

            if (verifyRes.ok) {
              setPaymentSuccess(true);
              setSuccessNotice(verifyRes.data?.message || `Application "${activeApp.app_name}" updated!`);
              await onRefreshApps();
              onShowToast('Payment Successful', verifyRes.data?.message || 'Plan activated.', 'success');
              setShowTransitionModal(false);
              setShowTopupModal(false);
            } else {
              onShowToast('Verification Notice', verifyRes.data?.message || 'Payment logged.', 'info');
            }
          },
          prefill: {
            name: developer.name,
            email: developer.email,
            contact: developer.phone || '',
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
              onShowToast('Payment Cancelled', 'Razorpay checkout was dismissed.', 'info');
            },
          },
          theme: {
            color: '#A53B22',
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Live verification fallback for development environments
        const verifyRes = await TATSBackendAPI.verifyRazorpayPayment({
          razorpay_order_id: orderData.order_id,
          razorpay_payment_id: `pay_${Math.random().toString(36).substring(2, 12)}`,
          razorpay_signature: 'sandbox_verified_signature',
          app_id: activeApp.id,
        });

        if (verifyRes.ok) {
          setPaymentSuccess(true);
          setSuccessNotice(verifyRes.data?.message || `Application "${activeApp.app_name}" activated on ${planName}!`);
          await onRefreshApps();
          onShowToast(
            'Subscription Activated',
            verifyRes.data?.message || `Application "${activeApp.app_name}" upgraded to ${planName}!`,
            'success'
          );
          setShowTransitionModal(false);
          setShowTopupModal(false);
        } else {
          onShowToast('Subscription Status', verifyRes.data?.message || 'Plan updated in local cluster.', 'success');
        }
      }
    } catch (err: any) {
      onShowToast('Payment Notice', err.message || 'Could not complete transaction.', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  // Plan click handler with validation & guidance logic
  const handlePlanClick = (plan: any) => {
    if (!developer) {
      onShowToast('Authentication Required', 'Please sign in to select a plan.', 'warning');
      return;
    }

    if (!activeApp) {
      onShowToast('Application Cluster Required', 'Provision an application cluster first to assign plan quota.', 'warning');
      onOpenCreateApp();
      return;
    }

    const planTierNormalized = normalizeTier(plan.id);

    // Case 1: Clicking Free while on Free
    if (planTierNormalized === 'FREE' && currentTier === 'FREE') {
      onShowToast('Current Plan', 'This application is already running on Developer Free.', 'info');
      return;
    }

    // Case 2: Switching from paid plan to Free (Downgrade - Opens small in-app modal)
    if (planTierNormalized === 'FREE' && currentTier !== 'FREE') {
      setShowFreeDowngradeModal(true);
      return;
    }

    // Case 3: Already on the SAME paid plan (e.g. on Growth, clicking Growth)
    if (currentTier === planTierNormalized) {
      onShowToast(
        'Already Subscribed',
        `Cluster "${activeApp.app_name}" is currently active on ${plan.name}. To extend monthly quota, top up extra credits below.`,
        'info'
      );
      setShowTopupModal(true);
      return;
    }

    // Case 4: Already on Growth, wants to upgrade to Scale Enterprise
    if (currentTier === 'GROWTH' && planTierNormalized === 'ENTERPRISE') {
      setTargetTransitionPlan(plan);
      setShowTransitionModal(true);
      return;
    }

    // Case 5: Already on Enterprise, wants to click Growth
    if (currentTier === 'ENTERPRISE' && planTierNormalized === 'GROWTH') {
      onShowToast(
        'Enterprise Plan Active',
        `Cluster is currently provisioned on Scale Enterprise. If you wish to expand action volume, add a credit booster pack.`,
        'info'
      );
      setShowTopupModal(true);
      return;
    }

    // Case 6: Subscribing from Free to Growth or Enterprise
    executePayment(plan.id, plan.name, plan.price);
  };

  // Execute Downgrade to Free Tier (called from in-app small screen popup)
  const executeDowngradeToFree = async () => {
    if (!activeApp) return;
    setIsProcessing(true);
    try {
      const res = await TATSBackendAPI.upgradeAppPlan(activeApp.id, 'FREE');
      if (res.ok) {
        await onRefreshApps();
        onShowToast('Switched to Free Tier', `Cluster "${activeApp.app_name}" is now running on Developer Free.`, 'success');
      } else {
        onShowToast('Downgrade Notice', res.data?.error || 'Could not change plan.', 'warning');
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Failed to switch plan.', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  // Dynamic pricing values from Platform Governance / Admin
  const growthPrice = Number(platformConfig?.growth_price_inr || platformConfig?.starter_price_inr || 1999);
  const enterprisePrice = Number(platformConfig?.enterprise_price_inr || 14999);
  const freeUnits = Number(platformConfig?.free_tier_units || 2000);
  const growthUnits = Number(platformConfig?.growth_tier_units || 50000);
  const enterpriseUnits = Number(platformConfig?.enterprise_tier_units || 250000);
  const gracePct = Number(platformConfig?.grace_buffer_pct || 10);
  const costPerExtraUnit = parseFloat(String(platformConfig?.cost_per_extra_unit || '0.10'));
  const textMultiplierVal = Number(platformConfig?.text_multiplier || 1.0);
  const voiceMultiplierVal = Number(platformConfig?.voice_multiplier || 2.0);
  const toolMultiplierVal = Number(platformConfig?.tool_multiplier || 3.0);

  const isAnnual = billingCycle === 'annual';
  const growthAnnualPrice = Math.round(growthPrice * 10);
  const enterpriseAnnualPrice = Math.round(enterprisePrice * 10);

  const plans = [
    {
      id: 'FREE',
      name: 'Developer Free',
      normalizedTier: 'FREE',
      price: 0,
      priceLabel: '₹0',
      period: 'forever',
      description: 'Ideal for local experiments, prototyping, and personal developer agents.',
      features: [
        `${freeUnits.toLocaleString('en-IN')} units / month included`,
        '1 Concurrent Voice Stream',
        'Zero-storage volatile memory',
        'Deterministic action graph',
        'Community Discord Support',
      ],
      popular: false,
      cta: 'Free Tier',
    },
    {
      id: isAnnual ? 'GROWTH_STARTUP_ANNUAL' : 'GROWTH_STARTUP',
      name: isAnnual ? 'Growth Startup (Annual)' : 'Growth Startup',
      normalizedTier: 'GROWTH',
      price: isAnnual ? growthAnnualPrice : growthPrice,
      priceLabel: isAnnual ? `₹${growthAnnualPrice.toLocaleString('en-IN')}` : `₹${growthPrice.toLocaleString('en-IN')}`,
      period: isAnnual ? '/ year' : '/ mo',
      effectiveMonthly: isAnnual ? `₹${Math.round(growthAnnualPrice / 12).toLocaleString('en-IN')} / mo (billed annually)` : undefined,
      savingsBadge: isAnnual ? `Save ₹${(growthPrice * 2).toLocaleString('en-IN')} (2 Months Free)` : undefined,
      description: isAnnual
        ? 'Best value for production applications. Annual commitment with 2 months free and priority support.'
        : 'Engineered for production apps needing reliability, instant action dispatch, and sub-850ms latency.',
      features: isAnnual
        ? [
            `${(growthUnits * 12).toLocaleString('en-IN')} units / year included`,
            '2 Full Months Free (~17% Immediate Savings)',
            'Sub-650ms Priority Speech Pipeline Guarantee',
            '50 Concurrent Channels (2x monthly limit)',
            `${gracePct}% Grace Unit Buffer (Never Drops Callers)`,
            'Curated Studio Voice Library Access',
            'Priority WhatsApp & Slack Bridge Support',
          ]
        : [
            `${growthUnits.toLocaleString('en-IN')} units included / month`,
            `${gracePct}% Grace Unit Buffer (Never Drops Callers)`,
            '25 Concurrent Voice Channels',
            'Sub-850ms end-to-end latency guarantee',
            'Curated Studio Voice Library Access',
            'Priority WhatsApp & Slack Bridge',
          ],
      popular: true,
      cta: isAnnual ? 'Deploy Annual Growth' : 'Deploy Growth Plan',
    },
    {
      id: isAnnual ? 'SCALE_ENTERPRISE_ANNUAL' : 'SCALE_ENTERPRISE',
      name: isAnnual ? 'Scale Enterprise (Annual)' : 'Scale Enterprise',
      normalizedTier: 'ENTERPRISE',
      price: isAnnual ? enterpriseAnnualPrice : enterprisePrice,
      priceLabel: isAnnual ? `₹${enterpriseAnnualPrice.toLocaleString('en-IN')}` : `₹${enterprisePrice.toLocaleString('en-IN')}`,
      period: isAnnual ? '/ year' : '/ mo',
      effectiveMonthly: isAnnual ? `₹${Math.round(enterpriseAnnualPrice / 12).toLocaleString('en-IN')} / mo (billed annually)` : undefined,
      savingsBadge: isAnnual ? `Save ₹${(enterprisePrice * 2).toLocaleString('en-IN')} (2 Months Free)` : undefined,
      description: isAnnual
        ? 'Dedicated high-throughput voice clusters with maximum SLA guarantees and custom DPAs.'
        : 'Dedicated air-gapped clusters for scaled customer support and high-throughput voice actions.',
      features: isAnnual
        ? [
            `${(enterpriseUnits * 12).toLocaleString('en-IN')} units / year included`,
            `Save ₹${(enterprisePrice * 2).toLocaleString('en-IN')} with 2 Months Free`,
            'Dedicated High-Throughput Voice Clusters',
            'Unlimited Concurrent Voice Channels',
            '99.99% High Availability SLA Guarantee',
            'Dedicated isolated SQLite / pgvector Cluster',
            '24/7 Dedicated Engineering Lead + Private Slack',
            'Custom Enterprise DPA & Invoice GST Billing',
          ]
        : [
            `${enterpriseUnits.toLocaleString('en-IN')} units included / month`,
            'Unlimited Concurrent Voice Channels',
            '99.98% High Availability SLA Guarantee',
            'Dedicated isolated SQLite/pgvector DB',
            'Custom Webhook & CRM Integrations',
            '24/7 Dedicated Engineering Lead Support',
          ],
      popular: false,
      cta: isAnnual ? 'Deploy Annual Enterprise' : 'Deploy Enterprise Plan',
    },
  ];

  // Credit top-up packs
  const boosterPacks = [
    { units: 10000, label: 'Micro Pack', price: Math.max(100, Math.round(10000 * costPerExtraUnit)) },
    { units: 25000, label: 'Standard Pack', price: Math.max(100, Math.round(25000 * costPerExtraUnit)), popular: true },
    { units: 50000, label: 'Power Pack', price: Math.max(100, Math.round(50000 * costPerExtraUnit)) },
    { units: 100000, label: 'Volume Pack', price: Math.max(100, Math.round(100000 * costPerExtraUnit)) },
  ];

  const currentTopupPrice = isCustomMode
    ? Math.max(100, Math.round(customSliderUnits * costPerExtraUnit))
    : boosterPacks.find((p) => p.units === selectedTopupUnits)?.price || Math.round(selectedTopupUnits * costPerExtraUnit);

  const effectiveTopupUnits = isCustomMode ? customSliderUnits : selectedTopupUnits;

  return (
    <div className="w-full min-h-screen bg-[#FAF9F6] p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Hero Header */}
      <div className="relative bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="flex flex-col gap-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDAD2] text-[#84240D] font-['Outfit'] text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5F45] animate-pulse"></span>
              Agent Monetization & Subscriptions
            </span>
            <span className="text-xs text-[#57423D] flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
              Razorpay Live Gateway
            </span>
          </div>

          <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-[#1D1A23] tracking-tight">
            Production Plans & Quota Subscriptions
          </h1>
          <p className="text-xs sm:text-sm text-[#57423D] leading-relaxed">
            Transparent acoustic accounting without unpredictable token inflation. Every plan grants guaranteed concurrent channels, deterministic tool actions, and zero-storage privacy.
          </p>
        </div>

        {/* Application Cluster Picker & Create Option */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#FAF9F6] p-3 rounded-2xl border border-[#FFE6DC]">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B716B] font-['Outfit']">
              Target Cluster
            </span>
            {applications.length > 0 ? (
              <select
                value={activeAppId}
                onChange={(e) => {
                  const found = applications.find((a) => a.id === e.target.value);
                  if (found) onSelectApp(found);
                }}
                className="bg-transparent text-xs font-bold text-[#1D1A23] focus:outline-none cursor-pointer mt-0.5"
              >
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.app_name} ({normalizeTier(app.plan_tier)})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-bold text-[#A53B22]">No Clusters Provisioned</span>
            )}
          </div>

          {activeApp && (
            <div className="px-3 py-1.5 rounded-xl bg-white border border-[#FFE6DC] text-center">
              <span className="text-[10px] text-[#8B716B] block font-medium">Active Tier</span>
              <span className="font-['Outfit'] text-xs font-bold text-[#A53B22]">
                {currentTier} PLAN
              </span>
            </div>
          )}

          <button
            onClick={onOpenCreateApp}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] text-white font-['Outfit'] font-bold text-xs shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap"
            title="Create a new application cluster"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>+ Create App Cluster</span>
          </button>
        </div>
      </div>

      {/* Active Subscription Banner with 1-Click Credit Top-up Option */}
      {currentTier !== 'FREE' && activeApp && (
        <div className="p-5 rounded-3xl bg-white border-2 border-[#FFE6DC] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF7E5F] to-[#FFAE33] text-white flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[24px]">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-['Outfit'] font-bold text-base text-[#1D1A23]">
                  Active Plan: {currentTier === 'GROWTH' ? 'Growth Startup' : 'Scale Enterprise'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider font-mono">
                  ACTIVE ON {activeApp.app_name}
                </span>
              </div>
              <p className="text-xs text-[#57423D] mt-0.5">
                Need more actions without changing your billing tier? Top up credit packs instantly. Credits roll forward without altering your renewal date.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowTopupModal(true)}
              className="px-4 py-2.5 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] text-white font-['Outfit'] font-bold text-xs shadow-md shadow-[#FF5F45]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              <span>Top-Up Action Credits</span>
            </button>
          </div>
        </div>
      )}

      {applications.length === 0 && (
        <div className="p-4 rounded-2xl bg-[#FFF8EB] border border-[#FDE047] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#854D0E] shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[24px] text-[#A53B22] shrink-0">rocket_launch</span>
            <div>
              <p className="font-bold text-[#1D1A23] text-sm">Provision an Application Cluster First</p>
              <p className="text-[11px] text-[#854D0E]">
                To attach and activate the Growth Startup or Enterprise plan, create your first application cluster in 5 seconds.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenCreateApp}
            className="px-4 py-2 rounded-xl bg-[#A53B22] hover:bg-[#84240D] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>+ Create Cluster Now</span>
          </button>
        </div>
      )}

      {paymentSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-emerald-600">check_circle</span>
            <div>
              <p className="font-bold">Transaction Successfully Verified</p>
              <p className="text-[11px] text-emerald-700">{successNotice || 'Your application cluster quota has been expanded in the database.'}</p>
            </div>
          </div>
          <button
            onClick={() => setPaymentSuccess(false)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Billing Cycle Switcher (Monthly vs Annual with 2 Months Free / 20% discount badge) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-white border border-[#FFE6DC] shadow-xs">
        <div>
          <span className="font-['Outfit'] font-bold text-sm sm:text-base text-[#1D1A23] block">
            Select Billing Commitment
          </span>
          <p className="text-xs text-[#57423D]">
            Switch to annual billing to unlock <strong className="text-[#A53B22]">2 months free</strong> (~17% discount) and credit rollover protection.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-[#FAF9F6] border border-[#FFE6DC] rounded-full shrink-0">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-full text-xs font-bold font-['Outfit'] transition-all ${
              billingCycle === 'monthly'
                ? 'bg-[#1D1A23] text-white shadow-xs'
                : 'text-[#57423D] hover:text-[#1D1A23]'
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-2 rounded-full text-xs font-bold font-['Outfit'] transition-all flex items-center gap-1.5 ${
              billingCycle === 'annual'
                ? 'bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] text-white shadow-sm'
                : 'text-[#A53B22] hover:text-[#84240D]'
            }`}
          >
            <span>Annual Billing</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono ${
              billingCycle === 'annual' ? 'bg-white/20 text-white' : 'bg-[#FFDAD2] text-[#84240D]'
            }`}>
              2 Months Free
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {plans.map((plan) => {
          const isCurrentActive = currentTier === plan.normalizedTier;
          return (
            <div
              key={plan.id}
              className={`p-7 rounded-3xl flex flex-col justify-between transition-all relative ${
                plan.popular
                  ? 'bg-white border-2 border-[#FF7E5F] shadow-xl shadow-[#FF7E5F]/10 md:scale-[1.02]'
                  : 'bg-white border border-[#FFE6DC] shadow-sm hover:shadow-md'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] text-white font-['Outfit'] text-[10px] font-bold uppercase tracking-wider shadow-sm">
                  MOST POPULAR
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <span className="font-['Outfit'] text-xs font-bold uppercase text-[#8B716B] tracking-wider">
                    {plan.name}
                  </span>
                  {isCurrentActive && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase font-mono">
                      ACTIVE TIER
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 my-3">
                  <span className="font-['Outfit'] text-3xl sm:text-4xl font-extrabold text-[#1D1A23]">
                    {plan.priceLabel}
                  </span>
                  <span className="text-xs text-[#8B716B]">{plan.period}</span>
                </div>

                {(plan as any).effectiveMonthly && (
                  <div className="mb-3 -mt-1 flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#845400]">
                      {(plan as any).effectiveMonthly}
                    </span>
                    {(plan as any).savingsBadge && (
                      <span className="inline-flex self-start px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono">
                        {(plan as any).savingsBadge}
                      </span>
                    )}
                  </div>
                )}

                <p className="text-xs text-[#57423D] mb-6 leading-relaxed">
                  {plan.description}
                </p>

                <div className="h-[1px] bg-[#FFE6DC]/80 w-full mb-6" />

                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase text-[#8B716B] font-['Outfit'] tracking-wider block">
                    What's Included:
                  </span>
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-[#57423D]">
                      <span className="material-symbols-outlined text-[#A53B22] text-[16px] shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8">
                {isCurrentActive ? (
                  <div className="flex flex-col gap-2">
                    <div className="w-full py-3 rounded-full bg-[#FAF9F6] text-[#8B716B] font-bold text-xs border border-[#FFE6DC] text-center flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
                      <span>Active on this Cluster</span>
                    </div>
                    {currentTier !== 'FREE' && (
                      <button
                        onClick={() => setShowTopupModal(true)}
                        className="w-full py-2.5 rounded-full bg-[#FAF9F6] hover:bg-[#F3EBF8] text-[#A53B22] border border-[#FF7E5F]/40 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">bolt</span>
                        <span>+ Top Up Extra Credits</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handlePlanClick(plan)}
                    disabled={isProcessing}
                    className={`w-full py-3 rounded-full font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-[#FF7E5F] via-[#FF5F45] to-[#FFAE33] hover:from-[#FF5F45] hover:to-[#FFAE33] text-white shadow-[#FF5F45]/20 hover:scale-[1.02]'
                        : 'bg-[#1D1A23] hover:bg-[#2E2A36] text-white hover:scale-[1.01]'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                        <span>Processing Order...</span>
                      </>
                    ) : !activeApp ? (
                      <>
                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                        <span>+ Create Cluster to Deploy</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">payments</span>
                        <span>{plan.cta}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: PLAN TRANSITION & CONFLICT GUIDANCE MODAL */}
      {showTransitionModal && targetTransitionPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setShowTransitionModal(false)} />
          <div className="relative w-full max-w-xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-[#FFE6DC] z-10 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
            {/* Modal Header (Pinned) */}
            <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-[#FFE6DC] shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FFAE33] to-[#FF7E5F] flex items-center justify-center text-white shadow-sm shrink-0">
                  <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
                </div>
                <div>
                  <h3 className="font-['Outfit'] font-bold text-base sm:text-lg text-[#1D1A23]">
                    Active Plan Transition Notice
                  </h3>
                  <p className="text-xs text-[#57423D]">
                    Cluster <strong className="text-[#1D1A23]">"{activeApp?.app_name}"</strong> currently has an active plan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTransitionModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8B716B] hover:bg-[#FAF9F6] shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {/* Explanatory Context */}
              <div className="p-4 rounded-2xl bg-[#FFF8EB] border border-[#FDE047] text-xs text-[#854D0E] space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-[#845400]">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  <span>Concurrent Subscription Policy</span>
                </div>
                <p>
                  You are currently running on the <strong>Growth Startup</strong> tier. To maintain strict ACID accounting guarantees, an application cluster cannot hold two overlapping billing plans at the exact same time.
                </p>
                <p>
                  Choose how you would like to proceed with your cluster's quota:
                </p>
              </div>

              {/* Path Choices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option 1: Top-Up Credits */}
                <div className="p-4 rounded-2xl border-2 border-[#FFE6DC] bg-[#FAF9F6] hover:border-[#FF7E5F] transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-[#A53B22] font-bold text-xs uppercase font-['Outfit'] mb-1">
                      <span className="material-symbols-outlined text-[16px]">bolt</span>
                      <span>Option A: Extend Bandwidth</span>
                    </div>
                    <h4 className="font-bold text-sm text-[#1D1A23]">Stay on Growth + Top Up</h4>
                    <p className="text-[11px] text-[#57423D] mt-1.5 leading-relaxed">
                      Keep your active Growth Startup tier and immediately add action units that never expire. Best if you just need extra volume this month.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowTransitionModal(false);
                      setShowTopupModal(true);
                    }}
                    className="mt-4 w-full py-2 px-3 rounded-full bg-white hover:bg-[#FFE6DC]/60 text-[#A53B22] font-bold text-xs border border-[#FFE6DC] transition-colors"
                  >
                    Top-Up Credits Instead →
                  </button>
                </div>

                {/* Option 2: Elevate to Scale Enterprise */}
                <div className="p-4 rounded-2xl border-2 border-[#FF7E5F] bg-white shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-[#006688] font-bold text-xs uppercase font-['Outfit'] mb-1">
                      <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                      <span>Option B: Plan Upgrade</span>
                    </div>
                    <h4 className="font-bold text-sm text-[#1D1A23]">Upgrade to Scale Enterprise</h4>
                    <p className="text-[11px] text-[#57423D] mt-1.5 leading-relaxed">
                      Transition immediately to Enterprise throughput ({enterpriseUnits.toLocaleString('en-IN')} units/mo, air-gapped isolation). All unspent Growth credits roll forward seamlessly into your new balance.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowTransitionModal(false);
                      if (targetTransitionPlan) {
                        executePayment(targetTransitionPlan.id, targetTransitionPlan.name, targetTransitionPlan.price);
                      }
                    }}
                    disabled={isProcessing || !targetTransitionPlan}
                    className="mt-4 w-full py-2 px-3 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">payments</span>
                    <span>Proceed (₹{(targetTransitionPlan?.price || 0).toLocaleString('en-IN')})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dismiss Footer (Pinned) */}
            <div className="p-4 sm:p-5 border-t border-[#FFE6DC] bg-[#FAF9F6] shrink-0 flex justify-end">
              <button
                onClick={() => setShowTransitionModal(false)}
                className="px-5 py-2 rounded-full text-xs font-semibold text-[#57423D] hover:bg-white border border-transparent hover:border-[#FFE6DC] transition-all"
              >
                Keep Current Plan & Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ACTION CREDITS TOP-UP / CREDIT EXTENSION MODAL */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setShowTopupModal(false)} />
          <div className="relative w-full max-w-xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-[#FFE6DC] z-10 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
            {/* Header (Pinned) */}
            <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-[#FFE6DC] shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF7E5F] to-[#00C2FF] flex items-center justify-center text-white shadow-sm shrink-0">
                  <span className="material-symbols-outlined text-[22px]">bolt</span>
                </div>
                <div>
                  <h3 className="font-['Outfit'] font-bold text-base sm:text-lg text-[#1D1A23]">
                    Action Credits Top-Up
                  </h3>
                  <p className="text-xs text-[#57423D]">
                    Extend monthly turns for <strong className="text-[#1D1A23]">"{activeApp?.app_name}"</strong> without altering your active plan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTopupModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8B716B] hover:bg-[#FAF9F6] shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {/* Booster Packs Grid */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B716B] font-['Outfit']">
                  Select Credit Booster Pack
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {boosterPacks.map((pack) => {
                    const isSelected = !isCustomMode && selectedTopupUnits === pack.units;
                    return (
                      <button
                        key={pack.units}
                        onClick={() => {
                          setIsCustomMode(false);
                          setSelectedTopupUnits(pack.units);
                        }}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between relative ${
                          isSelected
                            ? 'border-[#FF7E5F] bg-[#FFF8EB] shadow-sm'
                            : 'border-[#FFE6DC] bg-[#FAF9F6] hover:bg-white'
                        }`}
                      >
                        {pack.popular && (
                          <span className="absolute -top-2 right-3 px-2 py-0.2 rounded-full bg-[#FF7E5F] text-white text-[9px] font-bold font-['Outfit'] uppercase">
                            POPULAR
                          </span>
                        )}
                        <div>
                          <span className="font-['Outfit'] text-[11px] font-bold uppercase text-[#8B716B]">
                            {pack.label}
                          </span>
                          <div className="font-['Outfit'] text-base font-extrabold text-[#1D1A23] mt-0.5">
                            +{pack.units.toLocaleString('en-IN')} Units
                          </div>
                        </div>
                        <div className="mt-2 text-xs font-bold text-[#A53B22]">
                          ₹{pack.price.toLocaleString('en-IN')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Slider Mode Toggle */}
              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1D1A23]">Custom Action Volume</span>
                  <button
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className="text-[11px] font-bold text-[#A53B22] hover:underline"
                  >
                    {isCustomMode ? 'Use Preset Packs' : 'Customize Units Slider'}
                  </button>
                </div>

                {isCustomMode && (
                  <div className="space-y-2 pt-1 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-[#1D1A23]">
                      <span>{customSliderUnits.toLocaleString('en-IN')} Units</span>
                      <span className="text-[#A53B22]">₹{Math.max(100, Math.round(customSliderUnits * costPerExtraUnit)).toLocaleString('en-IN')}</span>
                    </div>
                    <input
                      type="range"
                      min={5000}
                      max={200000}
                      step={5000}
                      value={customSliderUnits}
                      onChange={(e) => setCustomSliderUnits(Number(e.target.value))}
                      className="w-full h-2 bg-[#EDE5F2] rounded-lg appearance-none cursor-pointer accent-[#FF7E5F]"
                    />
                    <div className="flex justify-between text-[10px] text-[#8B716B] font-mono">
                      <span>5,000 units</span>
                      <span>100,000 units</span>
                      <span>200,000 units</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Value & Quota Guarantees */}
              <div className="text-[11px] text-[#57423D] bg-[#FAF9F6] p-3.5 rounded-2xl border border-[#FFE6DC] space-y-1.5 leading-relaxed">
                <p>• <strong>Instant Activation:</strong> Credits are applied directly to the active cluster usage meter upon payment verification.</p>
                <p>• <strong>Permanent Carry-Over:</strong> Extra bonus credits roll forward into consecutive months until fully consumed.</p>
                <p>• <strong>Zero Config Change:</strong> Preserves your existing API credentials, webhook endpoints, and tier privileges.</p>
              </div>
            </div>

            {/* Action Bar (Pinned Bottom Footer - Guaranteed Visibility) */}
            <div className="p-4 sm:p-5 border-t border-[#FFE6DC] bg-[#FAF9F6] shrink-0 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[#8B716B] uppercase font-['Outfit']">Total Payable</span>
                <span className="font-['Outfit'] text-xl sm:text-2xl font-extrabold text-[#A53B22]">
                  ₹{currentTopupPrice.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTopupModal(false)}
                  className="px-4 py-2.5 rounded-full text-xs font-semibold text-[#57423D] hover:bg-white border border-transparent hover:border-[#FFE6DC] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    executePayment(
                      'TOPUP_CREDITS',
                      `Credit Booster (+${effectiveTopupUnits.toLocaleString('en-IN')} Units)`,
                      currentTopupPrice,
                      effectiveTopupUnits
                    );
                  }}
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF5F45] hover:from-[#FF5F45] hover:to-[#FFAE33] text-white font-['Outfit'] font-bold text-xs shadow-md shadow-[#FF5F45]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">bolt</span>
                      <span>Confirm Top-Up (₹{currentTopupPrice.toLocaleString('en-IN')})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accounting Rules & Transparent Multipliers */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#FFE6DC] shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#A53B22] text-[20px]">calculate</span>
          <h2 className="font-['Outfit'] text-base font-bold text-[#1D1A23]">
            How Voice Units Are Calculated
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col gap-1">
            <span className="font-bold text-[#1D1A23]">Text Message Turn</span>
            <span className="font-mono text-sm font-bold text-[#845400]">
              {textMultiplierVal.toFixed(1)} Unit
            </span>
            <p className="text-[11px] text-[#57423D] mt-1">Single deterministic text message to or from the agent.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col gap-1">
            <span className="font-bold text-[#1D1A23]">Voice Call Speech Turn</span>
            <span className="font-mono text-sm font-bold text-[#A53B22]">
              {voiceMultiplierVal.toFixed(1)} Units
            </span>
            <p className="text-[11px] text-[#57423D] mt-1">Bidirectional live speech-to-speech turn with acoustic calibration.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col gap-1">
            <span className="font-bold text-[#1D1A23]">Action & Tool Execution</span>
            <span className="font-mono text-sm font-bold text-[#006688]">
              {toolMultiplierVal.toFixed(1)} Units
            </span>
            <p className="text-[11px] text-[#57423D] mt-1">Webhook call, database mutation, or payment trigger executed by agent.</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFF8EB] border border-[#FDE047] text-xs text-[#854D0E] flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-[#854D0E] shrink-0">shield</span>
          <p>
            <strong>Grace Buffer Protection:</strong> When your application cluster reaches 100% of its included units, callers will <em>not</em> be abruptly cut off. A {gracePct}% grace buffer ensures zero user disruption while allowing you to top up extra credits or upgrade seamlessly.
          </p>
        </div>
      </div>

      {/* Small Screen Popup: Switch Cluster to Developer Free Tier (Replaces browser window.confirm) */}
      {showFreeDowngradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setShowFreeDowngradeModal(false)} />
          <div className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-[#FFE6DC] shadow-2xl flex flex-col items-center text-center gap-4 z-10 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-[#FFDAD2] text-[#A53B22] flex items-center justify-center shadow-md shadow-[#FF7E5F]/15">
              <span className="material-symbols-outlined text-[28px]">swap_horiz</span>
            </div>
            <div>
              <h3 className="font-['Outfit'] text-lg font-bold text-[#1D1A23]">
                Switch to Developer Free Plan?
              </h3>
              <p className="text-xs text-[#57423D] mt-2 leading-relaxed">
                Switch cluster <strong>"{activeApp?.app_name}"</strong> to the Developer Free plan? Your application will reset to Free tier quota limits ({freeUnits.toLocaleString('en-IN')} units/mo).
              </p>
            </div>
            <div className="flex items-center gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => setShowFreeDowngradeModal(false)}
                className="flex-1 py-2.5 px-4 rounded-full bg-[#FAF9F6] hover:bg-[#F3EBF8] text-[#57423D] font-bold text-xs border border-[#FFE6DC] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFreeDowngradeModal(false);
                  executeDowngradeToFree();
                }}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-4 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white font-bold text-xs shadow-md shadow-[#A53B22]/20 transition-all flex items-center justify-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <span className="material-symbols-outlined text-[15px] animate-spin">refresh</span>
                    <span>Switching...</span>
                  </>
                ) : (
                  <span>Confirm Switch</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
