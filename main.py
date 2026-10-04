
import requests
import os
from dotenv import load_dotenv
from google import genai
from supabase import create_client

load_dotenv()

gemini_key = os.getenv("GEMINI_API_KEY")
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

gemini = genai.Client(api_key=gemini_key)
supabase = create_client(supabase_url, supabase_key)

settings = supabase.table("settings").select("*").eq("id", 1).execute()

user_settings = settings.data[0]

language = user_settings["language"]
words_per_day = user_settings["words_per_day"]

print("Language:", language)
print("Words per day:", words_per_day)

for i in range(words_per_day):

    url = f"https://random-word-api.herokuapp.com/word?number=1&diff=3"

    response = requests.get(url)

    if response.status_code != 200:
        print("Failed to fetch the word.")
        continue

    word = response.json()[0]

    prompt = f"""
Give me the meaning of the English word "{word}"
and one simple, meaningful example sentence using the word.

Format your response exactly like this:

Meaning: <meaning>
Example: <example sentence>
"""

    result = gemini.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt
    )

    text = result.text

    print("\nWord:", word)
    print(text)

    lines = text.split("\n")

    meaning = ""
    example = ""

    for line in lines:
        if line.startswith("Meaning:"):
            meaning = line.replace("Meaning:", "").strip()

        elif line.startswith("Example:"):
            example = line.replace("Example:", "").strip()

    supabase.table("vocabulary").insert({
        "word": word,
        "meaning": meaning,
        "example": example,
        "language": language
    }).execute()

    print("Saved to Supabase.")

