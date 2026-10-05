const SUPABASE_URL = "https://hriymqcbdsbzerucgvrx.supabase.co";
const SUPABASE_KEY = "sb_publishable_g-wbrT-Hvj3BTl2PNWLw_A_yCwGREQl";

const db = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let settings = null;
let vocabulary = [];


/* -----------------------------
   LOAD SETTINGS
----------------------------- */

async function loadSettings() {

    const { data, error } = await db
        .from("settings")
        .select("*")
        .eq("id", 1)
        .single();

    if (error) {
        console.error("Settings load error:", error);
        return;
    }

    settings = data;

    document.getElementById("email").value =
        settings.email || "";

    document.getElementById("language").value =
        settings.language || "English";

    document.getElementById("learn-in").value =
        settings.learn_in || "English";

    document.getElementById("words-per-day").value =
        settings.words_per_day || 1;

    updateDashboard();

    await loadVocabulary();
}


/* -----------------------------
   LOAD VOCABULARY
----------------------------- */

async function loadVocabulary() {

    const { data, error } = await db
        .from("vocabulary")
        .select("*")
        .order("generated_at", {
            ascending: false
        });

    if (error) {
        console.error("Vocabulary load error:", error);
        return;
    }

    vocabulary = data || [];

    renderVocabulary();
    updateDashboard();
}


/* -----------------------------
   SAVE SETTINGS
----------------------------- */

async function saveSettings() {

    const emailInput =
        document.getElementById("email");

    const languageInput =
        document.getElementById("language");

    const learnInInput =
        document.getElementById("learn-in");

    const wordsInput =
        document.getElementById("words-per-day");

    const message =
        document.getElementById("save-message");

    const newEmail =
        emailInput.value.trim().toLowerCase();

    const newLanguage =
        languageInput.value;

    const newLearnIn =
        learnInInput.value;

    const newWordsPerDay =
        parseInt(wordsInput.value);


    if (!newEmail) {

        message.textContent =
            "Please enter your email.";

        message.style.color = "red";

        return;
    }


    const oldEmail =
        (settings.email || "")
            .trim()
            .toLowerCase();


    const emailChanged =
        oldEmail !== newEmail;


    /*
        EMAIL CHANGED

        1. Delete all vocabulary
        2. Reset automation
        3. Update settings
    */

    if (emailChanged) {

        const { error: deleteError } =
            await db
                .from("vocabulary")
                .delete()
                .not("id", "is", null);


        if (deleteError) {

            console.error(
                "Vocabulary delete error:",
                deleteError
            );

            message.textContent =
                "Could not delete old vocabulary.";

            message.style.color = "red";

            return;
        }


        settings = {
            ...settings,
            email: newEmail,
            language: newLanguage,
            learn_in: newLearnIn,
            words_per_day: newWordsPerDay,
            automation_started: false
        };

    } else {

        settings = {
            ...settings,
            email: newEmail,
            language: newLanguage,
            learn_in: newLearnIn,
            words_per_day: newWordsPerDay
        };
    }


    /*
        UPDATE SETTINGS TABLE
    */

    const { data, error } =
        await db
            .from("settings")
            .update({
                email: settings.email,
                language: settings.language,
                learn_in: settings.learn_in,
                words_per_day: settings.words_per_day,
                automation_started:
                    settings.automation_started
            })
            .eq("id", 1)
            .select()
            .single();


    if (error) {

        console.error(
            "Settings update error:",
            error
        );

        message.textContent =
            "Could not save settings.";

        message.style.color = "red";

        return;
    }


    /*
        IMPORTANT:
        Use the actual row returned by Supabase.
    */

    settings = data;


    /*
        If email changed, the old vocabulary
        is already deleted.
    */

    if (emailChanged) {

        vocabulary = [];

        renderVocabulary();

        message.textContent =
            "Email changed. Started fresh ✓";

    } else {

        message.textContent =
            "Settings saved ✓";
    }


    message.style.color = "green";

    updateDashboard();
}


/* -----------------------------
   DASHBOARD
----------------------------- */

function updateDashboard() {

    if (!settings) {
        return;
    }


    document.getElementById(
        "words-learned"
    ).textContent = vocabulary.length;


    const today =
        new Date().toISOString().split("T")[0];


    const todayWords =
        vocabulary.filter(word => {

            if (!word.generated_at) {
                return false;
            }

            return word.generated_at
                .split("T")[0] === today;

        });


    document.getElementById(
        "words-today"
    ).textContent = todayWords.length;


    document.getElementById(
        "last-run"
    ).textContent =
        vocabulary.length > 0
            ? formatDate(vocabulary[0].generated_at)
            : "Never";
}


/* -----------------------------
   RENDER VOCABULARY
----------------------------- */

function renderVocabulary() {

    const todayContainer =
        document.getElementById(
            "today-vocabulary"
        );

    const previousContainer =
        document.getElementById(
            "previous-vocabulary"
        );


    todayContainer.innerHTML = "";
    previousContainer.innerHTML = "";


    const today =
        new Date().toISOString().split("T")[0];


    const todayWords =
        vocabulary.filter(word => {

            if (!word.generated_at) {
                return false;
            }

            return word.generated_at
                .split("T")[0] === today;

        });


    const previousWords =
        vocabulary.filter(word => {

            if (!word.generated_at) {
                return false;
            }

            return word.generated_at
                .split("T")[0] !== today;

        });


    if (todayWords.length === 0) {

        todayContainer.innerHTML = `
            <p class="empty-message">
                No vocabulary available yet.
            </p>
        `;

    } else {

        todayWords.forEach(word => {

            todayContainer.innerHTML +=
                createVocabularyCard(word);

        });
    }


    if (previousWords.length === 0) {

        previousContainer.innerHTML = `
            <p class="empty-message">
                No previous vocabulary available.
            </p>
        `;

    } else {

        previousWords.forEach(word => {

            previousContainer.innerHTML +=
                createVocabularyCard(word);

        });
    }
}


/* -----------------------------
   VOCABULARY CARD
----------------------------- */

function createVocabularyCard(word) {

    return `
        <div class="vocabulary-card">

            <div class="word-header">

                <h3>
                    ${escapeHtml(word.word || "")}
                </h3>

                <span class="word-date">
                    ${formatDate(word.generated_at)}
                </span>

            </div>


            <p class="pronunciation">
                ${escapeHtml(
                    word.pronunciation || ""
                )}
            </p>


            <div class="meaning">

                ${escapeHtml(
                    word.meaning || ""
                )}

            </div>


            <div class="example-box">

                <p class="example-label">
                    Example
                </p>

                <p class="example-text">
                    ${escapeHtml(
                        word.example || ""
                    )}
                </p>


                <p class="example-pronunciation">

                    ${escapeHtml(
                        word.example_pronunciation || ""
                    )}

                </p>


                <p class="example-meaning">

                    ${escapeHtml(
                        word.example_meaning || ""
                    )}

                </p>

            </div>

        </div>
    `;
}


/* -----------------------------
   DATE FORMAT
----------------------------- */

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    const date =
        new Date(dateString);

    return date.toLocaleString();
}


/* -----------------------------
   HTML ESCAPE
----------------------------- */

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* -----------------------------
   NAVIGATION
----------------------------- */

document
    .querySelectorAll(".nav-item")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(".nav-item")
                    .forEach(item => {

                        item.classList.remove(
                            "active"
                        );

                    });


                button.classList.add("active");


                document
                    .querySelectorAll(".page-section")
                    .forEach(section => {

                        section.classList.remove(
                            "active"
                        );

                    });


                const section =
                    document.getElementById(
                        button.dataset.section +
                        "-section"
                    );


                if (section) {
                    section.classList.add(
                        "active"
                    );
                }

            }
        );

    });


/* -----------------------------
   SAVE BUTTON
----------------------------- */

document
    .getElementById("save-settings")
    .addEventListener(
        "click",
        saveSettings
    );


/* -----------------------------
   START APP
----------------------------- */

loadSettings();