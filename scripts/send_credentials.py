#!/usr/bin/env python3
"""send_credentials.py — email each delegate their login credentials via Resend.

Run LATER, once the participant emails are final and seed-delegates.js has
produced the credentials CSV.

Usage:
    RESEND_API_KEY=... APP_URL=https://delegateapp.thecipes.org \
    FROM_EMAIL=noreply@thecipes.org \
    python3 scripts/send_credentials.py delegate-credentials.csv

The CSV is the output of seed-delegates.js with header: email,password,name
Requires: requests  (pip install requests)  — uses the Resend HTTP API directly,
no extra SDK needed.
"""
import csv
import os
import sys
import time

import requests

RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@thecipes.org")
APP_URL = os.environ.get("APP_URL", "https://delegateapp.thecipes.org")
EVENT_NAME = os.environ.get("EVENT_NAME", "the CIPES program")

RESEND_ENDPOINT = "https://api.resend.com/emails"


def build_html(name: str, email: str, password: str) -> str:
    greeting = name or "delegate"
    return f"""
    <div style="font-family:Arial,sans-serif;color:#2C2825;line-height:1.6;">
      <h2 style="color:#050505;">Welcome to {EVENT_NAME}</h2>
      <p>Hello {greeting},</p>
      <p>Your delegate app account is ready. Open the app and sign in:</p>
      <p>
        <a href="{APP_URL}"
           style="background:#001224;color:#E5DBC2;padding:10px 18px;
                  text-decoration:none;font-weight:bold;border:2px solid #001224;">
          Open the Delegate App
        </a>
      </p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;"><b>Email</b></td><td>{email}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><b>Password</b></td><td>{password}</td></tr>
      </table>
      <p>You can change your password from inside the app after signing in.</p>
      <p style="font-size:13px;color:#6b6b6b;">If you didn't expect this email,
         please ignore it.</p>
      <p>— CIPES</p>
    </div>
    """


def send(to_email: str, name: str, password: str) -> bool:
    payload = {
        "from": f"CIPES <{FROM_EMAIL}>",
        "to": [to_email],
        "subject": f"Your {EVENT_NAME} delegate app login",
        "html": build_html(name, to_email, password),
    }
    resp = requests.post(
        RESEND_ENDPOINT,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if resp.status_code >= 300:
        print(f"  ✗ {to_email}: {resp.status_code} {resp.text}")
        return False
    print(f"  ✓ {to_email}")
    return True


def main() -> None:
    if not RESEND_API_KEY:
        sys.exit("RESEND_API_KEY not set in environment.")
    if len(sys.argv) < 2:
        sys.exit("Usage: python3 scripts/send_credentials.py <credentials.csv>")

    path = sys.argv[1]
    sent = failed = 0
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            email = (row.get("email") or "").strip()
            if not email:
                continue
            ok = send(email, (row.get("name") or "").strip(), (row.get("password") or "").strip())
            sent += ok
            failed += (not ok)
            time.sleep(0.6)  # gentle on the API rate limit

    print(f"\nDone. Sent {sent}, failed {failed}.")


if __name__ == "__main__":
    main()
