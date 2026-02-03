from seleniumbase import Driver
import time
import logging
from bs4 import BeautifulSoup
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

ENV = os.getenv("ENVIRONMENT", "dev").lower()

def load_page(url):
    try:
        # SeleniumBase UC mode - strongest bypass for Cloudflare 2025
        driver = Driver(
            uc=True,  # Undetected mode - key for bypass
            headless=(ENV == "prod"),  # Visible in dev, headless in prod
            incognito=False,
            agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",  # Real UA
            locale_code="en",
            do_not_track=False,
        )

        if ENV == "dev":
            driver.maximize_window()

        driver.get(url)
        logging.info(f"Loading {url} - waiting for Cloudflare bypass...")

        # Give time for uc to solve challenge (10-30s typical)
        time.sleep(15)  # Adjust up if needed - watch in dev visible mode

        # Extra check/reload if still challenge
        if "Just a moment" in driver.page_source or "cloudflare" in driver.current_url.lower():
            logging.warning("Challenge detected - waiting longer...")
            time.sleep(15)
            driver.get(url)  # Reload sometimes helps

        html_content = driver.page_source

        soup = BeautifulSoup(html_content, 'html.parser')

        if "Just a moment" in soup.text:
            logging.error("Failed to bypass Cloudflare challenge")
            return None

        logging.info("Bypassed Cloudflare - chapter loaded!")
        return soup

    except Exception as e:
        logging.error(f"Error: {e}")
        return None

    finally:
        if ENV == "prod":
            driver.quit()
        else:
            logging.info("DEV: Browser open for inspection/video")
            # Keep open in dev