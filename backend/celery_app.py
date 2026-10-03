import os
from celery import Celery
from celery.schedules import crontab

def make_celery(app_name=__name__):
    broker_url = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    result_backend = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')

    celery = Celery(
        app_name,
        broker=broker_url,
        backend=result_backend,
        include=['tasks']
    )

    celery.conf.update(
        timezone='UTC',
        enable_utc=True,
        beat_schedule={
            'daily-deadline-reminders': {
                'task': 'tasks.send_daily_reminders',
                'schedule': crontab(hour=18, minute=0),  
            },
            'monthly-placement-report': {
                'task': 'tasks.generate_monthly_report',
                'schedule': crontab(day_of_month=1, hour=8, minute=0), 
            },
        }
    )

    return celery

celery_app = make_celery()
