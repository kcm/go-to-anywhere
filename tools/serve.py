#!/usr/bin/env python3
"""
Local HTTP server + optional City Pack Builder API for Go To Anywhere (GTA).

By default, running locally (`npm start` or `python3 tools/serve.py`) enables `/api/cities/*`
so players can search for any city in the world and build/install new local city packs
directly from the in-game UI.

On a static host like GitHub Pages (`*.github.io`), `/api/server-config` is absent (404),
and on a locked server (`python3 tools/serve.py --locked` or `GTA_ALLOW_CITY_BUILD=0`),
`/api/server-config` returns `{"allowCityRequests": false, "locked": true}`, locking the UI
to pre-installed city packs only.
"""

import argparse
import functools
import http.server
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_JOBS = {}
BUILD_LOCK = threading.Lock()


def slugify_city(text):
    head = str(text or '').split(',')[0]
    slug = re.sub(r'[^a-z0-9]+', '', head.lower())[:24]
    return slug or 'customcity'


def geocode_nominatim(query):
    url = (
        'https://nominatim.openstreetmap.org/search?'
        + urllib.parse.urlencode({
            'q': query,
            'format': 'jsonv2',
            'addressdetails': '1',
            'limit': '6',
        })
    )
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'GoToAnywhere-LocalCityBuilder/1.0 (local dev server)',
            'Accept': 'application/json',
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        items = json.loads(resp.read().decode('utf-8'))

    results = []
    for item in items:
        addr = item.get('address') or {}
        city_name = (
            addr.get('city')
            or addr.get('town')
            or addr.get('village')
            or addr.get('municipality')
            or item.get('name')
            or query.split(',')[0].strip()
        )
        state = (
            addr.get('state')
            or addr.get('province')
            or addr.get('region')
            or addr.get('country')
            or ''
        )
        iso = addr.get('ISO3166-2-lvl4') or ''
        state_code = (
            iso.split('-')[-1].upper()
            if '-' in iso
            else (addr.get('country_code') or state[:2] or 'LOC').upper()
        )
        display_name = f"{city_name}, {state_code}" if state_code else city_name
        lat = round(float(item['lat']), 5)
        lon = round(float(item['lon']), 5)
        results.append({
            'id': slugify_city(city_name),
            'name': display_name,
            'fullLabel': item.get('display_name') or display_name,
            'stateCode': state_code[:3],
            'lat': lat,
            'lon': lon,
        })
    return results


def run_build_job(job_id, cmd):
    with BUILD_LOCK:
        job = BUILD_JOBS[job_id]
        job['status'] = 'running'
        job['startedAt'] = time.time()

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=ROOT_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        for line in proc.stdout:
            clean = line.rstrip()
            if not clean:
                continue
            with BUILD_LOCK:
                job['logs'].append(clean)
                if len(job['logs']) > 80:
                    job['logs'] = job['logs'][-80:]
                if clean.startswith('Step ') or clean.startswith('['):
                    job['step'] = clean
        proc.wait()
        with BUILD_LOCK:
            if proc.returncode == 0:
                job['status'] = 'done'
                job['step'] = f"Finished building {job['name']}!"
            else:
                job['status'] = 'error'
                job['error'] = f"Build exited with code {proc.returncode}"
    except Exception as exc:
        with BUILD_LOCK:
            job['status'] = 'error'
            job['error'] = str(exc)


class GTAServerHandler(http.server.SimpleHTTPRequestHandler):
    allow_city_requests = True

    def log_message(self, fmt, *args):
        if self.path.startswith('/api/cities/status'):
            return
        super().log_message(fmt, *args)

    def send_json(self, status_code, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/server-config':
            with BUILD_LOCK:
                active = {
                    k: {'id': v['id'], 'name': v['name'], 'status': v['status'], 'step': v.get('step', '')}
                    for k, v in BUILD_JOBS.items()
                }
            self.send_json(200, {
                'allowCityRequests': bool(self.allow_city_requests),
                'locked': not bool(self.allow_city_requests),
                'activeBuilds': active,
            })
            return

        if parsed.path == '/api/cities/geocode':
            if not self.allow_city_requests:
                self.send_json(403, {'error': 'City requests are locked on this server.'})
                return
            qs = urllib.parse.parse_qs(parsed.query)
            q = (qs.get('q') or [''])[0].strip()
            if len(q) < 2:
                self.send_json(400, {'error': 'Query parameter q must be at least 2 characters.'})
                return
            try:
                results = geocode_nominatim(q)
                self.send_json(200, {'results': results})
            except Exception as exc:
                self.send_json(502, {'error': f"Geocoding lookup failed: {exc}"})
            return

        if parsed.path == '/api/cities/status':
            qs = urllib.parse.parse_qs(parsed.query)
            cid = re.sub(r'[^a-z0-9_-]+', '', (qs.get('id') or [''])[0].strip().lower())
            with BUILD_LOCK:
                job = BUILD_JOBS.get(cid)
                if not job:
                    self.send_json(404, {'error': f"No build job found for '{cid}'."})
                    return
                self.send_json(200, dict(job))
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != '/api/cities/build':
            self.send_json(404, {'error': 'Not found'})
            return

        if not self.allow_city_requests:
            self.send_json(403, {'error': 'City creation is locked on this server.'})
            return

        try:
            length = int(self.headers.get('Content-Length') or 0)
            raw = self.rfile.read(length) if length > 0 else b'{}'
            data = json.loads(raw.decode('utf-8'))
        except Exception as exc:
            self.send_json(400, {'error': f"Invalid JSON body: {exc}"})
            return

        city_id = re.sub(r'[^a-z0-9_-]+', '', str(data.get('id') or '').strip().lower())
        if not city_id or len(city_id) < 2 or len(city_id) > 32:
            self.send_json(400, {'error': 'Valid city id (2-32 alphanumeric chars) is required.'})
            return

        with BUILD_LOCK:
            existing = BUILD_JOBS.get(city_id)
            if existing and existing.get('status') == 'running':
                self.send_json(200, dict(existing))
                return

        build_script = os.path.join(ROOT_DIR, 'tools', 'build-city-pack.py')
        cmd = [sys.executable, build_script, '--city', city_id]

        name = str(data.get('name') or data.get('displayName') or city_id.title()).strip()
        lat = data.get('lat')
        lon = data.get('lon')
        radius_km = data.get('radiusKm', 2.5)
        state_code = str(data.get('stateCode') or '').strip()

        if lat is not None and lon is not None:
            try:
                lat_f = float(lat)
                lon_f = float(lon)
                rad_f = max(0.5, min(6.0, float(radius_km or 2.5)))
            except Exception:
                self.send_json(400, {'error': 'lat, lon, and radiusKm must be valid numbers.'})
                return
            if not (-85.0 <= lat_f <= 85.0 and -180.0 <= lon_f <= 180.0):
                self.send_json(400, {'error': 'Coordinates out of range.'})
                return
            cmd.extend([
                '--name', name,
                '--lat', str(lat_f),
                '--lon', str(lon_f),
                '--radius-km', str(rad_f),
            ])
            if state_code:
                cmd.extend(['--state-code', state_code[:3].upper()])

        with BUILD_LOCK:
            BUILD_JOBS[city_id] = {
                'id': city_id,
                'name': name,
                'status': 'starting',
                'step': f"Starting build for {name}...",
                'logs': [f"Command: {' '.join(cmd)}"],
                'error': None,
            }
            snapshot = dict(BUILD_JOBS[city_id])

        t = threading.Thread(target=run_build_job, args=(city_id, cmd), daemon=True)
        t.start()
        self.send_json(202, snapshot)


def main():
    parser = argparse.ArgumentParser(description="Go To Anywhere (GTA) HTTP server with gated City Pack Builder API")
    parser.add_argument('port_pos', nargs='?', type=int, default=None, help="Optional positional port (default: 8000)")
    parser.add_argument('--port', type=int, default=8000, help="Port to listen on (default: 8000)")
    parser.add_argument('--locked', action='store_true', help="Lock city creation/requests (public read-only mode)")
    args = parser.parse_args()

    port = args.port_pos or args.port or int(os.environ.get('PORT', '8000'))
    env_allow = os.environ.get('GTA_ALLOW_CITY_BUILD', '1').strip().lower()
    allow_requests = (not args.locked) and (env_allow not in ('0', 'false', 'no', 'locked'))

    handler_cls = functools.partial(GTAServerHandler, directory=ROOT_DIR)
    handler_cls.allow_city_requests = allow_requests
    GTAServerHandler.allow_city_requests = allow_requests

    mode_str = "UNLOCKED (players can request & build new cities)" if allow_requests else "LOCKED (read-only installed cities)"
    server = http.server.ThreadingHTTPServer(('0.0.0.0', port), handler_cls)
    print(f"Go To Anywhere (GTA) server listening on http://localhost:{port}/")
    print(f"City Builder API: {mode_str}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")


if __name__ == '__main__':
    main()
