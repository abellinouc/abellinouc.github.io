#!/usr/bin/env python3
"""
hips-bundle — streams a run of HiPS tiles as one tar.

Why it exists: a HiPS order is not big because of its bytes, it is big because of
its FILES. Norder9 of DSS is 74 GB in 3,145,521 of them, and a phone asking for
three million separate HTTPS objects spends its evening on the handshakes rather
than the data. One request per few thousand tiles turns that into a download.

    GET /bundle?survey=dss&order=8&from=0&to=1999

streams a tar of Npix0.webp .. Npix1999.webp, taken from wherever the HiPS layout
puts them (NorderN/Dir<floor(p/10000)*10000>/Npix<p>.<ext>). Tiles that are not
there are simply left out — these surveys have holes, gaia especially, and a hole
is not an error.

Nothing is written to disk: the tar is assembled into the socket as it goes. The
box has 5 GB free and this must never be the thing that fills it.
"""

import os
import re
import tarfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = "/var/www/html/surveys"
PORT = 8088

# A run longer than this is refused. Not a performance guard — a memory-and-time
# one: the client is expected to ask in chunks it can retry, and a chunk it
# cannot retry is worse than two requests.
MAX_RUN = 20000

SAFE = re.compile(r"^[A-Za-z0-9_.-]+$")


def tile_path(survey, version, order, npix, exts):
    d = (npix // 10000) * 10000
    base = os.path.join(ROOT, survey, version, "Norder%d" % order, "Dir%d" % d)
    for ext in exts:
        p = os.path.join(base, "Npix%d.%s" % (npix, ext))
        if os.path.isfile(p):
            return p, ext
    return None, None


def survey_exts(survey, version):
    """What the tiles are called here, read from the survey's own properties."""
    p = os.path.join(ROOT, survey, version, "properties")
    try:
        with open(p, "r", errors="replace") as fh:
            for line in fh:
                if line.strip().startswith("hips_tile_format"):
                    fmt = line.split("=", 1)[1].split()
                    if fmt:
                        return fmt
    except OSError:
        pass
    # gaia's properties is empty, so a default is needed rather than a failure
    return ["webp", "jpg", "png", "eph"]


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "hips-bundle/1"

    def log_message(self, *a):
        pass                                   # nginx already has the access log

    def fail(self, code, msg):
        body = (msg + "\n").encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_HEAD(self):
        # A HEAD cannot say how long a streamed tar will be, but it can say the
        # endpoint is there — which is what a client checking for it wants.
        self.send_response(200)
        self.send_header("Content-Type", "application/x-tar")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.rstrip("/") not in ("/bundle", ""):
            return self.fail(404, "not found")
        q = parse_qs(u.query)

        def one(name, default=None):
            v = q.get(name, [default])[0]
            return v

        survey = one("survey", "")
        version = one("version", "v1")
        try:
            order = int(one("order", ""))
            a = int(one("from", ""))
            b = int(one("to", ""))
        except (TypeError, ValueError):
            return self.fail(400, "order, from and to must be integers")

        if not (SAFE.match(survey or "") and SAFE.match(version or "")):
            return self.fail(400, "bad survey or version")
        if not (0 <= order <= 12):
            return self.fail(400, "order out of range")
        if a < 0 or b < a:
            return self.fail(400, "bad range")
        if b - a + 1 > MAX_RUN:
            return self.fail(400, "run longer than %d tiles" % MAX_RUN)

        base = os.path.realpath(os.path.join(ROOT, survey, version))
        if not base.startswith(os.path.realpath(ROOT) + os.sep) or not os.path.isdir(base):
            return self.fail(404, "no such survey")

        exts = survey_exts(survey, version)

        self.send_response(200)
        self.send_header("Content-Type", "application/x-tar")
        # No Access-Control-Allow-Origin here: nginx adds one for the whole server,
        # and a browser rejects a response carrying two of them outright.
        # streamed: the length is not known until the last tile is read
        self.send_header("Transfer-Encoding", "chunked")
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()

        chunked = _Chunked(self.wfile)
        try:
            with tarfile.open(fileobj=chunked, mode="w|") as tar:
                for npix in range(a, b + 1):
                    p, ext = tile_path(survey, version, order, npix, exts)
                    if not p:
                        continue           # a hole in the survey, not a failure
                    info = tar.gettarinfo(p, arcname="Npix%d.%s" % (npix, ext))
                    with open(p, "rb") as fh:
                        tar.addfile(info, fh)
            chunked.close()
        except (BrokenPipeError, ConnectionResetError):
            pass                            # the phone went away mid-download


class _Chunked:
    """HTTP chunked framing around the raw socket, so the tar can stream."""

    def __init__(self, w):
        self.w = w

    def write(self, data):
        if not data:
            return 0
        self.w.write(b"%X\r\n" % len(data))
        self.w.write(data)
        self.w.write(b"\r\n")
        return len(data)

    def close(self):
        self.w.write(b"0\r\n\r\n")
        self.w.flush()

    def flush(self):
        self.w.flush()


if __name__ == "__main__":
    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
