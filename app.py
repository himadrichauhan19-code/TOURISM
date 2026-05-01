from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "tourism.db"

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "tourism-dev-secret-change-me")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS destinations (
                destination_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                location TEXT NOT NULL,
                description TEXT NOT NULL,
                image_url TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS bookings (
                booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                destination TEXT NOT NULL,
                travel_date TEXT NOT NULL,
                travelers INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(user_id)
            )
            """
        )
        count = conn.execute("SELECT COUNT(*) AS c FROM destinations").fetchone()["c"]
        if count == 0:
            conn.executemany(
                """
                INSERT INTO destinations (name, location, description, image_url)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (
                        "Goa",
                        "Goa, India",
                        "Sunset beaches, vibrant nightlife, and Portuguese charm.",
                        "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=900&q=60",
                    ),
                    (
                        "Manali",
                        "Himachal Pradesh, India",
                        "Snow peaks, adventure sports, and peaceful valleys.",
                        "https://images.unsplash.com/photo-1593181629936-11c609b8db9b?auto=format&fit=crop&w=900&q=60",
                    ),
                    (
                        "Jaipur",
                        "Rajasthan, India",
                        "Palaces, forts, culture, and royal Rajasthani cuisine.",
                        "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=900&q=60",
                    ),
                ],
            )


def get_user_id_by_email(email: str) -> int | None:
    with get_db_connection() as conn:
        row = conn.execute("SELECT user_id FROM users WHERE email = ?", (email,)).fetchone()
    return row["user_id"] if row else None


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/api/session")
def get_session_user():
    user = session.get("user")
    if not user:
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "user": user})


@app.get("/api/destinations")
def get_destinations():
    q = (request.args.get("q") or "").strip().lower()
    with get_db_connection() as conn:
        if q:
            rows = conn.execute(
                """
                SELECT destination_id, name, location, description, image_url
                FROM destinations
                WHERE lower(name) LIKE ? OR lower(location) LIKE ? OR lower(description) LIKE ?
                ORDER BY name
                """,
                (f"%{q}%", f"%{q}%", f"%{q}%"),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT destination_id, name, location, description, image_url FROM destinations ORDER BY name"
            ).fetchall()
    return jsonify({"ok": True, "destinations": [dict(r) for r in rows]})


@app.post("/api/signup")
def signup():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or len(password) < 6:
        return jsonify({"ok": False, "message": "Please fill valid details."}), 400

    password_hash = generate_password_hash(password)

    try:
        with get_db_connection() as conn:
            conn.execute(
                "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (name, email, password_hash, datetime.utcnow().isoformat()),
            )
    except sqlite3.IntegrityError:
        return jsonify({"ok": False, "message": "Email already exists. Please sign in."}), 409

    session["user"] = {"name": name, "email": email}
    return jsonify({"ok": True, "message": "Sign up successful.", "user": session["user"]})


@app.post("/api/signin")
def signin():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"ok": False, "message": "Email and password are required."}), 400

    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT user_id, name, email, password_hash FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"ok": False, "message": "Invalid email or password."}), 401

    session["user"] = {"name": user["name"], "email": user["email"]}
    return jsonify({"ok": True, "message": "Sign in successful.", "user": session["user"]})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True, "message": "Logged out successfully."})


@app.post("/api/bookings")
def create_booking():
    data = request.get_json(silent=True) or {}
    destination = (data.get("destination") or "").strip()
    travel_date = (data.get("travelDate") or "").strip()
    travelers = data.get("travelers")

    if not destination or not travel_date or not isinstance(travelers, int) or travelers < 1:
        return jsonify({"ok": False, "message": "Please enter valid booking details."}), 400

    user = session.get("user")
    user_id = None

    if user:
        user_id = get_user_id_by_email(user["email"])

    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO bookings (user_id, destination, travel_date, travelers, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, destination, travel_date, travelers, datetime.utcnow().isoformat()),
        )

    return jsonify({"ok": True, "message": "Booking request submitted successfully."})


@app.get("/api/my-bookings")
def my_bookings():
    user = session.get("user")
    if not user:
        return jsonify({"ok": True, "bookings": []})

    user_id = get_user_id_by_email(user["email"])
    if not user_id:
        return jsonify({"ok": True, "bookings": []})

    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT booking_id, destination, travel_date, travelers, created_at
            FROM bookings
            WHERE user_id = ?
            ORDER BY booking_id DESC
            """,
            (user_id,),
        ).fetchall()
    return jsonify({"ok": True, "bookings": [dict(r) for r in rows]})


if __name__ == "__main__":
    init_db()
    use_https = os.environ.get("USE_HTTPS", "1") == "1"
    ssl_context = "adhoc" if use_https else None
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "5000"))
    app.run(debug=True, host=host, port=port, ssl_context=ssl_context)
