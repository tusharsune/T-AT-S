import React, { useState, useEffect } from 'react';
import { AppView } from '../../types';
import { PLAYGROUND_PRESETS } from '../../data/mockData';
import { TATSBackendAPI } from '../../services/api';

interface PlaygroundViewProps {
  onNavigate: (view: AppView) => void;
  onShowToast: (title: string, desc?: string) => void;
}

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({
  onNavigate,
  onShowToast
}) => {
  const [mode, setMode] = useState<'voice' | 'sim'>('voice');
  const [micState, setMicState] = useState<'idle' | 'listening' | 'synthesizing'>('listening');
  const [isMuted, setIsMuted] = useState(false);
  const [sensitivity, setSensitivity] = useState(82);
  const [language, setLanguage] = useState('en-IN');
  const [soundBars, setSoundBars] = useState<number[]>([18, 30, 48, 24, 56, 40, 64, 44, 28, 56, 64, 40, 60, 32, 52, 64, 36, 48, 28, 44, 60, 52, 24, 36]);
  
  // Execution timeline state
  const [transcript, setTranscript] = useState('“Hey Acme, add a critical task to review the Q3 budget by 5 PM and assign to tds.”');
  const [currentTool, setCurrentTool] = useState('create_task');
  const [currentActionPayload, setCurrentActionPayload] = useState<Record<string, string>>({
    tool: 'create_task',
    priority: 'high',
    due: '17:00',
    assignee: 'tds'
  });
  const [endpointText, setEndpointText] = useState('POST /api/v1/tasks/create/ → 201 Created');
  const [voiceReply, setVoiceReply] = useState('“I have created the critical Q3 budget review task for tds due today at 5 PM.”');
  const [e2eLatency, setE2eLatency] = useState(584);
  const [stepLatencies, setStepLatencies] = useState({
    auth: 0.12,
    vector: 42,
    llm: 184,
    api: 148,
    tts: 210
  });

  // Soundwave animation jitter
  useEffect(() => {
    const interval = setInterval(() => {
      if (micState === 'listening' && !isMuted) {
        setSoundBars((prev) =>
          prev.map(() => Math.floor(12 + Math.random() * 52))
        );
      } else if (micState === 'synthesizing') {
        setSoundBars((prev) =>
          prev.map(() => Math.floor(25 + Math.random() * 35))
        );
      } else {
        setSoundBars((prev) => prev.map(() => 6));
      }
    }, 180);
    return () => clearInterval(interval);
  }, [micState, isMuted]);

  const executeUtterance = async (text: string, presetFallback?: typeof PLAYGROUND_PRESETS[0]) => {
    setMicState('listening');
    setTranscript(`“${text}”`);
    onShowToast('Streaming to T@S Engine', 'Processing intent & executing actions...');

    const apiKey = TATSBackendAPI.getApiKey();
    try {
      const startTime = Date.now();
      const res = await TATSBackendAPI.chat(apiKey, {
        client_user_id: 'playground_user',
        session_id: 'sess_vox_9941',
        message: text,
        is_voice: true
      });

      if (res.ok && res.data) {
        const totalMs = res.data.metrics?.total_ms || (Date.now() - startTime);
        const llmMs = res.data.metrics?.llm_ms || Math.round(totalMs * 0.45);
        const toolMs = res.data.metrics?.tool_ms || Math.round(totalMs * 0.25);
        const replyText = res.data.reply || `Executed action successfully.`;

        setCurrentTool(res.data.tool_executed || (presetFallback ? presetFallback.action : 'voice_reply'));
        setE2eLatency(totalMs);
        setStepLatencies({
          auth: 0.12,
          vector: 24,
          llm: llmMs,
          api: toolMs,
          tts: 140
        });
        setEndpointText(res.data.action_dispatched ? 'POST /api/v1/tools/execute/ → 200 OK' : 'POST /api/v1/chat/ → 200 OK');
        setCurrentActionPayload(
          res.data.tool_output && typeof res.data.tool_output === 'object'
            ? Object.fromEntries(Object.entries(res.data.tool_output).map(([k, v]) => [k, String(v)]))
            : { status: 'success', units: String(res.data.units_consumed || 1) }
        );
        setVoiceReply(`“${replyText}”`);
        onShowToast(`Dispatched via Django Backend`, `${totalMs}ms latency (${res.data.units_consumed || 1} units).`);

        setMicState('synthesizing');
        if ('speechSynthesis' in window && !isMuted) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(replyText);
          utter.lang = language;
          utter.onend = () => setMicState('listening');
          window.speechSynthesis.speak(utter);
        } else {
          setTimeout(() => setMicState('listening'), 1800);
        }
        return;
      } else if (res && !res.ok) {
        // Fix #25: Do not silently fake 200 OK on backend failure
        const errMsg = (res.data as any)?.message || (res.data as any)?.error || (res as any)?.error || `HTTP ${res.status} Error`;
        onShowToast('Backend Error', String(errMsg));
        setEndpointText(`POST /api/v1/chat/ → ${res.status || 'Error'}`);
        setVoiceReply(`“Execution failed: ${errMsg}”`);
        setMicState('listening');
        return;
      }
    } catch (err: any) {
      if (apiKey) {
        onShowToast('Connection Failed', err?.message || 'Unable to reach T@S backend engine.');
        setEndpointText('POST /api/v1/chat/ → Network Error');
        setVoiceReply('“Could not connect to backend engine. Please check your network or server status.”');
        setMicState('listening');
        return;
      }
    }

    // Only fallback to interactive demo simulation when not authenticated (no API key configured)
    if (presetFallback) {
      setCurrentTool(presetFallback.action);
      setE2eLatency(presetFallback.totalLatency);
      setStepLatencies({
        auth: 0.12,
        vector: presetFallback.asr,
        llm: presetFallback.llm,
        api: presetFallback.act,
        tts: 140
      });
      setEndpointText(`${presetFallback.method} ${presetFallback.endpoint} → Demo Mode`);
      setCurrentActionPayload({
        action: presetFallback.action,
        ...Object.fromEntries(Object.entries(presetFallback.result).map(([k, v]) => [k, String(v)]))
      });
      const reply = `“Executed ${presetFallback.action} with ${presetFallback.totalLatency}ms response time.”`;
      setVoiceReply(reply);
      onShowToast(`Demo Simulation: ${presetFallback.label}`, `Running in offline interactive demo mode.`);

      setTimeout(() => {
        setMicState('synthesizing');
        if ('speechSynthesis' in window && !isMuted) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(reply);
          utter.lang = language;
          utter.onend = () => setMicState('listening');
          window.speechSynthesis.speak(utter);
        } else {
          setTimeout(() => setMicState('listening'), 1800);
        }
      }, 500);
    }
  };

  const toggleMic = () => {
    if (micState === 'idle') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.lang = language;
          rec.continuous = false;
          rec.interimResults = false;
          rec.onstart = () => {
            setMicState('listening');
            onShowToast('Acoustic Stream Active', 'Microphone active. Speak your command now...');
          };
          rec.onresult = (event: any) => {
            const spoken = event.results[0][0].transcript;
            executeUtterance(spoken);
          };
          rec.onerror = () => {
            setMicState('idle');
            onShowToast('Microphone Standby', 'Microphone stream idle.');
          };
          rec.onend = () => {
            setMicState('idle');
          };
          rec.start();
          return;
        } catch {
          // Fallback
        }
      }

      setMicState('listening');
      onShowToast('Acoustic Stream Active', 'Listening for wake word "Hey Acme"...');
    } else if (micState === 'listening') {
      setMicState('synthesizing');
      onShowToast('Synthesizing Response', 'Neural voice generating response waveform...');
      setTimeout(() => {
        setMicState('idle');
      }, 2200);
    } else {
      setMicState('idle');
      onShowToast('Stream Paused', 'Acoustic parser in standby mode.');
    }
  };

  const executePreset = (preset: typeof PLAYGROUND_PRESETS[0]) => {
    executeUtterance(preset.utterance, preset);
  };

  return (
    <div className="w-full min-h-screen bg-[#FAF9F6] p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Page Header & Session Control Bar */}
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#FFE6DC] shadow-sm">
          <div className="flex flex-col gap-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-[#FFDAD2] text-[#84240D] font-['Outfit'] text-[11px] font-bold uppercase">
                Test Environment v2.4
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFAE33]"></span>
              <span className="text-xs text-[#57423D] font-medium font-mono">
                Session #VOX-9941
              </span>
            </div>
            <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-[#1D1A23] tracking-tight">
              Live Voice & Tool Execution Playground
            </h1>
            <p className="text-xs sm:text-sm text-[#57423D]">
              Test voice latency, wake word triggers, and autonomous tool dispatches in real-time.
            </p>
          </div>

          {/* Testing Mode Switcher Pill */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center p-1 bg-[#FAF9F6] border border-[#FFE6DC] rounded-full shadow-inner text-xs font-bold">
              <button
                onClick={() => setMode('voice')}
                className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                  mode === 'voice'
                    ? 'bg-white text-[#1D1A23] shadow-sm'
                    : 'text-[#57423D] hover:text-[#1D1A23]'
                }`}
              >
                <span className="material-symbols-outlined text-[#A53B22] text-[16px]">mic</span>
                <span>Voice Streaming</span>
              </button>
              <button
                onClick={() => setMode('sim')}
                className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                  mode === 'sim'
                    ? 'bg-white text-[#1D1A23] shadow-sm'
                    : 'text-[#57423D] hover:text-[#1D1A23]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">terminal</span>
                <span>Simulated Text</span>
              </button>
            </div>

            <button
              onClick={() => onShowToast('Pipeline Config', '64-bit PCM buffer running at 48kHz stereo.')}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FAF9F6] hover:bg-[#F3EBF8] text-[#1D1A23] font-bold text-xs border border-[#FFE6DC] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-[#006688]">tune</span>
              <span>Pipeline Config</span>
            </button>
          </div>
        </div>

        {/* Session Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 rounded-2xl bg-[#F8F1FE] border border-[#FFE6DC] text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00C2FF] shadow-[0_0_8px_rgba(0,194,255,0.8)] animate-pulse"></span>
              <span className="font-bold text-[#1D1A23]">Acoustic Pipeline Connected</span>
            </div>
            <span className="text-[#DEC0B9] font-mono">•</span>
            <span className="text-[#57423D]">WebSpeech + Whisper Stream Gateway</span>
            <span className="text-[#DEC0B9] font-mono">•</span>
            <span className="text-[#57423D]">64-bit PCM Audio Buffer Active</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-[#8B716B] uppercase font-['Outfit'] font-bold">Sampling:</span>
            <span className="px-2 py-0.5 rounded bg-white text-[#1D1A23] font-semibold border border-[#FFE6DC]">
              48kHz stereo
            </span>
          </div>
        </div>
      </div>

      {/* Central Audio Orb & Interaction Console Bento */}
      <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-10 border border-[#FFE6DC] shadow-xl flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Bioluminescent Background Ripple Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 rounded-full bg-[#FF7E5F]/10 animate-ping opacity-30" style={{ animationDuration: '3.5s' }}></div>
          <div className="w-80 h-80 rounded-full bg-[#00C2FF]/10 animate-ping opacity-25" style={{ animationDuration: '4.8s', animationDelay: '0.6s' }}></div>
          <div className="w-64 h-64 rounded-full bg-[#FFAE33]/15 animate-ping opacity-20" style={{ animationDuration: '2.8s', animationDelay: '1.2s' }}></div>
        </div>

        {/* Main Visual Orb Centerpiece */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Interactive Pulsing Mic Button Core */}
          <div
            onClick={toggleMic}
            className="relative flex items-center justify-center group cursor-pointer mb-5"
            title="Click to toggle voice state (Idle / Listening / Synthesizing)"
          >
            {/* Concentric Multi-glow Outer Aura */}
            <div className={`absolute w-44 h-44 rounded-full bg-gradient-to-tr from-[#FF7E5F]/40 via-[#FFAE33]/30 to-[#00C2FF]/30 blur-xl transition-transform duration-500 ${
              micState === 'listening' ? 'scale-125 animate-pulse' : 'scale-100'
            }`}></div>

            {/* Outer Pulsating Ring */}
            <div className="relative w-36 h-36 rounded-full p-2 bg-gradient-to-b from-white via-[#FFDAD2] to-[#FAF9F6] shadow-2xl flex items-center justify-center">
              {/* Central Core Sphere */}
              <div className={`w-full h-full rounded-full flex flex-col items-center justify-center text-white shadow-inner relative overflow-hidden transition-all duration-300 ${
                micState === 'listening'
                  ? 'bg-gradient-to-tr from-[#A53B22] via-[#FF7E5F] to-[#FFAE33]'
                  : micState === 'synthesizing'
                  ? 'bg-gradient-to-tr from-[#006688] via-[#00C2FF] to-[#75D1FF]'
                  : 'bg-gradient-to-tr from-[#57423D] to-[#8B716B]'
              }`}>
                <span className="material-symbols-outlined text-[44px] transition-transform duration-300 group-hover:scale-110">
                  {micState === 'listening' ? 'mic' : micState === 'synthesizing' ? 'graphic_eq' : 'mic_off'}
                </span>
                <div className="absolute top-1 left-2 w-14 h-6 rounded-full bg-white/30 blur-sm transform -rotate-12 pointer-events-none"></div>
              </div>
            </div>
          </div>

          {/* Live Acoustic State Label */}
          <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-[#FFDAD2]/60 text-[#84240D] mb-2">
            <span className={`w-2 h-2 rounded-full ${micState === 'listening' ? 'bg-[#FF5F45] animate-ping' : 'bg-[#FFAE33]'}`}></span>
            <span className="font-['Outfit'] font-bold text-xs tracking-wide">
              {micState === 'listening'
                ? 'Listening... (Speak command or test wake word: "Hey Acme")'
                : micState === 'synthesizing'
                ? 'Synthesizing voice response...'
                : 'Microphone Standby (Click to start)'}
            </span>
          </div>

          <p className="text-xs text-[#57423D] max-w-md mb-6">
            Zero-shot acoustic parser listening continuously. Stream chunk rate: 120ms buffers.
          </p>

          {/* Live Frequency Equalizer Waveform */}
          <div className="w-full max-w-xl bg-[#FAF9F6] rounded-2xl p-4 mb-6 border border-[#FFE6DC] shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-['Outfit'] font-bold text-[#A53B22] uppercase tracking-wider text-[11px]">
                Live Waveform Spectrum
              </span>
              <span className="text-[#006688] font-mono text-[10px] font-semibold">
                Gain: +4.2 dB • Peak: -1.8 dBFS
              </span>
            </div>

            <div className="h-16 w-full flex items-center justify-between gap-1 px-2">
              {soundBars.map((height, idx) => (
                <div
                  key={idx}
                  style={{ height: `${height}px` }}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    idx % 3 === 0 ? 'bg-[#FF7E5F]' : idx % 3 === 1 ? 'bg-[#FFAE33]' : 'bg-[#00C2FF]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Audio Peripheral Controls Bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 w-full max-w-2xl px-5 py-2.5 bg-[#FAF9F6] border border-[#FFE6DC] rounded-full shadow-sm text-xs">
            {/* Sensitivity Slider */}
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#57423D]">graphic_eq</span>
              <span className="text-[#57423D] font-semibold">Sensitivity</span>
              <input
                type="range"
                min={0}
                max={100}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="w-20 accent-[#FF7E5F] cursor-pointer h-1.5 rounded-full bg-[#EDE5F2]"
              />
              <span className="font-mono font-bold text-[#1D1A23]">{sensitivity}%</span>
            </div>

            <div className="w-px h-4 bg-[#DEC0B9] hidden sm:block"></div>

            {/* Mute Button */}
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                onShowToast(isMuted ? 'Microphone Unmuted' : 'Microphone Muted', '');
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#FFE6DC] hover:bg-[#F3EBF8] text-[#1D1A23] font-bold shadow-xs transition-colors"
            >
              <span className={`material-symbols-outlined text-[16px] ${isMuted ? 'text-[#8B716B]' : 'text-[#A53B22]'}`}>
                {isMuted ? 'mic_off' : 'mic'}
              </span>
              <span>{isMuted ? 'Muted' : 'Active Stream'}</span>
            </button>

            <div className="w-px h-4 bg-[#DEC0B9] hidden sm:block"></div>

            {/* Language Selector */}
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#006688]">translate</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent font-bold text-[#1D1A23] focus:outline-none cursor-pointer text-xs"
              >
                <option value="en-IN">Indian English</option>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="hi-EN">Hinglish (Hybrid)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Split Execution Terminal & Timeline (2-Column Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        {/* Left Card: Spoken Transcript & Phoneme Breakdown (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 bg-white p-6 rounded-3xl border border-[#FFE6DC] shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-[#FFE6DC]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#A53B22] text-[20px]">record_voice_over</span>
              <h2 className="font-['Outfit'] text-base font-bold text-[#1D1A23]">Spoken Transcript</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#C2E8FF] text-[#004D67] font-['Outfit'] text-[10px] font-bold uppercase">
              Real-Time Ingestion
            </span>
          </div>

          <div className="flex flex-col gap-2 p-4 bg-[#FAF9F6] border border-[#FFE6DC] rounded-2xl relative">
            <div className="flex items-center justify-between text-[11px] text-[#8B716B]">
              <span className="font-['Outfit'] font-bold text-[#A53B22] uppercase">Verified Audio Inbound</span>
              <span className="font-mono">17:42:09.112 UTC</span>
            </div>
            <p className="text-sm sm:text-base font-medium text-[#1D1A23] bg-white p-3.5 rounded-xl border border-[#FFE6DC] shadow-xs leading-relaxed font-['Outfit']">
              {transcript}
            </p>
            <div className="flex items-center justify-between text-xs text-[#57423D] pt-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#FFAE33] text-[15px]">graphic_eq</span>
                <span>Wake-word trigger detected: offset +210ms</span>
              </div>
              <span className="font-['Outfit'] font-bold text-[10px] text-[#A53B22] uppercase">CONFIRMED</span>
            </div>
          </div>

          {/* Biometrics & Confidence */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#8B716B] uppercase font-['Outfit']">Acoustic Score</span>
                <span className="material-symbols-outlined text-[#006688] text-[16px]">verified</span>
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="font-['Outfit'] text-2xl font-bold text-[#1D1A23]">98.7%</span>
                <span className="text-[11px] text-[#006688] font-bold">High fidelity</span>
              </div>
              <div className="w-full bg-[#EDE5F2] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#00C2FF] h-full w-[98.7%]"></div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#8B716B] uppercase font-['Outfit']">Speaker Biometrics</span>
                <span className="material-symbols-outlined text-[#A53B22] text-[16px]">fingerprint</span>
              </div>
              <div>
                <span className="font-mono font-bold text-sm text-[#1D1A23] block">tds</span>
                <span className="text-[10px] text-[#57423D]">Matched (99.4%)</span>
              </div>
              <span className="text-[10px] font-bold text-[#A53B22] uppercase font-['Outfit']">
                Role: Workspace Admin
              </span>
            </div>
          </div>

          {/* Phoneme Breakdown */}
          <div className="p-3.5 bg-[#FAF9F6] border border-[#FFE6DC] rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-[#8B716B] font-['Outfit']">
              Phoneme Stream Breakdown
            </span>
            <p className="font-mono text-xs text-[#57423D] bg-white p-2 rounded-lg border border-[#FFE6DC] overflow-x-auto whitespace-nowrap">
              /h.eɪ/ /æk.mi/ → /æd/ /ə/ /ˈkrɪt.ɪ.kəl/ /tæsk/ → /rɪˈvjuː/ /kjuː.θri/
            </p>
          </div>
        </div>

        {/* Right Card: Sequential Execution Timeline (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 bg-white p-6 rounded-3xl border border-[#FFE6DC] shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-[#FFE6DC]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#845400] text-[20px]">account_tree</span>
              <h2 className="font-['Outfit'] text-base font-bold text-[#1D1A23]">Execution Timeline</h2>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDDB6] text-[#643F00] text-xs font-bold font-['Outfit']">
              <span className="material-symbols-outlined text-[15px]">bolt</span>
              <span>Total E2E: {e2eLatency}ms</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white text-[#643F00] text-[10px]">SLA &lt;850ms</span>
            </div>
          </div>

          {/* Timeline Nodes */}
          <div className="flex flex-col gap-2.5 relative">
            {/* Step 1 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC]">
              <div className="w-7 h-7 rounded-full bg-[#00C2FF] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">check</span>
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1D1A23]">Step 1: Passphrase & Auth Verified</span>
                  <span className="font-mono font-bold text-[#006688]">{stepLatencies.auth}ms</span>
                </div>
                <p className="text-[#57423D] mt-0.5">
                  bcrypt salt match valid for tenant 'Acme-Corp-Production'. Session JWT stamped.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC]">
              <div className="w-7 h-7 rounded-full bg-[#00C2FF] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">database</span>
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1D1A23]">Step 2: Long-Term Memory Search</span>
                  <span className="font-mono font-bold text-[#006688]">{stepLatencies.vector}ms</span>
                </div>
                <p className="text-[#57423D] mt-0.5">
                  Found 2 relevant context notes (Project Acme Q3 Financial Tracker & User Directory).
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC]">
              <div className="w-7 h-7 rounded-full bg-[#FF7E5F] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">psychology</span>
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1D1A23]">Step 3: User Spoken Intent Decided</span>
                  <span className="font-mono font-bold text-[#A53B22]">{stepLatencies.llm}ms</span>
                </div>
                <p className="text-[#57423D] mt-0.5 mb-1.5">
                  Natural words accurately matched to backend function parameters (100% confidence).
                </p>
                <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                  {Object.entries(currentActionPayload).map(([k, v]) => (
                    <span key={k} className="px-2 py-0.5 rounded bg-white border border-[#FFE6DC] text-[#1D1A23]">
                      {k}: <strong>{v}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC]">
              <div className="w-7 h-7 rounded-full bg-[#FFAE33] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">send</span>
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1D1A23]">Step 4: Run Live Action on App Backend</span>
                  <span className="font-mono font-bold text-[#845400]">{stepLatencies.api}ms</span>
                </div>
                <p className="font-mono font-semibold text-[#006688] mt-0.5">
                  {endpointText}
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC]">
              <div className="w-7 h-7 rounded-full bg-[#A53B22] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">volume_up</span>
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1D1A23]">Step 5: Voice Reply Spoken Back</span>
                  <span className="font-mono font-bold text-[#A53B22]">{stepLatencies.tts}ms</span>
                </div>
                <p className="text-[#57423D] italic mt-0.5 font-medium font-['Outfit'] text-sm">
                  {voiceReply}
                </p>
              </div>
            </div>
          </div>

          {/* Allocation Bar */}
          <div className="p-3 bg-[#FAF9F6] border border-[#FFE6DC] rounded-2xl flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between items-center text-[10px] font-bold text-[#8B716B] uppercase font-['Outfit']">
              <span>Step Duration Allocation</span>
              <span>Total: {e2eLatency}ms</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#EDE5F2] flex overflow-hidden">
              <div className="bg-[#00C2FF] h-full" style={{ width: '8%' }}></div>
              <div className="bg-[#FF7E5F] h-full" style={{ width: '31%' }}></div>
              <div className="bg-[#FFAE33] h-full" style={{ width: '25%' }}></div>
              <div className="bg-[#A53B22] h-full" style={{ width: '36%' }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-[#8B716B]">
              <span>Memory Search (8%)</span>
              <span>Intent Reasoning (31%)</span>
              <span>Live Action (25%)</span>
              <span>Voice Reply (36%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Action Chips */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#57423D] font-['Outfit']">Sample Voice Prompts:</span>
          {PLAYGROUND_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => executePreset(preset)}
              className="px-3.5 py-1.5 rounded-full bg-[#FAF9F6] hover:bg-[#FFDAD2] text-[#1D1A23] hover:text-[#84240D] text-xs font-semibold border border-[#FFE6DC] transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onShowToast('Exported Trace', 'session_trace_VOX9941.json downloaded.')}
            className="px-4 py-1.5 rounded-full bg-[#FAF9F6] hover:bg-[#F3EBF8] text-[#1D1A23] text-xs font-bold border border-[#FFE6DC] transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Trace</span>
          </button>
          <button
            onClick={() => {
              setMicState('listening');
              onShowToast('Sandbox Restarted', 'Memory cache flushed and re-armed.');
            }}
            className="px-4 py-1.5 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Restart Sandbox</span>
          </button>
        </div>
      </div>
    </div>
  );
};
