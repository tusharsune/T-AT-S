from django.db import migrations
from django.contrib.auth.hashers import make_password
import hashlib
import uuid


def create_reviewer_account(apps, schema_editor):
    Developer = apps.get_model('core', 'Developer')
    Application = apps.get_model('core', 'Application')
    APIKey = apps.get_model('core', 'APIKey')

    email = 'demo@tats.ai'
    dev = Developer.objects.filter(email=email).first()

    if not dev:
        dev = Developer.objects.create(
            email=email,
            name='Razorpay Test Reviewer',
            phone='+919876543210',
            password=make_password('Demo@TATS2026!'),
            is_admin=False,
            is_staff=False,
            is_superuser=False,
            is_verified=True,
            is_active=True
        )
    else:
        dev.password = make_password('Demo@TATS2026!')
        dev.is_verified = True
        dev.is_active = True
        dev.is_admin = False
        dev.is_staff = False
        dev.is_superuser = False
        dev.save()

    # Ensure an application cluster exists for this reviewer
    app = Application.objects.filter(developer=dev).first()
    if not app:
        raw_service_key = f"tas_srv_{uuid.uuid4().hex}"
        srv_hash = hashlib.sha256(raw_service_key.encode('utf-8')).hexdigest()
        app = Application.objects.create(
            developer=dev,
            app_name='Demo Sandbox Cluster',
            base_url='https://api.acme.app',
            wake_word_policy='CUSTOM',
            plan_tier='FREE',
            is_active=True,
            service_key_hash=srv_hash
        )

        raw_api_key = f"tas_live_{uuid.uuid4().hex}"
        APIKey.objects.create(
            application=app,
            key_prefix=raw_api_key[:14],
            key_hash=hashlib.sha256(raw_api_key.encode('utf-8')).hexdigest(),
            is_active=True
        )


def remove_reviewer_account(apps, schema_editor):
    Developer = apps.get_model('core', 'Developer')
    Developer.objects.filter(email='demo@tats.ai').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_application_plan_expires_at'),
    ]

    operations = [
        migrations.RunPython(create_reviewer_account, remove_reviewer_account),
    ]
