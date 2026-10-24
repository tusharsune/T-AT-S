import re
import logging
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from core.models import Developer, DeveloperToken, EmailOTPVerification, Notification
from core.auth import DeveloperTokenAuthentication, IsDeveloperAuthenticated
from api.serializers import (
    DeveloperRegisterSerializer,
    LoginRequestOTPSerializer,
    DeveloperLoginSerializer,
    DeveloperProfileSerializer,
    OTPVerifySerializer,
    ResendOTPSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer
)

logger = logging.getLogger(__name__)

INDIAN_PHONE_REGEX = re.compile(r'^(?:(?:\+|0{0,2})91(\s*[\-]\s*)?|[0]?)?([6789]\d{9})$')

def validate_indian_mobile(phone_raw: str) -> str:
    cleaned = re.sub(r'[\s\-\(\)]', '', phone_raw.strip())
    match = INDIAN_PHONE_REGEX.match(cleaned)
    if not match:
        raise ValueError("Please enter a valid 10-digit Indian mobile number (e.g., +91 9876543210 or 9876543210).")
    ten_digit = match.group(2)
    return f"+91{ten_digit}"

def validate_strong_password(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r'[A-Z]', password):
        raise ValueError("Password must contain at least one uppercase letter (A-Z).")
    if not re.search(r'[a-z]', password):
        raise ValueError("Password must contain at least one lowercase letter (a-z).")
    if not re.search(r'\d', password):
        raise ValueError("Password must contain at least one digit (0-9).")
    if not re.search(r'[@$!%*?&#^_\-+=]', password):
        raise ValueError("Password must contain at least one special character (@$!%*?&#^_-+=).")


class SystemStatusView(APIView):
    """
    Returns platform initialization status.
    Determines if the first Admin account has already been claimed.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Check System Admin Initialization Status',
        description='Returns whether the primary platform administrator has been initialized.'
    )
    def get(self, request):
        admin_exists = Developer.objects.filter(is_admin=True).exists()
        dev_count = Developer.objects.count()
        return Response({
            'is_initialized': admin_exists,
            'admin_exists': admin_exists,
            'developers_count': dev_count,
            'first_user_becomes_admin': not admin_exists,
            'message': 'Welcome to T@S. The first registered user will become Platform Administrator.' if not admin_exists else 'T@S Platform initialized.'
        }, status=status.HTTP_200_OK)


class LoginRequestOTPView(APIView):
    """
    Passwordless Developer Login - Step 1:
    Accepts developer email, verifies account existence, and dispatches a 6-digit cryptographic OTP to their email.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Request Login OTP (Passwordless Email Auth)',
        description='Dispatches a 6-digit cryptographic OTP to the developer email for passwordless sign-in.',
        request=LoginRequestOTPSerializer
    )
    def post(self, request):
        serializer = LoginRequestOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        dev = Developer.objects.filter(email=email).first()

        if not dev:
            return Response({
                'error': 'No developer account found with this email. Please register first.'
            }, status=status.HTTP_404_NOT_FOUND)

        if not dev.is_active:
            return Response({
                'error': 'This account has been deactivated. Please contact platform administration.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Dispatch 6-digit OTP
        EmailOTPVerification.create_and_send(email=email, purpose='LOGIN')

        return Response({
            'message': f'A 6-digit login verification code has been dispatched to {email}.',
            'requires_otp': True,
            'email': email,
            'is_admin': dev.is_admin
        }, status=status.HTTP_200_OK)


class RecoverEmailView(APIView):
    """
    Recover Registered Email using Indian Mobile Number (+91).
    Helps developers identify which email address is associated with their mobile number.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Recover Registered Email via Indian Phone',
        description='Finds and returns the developer email linked to a validated Indian mobile number.'
    )
    def post(self, request):
        phone_raw = request.data.get('phone', '')
        if not phone_raw:
            return Response({'error': 'Please enter your registered Indian mobile number.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            formatted_phone = validate_indian_mobile(phone_raw)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

        dev = Developer.objects.filter(phone=formatted_phone).first()
        if not dev:
            return Response({
                'error': 'No developer account found with this Indian mobile number.'
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'found': True,
            'email': dev.email,
            'name': dev.name,
            'message': f'Registered account found for {dev.name}.'
        }, status=status.HTTP_200_OK)


class DeveloperRegisterView(APIView):
    """
    Secure Developer Self-Service Registration.
    Validates Indian Mobile Number (+91), email, and dispatches 6-digit email OTP.
    ACID compliant with atomic transaction lock.
    The very first registered developer is automatically granted Platform Administrator privilege.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Register Developer Account (With Indian Mobile & Email OTP)',
        description='Initiates developer account registration. Requires Indian phone and sends 6-digit OTP to email.',
        request=DeveloperRegisterSerializer
    )
    def post(self, request):
        serializer = DeveloperRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        email = data['email'].lower().strip()
        raw_phone = data.get('phone', '')
        password = data.get('password')

        # 1. Validate Indian Mobile
        try:
            formatted_phone = validate_indian_mobile(raw_phone)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Validate Strong Password if provided
        if password:
            try:
                validate_strong_password(password)
            except ValueError as ve:
                return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Check duplicate email or phone within atomic block
        with transaction.atomic():
            if Developer.objects.filter(email=email).exists():
                existing = Developer.objects.get(email=email)
                if not existing.is_verified:
                    EmailOTPVerification.create_and_send(email=email, purpose='REGISTER')
                    return Response({
                        'message': 'An unverified account with this email exists. A new verification OTP has been sent.',
                        'requires_otp': True,
                        'email': email,
                        'is_admin': existing.is_admin
                    }, status=status.HTTP_200_OK)
                return Response({'error': 'An account with this email address already exists. Please Sign In.'}, status=status.HTTP_400_BAD_REQUEST)

            if Developer.objects.filter(phone=formatted_phone, is_verified=True).exists():
                return Response({'error': 'An account with this mobile number already exists. Please Sign In.'}, status=status.HTTP_400_BAD_REQUEST)

            # 4. Check if this is the very first user (Designated Platform Admin)
            is_first_user = not Developer.objects.select_for_update().filter(is_admin=True).exists()

            dev = Developer.objects.create_user(
                email=email,
                name=data.get('name', 'Developer').strip(),
                phone=formatted_phone,
                password=password if password else None,
                is_admin=is_first_user,
                is_verified=False
            )

            # 5. Generate and send 6-digit email OTP
            EmailOTPVerification.create_and_send(email=email, purpose='REGISTER')

        return Response({
            'message': f"Account created. A 6-digit verification code has been sent to {email}.",
            'requires_otp': True,
            'email': email,
            'is_admin': is_first_user,
            'role': 'Platform Administrator' if is_first_user else 'Developer'
        }, status=status.HTTP_201_CREATED)


class VerifyOTPView(APIView):
    """
    Verifies 6-digit Email OTP for Registration or Login.
    Upon successful OTP validation, activates user and issues auth token (tas_dev_...).
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Verify 6-Digit Email OTP',
        description='Verifies the 6-digit OTP code sent to developer email and activates the session.',
        request=OTPVerifySerializer
    )
    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        otp = serializer.validated_data['otp'].strip()
        purpose = serializer.validated_data.get('purpose', 'REGISTER')

        try:
            dev = Developer.objects.get(email=email)
        except Developer.DoesNotExist:
            return Response({'error': 'No developer account found for this email.'}, status=status.HTTP_404_NOT_FOUND)

        # Verify OTP (check provided purpose, and fallback between LOGIN and REGISTER)
        is_valid = EmailOTPVerification.verify_code(email=email, raw_code=otp, purpose=purpose)
        if not is_valid and purpose == 'LOGIN':
            is_valid = EmailOTPVerification.verify_code(email=email, raw_code=otp, purpose='REGISTER')
        elif not is_valid and purpose == 'REGISTER':
            is_valid = EmailOTPVerification.verify_code(email=email, raw_code=otp, purpose='LOGIN')

        if not is_valid:
            return Response({'error': 'Invalid or expired 6-digit verification code. Please check your email or request a new code.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Mark verified
            dev.is_verified = True
            dev.save()

            token = DeveloperToken.generate(dev)

            # Create notification
            if purpose == 'REGISTER':
                Notification.objects.create(
                    developer=dev,
                    title="Welcome to T@S!",
                    message=f"Your developer account is verified and ready. Provision your first application cluster to get live API keys.",
                    notification_type='SUCCESS'
                )
            else:
                Notification.objects.create(
                    developer=dev,
                    title="Sign-In Verified",
                    message="You have successfully authenticated via secure OTP.",
                    notification_type='INFO'
                )

        return Response({
            'message': 'Account verified successfully.',
            'developer': {
                'id': str(dev.id),
                'name': dev.name,
                'email': dev.email,
                'phone': dev.phone,
                'is_admin': dev.is_admin,
                'is_verified': dev.is_verified,
                'applications_count': dev.applications.count(),
                'created_at': dev.created_at
            },
            'token': token.key
        }, status=status.HTTP_200_OK)


class ResendOTPView(APIView):
    """
    Resends 6-digit OTP to user email.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Resend Email OTP Code',
        description='Generates a fresh 6-digit OTP code and dispatches it to developer email.',
        request=ResendOTPSerializer
    )
    def post(self, request):
        serializer = ResendOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        purpose = serializer.validated_data.get('purpose', 'REGISTER')

        if not Developer.objects.filter(email=email).exists():
            return Response({'error': 'No developer account found for this email.'}, status=status.HTTP_404_NOT_FOUND)

        EmailOTPVerification.create_and_send(email=email, purpose=purpose)
        return Response({'message': f'A fresh verification code has been dispatched to {email}.'}, status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
    """
    Sends a 6-digit OTP code to reset account password via email.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Request Password Reset OTP',
        description='Dispatches a 6-digit OTP to registered email for password recovery.',
        request=ForgotPasswordSerializer
    )
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        try:
            dev = Developer.objects.get(email=email)
        except Developer.DoesNotExist:
            # Mask existence for security
            return Response({'message': 'If this email is registered, a password reset code has been sent.'}, status=status.HTTP_200_OK)

        EmailOTPVerification.create_and_send(email=email, purpose='FORGOT_PASSWORD')
        return Response({'message': f'Password reset code sent to {email}.'}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """
    Resets account password using verified 6-digit OTP.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Reset Password with Verified OTP',
        description='Sets a new strong password for account after validating 6-digit OTP.',
        request=ResetPasswordSerializer
    )
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        otp = serializer.validated_data['otp'].strip()
        new_password = serializer.validated_data['new_password']

        try:
            dev = Developer.objects.get(email=email)
        except Developer.DoesNotExist:
            return Response({'error': 'No developer account found for this email.'}, status=status.HTTP_404_NOT_FOUND)

        # 1. Validate strong password
        try:
            validate_strong_password(new_password)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Verify OTP
        is_valid = EmailOTPVerification.verify_code(email=email, raw_code=otp, purpose='FORGOT_PASSWORD')
        if not is_valid:
            return Response({'error': 'Invalid or expired 6-digit reset code. Please request a new code.'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Update password
        dev.set_password(new_password)
        dev.save()

        # Invalidate old tokens for security
        dev.tokens.all().delete()
        token = DeveloperToken.generate(dev)

        Notification.objects.create(
            developer=dev,
            title="Password Updated",
            message="Your account password was updated successfully. If this wasn't you, contact security immediately.",
            notification_type='WARNING'
        )

        return Response({
            'message': 'Password has been reset successfully. You are now logged in.',
            'developer': {
                'id': str(dev.id),
                'name': dev.name,
                'email': dev.email,
                'phone': dev.phone,
                'is_admin': dev.is_admin,
                'is_verified': dev.is_verified,
                'applications_count': dev.applications.count(),
                'created_at': dev.created_at
            },
            'token': token.key
        }, status=status.HTTP_200_OK)


class DeveloperLoginView(APIView):
    """
    Developer Login endpoint.
    Accepts email or registered Indian phone + password.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Login to Developer Account',
        description='Authenticates a developer using email or Indian mobile and password. Returns developer token (tas_dev_...).',
        request=DeveloperLoginSerializer
    )
    def post(self, request):
        serializer = DeveloperLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        identifier = serializer.validated_data['email'].strip()
        password = serializer.validated_data.get('password')

        dev = None
        # Try finding by email
        if '@' in identifier:
            dev = Developer.objects.filter(email=identifier.lower()).first()
        else:
            # Try finding by phone
            try:
                formatted_phone = validate_indian_mobile(identifier)
                dev = Developer.objects.filter(phone=formatted_phone).first()
            except ValueError:
                pass

        # Passwordless Login Path (OTP-only)
        if not password:
            if not dev:
                return Response({'error': 'No developer account found with this email. Please register first.'}, status=status.HTTP_404_NOT_FOUND)
            EmailOTPVerification.create_and_send(email=dev.email, purpose='LOGIN')
            return Response({
                'message': f'A 6-digit login verification code has been dispatched to {dev.email}.',
                'requires_otp': True,
                'email': dev.email,
                'is_admin': dev.is_admin
            }, status=status.HTTP_200_OK)

        if not dev or not dev.check_password(password):
            return Response({'error': 'Invalid credentials. Please verify your email/phone and password.'}, status=status.HTTP_401_UNAUTHORIZED)

        # Check if email is verified
        if not dev.is_verified:
            if dev.is_admin or dev.is_staff or dev.is_superuser:
                dev.is_verified = True
                dev.save()
            else:
                EmailOTPVerification.create_and_send(email=dev.email, purpose='LOGIN')
                return Response({
                    'error': 'Your email address is not verified yet. A 6-digit verification code has been dispatched to your email.',
                    'requires_otp': True,
                    'email': dev.email
                }, status=status.HTTP_403_FORBIDDEN)

        token = DeveloperToken.generate(dev)

        return Response({
            'message': 'Logged in successfully.',
            'developer': {
                'id': str(dev.id),
                'name': dev.name,
                'email': dev.email,
                'phone': dev.phone,
                'is_admin': dev.is_admin,
                'is_verified': dev.is_verified,
                'applications_count': dev.applications.count(),
                'created_at': dev.created_at
            },
            'token': token.key
        }, status=status.HTTP_200_OK)


class DeveloperLogoutView(APIView):
    """
    Developer Logout endpoint.
    Revokes the active developer authentication token.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Logout from Developer Account',
        description='Revokes the provided developer token.'
    )
    def post(self, request):
        auth_header = request.headers.get('Authorization', '')
        parts = auth_header.split()
        if len(parts) == 2:
            DeveloperToken.objects.filter(key=parts[1].strip()).delete()
        elif hasattr(request, 'auth') and hasattr(request.auth, 'delete'):
            request.auth.delete()

        return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class DeveloperMeView(APIView):
    """
    Retrieves the currently authenticated developer's profile and tenancy stats.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Get Developer Profile',
        description='Fetches details of authenticated developer, role, and application count.'
    )
    def get(self, request):
        dev = request.developer
        return Response({
            'developer': {
                'id': str(dev.id),
                'name': dev.name,
                'email': dev.email,
                'phone': dev.phone,
                'is_admin': dev.is_admin,
                'is_verified': dev.is_verified,
                'applications_count': dev.applications.count(),
                'created_at': dev.created_at
            }
        }, status=status.HTTP_200_OK)

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Update Developer Profile',
        description='Allows developer to update their full name and Indian mobile phone.'
    )
    def patch(self, request):
        dev = request.developer
        name = request.data.get('name')
        if name and name.strip():
            dev.name = name.strip()

        phone_raw = request.data.get('phone')
        if phone_raw is not None:
            if phone_raw.strip():
                try:
                    dev.phone = validate_indian_mobile(phone_raw)
                except ValueError as ve:
                    return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
            else:
                dev.phone = None

        dev.save()
        return Response({
            'message': 'Developer profile updated successfully.',
            'developer': {
                'id': str(dev.id),
                'name': dev.name,
                'email': dev.email,
                'phone': dev.phone,
                'is_admin': dev.is_admin,
                'is_verified': dev.is_verified,
                'applications_count': dev.applications.count(),
                'created_at': dev.created_at
            }
        }, status=status.HTTP_200_OK)


class DeveloperChangePasswordView(APIView):
    """
    Allows authenticated developer to change their password by validating old password.
    """
    authentication_classes = [DeveloperTokenAuthentication]
    permission_classes = [IsDeveloperAuthenticated]

    @extend_schema(
        tags=['Developer Auth & Onboarding'],
        summary='Change Account Password',
        description='Validates old password and sets a new strong password.'
    )
    def post(self, request):
        dev = request.developer
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')

        if not old_password or not new_password:
            return Response({'error': 'Please provide both your current password and new password.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth.hashers import check_password
        if not check_password(old_password, dev.password):
            return Response({'error': 'Current password does not match.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_strong_password(new_password)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

        dev.set_password(new_password)
        dev.save()

        Notification.objects.create(
            developer=dev,
            title="Password Changed",
            message="Your account password was successfully updated from Developer Settings.",
            notification_type='INFO'
        )

        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)

