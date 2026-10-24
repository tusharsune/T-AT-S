from django.test import TestCase
from rest_framework.test import APIClient
from django.utils import timezone
from core.models import Developer, Application, APIKey, UsageMeter, PlatformConfig, DeveloperToken
from tools.models import RegisteredTool
from agent.brain import AgentBrain, QuotaExceededError
from unittest.mock import patch

class Phase4MeteringTestCase(TestCase):
    def setUp(self):
        self.dev = Developer.objects.create(
            name="Metering Tester",
            email="metering@example.com"
        )
        self.dev.set_password("SecurePass123!")
        self.dev.save()
        self.dev_token = DeveloperToken.generate(self.dev).key

        self.app, self.raw_api_key, self.raw_srv_key = Application.create_with_keys(
            developer=self.dev,
            app_name="Metering Test App",
            base_url="http://127.0.0.1:8000"
        )

        self.config = PlatformConfig.get_active()
        self.config.free_tier_units = 2000
        self.config.grace_buffer_pct = 10  # 10% = 2200 limit
        self.config.text_multiplier = 1.0
        self.config.voice_multiplier = 2.0
        self.config.tool_multiplier = 3.0
        self.config.save()

        self.client = APIClient()

    def test_dynamic_multipliers_and_breakdown_tracking(self):
        """Tests that text, voice, and tool execution deduct correctly and record telemetry."""
        brain = AgentBrain(application=self.app)

        # 1. Voice chat without tool -> 2 units
        with patch.object(brain.groq_client, 'chat_completion', return_value={'success': True, 'content': 'Hello!', 'tool_calls': []}):
            res1 = brain.process_utterance(
                client_user_id="usr_01",
                session_id="sess_01",
                user_message="Hello there",
                is_voice=True
            )
            self.assertEqual(res1['units_deducted'], 2)
            self.assertFalse(res1['grace_buffer_active'])

        # 2. Text chat without tool -> 1 unit
        with patch.object(brain.groq_client, 'chat_completion', return_value={'success': True, 'content': 'Hi!', 'tool_calls': []}):
            res2 = brain.process_utterance(
                client_user_id="usr_01",
                session_id="sess_01",
                user_message="Text query",
                is_voice=False
            )
            self.assertEqual(res2['units_deducted'], 1)

        # Check telemetry in database
        month = timezone.now().strftime('%Y-%m')
        meter = UsageMeter.objects.get(application=self.app, month_year=month)
        self.assertEqual(meter.units_consumed, 3)
        self.assertEqual(meter.voice_units_consumed, 2)
        self.assertEqual(meter.text_units_consumed, 1)
        self.assertEqual(meter.requests_count, 2)
        self.assertEqual(meter.tools_executed_count, 0)

    def test_grace_buffer_and_hard_quota_block(self):
        """Tests that reaching base quota activates grace buffer, and exceeding 10% blocks with 429."""
        month = timezone.now().strftime('%Y-%m')
        meter, _ = UsageMeter.objects.get_or_create(application=self.app, month_year=month)

        # Fast forward meter to 2,050 units (inside 10% grace buffer: 2000 - 2200)
        meter.units_consumed = 2050
        meter.save()

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.raw_api_key}')

        with patch('agent.groq_client.GroqLLMClient.chat_completion', return_value={'success': True, 'content': 'In grace zone', 'tool_calls': []}):
            chat_res = self.client.post('/api/v1/chat/', {
                'client_user_id': 'usr_02',
                'session_id': 'sess_02',
                'message': 'Testing grace buffer',
                'is_voice': True
            }, format='json')

            # Should succeed with 200 and return Grace Buffer active
            self.assertEqual(chat_res.status_code, 200)
            self.assertTrue(chat_res.data['grace_buffer_active'])
            self.assertEqual(chat_res.headers.get('X-TATS-Grace-Buffer'), 'active')

        # Fast forward meter to 2,201 units (Exceeds 2,000 + 10% = 2,200)
        meter.units_consumed = 2201
        meter.save()

        # Next request must be hard blocked with 429
        blocked_res = self.client.post('/api/v1/chat/', {
            'client_user_id': 'usr_02',
            'session_id': 'sess_02',
            'message': 'Attempting blocked query',
            'is_voice': True
        }, format='json')

        self.assertEqual(blocked_res.status_code, 429)
        self.assertEqual(blocked_res.data['error'], 'QUOTA_EXHAUSTED')
        self.assertTrue(blocked_res.data['quota_status']['is_exhausted'])

    def test_bonus_units_and_upgrade_endpoints(self):
        """Tests crediting bonus units and upgrading plan tier."""
        month = timezone.now().strftime('%Y-%m')
        meter, _ = UsageMeter.objects.get_or_create(application=self.app, month_year=month)
        meter.units_consumed = 2205
        meter.save()

        dev_client = APIClient()
        dev_client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.dev_token}')

        # 1. Check Usage Endpoint before bonus
        usage_res = dev_client.get(f'/api/v1/apps/{self.app.id}/usage/')
        self.assertEqual(usage_res.status_code, 200)
        self.assertTrue(usage_res.data['quota']['is_exhausted'])

        # 2. Verify non-admin gets 403 (Fix #4 security requirement)
        bonus_denied = dev_client.post(f'/api/v1/apps/{self.app.id}/add-bonus/', {
            'units': 500,
            'reason': 'Attempted self-credit'
        }, format='json')
        self.assertEqual(bonus_denied.status_code, 403)

        # Elevate to admin to credit bonus units
        self.dev.is_admin = True
        self.dev.save()

        # Add 500 Bonus Units as Admin
        bonus_res = dev_client.post(f'/api/v1/apps/{self.app.id}/add-bonus/', {
            'units': 500,
            'reason': 'Customer Loyalty Credit'
        }, format='json')
        self.assertEqual(bonus_res.status_code, 200)
        self.assertFalse(bonus_res.data['quota']['is_exhausted'])
        self.assertEqual(bonus_res.data['quota']['bonus_units'], 500)

        # 3. Upgrade Application Plan Tier as Admin
        upgrade_res = dev_client.post(f'/api/v1/apps/{self.app.id}/upgrade/', {
            'plan': 'GROWTH'
        }, format='json')
        self.assertEqual(upgrade_res.status_code, 200)
        self.assertEqual(upgrade_res.data['plan_tier'], 'GROWTH')
        self.assertEqual(upgrade_res.data['quota']['base_quota'], 50500)


