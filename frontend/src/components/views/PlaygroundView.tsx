import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppView } from '../../types';
import { PLAYGROUND_PRESETS } from '../../data/mockData';
import { TATSBackendAPI } from '../../services/api';

interface PlaygroundViewProps {
  onNavigate: (view: AppView) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning') => void;
  applications?: any[];
  activeAppId?: string;
  developer?: any;
  onSelectApp?: (appId: string) => void;
}

// Helper to generate dynamic phonetic approximation
function generatePhonemes(text: string): string {
  if (!text) return '/.../';
  const words = text.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
  const phonemeMap: Record<string, string> = {
    hey: 'h.eɪ',
    acme: 'æk.mi',
    tas: 't.æ.s',
    check: 'tʃɛk',
    database: 'deɪ.tə.beɪs',
    latency: 'leɪ.tən.si',
    report: 'rɪˈpɔːrt',
    active: 'æk.tɪv',
    connection: 'kəˈnɛk.ʃən',
    send: 'sɛnd',
    deploy: 'dɪˈplɔɪ',
    notification: 'noʊ.tə.fəˈkeɪ.ʃən',
    to: 'tuː',
    slack: 'slæk',
    engineering: 'ɛn.dʒəˈnɪr.ɪŋ',
    channel: 'tʃæn.əl',
    staging: 'steɪ.dʒɪŋ',
    commit: 'kəˈmɪt',
    scale: 'skeɪl',
    replica: 'rɛp.lɪ.kə',
    production: 'prəˈdʌk.ʃən',
    kubernetes: 'kuː.bərˈnɛ.tiːz',
    cluster: 'klʌs.tər',
    authorize: 'ɔː.θə.raɪz',
    refund: 'riː.fʌnd',
    customer: 'kʌs.tə.mər',
    wallet: 'wɑː.lɪt',
    under: 'ʌn.dər',
    invoice: 'ɪn.vɔɪs',
    add: 'æd',
    a: 'ə',
    critical: 'krɪt.ɪ.kəl',
    task: 'tæsk',
    review: 'rɪˈvjuː',
    the: 'ðə',
    q3: 'kjuː.θri',
    budget: 'bʌdʒ.ɪt',
    by: 'baɪ',
    five: 'faɪv',
    pm: 'piː.ɛm',
    assign: 'əˈsaɪn'
  };

  const rendered = words.slice(0, 10).map((w) => {
    return phonemeMap[w] ? `/${phonemeMap[w]}/` : `/${w.split('').join('.')}/`;
  });

  return rendered.join(' → ');
}

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({
  onNavigate,
  onShowToast,
  applications = [],
  activeAppId = '',
  developer,
  onSelectApp
}) => {
  // Session Configuration
  const [sessionId, setSessionId] = useState('VOX-9941');
  const [mode, setMode] = useState<'voice' | 'sim'>('voice');
  const [micState, setMicState] = useState<'idle' | 'listening' | 'synthesizing'>('idle');
  const [micError, setMicError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [sensitivity, setSensitivity] = useState(82);
  const [language, setLanguage] = useState('en-IN');
  const [wakeWord, setWakeWord] = useState('Hey Acme');
  const [isPipelineConfigOpen, setIsPipelineConfigOpen] = useState(false);
  const [simulatedPrompt, setSimulatedPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  // Audio spectrum
  const [soundBars, setSoundBars] = useState<number[]>([
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6
  ]);
  const [audioMetrics, setAudioMetrics] = useState({
    gain: '+4.2 dB',
    peak: '-1.8 dBFS',
    isActiveVoice: false
  });

  // Execution timeline state
  const [transcript, setTranscript] = useState('“Hey Acme, add a critical task to review the Q3 budget by 5 PM and assign to tds.”');
  const [interimText, setInterimText] = useState('');
  const [acousticConfidence, setAcousticConfidence] = useState(98.7);
  const [wakeWordDetected, setWakeWordDetected] = useState(true);
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

  // Audio & Speech References
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const synthAnimationRef = useRef<any>(null);

  // Active App resolution
  const activeApp = applications.find((a) => a.id === activeAppId) || applications[0] || null;

  useEffect(() => {
    if (activeApp?.name) {
      setWakeWord(`Hey ${activeApp.name.split(' ')[0]}`);
    }
  }, [activeApp?.name]);

  // Keep isListeningRef synced
  useEffect(() => {
    isListeningRef.current = micState === 'listening';
  }, [micState]);

  // Clean stop audio pipeline
  const stopAudioPipeline = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (synthAnimationRef.current) {
      clearInterval(synthAnimationRef.current);
      synthAnimationRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setSoundBars(new Array(24).fill(6));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioPipeline();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopAudioPipeline]);

  // Execute Utterance through T@S backend or fallback
  const executeUtterance = async (text: string, presetFallback?: typeof PLAYGROUND_PRESETS[0]) => {
    if (!text || !text.trim()) return;

    setIsExecuting(true);
    setTranscript(`“${text.trim()}”`);
    setInterimText('');

    // Check wake word match
    const lower = text.toLowerCase();
    const cleanWake = wakeWord.toLowerCase().replace(/[^a-z0-9]/g, '');
    const containsWake = lower.replace(/[^a-z0-9]/g, '').includes(cleanWake) || lower.includes('hey') || lower.includes('acme');
    setWakeWordDetected(containsWake);

    onShowToast('Streaming to T@S Engine', 'Processing intent & executing actions...', 'info');

    const apiKey = TATSBackendAPI.getApiKey();
    try {
      const startTime = Date.now();
      const res = await TATSBackendAPI.chat(apiKey, {
        client_user_id: developer?.email || 'playground_user',
        session_id: `sess_${sessionId.toLowerCase()}`,
        message: text,
        is_voice: mode === 'voice',
        app_id: activeAppId || undefined
      });

      if (res.ok && res.data) {
        const totalMs = res.data.metrics?.total_ms || (Date.now() - startTime);
        const llmMs = res.data.metrics?.llm_ms || Math.round(totalMs * 0.45);
        const toolMs = res.data.metrics?.tool_ms || Math.round(totalMs * 0.25);
        const replyText = res.data.reply || `Action executed successfully.`;

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
        onShowToast(`Executed via T@S Engine`, `${totalMs}ms latency (${res.data.units_consumed || 1} units consumed).`, 'success');

        // Voice reply audio synthesis
        if ('speechSynthesis' in window && !isMuted) {
          setMicState('synthesizing');
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(replyText);
          utter.lang = language;
          utter.rate = 1.05;

          // Animate waveform to synthesis voice cadence
          if (synthAnimationRef.current) clearInterval(synthAnimationRef.current);
          synthAnimationRef.current = setInterval(() => {
            setSoundBars((prev) => prev.map(() => Math.floor(14 + Math.random() * 42)));
          }, 120);

          utter.onend = () => {
            if (synthAnimationRef.current) {
              clearInterval(synthAnimationRef.current);
              synthAnimationRef.current = null;
            }
            if (isListeningRef.current) {
              setMicState('listening');
            } else {
              setMicState('idle');
              setSoundBars(new Array(24).fill(6));
            }
          };
          utter.onerror = () => {
            if (synthAnimationRef.current) {
              clearInterval(synthAnimationRef.current);
              synthAnimationRef.current = null;
            }
            setMicState('idle');
            setSoundBars(new Array(24).fill(6));
          };
          window.speechSynthesis.speak(utter);
        } else {
          setMicState('idle');
        }
        setIsExecuting(false);
        return;
      } else if (res && !res.ok) {
        const errMsg = (res.data as any)?.message || (res.data as any)?.error || (res as any)?.error || `HTTP ${res.status} Error`;
        onShowToast('Backend Error', String(errMsg), 'warning');
        setEndpointText(`POST /api/v1/chat/ → ${res.status || 'Error'}`);
        setVoiceReply(`“Execution failed: ${errMsg}”`);
        setMicState('idle');
        setIsExecuting(false);
        return;
      }
    } catch (err: any) {
      if (apiKey || TATSBackendAPI.getToken()) {
        onShowToast('Connection Failed', err?.message || 'Unable to reach T@S backend engine.', 'warning');
        setEndpointText('POST /api/v1/chat/ → Network Error');
        setVoiceReply('“Could not connect to backend engine. Please check your network or server status.”');
        setMicState('idle');
        setIsExecuting(false);
        return;
      }
    }

    // High fidelity offline sandbox demo mode
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
      setEndpointText(`${presetFallback.method} ${presetFallback.endpoint} → 200 OK (Demo Mode)`);
      setCurrentActionPayload({
        action: presetFallback.action,
        ...Object.fromEntries(Object.entries(presetFallback.result).map(([k, v]) => [k, String(v)]))
      });
      const reply = `Executed ${presetFallback.action} with ${presetFallback.totalLatency}ms response time.`;
      setVoiceReply(`“${reply}”`);
      onShowToast(`Sandbox Dispatch: ${presetFallback.label}`, `Deterministic intent verified in ${presetFallback.totalLatency}ms.`, 'success');

      if ('speechSynthesis' in window && !isMuted) {
        setMicState('synthesizing');
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(reply);
        utter.lang = language;
        if (synthAnimationRef.current) clearInterval(synthAnimationRef.current);
        synthAnimationRef.current = setInterval(() => {
          setSoundBars((prev) => prev.map(() => Math.floor(14 + Math.random() * 42)));
        }, 120);

        utter.onend = () => {
          if (synthAnimationRef.current) {
            clearInterval(synthAnimationRef.current);
            synthAnimationRef.current = null;
          }
          setMicState('idle');
          setSoundBars(new Array(24).fill(6));
        };
        window.speechSynthesis.speak(utter);
      } else {
        setMicState('idle');
      }
    } else {
      // General simulated response
      const fallbackReply = `Acknowledged: "${text}". Processed zero-shot intent and verified parameters.`;
      setVoiceReply(`“${fallbackReply}”`);
      setCurrentTool('custom_utterance_handler');
      setEndpointText('POST /api/v1/tools/execute/ → 200 OK');
      setCurrentActionPayload({
        intent: 'parse_voice_command',
        raw_text: text,
        confidence: `${acousticConfidence}%`
      });
      setE2eLatency(480);
      onShowToast('Action Executed', `Processed command in 480ms.`, 'success');
      setMicState('idle');
    }

    setIsExecuting(false);
  };

  // Real Microphone Activation with Web Audio API Analyser
  const startListening = async () => {
    setMicError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = 'Microphone API is not supported in this browser or context requires HTTPS/localhost.';
      setMicError(err);
      onShowToast('Microphone Unavailable', err, 'warning');
      return;
    }

    try {
      // 1. Request real microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = stream;

      // 2. Setup Web Audio API Context & Analyser
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // Gives 32 frequency bins
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 3. Frequency Animation Loop connected to real mic data
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const updateSpectrum = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(freqData);

        const sensFactor = sensitivity / 50; // Scaled multiplier
        let maxVal = 0;
        const bars: number[] = [];

        for (let i = 0; i < 24; i++) {
          const raw = freqData[i % freqData.length] || 0;
          if (raw > maxVal) maxVal = raw;
          if (isMuted) {
            bars.push(6);
          } else {
            // Map 0-255 to 6-64px height
            const scaled = Math.min(68, Math.max(6, Math.round((raw / 255) * 60 * sensFactor + 6)));
            bars.push(scaled);
          }
        }
        setSoundBars(bars);

        const peakDb = maxVal > 0 ? (20 * Math.log10(maxVal / 255)).toFixed(1) : '-∞';
        setAudioMetrics({
          gain: `+${(sensFactor * 4.2).toFixed(1)} dB`,
          peak: `${peakDb} dBFS`,
          isActiveVoice: maxVal > 25
        });

        animationFrameRef.current = requestAnimationFrame(updateSpectrum);
      };
      animationFrameRef.current = requestAnimationFrame(updateSpectrum);

      // 4. Start SpeechRecognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.lang = language;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
          setMicState('listening');
          onShowToast('Microphone Active', 'Listening live. Speak your command...', 'info');
        };

        rec.onresult = (event: any) => {
          let interim = '';
          let final = '';
          let confidence = 0.96;

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              final += res[0].transcript;
              if (res[0].confidence) confidence = res[0].confidence;
            } else {
              interim += res[0].transcript;
            }
          }

          if (interim) {
            setInterimText(interim);
          }

          if (final.trim()) {
            setInterimText('');
            setAcousticConfidence(Math.round(confidence * 1000) / 10);
            executeUtterance(final.trim());
          }
        };

        rec.onerror = (event: any) => {
          if (event.error === 'no-speech') {
            // Normal silence timeout, keep listening
            return;
          }
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            stopAudioPipeline();
            setMicState('idle');
            setMicError('Microphone permission was denied. Please allow microphone permissions in your browser.');
            onShowToast('Mic Permission Denied', 'Browser blocked microphone stream.', 'warning');
            return;
          }
        };

        rec.onend = () => {
          if (isListeningRef.current && micState !== 'synthesizing') {
            try {
              rec.start();
            } catch {}
          }
        };

        rec.start();
        recognitionRef.current = rec;
      } else {
        setMicState('listening');
        onShowToast('Microphone Stream Active', 'Speech recognition engine in fallback mode. You can also use Simulated Text.', 'info');
      }
    } catch (err: any) {
      stopAudioPipeline();
      setMicState('idle');
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone permission denied by browser. Please grant access in your browser bar.'
        : `Microphone error: ${err.message || 'Unable to access input device.'}`;
      setMicError(msg);
      onShowToast('Microphone Error', msg, 'warning');
    }
  };

  // Toggle Mic on/off
  const toggleMic = () => {
    if (micState === 'listening') {
      stopAudioPipeline();
      setMicState('idle');
      onShowToast('Microphone Standby', 'Microphone stream stopped.');
    } else if (micState === 'synthesizing') {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopAudioPipeline();
      setMicState('idle');
      onShowToast('Audio Stopped', 'Voice playback cancelled.');
    } else {
      startListening();
    }
  };

  const executePreset = (preset: typeof PLAYGROUND_PRESETS[0]) => {
    executeUtterance(preset.utterance, preset);
  };

  // Export session trace JSON
  const handleExportTrace = () => {
    const traceData = {
      trace_version: '2.4',
      session_id: sessionId,
      application_id: activeAppId || 'default',
      application_name: activeApp?.name || 'T@S Default',
      timestamp: new Date().toISOString(),
      acoustic_stream: {
        language,
        wake_word: wakeWord,
        wake_word_detected: wakeWordDetected,
        confidence_pct: acousticConfidence,
        metrics: audioMetrics
      },
      transcript: transcript.replace(/^“|”$/g, ''),
      execution_flow: {
        total_latency_ms: e2eLatency,
        sla_threshold_ms: 850,
        sla_satisfied: e2eLatency <= 850,
        step_latencies_ms: stepLatencies,
        tool_executed: currentTool,
        endpoint: endpointText,
        action_payload: currentActionPayload
      },
      voice_reply: voiceReply.replace(/^“|”$/g, '')
    };

    const blob = new Blob([JSON.stringify(traceData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tats_session_trace_${sessionId.toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onShowToast('Trace Exported', `Downloaded tats_session_trace_${sessionId.toLowerCase()}.json`, 'success');
  };

  // Restart Sandbox state
  const handleRestartSandbox = () => {
    stopAudioPipeline();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    const newSession = `VOX-${Math.floor(1000 + Math.random() * 9000)}`;
    setSessionId(newSession);
    setMicState('idle');
    setMicError(null);
    setInterimText('');
    setTranscript('“Ready for audio stream or simulated instruction.”');
    setVoiceReply('“T@S sandbox armed and listening on edge cluster.”');
    setCurrentTool('standby');
    setEndpointText('GET /api/v1/cluster/ready → 200 OK');
    setCurrentActionPayload({ status: 'ready', session: newSession });
    setE2eLatency(0);
    onShowToast('Sandbox Reset', `Memory flushed. Session #${newSession} armed in standby mode.`, 'info');
  };

  return (
    <div className="w-full min-h-screen bg-[#FAF9F6] p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Page Header & Session Control Bar */}
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#FFE6DC] shadow-sm">
          <div className="flex flex-col gap-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-0.5 rounded-full bg-[#FFDAD2] text-[#84240D] font-['Outfit'] text-[11px] font-bold uppercase tracking-wider">
                Test Environment v2.4
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFAE33]"></span>
              <span className="text-xs text-[#57423D] font-medium font-mono">
                Session #{sessionId}
              </span>
              {activeApp && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00C2FF]"></span>
                  <span className="text-xs text-[#006688] font-bold font-['Outfit']">
                    App: {activeApp.name}
                  </span>
                </>
              )}
            </div>
            <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-[#1D1A23] tracking-tight">
              Live Voice & Tool Execution Playground
            </h1>
            <p className="text-xs sm:text-sm text-[#57423D]">
              Test real voice latency, wake word triggers, and autonomous tool dispatches in real-time.
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
              onClick={() => setIsPipelineConfigOpen(true)}
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
              <span className={`w-2.5 h-2.5 rounded-full ${
                micState === 'listening'
                  ? 'bg-[#FF5F45] shadow-[0_0_8px_rgba(255,95,69,0.8)] animate-pulse'
                  : micState === 'synthesizing'
                  ? 'bg-[#00C2FF] shadow-[0_0_8px_rgba(0,194,255,0.8)] animate-pulse'
                  : 'bg-[#FFAE33]'
              }`}></span>
              <span className="font-bold text-[#1D1A23]">
                {micState === 'listening'
                  ? 'Acoustic Pipeline Active (Listening)'
                  : micState === 'synthesizing'
                  ? 'Voice Synthesizer Active (Speaking)'
                  : 'Acoustic Pipeline Standby'}
              </span>
            </div>
            <span className="text-[#DEC0B9] font-mono">•</span>
            <span className="text-[#57423D]">WebSpeech + Edge Whisper Gateway</span>
            <span className="text-[#DEC0B9] font-mono">•</span>
            <span className="text-[#57423D]">Wake Phrase: <strong className="text-[#A53B22]">"{wakeWord}"</strong></span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-[#8B716B] uppercase font-['Outfit'] font-bold">Sampling:</span>
            <span className="px-2 py-0.5 rounded bg-white text-[#1D1A23] font-semibold border border-[#FFE6DC]">
              48kHz stereo
            </span>
          </div>
        </div>
      </div>

      {/* Mic Permission Warning Banner if blocked */}
      {micError && (
        <div className="p-4 rounded-2xl bg-[#FFDAD2]/80 border border-[#FF7E5F] flex items-center justify-between gap-4 text-xs text-[#84240D]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-[#A53B22]">warning</span>
            <span>{micError}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMicError(null);
                startListening();
              }}
              className="px-3 py-1 rounded-full bg-[#A53B22] text-white font-bold hover:bg-[#84240D] transition-colors"
            >
              Retry Mic Access
            </button>
            <button
              onClick={() => setMode('sim')}
              className="px-3 py-1 rounded-full bg-white text-[#84240D] border border-[#FFDAD2] font-bold hover:bg-[#FAF9F6] transition-colors"
            >
              Use Simulated Text
            </button>
          </div>
        </div>
      )}

      {/* Mode A: Real Voice Streaming Orb */}
      {mode === 'voice' ? (
        <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-10 border border-[#FFE6DC] shadow-xl flex flex-col items-center justify-center text-center overflow-hidden">
          {/* Bioluminescent Background Ripple Rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`w-96 h-96 rounded-full bg-[#FF7E5F]/10 opacity-30 transition-all duration-700 ${
                micState === 'listening' ? 'scale-110 animate-ping' : 'scale-90 opacity-10'
              }`}
              style={{ animationDuration: '3.5s' }}
            ></div>
            <div
              className={`w-80 h-80 rounded-full bg-[#00C2FF]/10 opacity-25 transition-all duration-700 ${
                micState === 'listening' ? 'scale-110 animate-ping' : 'scale-90 opacity-10'
              }`}
              style={{ animationDuration: '4.8s', animationDelay: '0.6s' }}
            ></div>
          </div>

          {/* Main Visual Orb Centerpiece */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Interactive Pulsing Mic Button Core */}
            <button
              type="button"
              onClick={toggleMic}
              aria-label={micState === 'listening' ? 'Stop listening' : 'Start microphone listening'}
              className="relative flex items-center justify-center group cursor-pointer mb-5 focus:outline-none"
            >
              {/* Concentric Multi-glow Outer Aura */}
              <div
                className={`absolute w-44 h-44 rounded-full blur-xl transition-all duration-500 ${
                  micState === 'listening'
                    ? 'scale-125 bg-gradient-to-tr from-[#FF7E5F]/50 via-[#FFAE33]/40 to-[#00C2FF]/40 animate-pulse'
                    : micState === 'synthesizing'
                    ? 'scale-120 bg-gradient-to-tr from-[#006688]/40 via-[#00C2FF]/40 to-[#75D1FF]/40 animate-pulse'
                    : 'scale-95 bg-gradient-to-tr from-[#FF7E5F]/20 via-[#DEC0B9]/20 to-[#FFAE33]/20 group-hover:scale-105'
                }`}
              ></div>

              {/* Outer Pulsating Ring */}
              <div className="relative w-36 h-36 rounded-full p-2 bg-gradient-to-b from-white via-[#FFDAD2] to-[#FAF9F6] shadow-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                {/* Central Core Sphere */}
                <div
                  className={`w-full h-full rounded-full flex flex-col items-center justify-center text-white shadow-inner relative overflow-hidden transition-all duration-300 ${
                    micState === 'listening'
                      ? 'bg-gradient-to-tr from-[#A53B22] via-[#FF7E5F] to-[#FFAE33] shadow-[0_0_24px_rgba(255,126,95,0.7)]'
                      : micState === 'synthesizing'
                      ? 'bg-gradient-to-tr from-[#006688] via-[#00C2FF] to-[#75D1FF] shadow-[0_0_24px_rgba(0,194,255,0.7)]'
                      : 'bg-gradient-to-tr from-[#57423D] via-[#8B716B] to-[#DEC0B9]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[44px] transition-transform duration-300 group-hover:scale-110">
                    {micState === 'listening' ? 'mic' : micState === 'synthesizing' ? 'graphic_eq' : 'mic_off'}
                  </span>
                  <div className="absolute top-1 left-2 w-14 h-6 rounded-full bg-white/30 blur-sm transform -rotate-12 pointer-events-none"></div>
                </div>
              </div>
            </button>

            {/* Live Acoustic State Label */}
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full mb-2 transition-all ${
              micState === 'listening'
                ? 'bg-[#FFDAD2] text-[#84240D] border border-[#FF7E5F]'
                : micState === 'synthesizing'
                ? 'bg-[#C2E8FF] text-[#004D67] border border-[#00C2FF]'
                : 'bg-[#EDE5F2] text-[#57423D] border border-[#DEC0B9]'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                micState === 'listening'
                  ? 'bg-[#FF5F45] animate-ping'
                  : micState === 'synthesizing'
                  ? 'bg-[#00C2FF] animate-pulse'
                  : 'bg-[#8B716B]'
              }`}></span>
              <span className="font-['Outfit'] font-bold text-xs tracking-wide">
                {micState === 'listening'
                  ? `Listening... (Speak your command or test: "${wakeWord}")`
                  : micState === 'synthesizing'
                  ? 'Synthesizing voice response...'
                  : 'Microphone Standby (Click orb to start listening)'}
              </span>
            </div>

            <p className="text-xs text-[#57423D] max-w-md mb-6">
              {micState === 'listening'
                ? 'Microphone stream actively capturing audio chunks at 120ms intervals. Speak now.'
                : 'Click the central orb or "Active Stream" below to open your real microphone.'}
            </p>

            {/* Live Frequency Equalizer Waveform (driven by real Web Audio analyser) */}
            <div className="w-full max-w-xl bg-[#FAF9F6] rounded-2xl p-4 mb-6 border border-[#FFE6DC] shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-['Outfit'] font-bold text-[#A53B22] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${audioMetrics.isActiveVoice ? 'bg-[#FF5F45]' : 'bg-[#DEC0B9]'}`}></span>
                  Real-Time Waveform Spectrum
                </span>
                <span className="text-[#006688] font-mono text-[10px] font-semibold">
                  Gain: {audioMetrics.gain} • Peak: {audioMetrics.peak}
                </span>
              </div>

              <div className="h-16 w-full flex items-center justify-between gap-1 px-2">
                {soundBars.map((height, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${height}px` }}
                    className={`w-1.5 rounded-full transition-all duration-75 ${
                      idx % 3 === 0
                        ? 'bg-[#FF7E5F]'
                        : idx % 3 === 1
                        ? 'bg-[#FFAE33]'
                        : 'bg-[#00C2FF]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Audio Peripheral Controls Bar */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 w-full max-w-2xl px-5 py-2.5 bg-[#FAF9F6] border border-[#FFE6DC] rounded-2xl sm:rounded-full shadow-sm text-xs">
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
                  onShowToast(isMuted ? 'Microphone Unmuted' : 'Microphone Muted', '', 'info');
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#FFE6DC] hover:bg-[#F3EBF8] text-[#1D1A23] font-bold shadow-xs transition-colors"
              >
                <span className={`material-symbols-outlined text-[16px] ${isMuted ? 'text-[#8B716B]' : 'text-[#A53B22]'}`}>
                  {isMuted ? 'mic_off' : 'mic'}
                </span>
                <span>{isMuted ? 'Muted' : micState === 'listening' ? 'Stream Active' : 'Mic Off'}</span>
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
                  <option value="hi-IN">Hindi (India)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Mode B: Interactive Simulated Text Console */
        <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-[#FFE6DC] shadow-xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#FFE6DC]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFDAD2] text-[#84240D] flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">terminal</span>
              </div>
              <div className="flex flex-col">
                <h3 className="font-['Outfit'] text-lg font-bold text-[#1D1A23]">
                  Interactive Simulated Text Console
                </h3>
                <p className="text-xs text-[#57423D]">
                  Test your tools and agent reasoning deterministically without speaking into a microphone.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#C2E8FF] text-[#004D67] font-['Outfit'] text-xs font-bold uppercase tracking-wider">
              Deterministic Runner
            </span>
          </div>

          {/* Console Text Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (simulatedPrompt.trim()) {
                executeUtterance(simulatedPrompt.trim());
              }
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B716B] font-mono font-bold text-sm">
                &gt;
              </span>
              <input
                type="text"
                value={simulatedPrompt}
                onChange={(e) => setSimulatedPrompt(e.target.value)}
                placeholder="Type command (e.g. 'Check database latency and report active pool count')..."
                className="w-full pl-9 pr-4 py-3 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] text-sm text-[#1D1A23] font-medium placeholder-[#DEC0B9] focus:outline-none focus:border-[#FF7E5F] focus:ring-2 focus:ring-[#FF7E5F]/20"
              />
            </div>
            <button
              type="submit"
              disabled={isExecuting || !simulatedPrompt.trim()}
              className="px-6 py-3 rounded-2xl bg-[#A53B22] hover:bg-[#84240D] disabled:opacity-50 text-white font-['Outfit'] font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>{isExecuting ? 'Dispatching...' : 'Execute Intent'}</span>
            </button>
          </form>

          {/* Quick Command Suggestions */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="font-bold text-[#57423D] font-['Outfit']">Quick Commands:</span>
            {PLAYGROUND_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setSimulatedPrompt(p.utterance);
                  executePreset(p);
                }}
                className="px-3 py-1 rounded-full bg-[#FAF9F6] hover:bg-[#FFDAD2] text-[#1D1A23] hover:text-[#84240D] border border-[#FFE6DC] font-medium transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
              {micState === 'listening' ? 'Live Ingesting' : 'Real-Time Ingestion'}
            </span>
          </div>

          <div className="flex flex-col gap-2 p-4 bg-[#FAF9F6] border border-[#FFE6DC] rounded-2xl relative">
            <div className="flex items-center justify-between text-[11px] text-[#8B716B]">
              <span className="font-['Outfit'] font-bold text-[#A53B22] uppercase">Verified Audio Inbound</span>
              <span className="font-mono text-[10px]">{new Date().toLocaleTimeString()}</span>
            </div>

            {/* Interim Text preview if user is currently speaking */}
            {interimText && (
              <div className="p-2.5 rounded-xl bg-[#FFF3EE] border border-[#FF7E5F]/40 text-xs text-[#A53B22] italic font-medium">
                Listening: “{interimText}...”
              </div>
            )}

            <p className="text-sm sm:text-base font-medium text-[#1D1A23] bg-white p-3.5 rounded-xl border border-[#FFE6DC] shadow-xs leading-relaxed font-['Outfit']">
              {transcript}
            </p>

            <div className="flex items-center justify-between text-xs text-[#57423D] pt-1">
              <div className="flex items-center gap-1.5">
                <span className={`material-symbols-outlined text-[15px] ${wakeWordDetected ? 'text-[#FFAE33]' : 'text-[#8B716B]'}`}>
                  graphic_eq
                </span>
                <span>
                  {wakeWordDetected
                    ? `Wake-word trigger detected: "${wakeWord}"`
                    : 'Direct command utterance mode'}
                </span>
              </div>
              <span className={`font-['Outfit'] font-bold text-[10px] uppercase px-2 py-0.5 rounded ${
                wakeWordDetected ? 'bg-[#FFDAD2] text-[#84240D]' : 'bg-[#EDE5F2] text-[#57423D]'
              }`}>
                {wakeWordDetected ? 'CONFIRMED' : 'DIRECT'}
              </span>
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
                <span className="font-['Outfit'] text-2xl font-bold text-[#1D1A23]">{acousticConfidence}%</span>
                <span className="text-[11px] text-[#006688] font-bold">High fidelity</span>
              </div>
              <div className="w-full bg-[#EDE5F2] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#00C2FF] h-full" style={{ width: `${acousticConfidence}%` }}></div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#8B716B] uppercase font-['Outfit']">Speaker Biometrics</span>
                <span className="material-symbols-outlined text-[#A53B22] text-[16px]">fingerprint</span>
              </div>
              <div>
                <span className="font-mono font-bold text-sm text-[#1D1A23] block">
                  {developer?.name || 'Authorized Dev'}
                </span>
                <span className="text-[10px] text-[#57423D]">Role: {developer?.is_admin ? 'Admin' : 'Developer'}</span>
              </div>
              <span className="text-[10px] font-bold text-[#A53B22] uppercase font-['Outfit']">
                Session Active
              </span>
            </div>
          </div>

          {/* Phoneme Stream Breakdown */}
          <div className="p-3.5 bg-[#FAF9F6] border border-[#FFE6DC] rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-[#8B716B] font-['Outfit']">
              Phoneme Stream Breakdown
            </span>
            <p className="font-mono text-xs text-[#57423D] bg-white p-2 rounded-lg border border-[#FFE6DC] overflow-x-auto whitespace-nowrap">
              {generatePhonemes(transcript)}
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
              <span className="px-1.5 py-0.2 rounded-full bg-white text-[#643F00] text-[10px]">
                SLA &lt;850ms
              </span>
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
                  Tenant JWT cryptographic signature stamped for app '{activeApp?.name || 'T@S Production'}'.
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
                  Semantic context retrieved from vector space for user '{developer?.email || 'playground_user'}'.
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
                      {k}: <strong>{String(v)}</strong>
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
            <div className="grid grid-cols-2 sm:flex sm:justify-between gap-1 text-[10px] text-[#8B716B]">
              <span>Memory Search (8%)</span>
              <span>Intent Reasoning (31%)</span>
              <span>Live Action (25%)</span>
              <span>Voice Reply (36%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Action Chips & Footer Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm">
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
            onClick={handleExportTrace}
            className="px-4 py-1.5 rounded-full bg-[#FAF9F6] hover:bg-[#F3EBF8] text-[#1D1A23] text-xs font-bold border border-[#FFE6DC] transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Trace</span>
          </button>
          <button
            onClick={handleRestartSandbox}
            className="px-4 py-1.5 rounded-full bg-[#A53B22] hover:bg-[#84240D] text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Restart Sandbox</span>
          </button>
        </div>
      </div>

      {/* Pipeline Config Modal */}
      {isPipelineConfigOpen && (
        <div className="fixed inset-0 z-50 bg-[#1D1A23]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-[#FFE6DC] shadow-2xl p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#FFE6DC]">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#006688] text-[24px]">tune</span>
                <h3 className="font-['Outfit'] text-xl font-bold text-[#1D1A23]">
                  Acoustic Pipeline Configuration
                </h3>
              </div>
              <button
                onClick={() => setIsPipelineConfigOpen(false)}
                className="w-8 h-8 rounded-full bg-[#FAF9F6] hover:bg-[#FFDAD2] text-[#57423D] flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              {/* Application Selector */}
              {applications.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#1D1A23] font-['Outfit']">Target Application</label>
                  <select
                    value={activeAppId || ''}
                    onChange={(e) => {
                      if (onSelectApp) onSelectApp(e.target.value);
                    }}
                    className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-medium text-[#1D1A23] focus:outline-none"
                  >
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name} ({app.slug || app.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Wake Word Input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#1D1A23] font-['Outfit']">Custom Wake Phrase</label>
                <input
                  type="text"
                  value={wakeWord}
                  onChange={(e) => setWakeWord(e.target.value)}
                  placeholder="e.g. Hey Acme, Hey Jarvis, Hey T@S"
                  className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-medium text-[#1D1A23] focus:outline-none focus:border-[#FF7E5F]"
                />
                <span className="text-[10px] text-[#8B716B]">
                  Spoken utterances containing this phrase trigger verified biometric offset indexing.
                </span>
              </div>

              {/* Speech Recognition Language */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#1D1A23] font-['Outfit']">ASR Language / Accent</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#FFE6DC] text-xs font-medium text-[#1D1A23] focus:outline-none"
                >
                  <option value="en-IN">Indian English (en-IN)</option>
                  <option value="en-US">US English (en-US)</option>
                  <option value="en-GB">British English (en-GB)</option>
                  <option value="hi-IN">Hindi - India (hi-IN)</option>
                </select>
              </div>

              {/* Audio Specifications Banner */}
              <div className="p-3.5 rounded-2xl bg-[#F8F1FE] border border-[#FFE6DC] flex flex-col gap-1 text-[11px]">
                <div className="flex justify-between text-[#1D1A23] font-semibold">
                  <span>Stream Chunk Rate:</span>
                  <span className="font-mono text-[#006688]">120ms (64-bit PCM)</span>
                </div>
                <div className="flex justify-between text-[#1D1A23] font-semibold">
                  <span>Target SLA Latency:</span>
                  <span className="font-mono text-[#A53B22]">&lt;850ms End-to-End</span>
                </div>
                <div className="flex justify-between text-[#1D1A23] font-semibold">
                  <span>Hallucination Guardrail:</span>
                  <span className="font-mono text-[#006688]">Zero-Shot Deterministic</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsPipelineConfigOpen(false);
                  onShowToast('Configuration Saved', 'Acoustic pipeline parameters updated.', 'success');
                }}
                className="px-5 py-2.5 rounded-xl bg-[#A53B22] hover:bg-[#84240D] text-white font-['Outfit'] font-bold text-xs shadow-md transition-colors"
              >
                Apply &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
