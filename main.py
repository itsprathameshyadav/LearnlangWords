import os
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


gemini = genai.Client(
    api_key=gemini_key
)

supabase = create_client(
    supabase_url,
    supabase_key
)


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
    raise Exception(
        "Settings were not found in Supabase."
    )


language = user_settings["language"]

words_per_day = int(
    user_settings["words_per_day"]
)

recipient_email = user_settings["email"]

automation_started = user_settings.get(
    "automation_started",
    False
)


if not recipient_email:
    raise Exception(
        "Recipient email is missing in Supabase."
    )


india_timezone = ZoneInfo(
    "Asia/Kolkata"
)

now = datetime.now(
    india_timezone
)


start_time = time(8, 0)
end_time = time(20, 0)


print(
    "Current time:",
    now.strftime("%Y-%m-%d %H:%M:%S")
)

print(
    "Language:",
    language
)

print(
    "Words per day:",
    words_per_day
)

print(
    "Recipient:",
    recipient_email
)


if words_per_day <= 0:

    print(
        "No words configured."
    )

    exit()


if now.time() < start_time:

    print(
        "Daily vocabulary window has not started yet."
    )

    exit()


if now.time() > end_time:

    print(
        "Daily vocabulary window has ended."
    )

    exit()


today_start = datetime.combine(
    now.date(),
    start_time,
    tzinfo=india_timezone
)


total_seconds = (
    now - today_start
).total_seconds()


window_seconds = 12 * 60 * 60


if words_per_day == 1:

    words_due = 1

else:

    progress = (
        total_seconds /
        window_seconds
    )

    words_due = int(
        progress *
        (words_per_day - 1)
    ) + 1

    if words_due > words_per_day:
        words_due = words_per_day


today_start_iso = (
    today_start.isoformat()
)


today_words_response = (
    supabase
    .table("vocabulary")
    .select("*")
    .eq("language", language)
    .gte(
        "generated_at",
        today_start_iso
    )
    .order(
        "generated_at",
        desc=True
    )
    .execute()
)


today_words = (
    today_words_response.data
)


words_sent_today = len(
    today_words
)


print(
    "Words due:",
    words_due
)

print(
    "Words already generated today:",
    words_sent_today
)


words_to_generate = (
    words_due -
    words_sent_today
)


if words_to_generate <= 0:

    print(
        "No new word is due right now."
    )

    exit()


recent_words_response = (
    supabase
    .table("vocabulary")
    .select("word")
    .eq("language", language)
    .order(
        "generated_at",
        desc=True
    )
    .limit(20)
    .execute()
)


recent_words = [
    item["word"]
    for item in recent_words_response.data
]


recent_words_text = ", ".join(
    recent_words
)


if recent_words_text:

    avoid_text = f"""
Do not use any of these recently used words:

{recent_words_text}
"""

else:

    avoid_text = ""


generated_words = []


for i in range(words_to_generate):

    prompt = f"""
Generate one useful vocabulary word in {language}.

The word should be suitable for a student
who wants to improve their vocabulary.

Prefer common or moderately advanced words
that are useful in everyday communication.
Avoid highly technical, scientific, obscure,
or extremely rare words.

Give:

1. The word
2. A simple and accurate meaning in {language}
3. One natural example sentence in {language}

{avoid_text}

Format your response exactly like this:

Word: <word>
Meaning: <meaning>
Example: <example sentence>
"""


    result = gemini.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt
    )


    text = result.text.strip()


    print("\nGemini response:")
    print(text)


    lines = text.split("\n")


    word = ""
    meaning = ""
    example = ""


    for line in lines:

        line = line.strip()


        if line.startswith("Word:"):

            word = (
                line
                .replace("Word:", "", 1)
                .strip()
            )


        elif line.startswith("Meaning:"):

            meaning = (
                line
                .replace("Meaning:", "", 1)
                .strip()
            )


        elif line.startswith("Example:"):

            example = (
                line
                .replace("Example:", "", 1)
                .strip()
            )


    if not word or not meaning or not example:

        raise Exception(
            "Could not extract vocabulary information."
        )


    supabase.table(
        "vocabulary"
    ).insert({
        "word": word,
        "meaning": meaning,
        "example": example,
        "language": language
    }).execute()


    print(
        "Saved to Supabase."
    )


    generated_words.append({
        "word": word,
        "meaning": meaning,
        "example": example
    })


    recent_words.append(
        word
    )


print(
    "\nGenerated",
    len(generated_words),
    "new word(s)."
)


for index, item in enumerate(
    generated_words
):

    word = item["word"]

    meaning = item["meaning"]

    example = item["example"]


    if (
        not automation_started
        and index == 0
    ):

        email_subject = (
            "LearnLangWords has started 🎉"
        )


        email_body = f"""
LearnLangWords has started successfully!

Your daily vocabulary automation is now active.

Language: {language}
Words per day: {words_per_day}
Daily learning window: 8:00 AM - 8:00 PM IST

Your very first bonus word for today is:

{word}

Meaning:
{meaning}

Example:
{example}

From now on, LearnLangWords will continue
sending your vocabulary words throughout the day.

Keep learning, one word at a time.
"""


    else:

        email_subject = (
            f"LearnLangWords - {word}"
        )


        email_body = f"""
LearnLangWords

Your vocabulary word for today:

Word:
{word}

Meaning:
{meaning}

Example:
{example}

Keep learning, one word at a time.
"""


    email_message = EmailMessage()


    email_message["Subject"] = (
        email_subject
    )

    email_message["From"] = (
        sender_email
    )

    email_message["To"] = (
        recipient_email
    )


    email_message.set_content(
        email_body
    )


    print(
        f"\nSending email for: {word}"
    )


    try:

        with smtplib.SMTP(
            "smtp.gmail.com",
            587
        ) as server:

            server.starttls()

            server.login(
                sender_email,
                sender_password
            )

            server.send_message(
                email_message
            )


        print(
            f"Email sent successfully: {word}"
        )


    except Exception as e:

        print(
            f"Email failed for {word}:"
        )

        print(
            str(e)
        )

        raise Exception(
            "Email sending failed."
        )


    if not automation_started:

        supabase.table(
            "settings"
        ).update({
            "automation_started": True
        }).eq(
            "id",
            1
        ).execute()


        automation_started = True


        print(
            "Automation marked as started."
        )