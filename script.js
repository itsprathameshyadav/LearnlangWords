const SUPABASE_URL = "https://hriymqcbdsbzerucgvrx.supabase.co";
const SUPABASE_KEY = "sb_publishable_g-wbrT-Hvj3BTl2PNWLw_A_yCwGREQl";

const { createClient } = supabase;

const db = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let settings = null;
let vocabulary = [];

const emailInput = document.getElementById("email");
const languageInput = document.getElementById("language");
const learnInInput = document.getElementById("learn-in");
const wordsPerDayInput = document.getElementById("words-per-day");

const wordsLearned = document.getElementById("words-learned");
const wordsToday = document.getElementById("words-today");
const dailyGoal = document.getElementById("daily-goal");
const lastRun = document.getElementById("last-run");

const heroLanguage = document.getElementById("hero-language");
const heroLearnIn = document.getElementById("hero-learn-in");

const todayVocabulary = document.getElementById("today-vocabulary");
const previousVocabulary = document.getElementById("previous-vocabulary");

const todayCount = document.getElementById("today-count");
const historyCount = document.getElementById("history-count");

const saveSettingsButton = document.getElementById("save-settings");
const saveMessage = document.getElementById("save-message");


// -----------------------------
// LOAD SETTINGS
// -----------------------------

async function loadSettings() {

    const { data, error } = await db
        .from("settings")
        .select("*")
        .eq("id", 1)
        .single();

    if (error) {

        console.error(error);

        saveMessage.textContent =
            "Unable to load settings.";

        return;
    }

    settings = data;

    emailInput.value =
        settings.email || "";

    languageInput.value =
        settings.language || "English";

    learnInInput.value =
        settings.learn_in || "English";

    wordsPerDayInput.value =
        settings.words_per_day || 1;

    heroLanguage.textContent =
        settings.language || "—";

    heroLearnIn.textContent =
        settings.learn_in || "—";

    dailyGoal.textContent =
        settings.words_per_day || 0;

    await loadVocabulary();
}


// -----------------------------
// LOAD VOCABULARY
// -----------------------------

async function loadVocabulary() {

    const { data, error } = await db
        .from("vocabulary")
        .select("*")
        .order("generated_at", {
            ascending: false
        });

    if (error) {

        console.error(error);

        vocabulary = [];

        renderVocabulary();

        return;
    }

    vocabulary = data || [];

    renderVocabulary();
}


// -----------------------------
// RENDER VOCABULARY
// -----------------------------

function renderVocabulary() {

    const today = getIndiaDate();

    const todayWords = vocabulary.filter(word => {

        if (!word.generated_at) {
            return false;
        }

        return getIndiaDate(
            word.generated_at
        ) === today;

    });


    const historyWords = vocabulary.filter(word => {

        if (!word.generated_at) {
            return false;
        }

        return getIndiaDate(
            word.generated_at
        ) !== today;

    });


    wordsLearned.textContent =
        vocabulary.length;

    wordsToday.textContent =
        todayWords.length;


    todayCount.textContent =
        `${todayWords.length} ${
            todayWords.length === 1
                ? "word"
                : "words"
        }`;


    historyCount.textContent =
        `${historyWords.length} ${
            historyWords.length === 1
                ? "word"
                : "words"
        }`;


    renderToday(todayWords);

    renderHistory(historyWords);

    updateLastRun(todayWords);
}


// -----------------------------
// TODAY
// -----------------------------

function renderToday(words) {

    todayVocabulary.innerHTML = "";

    if (words.length === 0) {

        todayVocabulary.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ✦
                </div>

                <h3>
                    No words yet
                </h3>

                <p>
                    Your daily vocabulary will appear here.
                </p>

            </div>
        `;

        return;
    }


    words.forEach(word => {

        todayVocabulary.appendChild(
            createVocabularyCard(word)
        );

    });
}


// -----------------------------
// HISTORY
// -----------------------------

function renderHistory(words) {

    previousVocabulary.innerHTML = "";

    if (words.length === 0) {

        previousVocabulary.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ◷
                </div>

                <h3>
                    Your history is empty
                </h3>

                <p>
                    Previously learned words will appear here.
                </p>

            </div>
        `;

        return;
    }


    words.forEach(word => {

        previousVocabulary.appendChild(
            createVocabularyCard(word)
        );

    });
}


// -----------------------------
// VOCABULARY CARD
// -----------------------------

function createVocabularyCard(word) {

    const card =
        document.createElement("article");

    card.className =
        "vocabulary-card";


    const date =
        formatDate(word.generated_at);


    card.innerHTML = `

        <div class="word-header">

            <div>

                <h3>
                    ${escapeHtml(
                        word.word || ""
                    )}
                </h3>

                ${
                    word.pronunciation
                        ? `
                            <p class="pronunciation">
                                ${escapeHtml(
                                    word.pronunciation
                                )}
                            </p>
                        `
                        : ""
                }

            </div>

            <span class="word-date">
                ${date}
            </span>

        </div>


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

            ${
                word.example_pronunciation
                    ? `
                        <p class="example-pronunciation">
                            ${escapeHtml(
                                word.example_pronunciation
                            )}
                        </p>
                    `
                    : ""
            }

            ${
                word.example_meaning
                    ? `
                        <p class="example-meaning">
                            ${escapeHtml(
                                word.example_meaning
                            )}
                        </p>
                    `
                    : ""
            }

        </div>
    `;


    return card;
}


// -----------------------------
// SAVE SETTINGS
// -----------------------------

saveSettingsButton.addEventListener(
    "click",
    saveSettings
);


async function saveSettings() {

    if (!settings) {
        return;
    }


    saveSettingsButton.disabled =
        true;


    saveMessage.textContent =
        "Saving...";


    const oldEmail =
        (settings.email || "")
            .trim()
            .toLowerCase();


    const newEmail =
        emailInput.value
            .trim()
            .toLowerCase();


    if (!newEmail) {

        saveMessage.textContent =
            "Please enter an email address.";

        saveSettingsButton.disabled =
            false;

        return;
    }


    const emailChanged =
        oldEmail !== newEmail;


    const updatedSettings = {

        email: newEmail,

        language:
            languageInput.value,

        learn_in:
            learnInInput.value,

        words_per_day:
            Number(wordsPerDayInput.value)

    };


    // --------------------------------
    // EMAIL CHANGED
    // --------------------------------

    if (emailChanged) {

        saveMessage.textContent =
            "Changing email and starting fresh...";


        /*
         * Delete all existing vocabulary.
         */

        const { error: deleteError } =
            await db
                .from("vocabulary")
                .delete()
                .not("id", "is", null);


        if (deleteError) {

            console.error(deleteError);

            saveMessage.textContent =
                "Could not delete old vocabulary.";

            saveSettingsButton.disabled =
                false;

            return;
        }


        /*
         * Reset automation.
         */

        updatedSettings.automation_started =
            false;
    }


    // --------------------------------
    // SAVE SETTINGS
    // --------------------------------

    const { data, error } = await db
        .from("settings")
        .update(updatedSettings)
        .eq("id", 1)
        .select()
        .single();


    if (error) {

        console.error(error);

        saveMessage.textContent =
            "Could not save settings.";

        saveSettingsButton.disabled =
            false;

        return;
    }


    settings = data;


    emailInput.value =
        data.email || "";

    languageInput.value =
        data.language || "English";

    learnInInput.value =
        data.learn_in || "English";

    wordsPerDayInput.value =
        data.words_per_day || 1;


    heroLanguage.textContent =
        data.language || "—";

    heroLearnIn.textContent =
        data.learn_in || "—";

    dailyGoal.textContent =
        data.words_per_day || 0;


    // --------------------------------
    // IF EMAIL CHANGED
    // --------------------------------

    if (emailChanged) {

        vocabulary = [];

        renderVocabulary();


        saveMessage.textContent =
            "Email changed. Started fresh ✓";

    } else {

        saveMessage.textContent =
            "Settings saved successfully ✓";
    }


    setTimeout(() => {

        saveMessage.textContent = "";

    }, 4000);


    saveSettingsButton.disabled =
        false;
}


// -----------------------------
// NAVIGATION
// -----------------------------

const navItems =
    document.querySelectorAll(".nav-item");


navItems.forEach(item => {

    item.addEventListener(
        "click",
        () => {

            const section =
                item.dataset.section;


            navItems.forEach(nav => {

                nav.classList.remove(
                    "active"
                );

            });


            item.classList.add(
                "active"
            );


            document
                .querySelectorAll(".page-section")
                .forEach(page => {

                    page.classList.remove(
                        "active"
                    );

                });


            const target =
                document.getElementById(
                    `${section}-section`
                );


            if (target) {

                target.classList.add(
                    "active"
                );

            }


            const pageTitle =
                document.getElementById(
                    "page-title"
                );


            if (section === "dashboard") {

                pageTitle.textContent =
                    "Dashboard";

            } else if (
                section === "vocabulary"
            ) {

                pageTitle.textContent =
                    "Vocabulary";

            } else if (
                section === "settings"
            ) {

                pageTitle.textContent =
                    "Settings";

            }


            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        }
    );

});


// -----------------------------
// LAST RUN
// -----------------------------

function updateLastRun(words) {

    if (!words.length) {

        lastRun.textContent =
            "Waiting for automation";

        return;
    }


    const latest =
        words[0].generated_at;


    if (!latest) {

        lastRun.textContent =
            "Recently updated";

        return;
    }


    lastRun.textContent =
        `Last word ${formatRelativeTime(
            latest
        )}`;
}


// -----------------------------
// DATE HELPERS
// -----------------------------

function getIndiaDate(
    dateString = null
) {

    const date =
        dateString
            ? new Date(dateString)
            : new Date();


    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Kolkata"
        }
    ).format(date);
}


function formatDate(dateString) {

    if (!dateString) {
        return "";
    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata"
        }
    ).format(
        new Date(dateString)
    );
}


function formatRelativeTime(
    dateString
) {

    const date =
        new Date(dateString);


    const now =
        new Date();


    const difference =
        Math.floor(
            (now - date) / 60000
        );


    if (difference < 1) {

        return "just now";

    }


    if (difference < 60) {

        return `${difference} min ago`;

    }


    const hours =
        Math.floor(
            difference / 60
        );


    if (hours < 24) {

        return `${hours} hr ago`;

    }


    const days =
        Math.floor(
            hours / 24
        );


    return `${days} day${
        days === 1 ? "" : "s"
    } ago`;
}


// -----------------------------
// SECURITY
// -----------------------------

function escapeHtml(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


// -----------------------------
// START
// -----------------------------

loadSettings();