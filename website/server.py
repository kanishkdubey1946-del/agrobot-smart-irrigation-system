"""
AgroBot — Python Backend Server
Serves static files + API endpoints
Stores sensor data in-memory (swap for DB later)
No external dependencies — uses only Python stdlib
"""

import http.server
import json
import os
import math
import random
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

PORT = 3000
HOST = "0.0.0.0"

# ─── In-Memory Data Store ───
readings = []


def seed_demo_data():
    """Generate 7 days of realistic moisture sensor data."""
    now = datetime.now()
    for day in range(6, -1, -1):
        base_date = now - timedelta(days=day)
        for hour in range(24):
            # Skip future hours of today
            if day == 0 and hour > now.hour:
                break

            timestamp = base_date.replace(
                hour=hour,
                minute=random.randint(0, 59),
                second=0,
                microsecond=0,
            )

            # Simulate realistic moisture patterns
            if 0 <= hour < 6:
                base_moisture = 55 + random.random() * 15
            elif 6 <= hour < 10:
                base_moisture = 50 + random.random() * 20
            elif 10 <= hour < 14:
                base_moisture = 38 + random.random() * 18
            elif 14 <= hour < 18:
                base_moisture = 30 + random.random() * 20
            else:
                base_moisture = 45 + random.random() * 20

            # Add daily variation
            base_moisture += math.sin(day * 0.8) * 8
            base_moisture = max(5, min(95, round(base_moisture)))
            raw_adc = round(1023 - (base_moisture / 100) * 1023)

            readings.append({
                "moisture": base_moisture,
                "raw_adc": raw_adc,
                "timestamp": timestamp.isoformat(),
            })


def get_today_readings():
    """Return readings from today only."""
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return [
        r for r in readings
        if datetime.fromisoformat(r["timestamp"]) >= today_start
    ]


def handle_api_latest():
    """GET /api/latest — most recent reading."""
    if not readings:
        return {"moisture": 0, "timestamp": datetime.now().isoformat()}
    latest = readings[-1]
    return {"moisture": latest["moisture"], "timestamp": latest["timestamp"]}


def handle_api_weekly():
    """GET /api/weekly — daily average for past 7 days."""
    now = datetime.now()
    result = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start.replace(hour=23, minute=59, second=59)
        day_readings = [
            r for r in readings
            if day_start <= datetime.fromisoformat(r["timestamp"]) <= day_end
        ]
        avg = (
            round(sum(r["moisture"] for r in day_readings) / len(day_readings))
            if day_readings else None
        )
        result.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "avg_moisture": avg,
        })
    return result


def handle_api_hourly():
    """GET /api/hourly — hourly averages for today."""
    today_readings = get_today_readings()
    hourly = {}
    for r in today_readings:
        h = datetime.fromisoformat(r["timestamp"]).hour
        label = f"{h:02d}:00"
        hourly.setdefault(label, []).append(r["moisture"])

    result = sorted(
        [
            {"hour": hour, "avg_moisture": round(sum(vals) / len(vals))}
            for hour, vals in hourly.items()
        ],
        key=lambda x: x["hour"],
    )
    return result


def handle_api_stats():
    """GET /api/stats — today's aggregated statistics."""
    today_readings = get_today_readings()
    if not today_readings:
        return {
            "avg_today": 0, "min_today": 0, "min_time": None,
            "max_today": 0, "max_time": None, "total_readings": 0,
        }

    avg = round(sum(r["moisture"] for r in today_readings) / len(today_readings))
    min_r = min(today_readings, key=lambda r: r["moisture"])
    max_r = max(today_readings, key=lambda r: r["moisture"])

    return {
        "avg_today": avg,
        "min_today": min_r["moisture"],
        "min_time": min_r["timestamp"],
        "max_today": max_r["moisture"],
        "max_time": max_r["timestamp"],
        "total_readings": len(today_readings),
    }


def handle_api_alerts():
    """GET /api/alerts — readings outside safe zone."""
    now_ts = datetime.now().timestamp()
    alerts = []
    for r in reversed(readings):
        if r["moisture"] < 20 or r["moisture"] > 75:
            ts = datetime.fromisoformat(r["timestamp"]).timestamp()
            alerts.append({
                "time": r["timestamp"],
                "moisture": r["moisture"],
                "type": "dry" if r["moisture"] < 20 else "wet",
                "status": "active" if (now_ts - ts) < 600 else "resolved",
            })
        if len(alerts) >= 50:
            break
    return alerts


def handle_api_raw():
    """GET /api/raw — last 20 raw readings."""
    return list(reversed(readings[-20:]))


def handle_save_data(body_str, content_type):
    """POST /save_data.php — receive data from ESP8266."""
    global readings
    moisture = None

    if "application/json" in (content_type or ""):
        try:
            data = json.loads(body_str)
            moisture = int(data.get("moisture", -1))
        except (json.JSONDecodeError, ValueError):
            pass
    else:
        # URL-encoded form data
        params = parse_qs(body_str)
        if "moisture" in params:
            try:
                moisture = int(params["moisture"][0])
            except ValueError:
                pass

    if moisture is None or not (0 <= moisture <= 100):
        return 400, {"error": "Invalid moisture value. Send 0-100."}

    raw_adc = round(1023 - (moisture / 100) * 1023)
    reading = {
        "moisture": moisture,
        "raw_adc": raw_adc,
        "timestamp": datetime.now().isoformat(),
    }
    readings.append(reading)

    # Keep max 10000 readings
    if len(readings) > 10000:
        readings = readings[-5000:]

    print(f"  [DATA] Received -- Moisture: {moisture}% | ADC: {raw_adc} | {reading['timestamp']}")
    return 200, {"success": True, "reading": reading}


# ─── MIME Types ───
MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}

STATIC_DIR = os.path.dirname(os.path.abspath(__file__))


class AgroBotHandler(http.server.BaseHTTPRequestHandler):
    """Custom request handler for AgroBot."""

    def log_message(self, format, *args):
        # Quieter logging — only log non-static requests
        path = args[0].split()[1] if args else ""
        if path.startswith("/api") or path.startswith("/save"):
            print(f"  {args[0]}")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, filepath):
        """Serve a static file."""
        if not os.path.isfile(filepath):
            # Fallback to index.html for SPA
            filepath = os.path.join(STATIC_DIR, "index.html")

        ext = os.path.splitext(filepath)[1].lower()
        mime = MIME_TYPES.get(ext, "application/octet-stream")

        try:
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", len(content))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404, "File not found")

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API routes
        api_routes = {
            "/api/latest": handle_api_latest,
            "/api/weekly": handle_api_weekly,
            "/api/hourly": handle_api_hourly,
            "/api/stats": handle_api_stats,
            "/api/alerts": handle_api_alerts,
            "/api/raw": handle_api_raw,
        }

        if path in api_routes:
            self.send_json(api_routes[path]())
            return

        # Static files
        if path == "/":
            path = "/login.html"

        filepath = os.path.join(STATIC_DIR, path.lstrip("/").replace("/", os.sep))
        self.serve_static(filepath)

    def do_POST(self):
        if self.path == "/save_data.php":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            content_type = self.headers.get("Content-Type", "")
            status, response = handle_save_data(body, content_type)
            self.send_json(response, status)
        else:
            self.send_error(404, "Not found")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


def main():
    seed_demo_data()

    server = http.server.HTTPServer((HOST, PORT), AgroBotHandler)

    print()
    print("  [AgroBot] ==========================================")
    print("  [AgroBot]  AgroBot Dashboard Server (Python)")
    print(f"  [AgroBot]  Running on http://localhost:{PORT}")
    print("  [AgroBot] ==========================================")
    print()
    print(f"  [DASH]  Dashboard:  http://localhost:{PORT}")
    print(f"  [POST]  POST data:  http://localhost:{PORT}/save_data.php")
    print(f"  [API]   API latest: http://localhost:{PORT}/api/latest")
    print(f"  [API]   API weekly: http://localhost:{PORT}/api/weekly")
    print(f"  [API]   API stats:  http://localhost:{PORT}/api/stats")
    print()
    print("  Seeded with 7 days of demo data.")
    print("  Send real data via POST /save_data.php with body: moisture=65")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  [STOP] Server stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
