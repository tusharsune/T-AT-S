from django.urls import path
from api.views import (
    HealthCheckView,
    ChatExecutionView,
    ToolManagementView,
    PublicPlatformConfigView,
    AdminConfigView,
    AdminGovernanceDataView,
    AdminDeveloperStatusView,
    AdminGovernanceSecurityView,
    AdminGovernanceUnlockView,
    AdminSendOTPView,
    SystemStatusView,
    DeveloperRegisterView,
    LoginRequestOTPView,
    RecoverEmailView,
    VerifyOTPView,
    ResendOTPView,
    ForgotPasswordView,
    ResetPasswordView,
    DeveloperLoginView,
    DeveloperLogoutView,
    DeveloperMeView,
    DeveloperChangePasswordView,
    ApplicationListCreateView,
    ApplicationDetailView,
    ApplicationKeyRegenerateView,
    ApplicationSessionsView,
    EndUserConfigView,
    ApplicationUsageView,
    ApplicationAddBonusView,
    ApplicationUpgradeView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    NotificationDeleteView,
    NotificationClearAllView,
    RazorpayCreateOrderView,
    RazorpayVerifyView,
    RazorpayWebhookView,
    DeveloperBillingHistoryView
)

urlpatterns = [
    # Developer Authentication & Lifecycle
    path('auth/system-status/', SystemStatusView.as_view(), name='api-auth-system-status'),
    path('auth/register/', DeveloperRegisterView.as_view(), name='api-auth-register'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='api-auth-verify-otp'),
    path('auth/resend-otp/', ResendOTPView.as_view(), name='api-auth-resend-otp'),
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='api-auth-forgot-password'),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='api-auth-reset-password'),
    path('auth/recover-email/', RecoverEmailView.as_view(), name='api-auth-recover-email'),
    path('auth/login-request-otp/', LoginRequestOTPView.as_view(), name='api-auth-login-request-otp'),
    path('auth/login/', DeveloperLoginView.as_view(), name='api-auth-login'),
    path('auth/logout/', DeveloperLogoutView.as_view(), name='api-auth-logout'),
    path('auth/me/', DeveloperMeView.as_view(), name='api-auth-me'),
    path('auth/change-password/', DeveloperChangePasswordView.as_view(), name='api-auth-change-password'),

    # Developer Applications & API Key Management
    path('apps/', ApplicationListCreateView.as_view(), name='api-apps-list-create'),
    path('apps/<uuid:app_id>/', ApplicationDetailView.as_view(), name='api-apps-detail'),
    path('apps/<uuid:app_id>/regenerate-keys/', ApplicationKeyRegenerateView.as_view(), name='api-apps-regenerate-keys'),
    path('apps/<uuid:app_id>/sessions/', ApplicationSessionsView.as_view(), name='api-apps-sessions'),

    # Quota Metering, Bonus & Plan Upgrade
    path('apps/<uuid:app_id>/usage/', ApplicationUsageView.as_view(), name='api-apps-usage'),
    path('apps/<uuid:app_id>/add-bonus/', ApplicationAddBonusView.as_view(), name='api-apps-add-bonus'),
    path('apps/<uuid:app_id>/upgrade/', ApplicationUpgradeView.as_view(), name='api-apps-upgrade'),

    # Dynamic Real-Time Notifications
    path('notifications/', NotificationListView.as_view(), name='api-notifications-list'),
    path('notifications/<uuid:notification_id>/read/', NotificationMarkReadView.as_view(), name='api-notifications-read'),
    path('notifications/<uuid:notification_id>/delete/', NotificationDeleteView.as_view(), name='api-notifications-delete'),
    path('notifications/mark-all-read/', NotificationMarkAllReadView.as_view(), name='api-notifications-mark-all-read'),
    path('notifications/clear-all/', NotificationClearAllView.as_view(), name='api-notifications-clear-all'),

    # Razorpay Live / Test Payments & Subscriptions
    path('payments/create-order/', RazorpayCreateOrderView.as_view(), name='api-payments-create-order'),
    path('payments/verify/', RazorpayVerifyView.as_view(), name='api-payments-verify'),
    path('payments/webhook/', RazorpayWebhookView.as_view(), name='api-payments-webhook'),
    path('payments/history/', DeveloperBillingHistoryView.as_view(), name='api-payments-history'),

    # End-User Voice Preferences & Security
    path('users/<str:client_user_id>/config/', EndUserConfigView.as_view(), name='api-user-config'),

    # Keep-Alive & Health Monitor
    path('health/', HealthCheckView.as_view(), name='api-health'),

    # Core Agent Execution
    path('chat/', ChatExecutionView.as_view(), name='api-chat'),

    # Tool Registry Endpoints
    path('tools/', ToolManagementView.as_view(), name='api-tools-list'),
    path('tools/register/', ToolManagementView.as_view(), name='api-tools-register'),

    # Super Admin Dynamic Config & Platform Governance
    path('admin/config/', AdminConfigView.as_view(), name='api-admin-config'),
    path('platform-config/', PublicPlatformConfigView.as_view(), name='api-platform-config'),
    path('plans/', PublicPlatformConfigView.as_view(), name='api-plans'),
    path('admin/governance/', AdminGovernanceDataView.as_view(), name='api-admin-governance'),
    path('admin/governance/security/', AdminGovernanceSecurityView.as_view(), name='api-admin-gov-security'),
    path('admin/governance/unlock/', AdminGovernanceUnlockView.as_view(), name='api-admin-gov-unlock'),
    path('admin/governance/send-otp/', AdminSendOTPView.as_view(), name='api-admin-gov-send-otp'),
    path('admin/developers/<uuid:dev_id>/toggle-status/', AdminDeveloperStatusView.as_view(), name='api-admin-dev-status'),
]
