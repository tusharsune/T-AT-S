import React, { useState, useEffect } from 'react';
import { AppView } from '../../types';

interface ServicesViewProps {
  onNavigate: (view: AppView) => void;
  onOpenAuth: (notice?: string, targetView?: AppView) => void;
  developer: any;
  selectedServiceId?: string | null;
  onSelectService?: (serviceId: string | null) => void;
}

interface ServiceItem {
  id: string;
  category: 'voice' | 'tools' | 'infra';
  categoryLabel: string;
  title: string;
  badge: string;
  latency: string;
  icon: string;
  summary: string;
  longDescription: string;
  pipeline: { step: string; title: string; desc: string; latency: string }[];
  specs: { label: string; value: string; detail: string }[];
  useCases: { title: string; scenario: string; benefit: string; icon: string }[];
  codeSnippets: {
    fastapi: string;
    node: string;
    curl: string;
  };
  details: string[];
  actionLabel: string;
  actionView: AppView;
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  onNavigate,
  onOpenAuth,
  developer,
  selectedServiceId: propSelectedServiceId,
  onSelectService
}) => {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(() => {
    if (propSelectedServiceId !== undefined) return propSelectedServiceId;
    return localStorage.getItem('tats_selected_service') || null;
  });
  const [activeCategory, setActiveCategory] = useState<'all' | 'voice' | 'tools' | 'infra'>('all');
  const [detailTab, setDetailTab] = useState<'architecture' | 'code' | 'benchmarks' | 'usecases'>('architecture');
  const [codeLang, setCodeLang] = useState<'fastapi' | 'node' | 'curl'>('fastapi');
  const [copiedCode, setCopiedCode] = useState(false);

  // Synchronize when parent prop changes
  useEffect(() => {
    if (propSelectedServiceId !== undefined && propSelectedServiceId !== selectedServiceId) {
      setSelectedServiceId(propSelectedServiceId);
      setDetailTab('architecture');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [propSelectedServiceId]);

  // Synchronize with custom events (tats_service_selected) and storage events
  useEffect(() => {
    const handleServiceSelected = (e: any) => {
      const newId = e.detail !== undefined ? e.detail : localStorage.getItem('tats_selected_service');
      setSelectedServiceId(newId);
      setDetailTab('architecture');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleStorageChange = () => {
      const stored = localStorage.getItem('tats_selected_service');
      if (stored !== selectedServiceId) {
        setSelectedServiceId(stored);
        setDetailTab('architecture');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('tats_service_selected', handleServiceSelected);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('tats_service_selected', handleServiceSelected);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [selectedServiceId]);

  const services: ServiceItem[] = [
    {
      id: 'telephony',
      category: 'voice',
      categoryLabel: 'Voice & Telephony',
      title: 'Phone & Web Voice Calls (SIP / WebRTC)',
      badge: 'Core Acoustic Engine',
      latency: '< 850ms End-to-End',
      icon: 'call',
      summary: 'Carrier-grade telephony connecting real phone calls and web microphones to your backend services in real time.',
      longDescription: 'T@S Telephony bypasses the standard 3-second speech-to-text chain. Incoming audio packets stream over TLS/SRTP or WebRTC directly into an in-memory acoustic ring buffer. Spoken intents trigger your API in under 120ms, and responses stream back to the caller with zero perceived lag.',
      pipeline: [
        { step: '01', title: 'Carrier SIP / WebRTC Handshake', desc: 'Secure TLS/SRTP or Opus WebRTC stream connected from Twilio, Telnyx, or web mic.', latency: '12ms' },
        { step: '02', title: 'Volatile In-Memory Ingestion', desc: 'Dual-channel audio buffered in RAM. Background noise and keyboard clicks filtered out.', latency: '18ms' },
        { step: '03', title: 'Acoustic Intent Parsing & Dispatch', desc: 'Direct phoneme vector matching invokes your verified REST API webhook with exact parameters.', latency: '110ms' },
        { step: '04', title: 'Zero-Retention Audio Scrubbing', desc: 'Audio buffer scrubbed from RAM with POSIX memset_s upon execution. Zero disk writes.', latency: '< 5ms' }
      ],
      specs: [
        { label: 'Latency Turnaround', value: '< 850 ms', detail: 'Audio in to audio response out' },
        { label: 'Protocols Supported', value: 'SIP / RTP / WebRTC', detail: 'Twilio, Telnyx, Asterisk, Chrome/Safari' },
        { label: 'Audio Codecs', value: 'Opus, G.711u, G.711a', detail: 'Adaptive 8kHz–48kHz sampling' },
        { label: 'Concurrent Capacity', value: '10,000+ Calls', detail: 'Horizontal cluster auto-scaling' }
      ],
      useCases: [
        {
          title: '24/7 Inbound Customer Booking & Scheduling',
          scenario: 'Callers speak naturally to book appointments, check order status, or reschedule delivery slots.',
          benefit: 'Eliminates 3-minute IVR keypad trees; handles complex human interruptions effortlessly.',
          icon: 'calendar_month'
        },
        {
          title: 'Automated Emergency Field Dispatch',
          scenario: 'Field staff report urgent repair issues, service tickets, or road incidents via voice phone call.',
          benefit: 'Parses addresses and severity levels directly into internal ERP databases in real time.',
          icon: 'emergency'
        },
        {
          title: 'High-Volume Financial Triage & Wire Gating',
          scenario: 'Callers authenticate transactions through voice passphrases before releasing funds.',
          benefit: 'Zero voice biometrics persisted on disk; irreversible one-way cryptographic tokens only.',
          icon: 'account_balance'
        }
      ],
      codeSnippets: {
        fastapi: `# Fast, carrier-grade SIP telephony webhook in Python FastAPI
from fastapi import FastAPI, Request
from tat_engine import AcousticEngine

app = FastAPI(title="T@S Telephony Gateway")
engine = AcousticEngine(api_key="tas_live_981a34...")

@app.post("/voice/carrier-webhook")
async def handle_incoming_call(request: Request):
    # Ingests raw audio stream directly from carrier SIP trunk
    audio_stream = await request.body()
    result = await engine.execute_stream(audio_stream)
    
    return {
        "status": "dispatched",
        "action": result.name,
        "caller_id": result.caller_phone,
        "latency_ms": result.latency_ms
    }`,
        node: `// Fast WebRTC & SIP telephony receiver in Node.js / Express
import express from 'express';
import { AcousticAgent } from '@tats/sdk';

const app = express();
const agent = new AcousticAgent({ apiKey: 'tas_live_981a34...' });

app.post('/voice/telephony-webhook', async (req, res) => {
  // Evaluates live audio packet and triggers your internal services
  const response = await agent.executeVoice(req.body.audioStream);
  res.json({
    ok: true,
    intent: response.intent,
    params: response.arguments,
    turnaroundMs: response.latency
  });
});

app.listen(3000, () => console.log('Telephony agent listening on port 3000'));`,
        curl: `# Test telephony stream execution via native cURL
curl -X POST https://api.tats.internal/v1/telephony/execute \\
  -H "Authorization: Bearer tas_live_981a34..." \\
  -H "Content-Type: audio/x-wav" \\
  --data-binary "@test_call_sample.wav"`
      },
      details: [
        'Works on standard phone numbers (SIP trunks) and web apps (WebRTC).',
        'Zero audio saved on disk: voice is processed in volatile RAM and zeroized immediately.',
        'Natural conversational speech with smart turn-taking and smooth interruption handling.',
        'Automatic noise cancellation filters out coughing, typing, and background chatter.'
      ],
      actionLabel: 'Test in Live Voice Playground',
      actionView: 'live-voice-playground'
    },
    {
      id: 'tool_calling',
      category: 'tools',
      categoryLabel: 'API Execution & Tools',
      title: 'Reliable API & Tool Calling',
      badge: 'Zero Hallucinations',
      latency: '110ms Tool Execution',
      icon: 'build_circle',
      summary: 'Extracts exact names, dates, numbers, and parameters from spoken words and calls your API without making things up.',
      longDescription: 'Standard conversational chatbots frequently hallucinate numbers or invent non-existent parameters. T@S enforces strict, typed schema validation against your OpenAPI specifications before any network request is dispatched. If a critical parameter is ambiguous, T@S prompts for clarification rather than guessing.',
      pipeline: [
        { step: '01', title: 'Semantic Phoneme Extraction', desc: 'Raw acoustic phonemes converted into high-density intent vectors in memory.', latency: '45ms' },
        { step: '02', title: 'OpenAPI Schema Validation', desc: 'Parameters verified against your registered JSON Schema types and regex bounds.', latency: '8ms' },
        { step: '03', title: 'Deterministic Microservice Invocation', desc: 'Calls your HTTP REST or GraphQL endpoint with authenticated headers and payload.', latency: '55ms' },
        { step: '04', title: 'Structured Result Synthesis', desc: 'API response parsed into conversational confirmation audio returned to caller.', latency: '12ms' }
      ],
      specs: [
        { label: 'Parameter Accuracy', value: '99.4%', detail: 'Strict type and bounds verification' },
        { label: 'Hallucination Rate', value: '0.00%', detail: 'Guaranteed by schema enforcement' },
        { label: 'HTTP Methods', value: 'GET, POST, PUT, DELETE', detail: 'Custom headers, bearer tokens, HMAC' },
        { label: 'Dispatch Latency', value: '110 ms', detail: 'From speech end to API execution' }
      ],
      useCases: [
        {
          title: 'Database & ERP Inventory Queries',
          scenario: 'Spoken request: "Check available stock for SKU-8841 in the Mumbai warehouse."',
          benefit: 'Bypasses slow SQL portals; returns exact inventory numbers in milliseconds.',
          icon: 'inventory_2'
        },
        {
          title: 'Automated Linear / Jira Ticket Creation',
          scenario: 'Engineers on call: "Create high-priority ticket for API latency spike assigned to TDS."',
          benefit: 'Translates spoken sentences into structured tickets with proper labels and priorities.',
          icon: 'task_alt'
        },
        {
          title: 'One-Click Customer Refund Processing',
          scenario: 'Support agents authorize: "Refund invoice INV-9024 for 1,200 rupees to client wallet."',
          benefit: 'Executes verified refund APIs with full audit logs and cryptographic parameter checks.',
          icon: 'receipt_long'
        }
      ],
      codeSnippets: {
        fastapi: `# Register a typed action with strict schema validation in Python
from tat_engine import ActionRegistry, Param

registry = ActionRegistry(api_key="tas_live_981a34...")

@registry.tool(
    name="query_inventory",
    description="Check stock levels by SKU and warehouse location",
    params={
        "sku": Param(type=str, required=True, guide="Product stock keeping unit"),
        "warehouse": Param(type=str, default="primary", guide="Target warehouse code")
    }
)
async def query_inventory(sku: str, warehouse: str):
    # Runs deterministically whenever the caller asks for inventory
    stock = await db.fetch_stock(sku=sku, warehouse=warehouse)
    return {"sku": sku, "in_stock": stock.count, "reserved": stock.reserved}`,
        node: `// Register typed tool in Node.js with OpenAPI schema
import { ToolBuilder } from '@tats/sdk';

const tools = new ToolBuilder({ apiKey: 'tas_live_981a34...' });

tools.registerAction({
  name: 'process_refund',
  endpoint: 'https://api.internal/v1/refunds',
  method: 'POST',
  schema: {
    invoiceId: { type: 'string', required: true },
    amount: { type: 'number', required: true }
  }
});`,
        curl: `# Directly execute registered tool with typed parameters
curl -X POST https://api.tats.internal/v1/tools/execute \\
  -H "Authorization: Bearer tas_live_981a34..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "query_inventory",
    "arguments": { "sku": "SKU-9941", "warehouse": "in_central_1" }
  }'`
      },
      details: [
        'Strict parameter checking against your OpenAPI specifications.',
        'Eliminates made-up or hallucinated actions common in standard AI chatbots.',
        'Supports GET, POST, PUT, and DELETE with custom headers and timeouts.',
        'Runs actions instantly during calls or in the background via webhooks.'
      ],
      actionLabel: 'Open Visual Tool Builder',
      actionView: 'visual-tool-builder'
    },
    {
      id: 'voice_synthesis',
      category: 'voice',
      categoryLabel: 'Voice & Telephony',
      title: 'Instant Custom Brand Voices',
      badge: '6-Sec Zero-Shot Setup',
      latency: 'Streaming Chunk Audio',
      icon: 'record_voice_over',
      summary: 'Create natural, custom brand voices in seconds from just a short audio sample with zero model training.',
      longDescription: 'Forget spending thousands of dollars and weeks fine-tuning voice models. T@S Voice Synthesis extracts acoustic frequency anchors from a 6-second recording, creating an identical brand voice persona that streams real-time conversational responses with lifelike inflection and zero robotic monotone.',
      pipeline: [
        { step: '01', title: '6-Second Acoustic Fingerprint', desc: 'User uploads or speaks a 6-second audio snippet into the microphone.', latency: '6 sec' },
        { step: '02', title: 'Neural Timbre Anchor Analysis', desc: 'Extracts vocal formant ratios, pitch contours, and harmonic characteristics.', latency: '120ms' },
        { step: '03', title: 'Streaming Synthesizer Coupling', desc: 'Audio engine couples synthesized chunks with live API responses with zero pause.', latency: '65ms' },
        { step: '04', title: 'Biometric Anti-Cloning Shield', desc: 'Enforces owner authorization checks to prevent unauthorized voice impersonation.', latency: '< 5ms' }
      ],
      specs: [
        { label: 'Calibration Time', value: '6 Seconds', detail: 'Zero model fine-tuning required' },
        { label: 'Streaming Chunk Latency', value: '65 ms', detail: 'Immediate playback start' },
        { label: 'Audio Quality', value: '24kHz / 48kHz HD', detail: 'Broadcast-quality Opus / WAV' },
        { label: 'Cadence Control', value: 'Pitch & Inflection', detail: 'Customizable tone and pacing' }
      ],
      useCases: [
        {
          title: 'Custom Brand Telephony Voice',
          scenario: 'Replace generic robotic IVRs with your founder or spokesperson’s authentic, friendly voice.',
          benefit: 'Increases caller trust and NPS scores by 40% over standard automated systems.',
          icon: 'record_voice_over'
        },
        {
          title: 'Multilingual Customer Support',
          scenario: 'Maintain the exact same vocal identity across English, Hindi, and regional dialects.',
          benefit: 'Consistent brand presence across global telephony markets without hiring voice actors.',
          icon: 'translate'
        },
        {
          title: 'VIP Concierge & Executive Briefings',
          scenario: 'Private voice briefing delivered every morning directly to customer smartphones.',
          benefit: 'Warm, personalized audio with high engagement and instant user recognition.',
          icon: 'stars'
        }
      ],
      codeSnippets: {
        fastapi: `# Calibrate a brand voice persona in Python
from tat_engine import VoicePersona

persona = VoicePersona(api_key="tas_live_981a34...")

# Upload 6-second sample WAV or microphone recording
voice_profile = persona.calibrate(
    name="CustomerSupportLead",
    sample_path="recordings/brand_voice_sample.wav",
    inflection="warm_professional"
)
print("Calibrated Voice ID:", voice_profile.id)`,
        node: `// Stream real-time synthesized voice in Node.js
import { VoiceSynthesizer } from '@tats/sdk';

const synth = new VoiceSynthesizer({ apiKey: 'tas_live_981a34...' });

const audioStream = await synth.speakStream({
  text: "Hello! Your package has been dispatched from Mumbai and arrives at 4 PM.",
  voiceProfileId: "voice_prof_8819a"
});`,
        curl: `# Synthesize speech using custom voice profile
curl -X POST https://api.tats.internal/v1/voice/synthesize \\
  -H "Authorization: Bearer tas_live_981a34..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "voice_id": "voice_prof_8819a",
    "text": "Your transaction 902 has been verified successfully."
  }' \\
  --output response_audio.wav`
      },
      details: [
        '6-second setup from an audio file or microphone recording.',
        'Natural speaking tone designed for friendly customer support.',
        'Fast streaming playback with zero awkward pauses.',
        'Built-in voice verification to prevent unauthorized voice cloning.'
      ],
      actionLabel: 'Calibrate Voice Profile',
      actionView: 'component-wizard'
    },
    {
      id: 'cluster_isolation',
      category: 'infra',
      categoryLabel: 'Security & Infrastructure',
      title: 'Dedicated App Workspaces & Air-Gapped VPC',
      badge: 'Private & Secure',
      latency: '100% Isolated Subnet',
      icon: 'dns',
      summary: 'Separate workspaces with dedicated API keys, private pgvector data, and custom usage limits.',
      longDescription: 'For healthcare, defense, and fintech organizations with strict sovereignty requirements, T@S provides complete workspace isolation. Run entirely inside your corporate AWS VPC, Azure Kubernetes, or bare-metal servers. No caller audio, transcripts, or customer records ever leave your firewall.',
      pipeline: [
        { step: '01', title: 'Subnet Boundary Hardening', desc: 'Deployed inside private VPC subnet with public egress blocked by default.', latency: 'Static' },
        { step: '02', title: 'Row-Level PostgreSQL Isolation', desc: 'Each app workspace isolated with dedicated pgvector namespaces and cryptographic keys.', latency: '< 2ms' },
        { step: '03', title: 'Zero Telemetry Leaks', desc: 'Internal microservice queries and voice phonemes never touch external public clouds.', latency: 'Zero Egress' },
        { step: '04', title: 'Audit Trail & Compliance Logging', desc: 'Comprehensive POSIX audit logs for SOC 2 Type II, HIPAA BAA, and GDPR compliance.', latency: 'Async' }
      ],
      specs: [
        { label: 'Deployment Modes', value: 'VPC / On-Prem / Bare-Metal', detail: 'Docker Compose, Kubernetes Helm' },
        { label: 'Data Egress', value: 'Strictly None', detail: 'Air-gapped architecture supported' },
        { label: 'Tenant Isolation', value: 'PostgreSQL RLS + pgvector', detail: 'Cryptographically separated keys' },
        { label: 'Compliance Standards', value: 'SOC 2, GDPR, HIPAA BAA', detail: 'Enterprise DPAs backed by contract' }
      ],
      useCases: [
        {
          title: 'HIPAA-Compliant Clinical Telehealth',
          scenario: 'Patients speak confidential medical symptoms and prescription refills over the phone.',
          benefit: 'Zero voice on disk; isolated inside hospital VPC with signed Business Associate Agreements.',
          icon: 'health_and_safety'
        },
        {
          title: 'Air-Gapped Defense & Aerospace Logins',
          scenario: 'Field operations run on internal intranet networks without external Internet access.',
          benefit: 'Runs completely offline from self-hosted OCI tarballs with zero external dependencies.',
          icon: 'shield'
        },
        {
          title: 'Multi-Brand Agency Sub-Workspaces',
          scenario: 'Digital agencies managing voice phone agents for 50 distinct corporate clients.',
          benefit: 'Each client receives isolated API keys, separate usage quotas, and dedicated analytics.',
          icon: 'domain'
        }
      ],
      codeSnippets: {
        fastapi: `# Deploying an isolated T@S worker inside your private VPC
from tat_engine import SovereignCluster

cluster = SovereignCluster(
    vpc_subnet="10.0.4.0/24",
    database_url="postgresql://postgres:secret@private-db.internal:5432/tats_isolated",
    allow_external_egress=False
)
cluster.start_worker_pool(replicas=4)`,
        node: `// Initialize isolated client with private cluster endpoint
import { AcousticAgent } from '@tats/sdk';

const agent = new AcousticAgent({
  apiKey: process.env.TATS_WORKSPACE_KEY,
  endpoint: 'https://tats-private.internal-vpc.net' // Air-gapped internal URL
});`,
        curl: `# Verify private VPC cluster health
curl -X GET https://tats-private.internal-vpc.net/health \\
  -H "Authorization: Bearer tas_live_internal_..."`
      },
      details: [
        'Complete separation of workspace apps to keep your data safe and isolated.',
        'Scoped tas_live_* API keys that you can generate or revoke anytime.',
        'Role-based access control with developer and admin permissions.',
        'Option to run on your own internal servers or private cloud.'
      ],
      actionLabel: 'Manage App Workspaces',
      actionView: 'developer-dashboard'
    },
    {
      id: 'telemetry_metering',
      category: 'infra',
      categoryLabel: 'Security & Infrastructure',
      title: 'Action Unit Accounting & Transparent Billing',
      badge: 'Pay As You Go',
      latency: 'Real-Time Metering',
      icon: 'speed',
      summary: 'Clear Action Unit accounting with automatic history cleanup so you never overpay for unused tokens.',
      longDescription: 'Traditional LLM voice agents charge unpredictable, compounding token fees that explode with long prompts. T@S uses deterministic Action Units: 1 unit per text query, 2 units per voice turn, 3 units per API action. Automatic session cleanup maintains only your latest 300 sessions to keep system memory razor sharp.',
      pipeline: [
        { step: '01', title: 'Deterministic Unit Calculation', desc: 'Metered exactly at 1 unit (text), 2 units (voice turn), 3 units (tool execution).', latency: '< 1ms' },
        { step: '02', title: '10% Grace Buffer Protection', desc: 'Active customer phone calls are never cut off mid-conversation when quota nears limit.', latency: 'Continuous' },
        { step: '03', title: '300-Session Fast Pruning', desc: 'Old telemetry sessions pruned automatically to keep dashboard lightning-fast.', latency: 'Scheduled' },
        { step: '04', title: 'Instant Quota Top-Up via Razorpay', desc: 'Secure bank payments with instant credit allocation to your live app cluster.', latency: 'Instant' }
      ],
      specs: [
        { label: 'Text Query Multiplier', value: '1 Unit', detail: 'Instant semantic classification' },
        { label: 'Voice Turn Multiplier', value: '2 Units', detail: 'Live speech in + audio out' },
        { label: 'Tool Call Multiplier', value: '3 Units', detail: 'Validated REST API execution' },
        { label: 'Grace Buffer', value: '10% Buffer', detail: 'Prevents mid-call customer drop-offs' }
      ],
      useCases: [
        {
          title: 'Predictable Monthly SaaS Cost Forecasts',
          scenario: 'Finance teams budget voice services without surprise token invoices.',
          benefit: 'Every action has a fixed, documented unit cost; zero variability based on prompt size.',
          icon: 'payments'
        },
        {
          title: 'High-Volume Call Center Cost Reduction',
          scenario: 'Call centers running 50,000 minutes of automated customer service each month.',
          benefit: 'Saves up to 81% compared to traditional $0.08/min speech-to-text-to-speech chains.',
          icon: 'trending_down'
        },
        {
          title: 'Client Billing Sub-Accounts',
          scenario: 'Software vendors embedding voice actions into their own B2B applications.',
          benefit: 'Direct API to query unit balances and bill end-users on actual executions.',
          icon: 'receipt'
        }
      ],
      codeSnippets: {
        fastapi: `# Check remaining Action Units and cluster quota in Python
from tat_engine import QuotaManager

quota = QuotaManager(api_key="tas_live_981a34...")
status = quota.get_balance()

print(f"Remaining Units: {status.units_available}")
print(f"Grace Buffer Active: {status.in_grace_buffer}")
print(f"Active Calls: {status.active_concurrency}")`,
        node: `// Check usage balance via Node.js SDK
import { QuotaClient } from '@tats/sdk';

const quota = new QuotaClient({ apiKey: 'tas_live_981a34...' });
const balance = await quota.getBalance();
console.log('Units Remaining:', balance.unitsAvailable);`,
        curl: `# Query live quota balance via cURL
curl -X GET https://api.tats.internal/v1/quota/balance \\
  -H "Authorization: Bearer tas_live_981a34..."`
      },
      details: [
        'Simple units: 1 unit per text query, 2 units per voice turn, 3 units per API action.',
        'Automatic cleanup keeps only the newest 300 sessions to keep things fast.',
        '10% grace buffer ensures important customer calls are never cut off.',
        'Safe payments powered by Razorpay for easy top-ups and upgrades.'
      ],
      actionLabel: 'View Subscription & Pricing',
      actionView: 'subscription-pricing'
    },
    {
      id: 'developer_sdk',
      category: 'tools',
      categoryLabel: 'API Execution & Tools',
      title: 'Developer SDKs & Starter Templates',
      badge: '5-Min Setup',
      latency: 'Ready to Run',
      icon: 'terminal',
      summary: 'Ready-to-use libraries and templates for FastAPI, Django, Express, and React applications.',
      longDescription: 'Everything you need to embed voice control into your existing apps in minutes. We provide official client libraries with TypeScript declarations, Python type hints, automatic WebSocket reconnection handling, and starter repositories for bookings, customer triage, and logistics.',
      pipeline: [
        { step: '01', title: 'One-Line Package Install', desc: 'pip install t-at-s or npm install @tats/sdk in your current project.', latency: '< 10 sec' },
        { step: '02', title: 'Authentication & Cluster Handshake', desc: 'Initialize with your scoped tas_live_* key; automatically connects to fastest local edge.', latency: '15ms' },
        { step: '03', title: 'Action Registration Decorators', desc: 'Decorate normal Python/JS functions to expose them to spoken voice commands.', latency: '< 5ms' },
        { step: '04', title: 'Live Browser / Telephony Streaming', desc: 'useAcousticSession React hook manages microphone permissions and streaming chunks.', latency: 'Instant' }
      ],
      specs: [
        { label: 'Python Library', value: 'pip install t-at-s', detail: 'Supports FastAPI, Django, Flask' },
        { label: 'JavaScript / Node', value: 'npm i @tats/sdk', detail: 'Full TypeScript typings included' },
        { label: 'React Hook Bundle', value: '< 14 KB gzip', detail: 'Microphone streaming with zero bloat' },
        { label: 'Starter Templates', value: '4 Ready Apps', detail: 'Bookings, Triage, Refunds, Logistics' }
      ],
      useCases: [
        {
          title: 'Turn Any Python REST API Into Voice Action',
          scenario: 'Add @engine.register_action over an existing Django or FastAPI function.',
          benefit: 'Zero architecture refactoring; voice callers trigger the exact same business logic.',
          icon: 'code'
        },
        {
          title: '1-Click React Web Microphone Controls',
          scenario: 'Embed a voice microphone button in any Next.js or React web dashboard.',
          benefit: 'useAcousticSession handles audio chunks, permission modals, and playback.',
          icon: 'mic'
        },
        {
          title: 'CI/CD Automated Telephony Testing',
          scenario: 'Run synthetic voice test calls against staging clusters before deploying to production.',
          benefit: 'Verifies audio turnaround latency and tool schema execution automatically in GitHub Actions.',
          icon: 'verified'
        }
      ],
      codeSnippets: {
        fastapi: `# Rapid starter template in Python FastAPI
from fastapi import FastAPI
from tat_engine import AcousticEngine

app = FastAPI()
engine = AcousticEngine(api_key="tas_live_981a34...")

@engine.action(name="triage_customer", schema={"reason": str, "urgency": int})
async def customer_triage(reason: str, urgency: int):
    # Automatically invoked from phone callers
    return {"assigned_tier": "VIP" if urgency > 3 else "STANDARD"}`,
        node: `// Starter template in Node.js / Express
import express from 'express';
import { AcousticAgent } from '@tats/sdk';

const app = express();
const agent = new AcousticAgent({ apiKey: 'tas_live_981a34...' });

app.post('/api/voice-hook', async (req, res) => {
  const result = await agent.executeVoice(req.body.audio);
  res.json({ action: result.name, parameters: result.args });
});`,
        curl: `# Native HTTP request to execute voice action
curl -X POST https://api.tats.internal/v1/voice/execute \\
  -H "Authorization: Bearer tas_live_981a34..." \\
  -H "Content-Type: application/json" \\
  -d '{"utterance": "Create task ship code review by 5 PM"}'`
      },
      details: [
        'Python SDK (pip install t-at-s) with simple function decorators.',
        'React hooks (useAcousticSession) for 1-click web microphone streaming.',
        'Starter templates for bookings, customer support, orders, and inquiries.',
        'Interactive API sandbox to test endpoints in your browser before going live.'
      ],
      actionLabel: 'Launch Developer Dashboard',
      actionView: 'developer-dashboard'
    }
  ];

  const currentService = services.find((s) => s.id === selectedServiceId) || null;

  const filteredServices = activeCategory === 'all'
    ? services
    : services.filter((s) => s.category === activeCategory);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSelectService = (id: string) => {
    setSelectedServiceId(id);
    localStorage.setItem('tats_selected_service', id);
    if (onSelectService) {
      onSelectService(id);
    } else {
      window.dispatchEvent(new CustomEvent('tats_service_selected', { detail: id }));
    }
    setDetailTab('architecture');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToAll = () => {
    setSelectedServiceId(null);
    localStorage.removeItem('tats_selected_service');
    if (onSelectService) {
      onSelectService(null);
    } else {
      window.dispatchEvent(new CustomEvent('tats_service_selected', { detail: null }));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // -------------------------------------------------------------
  // DEDICATED INDIVIDUAL SERVICE DETAIL PAGE
  // -------------------------------------------------------------
  if (currentService) {
    return (
      <div className="w-full min-h-screen bg-[#FAF9F6] text-[#1D1A23] font-['Manrope'] pb-24">
        {/* Top Sticky Breadcrumb Bar */}
        <div className="w-full border-b border-[#FFE6DC]/80 bg-white/80 backdrop-blur-md sticky top-16 z-30 px-4 sm:px-8 py-3">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleBackToAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F6] hover:bg-[#FFE6DC] border border-[#DEC0B9]/60 text-xs font-bold text-[#A53B22] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>All Services Catalog</span>
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#8B716B]">Services</span>
              <span className="text-[#DEC0B9]">/</span>
              <span className="text-[#8B716B]">{currentService.categoryLabel}</span>
              <span className="text-[#DEC0B9]">/</span>
              <span className="font-bold text-[#1D1A23] font-['Outfit']">{currentService.title}</span>
            </div>
          </div>
        </div>

        {/* Detail Hero Section */}
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-10 sm:pt-12 space-y-10">
          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#FF7E5F] via-[#FFAE33] to-[#FF7E5F]" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-[#FFE6DC]/80">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#FFF6F3] border border-[#FFDAD2] text-[#A53B22] flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[32px]">{currentService.icon}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono font-bold text-[#A53B22] uppercase tracking-wider">
                      {currentService.categoryLabel}
                    </span>
                    <span className="text-[#DEC0B9]">•</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFF6F3] border border-[#FFDAD2] text-[#A53B22] font-mono text-[10px] font-bold">
                      {currentService.badge}
                    </span>
                  </div>
                  <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-[#1D1A23]">
                    {currentService.title}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (developer) {
                      onNavigate(currentService.actionView);
                    } else {
                      onOpenAuth(`Sign in or register to test ${currentService.title}.`, currentService.actionView);
                    }
                  }}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FFAE33] hover:from-[#FF6B47] hover:to-[#FF9E1B] text-white text-xs font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>{currentService.actionLabel}</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>

            <p className="text-sm sm:text-base text-[#57423D] leading-relaxed mt-6">
              {currentService.longDescription}
            </p>

            {/* Quick Switcher Between Other Services */}
            <div className="mt-8 pt-6 border-t border-[#FFE6DC]/80">
              <div className="text-[11px] font-bold text-[#8B716B] uppercase tracking-wider mb-3 font-['Outfit']">
                Explore Other Platform Services:
              </div>
              <div className="flex flex-wrap gap-2">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => handleSelectService(svc.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      svc.id === currentService.id
                        ? 'bg-[#1D1A23] text-white shadow-xs'
                        : 'bg-[#FAF9F6] text-[#57423D] hover:text-[#1D1A23] border border-[#FFE6DC] hover:bg-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{svc.icon}</span>
                    <span>{svc.title.split('(')[0].trim()}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center justify-start gap-2 border-b border-[#FFE6DC] pb-3 overflow-x-auto whitespace-nowrap p-1">
            {[
              { id: 'architecture', label: '1. Architecture & Pipeline', icon: 'account_tree' },
              { id: 'code', label: '2. Integration Code', icon: 'code' },
              { id: 'benchmarks', label: '3. Benchmarks & SLAs', icon: 'speed' },
              { id: 'usecases', label: '4. Production Use Cases', icon: 'domain' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  detailTab === tab.id
                    ? 'bg-[#A53B22] text-white shadow-xs'
                    : 'bg-white text-[#57423D] hover:text-[#1D1A23] border border-[#FFE6DC]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: ARCHITECTURE & PIPELINE */}
          {detailTab === 'architecture' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="p-7 sm:p-8 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#FFE6DC]/80">
                  <div>
                    <h3 className="font-['Outfit'] text-xl font-bold text-[#1D1A23]">
                      How {currentService.title.split('(')[0].trim()} Works in Production
                    </h3>
                    <p className="text-xs text-[#57423D] mt-1">
                      Step-by-step low-latency execution pipeline through T@S core kernel.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono text-xs font-bold">
                    {currentService.latency}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentService.pipeline.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#A53B22] text-white font-mono text-[11px] font-bold">
                          Stage {step.step}
                        </span>
                        <span className="font-mono text-xs text-[#845400] font-bold">
                          {step.latency}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-['Outfit'] font-bold text-base text-[#1D1A23] mb-1">
                          {step.title}
                        </h4>
                        <p className="text-xs text-[#57423D] leading-relaxed">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Architectural Principles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentService.details.map((detail, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white border border-[#FFE6DC] flex items-start gap-3 shadow-2xs">
                    <span className="material-symbols-outlined text-[18px] text-[#A53B22] shrink-0 mt-0.5">verified</span>
                    <span className="text-xs text-[#57423D] leading-relaxed">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: INTEGRATION CODE */}
          {detailTab === 'code' && (
            <div className="p-7 sm:p-8 rounded-3xl bg-[#191720] text-white shadow-2xl border border-white/10 space-y-6 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <h3 className="font-['Outfit'] text-lg font-bold text-white">
                    Integration Code &amp; Webhook Handler
                  </h3>
                  <p className="text-xs text-[#A49BAF] mt-0.5">
                    Production-ready snippets with official SDKs
                  </p>
                </div>

                {/* Language Switcher */}
                <div className="flex items-center gap-1 p-1 bg-white/10 rounded-full border border-white/10">
                  {(['fastapi', 'node', 'curl'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setCodeLang(lang)}
                      className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        codeLang === lang
                          ? 'bg-[#FF7E5F] text-white shadow-xs'
                          : 'text-[#DEC0B9] hover:text-white'
                      }`}
                    >
                      {lang === 'fastapi' ? 'Python / FastAPI' : lang === 'node' ? 'Node.js / Express' : 'cURL / REST'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code Box with One-Click Copy */}
              <div className="relative">
                <button
                  onClick={() => handleCopy(currentService.codeSnippets[codeLang])}
                  className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors cursor-pointer"
                  title="Copy snippet to clipboard"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {copiedCode ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
                <pre className="p-5 rounded-2xl bg-black/40 border border-white/10 font-mono text-xs leading-relaxed text-emerald-300 overflow-x-auto">
                  <code>{currentService.codeSnippets[codeLang]}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: BENCHMARKS & SLAS */}
          {detailTab === 'benchmarks' && (
            <div className="p-7 sm:p-8 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm space-y-6 animate-in fade-in">
              <div className="pb-4 border-b border-[#FFE6DC]/80">
                <h3 className="font-['Outfit'] text-xl font-bold text-[#1D1A23]">
                  Production Specifications &amp; Latency Benchmarks
                </h3>
                <p className="text-xs text-[#57423D] mt-1">
                  Guaranteed uptime metrics, throughput limits, and protocol bounds.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentService.specs.map((spec, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col justify-between space-y-1">
                    <span className="text-[11px] font-bold text-[#8B716B] uppercase font-['Outfit']">
                      {spec.label}
                    </span>
                    <div className="font-['Outfit'] text-2xl font-bold text-[#A53B22]">
                      {spec.value}
                    </div>
                    <span className="text-xs text-[#57423D]">{spec.detail}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-emerald-700 shrink-0">verified_user</span>
                <span>
                  All metrics backed by enterprise Service Level Agreements (SLAs) with 99.98% high-throughput telephony uptime guarantee.
                </span>
              </div>
            </div>
          )}

          {/* TAB 4: PRODUCTION USE CASES */}
          {detailTab === 'usecases' && (
            <div className="space-y-4 animate-in fade-in">
              {currentService.useCases.map((uc, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm flex flex-col sm:flex-row items-start gap-5"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF6F3] border border-[#FFDAD2] text-[#A53B22] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">{uc.icon}</span>
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h4 className="font-['Outfit'] text-lg font-bold text-[#1D1A23]">
                      {uc.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-[#57423D] leading-relaxed">
                      <strong>Scenario:</strong> {uc.scenario}
                    </p>
                    <div className="pt-1 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                      <span>{uc.benefit}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Launch Pad CTA */}
          <div className="p-8 rounded-3xl bg-gradient-to-r from-[#1D1A23] via-[#2F293A] to-[#1D1A23] text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="font-['Outfit'] font-bold text-xl text-white">
                Ready to deploy {currentService.title.split('(')[0].trim()}?
              </h4>
              <p className="text-xs text-[#DEC0B9]">
                Test live in the playground or speak with our telephony systems engineers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  if (developer) {
                    onNavigate(currentService.actionView);
                  } else {
                    onOpenAuth(`Sign in or register to launch ${currentService.title}.`, currentService.actionView);
                  }
                }}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FFAE33] hover:from-[#FF6B47] hover:to-[#FF9E1B] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                {currentService.actionLabel} →
              </button>
              <button
                onClick={handleBackToAll}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Back to All Services
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MASTER CATALOG VIEW (ALL SERVICES GRID)
  // -------------------------------------------------------------
  return (
    <div className="w-full min-h-screen bg-[#FAF9F6] text-[#1D1A23] font-['Manrope'] pb-20">
      {/* Top Banner Navigation */}
      <div className="w-full border-b border-[#FFE6DC]/60 bg-white/70 backdrop-blur-md sticky top-16 z-30 px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => onNavigate(developer ? 'developer-dashboard' : 'landing')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#57423D] hover:text-[#A53B22] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Home</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#8B716B]">T@S Platform Overview</span>
            <span className="text-[#DEC0B9]">•</span>
            <span className="text-[11px] font-bold text-[#A53B22] font-['Outfit']">Our Services</span>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-10 sm:pt-14 space-y-12">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-[11px] font-mono font-bold text-[#A53B22] uppercase tracking-wider">
            Our Capabilities
          </span>
          <h1 className="font-['Outfit'] text-3xl sm:text-4xl font-extrabold text-[#1D1A23] tracking-tight">
            Explore T@S Platform Services
          </h1>
          <p className="text-xs sm:text-sm text-[#57423D] leading-relaxed">
            Click any service to view its dedicated architectural pipeline, live integration code, benchmarks, and enterprise use cases.
          </p>

          {/* Category Filter Pills */}
          <div className="flex items-center justify-center gap-2 pt-3">
            {[
              { id: 'all', label: 'All Services' },
              { id: 'voice', label: 'Voice & Telephony' },
              { id: 'tools', label: 'API Tools & SDKs' },
              { id: 'infra', label: 'Security & Infrastructure' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-[#1D1A23] text-white shadow-xs'
                    : 'bg-white text-[#57423D] hover:text-[#1D1A23] border border-[#FFE6DC]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid with Direct Click to Dedicated Detail View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {filteredServices.map((svc) => (
            <div
              key={svc.id}
              onClick={() => handleSelectService(svc.id)}
              className="p-6 sm:p-7 rounded-3xl bg-white border border-[#FFE6DC] shadow-sm hover:shadow-xl hover:border-[#FF7E5F] transition-all duration-300 flex flex-col justify-between space-y-5 cursor-pointer group relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF6F3] border border-[#FFDAD2] text-[#A53B22] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[26px]">{svc.icon}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FAF9F6] border border-[#FFE6DC] text-[#8B716B] font-mono text-[10px] font-semibold">
                      {svc.latency}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFF6F3] border border-[#FFDAD2] text-[#A53B22] font-mono text-[10px] font-bold">
                      {svc.badge}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-['Outfit'] font-bold text-lg text-[#1D1A23] group-hover:text-[#A53B22] transition-colors">
                    {svc.title}
                  </h3>
                  <p className="text-xs text-[#57423D] mt-1.5 leading-relaxed">
                    {svc.summary}
                  </p>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-[#FFE6DC]/60">
                  {svc.details.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-[#57423D]">
                      <span className="material-symbols-outlined text-[14px] text-[#FF7E5F] shrink-0 mt-0.5">check</span>
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons: 1. View Specs & 2. Try in Playground */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectService(svc.id);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-[#FAF9F6] group-hover:bg-[#FFF6F3] text-[#A53B22] border border-[#FFE6DC] group-hover:border-[#FFDAD2] text-xs font-bold transition-all cursor-pointer"
                >
                  <span>View Full Architecture &amp; Specs</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (developer) {
                      onNavigate(svc.actionView);
                    } else {
                      onOpenAuth(`Sign in or register to test ${svc.title}.`, svc.actionView);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-xl text-[#57423D] hover:text-[#1D1A23] text-xs font-semibold hover:underline cursor-pointer"
                >
                  <span>Quick Launch ({svc.actionLabel})</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Contact / Inquiries Box */}
        <div className="p-7 rounded-3xl bg-[#FAF9F6] border border-[#FFE6DC] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <h4 className="font-['Outfit'] font-bold text-base text-[#1D1A23]">Need a custom enterprise voice architecture?</h4>
            <p className="text-xs text-[#57423D]">
              Our engineering team helps developers connect on-premise PBXs, private subnets, and custom OpenAPI endpoints.
            </p>
          </div>
          <a
            href="mailto:ts.help2407@gmail.com?subject=T%40S%20Enterprise%20Architecture%20Inquiry"
            className="px-5 py-2.5 rounded-full bg-[#1D1A23] hover:bg-[#342D3B] text-white text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
          >
            Contact Engineering Team
          </a>
        </div>
      </div>
    </div>
  );
};
