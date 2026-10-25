import os
from pathlib import Path
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-t-at-s-core-engine-key-2026-production-ready')
DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 't')
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*').split(',')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-Party Frameworks
    'rest_framework',
    'corsheaders',
    'drf_spectacular',
    
    # T@S Core Subsystems
    'core.apps.CoreConfig',
    'tools.apps.ToolsConfig',
    'agent.apps.AgentConfig',
    'api.apps.ApiConfig',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database Configuration: SQLite default for local zero-config, PostgreSQL/Supabase when configured
DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
if DATABASE_URL and (DATABASE_URL.startswith('postgres://') or DATABASE_URL.startswith('postgresql://')):
    try:
        import dj_database_url
        import urllib.parse

        # Sanitize password component if unescaped special characters (#, @, [, ], etc.) are present
        sanitized_url = DATABASE_URL
        if '://' in DATABASE_URL and '@' in DATABASE_URL:
            prefix, _, rest = DATABASE_URL.partition('://')
            userpass, _, hostpart = rest.rpartition('@')
            if ':' in userpass:
                user, _, password = userpass.partition(':')
                # Strip accidental outer brackets (e.g. from [YOUR-PASSWORD] placeholders)
                if password.startswith('[') and password.endswith(']'):
                    password = password[1:-1]
                safe_password = urllib.parse.quote(urllib.parse.unquote(password), safe='')
                sanitized_url = f"{prefix}://{user}:{safe_password}@{hostpart}"

        DATABASES = {
            'default': dj_database_url.parse(
                sanitized_url,
                conn_max_age=600,
                conn_health_checks=True,
                ssl_require=True
            )
        }
    except Exception as db_err:
        import logging
        logging.getLogger(__name__).error(f"[T@S Database Error] Invalid DATABASE_URL ({db_err}). Falling back to SQLite.")
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom High-Scale Enterprise Auth User Model
AUTH_USER_MODEL = 'core.Developer'


# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    # Fix #14: Wire throttle classes so rate limiting actually activates.
    'DEFAULT_THROTTLE_CLASSES': [
        'core.throttling.BurstRateThrottle',
        'core.throttling.ApplicationRateThrottle',
    ],

    'DEFAULT_THROTTLE_RATES': {
        'burst': '60/min',
        'sustained': '1000/day',
        # Per-plan rates (used by per-plan throttle classes in core/throttling.py)
        'free': '60/min',
        'growth': '300/min',
        'enterprise': '600/min',
    },
}

# Cache backend — required for DRF throttling to store request counts
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'tats-throttle-cache',
    }
}


# Swagger / OpenAPI 3.0 Documentation Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'T@S (Talk. Decide. Solve.) Acoustic Action Engine API',
    'DESCRIPTION': 'Universal AI Voice Agent Platform — OpenAPI 3.0 Interactive Specification. Test runtime chat, tool registries, keep-alive health probes, developer onboarding, and dynamic platform administration.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
        'displayOperationId': True,
    },
    'APPEND_COMPONENTS': {
        'securitySchemes': {
            'ApiKeyAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'tas_live_*',
                'description': 'Bearer tas_live_... for Application & Agent Chat calls.'
            },
            'DevTokenAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'tas_dev_*',
                'description': 'Bearer tas_dev_... for Developer account & app administration.'
            }
        }
    },
    'SECURITY': [
        {'ApiKeyAuth': []},
        {'DevTokenAuth': []},
    ]
}

# CORS Configuration
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'True').lower() in ('true', '1', 't')
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173').split(',')
    if origin.strip()
]
CORS_ALLOW_HEADERS = [
    'authorization',
    'content-type',
    'x-user-id',
    'x-service-key',
    'x-api-key',
    'x-developer-token',
    'accept',
    'origin',
]

# T@S Core Agent Settings
T_AT_S = {
    'GROQ_API_KEY': os.getenv('GROQ_API_KEY', ''),
    'DEFAULT_MODEL': os.getenv('DEFAULT_MODEL', 'llama-3.3-70b-versatile'),
    'FALLBACK_MODEL': os.getenv('FALLBACK_MODEL', 'llama-3.1-8b-instant'),
    'OLLAMA_BASE_URL': os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
    'DISPATCH_TIMEOUT_SECONDS': 4.0,
    'SILENT_RETRY_TIMEOUT_SECONDS': 1.5,
    'DEFAULT_SESSION_TIMEOUT_MINUTES': 3,
}

# Structured Application Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} [{name}:{lineno}] {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': os.getenv('LOG_LEVEL', 'INFO'),
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'api': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'agent': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'core': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}


# Email Configuration (for OTP Verification & Password Reset)
# Automatically uses SMTP when EMAIL_HOST_USER is set; safely falls back to Console in dev
_raw_email_user = os.getenv('EMAIL_HOST_USER', '').strip()
_email_host = os.getenv('EMAIL_HOST', 'smtp.gmail.com').strip()

if _raw_email_user and '@' not in _raw_email_user and 'gmail' in _email_host.lower():
    _raw_email_user = f"{_raw_email_user}@gmail.com"

EMAIL_BACKEND = os.getenv(
    'EMAIL_BACKEND',
    'django.core.mail.backends.smtp.EmailBackend' if _raw_email_user else 'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = _email_host
_email_port = int(os.getenv('EMAIL_PORT', 587))
EMAIL_PORT = _email_port
# If port is 465, use direct SSL. Otherwise if port 587, use TLS.
if _email_port == 465:
    EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'True').lower() in ('true', '1', 't')
    EMAIL_USE_TLS = False
else:
    EMAIL_USE_SSL = False
    EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 't')
EMAIL_HOST_USER = _raw_email_user
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '').strip().replace(' ', '')
EMAIL_TIMEOUT = 10

from email.utils import formataddr
_default_from = os.getenv('DEFAULT_FROM_EMAIL', '').strip()
if EMAIL_HOST_USER and ('gmail' in _email_host.lower() or not _default_from):
    DEFAULT_FROM_EMAIL = formataddr(('T @ S', EMAIL_HOST_USER))
else:
    DEFAULT_FROM_EMAIL = _default_from or formataddr(('T @ S', 'noreply@tats.ai'))

# Razorpay Payment Gateway Settings
RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET', '')
RAZORPAY_WEBHOOK_SECRET = os.getenv('RAZORPAY_WEBHOOK_SECRET', '')

# Session History Storage Limit (Auto-delete older sessions beyond 300 per application)
MAX_SESSION_HISTORY_PER_APP = int(os.getenv('MAX_SESSION_HISTORY_PER_APP', 300))



