from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from drf_spectacular.utils import extend_schema
import secrets
from django.contrib.auth.hashers import check_password
from core.models import PlatformConfig, Developer, EmailOTPVerification, Notification
from core.auth import DeveloperTokenAuthentication, IsDeveloperAuthenticated
from api.serializers import PlatformConfigSerializer
from api.views.auth import validate_strong_password

class AdminConfigView(APIView):
    """
    Super Admin configuration endpoint.
    Retrieves or dynamically updates pricing tiers, unit quotas, and multipliers.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Super Admin Controls'],
        summary='Get Dynamic Platform Configuration',
        description='Fetches current platform monetization parameters: starter plan price, free monthly units, grace buffer percentage, and operation multipliers.',
        responses={200: PlatformConfigSerializer}
    )
    def get(self, request):
        if not request.developer.is_admin:
            return Response({'error': 'Unauthorized. Admin privileges required.'}, status=status.HTTP_403_FORBIDDEN)
        config = PlatformConfig.get_active()
        serializer = PlatformConfigSerializer(config)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=['Super Admin Controls'],
        summary='Update Dynamic Platform Configuration',
        description='Updates platform pricing and quota sliders on the fly without server restarts or code redeployments.',
        request=PlatformConfigSerializer,
        responses={200: PlatformConfigSerializer}
    )
    def post(self, request):
        if not request.developer.is_admin:
            return Response({'error': 'Unauthorized. Admin privileges required.'}, status=status.HTTP_403_FORBIDDEN)
        config = PlatformConfig.get_active()
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if 'starter_price_inr' in data and 'growth_price_inr' not in data:
            data['growth_price_inr'] = data['starter_price_inr']
        elif 'growth_price_inr' in data and 'starter_price_inr' not in data:
            data['starter_price_inr'] = data['growth_price_inr']

        serializer = PlatformConfigSerializer(config, data=data, partial=True)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        updated_config = serializer.save()
        return Response({
            'message': 'Platform configuration dynamically updated.',
            'config': PlatformConfigSerializer(updated_config).data
        }, status=status.HTTP_200_OK)


class AdminGovernanceDataView(APIView):
    """
    Super Admin Platform Governance Data:
    Returns 100% REAL live database metrics, registered developers, active application clusters,
    usage metrics, and revenue.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    def get(self, request):
        if not request.developer.is_admin:
            return Response({'error': 'Unauthorized. Admin privileges required.'}, status=status.HTTP_403_FORBIDDEN)
        from django.db.models import Sum
        from core.models import Developer, Application, UsageMeter, PaymentOrder, EndUserConfig

        devs_qs = Developer.objects.all().order_by('-created_at')
        apps_qs = Application.objects.all().select_related('developer').order_by('-created_at')

        developers_data = []
        for dev in devs_qs:
            total_consumed = UsageMeter.objects.filter(application__developer=dev).aggregate(Sum('units_consumed'))['units_consumed__sum'] or 0
            developers_data.append({
                'id': str(dev.id),
                'name': dev.name,
                'email': dev.email,
                'phone': dev.phone or '',
                'is_admin': dev.is_admin,
                'is_verified': dev.is_verified,
                'is_active': dev.is_active,
                'created_at': dev.created_at.isoformat(),
                'applications_count': dev.applications.count(),
                'units_used': total_consumed,
                'status': 'Active' if dev.is_active else 'Suspended'
            })

        applications_data = []
        for app in apps_qs:
            monthly_meter = app.usage_meters.order_by('-month_year').first()
            applications_data.append({
                'id': str(app.id),
                'app_name': app.app_name,
                'developer_name': app.developer.name,
                'developer_email': app.developer.email,
                'plan_tier': app.plan_tier,
                'base_url': app.base_url,
                'wake_word_policy': app.wake_word_policy,
                'is_active': app.is_active,
                'units_consumed': monthly_meter.units_consumed if monthly_meter else 0,
                'created_at': app.created_at.isoformat()
            })

        total_units = UsageMeter.objects.aggregate(Sum('units_consumed'))['units_consumed__sum'] or 0
        total_revenue_paise = PaymentOrder.objects.filter(status='PAID').aggregate(Sum('amount'))['amount__sum'] or 0
        total_paid_orders = PaymentOrder.objects.filter(status='PAID').count()
        total_created_orders = PaymentOrder.objects.filter(status='CREATED').count()
        total_failed_orders = PaymentOrder.objects.filter(status='FAILED').count()

        # Real Payment Transactions History for Super Admin
        orders_qs = PaymentOrder.objects.all().select_related('developer', 'application').order_by('-created_at')
        transactions_data = []
        for order in orders_qs:
            transactions_data.append({
                'id': str(order.id),
                'order_id': order.razorpay_order_id,
                'payment_id': order.razorpay_payment_id or '—',
                'developer_name': order.developer.name if order.developer else 'Developer',
                'developer_email': order.developer.email if order.developer else '—',
                'application_name': order.application.app_name if order.application else 'General Cluster',
                'plan_tier': order.plan_tier,
                'amount_inr': order.amount / 100,
                'currency': order.currency or 'INR',
                'status': order.status,
                'units_credited': order.units_credited,
                'created_at': order.created_at.isoformat(),
            })

        end_users_data = []
        for conf in EndUserConfig.objects.all().order_by('-last_active')[:50]:
            end_users_data.append({
                'id': str(conf.id),
                'client_user_id': conf.client_user_id,
                'wake_word': conf.wake_word,
                'passphrase': '••••••••' if conf.passphrase_hash else 'None',
                'voice_tier': conf.voice_tier,
                'is_active': True,
                'created_at': conf.last_active.isoformat() if conf.last_active else ''
            })

        return Response({
            'developers': developers_data,
            'applications': applications_data,
            'transactions': transactions_data,
            'end_users': end_users_data,
            'metrics': {
                'total_developers': devs_qs.count(),
                'total_applications': apps_qs.count(),
                'total_units_consumed': total_units,
                'total_revenue_inr': total_revenue_paise / 100,
                'total_transactions': orders_qs.count(),
                'paid_transactions': total_paid_orders,
                'created_transactions': total_created_orders,
                'failed_transactions': total_failed_orders,
                'total_end_users': EndUserConfig.objects.count()
            }
        }, status=status.HTTP_200_OK)


class AdminDeveloperStatusView(APIView):
    """
    Allows Platform Administrator to toggle developer account status (Active / Suspended).
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    def post(self, request, dev_id):
        if not request.developer.is_admin:
            return Response({'error': 'Unauthorized. Admin privileges required.'}, status=status.HTTP_403_FORBIDDEN)
        from core.models import Developer
        try:
            dev = Developer.objects.get(id=dev_id)
            dev.is_active = not dev.is_active
            dev.save()
            return Response({
                'message': f"Developer account status updated to {'Active' if dev.is_active else 'Suspended'}.",
                'is_active': dev.is_active
            }, status=status.HTTP_200_OK)
        except Developer.DoesNotExist:
            return Response({'error': 'Developer not found.'}, status=status.HTTP_404_NOT_FOUND)


class AdminGovernanceSecurityView(APIView):
    """
    Manages Super Admin Platform Governance Security configuration:
    - Verification check mode (PASSWORD, OTP, SAVE_CODES)
    - Generates and lists offline single-use save/backup recovery codes
    - Updates admin governance password
    Only accessible to authenticated Super Administrators.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    def get(self, request):
        dev = request.developer
        if not dev.is_admin:
            return Response({'error': 'Unauthorized. Admin privileges required.'}, status=status.HTTP_403_FORBIDDEN)

        # If user selected SAVE_CODES but has none, auto-generate initial set
        if not dev.governance_save_codes:
            dev.governance_save_codes = [f"TAS-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(5)]
            dev.save()

        return Response({
            'auth_method': dev.governance_auth_method or 'PASSWORD',
            'save_codes': dev.governance_save_codes,
            'save_codes_count': len(dev.governance_save_codes),
            'email': dev.email
        }, status=status.HTTP_200_OK)

    def post(self, request):
        dev = request.developer
        if not dev.is_admin:
            return Response({'error': 'Unauthorized. Admin privileges required.'}, status=status.HTTP_403_FORBIDDEN)

        action = request.data.get('action')

        if action == 'update_method':
            method = request.data.get('method', 'PASSWORD').upper()
            if method not in ['PASSWORD', 'OTP', 'SAVE_CODES']:
                return Response({'error': "Invalid verification method. Choose 'PASSWORD', 'OTP', or 'SAVE_CODES'."}, status=status.HTTP_400_BAD_REQUEST)

            if method == 'SAVE_CODES' and not dev.governance_save_codes:
                dev.governance_save_codes = [f"TAS-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(5)]

            dev.governance_auth_method = method
            dev.save()

            Notification.objects.create(
                developer=dev,
                title="Governance Security Updated",
                message=f"Platform Governance verification check set to {method}.",
                notification_type='INFO'
            )

            return Response({
                'message': f"Platform Governance verification check set to {method}.",
                'auth_method': dev.governance_auth_method,
                'save_codes': dev.governance_save_codes,
                'save_codes_count': len(dev.governance_save_codes)
            }, status=status.HTTP_200_OK)

        elif action == 'generate_save_codes':
            # Generate 5 fresh single-use recovery codes
            new_codes = [f"TAS-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(5)]
            dev.governance_save_codes = new_codes
            dev.save()

            Notification.objects.create(
                developer=dev,
                title="Save Codes Regenerated",
                message="A new set of 5 single-use emergency backup recovery codes was generated.",
                notification_type='INFO'
            )

            return Response({
                'message': "5 new emergency save codes generated successfully.",
                'save_codes': new_codes,
                'save_codes_count': len(new_codes)
            }, status=status.HTTP_200_OK)

        elif action == 'update_password':
            old_password = request.data.get('old_password', '')
            new_password = request.data.get('new_password', '')

            if not old_password or not new_password:
                return Response({'error': 'Please provide both current password and new password.'}, status=status.HTTP_400_BAD_REQUEST)

            if not check_password(old_password, dev.password):
                return Response({'error': 'Current administrator password does not match.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                validate_strong_password(new_password)
            except ValueError as ve:
                return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

            dev.set_password(new_password)
            dev.save()

            Notification.objects.create(
                developer=dev,
                title="Admin Password Updated",
                message="Your administrator credentials have been successfully updated from Accounts & Settings.",
                notification_type='INFO'
            )

            return Response({'message': 'Administrator password updated successfully.'}, status=status.HTTP_200_OK)

        return Response({'error': f"Unknown action: {action}"}, status=status.HTTP_400_BAD_REQUEST)


class AdminGovernanceUnlockView(APIView):
    """
    Unlocks Platform Governance access through the admin's chosen verification check:
    - Master Password
    - 6-digit Email OTP
    - Single-use Save / Recovery Backup Code

    Hardened with attempt-based brute-force lockout (Fix #6).
    """
    permission_classes = [permissions.AllowAny]

    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_SECONDS = 900  # 15 minutes

    def get(self, request):
        email = request.query_params.get('email', '').lower().strip()
        if not email:
            return Response({'error': 'Email required.'}, status=status.HTTP_400_BAD_REQUEST)
        admin = Developer.objects.filter(email=email, is_admin=True).first()
        if not admin:
            return Response({'error': 'Administrator account not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'auth_method': admin.governance_auth_method or 'PASSWORD',
            'has_save_codes': len(admin.governance_save_codes or []) > 0,
            'save_codes_count': len(admin.governance_save_codes or [])
        }, status=status.HTTP_200_OK)

    def post(self, request):
        from django.core.cache import cache

        email = request.data.get('email', '').lower().strip()
        method = request.data.get('method', 'PASSWORD').upper()
        credential = request.data.get('credential', '').strip()

        if not email or not credential:
            return Response({'error': 'Email and verification credential are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Fix #6: Check for temporary brute-force lockout
        lockout_key = f"gov_unlock_lockout:{email}"
        attempts_key = f"gov_unlock_attempts:{email}"

        if cache.get(lockout_key):
            return Response({
                'error': 'Too many failed unlock attempts. Platform Governance is locked for 15 minutes for security.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        dev = Developer.objects.filter(email=email, is_admin=True).first()
        if not dev:
            return Response({'error': 'Administrator account not found or access denied.'}, status=status.HTTP_403_FORBIDDEN)

        failed = False
        error_msg = ''

        if method == 'PASSWORD':
            if not check_password(credential, dev.password):
                failed = True
                error_msg = 'Incorrect administrator password.'

        elif method == 'OTP':
            is_valid = EmailOTPVerification.verify_code(email=dev.email, raw_code=credential, purpose='LOGIN')
            if not is_valid:
                is_valid = EmailOTPVerification.verify_code(email=dev.email, raw_code=credential, purpose='REGISTER')
            if not is_valid:
                failed = True
                error_msg = 'Invalid or expired 6-digit verification code.'

        elif method in ['SAVE_CODES', 'SAVE_CODE']:
            clean_input = credential.strip().upper()
            save_codes = [c.upper() for c in (dev.governance_save_codes or [])]
            if clean_input not in save_codes:
                failed = True
                error_msg = 'Invalid emergency save code. Please enter an unused valid backup code.'
            else:
                # Consume code (single-use)
                updated_codes = [c for c in dev.governance_save_codes if c.upper() != clean_input]
                dev.governance_save_codes = updated_codes
                dev.save()

                Notification.objects.create(
                    developer=dev,
                    title="Save Code Used",
                    message=f"An emergency save code was consumed to unlock Platform Governance. {len(updated_codes)} codes remaining.",
                    notification_type='WARNING'
                )
        else:
            return Response({'error': f"Unsupported verification method: {method}"}, status=status.HTTP_400_BAD_REQUEST)

        if failed:
            current_attempts = cache.get(attempts_key, 0) + 1
            if current_attempts >= self.MAX_FAILED_ATTEMPTS:
                cache.set(lockout_key, True, timeout=self.LOCKOUT_SECONDS)
                cache.delete(attempts_key)
                return Response({
                    'error': 'Too many failed attempts. Platform Governance access locked for 15 minutes.'
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)
            else:
                cache.set(attempts_key, current_attempts, timeout=self.LOCKOUT_SECONDS)
                remaining = self.MAX_FAILED_ATTEMPTS - current_attempts
                return Response({
                    'error': f"{error_msg} ({remaining} attempt{'s' if remaining != 1 else ''} remaining before lockout)."
                }, status=status.HTTP_400_BAD_REQUEST)

        # Unlock success — clear failed attempt counters
        cache.delete(attempts_key)
        cache.delete(lockout_key)

        return Response({
            'success': True,
            'message': 'Platform Governance unlocked successfully.',
            'auth_method_used': method,
            'developer': {
                'id': str(dev.id),
                'name': dev.name,
                'email': dev.email,
                'is_admin': dev.is_admin,
                'governance_auth_method': dev.governance_auth_method,
                'save_codes_remaining': len(dev.governance_save_codes or [])
            }
        }, status=status.HTTP_200_OK)


class AdminSendOTPView(APIView):
    """
    Sends a 6-digit OTP verification code to the Super Admin's email for governance unlock.
    Includes rate-limiting cooldown and hourly cap to prevent flooding (Fix #6).
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.core.cache import cache

        email = request.data.get('email', '').lower().strip()
        if not email:
            return Response({'error': 'Admin email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Fix #6: Cooldown & flooding protection
        cooldown_key = f"admin_otp_cooldown:{email}"
        hourly_key = f"admin_otp_hourly:{email}"

        if cache.get(cooldown_key):
            return Response({
                'error': 'Please wait 60 seconds before requesting another verification code.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        hourly_count = cache.get(hourly_key, 0)
        if hourly_count >= 5:
            return Response({
                'error': 'Hourly OTP request limit reached. Please try again later.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        admin = Developer.objects.filter(email=email, is_admin=True).first()
        if not admin:
            return Response({'error': 'No Super Administrator account found with this email.'}, status=status.HTTP_404_NOT_FOUND)

        instance, raw_otp = EmailOTPVerification.create_and_send(email=admin.email, purpose='LOGIN')

        # Set 60s cooldown and increment hourly count (3600s TTL)
        cache.set(cooldown_key, True, timeout=60)
        cache.set(hourly_key, hourly_count + 1, timeout=3600)

        return Response({
            'success': True,
            'message': f"A 6-digit verification code has been dispatched to {admin.email}.",
            'email': admin.email
        }, status=status.HTTP_200_OK)


