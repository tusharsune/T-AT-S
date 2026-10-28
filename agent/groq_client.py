import os
import json
import logging
from typing import List, Dict, Any, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

# Active Groq models that support chat completions and tool-calling
ACTIVE_CANDIDATE_MODELS = [
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
]

class GroqLLMClient:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        t_settings = getattr(settings, 'T_AT_S', {})
        self.api_key = api_key or t_settings.get('GROQ_API_KEY') or os.getenv('GROQ_API_KEY', '')
        self.model = model or os.getenv('GROQ_MODEL') or t_settings.get('DEFAULT_MODEL', 'qwen/qwen3.8-27b')
        self._client = None
        self._verified_model = None

    @property
    def client(self):
        if not self._client:
            if not self.api_key:
                return None
            try:
                from groq import Groq
                self._client = Groq(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}")
                return None
        return self._client

    def _get_models_to_try(self) -> List[str]:
        """
        Builds an ordered list of candidate models, prioritizing verified models,
        followed by configured model and active supported candidates.
        """
        models = []
        if self._verified_model:
            models.append(self._verified_model)
        if self.model and self.model not in models:
            models.append(self.model)

        for candidate in ACTIVE_CANDIDATE_MODELS:
            if candidate not in models:
                models.append(candidate)

        return models

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.2
    ) -> Dict[str, Any]:
        """
        Executes a completion request against Groq with automatic model fallback
        and tool calling support.
        """
        if not self.client:
            return {
                'success': False,
                'error': 'GROQ_API_KEY not configured. Set your free key in .env or developer dashboard.',
                'content': None,
                'tool_calls': None
            }

        models_to_try = self._get_models_to_try()
        last_error = "Unknown error"

        for candidate_model in models_to_try:
            kwargs: Dict[str, Any] = {
                'model': candidate_model,
                'messages': messages,
                'temperature': temperature,
                'max_tokens': 1024,
            }

            if tools and len(tools) > 0:
                kwargs['tools'] = tools
                kwargs['tool_choice'] = 'auto'

            try:
                response = self.client.chat.completions.create(**kwargs)
                choice = response.choices[0]
                message = choice.message

                tool_calls_payload = []
                if message.tool_calls:
                    for tc in message.tool_calls:
                        try:
                            args = json.loads(tc.function.arguments)
                        except Exception:
                            args = {'raw': tc.function.arguments}
                        tool_calls_payload.append({
                            'id': tc.id,
                            'name': tc.function.name,
                            'arguments': args
                        })

                # Cache working model to avoid fallback overhead on subsequent calls
                self._verified_model = candidate_model
                self.model = candidate_model

                return {
                    'success': True,
                    'content': message.content,
                    'tool_calls': tool_calls_payload if tool_calls_payload else None,
                    'model_used': candidate_model,
                    'usage': {
                        'prompt_tokens': getattr(response.usage, 'prompt_tokens', 0),
                        'completion_tokens': getattr(response.usage, 'completion_tokens', 0),
                        'total_tokens': getattr(response.usage, 'total_tokens', 0)
                    }
                }
            except Exception as e:
                err_msg = str(e)
                last_error = err_msg
                err_lower = err_msg.lower()

                # Catch 400 (decommissioned/unsupported), 404 (not found), or access denied
                is_model_unavailable = any(kw in err_lower for kw in [
                    '404', '400', 'decommissioned', 'model_decommissioned',
                    'not_found', 'model_not_found', 'does not exist',
                    'not have access', 'deprecated', 'invalid_model'
                ])

                if is_model_unavailable:
                    logger.warning(
                        f"Groq candidate model '{candidate_model}' unavailable on cluster ({err_msg[:80]}...). "
                        f"Attempting fallback to next model in pipeline..."
                    )
                    continue

                logger.exception(f"Groq API Completion failure on model '{candidate_model}': {err_msg}")
                return {
                    'success': False,
                    'error': err_msg,
                    'content': None,
                    'tool_calls': None
                }

        logger.error(f"All Groq candidate models failed: {last_error}")
        return {
            'success': False,
            'error': f"All candidate Groq models failed: {last_error}",
            'content': None,
            'tool_calls': None
        }
