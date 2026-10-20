#!/usr/bin/env python3
"""
Lokalny serwer prototypu asystenta Liveo (tylko biblioteka standardowa Pythona).

    python3 server.py            → http://localhost:5180
    python3 server.py 8000       → inny port

Serwuje pliki projektu oraz jeden endpoint deweloperski:
    POST /__dev/save-embeddings  – zapisuje data/text-embeddings.json
                                   (używa go tools/build-embeddings.html)
Na stronie Liveo widżet nie potrzebuje żadnego serwera – wystarczą pliki statyczne.
"""
import json
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EMBEDDINGS = ROOT / "data" / "text-embeddings.json"
MAX_BODY = 2_000_000


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript",
                      ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path != "/__dev/save-embeddings":
            return self.send_error(404)
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            return self.send_error(403)
        length = int(self.headers.get("Content-Length", 0))
        if not 0 < length <= MAX_BODY:
            return self.send_error(413)
        try:
            data = json.loads(self.rfile.read(length))
            assert {"model", "hash", "scenes", "styles"} <= data.keys()
        except (ValueError, AssertionError):
            return self.send_error(400, "Niepoprawny JSON")
        EMBEDDINGS.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        body = json.dumps({"saved": str(EMBEDDINGS.relative_to(ROOT))}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("[liveo] " + fmt % args + "\n")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(ROOT)))
    print(f"Asystent Liveo działa na http://localhost:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
