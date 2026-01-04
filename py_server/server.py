import json
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests


app = Flask(__name__)
CORS(app)

# URL = os.getenv("NODE_BACK_URL", "http://host.docker.internal:4000")
URL = "http://localhost:4000/api"

@app.route('/get/books', methods=['GET'])
def send_book():
    try:
        with open("scarping/fanmtl_novels.jsonl", "r", encoding="utf-8") as file:
            books = []
            readed_books = []
            duplicate_books = []
            for index,line in enumerate(file):
                book = json.loads(line.strip())
                try:
                    response = requests.post(f"{URL}/lib/add/book", json=book, timeout=5)
                    response.raise_for_status()
                except requests.exceptions.Timeout:
                    print(f"Timeout when sending book: {book}")
                    break
                except requests.exceptions.RequestException as e:
                    print(f"Error sending book: {book}, error: {e}")
                    break
                if book not in books:
                    readed_books.append(book)
                else:
                    duplicate_books.append(book)
                books.append(book)
                print(f"{index}/     {book}")
            file.close()
            print("dublicatebooks = ",duplicate_books, ",", len(duplicate_books))
            if len(books) > 0:
                return jsonify({"books": books})  # Send the JSON file as an attachment
        return jsonify({"message": "No books found"}), 404  # ✅ Added response
    except Exception as e:
        print(f"Failed to send books to library: {e}")

@app.route("/", methods=["GET"])
def get_index():
    return "hello world"

@app.route('/get/chapters', methods=['PUT'])
def send_chapters():
    try:
        if not request.json:
            print("No data provided")
            return jsonify({"error": "No data provided"}), 400  # ✅ Added response
        
        print(request.json)
        book_url = request.json.get('bookURL')  # ✅ Use .get() to avoid KeyError

        if not book_url:
            print("No book URL provided")
            return jsonify({"error": "No book URL provided"}), 400  # ✅ Added response

    except Exception as e:
        print(f"Failed to send chapters to library: {e}")
        return jsonify({"error": f"Failed to send chapters: {str(e)}"}), 500  # ✅ Added return

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4001, debug=True)