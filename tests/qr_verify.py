"""Encode the share URLs into real QR codes (OpenCV) and decode them back.
Run after `node tests/run.mjs` (which writes tests/.qr-urls.json).
Mirrors the app's QR settings: ECC level L, 400px, 4-module quiet zone."""
import json, sys, cv2, numpy as np
urls = json.load(open('tests/.qr-urls.json'))
enc_params = cv2.QRCodeEncoder_Params(); enc_params.correction_level = cv2.QRCodeEncoder_CORRECT_LEVEL_L
def roundtrip(label, url):
    enc = cv2.QRCodeEncoder.create(enc_params)
    qr = enc.encode(url)
    if qr is None: print(f'FAIL {label}: could not encode'); return False
    modules = qr.shape[0]
    # scale to ~400px with a 4-module quiet zone, like the app requests
    scale = max(1, 400 // (modules + 8))
    img = cv2.resize(qr, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
    pad = 4 * scale
    img = cv2.copyMakeBorder(img, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=255)
    text, pts, _ = cv2.QRCodeDetector().detectAndDecode(img)
    ok = (text == url)
    print(f"{'PASS' if ok else ('UNREADABLE' if 'contrast' in label else 'FAIL')} {label}: {len(url)} chars -> {modules}x{modules} modules, module size {scale}px, decoded==url: {ok}")
    return ok
res = [roundtrip('short share URL', urls['short']),
       roundtrip('legacy-style URL (truncated to 2900 chars, for contrast)', urls['legacy'])]
sys.exit(0 if res[0] else 1)
