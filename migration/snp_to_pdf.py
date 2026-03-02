#!/usr/bin/env python3
"""
snp_to_pdf.py - Convert Microsoft Access Snapshot (.snp) files to PDF

Requirements:
    python3 -m pip install olefile "img2pdf==0.4.4"
    sudo apt install inkscape cabextract imagemagick libwmf-bin

Usage:
    python3 snp_to_pdf.py input.snp output.pdf
"""

import sys
import os
import subprocess

def check_dependencies():
    errors = []
    try:
        import olefile
    except ImportError:
        errors.append("Missing: python3 -m pip install olefile")
    try:
        import img2pdf
    except ImportError:
        errors.append("Missing: python3 -m pip install img2pdf==0.4.4")
    if subprocess.run(["which", "inkscape"], capture_output=True).returncode != 0:
        errors.append("Missing: sudo apt install inkscape")
    if subprocess.run(["which", "cabextract"], capture_output=True).returncode != 0:
        errors.append("Missing: sudo apt install cabextract")
    if errors:
        print("Missing dependencies:")
        for e in errors:
            print(f"  {e}")
        sys.exit(1)

def is_cab_file(path):
    with open(path, "rb") as f:
        return f.read(4) == b"MSCF"

def extract_emf_from_cfbf(snp_path, out_dir):
    import olefile
    ole = olefile.OleFileIO(snp_path)
    pages = []
    for entry in ole.listdir():
        name = entry[0] if len(entry) == 1 else "/".join(entry)
        lower = name.lower()
        if "page" in lower or lower.startswith("p"):
            try:
                data = ole.openstream(entry).read()
                if len(data) > 40:
                    pages.append((name, data))
            except Exception:
                pass
    if not pages:
        for entry in ole.listdir():
            try:
                name = entry[0] if len(entry) == 1 else "/".join(entry)
                if name.upper() == "HEADER":
                    continue
                data = ole.openstream(entry).read()
                if len(data) > 1000:
                    pages.append((name, data))
            except Exception:
                pass
    ole.close()
    pages.sort(key=lambda x: x[0])
    emf_files = []
    for i, (name, data) in enumerate(pages):
        emf_path = os.path.join(out_dir, f"page_{i+1:04d}.emf")
        with open(emf_path, "wb") as f:
            f.write(data)
        emf_files.append(emf_path)
        print(f"  Extracted page {i+1}: {name} ({len(data)} bytes)")
    return emf_files

def extract_emf_from_cab(snp_path, out_dir):
    result = subprocess.run(
        ["cabextract", "-d", out_dir, snp_path],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"cabextract failed: {result.stderr}")

    extracted = sorted([os.path.join(out_dir, f) for f in os.listdir(out_dir)])
    emf_files = [f for f in extracted if f.lower().endswith(".emf")]
    if emf_files:
        return sorted(emf_files)

    # Check for inner SNP file
    snp_files = [f for f in extracted if f.lower().endswith(".snp")]
    for inner_snp in snp_files:
        inner_dir = inner_snp + "_extracted"
        os.makedirs(inner_dir, exist_ok=True)
        if is_cab_file(inner_snp):
            subprocess.run(["cabextract", "-d", inner_dir, inner_snp], capture_output=True)
            emf_files = sorted([
                os.path.join(inner_dir, f)
                for f in os.listdir(inner_dir)
                if f.lower().endswith(".emf")
            ])
            if emf_files:
                return emf_files
        else:
            try:
                return extract_emf_from_cfbf(inner_snp, inner_dir)
            except Exception:
                pass

    return []

def emf_to_png_inkscape(emf_path, png_path):
    try:
        result = subprocess.run(
            ["inkscape", emf_path, "--export-type=png",
             f"--export-filename={png_path}", "--export-dpi=150"],
            capture_output=True, text=True, timeout=60
        )
        if os.path.exists(png_path) and os.path.getsize(png_path) > 0:
            return True
        # Old inkscape syntax
        result = subprocess.run(
            ["inkscape", f"--export-png={png_path}", "--export-dpi=150", emf_path],
            capture_output=True, text=True, timeout=60
        )
        return os.path.exists(png_path) and os.path.getsize(png_path) > 0
    except Exception:
        return False

def emf_to_png_imagemagick(emf_path, png_path):
    try:
        result = subprocess.run(
            ["convert", "-density", "150", emf_path, png_path],
            capture_output=True, text=True, timeout=60
        )
        return os.path.exists(png_path) and os.path.getsize(png_path) > 0
    except Exception:
        return False

def emf_to_png(emf_path, png_path):
    if emf_to_png_inkscape(emf_path, png_path):
        return "inkscape"
    if os.path.exists(png_path):
        os.remove(png_path)
    if emf_to_png_imagemagick(emf_path, png_path):
        return "imagemagick"
    raise RuntimeError(f"Both inkscape and imagemagick failed for {os.path.basename(emf_path)}")

def convert(snp_path, pdf_path):
    import img2pdf

    check_dependencies()
    print(f"Converting: {snp_path}")

    base = os.path.splitext(pdf_path)[0]
    work_dir = base + "_workdir"
    os.makedirs(work_dir, exist_ok=True)
    print(f"Work directory: {work_dir}")

    # Step 1: Extract EMF pages
    if is_cab_file(snp_path):
        print("Format: CAB-based SNP")
        emf_files = extract_emf_from_cab(snp_path, work_dir)
    else:
        print("Format: CFBF-based SNP")
        emf_files = extract_emf_from_cfbf(snp_path, work_dir)

    if not emf_files:
        print("ERROR: No EMF pages found in SNP file.")
        sys.exit(1)

    print(f"\nFound {len(emf_files)} page(s). Converting to PNG...")

    # Step 2: Convert EMF -> PNG (skip already-converted pages)
    png_files = []
    failed_pages = []
    for i, emf in enumerate(emf_files):
        png = emf.replace(".emf", ".png")
        if os.path.exists(png) and os.path.getsize(png) > 0:
            print(f"  Page {i+1}/{len(emf_files)}... already done, skipping")
            png_files.append(png)
            continue
        print(f"  Page {i+1}/{len(emf_files)}...", end=" ", flush=True)
        try:
            method = emf_to_png(emf, png)
            png_files.append(png)
            print(f"OK ({method})")
        except Exception as e:
            print(f"FAILED: {e}")
            failed_pages.append(i + 1)

    if failed_pages:
        print(f"\nWARNING: {len(failed_pages)} page(s) failed: {failed_pages}")

    if not png_files:
        print("ERROR: No pages converted successfully.")
        sys.exit(1)

    # Step 3: Merge PNGs into PDF
    print(f"\nMerging {len(png_files)} page(s) into PDF...")
    with open(pdf_path, "wb") as f:
        f.write(img2pdf.convert(sorted(png_files)))

    print(f"\nDone! Output: {pdf_path}")
    print(f"Pages in PDF: {len(png_files)}")
    if failed_pages:
        print(f"Missing pages: {failed_pages}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 snp_to_pdf.py input.snp output.pdf")
        sys.exit(1)

    snp_path = sys.argv[1]
    pdf_path = sys.argv[2]

    if not os.path.exists(snp_path):
        print(f"Error: File not found: {snp_path}")
        sys.exit(1)

    convert(snp_path, pdf_path)
