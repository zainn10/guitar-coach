"""Builds a macOS .icns file from PNGs (icns can hold PNG data directly)."""
import struct, sys
out, *pairs = sys.argv[1:]  # pairs: TYPE=path.png
chunks = b''
for p in pairs:
    t, path = p.split('=')
    data = open(path, 'rb').read()
    chunks += t.encode() + struct.pack('>I', len(data) + 8) + data
open(out, 'wb').write(b'icns' + struct.pack('>I', len(chunks) + 8) + chunks)
