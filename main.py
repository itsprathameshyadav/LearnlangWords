
import os
import re
import smtplib
from datetime import datetime, time
from zoneinfo import ZoneInfo
from email.message import EmailMessage

from dotenv import load_dotenv
from google import genai
from supabase import create_client


load_dotenv()

gemini_key = os.getenv("GEMINI_API_KEY")
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
sender_email = os.getenv("SENDER_EMAIL")
sender_password = os.getenv("SENDER_APP_PASSWORD")


if not gemini_key:
    raise Exception("GEMINI_API_KEY is missing.")

if not supabase_url:
    raise Exception("SUPABASE_URL is missing.")

if not supabase_key:
    raise Exception("SUPABASE_KEY is missing.")

if not sender_email:
    raise Exception("SENDER_EMAIL is missing.")

if not sender_password:
    raise Exception("SENDER_APP_PASSWORD is missing.")


gemini = genai.Client(api_key=gemini_key)

supabase = create_client(
    supabase_url,
    supabase_key
)


def clean_generated_text(value):
    if not value:
        return ""

    value = str(value)

    value = re.sub(
        r"<ruby\b[^>]*>(.*?)</ruby>",
        lambda match: re.sub(
            r"<rt\b[^>]*>(.*?)</rt>",
            r" (\1)",
            match.group(1),
            flags=re.IGNORECASE | re.DOTALL
        ),
        value,
        flags=re.IGNORECASE | re.DOTALL
    )

    value = re.sub(
        r"<[^>]*>",
        "",
        value
    )

    value = re.sub(
        r"```[\w-]*\s*([\s\S]*?)```",
        r"\1",
        value
    )

    value = re.sub(
        r"\*\*(.*?)\*\*",
        r"\1",
        value,
        flags=re.DOTALL
    )

    value = re.sub(
        r"__(.*?)__",
        r"\1",
        value,
        flags=re.DOTALL
    )

    value = re.sub(
        r"(?<!\w)\*(.*?)\*(?!\w)",
        r"\1",
        value,
        flags=re.DOTALL
    )

    value = re.sub(
        r"(?<!\w)_(.*?)_(?!\w)",
        r"\1",
        value,
        flags=re.DOTALL
    )

    value = re.sub(
        r"`([^`]*)`",
        r"\1",
        value
    )

    value = re.sub(
        r"^\s*[-#>]+\s*",
        "",
        value,
        flags=re.MULTILINE
    )

    return value.strip()


def extract_vocabulary(response_text):
    response_text = clean_generated_text(response_text)

    fields = {
        "word": "",
        "pronunciation": "",
        "meaning": "",
        "example": "",
        "example_pronunciation": "",
        "example_meaning": ""
    }

    labels = {
        "Word": "word",
        "Pronunciation": "pronunciation",
        "Meaning": "meaning",
        "Example": "example",
        "Example Pronunciation": "example_pronunciation",
        "Example Meaning": "example_meaning"
    }

    current_field = None

    for line in response_text.splitlines():
        line = line.strip()

        if not line:
            continue

        matched = False

        for label, field in sorted(
            labels.items(),
            key=lambda item: len(item[0]),
            reverse=True
        ):
            pattern = rf"^{re.escape(label)}\s*:\s*(.*)$"

            match = re.match(
                pattern,
                line,
                flags=re.IGNORECASE
            )

            if match:
                current_field = field
                fields[field] = match.group(1).strip()
                matched = True
                break

        if not matched and current_field:
            fields[current_field] += " " + line

    for field in fields:
        fields[field] = clean_generated_text(fields[field])

    missing_fields = [
        field
        for field, value in fields.items()
        if not value
    ]

    if missing_fields:
        raise Exception(
            "Could not extract complete vocabulary information. "
            "Missing fields: " + ", ".join(missing_fields)
        )

    return fields


settings_response = (
    supabase
    .table("settings")
    .select("*")
    .eq("id", 1)
    .single()
    .execute()
)

user_settings = settings_response.data

if not user_settings:
    raise Exception("Settings were not found in Supabase.")


language = user_settings["language"]

learn_in = user_settings.get(
    "learn_in",
    "English"
)

words_per_day = int(
    user_settings["words_per_day"]
)

recipient_email = user_settings["email"]

automation_started = user_settings.get(
    "automation_started",
    False
)


if not recipient_email:
    raise Exception("Recipient email is missing in Supabase.")


india_timezone = ZoneInfo("Asia/Kolkata")
now = datetime.now(india_timezone)

start_time = time(8, 0)
end_time = time(20, 0)


print("Current time:", now.strftime("%Y-%m-%d %H:%M:%S"))
print("Learn:", language)
print("Learn in:", learn_in)
print("Words per day:", words_per_day)
print("Recipient:", recipient_email)


if words_per_day <= 0:
    print("No words configured.")
    raise SystemExit(0)


if now.time() < start_time:
    print("Daily vocabulary window has not started yet.")
    raise SystemExit(0)


today_start = datetime.combine(
    now.date(),
    start_time,
    tzinfo=india_timezone
)

today_end = datetime.combine(
    now.date(),
    end_time,
    tzinfo=india_timezone
)


today_words_response = (
    supabase
    .table("vocabulary")
    .select("*")
    .eq("language", language)
    .eq("learn_in", learn_in)
    .gte(
        "generated_at",
        today_start.isoformat()
    )
    .lt(
        "generated_at",
        (today_end.replace(hour=20, minute=0)).isoformat()
    )
    .order(
        "generated_at",
        desc=True
    )
    .execute()
)

today_words = today_words_response.data or []

unsent_words = [
    word for word in today_words
    if not word.get("email_sent", False)
]

sent_words_today = [
    word for word in today_words
    if word.get("email_sent", False)
]

words_sent_today = len(sent_words_today)

print("Emails already sent today:", words_sent_today)
print("Unsent generated words:", len(unsent_words))


if len(unsent_words) == 0:

    if now >= today_end:
        elapsed_seconds = (
            today_end - today_start
        ).total_seconds()
    else:
        elapsed_seconds = (
            now - today_start
        ).total_seconds()

    window_seconds = (
        today_end - today_start
    ).total_seconds()

    if words_per_day == 1:
        words_due = 1
    else:
        progress = elapsed_seconds / window_seconds

        words_due = (
            int(progress * (words_per_day - 1)) + 1
        )

        words_due = min(words_due, words_per_day)

    print("Words due:", words_due)

    words_to_generate = words_due - words_sent_today

    if words_to_generate <= 0:
        print("No new word is due right now.")
        raise SystemExit(0)

    recent_words_response = (
        supabase
        .table("vocabulary")
        .select("word")
        .eq("language", language)
        .eq("learn_in", learn_in)
        .order(
            "generated_at",
            desc=True
        )
        .limit(20)
        .execute()
    )

    recent_words = [
        item["word"]
        for item in (recent_words_response.data or [])
    ]

    recent_words_text = ", ".join(recent_words)

    avoid_text = (
        f"Do not use any of these recently used words:\n{recent_words_text}"
        if recent_words_text
        else ""
    )

    for _ in range(words_to_generate):

        prompt = f"""
Generate one useful vocabulary word in {language}.

The learner understands {learn_in}.
The vocabulary word must be in {language}.

Return all explanations in {learn_in}, except the example
sentence, which must be in {language}.

Requirements:

1. Word:
Give one useful vocabulary word in {language}.

2. Pronunciation:
Give a clear, easy-to-read pronunciation suitable for
someone who understands {learn_in}. Use the writing system
of {learn_in} when helpful, otherwise use Latin transliteration.

3. Meaning:
Give the simple meaning in {learn_in}.

4. Example:
Give one natural example sentence in {language}.

5. Example Pronunciation:
Give a readable pronunciation of the complete example sentence
for someone who understands {learn_in}.

6. Example Meaning:
Translate the example sentence into {learn_in}.

7. Plain-text output:
Do not use HTML, XML, Markdown, bold markers, code fences,
or formatting tags. Do not use <b>, <ruby>, <rt>, or similar tags.
For Japanese, provide pronunciation separately as plain text.

Prefer common or moderately advanced words useful in everyday
communication. Avoid highly technical, obscure, or extremely
rare words.

{avoid_text}

Return exactly these six fields, one per line:

Word: ...
Pronunciation: ...
Meaning: ...
Example: ...
Example Pronunciation: ...
Example Meaning: ...
"""

        result = gemini.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt
        )

        response_text = result.text or ""

        print("\nGemini response:")
        print(response_text)

        fields = extract_vocabulary(response_text)

        word = fields["word"]
        pronunciation = fields["pronunciation"]
        meaning = fields["meaning"]
        example = fields["example"]
        example_pronunciation = fields["example_pronunciation"]
        example_meaning = fields["example_meaning"]

        insert_response = (
            supabase
            .table("vocabulary")
            .insert({
                "word": word,
                "pronunciation": pronunciation,
                "meaning": meaning,
                "example": example,
                "example_pronunciation": example_pronunciation,
                "example_meaning": example_meaning,
                "language": language,
                "learn_in": learn_in,
                "email_sent": False
            })
            .execute()
        )

        if not insert_response.data:
            raise Exception("Vocabulary was not returned after insertion.")

        print("Saved to Supabase.")

        new_word = insert_response.data[0]
        unsent_words.insert(0, new_word)
        recent_words.append(word)


print("\nWords waiting for email:", len(unsent_words))


for index, item in enumerate(reversed(unsent_words)):

    word_id = item["id"]
    word = item["word"]
    pronunciation = item.get("pronunciation", "")
    meaning = item["meaning"]
    example = item["example"]
    example_pronunciation = item.get("example_pronunciation", "")
    example_meaning = item.get("example_meaning", "")

    if not automation_started and index == 0:

        email_subject = "LearnLangWords has started!"

        email_body = f"""
LearnLangWords has started successfully!

Your daily vocabulary automation is now active.

Learn:
{language}

Learn in:
{learn_in}

Words per day:
{words_per_day}

Daily learning window:
8:00 AM - 8:00 PM IST

From now on, LearnLangWords will continue sending your
vocabulary words throughout the day.

Keep learning, one word at a time.
"""

    else:

        email_subject = f"LearnLangWords - {word}"

        email_body = f"""
LearnLangWords

Learn:
{language}

Learn in:
{learn_in}

Your vocabulary word for today:

Word:
{word}

Pronunciation:
{pronunciation}

Meaning:
{meaning}

Example:
{example}

Example Pronunciation:
{example_pronunciation}

Example Meaning:
{example_meaning}

Keep learning, one word at a time.
"""

    email_message = EmailMessage()
    email_message["Subject"] = email_subject
    email_message["From"] = sender_email
    email_message["To"] = recipient_email
    email_message.set_content(email_body)

    print(f"\nSending email for: {word}")

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(email_message)

        print(f"Email sent successfully: {word}")

        supabase.table("vocabulary").update({
            "email_sent": True
        }).eq(
            "id",
            word_id
        ).execute()

        print(f"Marked email as sent: {word}")

    except Exception as error:
        print(f"Email failed for {word}:")
        print(str(error))
        raise

    if not automation_started:

        supabase.table("settings").update({
            "automation_started": True
        }).eq(
            "id",
            1
        ).execute()

        automation_started = True

        print("Automation marked as started.")


print("\nLearnLangWords finished successfully.")
