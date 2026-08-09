"""
routes/health_routes.py

GET /        - basic "is the server up" landing route
GET /health  - structured health check, useful for uptime monitors and
               for the frontend to ping before showing a "backend offline"
               banner during dev.

These two live OUTSIDE the /api prefix on purpose (see app.py) — health
checks are infrastructure-level, not part of the versioned API surface.
"""

from flask import Blueprint
from utils.response_helper import success_response

health_bp = Blueprint("health", __name__)


@health_bp.route("/", methods=["GET"])
def index():
    return success_response(
        data={"service": "LearnMatrix Backend"},
        message="LearnMatrix API is running.",
    )


@health_bp.route("/health", methods=["GET"])
def health_check():
    return success_response(
        data={"status": "healthy"},
        message="Health check passed.",
    )
