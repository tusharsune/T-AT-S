import os
import json
import logging
from typing import List, Dict, Any, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

class GroqLLMClient:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        t_settings = getattr(settings, 'T_AT_S', {})
        self.api_key = api_key or t_settings.get('GROQ_API_KEY') or os.getenv('GROQ_API_KEY', '')
        self.model = model or os.getenv('GROQ_MODEL') or t_settings.get('DEFAULT_MODEL', 'llama-3.3-70b-versatile')
        self._client = None

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

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.2
    ) -> Dict[str, Any]:
        """
        Executes a completion request against Groq LPU with optional tool schemas.
        """
        if not self.client:
            return {
                'success': False,
                'error': 'GROQ_API_KEY not configured. Set your free key in .env or developer dashboard.',
                'content': None,
                'tool_calls': None
            }

        models_to_try = list(dict.fromkeys([self.model, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile']))

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

                # Remember working model
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
                if '404' in err_msg or 'model_not_found' in err_msg:
                    logger.info(f"Model '{candidate_model}' not found on Groq, trying next candidate...")
                    continue
                logger.exception("Groq API Completion failure")
                return {
                    'success': False,
                    'error': err_msg,
                    'content': None,
                    'tool_calls': None
                }

        return {
            'success': False,
            'error': f"All candidate Groq models failed: {last_error}",
            'content': None,
            'tool_calls': None
        }

