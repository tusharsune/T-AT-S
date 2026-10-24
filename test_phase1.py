import os
import django
from unittest.mock import patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import TestCase
from core.models import Developer, Application, APIKey, PlatformConfig, DeveloperToken
from tools.models import RegisteredTool
from rest_framework.test import APIClient

class Phase1EngineTestCase(TestCase):
    def test_phase1_engine(self):
        print("==================================================")
        print("Testing T@S Backend Core Foundation (Phase 1)")
        print("==================================================")

        client = APIClient()

        # 1. Test Health Endpoint
        health_res = client.get('/api/v1/health/')
        self.assertEqual(health_res.status_code, 200, f"Health check failed: {health_res.data}")
        print(f"[PASS] Health Probe: {health_res.data}")

        # 2. Setup Test Developer & Application
        dev, _ = Developer.objects.get_or_create(
            email='dev@acme.com',
            defaults={'name': 'Acme Engineering', 'password_hash': 'demo_hashed_secret', 'is_admin': True}
        )
        dev.is_admin = True
        dev.save()
        admin_dev_token = DeveloperToken.generate(dev).key

        raw_service_key = 'tas_sec_demo_982481029410'
        app, _ = Application.objects.get_or_create(
            developer=dev,
            app_name='Acme Task App',
            defaults={
                'base_url': 'https://api.acme.app',
                'service_key_hash': Application.hash_key(raw_service_key),
                'wake_word_policy': 'CUSTOM'
            }
        )

        # 3. Generate Live API Key
        api_key_obj, raw_api_key = APIKey.generate_for_app(app)
        print(f"[PASS] Generated API Key: {raw_api_key}")

        # 4. Test Tool Registration via REST API
        tool_payload = {
            'name': 'create_task',
            'description': 'Creates a project task or reminder in Acme Workspace when user asks to track a todo.',
            'endpoint': '/api/v1/tasks/create/',
            'method': 'POST',
            'parameters_schema': {
                'title': {'type': 'string', 'required': True, 'guide': 'The task title or description'},
                'priority': {'type': 'enum', 'enumValues': ['low', 'medium', 'high'], 'required': False, 'guide': 'Priority level'},
                'due_date': {'type': 'string', 'required': False, 'guide': 'Due date and time'}
            }
        }
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_api_key}')
        tool_res = client.post('/api/v1/tools/register/', data=tool_payload, format='json')
        self.assertEqual(tool_res.status_code, 201, f"Tool registration failed: {tool_res.data}")
        print(f"[PASS] Tool Registered: '{tool_res.data['tool']['name']}'")

        # 5. Test Tools List Endpoint
        tools_list_res = client.get('/api/v1/tools/')
        self.assertEqual(tools_list_res.status_code, 200)
        print(f"[PASS] Tools List verified. Total active tools: {tools_list_res.data['count']}")

        # 6. Test Super Admin Dynamic Config (Must require Admin Dev Token)
        # Using API key should be rejected with 403
        denied_res = client.get('/api/v1/admin/config/')
        self.assertEqual(denied_res.status_code, 403)

        # Using Admin Dev Token should succeed
        admin_client = APIClient()
        admin_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_dev_token}')
        admin_res = admin_client.get('/api/v1/admin/config/')
        self.assertEqual(admin_res.status_code, 200)
        print(f"[PASS] Super Admin Config Loaded: Free Tier Units = {admin_res.data['free_tier_units']}, Starter Price = INR {admin_res.data['starter_price_inr']}")

        # 7. Test Chat Action Endpoint
        chat_payload = {
            'client_user_id': 'user_rahul_101',
            'session_id': 'sess_test_7781',
            'message': 'Hello T@S, what can you do for me?',
            'is_voice': True
        }
        with patch('agent.groq_client.GroqLLMClient.chat_completion', return_value={'success': True, 'content': 'I am ready to help you execute actions.', 'tool_calls': []}):
            chat_res = client.post('/api/v1/chat/', data=chat_payload, format='json')
            self.assertEqual(chat_res.status_code, 200, f"Chat call failed: {chat_res.data}")
            print(f"[PASS] Chat Execution Successful: {chat_res.data['reply_speech']}")

        print("\n==================================================")
        print("ALL PHASE 1 BACKEND FOUNDATION TESTS PASSED! 100%")
        print("==================================================")

if __name__ == '__main__':
    from django.test.runner import DiscoverRunner
    test_runner = DiscoverRunner()
    test_runner.run_tests(['test_phase1'])
