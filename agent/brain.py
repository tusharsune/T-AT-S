import time
import logging
from typing import Dict, Any, Optional, List
from django.utils import timezone
from django.conf import settings
from core.models import Application, SessionHistory, UsageMeter, PlatformConfig
from tools.models import RegisteredTool
from tools.validator import ToolValidator
from tools.dispatcher import ToolDispatcher
from .groq_client import GroqLLMClient
from .local_client import OllamaLLMClient

logger = logging.getLogger(__name__)

class QuotaExceededError(Exception):
    """Raised when an application has exhausted its monthly units + grace buffer."""
    def __init__(self, message: str, quota_status: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.quota_status = quota_status or {}


class AgentBrain:
    def __init__(self, application: Application):
        self.application = application
        self.groq_client = GroqLLMClient()
        self.ollama_client = OllamaLLMClient()

    def process_utterance(
        self,
        client_user_id: str,
        session_id: str,
        user_message: str,
        service_key: str = "",
        passphrase: str = "",
        is_voice: bool = True
    ) -> Dict[str, Any]:
        """
        Main reasoning & action loop.
        Takes incoming user utterance, reasons with LLM, executes tools,
        updates session history, enforces accounting quotas, and returns speech + event payload.
        """
        start_time = time.time()
        latencies = {
            'asr_ms': 0, # Captured on client side
            'llm_ms': 0,
            'api_ms': 0,
            'tts_ms': 0,
            'total_ms': 0
        }

        # 0. Pre-Flight Quota & Grace Buffer Check
        current_month = timezone.now().strftime('%Y-%m')
        meter, _ = UsageMeter.objects.get_or_create(
            application=self.application,
            month_year=current_month
        )
        platform_config = PlatformConfig.get_active()
        quota_status = meter.get_quota_status(platform_config)

        if quota_status['is_exhausted']:
            raise QuotaExceededError(
                f"Monthly unit quota exhausted for application '{self.application.app_name}'. "
                f"Limit of {quota_status['grace_limit']} units reached. "
                f"Please upgrade to Starter Tier or add credits.",
                quota_status=quota_status
            )

        # Fix #18: Check end-user passphrase verification if configured
        if client_user_id:
            from core.models import EndUserConfig
            import hashlib
            user_cfg = EndUserConfig.objects.filter(
                application=self.application,
                client_user_id=client_user_id
            ).first()
            if user_cfg and user_cfg.passphrase_hash:
                input_hash = hashlib.sha256((passphrase or '').strip().encode('utf-8')).hexdigest()
                if input_hash != user_cfg.passphrase_hash:
                    return {
                        'reply_speech': "Voice passphrase verification failed. Please speak your verified security passphrase to authorize actions.",
                        'error': 'PASSPHRASE_VERIFICATION_FAILED',
                        'tool_executed': None,
                        'tool_result': None,
                        'event': {'type': 'auth_error', 'message': 'Invalid vocal passphrase'},
                        'units_deducted': 0,
                        'units_remaining': meter.get_quota_status(platform_config)['units_remaining'],
                        'grace_buffer_active': False,
                        'latencies': {'total_ms': int((time.time() - start_time) * 1000)},
                        'session_id': session_id
                    }

        # 1. Retrieve Recent Short-Term History (Fix #12: newest 10 in chronological order)
        recent_history = list(SessionHistory.objects.filter(
            application=self.application,
            session_id=session_id
        ).order_by('-created_at')[:10])
        recent_history.reverse()

        # Fix #24: Respect session timeout setting; expire context if inactive too long
        timeout_minutes = getattr(settings, 'T_AT_S', {}).get('DEFAULT_SESSION_TIMEOUT_MINUTES', 30)
        from datetime import timedelta
        if recent_history and (timezone.now() - recent_history[-1].created_at > timedelta(minutes=timeout_minutes)):
            recent_history = []

        messages: List[Dict[str, Any]] = []

        # System Prompt
        system_prompt = (
            f"You are the T@S Acoustic Action Agent for '{self.application.app_name}'.\n"
            f"Your mission is to understand user voice commands and immediately execute software actions using your registered tools.\n"
            f"Always prioritize tool calling when a user expresses intent to perform an action.\n"
            f"Keep your spoken replies natural, concise, and direct (1-2 sentences), suitable for text-to-speech voice playback."
        )
        messages.append({'role': 'system', 'content': system_prompt})

        # Append recent history
        for item in recent_history:
            messages.append({'role': item.role, 'content': item.content})

        # Append current user prompt
        messages.append({'role': 'user', 'content': user_message})

        # 2. Fetch Active Tools for Application
        db_tools = RegisteredTool.objects.filter(application=self.application, is_active=True)
        function_schemas = [t.to_function_schema() for t in db_tools]
        tool_lookup = {t.name: t for t in db_tools}

        # 3. LLM Reasoning Pass (Groq -> Fallback Ollama)
        llm_start = time.time()
        llm_res = self.groq_client.chat_completion(messages=messages, tools=function_schemas)

        if not llm_res.get('success'):
            # Fix #22: Fallback to local Ollama if Groq fails or is unconfigured
            logger.warning(f"Groq primary completion failed ({llm_res.get('error')}). Falling back to local Ollama.")
            llm_res = self.ollama_client.chat_completion(messages=messages, tools=function_schemas)

        latencies['llm_ms'] = int((time.time() - llm_start) * 1000)

        tool_executed_name = None
        tool_dispatch_result = None
        client_event = None
        spoken_reply = ""

        # 4. Handle Tool Calling If Detected (Fix #23: support multi-step tool calls)
        tool_calls = llm_res.get('tool_calls')
        executed_tools = []
        last_dispatch_res = None
        last_event = None
        api_latencies = []

        if tool_calls and len(tool_calls) > 0:
            for call in tool_calls:
                call_name = call.get('name')
                raw_args = call.get('arguments', {})

                if call_name in tool_lookup:
                    matched_tool = tool_lookup[call_name]
                    tool_executed_name = call_name

                    # Validate parameters
                    is_valid, cleaned_args, val_error = ToolValidator.validate_and_clean(
                        tool_schema={'parameters_schema': matched_tool.parameters_schema},
                        arguments=raw_args
                    )

                    if is_valid:
                        # Dispatch HTTP call to developer application
                        dispatch_res = ToolDispatcher.dispatch(
                            tool=matched_tool,
                            arguments=cleaned_args,
                            client_user_id=client_user_id,
                            service_key=service_key
                        )
                        last_dispatch_res = dispatch_res
                        api_latencies.append(dispatch_res.get('latency_ms', 0))

                        if dispatch_res.get('success'):
                            executed_tools.append(matched_tool.name)
                            last_event = {
                                'type': f"{matched_tool.name}_completed",
                                'data': dispatch_res.get('data', {}),
                                'tool': matched_tool.name
                            }
                        else:
                            spoken_reply = (
                                f"I tried to execute {matched_tool.name.replace('_', ' ')}, "
                                f"but your app is taking too long to respond. Please try again."
                            )
                            break
                    else:
                        spoken_reply = f"I couldn't execute that action: {val_error}"
                        break
                else:
                    spoken_reply = f"Action '{call_name}' is not recognized for this application."
                    break

            if executed_tools and not spoken_reply:
                if len(executed_tools) == 1:
                    spoken_reply = f"Done! Successfully executed {executed_tools[0].replace('_', ' ')}."
                else:
                    names_str = ", ".join(t.replace('_', ' ') for t in executed_tools)
                    spoken_reply = f"Done! Successfully executed: {names_str}."

            latencies['api_ms'] = sum(api_latencies)
            tool_dispatch_result = last_dispatch_res
            client_event = last_event
            if executed_tools:
                tool_executed_name = executed_tools[-1]
        else:
            # Standard conversational reply (no tool needed)
            spoken_reply = llm_res.get('content') or (
                "I heard your request. What would you like me to do next?"
            )

        # 5. Persist to Session History
        SessionHistory.objects.create(
            application=self.application,
            session_id=session_id,
            client_user_id=client_user_id,
            role='user',
            content=user_message
        )
        SessionHistory.objects.create(
            application=self.application,
            session_id=session_id,
            client_user_id=client_user_id,
            role='assistant',
            content=spoken_reply,
            tool_name=tool_executed_name,
            tool_payload=tool_dispatch_result
        )

        # Auto-prune old sessions beyond retention limit (keep newest 300)
        SessionHistory.prune_old_sessions(application=self.application)

        # 6. Increment Usage Meter with Dynamic Accounting
        units_consumed = meter.record_usage(
            is_voice=is_voice,
            tool_executed=(tool_executed_name is not None),
            text_multiplier=float(platform_config.text_multiplier),
            voice_multiplier=float(platform_config.voice_multiplier),
            tool_multiplier=float(platform_config.tool_multiplier),
        )

        fresh_quota = meter.get_quota_status(platform_config)
        latencies['total_ms'] = int((time.time() - start_time) * 1000)

        return {
            'reply_speech': spoken_reply,
            'tool_executed': tool_executed_name,
            'tool_result': tool_dispatch_result,
            'event': client_event,
            'units_deducted': units_consumed,
            'units_remaining': fresh_quota['units_remaining'],
            'grace_buffer_active': fresh_quota['grace_buffer_active'],
            'latencies': latencies,
            'session_id': session_id
        }


