from django.contrib import admin
from .models import Alert , UserLocation , AccessibilityReport 
# Register your models here.
admin.site.register(Alert)
admin.site.register(UserLocation)
admin.site.register(AccessibilityReport)