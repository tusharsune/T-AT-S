import unittest
import os
import sys
from unittest.mock import patch, MagicMock
from enum import Enum
from datetime import datetime
import json

# Ensure parent directory (sdk/python) is in sys.path
sdk_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if sdk_dir not in sys.path:
    sys.path.insert(0, sdk_dir)

from django.test import RequestFactory
from django.conf import settings


# Configure minimal Django settings if not already configured
if not settings.configured:
    settings.configure(
        DEBUG=True,
        SECRET_KEY='test-secret-key',
        ROOT_URLCONF=[],
        T_AT_S_SERVICE_KEY='tas_srv_secret_123',
    )

from t_at_s.registry import registry, ActionRegistry
from t_at_s.decorators import tats_action
from t_at_s.views import TATSDispatchView
from t_at_s.client import TATSClient
from t_at_s.middleware import TATSMiddleware

class PriorityEnum(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TATSClientSDKTestCase(unittest.TestCase):
    def setUp(self):
        registry.clear()
        self.factory = RequestFactory()

    def test_schema_auto_extraction(self):
        @tats_action(description="Books a flight ticket")
        def book_flight(
            destination: str,
            priority: PriorityEnum = PriorityEnum.MEDIUM,
            passenger_count: int = 1,
            is_round_trip: bool = False,
            departure: datetime = None,
            user_id: str = None
        ) -> dict:
            """
            :param destination: The destination airport city
            :param passenger_count: Number of travelers
            """
            return {"booked": True, "to": destination, "by_user": user_id}

        meta = registry.get("book_flight")
        self.assertIsNotNone(meta)
        self.assertEqual(meta.name, "book_flight")
        self.assertEqual(meta.description, "Books a flight ticket")
        self.assertTrue(meta.takes_user_id)

        schema = meta.parameters_schema

        # destination should be required string
        self.assertEqual(schema['destination']['type'], 'string')
        self.assertTrue(schema['destination']['required'])
        self.assertIn("destination", schema['destination']['guide'].lower())

        # priority should be enum with choices
        self.assertEqual(schema['priority']['type'], 'enum')
        self.assertFalse(schema['priority']['required'])
        self.assertEqual(schema['priority']['enumValues'], ['low', 'medium', 'high'])

        # passenger_count should be number
        self.assertEqual(schema['passenger_count']['type'], 'number')
        self.assertFalse(schema['passenger_count']['required'])
        self.assertEqual(schema['passenger_count']['guide'], 'Number of travelers')

        # is_round_trip should be boolean
        self.assertEqual(schema['is_round_trip']['type'], 'boolean')

        # user_id should NOT be in the LLM parameters_schema
        self.assertNotIn('user_id', schema)

    def test_webhook_dispatch_named_action(self):
        @tats_action
        def create_note(title: str, content: str, user_id: str = None) -> dict:
            return {'status': 'saved', 'title': title, 'author': user_id}

        view = TATSDispatchView.as_view()

        payload = {'title': 'Meeting Agenda', 'content': 'Discuss Q4 roadmap'}
        request = self.factory.post(
            '/api/tats/actions/create_note/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_USER_ID='usr_9981',
            HTTP_X_SERVICE_KEY='tas_srv_secret_123'
        )

        response = view(request, action_name='create_note')
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.content.decode('utf-8'))
        self.assertTrue(data['success'])
        self.assertEqual(data['action'], 'create_note')
        self.assertEqual(data['result']['author'], 'usr_9981')
        self.assertEqual(data['result']['title'], 'Meeting Agenda')

    def test_webhook_dispatch_universal(self):
        @tats_action
        def toggle_light(room: str, power_on: bool) -> dict:
            return {'room': room, 'state': 'on' if power_on else 'off'}

        view = TATSDispatchView.as_view()

        universal_payload = {
            'action': 'toggle_light',
            'arguments': {'room': 'Living Room', 'power_on': True}
        }
        request = self.factory.post(
            '/api/tats/dispatch/',
            data=json.dumps(universal_payload),
            content_type='application/json',
            HTTP_X_SERVICE_KEY='tas_srv_secret_123'
        )

        response = view(request)
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.content.decode('utf-8'))
        self.assertTrue(data['success'])
        self.assertEqual(data['result']['state'], 'on')

    def test_service_key_unauthorized_rejection(self):
        @tats_action
        def private_action() -> dict:
            return {'secret': 42}

        view = TATSDispatchView.as_view()

        # Call with bad service key
        request = self.factory.post(
            '/api/tats/actions/private_action/',
            data='{}',
            content_type='application/json',
            HTTP_X_SERVICE_KEY='wrong_key'
        )

        response = view(request, action_name='private_action')
        self.assertEqual(response.status_code, 403)

    def test_unknown_action_returns_404(self):
        view = TATSDispatchView.as_view()

        request = self.factory.post(
            '/api/tats/actions/non_existent/',
            data='{}',
            content_type='application/json',
            HTTP_X_SERVICE_KEY='tas_srv_secret_123'
        )

        response = view(request, action_name='non_existent')
        self.assertEqual(response.status_code, 404)

    def test_middleware_injection(self):
        middleware = TATSMiddleware(lambda req: req)

        request = self.factory.get(
            '/any/path/',
            HTTP_X_USER_ID='usr_test_55',
            HTTP_X_SERVICE_KEY='tas_srv_secret_123'
        )

        req = middleware(request)
        self.assertEqual(req.tats_user_id, 'usr_test_55')
        self.assertEqual(req.tats_service_key, 'tas_srv_secret_123')
        self.assertTrue(req.is_tats_dispatch)

    @patch('requests.post')
    def test_client_chat_execution(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'speech_response': 'Turned off the kitchen lights.',
            'events': [{'type': 'toggle_light_completed'}],
            'units': {'consumed': 2, 'remaining': 1998}
        }
        mock_post.return_value = mock_response

        client = TATSClient(api_key='tas_live_12345', base_url='http://mock-engine.local')
        chat_res = client.chat(
            client_user_id='usr_77',
            session_id='sess_88',
            message='Turn off kitchen light'
        )

        self.assertEqual(chat_res['speech_response'], 'Turned off the kitchen lights.')
        self.assertEqual(chat_res['units']['consumed'], 2)
        mock_post.assert_called_once()

    @patch('requests.post')
    def test_client_sync_registry(self, mock_post):
        @tats_action
        def sample_tool(param: str) -> dict:
            return {'res': param}

        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {'status': 'created'}
        mock_post.return_value = mock_response

        client = TATSClient(api_key='tas_live_12345', base_url='http://mock-engine.local')
        sync_result = client.sync_registry(host_base_url='https://api.mycrm.com')

        self.assertEqual(sync_result['total_actions'], 1)
        self.assertEqual(sync_result['synced_count'], 1)
        self.assertIn('sample_tool', sync_result['synced'])


if __name__ == '__main__':
    unittest.main()

