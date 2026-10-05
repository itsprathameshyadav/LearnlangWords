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
    "Learn:",
    language
)

print(
    "Learn in:",
    learn_in
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


today_start_iso = today_start.isoformat()


today_words_response = (
    supabase
    .table("vocabulary")
    .select("*")
    .eq("language", language)
    .eq("learn_in", learn_in)
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
    today_words_response.data or []
)


unsent_words = [
    word
    for word in today_words
    if not word.get("email_sent", False)
]


sent_words_today = [
    word
    for word in today_words
    if word.get("email_sent", False)
]


words_sent_today = len(
    sent_words_today
)


print(
    "Emails already sent today:",
    words_sent_today
)

print(
    "Unsent generated words:",
    len(unsent_words)
)


if len(unsent_words) > 0:

    print(
        "\nThere are unsent words."
    )

else:

    if now >= today_end:

        elapsed_seconds = (
            today_end - today_start
        ).total_seconds()

    else:

        elapsed_seconds = (
            now - today_start
        ).total_seconds()


    window_seconds = (
        12 * 60 * 60
    )


    if words_per_day == 1:

        words_due = 1

    else:

        progress = (
            elapsed_seconds /
            window_seconds
        )

        words_due = int(
            progress *
            (words_per_day - 1)
        ) + 1


        if words_due > words_per_day:

            words_due = words_per_day


    print(
        "Words due:",
        words_due
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
        for item in (
            recent_words_response.data or []
        )
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


    for i in range(words_to_generate):

        prompt = f"""
Generate one useful vocabulary word in {language}.

The learner understands {learn_in}.

The vocabulary word must be in {language}.

Give all information needed for a learner whose
explanation language is {learn_in}.

Requirements:

1. Word:
   Give one useful vocabulary word in {language}.

2. Pronunciation:
   Give an easy-to-read pronunciation of the word
   suitable for a person who understands {learn_in}.
   Use the writing system of {learn_in} when it makes
   the pronunciation easier for the learner.
   Otherwise use a clear Latin transliteration.

3. Meaning:
   Give the simple meaning of the word in {learn_in}.

4. Example:
   Give one natural example sentence using the word
   in {language}.

5. Example Pronunciation:
   Give an easy-to-read pronunciation of the complete
   example sentence suitable for a person who understands
   {learn_in}.
   Use the writing system of {learn_in} when appropriate.

6. Example Meaning:
   Translate the example sentence into {learn_in}.

Prefer common or moderately advanced words useful
in everyday communication.

Avoid highly technical, scientific, obscure,
or extremely rare words.

{avoid_text}

Format your response exactly like this:

Word: <word>
Pronunciation: <pronunciation>
Meaning: <meaning>
Example: <example sentence>
Example Pronunciation: <example pronunciation>
Example Meaning: <example meaning>
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
        pronunciation = ""
        meaning = ""
        example = ""
        example_pronunciation = ""
        example_meaning = ""


        for line in lines:

            line = line.strip()


            if line.startswith("Word:"):

                word = (
                    line
                    .replace(
                        "Word:",
                        "",
                        1
                    )
                    .strip()
                )


            elif line.startswith("Pronunciation:"):

                pronunciation = (
                    line
                    .replace(
                        "Pronunciation:",
                        "",
                        1
                    )
                    .strip()
                )


            elif line.startswith("Meaning:"):

                meaning = (
                    line
                    .replace(
                        "Meaning:",
                        "",
                        1
                    )
                    .strip()
                )


            elif line.startswith(
                "Example Pronunciation:"
            ):

                example_pronunciation = (
                    line
                    .replace(
                        "Example Pronunciation:",
                        "",
                        1
                    )
                    .strip()
                )


            elif line.startswith(
                "Example Meaning:"
            ):

                example_meaning = (
                    line
                    .replace(
                        "Example Meaning:",
                        "",
                        1
                    )
                    .strip()
                )


            elif line.startswith("Example:"):

                example = (
                    line
                    .replace(
                        "Example:",
                        "",
                        1
                    )
                    .strip()
                )


        if (
            not word
            or not pronunciation
            or not meaning
            or not example
            or not example_pronunciation
            or not example_meaning
        ):

            raise Exception(
                "Could not extract complete vocabulary information."
            )


        insert_response = (
            supabase
            .table("vocabulary")
            .insert({
                "word": word,
                "pronunciation": pronunciation,
                "meaning": meaning,
                "example": example,
                "example_pronunciation": (
                    example_pronunciation
                ),
                "example_meaning": (
                    example_meaning
                ),
                "language": language,
                "learn_in": learn_in,
                "email_sent": False
            })
            .execute()
        )


        print(
            "Saved to Supabase."
        )


        new_word = insert_response.data[0]


        unsent_words.insert(
            0,
            new_word
        )


        recent_words.append(
            word
        )


print(
    "\nWords waiting for email:",
    len(unsent_words)
)


for index, item in enumerate(
    reversed(unsent_words)
):

    word_id = item["id"]

    word = item["word"]

    pronunciation = item.get(
        "pronunciation",
        ""
    )

    meaning = item["meaning"]

    example = item["example"]

    example_pronunciation = item.get(
        "example_pronunciation",
        ""
    )

    example_meaning = item.get(
        "example_meaning",
        ""
    )


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

Learn:
{language}

Learn in:
{learn_in}

Words per day:
{words_per_day}

Daily learning window:
8:00 AM - 8:00 PM IST

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


        supabase.table(
            "vocabulary"
        ).update({
            "email_sent": True
        }).eq(
            "id",
            word_id
        ).execute()


        print(
            f"Marked email as sent: {word}"
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


print(
    "\nLearnLangWords finished successfully."
)