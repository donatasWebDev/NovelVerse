import cloudscraper
from bs4 import BeautifulSoup
from .selenium_scrape import load_page
from colorama import Fore, Back, Style

def load_page_soup(url):
    scraper = cloudscraper.create_scraper(
        browser={
            'browser': 'chrome',
            'platform': 'windows',
            'mobile': False
        }
    )
    response = scraper.get(url)
    
    if response.status_code!= 200:
        print(f"Failed to retrieve page: {response.status_code}")
        return None
    
    soup = BeautifulSoup(response.text, "html.parser")
    return soup


def scrape_novel_chapter(url):

    soup = load_page_soup(url)

    # Extract novel title
    title = soup.find("h1").text.strip() if soup.find("h1") else "No title found"

    # Extract chapter content (modify based on site structure)
    content = soup.find("div", class_="chr-c")
    if content:
        paragraphs = [p.text.strip() for p in content.find_all("p")]
        text = "\n\n".join(paragraphs)
    else:
        text = "Content not found."
    
    return title, text



# Get latest chapte
def get_latest_chapter(title):
    
    with open(f"./ln_collections/{title}/latest.txt", "r", encoding='utf-8') as f:
        return f.read()
    
def save_new_chapter(title, new_chapter_url):
    try:
        with open(f"./ln_collections/{title}/latest.txt", "w", encoding='utf-8') as f:
            f.write(new_chapter_url)
    except Exception as e:
        print(f"Failed to save new chapter: {e}")  

    
def scrape_new_novel(base_url):
    
    soup = load_page_soup(base_url)
    if not soup:
        return None
    
    # Extract novel title
    title = soup.find("h3", class_="title").text.strip()
    chapters = []
    if title:
        print("title: " + title)
        chapters = scrape_all_chapters(base_url)
        print("scraping chapters: ", len(chapters))  
        if len(chapters) > 0:
            return title, chapters, base_url
    return None, None, None
 
def scrape_all_chapters(base_url):
    
    soup = load_page(base_url)
    if not soup:
        return None
    chapters = []
    #check if this novel is already scraped
    body = soup.find("div", class_="panel-body")
    rows = body.find_all("div", class_="row")
    chapter_list = soup.find_all("ul", class_="list-chapter")
    if chapter_list:
        for chapter_row in chapter_list:
            for chapter in chapter_row.find_all("li"):
                a_tag = chapter.find("a")
                chapter_url = a_tag.get("href")
                ch_title = a_tag.get("title").strip(":").strip("-").strip("\ufeff")
                chapters.append((ch_title, chapter_url))  
                
    return chapters

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
    print( Fore.RED ,F'err: {isComplete, Genres, Author, imgUrl}', Style.RESET_ALL)
    return None

         
     
     
        
def load_chapters(chapters):
    chapter_nr = input(f"Enter chapter number from to 1-{len(chapters)}: " + Style.RESET_ALL )
    if chapter_nr.isdigit() and int(chapter_nr)-1 <= len(chapters):
        selected_ch = int(chapter_nr)-1
    else:
        print("Invalid chapter number.")
        return
            
    ch_title, ch_url = chapters[selected_ch]
    title, text = scrape_novel_chapter(ch_url)
    if text and title:
        return text, title, selected_ch+1
    else:
        print(f"Chapter {selected_ch+1} not found.")
