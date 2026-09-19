#!/usr/bin/env bash
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# P1 bounded corpus builder. Every PDF passes through qpdf.
# Output: tests/e2e/corpus/{small-1p,medium-20p,large-168p,encrypted,corrupt,image-scan,form}.pdf
set -euo pipefail

OUT="${1:-tests/e2e/corpus}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/$OUT"
mkdir -p "$DIR"

if ! command -v qpdf >/dev/null 2>&1; then
  echo "ERROR: qpdf not found. Install it first (apt: sudo apt-get install qpdf)." >&2
  exit 1
fi
if ! python3 -c "import reportlab, PIL" 2>/dev/null; then
  echo "ERROR: python3 needs reportlab + Pillow (pip install reportlab Pillow)." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- 1. Base 1-page PDF via reportlab -------------------------------------
python3 - "$TMP/base-1p.pdf" <<'PY'
import sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
out = sys.argv[1]
c = canvas.Canvas(out, pagesize=A4)
c.setTitle("corpus small-1p")
c.setFont("Helvetica", 14)
c.drawString(72, 780, "Private Toolbox corpus — small-1p")
c.setFont("Helvetica", 10)
c.drawString(72, 760, "On-device E2E fixture. One page, selectable text.")
c.drawString(72, 744, "The quick brown fox jumps over the lazy dog. 0123456789.")
c.showPage()
c.save()
PY

# Every artefact below is (re)written by qpdf — never a raw reportlab file.
qpdf --object-streams=disable "$TMP/base-1p.pdf" "$DIR/small-1p.pdf"

# --- 2/3. medium-20p + large-168p via qpdf page repetition -----------------
# Space-safe: build argv arrays (repo root contains a space).
make_pages_array() { # $1=file $2=count $3=nameref -> ("$file" 1) x count
  local -n _out=$3
  _out=()
  local i
  for ((i = 0; i < $2; i++)); do _out+=("$1" "1"); done
}

make_pages_array "$DIR/small-1p.pdf" 20 pargs20
qpdf --empty --pages "${pargs20[@]}" -- "$TMP/medium-20p.pdf"
qpdf --object-streams=disable "$TMP/medium-20p.pdf" "$DIR/medium-20p.pdf"

make_pages_array "$DIR/small-1p.pdf" 168 pargs168
qpdf --empty --pages "${pargs168[@]}" -- "$TMP/large-168p.pdf"
qpdf --object-streams=disable "$TMP/large-168p.pdf" "$DIR/large-168p.pdf"

# --- 4. encrypted (user+owner password: test123) via qpdf ------------------
qpdf --allow-weak-crypto --encrypt test123 test123 128 -- "$DIR/small-1p.pdf" "$DIR/encrypted.pdf"

# --- 5. corrupt: truncated mid-stream + garbage (must fail --check) ---------
head -c 512 "$DIR/small-1p.pdf" > "$DIR/corrupt.pdf"
printf '\n%%CORRUPT-TRUNCATED-FIXTURE\n' >> "$DIR/corrupt.pdf"

# --- 6. image-scan: raster "scan" page embedded as PDF, via qpdf -----------
python3 - "$TMP/scan.png" "$TMP/image-scan.raw.pdf" <<'PY'
import sys
from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
png, pdf = sys.argv[1], sys.argv[2]
img = Image.new("RGB", (1240, 1754), "white")
d = ImageDraw.Draw(img)
d.rectangle([60, 60, 1180, 1694], outline="black", width=4)
for i, y in enumerate(range(160, 1600, 48)):
    d.line([120, y, 1120 - (i % 3) * 140, y], fill="black", width=3)
d.text((120, 90), "SCANNED IMAGE FIXTURE (no text layer)", fill="black")
img.save(png, "PNG")
c = __import__("reportlab.pdfgen.canvas", fromlist=["Canvas"]).Canvas(pdf, pagesize=A4)
c.drawImage(ImageReader(png), 0, 0, width=A4[0], height=A4[1])
c.showPage(); c.save()
PY
qpdf --object-streams=disable "$TMP/image-scan.raw.pdf" "$DIR/image-scan.pdf"

# --- 7. form: AcroForm with text field + checkbox, via qpdf ----------------
python3 - "$TMP/form.raw.pdf" <<'PY'
import sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
out = sys.argv[1]
c = canvas.Canvas(out, pagesize=A4)
c.setFont("Helvetica", 14)
c.drawString(72, 780, "Private Toolbox corpus — form")
c.setFont("Helvetica", 11)
c.drawString(72, 740, "Name:")
c.acroForm.textfield(name="name", x=130, y=725, width=300, height=24,
                     fontName="Helvetica", fontSize=11)
c.drawString(72, 690, "Agree:")
c.acroForm.checkbox(name="agree", x=130, y=685, size=18)
c.showPage(); c.save()
PY
qpdf --object-streams=disable --qdf "$TMP/form.raw.pdf" "$DIR/form.pdf"

# --- verify ---------------------------------------------------------------
echo "corpus: $DIR"
for f in small-1p medium-20p large-168p encrypted corrupt image-scan form; do
  sz=$(stat -c%s "$DIR/$f.pdf")
  pg=$(qpdf --show-npages "$DIR/$f.pdf" 2>/dev/null || echo "?")
  if [ "$f" = "corrupt" ] || [ "$f" = "encrypted" ]; then
    echo "  $f.pdf  ${sz}B  pages=$pg  (expected: --check fails/needs password)"
  else
    qpdf --check "$DIR/$f.pdf" >/dev/null
    echo "  $f.pdf  ${sz}B  pages=$pg  --check OK"
  fi
done
echo "page counts: $(qpdf --show-npages "$DIR/small-1p.pdf") / $(qpdf --show-npages "$DIR/medium-20p.pdf") / $(qpdf --show-npages "$DIR/large-168p.pdf") (expect 1 / 20 / 168)"
