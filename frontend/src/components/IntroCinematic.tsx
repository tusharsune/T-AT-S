import { TASLogoIcon } from './TASLogo';
import React, { useState, useEffect, useRef } from 'react';

interface IntroCinematicProps {
  onComplete: () => void;
  autoPlay?: boolean;
}

export interface DeveloperWorkspaceSlide {
  id: number;
  title: string;
  tag: string;
  subtitle: string;
  badge: string;
  codeSnippet: string;
  // REPLACE WITH YOUR REAL IMAGE URL OR PATH HERE:
  // e.g. imageUrl: "/images/developer_workspace_1.png" or "https://..."
  imageUrl?: string;
}

// 5 Dedicated Developer Workspace Snapshots (Auto-slides in short frame or manually browsable)
export const DEVELOPER_WORKSPACE_SLIDES: DeveloperWorkspaceSlide[] = [
  {
    id: 1,
    title: 'FastAPI Voice Ingestion',
    tag: 'Python 3.12 / async',
    subtitle: 'Connecting SIP telephony streams to live API routes in 5 lines',
    badge: '110ms Execution',
    codeSnippet: `@app.post("/voice/dispatch")\nasync def on_call(stream: AudioStream):\n    action = router.match(stream)\n    return action.execute()`,
    imageUrl: ''
  },
  {
    id: 2,
    title: 'Acoustic Graph & Spectrogram',
    tag: 'Sub-850ms Telephony',
    subtitle: 'Streaming acoustic parsing with zero audio saved to disk',
    badge: 'Zero Audio on Disk',
    codeSnippet: `const session = useAcousticStream({\n  sampleRate: 16000,\n  onAction: (res) => triggerDB(res)\n});`,
    imageUrl: ''
  },
  {
    id: 3,
    title: 'Self-Hosted pgvector Isolation',
    tag: 'PostgreSQL / RLS',
    subtitle: 'Isolated developer cluster storing deterministic tool intents',
    badge: 'Zero Hallucinations',
    codeSnippet: `SELECT tool_id, confidence FROM schema_tools\nWHERE tenant_id = :tenant\nORDER BY embedding <-> :query LIMIT 1;`,
    imageUrl: ''
  },
  {
    id: 4,
    title: 'OpenAPI Deterministic Router',
    tag: 'Strict Schema Matcher',
    subtitle: 'Validates speech parameters against your OpenAPI specification',
    badge: 'Strict JSON Output',
    codeSnippet: `router.validate_intent({\n  intent: "book_appointment",\n  params: { date: "tomorrow", time: "15:00" }\n});`,
    imageUrl: ''
  },
  {
    id: 5,
    title: 'Production Telemetry Console',
    tag: '99.98% High Throughput',
    subtitle: 'Real-time latency monitoring across 12 telephony regions',
    badge: 'Sub-850ms Latency',
    codeSnippet: `HTTP 200 OK • Done in 482ms\nActive Channels: 1,420 concurrent\nZero Hallucination Errors`,
    imageUrl: ''
  }
];

export const IntroCinematic: React.FC<IntroCinematicProps> = ({ onComplete }) => {
  // 3 spacious, elegant scenes:
  // Scene 0: Core Breakthrough + Real Developer Spotlight (0s - 4.5s)
  // Scene 1: The 3-Step Human Architecture: Talk -> Decide -> Solve (4.5s - 9.0s)
  // Scene 2: Real Developer Community & T@S Platform Climax (9.0s - 13.5s)
  const [scene, setScene] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Active slide index for the 5-image developer workspace snapshot slider
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

  // Total runtime: 13.5s (4.5s per scene) for spacious, relaxed reading
  const TOTAL_DURATION = 13500;
  const SCENE_0_END = 4500;
  const SCENE_1_END = 9000;

  // Use ref to store the exact elapsed time so pausing and resuming NEVER restarts from the beginning!
  const elapsedRef = useRef<number>(0);

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      elapsedRef.current += 50;
      const currentElapsed = elapsedRef.current;
      const pct = Math.min(100, Math.floor((currentElapsed / TOTAL_DURATION) * 100));
      setProgress(pct);

      if (currentElapsed < SCENE_0_END) {
        setScene(0);
      } else if (currentElapsed < SCENE_1_END) {
        setScene(1);
      } else if (currentElapsed < TOTAL_DURATION - 500) {
        setScene(2);
      } else {
        setIsClosing(true);
      }

      if (currentElapsed >= TOTAL_DURATION) {
        clearInterval(timer);
        handleExit();
      }
    }, 50);

    return () => clearInterval(timer);
  }, [isPaused]);

  // Auto-advance the 5 developer workspace snapshot slides in very short frame (every 1.8s) when playing
  useEffect(() => {
    if (scene !== 0 || isPaused) return;

    const slideTimer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % DEVELOPER_WORKSPACE_SLIDES.length);
    }, 1800);

    return () => clearInterval(slideTimer);
  }, [scene, isPaused]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleExit();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        jumpToScene(Math.min(2, scene + 1));
      } else if (e.key === 'ArrowLeft') {
        jumpToScene(Math.max(0, scene - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scene]);

  const jumpToScene = (targetScene: number) => {
    setScene(targetScene);
    if (targetScene === 0) elapsedRef.current = 0;
    else if (targetScene === 1) elapsedRef.current = SCENE_0_END;
    else if (targetScene === 2) elapsedRef.current = SCENE_1_END;
    setProgress(Math.min(100, Math.floor((elapsedRef.current / TOTAL_DURATION) * 100)));
  };

  const handlePrevSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentSlideIndex((prev) => (prev - 1 + DEVELOPER_WORKSPACE_SLIDES.length) % DEVELOPER_WORKSPACE_SLIDES.length);
  };

  const handleNextSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentSlideIndex((prev) => (prev + 1) % DEVELOPER_WORKSPACE_SLIDES.length);
  };

  const handleExit = () => {
    setIsClosing(true);
    try {
      sessionStorage.setItem('tats_intro_seen', 'true');
    } catch {}
    setTimeout(() => {
      onComplete();
    }, 450);
  };

  const currentSlide = DEVELOPER_WORKSPACE_SLIDES[currentSlideIndex];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#FAF9F6] text-[#1D1A23] overflow-y-auto select-none transition-all duration-500 font-['Manrope'] p-4 sm:p-8 ${
        isClosing ? 'opacity-0 scale-102 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 10% 20%, rgba(255, 126, 95, 0.08) 0%, transparent 40%),
          radial-gradient(circle at 90% 80%, rgba(255, 174, 51, 0.08) 0%, transparent 40%),
          radial-gradient(circle, rgba(165, 59, 34, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 36px 36px'
      }}
    >
      {/* Top Header Controls */}
      <div className="fixed top-4 left-4 right-4 sm:top-6 sm:left-8 sm:right-8 z-40 flex items-center justify-between">
        {/* Brand Stamp */}
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#FFE6DC] shadow-xs">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#FF7E5F] to-[#FFAE33] flex items-center justify-center text-white shadow-xs">
            <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
          </div>
          <span className="font-['Outfit'] font-bold text-sm text-[#1D1A23] tracking-tight">T@S</span>
          <span className="text-[#DEC0B9]">/</span>
          <span className="text-[11px] font-semibold text-[#8B716B]">Developer Overview</span>
        </div>

        {/* Action Controls: Pause/Resume + Scene Buttons (NO DOTS) + Skip */}
        <div className="flex items-center gap-2 sm:gap-3 bg-white/80 backdrop-blur-md p-1.5 rounded-full border border-[#FFE6DC] shadow-xs">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-[#FFF6F3] text-xs font-semibold text-[#57423D] hover:text-[#A53B22] transition-colors cursor-pointer"
            title="Press Space to pause or resume where you left off"
          >
            <span className="material-symbols-outlined text-[16px] text-[#FF7E5F]">
              {isPaused ? 'play_arrow' : 'pause'}
            </span>
            <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <div className="h-4 w-px bg-[#FFE6DC]" />

          {/* Clean Labeled Scene Tabs (NO DOTS) */}
          <div className="flex items-center gap-1 px-1 font-mono text-[11px]">
            {[
              { id: 0, label: '01' },
              { id: 1, label: '02' },
              { id: 2, label: '03' }
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => jumpToScene(s.id)}
                className={`px-2 py-0.5 rounded-full font-bold transition-all duration-200 cursor-pointer ${
                  scene === s.id
                    ? 'bg-[#FF7E5F] text-white shadow-xs'
                    : 'text-[#8B716B] hover:text-[#1D1A23] hover:bg-[#FFE6DC]/40'
                }`}
                title={`Jump to Scene ${s.label}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[#FFE6DC]" />

          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-[#FFF6F3] text-xs font-bold text-[#1D1A23] hover:text-[#A53B22] transition-colors cursor-pointer"
            title="Skip intro animation (Esc)"
          >
            <span>Skip</span>
            <kbd className="px-1 py-0.2 rounded bg-[#FAF9F6] border border-[#FFE6DC] text-[9px] font-mono text-[#8B716B]">
              Esc
            </kbd>
          </button>
        </div>
      </div>

      {/* Main Spacious Content Container */}
      <div className="relative w-full max-w-6xl my-auto py-14 sm:py-16">

        {/* ========================================================================= */}
        {/* SCENE 0: THE BREAKTHROUGH & REAL DEVELOPER SPOTLIGHT                      */}
        {/* ========================================================================= */}
        {scene === 0 && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center animate-in fade-in duration-400">
            {/* Left Column: Bold Text & Mission */}
            <div className="lg:col-span-7 space-y-5 text-left">
              {/* Clean Badge Without Dot */}
              <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-white border border-[#FFE6DC] text-xs font-semibold text-[#A53B22] shadow-xs">
                <span>The Voice-to-Execution Layer</span>
              </div>

              <h1 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1D1A23] tracking-tight leading-[1.2]">
                Most voice bots talk a lot. <br />
                <span className="bg-gradient-to-r from-[#FF7E5F] via-[#FF5F45] to-[#A53B22] bg-clip-text text-transparent">
                  T@S actually runs your code.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-[#57423D] leading-relaxed max-w-xl">
                We replace slow, 5-second chatbot silences with a real-time acoustic engine that triggers your backend API endpoints in under 850 milliseconds.
              </p>

              {/* 3 Core Value Pillars */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#FFE6DC] text-xs font-semibold text-[#1D1A23] shadow-xs">
                  <span className="material-symbols-outlined text-[16px] text-[#FF7E5F]">speed</span>
                  <span>Sub-850ms Speed</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#FFE6DC] text-xs font-semibold text-[#1D1A23] shadow-xs">
                  <span className="material-symbols-outlined text-[16px] text-[#FF7E5F]">lock</span>
                  <span>Zero Audio Saved on Disk</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#FFE6DC] text-xs font-semibold text-[#1D1A23] shadow-xs">
                  <span className="material-symbols-outlined text-[16px] text-[#FF7E5F]">check_circle</span>
                  <span>Zero Hallucinations</span>
                </div>
              </div>
            </div>

            {/* Right Column: Real Developer In-Action Spotlight (Dedicated 5-Image Slider) */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl bg-white border border-[#FFE6DC] p-5 shadow-[0_16px_40px_rgba(87,66,61,0.08)] overflow-hidden text-left">
                {/* Floating Production Badge - NO DOT */}
                <div className="flex items-center justify-between pb-3 border-b border-[#FFE6DC]/80 mb-3.5">
                  <span className="font-['Outfit'] font-bold text-xs text-[#1D1A23]">
                    Real Developer Spotlight
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#A53B22] font-bold bg-[#FFF6F3] border border-[#FFDAD2] px-2 py-0.5 rounded-full">
                      Live Production
                    </span>
                    <span className="text-[10px] font-mono text-[#8B716B] bg-[#FAF9F6] border border-[#FFE6DC] px-2 py-0.5 rounded-full">
                      Snapshot {currentSlideIndex + 1}/5
                    </span>
                  </div>
                </div>

                {/* DEDICATED 5-IMAGE DEVELOPER WORKSPACE SLIDER */}
                {/* TO ADD YOUR 5 REAL IMAGES: Simply update `imageUrl` in DEVELOPER_WORKSPACE_SLIDES above! */}
                <div
                  id="developer-showcase-image-slider"
                  className="w-full h-52 sm:h-60 rounded-2xl bg-gradient-to-tr from-[#FFF3EE] via-[#FAF9F6] to-[#F7EEFA] border border-[#FFE6DC] relative overflow-hidden group shadow-inner"
                >
                  {/* Current Active Slide Content */}
                  {currentSlide.imageUrl ? (
                    <img
                      src={currentSlide.imageUrl}
                      alt={currentSlide.title}
                      className="w-full h-full object-cover rounded-2xl transition-all duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col justify-between p-4 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#FF7E5F] to-[#FFAE33] flex items-center justify-center text-white text-xs font-mono font-bold shadow-xs">
                            {currentSlideIndex + 1}
                          </span>
                          <div>
                            <span className="font-['Outfit'] font-bold text-xs text-[#1D1A23] block leading-tight">
                              {currentSlide.title}
                            </span>
                            <span className="text-[10px] font-mono text-[#8B716B]">
                              {currentSlide.tag}
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-[#A53B22] bg-white border border-[#FFDAD2] px-2 py-0.5 rounded-full shadow-2xs">
                          {currentSlide.badge}
                        </span>
                      </div>

                      {/* Code Snippet Box */}
                      <pre className="p-2.5 rounded-xl bg-white border border-[#FFE6DC] font-mono text-[10px] text-[#57423D] overflow-x-auto leading-relaxed shadow-xs">
                        <code>{currentSlide.codeSnippet}</code>
                      </pre>

                      <div className="flex items-center justify-between text-[10px] text-[#8B716B]">
                        <span className="truncate max-w-[210px]">{currentSlide.subtitle}</span>
                        <span className="font-mono font-bold text-[#A53B22]">
                          {isPaused ? 'Paused • Slide manually' : 'Auto-sliding'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Manual Slide Controls: Previous / Next buttons */}
                  <button
                    onClick={handlePrevSlide}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/95 hover:bg-white text-[#57423D] hover:text-[#A53B22] border border-[#FFE6DC] shadow-md flex items-center justify-center transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                    title="Previous snapshot (or slide manually)"
                    aria-label="Previous snapshot"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>

                  <button
                    onClick={handleNextSlide}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/95 hover:bg-white text-[#57423D] hover:text-[#A53B22] border border-[#FFE6DC] shadow-md flex items-center justify-center transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                    title="Next snapshot (or slide manually)"
                    aria-label="Next snapshot"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>

                  {/* Slide Tabs Navigation (Clean Numbered Pill Tabs - NO DOTS) */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs border border-[#FFE6DC] shadow-xs">
                    {DEVELOPER_WORKSPACE_SLIDES.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSlideIndex(idx);
                        }}
                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold transition-all duration-200 cursor-pointer ${
                          currentSlideIndex === idx
                            ? 'bg-[#FF7E5F] text-white shadow-2xs'
                            : 'text-[#8B716B] hover:text-[#1D1A23] hover:bg-[#FFE6DC]/50'
                        }`}
                        title={`Go to Slide ${idx + 1}`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Real Developer Testimonial Quote */}
                <div className="mt-4 pt-3 border-t border-[#FFE6DC]/80">
                  <p className="text-xs text-[#57423D] italic leading-relaxed">
                    "Our customer phone calls now trigger real backend database reservations in under 1 second without making up false information."
                  </p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-['Outfit'] font-bold text-xs text-[#1D1A23] block">Alex Morgan</span>
                      <span className="text-[10px] text-[#8B716B]">Lead Backend Architect @ ClinicSync</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      480ms P95
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCENE 1: THE 3-STEP REAL LIFE WORKFLOW (Spacious 3-Card Flow)              */}
        {/* ========================================================================= */}
        {scene === 1 && (
          <div className="w-full space-y-8 animate-in fade-in duration-400">
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#FFE6DC] text-xs font-semibold text-[#A53B22] shadow-xs">
                <span>Real-Time Voice-To-Code Execution</span>
              </span>
              <h2 className="font-['Outfit'] text-2xl sm:text-4xl font-extrabold text-[#1D1A23] tracking-tight">
                How Developers Connect Speech to Live APIs
              </h2>
              <p className="text-xs sm:text-sm text-[#57423D]">
                No generative hallucination. Exact parameters matched against your OpenAPI specification.
              </p>
            </div>

            {/* 3 Spacious Cards with Dedicated Image & Workflow Slots */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              
              {/* STEP 1: TALK (Caller / User Ingestion) */}
              <div className="rounded-3xl bg-white border border-[#FFE6DC] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF7E5F] to-[#FFAE33]" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-[#FFF6F3] border border-[#FFDAD2] text-[#A53B22] flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[22px]">hearing</span>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-[#A53B22] bg-[#FFF6F3] border border-[#FFDAD2] px-2 py-0.5 rounded-full">
                      STEP 01
                    </span>
                  </div>

                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-[#1D1A23]">1. You Talk (Listen)</h3>
                    <p className="text-xs text-[#57423D] mt-1 leading-relaxed">
                      Callers speak naturally over standard phone lines (SIP) or web apps (WebRTC):
                    </p>
                  </div>

                  {/* Speech Bubble */}
                  <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-semibold text-[#1D1A23] leading-snug">
                    "Book a dental cleaning for tomorrow at 3 PM for Alex Chen"
                  </div>
                </div>

                {/* Subtext */}
                <div className="pt-3 border-t border-[#FFE6DC]/80 flex items-center justify-between text-[11px] font-mono text-[#8B716B]">
                  <span>Acoustic Ingestion</span>
                  <span className="text-[#A53B22] font-bold">&lt; 180ms</span>
                </div>
              </div>

              {/* STEP 2: DECIDE (T@S Matcher) */}
              <div className="rounded-3xl bg-white border border-[#FFE6DC] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FFAE33] to-[#FF5F45]" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-[#FFF6F3] border border-[#FFDAD2] text-[#A53B22] flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[22px]">alt_route</span>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-[#FFAE33] bg-[#FFF9EB] border border-[#FDE047] px-2 py-0.5 rounded-full">
                      STEP 02
                    </span>
                  </div>

                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-[#1D1A23]">2. We Match (Decide)</h3>
                    <p className="text-xs text-[#57423D] mt-1 leading-relaxed">
                      Extracts exact parameters and validates headers against your OpenAPI spec:
                    </p>
                  </div>

                  {/* Schema Parameters */}
                  <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] font-mono text-[11px] text-[#1D1A23] space-y-0.5">
                    <div>service: <strong className="text-[#A53B22]">"dental_cleaning"</strong></div>
                    <div>date: <strong className="text-[#A53B22]">"tomorrow"</strong></div>
                    <div>time: <strong className="text-[#A53B22]">"15:00"</strong></div>
                    <div>patient: <strong className="text-[#A53B22]">"Alex Chen"</strong></div>
                  </div>
                </div>

                {/* Subtext */}
                <div className="pt-3 border-t border-[#FFE6DC]/80 flex items-center justify-between text-[11px] font-mono text-emerald-800 font-bold">
                  <span>Zero Audio on Disk</span>
                  <span>100% In-Memory</span>
                </div>
              </div>

              {/* STEP 3: SOLVE (Live Code Execution) */}
              <div className="rounded-3xl bg-white border border-[#FFE6DC] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF5F45] to-[#A53B22]" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-[#FFF6F3] border border-[#FFDAD2] text-[#A53B22] flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[22px]">bolt</span>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      STEP 03
                    </span>
                  </div>

                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-[#1D1A23]">3. Your Code Runs</h3>
                    <p className="text-xs text-[#57423D] mt-1 leading-relaxed">
                      Your API endpoint executes live, updates your database, and confirms to caller:
                    </p>
                  </div>

                  {/* Real Endpoint Output */}
                  <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-semibold text-[#1D1A23]">
                    <span className="text-emerald-700 font-bold font-mono block mb-1">✓ POST /api/book (200 OK)</span>
                    "You're booked for 3 PM tomorrow, Alex!"
                  </div>
                </div>

                {/* Subtext */}
                <div className="pt-3 border-t border-[#FFE6DC]/80 flex items-center justify-between text-[11px] font-mono text-[#A53B22] font-bold">
                  <span>Total Latency</span>
                  <span>482ms (Sub-1s)</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCENE 2: REAL DEVELOPER COMMUNITY & PLATFORM ARRIVAL                      */}
        {/* ========================================================================= */}
        {scene === 2 && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center animate-in fade-in duration-400 text-left">
            {/* Left Column: Brand Emblem & CTA */}
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-block p-2">
                <img
                  src="/tas_final_logo_mark.svg"
                  alt=""
                  className="w-[84px] h-[84px] aspect-square object-contain select-none"
                />
              </div>

              <div>
                <h1 className="font-['Plus_Jakarta_Sans',Outfit,sans-serif] text-4xl sm:text-5xl font-extrabold text-[#1a1520] tracking-[0.12em]">
                  T<span className="text-[#ff6b4a]">@</span>S
                </h1>
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#fff7ed] border border-[#ffeedd] shadow-xs mt-2">
                  <span className="font-['Plus_Jakarta_Sans',Outfit,sans-serif] text-sm font-bold tracking-[0.2em] text-[#ff6b4a] uppercase">
                    Talk · Decide · Solve
                  </span>
                </div>
              </div>

              <h2 className="font-['Outfit'] text-xl sm:text-2xl font-bold text-[#1D1A23] leading-snug">
                Voice agents that actually run your code.
              </h2>

              <p className="text-xs sm:text-sm text-[#57423D] leading-relaxed max-w-md">
                Connect your Python, Django, or React app in under 5 minutes. Fast, private by default, and engineered for real applications.
              </p>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={handleExit}
                  className="px-7 py-3 rounded-full bg-gradient-to-r from-[#FF7E5F] via-[#FF5F45] to-[#FFAE33] text-white font-['Outfit'] font-bold text-sm shadow-lg shadow-[#FF5F45]/25 hover:scale-105 transition-all cursor-pointer"
                >
                  Enter T@S Platform →
                </button>
              </div>
            </div>

            {/* Right Column: Community of Real Developers (Dedicated Showcase Grid) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="text-xs font-bold text-[#8B716B] uppercase font-['Outfit'] tracking-wider">
                Built By Developers, For Developers
              </div>

              {/* Developer Slot A: Python / Django Backend Engineer */}
              <div className="p-4 rounded-2xl bg-white border border-[#FFE6DC] shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#FAF9F6] to-[#FFE6DC] border border-[#DEC0B9]/60 flex items-center justify-center text-[#A53B22] font-bold text-sm shrink-0">
                  <span className="material-symbols-outlined text-[24px]">terminal</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-['Outfit'] font-bold text-xs text-[#1D1A23]">FastAPI &amp; Django Engineers</span>
                    <span className="text-[10px] font-mono text-[#A53B22] font-semibold">pip install t-at-s</span>
                  </div>
                  <p className="text-[11px] text-[#57423D] mt-0.5 truncate">
                    "Registers tools using clean Python decorators without building complex WebSockets."
                  </p>
                </div>
              </div>

              {/* Developer Slot B: React / Next.js Fullstack Engineer */}
              <div className="p-4 rounded-2xl bg-white border border-[#FFE6DC] shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#FAF9F6] to-[#FFE6DC] border border-[#DEC0B9]/60 flex items-center justify-center text-[#006688] font-bold text-sm shrink-0">
                  <span className="material-symbols-outlined text-[24px]">devices</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-['Outfit'] font-bold text-xs text-[#1D1A23]">React &amp; WebRTC Teams</span>
                    <span className="text-[10px] font-mono text-emerald-700 font-semibold">npm i @tats/sdk</span>
                  </div>
                  <p className="text-[11px] text-[#57423D] mt-0.5 truncate">
                    "Direct browser microphone streaming with live visual response states in 1-click."
                  </p>
                </div>
              </div>

              {/* Impact Metric Banner */}
              <div className="p-4 rounded-2xl bg-[#FFF6F3] border border-[#FFDAD2] flex items-center justify-around text-center">
                <div>
                  <span className="font-['Outfit'] font-bold text-base text-[#1D1A23] block">&lt; 850ms</span>
                  <span className="text-[10px] text-[#8B716B]">Voice-to-API Speed</span>
                </div>
                <div className="h-6 w-px bg-[#FFDAD2]" />
                <div>
                  <span className="font-['Outfit'] font-bold text-base text-[#1D1A23] block">0 Bytes</span>
                  <span className="text-[10px] text-[#8B716B]">Audio on Disk</span>
                </div>
                <div className="h-6 w-px bg-[#FFDAD2]" />
                <div>
                  <span className="font-['Outfit'] font-bold text-base text-[#1D1A23] block">99.98%</span>
                  <span className="text-[10px] text-[#8B716B]">Uptime SLA</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Subtle Progress Indicator Line */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-[#FFE6DC]/60">
        <div
          className="h-full bg-gradient-to-r from-[#FF7E5F] via-[#FF5F45] to-[#FFAE33] transition-all duration-75 ease-out shadow-xs"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
