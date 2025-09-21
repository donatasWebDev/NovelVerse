import time
import timeit
import asyncio
import json
import re
# import cloudscraper
from colorama import Fore, Back, Style
from scrape import scrape_novel_info,load_page_soup
from bs4 import BeautifulSoup
 

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://google.com",
    "Accept-Language": "en-US,en;q=0.9",
}


#scrapes all novels for novel bin
def scrape_all_novels(url):

    response = load_page_soup(url)
    
    
    
    if response.status_code != 200:
        print(f"Failed to retrieve page: {response.status_code}")
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    if soup:
        el = soup.find("div", class_="list list-novel col-xs-12")
        rows = el.find_all("div", class_="row")
        max_novel = 0
        with open("novel_list_realtime", "a", encoding='utf-8') as f:
            for row in rows:
                title = None
                base_url = None
                max_ch = None
        
                title_el = row.find("h3", class_="novel-title") # getting title and base_url
                if title_el:
                    a_tag = title_el.find("a")
                    if a_tag:
                        title = a_tag.text.strip()
                        base_url = a_tag.get("href")
                else:
                    print("Title element not found.")
                    continue
                ch_el = row.find("span", class_="chr-text chapter-title")
                if ch_el:
                    if not ch_el.get("data-chapter_id"):
                        print("Chapter id not found.")
                        continue
                    ch_title = ch_el.get("data-chapter_id").strip().split("-")
                    if len(ch_title) < 2:
                        print("Chapter title not found.")
                        continue
                    max_ch = ch_title[1]
                    
                else:
                    print("Title element not found.")
                    continue
                max_novel += 1
                novels.append((title, base_url, max_ch))
                f.write(f"{title} && {base_url} && {max_ch}\n")
            f.close()
        return max_novel

def scrape_all_novels_data(page_url):
    with open("scraped_pages.txt", "a") as f:
        f.write(f"{page_url}\n")
        f.close()
        
    print(f"Trying to scrape page: {page_url}")
    try:
        
        soup = load_page_soup(page_url)
        
        if soup:
            el = soup.find("div", class_="list list-novel col-xs-12")
            rows = el.find_all("div", class_="row")
            max_novel = 0
            with open("novel_list_realtime.jsonl", "a", encoding='utf-8') as f:
                for row in rows:
                    title = None
                    base_url = None
                    ch_title = None
                    data = {}
            
                    url_el = row.find("h3", class_="novel-title") # getting title and base_url
                    if url_el:
                        a_tag = url_el.find("a")
                        if a_tag:
                            title = a_tag.text.strip()
                            base_url = a_tag.get("href")
                    else:
                        print("Title element not found.")
                        continue
                    ch_el = row.find("span", class_="chr-text chapter-title")
                    if ch_el:
                        ch_title = ch_el.text.strip()
                        if not ch_title:
                            print(f"Chapter id not found./ {ch_title}")
                            continue
                        
                    else:
                        print("Title element not found.")
                        continue
                    
                    if base_url:
                        time.sleep(1)
                        isComplete, Genres, Author, imgUrl = scrape_novel_info(base_url)
                        if not imgUrl:
                            print(Fore.RED + f"No data found for {base_url}" + Style.RESET_ALL)
                            continue
                    # Remove matches
                    title_cleaned = re.sub(r'[\"?*]', '', title)
                    obj = {
                        "title": title_cleaned,
                        "author": Author,
                        "category": Genres,
                        "isComplete": isComplete,
                        "coverImg": imgUrl,
                        "bookURL": base_url,
                        "numberOfChapters": ch_title,          
                    }
                    
                    max_novel += 1
                    novels.append(obj)
                    f.write(json.dumps(obj, ensure_ascii=False) + "\n")
                    print(Fore.GREEN , obj , Style.RESET_ALL)
                f.close()
            print(max_novel)
            return max_novel
    except Exception as e:
        if e != 403:
            print(Fore.RED + f"Err getting  Request: {e}" + Style.RESET_ALL)
     
novels = [] 
LATEST_BASE_URL = "https://novelbin.me/sort/novelbin-daily-update?page=435".strip().split("=")
max_pages = int(LATEST_BASE_URL[1])

for i in range(1, max_pages+1):  # Make sure to loop over the correct range
    time.sleep(1)  # to avoid being blocked by the website
    
    # Use await to fetch data from the coroutine function
    max_novel = scrape_all_novels_data(LATEST_BASE_URL[0] + f"={i}")
    print(Fore.BLUE, f"Scraping page {i}/{max_pages}\n got novels {max_novel}/20", Style.RESET_ALL)
    
with open("novel_list_all.json", "w", encoding='utf-8') as f:
    json.dump(novels, f, indent=4, ensure_ascii=False)
    f.close()

