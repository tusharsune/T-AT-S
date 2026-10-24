from django.contrib import admin
from .models import (
    Developer, Application, APIKey, EndUserConfig, SessionHistory,
    UsageMeter, PlatformConfig, Notification, PaymentOrder, DeveloperToken
)
from tools.models import RegisteredTool

@admin.register(Developer)
class DeveloperAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'is_admin', 'is_staff', 'is_active', 'created_at')
    search_fields = ('name', 'email')
    list_filter = ('is_admin', 'is_staff', 'is_active')

@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ('app_name', 'developer', 'plan_tier', 'plan_expires_at', 'base_url', 'wake_word_policy', 'is_active', 'created_at')
    list_filter = ('plan_tier', 'wake_word_policy', 'is_active')
    search_fields = ('app_name', 'developer__email')

@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ('key_prefix', 'application', 'is_active', 'created_at')
    list_filter = ('is_active',)

@admin.register(DeveloperToken)
class DeveloperTokenAdmin(admin.ModelAdmin):
    list_display = ('developer', 'created_at')
    search_fields = ('developer__email',)

@admin.register(EndUserConfig)
class EndUserConfigAdmin(admin.ModelAdmin):
    list_display = ('client_user_id', 'application', 'wake_word', 'voice_tier', 'last_active')
    list_filter = ('voice_tier',)
    search_fields = ('client_user_id', 'wake_word')

@admin.register(RegisteredTool)
class RegisteredToolAdmin(admin.ModelAdmin):
    list_display = ('name', 'application', 'method', 'endpoint', 'is_active')
    list_filter = ('method', 'is_active')
    search_fields = ('name', 'endpoint')

@admin.register(SessionHistory)
class SessionHistoryAdmin(admin.ModelAdmin):
    list_display = ('session_id', 'client_user_id', 'role', 'tool_name', 'created_at')
    list_filter = ('role', 'tool_name')

@admin.register(UsageMeter)
class UsageMeterAdmin(admin.ModelAdmin):
    list_display = ('application', 'month_year', 'units_consumed', 'bonus_units')
    list_filter = ('month_year',)

@admin.register(PlatformConfig)
class PlatformConfigAdmin(admin.ModelAdmin):
    list_display = ('growth_price_inr', 'enterprise_price_inr', 'free_tier_units', 'grace_buffer_pct', 'cost_per_extra_unit', 'updated_at')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('developer', 'title', 'notification_type', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read')
    search_fields = ('title', 'developer__email')

@admin.register(PaymentOrder)
class PaymentOrderAdmin(admin.ModelAdmin):
    list_display = ('razorpay_order_id', 'developer', 'application', 'plan_tier', 'amount', 'currency', 'status', 'created_at')
    list_filter = ('status', 'plan_tier')
    search_fields = ('razorpay_order_id', 'razorpay_payment_id', 'developer__email')

