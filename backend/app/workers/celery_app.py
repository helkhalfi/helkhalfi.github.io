import os
from celery import Celery

celery_app = Celery(
    "swiftsend",
    broker=os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/1"),
    backend=os.environ.get("CELERY_RESULT_BACKEND", "redis://redis:6379/2"),
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.tasks.process_transfer": {"queue": "transfers"},
        "app.workers.tasks.rate_refresh": {"queue": "rates"},
    },
    beat_schedule={
        "refresh-rates-every-5-min": {
            "task": "app.workers.tasks.rate_refresh",
            "schedule": 300.0,
            "args": (["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "SGD"],),
        }
    },
)
