import time
import requests
from typing import Dict, Any, Tuple
from django.conf import settings
from .models import RegisteredTool

class ToolDispatcher:
    """
    Executes HTTP requests against the developer's application backend.
    Enforces Option B: Silent 1-time retry (1.5s timeout) if initial 4.0s call blips.
    """
    @staticmethod
    def dispatch(
        tool: RegisteredTool,
        arguments: dict,
        client_user_id: str,
        service_key: str = ""
    ) -> Dict[str, Any]:
        base_url = tool.application.base_url.rstrip('/')
        endpoint = tool.endpoint.lstrip('/')
        full_url = f"{base_url}/{endpoint}" if not tool.endpoint.startswith(('http://', 'https://')) else tool.endpoint

        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-User-Id': str(client_user_id),
            'X-Service-Key': str(service_key),
            'Authorization': f'Bearer {service_key}',
            'User-Agent': 'T@S-Acoustic-Engine/1.0',
        }

        method = tool.method.upper()
        primary_timeout = getattr(settings, 'T_AT_S', {}).get('DISPATCH_TIMEOUT_SECONDS', 4.0)
        retry_timeout = getattr(settings, 'T_AT_S', {}).get('SILENT_RETRY_TIMEOUT_SECONDS', 1.5)

        start_time = time.time()
        attempt = 1
        last_error = ""
        response_data = None
        status_code = 500

        for timeout in [primary_timeout, retry_timeout]:
            try:
                if method == 'POST':
                    res = requests.post(full_url, json=arguments, headers=headers, timeout=timeout)
                elif method == 'GET':
                    res = requests.get(full_url, params=arguments, headers=headers, timeout=timeout)
                elif method == 'PUT':
                    res = requests.put(full_url, json=arguments, headers=headers, timeout=timeout)
                elif method == 'PATCH':
                    res = requests.patch(full_url, json=arguments, headers=headers, timeout=timeout)
                elif method == 'DELETE':
                    res = requests.delete(full_url, json=arguments, headers=headers, timeout=timeout)
                else:
                    res = requests.post(full_url, json=arguments, headers=headers, timeout=timeout)


                status_code = res.status_code
                latency_ms = int((time.time() - start_time) * 1000)

                try:
                    response_data = res.json()
                except Exception:
                    response_data = {"raw_text": res.text[:250]}

                if 200 <= status_code < 300:
                    return {
                        'success': True,
                        'status_code': status_code,
                        'data': response_data,
                        'latency_ms': latency_ms,
                        'attempt': attempt,
                        'url': full_url,
                        'error': None
                    }
                else:
                    last_error = f"HTTP {status_code}: {res.text[:150]}"

            except requests.exceptions.Timeout:
                last_error = f"Request timed out after {timeout}s"
            except requests.exceptions.RequestException as e:
                last_error = f"Network exception: {str(e)}"

            attempt += 1
            # Brief jitter before the silent retry
            time.sleep(0.1)

        latency_ms = int((time.time() - start_time) * 1000)
        return {
            'success': False,
            'status_code': status_code,
            'data': response_data,
            'latency_ms': latency_ms,
            'attempt': attempt - 1,
            'url': full_url,
            'error': last_error
        }

