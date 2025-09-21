import requests
import json
from scrape import *
URL = "http://localhost:4000/api"
def send_book_to_libary(book):
    try:
        # Send book to the library API
        response = requests.post(f"{URL}/lib/add/book", json=book)
        
    except Exception as e:
        print(f"Failed to send book to library: {e}")
    

def send_chapter_list(base_url, data):
    try:
        # Send chapter list to the library API

        response = requests.post(f"{URL}/lib/add/chapters", json={"chList": data})
        
    except Exception as e:
        print(f"Failed to send chapter list to library: {e}")
        
        
def get_chapter_info():
    print("nothing")
#tesing
# with open("sample.jsonl", "r", encoding='utf-8') as file:
#     for line in file:
#         book = json.loads(line.strip())  # Load each line as a JSON object
#         ch_list = scrape_all_chapters(book["bookURL"])
#         if len(ch_list) > 0:
#             get_chapter_list(ch_list)
            
            
            #I THINK EXPRES API DOESN HAVE THIS GET ALL CHAPTERS




