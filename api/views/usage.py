from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from core.models import Application, UsageMeter, PlatformConfig
from core.auth import DeveloperTokenAuthentication, IsDeveloperAuthenticated

class ApplicationUsageView(APIView):
    """
    Retrieves real-time usage metering, quota limits, and billing breakdown for an application.
    """
    authentication_classes = [DeveloperTokenAuthentication]

    @extend_schema(
        tags=['Unit Accounting & Quota'],
        summary='Get Application Quota & Usage Meter',
        description='Fetches the active monthly unit meter, remaining balance, grace buffer state, and itemized breakdown of text/voice/tool usage.',
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
    def get(self, request, app_id):
        try:
            app = Application.objects.get(id=app_id, developer=request.developer)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        current_month = timezone.now().strftime('%Y-%m')
        meter, _ = UsageMeter.objects.get_or_create(
            application=app,
            month_year=current_month
        )
        platform_config = PlatformConfig.get_active()
        quota_status = meter.get_quota_status(platform_config)

        # Estimate billing if extra units consumed
        extra_units = max(0, meter.units_consumed - quota_status['base_quota'])
        estimated_extra_inr = float(extra_units) * float(platform_config.cost_per_extra_unit)

        return Response({
            'application_id': str(app.id),
            'app_name': app.app_name,
            'quota': quota_status,
            'pricing': {
                'starter_price_inr': platform_config.starter_price_inr,
                'cost_per_extra_unit': float(platform_config.cost_per_extra_unit),
                'estimated_extra_cost_inr': round(estimated_extra_inr, 2)
            }
        }, status=status.HTTP_200_OK)


class ApplicationAddBonusView(APIView):
    """
    Adds promotional bonus units to an application's current month meter.
    Admin-only: requires is_admin to prevent self-granted free credits.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Unit Accounting & Quota'],
        summary='Add Bonus Units to Application',
        description='Admin-only. Credits promotional or coupon bonus units to the application for the current billing cycle.',
        parameters=[
            OpenApiParameter(
                name='Authorization',
                type=str,
                location=OpenApiParameter.HEADER,
                description='Bearer Developer Token: Bearer tas_dev_...',
                required=True
            )
        ],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'units': {'type': 'integer', 'example': 500},
                    'reason': {'type': 'string', 'example': 'Welcome Promo Credit'}
                },
                'required': ['units']
            }
        },
        responses={200: dict}
    )
    def post(self, request, app_id):
        # Fix #4: Admin-only endpoint. Regular developers cannot grant themselves free units.
        if not request.developer.is_admin:
            return Response({'error': 'Unauthorized. Admin privileges required.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            app = Application.objects.get(id=app_id)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        units = request.data.get('units')
        if not units or int(units) <= 0:
            return Response({'error': 'Positive integer required for bonus units.'}, status=status.HTTP_400_BAD_REQUEST)

        current_month = timezone.now().strftime('%Y-%m')
        meter, _ = UsageMeter.objects.get_or_create(
            application=app,
            month_year=current_month
        )
        # Fix #13: Use F() for atomic increment to prevent race-condition overwrite.
        from django.db.models import F
        UsageMeter.objects.filter(pk=meter.pk).update(
            bonus_units=F('bonus_units') + int(units)
        )
        meter.refresh_from_db()

        platform_config = PlatformConfig.get_active()
        quota_status = meter.get_quota_status(platform_config)

        return Response({
            'message': f"Credited {units} bonus units to '{app.app_name}'.",
            'quota': quota_status
        }, status=status.HTTP_200_OK)


class ApplicationUpgradeView(APIView):
    """
    Upgrades application tier. Admin-only: plan changes must follow verified payment.
    Regular developers should use the Razorpay payment flow to change their plan tier.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Unit Accounting & Quota'],
        summary='Upgrade Application Plan Tier (Admin)',
        description='Admin-only. Directly sets an application plan tier. Developers should use the billing/payment flow instead.',
        parameters=[
            OpenApiParameter(
                name='Authorization',
                type=str,
                location=OpenApiParameter.HEADER,
                description='Bearer Developer Token: Bearer tas_dev_...',
                required=True
            )
        ],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'plan': {'type': 'string', 'enum': ['FREE', 'GROWTH', 'ENTERPRISE'], 'example': 'GROWTH'}
                },
                'required': ['plan']
            }
        },
        responses={200: dict}
    )
    def post(self, request, app_id):
        # Fix #4: Admin-only — plan changes must follow verified payment, not be done directly.
        if not request.developer.is_admin:
            return Response({'error': 'Unauthorized. Admin privileges required. Use the billing payment flow to upgrade your plan.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            app = Application.objects.get(id=app_id)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_plan = request.data.get('plan', 'GROWTH').upper()
        if target_plan in ['GROWTH_STARTUP']:
            target_plan = 'GROWTH'
        elif target_plan in ['SCALE_ENTERPRISE']:
            target_plan = 'ENTERPRISE'

        valid_plans = ['FREE', 'GROWTH', 'ENTERPRISE']
        if target_plan not in valid_plans:
            return Response({'error': f"Invalid plan. Choose from {valid_plans}."}, status=status.HTTP_400_BAD_REQUEST)

        if app.plan_tier == target_plan:
            return Response({
                'error': f"Application '{app.app_name}' is already running on the {target_plan} plan.",
                'code': 'ALREADY_ACTIVE'
            }, status=status.HTTP_400_BAD_REQUEST)

        app.plan_tier = target_plan
        app.save()

        current_month = timezone.now().strftime('%Y-%m')
        meter, _ = UsageMeter.objects.get_or_create(
            application=app,
            month_year=current_month
        )
        platform_config = PlatformConfig.get_active()

        return Response({
            'message': f"Application '{app.app_name}' upgraded to {target_plan} Plan successfully.",
            'plan_tier': app.plan_tier,
            'quota': meter.get_quota_status(platform_config)
        }, status=status.HTTP_200_OK)
