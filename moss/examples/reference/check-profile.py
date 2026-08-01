#!/usr/bin/env python3
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
manifest = json.loads((root / "manifest.json").read_text())
tokens = json.loads((root / "system/tokens.json").read_text())
assert manifest["sourceCount"] == len(manifest["sources"]) == 14
assert tokens["themes"]["light"]["color"]["surface"]["canvas"] == "#FAF9F7"
assert tokens["themes"]["dark"]["color"]["surface"]["canvas"] == "#0A0A0F"
assert tokens["shared"]["component"]["reasoning"]["connectorWidth"] == "1.25px"
for path in manifest["entrypoints"].values():
    assert (root / path).exists(), path
print("moss profile: ok")
