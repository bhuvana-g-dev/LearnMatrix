"""
app.py

Flask application entrypoint.

Responsibilities ONLY:
  - Create the Flask app
  - Enable CORS for the React frontend
  - Register blueprints (routes)
  - Run the dev server

No route logic, no business logic, no Firebase/pandas calls live here.
That separation is what "production-level architecture" means in practice:
this file should stay this short even after Gemini, Scikit-Learn, and
Firestore are all wired in.
"""

import logging

from flask import Flask
from flask_cors import CORS

from config.settings import settings
from utils.rate_limiter import limiter
from utils.response_helper import error_response

# Process-wide logging config. Without this, Python's root logger
# defaults to WARNING with no handler attached — every logger.info(...)
# call already scattered across services/utils (and the ones added by
# this fix) was silently getting dropped, and even logger.exception(...)
# calls only reached stderr via the interpreter's bare "last resort"
# fallback with no timestamp/module context. This makes every module's
# `logging.getLogger(__name__)` calls actually show up in Render's log
# viewer (or the terminal in local dev), with enough context (time,
# logger name, level) to tell where a line came from.
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

from routes.health_routes import health_bp
from routes.role_routes import role_bp
from routes.skill_routes import skill_bp
from routes.question_routes import question_bp
from routes.ai_assessment_routes import ai_assessment_bp
from routes.roadmap_routes import roadmap_bp
from routes.learning_routes import learning_bp
from routes.activity_routes import activity_bp
from routes.skill_topic_routes import skill_topic_bp
from routes.admin_student_routes import admin_student_bp
from routes.admin_learner_routes import admin_learner_bp
from routes.admin_auth_routes import admin_auth_bp
from routes.ai_chat_routes import ai_chat_bp
from routes.flashcard_routes import flashcard_bp
from routes.certificate_routes import certificate_bp
from routes.ppt_routes import ppt_bp
from routes.mindmap_routes import mindmap_bp
from routes.slidedeck_routes import slidedeck_bp
from routes.studio_routes import studio_bp
from routes.topic_quiz_routes import topic_quiz_bp
from routes.lesson_routes import lesson_bp
from routes.generated_content_routes import generated_content_bp
from routes.admin_lesson_routes import admin_lesson_bp
from routes.audio_overview_routes import audio_overview_bp


def create_app() -> Flask:
    app = Flask(__name__)

    # Hard cap on request body size (see config/settings.py) — was unset
    # before, so nothing stopped an oversized upload from being read
    # fully into memory before any route-level check ran.
    app.config["MAX_CONTENT_LENGTH"] = settings.MAX_CONTENT_LENGTH_MB * 1024 * 1024

    # Allow the Vite dev server (and later, your deployed frontend origin)
    # to call this API. Origins are configured via .env, never hardcoded.
    CORS(app, origins=settings.CORS_ORIGINS)

    # Per-route AI-call ceilings (see utils/rate_limiter.py) — init_app
    # here, limits are declared with @limiter.limit(...) on the
    # individual AI-calling routes themselves.
    limiter.init_app(app)

    # Health/root routes are unversioned, unprefixed infrastructure routes.
    app.register_blueprint(health_bp)

    # Everything else lives under /api, matching VITE_API_BASE_URL in the
    # frontend's .env.example (http://localhost:5000/api).
    app.register_blueprint(role_bp, url_prefix="/api")
    app.register_blueprint(skill_bp, url_prefix="/api")
    app.register_blueprint(question_bp, url_prefix="/api")
    app.register_blueprint(ai_assessment_bp, url_prefix="/api")
    app.register_blueprint(roadmap_bp, url_prefix="/api")
    app.register_blueprint(learning_bp, url_prefix="/api")
    app.register_blueprint(activity_bp, url_prefix="/api")
    app.register_blueprint(skill_topic_bp, url_prefix="/api")
    app.register_blueprint(admin_student_bp, url_prefix="/api")
    app.register_blueprint(admin_learner_bp, url_prefix="/api")
    app.register_blueprint(admin_auth_bp, url_prefix="/api")
    app.register_blueprint(ai_chat_bp, url_prefix="/api")
    app.register_blueprint(flashcard_bp, url_prefix="/api")
    app.register_blueprint(certificate_bp, url_prefix="/api")
    app.register_blueprint(ppt_bp, url_prefix="/api")
    app.register_blueprint(mindmap_bp, url_prefix="/api")
    app.register_blueprint(slidedeck_bp, url_prefix="/api")
    app.register_blueprint(studio_bp, url_prefix="/api")
    app.register_blueprint(topic_quiz_bp, url_prefix="/api")
    app.register_blueprint(lesson_bp, url_prefix="/api")
    app.register_blueprint(generated_content_bp, url_prefix="/api")
    app.register_blueprint(admin_lesson_bp, url_prefix="/api")
    app.register_blueprint(audio_overview_bp, url_prefix="/api")

    # Without this, a request that trips MAX_CONTENT_LENGTH gets Flask's
    # default HTML 413 page instead of the {success, error} JSON envelope
    # every other error on this API returns — the frontend's error
    # handling (apiClient's response interceptor, error_response readers)
    # expects JSON, not HTML.
    @app.errorhandler(413)
    def handle_payload_too_large(_exc):
        return error_response(
            f"File/request too large — the limit is {settings.MAX_CONTENT_LENGTH_MB}MB.",
            status_code=413,
        )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=settings.DEBUG, port=settings.PORT)
