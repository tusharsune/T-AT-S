import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from core.auth import APIKeyAuthentication, DeveloperTokenAuthentication
from agent.brain import AgentBrain, QuotaExceededError
from api.serializers import ChatRequestSerializer

class ChatExecutionView(APIView):
    """
    Primary runtime endpoint for voice & text action execution.
    Accepts speech transcript / text message, calls LLM, triggers tools,
    enforces accounting quotas, and returns speech audio response + UI update events.
    Supports Application API Key (tas_live_...) or Developer Session Token (tas_dev_...).
    """
    authentication_classes = [APIKeyAuthentication, DeveloperTokenAuthentication]

    def _resolve_application(self, request, data=None):
        if hasattr(request, 'application') and request.application:
            return request.application

        if hasattr(request, 'developer') and request.developer:
            app_id = None
            if data and isinstance(data, dict):
                app_id = data.get('app_id')
            if not app_id and hasattr(request, 'data') and isinstance(request.data, dict):
                app_id = request.data.get('app_id')
            if not app_id and hasattr(request, 'query_params'):
                app_id = request.query_params.get('app_id')

            if app_id and str(app_id).strip() not in ['undefined', 'null', 'None', '']:
                try:
                    uuid.UUID(str(app_id).strip())
                    app = request.developer.applications.filter(id=app_id, is_active=True).first()
                    if app:
                        return app
                except (ValueError, AttributeError, TypeError):
                    pass

            app = request.developer.applications.filter(is_active=True).first()
            return app

        return None

    @extend_schema(
        tags=['Acoustic Action Engine'],
        summary='Execute Voice / Text Command',
        description=(
            'Processes human utterance through the Agent Brain. Orchestrates Llama 3.3 reasoning, '
            'auto-detects tool intents, dispatches authenticated HTTP actions to developer endpoints, '
            'enforces monthly unit quotas (with 10% grace buffer), and returns synthesized spoken response.'
        ),
        request=ChatRequestSerializer,
        parameters=[
            OpenApiParameter(
                name='Authorization',
                type=str,
                location=OpenApiParameter.HEADER,
                description='Bearer API Key: Bearer tas_live_... or Bearer tas_dev_...',
                required=True
            ),
            OpenApiParameter(
                name='X-Service-Key',
                type=str,
                location=OpenApiParameter.HEADER,
                description='Developer secret service key passed for high-privilege backend-to-backend operations.',
                required=False
            ),
        ],
        examples=[
            OpenApiExample(
                'Task Creation Example',
                value={
                    'client_user_id': 'user_102',
                    'session_id': 'sess_acme_8812',
                    'message': 'Create a high priority task to review Q3 budget by 5 PM',
                    'passphrase': 'blue_phoenix_alpha',
                    'is_voice': True
                },
                request_only=True
            )
        ],
        responses={
            200: dict,
            429: dict
        }
    )
    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        application = self._resolve_application(request, data)
        if not application:
            return Response({
                'error': 'UNAUTHORIZED',
                'message': 'No valid application cluster found. Provide a valid Bearer tas_live_... API key or developer session token.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        brain = AgentBrain(application=application)
        try:
            result = brain.process_utterance(
                client_user_id=data['client_user_id'],
                session_id=data['session_id'],
                user_message=data['message'],
                service_key=request.headers.get('X-Service-Key', ''),
                passphrase=data.get('passphrase', ''),
                is_voice=data.get('is_voice', True)
            )
        except QuotaExceededError as qe:
            return Response({
                'error': 'QUOTA_EXHAUSTED',
                'message': str(qe),
                'quota_status': qe.quota_status,
                'upgrade_url': f'/api/v1/apps/{application.id}/upgrade/'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except Exception as ex:
            return Response({
                'error': 'EXECUTION_ERROR',
                'message': str(ex)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if result.get('error') == 'PASSPHRASE_VERIFICATION_FAILED':
            return Response(result, status=status.HTTP_403_FORBIDDEN)

        response = Response(result, status=status.HTTP_200_OK)
        if result.get('grace_buffer_active'):
            response['X-TATS-Grace-Buffer'] = 'active'
        return response
