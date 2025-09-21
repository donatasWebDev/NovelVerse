from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
import undetected_chromedriver as uc
import time
from bs4 import BeautifulSoup
from fake_useragent import UserAgent

uc.TARGET_VERSION = 134
# Set up Selenium with headless mode (no browser window)
# chrome_options = Options()
# chrome_options.add_argument("--headless")  # Running in headless mode (optional)
# chrome_options.add_argument("--disable-gpu")  # For Windows OS





# Set up the WebDriver (adjust path to your ChromeDriver)
# driver = webdriver.Chrome(options=chrome_options, executable_path='./chromedriver.exe')

  
def load_page(url):
    ua = UserAgent()
    options = uc.ChromeOptions()

    options.add_argument(f"--user-agent={ua.random}")
    options.add_argument("--headless=new")  # Optional: Run headless
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-blink-features=AutomationControlled")  # Helps avoid detection
    
    driver = uc.Chrome(options=options)

    # service = Service(executable_path = "./chromedriver.exe")
    # driver = webdriver.Chrome(service=service, options=chrome_options)
    
    driver.get(url)

    # Wait for the page to load completely, adjust time if needed
    time.sleep(1)
    # Now, you can either:
    # - Capture the page's HTML after it has loaded
    html_content = driver.page_source
    driver.quit()

    # Parse the HTML content using BeautifulSoup
    soup = BeautifulSoup(html_content, 'html.parser')
    if soup:
        return soup