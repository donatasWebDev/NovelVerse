import cloudscraper
from bs4 import BeautifulSoup
from colorama import Fore, Back, Style
import requests  # explicit import for exceptions


import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def load_page_soup(url):
    # Clean scraper – no debug spam, modern fingerprint
    scraper = cloudscraper.create_scraper(
        browser={
            'browser': 'chrome',
            'platform': 'windows',
            'mobile': False,
            'desktop': True
        },
        delay=10  # Still good for challenge timing
    )

    try:
        response = scraper.get(url, timeout=30)
        
        if response.status_code != 200:
            print(f"Response Code: {response.status_code}")
            logging.info(f"Failed to retrieve page [{url}]: {response.status_code}")
            logging.error(f"Error snippet: {response.text[:800]}")  # Short peek at CF block page
            return None

        # Optional: quiet success confirmation (remove if you want total silence)
        logging.info(f"Successfully loaded: {url} ({len(response.text)} chars)")

    except cloudscraper.exceptions.CloudflareChallengeError as e:
        logging.error(f"Cloudflare challenge failed after retries [{url}]: {e}")
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"Network/request error [{url}]: {e}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error scraping [{url}]: {e}")
        return None

    # Parse and return
    soup = BeautifulSoup(response.text, "html.parser")
    return soup


def scrape_novel_chapter(url):
    soup = load_page_soup(url)
    if not soup:
        logging.error("Failed to load chapter page.")
        return None

    content_div = soup.find('div', class_='chapter-content')
    if not content_div:
        content_div = soup.find('div', id='chapter-content')  # fallback
    if not content_div:
        logging.error("Chapter content div not found.")
        return None

    # 2. Get raw text, ignoring all tags completely
    raw_text = content_div.get_text(separator='\n', strip=True)

    # 3. Clean up multiple newlines and extra spaces
    lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
    clean_text = '\n\n'.join(lines)

    # Optional: fix common bullshit like double spaces or weird chars
    clean_text = clean_text.replace('  ', ' ').replace('\r', '')
    return clean_text.strip()

def get_chapter_url(base_url, ch_nr):
    """
    Generate full chapter URL for fanmtl.com
    base_url: the book's base URL from metadata (e.g., "https://www.fanmtl.com/novel/slug.html")
    ch_nr: chapter number (int, 1 to numberOfChapters)
    Returns: full chapter URL string
    """
    if not base_url.endswith(".html"):
        logging.warning(f"Base URL doesn't end with .html: {base_url}")
        return None

    # Insert _{ch_nr} before .html
    full_url = base_url.replace(".html", f"_{ch_nr}.html")
    
    logging.info(f"Generated chapter {ch_nr} URL: {full_url}")
    return full_url




def scrape_novel_info(base_url):
    soup = load_page_soup(base_url)
    isComplete = None
    Genres = []
    Author = ""
    imgUrl = ""
    if soup:
        container_el = soup.find("ul", class_="info info-meta")
        if container_el:
            li_el = container_el.find_all("li")
            if len(li_el) > 1:
                for li in li_el:
                    #get Authors name
                    if li.find("h3").text.strip() == "Author:":
                        Author = li.find("a").text.strip()
                    #Get Genres
                    if li.find("h3").text.strip() == "Genre:":
                        Genres = [a.text.strip() for a in li.find_all("a")]
                    #Check if Novel is Complete
                    if li.find("h3").text.strip() == "Status:":
                        if li.find("a").text.strip() == "Ongoing":
                            isComplete = False
                        else:
                            isComplete = True
        # cover_el = soup.find("div", class_="book")
        # if cover_el:
        imgUrl = soup.find("img", class_="lazy").get("data-src")   
        if imgUrl == "":
            imgUrl = "No image found."
        if isComplete != None and len(Genres) > 0 and Author != ""  and imgUrl != "":
            return isComplete, Genres, Author, imgUrl
    logging.error(f"{Fore.RED} err: {isComplete, Genres, Author, imgUrl} {Style.RESET_ALL}")
    return None

         
     
     
        
def load_chapters(chapters):
    chapter_nr = input(f"Enter chapter number from to 1-{len(chapters)}: " + Style.RESET_ALL )
    if chapter_nr.isdigit() and int(chapter_nr)-1 <= len(chapters):
        selected_ch = int(chapter_nr)-1
    else:
        logging.error(f"Invalid chapter number.")
        return
            
    ch_title, ch_url = chapters[selected_ch]
    title, text = scrape_novel_chapter(ch_url)
    if text and title:
        return text, title, selected_ch+1
    else:
        logging.error(f"Chapter {selected_ch+1} not found.")
