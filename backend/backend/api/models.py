from django.db import models



class Alert(models.Model):
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    coordinates = models.JSONField()  
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return self.title



class UserLocation(models.Model):
    user_id = models.CharField(max_length=100)
    coordinates = models.JSONField()  # [lon, lat]
    timestamp = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user_id} - {self.timestamp}"

class AccessibilityReport(models.Model):
    category = models.CharField(max_length=50, choices=[
        ('ramp', 'Ramp'),
        ('button', 'Push Button'),
        ('elevator', 'Elevator'),
        ('path', 'Path'),
        ('other', 'Other'),
    ])
    description = models.TextField(blank=True, null=True)
    coordinates = models.JSONField()  
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.category} - {self.created_at.strftime('%Y-%m-%d')}"
