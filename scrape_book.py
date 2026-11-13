import os
import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

BASE_URL = "https://online.fliphtml5.com/toiyeusinhhoc/dfzu/"
PAGES_JSON = "pages.json"
OUTPUT_DIR = "downloaded_pages"
OUTPUT_PDF = "biology_a_global_approach_11th_edition_part1.pdf"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": BASE_URL,
}

def download_page(page_num, path, retries=5):
    filename = os.path.join(OUTPUT_DIR, f"page_{page_num:03d}.webp")
    if os.path.exists(filename) and os.path.getsize(filename) > 1000:
        return page_num, True

    url = BASE_URL + path
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            if resp.status_code == 200 and len(resp.content) > 1000:
                with open(filename, "wb") as f:
                    f.write(resp.content)
                return page_num, True
            else:
                time.sleep(1)
        except Exception as e:
            if attempt == retries - 1:
                print(f"[Error] Failed page {page_num}: {e}")
                return page_num, False
            time.sleep(1)
    return page_num, False

def build_pdf(page_files, output_pdf):
    print(f"Compiling {len(page_files)} pages into PDF: {output_pdf}...")
    # Open images and convert to RGB
    images = []
    first_image = None

    for i, path in enumerate(page_files):
        img = Image.open(path)
        if img.mode != "RGB":
            img = img.convert("RGB")
        if first_image is None:
            first_image = img
        else:
            images.append(img)
        if (i + 1) % 50 == 0:
            print(f"  Processed {i + 1}/{len(page_files)} pages...")

    first_image.save(
        output_pdf,
        "PDF",
        resolution=100.0,
        save_all=True,
        append_images=images
    )

    # Close all images
    first_image.close()
    for img in images:
        img.close()
        
    print(f"Successfully generated: {output_pdf} ({os.path.getsize(output_pdf) / (1024*1024):.2f} MB)")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(PAGES_JSON, "r") as f:
        paths = json.load(f)

    total = len(paths)
    print(f"Total pages to download: {total}")

    success_count = 0
    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = {
            executor.submit(download_page, idx + 1, path): idx + 1
            for idx, path in enumerate(paths)
        }
        for future in as_completed(futures):
            p_num, ok = future.result()
            if ok:
                success_count += 1
            if success_count % 50 == 0 or success_count == total:
                print(f"Downloaded {success_count}/{total} pages...")

    if success_count != total:
        print(f"Warning: Only {success_count}/{total} pages downloaded successfully.")

    page_files = [
        os.path.join(OUTPUT_DIR, f"page_{i:03d}.webp")
        for i in range(1, total + 1)
        if os.path.exists(os.path.join(OUTPUT_DIR, f"page_{i:03d}.webp"))
    ]

    build_pdf(page_files, OUTPUT_PDF)

if __name__ == "__main__":
    main()
