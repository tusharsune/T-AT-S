import hmac
import hashlib
import uuid
import logging
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema
from core.models import Developer, Application, UsageMeter, PaymentOrder, Notification, PlatformConfig
from core.auth import DeveloperTokenAuthentication, IsDeveloperAuthenticated
from api.serializers import RazorpayCreateOrderSerializer, RazorpayVerifySerializer

logger = logging.getLogger(__name__)


class RazorpayCreateOrderView(APIView):
    """
    Creates a Razorpay checkout order for plan upgrades using dynamic platform pricing configured by Super Admin.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Billing & Payments'],
        summary='Create Razorpay Payment Order',
        description='Initializes a Razorpay order for subscription plans and returns checkout options.',
        request=RazorpayCreateOrderSerializer
    )
    def post(self, request):
        serializer = RazorpayCreateOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        dev = request.developer
        plan_tier = serializer.validated_data.get('plan_tier', 'GROWTH_STARTUP')
        app_id = serializer.validated_data.get('app_id')
        custom_units = serializer.validated_data.get('units', 0)

        # Fetch dynamic platform pricing set by Platform Governance / Admin
        platform_config = PlatformConfig.get_active()
        growth_price = getattr(platform_config, 'growth_price_inr', None) or platform_config.starter_price_inr or 1999
        enterprise_price = getattr(platform_config, 'enterprise_price_inr', 14999) or 14999
        growth_units = getattr(platform_config, 'growth_tier_units', 50000) or 50000
        enterprise_units = getattr(platform_config, 'enterprise_tier_units', 250000) or 250000
        cost_per_unit = float(getattr(platform_config, 'cost_per_extra_unit', 0.10) or 0.10)

        # Resolve Target Application Cluster
        app = None
        if app_id:
            app = Application.objects.filter(id=app_id, developer=dev).first()
            if not app:
                return Response({
                    'error': 'Application Cluster not found. Please create or select an active cluster first.'
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            app = Application.objects.filter(developer=dev, is_active=True).first()
            if not app:
                return Response({
                    'error': 'Application Cluster Required. Please create an application cluster first so your subscription units can be provisioned.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Plan Tier / Booster Pack Metadata Resolution
        is_credit_topup = plan_tier.startswith('TOPUP') or plan_tier in ['ADDON_CREDITS', 'CREDIT_BOOSTER']

        if is_credit_topup:
            units_to_credit = custom_units if custom_units > 0 else 25000
            price_inr = max(100, int(units_to_credit * cost_per_unit))
            plan_meta = {
                'name': f'Credit Booster ({units_to_credit:,} Units)',
                'price_inr': price_inr,
                'amount_paise': int(price_inr * 100),
                'units_credited': units_to_credit,
                'description': f'Immediate credit expansion of {units_to_credit:,} units for active application cluster'
            }
        else:
            # Active Subscription Conflict Guard:
            current_tier = (app.plan_tier or 'FREE').upper()
            is_growth_target = plan_tier in ['GROWTH_STARTUP', 'GROWTH', 'STARTER', 'GROWTH_STARTUP_ANNUAL']
            is_enterprise_target = plan_tier in ['SCALE_ENTERPRISE', 'ENTERPRISE', 'SCALE_ENTERPRISE_ANNUAL']

            if current_tier in ['GROWTH', 'GROWTH_STARTUP', 'STARTER'] and is_growth_target:
                return Response({
                    'error': f"Application '{app.app_name}' is already actively subscribed to the Growth Startup plan. You cannot run duplicate subscriptions at the same time. You can either purchase immediate credit booster packs to expand quota, or upgrade to Scale Enterprise.",
                    'code': 'ALREADY_SUBSCRIBED',
                    'current_plan': 'GROWTH_STARTUP',
                    'current_plan_name': 'Growth Startup',
                    'can_topup': True,
                    'can_upgrade': True,
                    'upgrade_target': 'SCALE_ENTERPRISE'
                }, status=status.HTTP_400_BAD_REQUEST)
            elif current_tier in ['ENTERPRISE', 'SCALE_ENTERPRISE'] and is_enterprise_target:
                return Response({
                    'error': f"Application '{app.app_name}' is already actively provisioned on the Scale Enterprise plan. To add more actions, please purchase a credit booster pack.",
                    'code': 'ALREADY_SUBSCRIBED',
                    'current_plan': 'SCALE_ENTERPRISE',
                    'current_plan_name': 'Scale Enterprise',
                    'can_topup': True,
                    'can_upgrade': False
                }, status=status.HTTP_400_BAD_REQUEST)

            growth_annual_price = int(growth_price * 10)
            enterprise_annual_price = int(enterprise_price * 10)

            plan_configs = {
                'GROWTH_STARTUP': {
                    'name': 'Growth Startup (Monthly)',
                    'price_inr': growth_price,
                    'amount_paise': int(growth_price * 100),
                    'units_credited': growth_units,
                    'description': f'{growth_units:,} units, {platform_config.grace_buffer_pct}% grace buffer, sub-850ms latency guarantee'
                },
                'GROWTH_STARTUP_ANNUAL': {
                    'name': 'Growth Startup (Annual - 2 Mo Free)',
                    'price_inr': growth_annual_price,
                    'amount_paise': int(growth_annual_price * 100),
                    'units_credited': growth_units * 12,
                    'description': f'{growth_units * 12:,} units/yr (2 Mo Free), priority speech pipeline guarantee'
                },
                'STARTER': {
                    'name': 'Starter Tier',
                    'price_inr': growth_price,
                    'amount_paise': int(growth_price * 100),
                    'units_credited': growth_units,
                    'description': f'{growth_units:,} units, community support'
                },
                'SCALE_ENTERPRISE': {
                    'name': 'Scale Enterprise (Monthly)',
                    'price_inr': enterprise_price,
                    'amount_paise': int(enterprise_price * 100),
                    'units_credited': enterprise_units,
                    'description': f'{enterprise_units:,} units, air-gapped clusters, SLA guarantee'
                },
                'SCALE_ENTERPRISE_ANNUAL': {
                    'name': 'Scale Enterprise (Annual - 2 Mo Free)',
                    'price_inr': enterprise_annual_price,
                    'amount_paise': int(enterprise_annual_price * 100),
                    'units_credited': enterprise_units * 12,
                    'description': f'{enterprise_units * 12:,} units/yr (2 Mo Free), air-gapped clusters, 99.99% SLA'
                }
            }
            plan_meta = plan_configs.get(plan_tier, plan_configs['GROWTH_STARTUP'])

        amount_paise = plan_meta['amount_paise']

        razorpay_key_id = getattr(settings, 'RAZORPAY_KEY_ID', '')
        razorpay_key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')

        order_id = ""
        is_live_gateway = bool(razorpay_key_id and razorpay_key_secret)

        if is_live_gateway:
            try:
                import razorpay
                client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
                rp_payload = {
                    'amount': amount_paise,
                    'currency': 'INR',
                    'receipt': f"rcpt_{uuid.uuid4().hex[:12]}",
                    'notes': {
                        'plan_tier': plan_tier,
                        'developer_id': str(dev.id),
                        'developer_email': dev.email,
                        'application_id': str(app.id) if app else 'none'
                    }
                }
                rp_order = client.order.create(data=rp_payload)
                order_id = rp_order['id']
            except Exception as e:
                logger.error(f"Razorpay live order creation failed: {e}")
                # Fix #11: Fail properly when Razorpay is down — do NOT create a fake order ID.
                # A fake order would allow signature bypass attacks later.
                return Response(
                    {'error': 'Payment gateway is temporarily unavailable. Please try again in a moment.'},
                    status=status.HTTP_502_BAD_GATEWAY
                )
        else:
            # No live gateway keys configured — use a deterministic reference for local dev/testing
            order_id = f"order_{uuid.uuid4().hex[:16]}"

        payment_order = PaymentOrder.objects.create(
            developer=dev,
            application=app,
            plan_tier=plan_tier,
            razorpay_order_id=order_id,
            amount=amount_paise,
            currency='INR',
            status='CREATED',
            units_credited=plan_meta['units_credited']
        )

        resp_payload = {
            'order_id': order_id,
            'key_id': razorpay_key_id or 'rzp_live_placeholder',
            'amount': amount_paise,
            'currency': 'INR',
            'price_inr': plan_meta['price_inr'],
            'plan_name': plan_meta['name'],
            'plan_tier': plan_tier,
            'units_credited': plan_meta['units_credited'],
            'is_live_gateway': is_live_gateway,
            'prefill': {
                'name': dev.name,
                'email': dev.email,
                'contact': dev.phone or '+919999999999'
            },
            'notes': {
                'plan': plan_meta['name'],
                'application': app.app_name if app else 'Primary Cluster'
            }
        }
        # Include nested order dictionary for backward compatibility with all frontend callers
        resp_payload['order'] = dict(resp_payload)

        return Response(resp_payload, status=status.HTTP_201_CREATED)


class RazorpayVerifyView(APIView):
    """
    Verifies Razorpay payment signature after customer completes payment.
    Activates the upgraded plan, credits action units, and logs billing telemetry.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Billing & Payments'],
        summary='Verify Razorpay Payment Signature',
        description='Validates HMAC-SHA256 signature from Razorpay checkout and activates subscription.',
        request=RazorpayVerifySerializer
    )
    def post(self, request):
        serializer = RazorpayVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        dev = request.developer
        order_id = serializer.validated_data['razorpay_order_id']
        payment_id = serializer.validated_data['razorpay_payment_id']
        signature = serializer.validated_data['razorpay_signature']
        app_id = serializer.validated_data.get('app_id')

        # Retrieve order
        try:
            order = PaymentOrder.objects.get(razorpay_order_id=order_id, developer=dev)
        except PaymentOrder.DoesNotExist:
            return Response({'error': 'Order not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        razorpay_key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')
        is_debug = getattr(settings, 'DEBUG', False)

        # Fix #3: Prevent double-claim — reject if order already PAID
        if order.status == 'PAID':
            return Response({'error': 'This payment order has already been processed.'}, status=status.HTTP_400_BAD_REQUEST)

        # Fix #1 & #2: Always verify signature when secret is configured.
        # simulated_/sandbox_ bypass is only allowed in DEBUG mode (local dev).
        # In production (DEBUG=False), ALL signatures are verified — no bypass.
        signature_is_bypass = signature.startswith('simulated_') or signature.startswith('sandbox_')
        if razorpay_key_secret:
            if signature_is_bypass and not is_debug:
                # Block bypass attempts in production
                order.status = 'FAILED'
                order.save()
                return Response({'error': 'Invalid payment signature. Transaction rejected.'}, status=status.HTTP_400_BAD_REQUEST)
            elif not signature_is_bypass:
                try:
                    expected_sig = hmac.new(
                        razorpay_key_secret.encode('utf-8'),
                        f"{order_id}|{payment_id}".encode('utf-8'),
                        hashlib.sha256
                    ).hexdigest()

                    if not hmac.compare_digest(expected_sig, signature):
                        order.status = 'FAILED'
                        order.save()
                        return Response({'error': 'Invalid payment signature. Transaction rejected.'}, status=status.HTTP_400_BAD_REQUEST)
                except Exception as e:
                    logger.error(f"Signature verification error: {e}")
                    order.status = 'FAILED'
                    order.save()
                    return Response({'error': 'Signature verification failed. Please contact support.'}, status=status.HTTP_400_BAD_REQUEST)

        # Payment Successful!
        order.status = 'PAID'
        order.razorpay_payment_id = payment_id
        order.razorpay_signature = signature
        order.save()

        # Target Application
        target_app = order.application
        if app_id:
            app_lookup = Application.objects.filter(id=app_id, developer=dev).first()
            if app_lookup:
                target_app = app_lookup

        if not target_app:
            target_app = Application.objects.filter(developer=dev, is_active=True).first()

        is_topup_order = order.plan_tier.startswith('TOPUP') or order.plan_tier in ['ADDON_CREDITS', 'CREDIT_BOOSTER']

        if target_app:
            if not is_topup_order:
                is_annual = 'ANNUAL' in order.plan_tier
                duration_days = 365 if is_annual else 30
                from datetime import timedelta
                target_app.plan_expires_at = timezone.now() + timedelta(days=duration_days)

                if order.plan_tier in ['SCALE_ENTERPRISE', 'SCALE_ENTERPRISE_ANNUAL']:
                    target_app.plan_tier = 'ENTERPRISE'
                elif order.plan_tier in ['GROWTH_STARTUP', 'GROWTH_STARTUP_ANNUAL', 'GROWTH', 'STARTER']:
                    target_app.plan_tier = 'GROWTH'
                target_app.save()


            # Credit units into current month UsageMeter
            current_month = timezone.now().strftime('%Y-%m')
            meter, _ = UsageMeter.objects.get_or_create(
                application=target_app,
                month_year=current_month
            )
            if is_topup_order:
                # Fix #7: Only credit bonus units for explicit top-up purchases.
                # Plan subscription purchases ONLY change the plan_tier — they do NOT
                # add bonus units to avoid doubling the developer's quota.
                # Fix #13: Use F() for atomic increment to prevent race-condition overwrite.
                from django.db.models import F
                UsageMeter.objects.filter(pk=meter.pk).update(
                    bonus_units=F('bonus_units') + order.units_credited
                )
                meter.refresh_from_db()

        # Create billing notification
        if is_topup_order:
            notif_title = f"Credit Booster Activated (+{order.units_credited:,} Units)"
            notif_msg = (
                f"Your top-up payment of ₹{order.amount / 100:,.2f} succeeded. "
                f"{order.units_credited:,} units have been credited to application '{target_app.app_name if target_app else 'Active Cluster'}'. "
                f"Payment ID: {payment_id}"
            )
            resp_message = f"Credit top-up successful! Added {order.units_credited:,} action units."
        elif order.plan_tier in ['SCALE_ENTERPRISE', 'SCALE_ENTERPRISE_ANNUAL']:
            is_annual = 'ANNUAL' in order.plan_tier
            notif_title = f"Scale Enterprise {'(Annual)' if is_annual else ''} Plan Activated!"
            notif_msg = (
                f"Your payment of ₹{order.amount / 100:,.2f} has been verified. "
                f"Application '{target_app.app_name if target_app else 'Active Cluster'}' upgraded to Scale Enterprise with {order.units_credited:,} units credited. "
                f"Payment ID: {payment_id}"
            )
            resp_message = f"Scale Enterprise Plan activated! Application upgraded successfully."
        else:
            is_annual = 'ANNUAL' in order.plan_tier
            notif_title = f"Growth Startup {'(Annual)' if is_annual else ''} Plan Activated!"
            notif_msg = (
                f"Your payment of ₹{order.amount / 100:,.2f} has been verified successfully. "
                f"{order.units_credited:,} units have been credited to application '{target_app.app_name if target_app else 'Active Cluster'}'. "
                f"Payment ID: {payment_id}"
            )
            resp_message = f"Growth Startup Plan activated successfully!"

        Notification.objects.create(
            developer=dev,
            title=notif_title,
            message=notif_msg,
            notification_type='BILLING',
            link='/dashboard'
        )

        # Dispatch Branded Email Receipt to Developer in Background Thread
        try:
            import threading
            from django.core.mail import send_mail
            email_subject = f"T @ S Billing Receipt: {notif_title}"
            email_html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#FAF9F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:auto;background:#FFF;border-radius:20px;border:1px solid #FFE6DC;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#FF7E5F,#A53B22);padding:28px;text-align:center;color:#FFF;">
      <h2 style="margin:0;font-size:24px;font-weight:800;">T @ S</h2>
      <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">Autonomous Telephony System &middot; Billing Receipt</p>
    </div>
    <div style="padding:28px;">
      <h3 style="margin-top:0;color:#1D1A23;">{notif_title}</h3>
      <p style="color:#57423D;font-size:13px;line-height:1.6;">{notif_msg}</p>
      <div style="background:#FAF9F6;border:1px solid #FFE6DC;border-radius:12px;padding:16px;margin:20px 0;font-size:12px;">
        <div style="margin-bottom:6px;"><strong>Amount Paid:</strong> &#8377;{order.amount / 100:,.2f}</div>
        <div style="margin-bottom:6px;"><strong>Units Credited:</strong> {order.units_credited:,} Action Units</div>
        <div style="margin-bottom:6px;"><strong>Cluster:</strong> {target_app.app_name if target_app else 'Active Cluster'}</div>
        <div><strong>Payment Reference:</strong> <code>{payment_id}</code></div>
      </div>
      <p style="font-size:11px;color:#8B716B;text-align:center;">Unspent credits never decay. Thank you for building with T @ S.</p>
    </div>
  </div>
 </body>
</html>"""
            def _dispatch_receipt():
                try:
                    send_mail(
                        subject=email_subject,
                        message=notif_msg,
                        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', '"T @ S" <noreply@tats.ai>'),
                        recipient_list=[dev.email],
                        html_message=email_html,
                        fail_silently=True
                    )
                except Exception:
                    pass

            threading.Thread(target=_dispatch_receipt, daemon=True, name=f"ReceiptThread-{payment_id}").start()
        except Exception:
            pass

        return Response({
            'success': True,
            'message': resp_message,
            'order_id': order_id,
            'payment_id': payment_id,
            'units_credited': order.units_credited,
            'application_name': target_app.app_name if target_app else None,
            'plan_tier': target_app.plan_tier if target_app else order.plan_tier,
            'is_topup': is_topup_order
        }, status=status.HTTP_200_OK)


class RazorpayWebhookView(APIView):
    """
    Razorpay Webhook receiver for automated payment status synchronization.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '')
        webhook_sig = request.headers.get('X-Razorpay-Signature', '')

        if webhook_secret:
            # Fix #2: If secret is configured, the signature header MUST be present.
            # Reject immediately if header is missing — no signature = no processing.
            if not webhook_sig:
                logger.warning("Webhook rejected: X-Razorpay-Signature header missing.")
                return Response({'error': 'Webhook signature header required.'}, status=status.HTTP_400_BAD_REQUEST)

            body_bytes = request.body
            computed_sig = hmac.new(
                webhook_secret.encode('utf-8'),
                body_bytes,
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(computed_sig, webhook_sig):
                logger.warning("Webhook rejected: signature mismatch.")
                return Response({'error': 'Invalid webhook signature'}, status=status.HTTP_400_BAD_REQUEST)

        event = request.data.get('event')
        payload = request.data.get('payload', {})
        payment_entity = payload.get('payment', {}).get('entity', {})
        order_id = payment_entity.get('order_id')

        if event in ['payment.captured', 'order.paid'] and order_id:
            order = PaymentOrder.objects.filter(razorpay_order_id=order_id).first()
            if order and order.status != 'PAID':
                order.status = 'PAID'
                order.razorpay_payment_id = payment_entity.get('id', '')
                order.save()
                if order.application:
                    is_topup = order.plan_tier.startswith('TOPUP') or order.plan_tier in ['ADDON_CREDITS', 'CREDIT_BOOSTER']
                    if is_topup:
                        # Fix #10: Top-up webhook — credit units only, do NOT change plan_tier.
                        # Changing it here can downgrade an Enterprise app to Growth.
                        from django.db.models import F
                        current_month = timezone.now().strftime('%Y-%m')
                        meter, _ = UsageMeter.objects.get_or_create(
                            application=order.application,
                            month_year=current_month
                        )
                        UsageMeter.objects.filter(pk=meter.pk).update(
                            bonus_units=F('bonus_units') + order.units_credited
                        )
                    else:
                        # Plan subscription webhook — update plan_tier and set expiration
                        is_annual = 'ANNUAL' in order.plan_tier
                        duration_days = 365 if is_annual else 30
                        from datetime import timedelta
                        order.application.plan_expires_at = timezone.now() + timedelta(days=duration_days)

                        if order.plan_tier in ['SCALE_ENTERPRISE', 'SCALE_ENTERPRISE_ANNUAL']:
                            order.application.plan_tier = 'ENTERPRISE'
                        elif order.plan_tier in ['GROWTH_STARTUP', 'GROWTH_STARTUP_ANNUAL', 'GROWTH', 'STARTER']:
                            order.application.plan_tier = 'GROWTH'
                        order.application.save()
        elif event == 'payment.failed' and order_id:
            order = PaymentOrder.objects.filter(razorpay_order_id=order_id).first()
            if order and order.status != 'PAID':
                order.status = 'FAILED'
                order.save()

        return Response({'status': 'webhook received'}, status=status.HTTP_200_OK)


class DeveloperBillingHistoryView(APIView):
    """
    Returns payment orders and invoices for the authenticated developer.
    Allows developers to view their transaction history, amounts paid, units credited, and invoice receipts.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Billing & Payments'],
        summary='Get Developer Payment History & Invoices',
        description='Fetches past payment orders, receipts, plan activations, and credit booster history for the logged-in developer.'
    )
    def get(self, request):
        dev = request.developer
        orders = PaymentOrder.objects.filter(developer=dev).select_related('application').order_by('-created_at')
        orders_data = []
        for o in orders:
            orders_data.append({
                'id': str(o.id),
                'order_id': o.razorpay_order_id,
                'payment_id': o.razorpay_payment_id or 'Pending',
                'plan_tier': o.plan_tier,
                'amount_inr': round(o.amount / 100, 2),
                'currency': o.currency,
                'status': o.status,
                'units_credited': o.units_credited,
                'app_name': o.application.app_name if o.application else 'Default Cluster',
                'app_id': str(o.application.id) if o.application else None,
                'created_at': o.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            })
        return Response({
            'orders': orders_data,
            'count': len(orders_data)
        }, status=status.HTTP_200_OK)


