import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from core.models import Application, APIKey
from core.auth import DeveloperTokenAuthentication, IsDeveloperAuthenticated
from api.serializers import (
    ApplicationDetailSerializer,
    ApplicationCreateSerializer,
    ApplicationCreatedResponseSerializer
)

class ApplicationListCreateView(APIView):
    """
    Manages tenant applications belonging to the authenticated developer.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Application Management'],
        summary='List Developer Applications',
        description='Returns all applications configured under this developer account with their usage statistics.',
        parameters=[
            OpenApiParameter(
                name='Authorization',
                type=str,
                location=OpenApiParameter.HEADER,
                description='Bearer Developer Token: Bearer tas_dev_...',
                required=True
            )
        ],
        responses={200: ApplicationDetailSerializer(many=True)}
    )
    def get(self, request):
        apps = Application.objects.filter(developer=request.developer)
        serializer = ApplicationDetailSerializer(apps, many=True)
        return Response({
            'count': len(serializer.data),
            'applications': serializer.data
        }, status=status.HTTP_200_OK)

    @extend_schema(
        tags=['Application Management'],
        summary='Create Application & Generate API Keys',
        description='Creates a new application cluster, automatically generating a live API Key (tas_live_...) and Service Verification Key (tas_srv_...). Save these keys immediately.',
        parameters=[
            OpenApiParameter(
                name='Authorization',
                type=str,
                location=OpenApiParameter.HEADER,
                description='Bearer Developer Token: Bearer tas_dev_...',
                required=True
            )
        ],
        request=ApplicationCreateSerializer,
        examples=[
            OpenApiExample(
                'Create Application Example',
                value={
                    'app_name': 'ShopFlow E-Commerce',
                    'base_url': 'https://api.shopflow.example.com',
                    'wake_word_policy': 'CUSTOM'
                },
                request_only=True
            )
        ],
        responses={201: ApplicationCreatedResponseSerializer}
    )
    def post(self, request):
        serializer = ApplicationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        app, raw_api_key, raw_service_key = Application.create_with_keys(
            developer=request.developer,
            app_name=data['app_name'],
            base_url=data['base_url'],
            wake_word_policy=data.get('wake_word_policy', 'CUSTOM')
        )

        return Response({
            'message': f"Application '{app.app_name}' created successfully.",
            'application': {
                'id': str(app.id),
                'app_name': app.app_name,
                'base_url': app.base_url,
                'wake_word_policy': app.wake_word_policy,
                'api_key': raw_api_key,
                'service_key': raw_service_key,
                'created_at': app.created_at
            },
            'credentials': {
                'api_key': raw_api_key,
                'service_key': raw_service_key
            },
            'instructions': 'Use Bearer ' + raw_api_key + ' to authorize chat and tool endpoints. Use service_key in your backend middleware.'
        }, status=status.HTTP_201_CREATED)


class ApplicationDetailView(APIView):
    """
    Retrieves or deletes a single application cluster.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Application Management'],
        summary='Get Application Details',
        description='Fetches details and metrics for a specific application.',
        parameters=[
            OpenApiParameter(
                name='Authorization',
                type=str,
                location=OpenApiParameter.HEADER,
                description='Bearer Developer Token: Bearer tas_dev_...',
                required=True
            )
        ],
        responses={200: ApplicationDetailSerializer}
    )
    def get(self, request, app_id):
        try:
            app = Application.objects.get(id=app_id, developer=request.developer)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ApplicationDetailSerializer(app)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=['Application Management'],
        summary='Update Application Settings',
        description='Updates application name, base URL, or wake word policy.'
    )
    def patch(self, request, app_id):
        try:
            app = Application.objects.get(id=app_id, developer=request.developer)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        app_name = request.data.get('app_name')
        if app_name and app_name.strip():
            app.app_name = app_name.strip()

        base_url = request.data.get('base_url')
        if base_url and base_url.strip():
            app.base_url = base_url.strip()

        wake_word_policy = request.data.get('wake_word_policy')
        if wake_word_policy in ['CUSTOM', 'LOCKED']:
            app.wake_word_policy = wake_word_policy

        if 'is_active' in request.data:
            app.is_active = bool(request.data.get('is_active'))

        app.save()
        serializer = ApplicationDetailSerializer(app)
        return Response({
            'message': f"Application '{app.app_name}' settings updated successfully.",
            'application': serializer.data
        }, status=status.HTTP_200_OK)


    @extend_schema(
        tags=['Application Management'],
        summary='Delete / Deactivate Application',
        description='Deactivates an application and all its tools and active keys.',
        parameters=[
            OpenApiParameter(
                name='Authorization',
                type=str,
                location=OpenApiParameter.HEADER,
                description='Bearer Developer Token: Bearer tas_dev_...',
                required=True
            )
        ],
        responses={200: dict}
    )
    def delete(self, request, app_id):
        try:
            app = Application.objects.get(id=app_id, developer=request.developer)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        app.is_active = False
        app.save()
        app.api_keys.update(is_active=False)
        return Response({'message': f"Application '{app.app_name}' deactivated successfully."}, status=status.HTTP_200_OK)


class ApplicationKeyRegenerateView(APIView):
    """
    Regenerates a fresh live API Key for an application.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Application Management'],
        summary='Regenerate Application Live API Key',
        description='Creates a new active API key (tas_live_...) for the specified application and revokes old keys.',
        parameters=[
            OpenApiParameter(
                name='Authorization',
                type=str,
                location=OpenApiParameter.HEADER,
                description='Bearer Developer Token: Bearer tas_dev_...',
                required=True
            )
        ],
        request=None,
        responses={200: dict}
    )
    def post(self, request, app_id):
        try:
            app = Application.objects.get(id=app_id, developer=request.developer)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Deactivate old keys
        app.api_keys.update(is_active=False)

        # Generate fresh key
        api_key_obj, raw_api_key = APIKey.generate_for_app(app)

        return Response({
            'message': 'API Key regenerated successfully.',
            'app_id': str(app.id),
            'api_key': raw_api_key,
            'key_prefix': api_key_obj.key_prefix,
            'warning': 'Old API keys have been deactivated. Update your application environment variables immediately.'
        }, status=status.HTTP_200_OK)


class ApplicationSessionsView(APIView):
    """
    Returns recent session history and tool telemetry for an application.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Application Management'],
        summary='Get Application Session Telemetry',
        description='Fetches recent user voice/text sessions, spoken utterances, executed tools, and payloads.',
        responses={200: dict}
    )
    def get(self, request, app_id):
        try:
            app = Application.objects.get(id=app_id, developer=request.developer)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        from core.models import SessionHistory
        from django.conf import settings
        max_limit = getattr(settings, 'MAX_SESSION_HISTORY_PER_APP', 300)
        sessions = SessionHistory.objects.filter(application=app).order_by('-created_at')[:max_limit]
        serialized = [
            {
                'id': str(s.id),
                'session_id': s.session_id,
                'client_user_id': s.client_user_id,
                'role': s.role,
                'content': s.content,
                'tool_name': s.tool_name,
                'tool_payload': s.tool_payload,
                'created_at': s.created_at.isoformat()
            }
            for s in sessions
        ]
        return Response({
            'count': len(serialized),
            'sessions': serialized
        }, status=status.HTTP_200_OK)


