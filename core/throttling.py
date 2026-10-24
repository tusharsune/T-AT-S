from rest_framework.throttling import SimpleRateThrottle

class ApplicationRateThrottle(SimpleRateThrottle):
    """
    Throttles runtime requests per Application cluster.
    Free tier allows 60 req/min, Starter tier allows 300 req/min.
    """
    scope = 'application'

    def get_cache_key(self, request, view):
        app = getattr(request, 'application', None)
        if app:
            return f"throttle_app_{app.id}"
        return None

    def get_rate(self):
        # Fix #20 (PDF): Dynamically vary rate limit based on application's plan tier
        request = getattr(self, 'request', None)
        app = getattr(request, 'application', None) if request else None
        if app:
            tier = getattr(app, 'get_effective_plan_tier', lambda: getattr(app, 'plan_tier', 'FREE'))().upper()
            if tier == 'ENTERPRISE':
                return '600/minute'
            elif tier in ['GROWTH', 'STARTER']:
                return '300/minute'
        return '60/minute'


class BurstRateThrottle(SimpleRateThrottle):
    """
    Burst protection: Prevents infinite loops / flood attacks on application clusters.
    Limits to 10 requests per second.
    """
    scope = 'burst'

    def get_cache_key(self, request, view):
        app = getattr(request, 'application', None)
        if app:
            return f"throttle_burst_{app.id}"
        return None


    def get_rate(self):
        return '10/second'

