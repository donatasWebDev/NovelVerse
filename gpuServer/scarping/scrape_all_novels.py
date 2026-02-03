import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
import time
import random
import json
import re
import logging
from colorama import Fore, Style

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

ua = UserAgent()
BASE_URL = "https://www.fanmtl.com"
JSONL_FILE = "fanmtl_novels.jsonl"
PAGE_FILE = "latest_page.txt"

novels = []

def get_last_page():
    try:
        with open(PAGE_FILE, "r") as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return 0  # Start from page 1 if no file or invalid

def save_last_page(page):
    with open(PAGE_FILE, "w") as f:
        f.write(str(page))

def load_page_soup(url):
    headers = {"User-Agent": ua.random}
    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code == 200:
            return BeautifulSoup(response.text, 'html.parser')
        logging.warning(f"HTTP {response.status_code} on {url}")
        return None
    except Exception as e:
        logging.error(f"Request error {url}: {e}")
        return None

def scrape_page(page_num):
    url = f"{BASE_URL}/list/all/all-newstime-{page_num}.html"  # Confirmed working pattern
    soup = load_page_soup(url)
    if not soup:
        return 0

    # Repeating novel items - flexible for fanmtl structure
    items = soup.find_all("div", class_=re.compile(r"novel-item|item|list-item", re.I)) or soup.find_all("li")

    added = 0
    with open(JSONL_FILE, "a", encoding="utf-8") as f:
        for item in items:
            a_tag = item.find("a", href=re.compile(r"/novel/"))
            if not a_tag:
                continue

            book_url = a_tag['href']
            if not book_url.startswith("http"):
                book_url = BASE_URL + book_url

            title = re.sub(r'[\"?*<>|]', '', a_tag.get("title") or a_tag.text.strip() or "Unknown")

            img_tag = item.find("img")
            cover_img = None
            if img_tag:
                # Priority: data-src > data-original > src (fallback placeholder)
                cover_img = img_tag.get('data-src') or img_tag.get('data-original') or img_tag.get('src')
                if cover_img and not cover_img.startswith("http"):
                    cover_img = BASE_URL + cover_img
                # Skip if still placeholder
                if cover_img and "placeholder" in cover_img:
                    cover_img = None  # Or keep as placeholder if you want

            text = item.get_text(separator=" ")
            chapters_match = re.search(r'(\d+)\s*Chapters?', text, re.I)
            num_chapters = int(chapters_match.group(1)) if chapters_match else 0

            is_complete = "Completed" in text or "Complete" in text

            author = "Unknown"  # Often missing on list

            categories = []
            tag_as = item.find_all("a", href=re.compile(r"/tag/|/genre/"))
            for tag_a in tag_as:
                categories.append(tag_a.text.strip())

            novel_data = {
                "title": title,
                "author": author,
                "category": categories,
                "isComplete": is_complete,
                "coverImg": cover_img,
                "bookUrl": book_url,
                "numberOfChapters": num_chapters
            }

            json.dump(novel_data, f, ensure_ascii=False)
            f.write("\n")

            novels.append(novel_data)
            added += 1
            logging.info(f"{Fore.GREEN}{title} - {num_chapters} chapters{Style.RESET_ALL}")

    return added

# MAIN CRAWL WITH REDUNDANCY
max_pages = 500
start_page = get_last_page() + 1  # Resume from next
total = 0

logging.info(f"Resuming from page {start_page}/{max_pages}")

for page in range(start_page, max_pages + 1):
    logging.info(f"Scraping page {page}/{max_pages}")
    added = scrape_page(page)
    if added == 0:
        logging.warning("No novels added - possible bad page or block - pausing longer")
        time.sleep(10)
    total += added
    logging.info(f"Page {page} done - {added} novels - Total: {total}")

    save_last_page(page)  # Save progress after success

    time.sleep(random.uniform(1.5, 3.5))  # Polite delay

logging.info(f"Crawl complete! {total} novels in {JSONL_FILE}")
logging.info(f"Last page saved: {get_last_page()}")

# Optional full JSON dump
with open("fanmtl_all.json", "w", encoding="utf-8") as f:
    json.dump(novels, f, indent=4, ensure_ascii=False)