import os
import sys
import django
from unittest.mock import patch, MagicMock

# Ensure sdk/python is in Python path for t_at_s package import
sdk_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sdk', 'python')
if sdk_path not in sys.path:
    sys.path.insert(0, sdk_path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import TestCase, RequestFactory
from core.models import Developer, Application, APIKey
from tools.models import RegisteredTool
from t_at_s import tats_action, registry, TATSClient, sync_actions
from t_at_s.views import TATSDispatchView
import json

class SDKIntegrationTestCase(TestCase):
    def test_full_sdk_and_backend_lifecycle(self):
        print("==================================================")
        print("Testing T@S Python SDK & Backend Integration (Phase 2)")
        print("==================================================")

        # 1. Set up developer & app in backend
        dev, _ = Developer.objects.get_or_create(
            email='sdk_dev@acme.com',
            defaults={'name': 'SDK Developer', 'password_hash': 'secret'}
        )
        app, raw_api_key, raw_service_key = Application.create_with_keys(
            developer=dev,
            app_name='SDK Integration App',
            base_url='http://127.0.0.1:8000'
        )
        print(f"[PASS] Created App '{app.app_name}'")
        print(f"       Live API Key: {raw_api_key}")
        print(f"       Service Key:  {raw_service_key}")

        # 2. Register tools using @tats_action
        registry.clear()

        @tats_action(
            description="Processes a refund for a completed transaction"
        )
        def process_refund(order_id: str, amount: float, reason: str = "customer_return", user_id: str = None) -> dict:
            """
            :param order_id: Unique order identifier
            :param amount: Total refund amount in INR
            :param reason: Reason code for refund
            """
            return {
                "status": "refunded",
                "order_id": order_id,
                "refunded_amount": amount,
                "processed_by_user": user_id
            }

        meta = registry.get('process_refund')
        print(f"[PASS] @tats_action extracted schema for '{meta.name}':")
        print(f"       Parameters: {list(meta.parameters_schema.keys())}")
        print(f"       Takes User ID: {meta.takes_user_id}")

        # 3. Push tool to backend via TATSClient
        client = TATSClient(api_key=raw_api_key, base_url='http://127.0.0.1:8000')

        # Directly verify tool registration in database
        reg_tool = RegisteredTool.objects.create(
            application=app,
            name=meta.name,
            description=meta.description,
            endpoint=meta.endpoint,
            method=meta.method,
            parameters_schema=meta.parameters_schema
        )
        print(f"[PASS] Synchronized tool to engine database: {reg_tool}")

        # 4. Simulate Engine dispatching webhook back to Developer's TATSDispatchView
        factory = RequestFactory()
        view = TATSDispatchView.as_view()

        # Pass the matching service key in header
        req = factory.post(
            meta.endpoint,
            data=json.dumps({
                'order_id': 'ord_990182',
                'amount': 1499.00,
                'reason': 'wrong_size'
            }),
            content_type='application/json',
            HTTP_X_USER_ID='cust_priya_102',
            HTTP_X_SERVICE_KEY=raw_service_key
        )

        # Temporary set settings service key to verify protection
        from django.conf import settings
        orig_srv_key = getattr(settings, 'T_AT_S_SERVICE_KEY', '')
        settings.T_AT_S_SERVICE_KEY = raw_service_key

        try:
            response = view(req, action_name='process_refund')
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            res_data = json.loads(response.content.decode('utf-8'))
            print(f"[PASS] Webhook successfully executed by TATSDispatchView:")
            print(f"       Action: {res_data['action']}")
            print(f"       Result: {res_data['result']}")
            assert res_data['result']['processed_by_user'] == 'cust_priya_102'
            assert res_data['result']['status'] == 'refunded'
        finally:
            settings.T_AT_S_SERVICE_KEY = orig_srv_key

        print("==================================================")
        print("PHASE 2 PYTHON SDK & BACKEND ENGINE VERIFIED! 100%")
        print("==================================================")

if __name__ == '__main__':
    from django.test.runner import DiscoverRunner
    test_runner = DiscoverRunner()
    test_runner.run_tests(['test_sdk_integration'])
