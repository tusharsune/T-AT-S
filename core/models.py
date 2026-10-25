import uuid
import hashlib
import secrets
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager


class DeveloperManager(BaseUserManager):
    """
    Custom user model manager for T@S Platform Developers.
    Supports email-based authentication with high-concurrency ACID guarantees.
    """
    def create_user(self, email, name="Developer", phone=None, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set.")
        email = self.normalize_email(email).lower().strip()
        user = self.model(email=email, name=name, phone=phone, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name="Platform Administrator", phone=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_admin', True)
        extra_fields.setdefault('is_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, name=name, phone=phone, password=password, **extra_fields)


class Developer(AbstractBaseUser, PermissionsMixin):
    """
    Custom High-Scale Enterprise Auth User Model for T@S (Talk. Decide. Solve.).
    Designed for 10K+ daily concurrent users with strict ACID properties and fast indexing.
    Inherits from AbstractBaseUser and PermissionsMixin.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, default="Developer")
    email = models.EmailField(unique=True, db_index=True, max_length=255)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True, help_text="Indian mobile number e.g. +91 9876543210")
    is_admin = models.BooleanField(default=False, db_index=True, help_text="Designated platform administrator")
    is_verified = models.BooleanField(default=False, db_index=True, help_text="Verified via email OTP")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    governance_auth_method = models.CharField(
        max_length=30,
        default='PASSWORD',
        choices=[
            ('PASSWORD', 'Master Password'),
            ('OTP', 'Email OTP'),
            ('SAVE_CODES', 'Save / Backup Codes')
        ],
        help_text="Verification check required during Platform Governance access"
    )
    governance_save_codes = models.JSONField(
        default=list,
        blank=True,
        help_text="Single-use emergency recovery backup codes for Platform Governance unlock"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Custom related_name to eliminate any collision with default auth models
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='developer_groups',
        blank=True,
        help_text='The groups this developer belongs to.'
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='developer_user_permissions',
        blank=True,
        help_text='Specific permissions for this developer.'
    )

    objects = DeveloperManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        verbose_name = 'Developer'
        verbose_name_plural = 'Developers'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['phone']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        role_label = " [ADMIN]" if self.is_admin else ""
        return f"{self.name} ({self.email}){role_label}"

    @property
    def password_hash(self):
        return self.password

    @password_hash.setter
    def password_hash(self, val):
        self.password = val


class DeveloperToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(Developer, on_delete=models.CASCADE, related_name='tokens')
    key = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Token for {self.developer.email}"

    def is_expired(self, expiry_days: int = 30) -> bool:
        from django.utils import timezone
        from datetime import timedelta
        return timezone.now() - self.created_at > timedelta(days=expiry_days)

    @classmethod
    def generate(cls, developer):
        raw_key = f"tas_dev_{uuid.uuid4().hex}"
        return cls.objects.create(developer=developer, key=raw_key)


class Application(models.Model):
    WAKE_WORD_POLICY_CHOICES = [
        ('LOCKED', 'Locked to App Name'),
        ('CUSTOM', 'Allow End-User Custom'),
    ]
    PLAN_TIER_CHOICES = [
        ('FREE', 'Developer Free (2,000 units/mo)'),
        ('GROWTH', 'Growth Startup (50,000 units/mo)'),
        ('ENTERPRISE', 'Scale Enterprise (250,000 units/mo)'),
        ('STARTER', 'Starter Tier (Legacy)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(Developer, on_delete=models.CASCADE, related_name='applications')
    app_name = models.CharField(max_length=100)
    base_url = models.URLField(max_length=255, help_text="Root API URL of the developer application")
    service_key_hash = models.CharField(max_length=255)
    wake_word_policy = models.CharField(max_length=20, choices=WAKE_WORD_POLICY_CHOICES, default='CUSTOM')
    plan_tier = models.CharField(max_length=20, choices=PLAN_TIER_CHOICES, default='FREE')
    plan_expires_at = models.DateTimeField(null=True, blank=True, help_text="Expiry date for active paid subscription plans")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def get_effective_plan_tier(self) -> str:
        """Returns active plan tier, auto-reverting to FREE if subscription duration has lapsed."""
        if self.plan_tier in ['GROWTH', 'ENTERPRISE'] and self.plan_expires_at:
            if timezone.now() > self.plan_expires_at:
                return 'FREE'
        return self.plan_tier

    def __str__(self):

        return f"{self.app_name} ({self.developer.email})"

    @staticmethod
    def hash_key(raw_key: str) -> str:
        return hashlib.sha256(raw_key.strip().encode('utf-8')).hexdigest()

    def verify_service_key(self, raw_key: str) -> bool:
        return self.service_key_hash == self.hash_key(raw_key)

    @classmethod
    def create_with_keys(cls, developer, app_name: str, base_url: str, wake_word_policy: str = 'CUSTOM'):
        raw_service_key = f"tas_srv_{uuid.uuid4().hex}"
        service_key_hash = cls.hash_key(raw_service_key)
        app = cls.objects.create(
            developer=developer,
            app_name=app_name,
            base_url=base_url,
            service_key_hash=service_key_hash,
            wake_word_policy=wake_word_policy,
            is_active=True
        )
        api_key_obj, raw_api_key = APIKey.generate_for_app(app)
        return app, raw_api_key, raw_service_key


class APIKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='api_keys')
    key_prefix = models.CharField(max_length=16, help_text="e.g. tas_live_a89...")
    key_hash = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"APIKey {self.key_prefix}... for {self.application.app_name}"

    @classmethod
    def generate_for_app(cls, application: Application):
        raw_key = f"tas_live_{uuid.uuid4().hex}"
        key_prefix = raw_key[:14]
        key_hash = hashlib.sha256(raw_key.encode('utf-8')).hexdigest()
        instance = cls.objects.create(
            application=application,
            key_prefix=key_prefix,
            key_hash=key_hash,
            is_active=True
        )
        return instance, raw_key


class EndUserConfig(models.Model):
    VOICE_TIER_CHOICES = [
        ('BROWSER', 'Browser Built-in (Free)'),
        ('LIBRARY', 'Curated Studio Library (Aura)'),
        ('CLONED', 'Zero-Shot 6-Sec Cloned'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='end_users')
    client_user_id = models.CharField(max_length=100, help_text="User ID passed by client app")
    wake_word = models.CharField(max_length=60, default="Hey T@S")
    passphrase_hash = models.CharField(max_length=255, blank=True, null=True)
    voice_tier = models.CharField(max_length=20, choices=VOICE_TIER_CHOICES, default='BROWSER')
    voice_vector = models.JSONField(blank=True, null=True, help_text="Latent embedding vector for voice cloning")
    last_active = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('application', 'client_user_id')

    def __str__(self):
        return f"User {self.client_user_id} @ {self.application.app_name}"


class SessionHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='sessions')
    session_id = models.CharField(max_length=100, db_index=True)
    client_user_id = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=[('user', 'User'), ('assistant', 'Assistant'), ('system', 'System')])
    content = models.TextField()
    tool_name = models.CharField(max_length=100, blank=True, null=True)
    tool_payload = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.session_id}] {self.role}: {self.content[:40]}"

    @classmethod
    def prune_old_sessions(cls, application=None, max_keep: int = 300):
        """
        Keeps only the newest `max_keep` session history entries for the specified application
        (or across all applications if application is None),
        automatically purging older records to conserve database storage.
        """
        if max_keep is None or max_keep <= 0:
            from django.conf import settings
            max_keep = getattr(settings, 'MAX_SESSION_HISTORY_PER_APP', 300)

        deleted_total = 0
        try:
            if application:
                total_count = cls.objects.filter(application=application).count()
                if total_count > max_keep:
                    excess_ids = list(
                        cls.objects.filter(application=application)
                        .order_by('-created_at')
                        .values_list('id', flat=True)[max_keep:]
                    )
                    if excess_ids:
                        cnt, _ = cls.objects.filter(id__in=excess_ids).delete()
                        deleted_total += cnt
            else:
                from core.models import Application
                for app in Application.objects.all():
                    deleted_total += cls.prune_old_sessions(application=app, max_keep=max_keep)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Error auto-pruning SessionHistory: {e}")
        return deleted_total

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new and self.application_id:
            from django.conf import settings
            max_keep = getattr(settings, 'MAX_SESSION_HISTORY_PER_APP', 300)
            SessionHistory.prune_old_sessions(application=self.application, max_keep=max_keep)


class UsageMeter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='usage_meters')
    month_year = models.CharField(max_length=7, help_text="Format: YYYY-MM")
    units_consumed = models.PositiveIntegerField(default=0)
    bonus_units = models.PositiveIntegerField(default=0)
    text_units_consumed = models.PositiveIntegerField(default=0)
    voice_units_consumed = models.PositiveIntegerField(default=0)
    tool_units_consumed = models.PositiveIntegerField(default=0)
    requests_count = models.PositiveIntegerField(default=0)
    tools_executed_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('application', 'month_year')

    def __str__(self):
        return f"{self.application.app_name} - {self.month_year}: {self.units_consumed} units"

    def record_usage(
        self,
        is_voice: bool,
        tool_executed: bool,
        text_multiplier: float = 1.0,
        voice_multiplier: float = 2.0,
        tool_multiplier: float = 3.0
    ) -> int:
        base_units = int(voice_multiplier if is_voice else text_multiplier)
        tool_units = int(tool_multiplier) if tool_executed else 0
        total = base_units + tool_units

        from django.db.models import F

        updates = {
            'units_consumed': F('units_consumed') + total,
            'requests_count': F('requests_count') + 1,
        }
        if is_voice:
            updates['voice_units_consumed'] = F('voice_units_consumed') + base_units
        else:
            updates['text_units_consumed'] = F('text_units_consumed') + base_units

        if tool_executed:
            updates['tool_units_consumed'] = F('tool_units_consumed') + tool_units
            updates['tools_executed_count'] = F('tools_executed_count') + 1

        UsageMeter.objects.filter(pk=self.pk).update(**updates)
        self.refresh_from_db()
        return total


    def get_quota_status(self, platform_config=None) -> dict:
        if platform_config is None:
            platform_config = PlatformConfig.get_active()

        effective_tier = self.application.get_effective_plan_tier()
        if effective_tier == 'FREE':
            plan_quota = platform_config.free_tier_units
        elif effective_tier == 'ENTERPRISE':
            plan_quota = platform_config.enterprise_tier_units
        else:
            plan_quota = platform_config.growth_tier_units

        base_quota = plan_quota + self.bonus_units
        grace_buffer_pct = platform_config.grace_buffer_pct
        grace_limit = int(base_quota * (1 + grace_buffer_pct / 100))
        remaining = max(0, base_quota - self.units_consumed)
        is_grace_active = (base_quota < self.units_consumed <= grace_limit)
        is_exhausted = (self.units_consumed >= grace_limit)

        return {
            'month': self.month_year,
            'plan_tier': effective_tier,

            'units_consumed': self.units_consumed,
            'base_quota': base_quota,
            'bonus_units': self.bonus_units,
            'units_remaining': remaining,
            'grace_buffer_pct': grace_buffer_pct,
            'grace_limit': grace_limit,
            'grace_buffer_active': is_grace_active,
            'is_exhausted': is_exhausted,
            'breakdown': {
                'text_units': self.text_units_consumed,
                'voice_units': self.voice_units_consumed,
                'tool_units': self.tool_units_consumed,
                'total_requests': self.requests_count,
                'tools_executed': self.tools_executed_count
            }
        }



class PlatformConfig(models.Model):
    """Singleton model controlled dynamically by Super Admin."""
    starter_price_inr = models.PositiveIntegerField(default=1999)
    growth_price_inr = models.PositiveIntegerField(default=1999)
    enterprise_price_inr = models.PositiveIntegerField(default=14999)
    free_tier_units = models.PositiveIntegerField(default=2000)
    growth_tier_units = models.PositiveIntegerField(default=50000)
    enterprise_tier_units = models.PositiveIntegerField(default=250000)
    grace_buffer_pct = models.PositiveIntegerField(default=10)
    cost_per_extra_unit = models.DecimalField(max_digits=6, decimal_places=4, default=0.0400)
    text_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.0)
    voice_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=2.0)
    tool_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=3.0)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_active(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    def save(self, *args, **kwargs):
        # Keep starter_price_inr and growth_price_inr synchronized
        if self.growth_price_inr and self.starter_price_inr != self.growth_price_inr:
            self.starter_price_inr = self.growth_price_inr
        elif self.starter_price_inr and not self.growth_price_inr:
            self.growth_price_inr = self.starter_price_inr
        super().save(*args, **kwargs)

    def __str__(self):
        return f"PlatformConfig (Free: {self.free_tier_units} units, Growth: INR {self.growth_price_inr or self.starter_price_inr}, Enterprise: INR {self.enterprise_price_inr})"


class EmailOTPVerification(models.Model):
    PURPOSE_CHOICES = [
        ('REGISTER', 'Registration Verification'),
        ('LOGIN', 'Login Verification'),
        ('FORGOT_PASSWORD', 'Password Reset'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(db_index=True)
    otp_hash = models.CharField(max_length=255)
    purpose = models.CharField(max_length=30, choices=PURPOSE_CHOICES, default='REGISTER')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def __str__(self):
        return f"OTP for {self.email} ({self.purpose}) - Used: {self.is_used}"

    @classmethod
    def create_and_send(cls, email: str, purpose: str = 'REGISTER'):
        import random
        from datetime import timedelta
        from django.core.mail import send_mail
        from django.conf import settings
        from django.contrib.auth.hashers import make_password

        # Generate 6-digit cryptographic-grade secure OTP
        raw_otp = f"{secrets.randbelow(900000) + 100000}"
        otp_hash = make_password(raw_otp)
        expires_at = timezone.now() + timedelta(minutes=10)

        # Invalidate old unused OTPs for this email and purpose
        cls.objects.filter(email=email.lower().strip(), purpose=purpose, is_used=False).update(is_used=True)

        instance = cls.objects.create(
            email=email.lower().strip(),
            otp_hash=otp_hash,
            purpose=purpose,
            expires_at=expires_at,
            is_used=False
        )

        purpose_labels = {
            'REGISTER': ('Developer Account Activation', 'Verify and activate your new developer workspace on T-AT-S.'),
            'LOGIN': ('Developer Portal Authentication', 'Authorize your secure sign-in to the T-AT-S developer portal.'),
            'FORGOT_PASSWORD': ('Password Recovery Request', 'Reset your password and restore access to your account.'),
            'ADMIN_ACCESS': ('Platform Governance Authorization', 'Verify your SuperAdmin credential to unlock governance.'),
        }
        purpose_title, purpose_desc = purpose_labels.get(purpose, ('Developer Verification Code', 'Authenticate your session on T-AT-S.'))

        subject_map = {
            'REGISTER': 'Verify your T @ S Account - Verification Code',
            'LOGIN': 'Your T @ S Login Verification Code',
            'FORGOT_PASSWORD': 'Reset your T @ S Password - Verification Code',
        }
        subject = subject_map.get(purpose, f'T @ S Verification Code: {raw_otp}')

        plain_message = (
            f"T @ S (Talk. Decide. Solve.) — Autonomous Telephony System\n"
            f"===========================================================\n\n"
            f"{purpose_title}\n"
            f"{purpose_desc}\n\n"
            f"Your 6-Digit Verification Code is:\n"
            f">>>  {raw_otp}  <<<\n\n"
            f"• This code will expire in 10 minutes.\n"
            f"• For security, never share this code with anyone.\n"
            f"• If you did not request this, please disregard this email.\n\n"
            f"Account: {email}\n"
            f"Generated: {timezone.now().strftime('%d %b %Y, %H:%M UTC')}\n\n"
            f"— The T @ S Platform Engineering Team\n"
            f"Support: ts.help2407@gmail.com\n"
        )

        formatted_otp_spaced = " ".join(list(raw_otp))

        html_message = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>
    body {{ margin: 0; padding: 0; background-color: #FAF9F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1D1A23; }}
    .wrapper {{ width: 100%; max-width: 600px; margin: 30px auto; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #FFE6DC; box-shadow: 0 10px 30px rgba(165,59,34,0.06); }}
    .header {{ background: linear-gradient(135deg, #FF7E5F 0%, #FF5F45 50%, #A53B22 100%); padding: 36px 32px 32px; text-align: center; color: #FFFFFF; }}
    .logo-badge {{ display: inline-block; padding: 6px 14px; background: rgba(255, 255, 255, 0.2); border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.35); }}
    .brand-title {{ margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; }}
    .brand-tagline {{ margin: 6px 0 0; font-size: 12px; font-weight: 500; opacity: 0.92; letter-spacing: 0.5px; }}
    .body-content {{ padding: 36px 32px; }}
    .greeting {{ font-size: 17px; font-weight: 700; color: #1D1A23; margin-top: 0; }}
    .intro-text {{ font-size: 14px; line-height: 1.6; color: #57423D; margin: 10px 0 24px; }}
    .otp-card {{ background: #FAF9F6; border: 2px solid #FF7E5F; border-radius: 20px; padding: 28px 20px; text-align: center; margin: 24px 0; }}
    .otp-label {{ font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #845400; margin-bottom: 8px; }}
    .otp-digits {{ font-family: 'SF Mono', Consolas, Monaco, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #A53B22; margin: 6px 0; }}
    .otp-expiry {{ font-size: 12px; color: #8B716B; margin-top: 8px; font-weight: 500; }}
    .security-note {{ background: #FFF8EB; border-left: 4px solid #FFAE33; border-radius: 8px; padding: 14px 16px; margin: 24px 0 10px; font-size: 12px; line-height: 1.5; color: #854D0E; }}
    .meta-table {{ width: 100%; margin-top: 24px; border-top: 1px solid #FFE6DC; padding-top: 18px; font-size: 12px; color: #8B716B; }}
    .meta-row {{ padding: 3px 0; }}
    .footer {{ background: #FAF9F6; padding: 24px 32px; text-align: center; font-size: 11px; color: #8B716B; border-top: 1px solid #FFE6DC; line-height: 1.6; }}
    .footer-links a {{ color: #A53B22; text-decoration: none; font-weight: 600; margin: 0 8px; }}
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="wrapper">
      <div class="header">
        <div class="logo-badge">Autonomous Telephony Platform</div>
        <h1 class="brand-title">T @ S</h1>
        <p class="brand-tagline">Talk. Decide. Solve. &middot; Voice Agentic Intelligence</p>
      </div>

      <div class="body-content">
        <h2 class="greeting">Hello Developer,</h2>
        <p class="intro-text">
          A request was initiated for <strong>{purpose_title}</strong> on your account. Use the secure 6-digit one-time verification passcode below to complete authentication:
        </p>

        <div class="otp-card">
          <div class="otp-label">One-Time Verification Code</div>
          <div class="otp-digits">{formatted_otp_spaced}</div>
          <div class="otp-expiry">&#9201; Expires in <strong>10 minutes</strong> &middot; Single use only</div>
        </div>

        <div class="security-note">
          <strong>Security Notice:</strong> Never share this code with anyone. T @ S engineers and platform operators will never request your verification passcode via email, telephone, or Discord.
        </div>

        <table class="meta-table" cellpadding="0" cellspacing="0">
          <tr>
            <td class="meta-row"><strong>Target Account:</strong></td>
            <td class="meta-row" align="right"><code>{email}</code></td>
          </tr>
          <tr>
            <td class="meta-row"><strong>Purpose:</strong></td>
            <td class="meta-row" align="right">{purpose_title}</td>
          </tr>
          <tr>
            <td class="meta-row"><strong>Timestamp:</strong></td>
            <td class="meta-row" align="right">{timezone.now().strftime('%d %b %Y, %H:%M UTC')}</td>
          </tr>
        </table>
      </div>

      <div class="footer">
        <div class="footer-links">
          <a href="https://tats.ai">Developer Portal</a> &bull;
          <a href="https://tats.ai/docs">API Documentation</a> &bull;
          <a href="mailto:ts.help2407@gmail.com">Engineering Support</a>
        </div>
        <p style="margin: 10px 0 0;">
          T @ S (Talk. Decide. Solve.) &middot; High-Throughput Sub-850ms Voice AI Infrastructure<br>
          Sent to {email} &middot; If you did not initiate this request, you can safely ignore this email.
        </p>
      </div>
    </div>
  </div>
</body>
</html>"""

        import threading
        from email.utils import parseaddr, formataddr

        def _dispatch_mail_async():
            import os
            import json
            import urllib.request
            import logging
            logger = logging.getLogger(__name__)

            # Option 1: Vercel Mail Proxy (HTTPS Port 443 - Uses Gmail SMTP via Vercel Serverless Function)
            proxy_url = os.getenv('MAIL_PROXY_URL', 'https://t-at-s.vercel.app/api/send-otp').strip()
            proxy_secret = os.getenv('MAIL_PROXY_SECRET', 'tas_proxy_secret_key_2026').strip()
            if proxy_url:
                try:
                    payload = {
                        "secret": proxy_secret,
                        "to": email,
                        "subject": subject,
                        "text": plain_message,
                        "html": html_message
                    }
                    req = urllib.request.Request(
                        proxy_url,
                        data=json.dumps(payload).encode('utf-8'),
                        headers={
                            "Content-Type": "application/json",
                            "x-proxy-secret": proxy_secret,
                            "User-Agent": "TATS-Backend/1.0"
                        },
                        method="POST"
                    )
                    with urllib.request.urlopen(req, timeout=12) as resp:
                        if resp.status in (200, 201):
                            logger.info(f"[T@S Email] OTP successfully dispatched to {email} via Vercel Gmail Proxy")
                            return
                except urllib.error.HTTPError as http_err:
                    err_body = http_err.read().decode('utf-8', errors='ignore')
                    logger.warning(f"[T@S Email] Vercel Proxy returned {http_err.code}: {err_body}, trying SMTP fallback...")
                except Exception as ex:
                    logger.warning(f"[T@S Email] Vercel Proxy request failed ({ex}), trying SMTP fallback...")

            # Option 2: Fallback to direct Django send_mail (SMTP)
            try:
                raw_from = getattr(settings, 'DEFAULT_FROM_EMAIL', '"T @ S" <noreply@tats.ai>')
                parsed_name, parsed_addr = parseaddr(raw_from)
                from_email = formataddr((parsed_name or 'T @ S', parsed_addr or 'noreply@tats.ai'))
                send_mail(
                    subject=subject,
                    message=plain_message,
                    from_email=from_email,
                    recipient_list=[email],
                    html_message=html_message,
                    fail_silently=False
                )
                logger.info(f"[T@S Email] OTP successfully dispatched to {email} via direct SMTP")
            except Exception as e:
                logger.error(
                    f"[T@S Email Error] Failed to send email via SMTP ({e}). Fallback verification OTP: {raw_otp} for {email}"
                )

        threading.Thread(target=_dispatch_mail_async, daemon=True, name=f"EmailOTPThread-{email}").start()

        return instance, raw_otp

    @classmethod
    def verify_code(cls, email: str, raw_code: str, purpose: str = 'REGISTER') -> bool:
        # Whitelisted test reviewer account for Razorpay / QA verification
        if email.lower().strip() == 'demo@tats.ai' and raw_code.strip() in ('123456', '000000'):
            return True

        from django.contrib.auth.hashers import check_password
        now = timezone.now()
        records = cls.objects.filter(
            email=email.lower().strip(),
            purpose=purpose,
            is_used=False,
            expires_at__gte=now
        ).order_by('-created_at')

        for record in records:
            if check_password(raw_code.strip(), record.otp_hash):
                record.is_used = True
                record.save()
                return True
        return False


class Notification(models.Model):
    TYPE_CHOICES = [
        ('INFO', 'Information'),
        ('SUCCESS', 'Success'),
        ('WARNING', 'Warning'),
        ('BILLING', 'Billing & Usage'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(Developer, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=150)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='INFO')
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] {self.title} for {self.developer.email}"


class PaymentOrder(models.Model):
    STATUS_CHOICES = [
        ('CREATED', 'Order Created'),
        ('PAID', 'Payment Captured & Verified'),
        ('FAILED', 'Payment Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(Developer, on_delete=models.CASCADE, related_name='payment_orders')
    application = models.ForeignKey(Application, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    plan_tier = models.CharField(max_length=50, default='GROWTH_STARTUP')
    razorpay_order_id = models.CharField(max_length=100, unique=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True, null=True)
    razorpay_signature = models.CharField(max_length=255, blank=True, null=True)
    amount = models.PositiveIntegerField(help_text="Amount in paise (e.g. 499900 = INR 4,999)")
    currency = models.CharField(max_length=10, default='INR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CREATED')
    units_credited = models.PositiveIntegerField(default=50000)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Razorpay Order {self.razorpay_order_id} ({self.status}) - ₹{self.amount / 100}"



