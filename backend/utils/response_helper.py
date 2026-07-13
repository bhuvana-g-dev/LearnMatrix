"""
utils/response_helper.py

Every route returns JSON through these two helpers so the response shape is
identical across the whole API. The React side can always rely on:
    { success: true,  data: ... }
    { success: false, error: "..." }
This avoids each route inventing its own envelope.
"""

from flask import jsonify


def success_response(data=None, message: str = "OK", status_code: int = 200):
    payload = {
        "success": True,
        "message": message,
        "data": data,
    }
    return jsonify(payload), status_code


def error_response(message: str = "Something went wrong", status_code: int = 400):
    payload = {
        "success": False,
        "error": message,
    }
    return jsonify(payload), status_code
