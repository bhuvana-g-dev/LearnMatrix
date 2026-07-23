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

from flask import Flask
from flask_cors import CORS

from config.settings import settings
from routes.health_routes import health_bp
from routes.role_routes import role_bp
from routes.skill_routes import skill_bp
from routes.question_routes import question_bp
from routes.admin_question_routes import admin_question_bp
from routes.ai_assessment_routes import ai_assessment_bp
from routes.roadmap_routes import roadmap_bp
from routes.learning_routes import learning_bp
from routes.activity_routes import activity_bp


def create_app() -> Flask:
    app = Flask(__name__)

    # Allow the Vite dev server (and later, your deployed frontend origin)
    # to call this API. Origins are configured via .env, never hardcoded.
    CORS(app, origins=settings.CORS_ORIGINS)

    # Health/root routes are unversioned, unprefixed infrastructure routes.
    app.register_blueprint(health_bp)

    # Everything else lives under /api, matching VITE_API_BASE_URL in the
    # frontend's .env.example (http://localhost:5000/api).
    app.register_blueprint(role_bp, url_prefix="/api")
    app.register_blueprint(skill_bp, url_prefix="/api")
    app.register_blueprint(question_bp, url_prefix="/api")
    app.register_blueprint(admin_question_bp, url_prefix="/api")
    app.register_blueprint(ai_assessment_bp, url_prefix="/api")
    app.register_blueprint(roadmap_bp, url_prefix="/api")
    app.register_blueprint(learning_bp, url_prefix="/api")
    app.register_blueprint(activity_bp, url_prefix="/api")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=settings.DEBUG, port=settings.PORT)
