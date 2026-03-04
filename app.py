"""
Hackathon Event Registration Backend
Flask REST API — SMTP email confirmation + registration lookup
"""

import csv
import json
import os
import re
import random
import string
import smtplib
import threading
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── Configuration ──────────────────────────────────────────────────────────────
CSV_FILE = "registrations.csv"

CSV_HEADERS = [
    "hackathon_id",
    "registered_at",
    "team_name",
    "problem_track",
    "team_size",
    "lead_name",
    "lead_email",
    "lead_phone",
    "members",
]

# ── SMTP Settings — set via environment variables or edit directly ─────────────
#
#   For Gmail:
#     1. Enable 2-Step Verification on your Google account
#     2. Go to Security → App Passwords → generate one for "Mail"
#     3. Paste it as SMTP_PASSWORD below (or set the env var)
#
#   Environment variables (recommended for production):
#     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, EMAIL_ENABLED
#
SMTP_HOST     = os.getenv("SMTP_HOST",     "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER",     "your_email@gmail.com")   # ← change
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "your_app_password")      # ← change
SMTP_FROM     = os.getenv("SMTP_FROM",     SMTP_USER)

# Set EMAIL_ENABLED=false (env) to skip actual sending during local dev/testing
EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "true").lower() == "true"


# ═══════════════════════════════════════════════════════════════════════════════
# CSV HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_hackathon_id() -> str:
    chars = string.ascii_uppercase + string.digits
    return "HACK-" + "".join(random.choices(chars, k=8))


def ensure_csv_exists():
    if not os.path.exists(CSV_FILE):
        with open(CSV_FILE, mode="w", newline="", encoding="utf-8-sig") as f:
            csv.DictWriter(f, fieldnames=CSV_HEADERS).writeheader()


def load_registered_emails() -> set:
    emails = set()
    if not os.path.exists(CSV_FILE):
        return emails
    with open(CSV_FILE, mode="r", newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row.get("lead_email"):
                emails.add(row["lead_email"].strip().lower())
    return emails


def find_registration_by_id(hackathon_id: str) -> dict | None:
    """Return the matching CSV row dict, or None if not found."""
    if not os.path.exists(CSV_FILE):
        return None
    with open(CSV_FILE, mode="r", newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row.get("hackathon_id", "").strip() == hackathon_id.strip().upper():
                return row
    return None


def append_registration(record: dict):
    ensure_csv_exists()
    with open(CSV_FILE, mode="a", newline="", encoding="utf-8-sig") as f:
        csv.DictWriter(f, fieldnames=CSV_HEADERS).writerow(record)


def validate_phone(phone) -> bool:
    return bool(re.fullmatch(r"\d{10}", str(phone)))


def validate_email_fmt(email: str) -> bool:
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email))


# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def build_confirmation_email(record: dict, members: list) -> tuple:
    """Return (subject, html_body, plain_body) for the confirmation email."""

    subject = f"✅ Hackathon Registration Confirmed — {record['hackathon_id']}"

    # Build additional-members table rows
    member_rows = ""
    for i, m in enumerate(members, 1):
        member_rows += f"""
        <tr>
          <td style="padding:6px 12px;border:1px solid #e2e8f0;">{i}</td>
          <td style="padding:6px 12px;border:1px solid #e2e8f0;">{m.get('member_name','—')}</td>
          <td style="padding:6px 12px;border:1px solid #e2e8f0;">{m.get('member_email') or '—'}</td>
        </tr>"""

    members_section = ""
    if member_rows:
        members_section = f"""
        <h3 style="color:#4a5568;margin-top:28px;">👥 Additional Team Members</h3>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr style="background:#f7fafc;">
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">#</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Name</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Email</th>
            </tr>
          </thead>
          <tbody>{member_rows}</tbody>
        </table>"""

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;padding:30px;margin:0;">
  <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:14px;
              overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">

    <!-- Header Banner -->
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                padding:36px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:1px;">🚀 Hackathon 2025</h1>
      <p style="color:#e9d8fd;margin:10px 0 0;font-size:16px;">You're officially registered!</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 32px;">
      <p style="font-size:16px;color:#2d3748;margin-top:0;">
        Hi <strong>{record['lead_name']}</strong>,
      </p>
      <p style="color:#4a5568;line-height:1.8;font-size:15px;">
        Your team has been successfully registered. Keep your
        <strong>Hackathon ID</strong> handy — you'll need it at check-in.
      </p>

      <!-- Hackathon ID Badge -->
      <div style="background:#f7fafc;border:2px dashed #667eea;border-radius:12px;
                  padding:22px;text-align:center;margin:28px 0;">
        <p style="margin:0;font-size:11px;color:#718096;letter-spacing:2px;
                  text-transform:uppercase;">Your Hackathon ID</p>
        <p style="margin:10px 0 0;font-size:34px;font-weight:bold;
                  color:#667eea;letter-spacing:4px;">{record['hackathon_id']}</p>
      </div>

      <!-- Registration Details Table -->
      <h3 style="color:#4a5568;margin-top:28px;">📋 Registration Details</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <tr style="background:#f7fafc;">
          <td style="padding:9px 14px;border:1px solid #e2e8f0;font-weight:bold;width:38%;">Team Name</td>
          <td style="padding:9px 14px;border:1px solid #e2e8f0;">{record['team_name']}</td>
        </tr>
        <tr>
          <td style="padding:9px 14px;border:1px solid #e2e8f0;font-weight:bold;">Problem Track</td>
          <td style="padding:9px 14px;border:1px solid #e2e8f0;">{record['problem_track']}</td>
        </tr>
        <tr style="background:#f7fafc;">
          <td style="padding:9px 14px;border:1px solid #e2e8f0;font-weight:bold;">Team Size</td>
          <td style="padding:9px 14px;border:1px solid #e2e8f0;">{record['team_size']} member(s)</td>
        </tr>
        <tr>
          <td style="padding:9px 14px;border:1px solid #e2e8f0;font-weight:bold;">Team Lead</td>
          <td style="padding:9px 14px;border:1px solid #e2e8f0;">{record['lead_name']}</td>
        </tr>
        <tr style="background:#f7fafc;">
          <td style="padding:9px 14px;border:1px solid #e2e8f0;font-weight:bold;">Lead Email</td>
          <td style="padding:9px 14px;border:1px solid #e2e8f0;">{record['lead_email']}</td>
        </tr>
        <tr>
          <td style="padding:9px 14px;border:1px solid #e2e8f0;font-weight:bold;">Lead Phone</td>
          <td style="padding:9px 14px;border:1px solid #e2e8f0;">{record['lead_phone']}</td>
        </tr>
        <tr style="background:#f7fafc;">
          <td style="padding:9px 14px;border:1px solid #e2e8f0;font-weight:bold;">Registered At</td>
          <td style="padding:9px 14px;border:1px solid #e2e8f0;">{record['registered_at']}</td>
        </tr>
      </table>

      {members_section}

      <!-- Next Steps -->
      <div style="background:#ebf8ff;border-left:4px solid #63b3ed;border-radius:6px;
                  padding:16px 20px;margin-top:30px;">
        <p style="margin:0;color:#2c5282;font-size:14px;line-height:1.7;">
          📌 <strong>What's next?</strong><br>
          We'll send venue details, problem statements, and schedule closer to the event date
          to this email address. Stay tuned!
        </p>
      </div>

      <p style="color:#a0aec0;font-size:12px;margin-top:28px;">
        Didn't register? Please ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f7fafc;padding:18px;text-align:center;
                border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#a0aec0;">
        © 2025 Hackathon Team &nbsp;·&nbsp; Automated confirmation — please do not reply.
      </p>
    </div>
  </div>
</body>
</html>"""

    plain = (
        f"HACKATHON REGISTRATION CONFIRMED\n"
        f"{'='*40}\n"
        f"Hackathon ID : {record['hackathon_id']}\n"
        f"Team Name    : {record['team_name']}\n"
        f"Problem Track: {record['problem_track']}\n"
        f"Team Size    : {record['team_size']}\n"
        f"Lead Name    : {record['lead_name']}\n"
        f"Lead Email   : {record['lead_email']}\n"
        f"Lead Phone   : {record['lead_phone']}\n"
        f"Registered At: {record['registered_at']}\n"
    )
    if members:
        plain += "\nAdditional Members:\n"
        for i, m in enumerate(members, 1):
            plain += f"  {i}. {m.get('member_name','')} ({m.get('member_email','')})\n"

    return subject, html, plain


def send_confirmation_email(record: dict, members: list):
    """
    Send a styled HTML confirmation email via SMTP.
    Runs in a background thread so it never blocks the HTTP response.
    Email failures are logged but do NOT undo the registration.
    """
    if not EMAIL_ENABLED:
        print(f"[EMAIL DISABLED] Would send confirmation to {record['lead_email']}")
        return

    try:
        subject, html_body, plain_body = build_confirmation_email(record, members)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Hackathon 2025 <{SMTP_FROM}>"
        msg["To"]      = record["lead_email"]

        msg.attach(MIMEText(plain_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body,  "html",  "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, record["lead_email"], msg.as_string())

        print(f"[EMAIL] ✅ Confirmation sent → {record['lead_email']}")

    except smtplib.SMTPAuthenticationError:
        print("[EMAIL ERROR] Authentication failed. Check SMTP_USER / SMTP_PASSWORD.")
    except smtplib.SMTPException as e:
        print(f"[EMAIL ERROR] SMTP error: {e}")
    except Exception as e:
        print(f"[EMAIL ERROR] Unexpected error sending to {record['lead_email']}: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

# ── POST /register ─────────────────────────────────────────────────────────────
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    errors = []

    # Required fields
    for field in ["team_name", "problem_track", "team_size",
                  "lead_name", "lead_email", "lead_phone"]:
        if not data.get(field) and data.get(field) != 0:
            errors.append(f"'{field}' is required.")

    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    # team_size
    try:
        team_size = int(data["team_size"])
    except (ValueError, TypeError):
        errors.append("'team_size' must be an integer.")
        team_size = None

    if team_size is not None and not (1 <= team_size <= 5):
        errors.append("'team_size' must be between 1 and 5.")

    # lead_email
    lead_email = str(data["lead_email"]).strip().lower()
    if not validate_email_fmt(lead_email):
        errors.append("'lead_email' is not a valid email address.")

    # lead_phone
    lead_phone = str(data["lead_phone"]).strip()
    if not validate_phone(lead_phone):
        errors.append("'lead_phone' must be a 10-digit number.")

    # members
    members = data.get("members", [])
    if not isinstance(members, list):
        errors.append("'members' must be an array.")
        members = []

    if len(members) > 4:
        errors.append("Additional team members cannot exceed 4.")

    if team_size is not None and not errors:
        total = 1 + len(members)
        if total != team_size:
            errors.append(
                f"'team_size' is {team_size} but total count (lead + additional) is {total}."
            )

    for i, member in enumerate(members):
        if not isinstance(member, dict):
            errors.append(f"members[{i}] must be an object.")
            continue
        if not member.get("member_name"):
            errors.append(f"members[{i}]: 'member_name' is required.")
        if member.get("member_email") and not validate_email_fmt(str(member["member_email"])):
            errors.append(f"members[{i}]: 'member_email' is not valid.")

    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    # Duplicate email check
    if lead_email in load_registered_emails():
        return jsonify({
            "error":   "Duplicate registration.",
            "message": f"A team with lead email '{lead_email}' is already registered.",
        }), 409

    # Generate Hackathon ID & timestamp
    hackathon_id  = generate_hackathon_id()
    registered_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    clean_members = [
        {
            "member_name":  str(m.get("member_name", "")).strip(),
            "member_email": str(m.get("member_email", "")).strip().lower(),
        }
        for m in members
    ]

    record = {
        "hackathon_id":  hackathon_id,
        "registered_at": registered_at,
        "team_name":     str(data["team_name"]).strip(),
        "problem_track": str(data["problem_track"]).strip(),
        "team_size":     team_size,
        "lead_name":     str(data["lead_name"]).strip(),
        "lead_email":    lead_email,
        "lead_phone":    lead_phone,
        "members":       json.dumps(clean_members),
    }

    # Persist to CSV
    append_registration(record)

    # Fire confirmation email in background (non-blocking)
    threading.Thread(
        target=send_confirmation_email,
        args=(record, clean_members),
        daemon=True,
    ).start()

    return jsonify({
        "success":       True,
        "message":       "Registration successful! A confirmation email has been sent to the team lead.",
        "hackathon_id":  hackathon_id,
        "registered_at": registered_at,
        "team_name":     record["team_name"],
        "email_sent_to": lead_email,
    }), 201


# ── GET /registration/<hackathon_id> ───────────────────────────────────────────
@app.route("/registration/<hackathon_id>", methods=["GET"])
def get_registration(hackathon_id: str):
    """
    Look up a registration by Hackathon ID.

    Success  → 200  { success, hackathon_id, registered_at, team, lead, members }
    Not found→ 404  { error, message }

    Example:
        GET /registration/HACK-AB12CD34
    """
    row = find_registration_by_id(hackathon_id)

    if not row:
        return jsonify({
            "error":   "Not found.",
            "message": f"No registration found for ID '{hackathon_id.upper()}'.",
        }), 404

    try:
        members = json.loads(row.get("members", "[]"))
    except (json.JSONDecodeError, TypeError):
        members = []

    return jsonify({
        "success":       True,
        "hackathon_id":  row["hackathon_id"],
        "registered_at": row["registered_at"],
        "team": {
            "team_name":     row["team_name"],
            "problem_track": row["problem_track"],
            "team_size":     int(row["team_size"]),
        },
        "lead": {
            "lead_name":  row["lead_name"],
            "lead_email": row["lead_email"],
            "lead_phone": row["lead_phone"],
        },
        "members": members,
    }), 200


# ── GET /health ────────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":        "ok",
        "service":       "Hackathon Registration API",
        "email_enabled": EMAIL_ENABLED,
    }), 200


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    ensure_csv_exists()
    app.run(debug=True, host="0.0.0.0", port=10000)
