const SUPABASE_URL = "https://hriymqcbdsbzerucgvrx.supabase.co";
const SUPABASE_KEY = "sb_publishable_g-wbrT-Hvj3BTl2PNWLw_A_yCwGREQl";

const db = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let settings = null;
let vocabulary = [];


async function loadSettings() {
    const { data, error } = await db
        .from("settings")
        .select("*")
        .eq("id", 1)
        .single();

    if (error) {
        console.error("Error loading settings:", error);

        document.getElementById("save-message").textContent =
            "Could not load settings.";

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

    await loadVocabulary();
}


async function loadVocabulary() {
    const { data, error } = await db
        .from("vocabulary")
        .select("*")
        .order("generated_at", {
            ascending: false
        });

    if (error) {
        console.error("Error loading vocabulary:", error);

        vocabulary = [];

        updateDashboard();
        renderVocabulary();

        return;
    }

    vocabulary = data || [];

    updateDashboard();
    renderVocabulary();
}


async function saveSettings() {
    const newEmail =
        document.getElementById("email").value.trim();

    const newLanguage =
        document.getElementById("language").value;

    const newLearnIn =
        document.getElementById("learn-in").value;

    const newWordsPerDay =
        parseInt(
            document.getElementById("words-per-day").value
        );


    if (!newEmail) {
        document.getElementById("save-message").textContent =
            "Please enter your email.";

        return;
    }


    if (!newEmail.includes("@")) {
        document.getElementById("save-message").textContent =
            "Please enter a valid email.";

        return;
    }


    const emailChanged =
        settings.email.toLowerCase() !==
        newEmail.toLowerCase();


    if (emailChanged) {

        const { error } = await db
            .from("vocabulary")
            .delete()
            .not("id", "is", null);

        if (error) {
            console.error(
                "Error deleting vocabulary:",
                error
            );

            document.getElementById("save-message").textContent =
                "Could not reset vocabulary.";

            return;
        }
    }


    const { data, error } = await db
        .from("settings")
        .update({
            email: newEmail,
            language: newLanguage,
            learn_in: newLearnIn,
            words_per_day: newWordsPerDay,
            automation_started: emailChanged
                ? false
                : settings.automation_started
        })
        .eq("id", 1)
        .select("*")
        .single();


    if (error) {
        console.error(
            "Error updating settings:",
            error
        );

        document.getElementById("save-message").textContent =
            "Could not save settings.";

        return;
    }


    settings = data;


    if (emailChanged) {
        vocabulary = [];

        updateDashboard();
        renderVocabulary();

        document.getElementById("save-message").textContent =
            "Email changed. Started fresh ✓";
    } else {
        await loadVocabulary();

        document.getElementById("save-message").textContent =
            "Settings saved ✓";
    }
}


function getTodayIndia() {
    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(new Date());
}


function getIndiaDate(dateValue) {
    if (!dateValue) {
        return null;
    }

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(new Date(dateValue));
}


function updateDashboard() {
    const today = getTodayIndia();

    const todayVocabulary = vocabulary.filter(word => {
        return getIndiaDate(word.generated_at) === today;
    });

    document.getElementById("words-learned").textContent =
        vocabulary.length;

    document.getElementById("words-today").textContent =
        todayVocabulary.length;

    if (vocabulary.length > 0) {
        document.getElementById("last-run").textContent =
            formatDate(vocabulary[0].generated_at);
    } else {
        document.getElementById("last-run").textContent =
            "Never";
    }
}


function renderVocabulary() {
    const todayContainer =
        document.getElementById("today-vocabulary");

    const previousContainer =
        document.getElementById("previous-vocabulary");

    const today = getTodayIndia();

    const todayVocabulary = vocabulary.filter(word => {
        return getIndiaDate(word.generated_at) === today;
    });

    const previousVocabulary = vocabulary.filter(word => {
        return getIndiaDate(word.generated_at) !== today;
    });


    if (todayVocabulary.length === 0) {
        todayContainer.innerHTML = `
            <p class="empty-message">
                No vocabulary available yet.
            </p>
        `;
    } else {
        todayContainer.innerHTML =
            todayVocabulary
                .map(createVocabularyCard)
                .join("");
    }


    if (previousVocabulary.length === 0) {
        previousContainer.innerHTML = `
            <p class="empty-message">
                No previous vocabulary available.
            </p>
        `;
    } else {
        previousContainer.innerHTML =
            previousVocabulary
                .map(createVocabularyCard)
                .join("");
    }
}


function createVocabularyCard(word) {
    return `
        <div class="vocabulary-card">

            <div class="word-header">

                <h3>
                    ${escapeHtml(word.word || "")}
                </h3>

                ${
                    word.language
                        ? `
                            <span>
                                ${escapeHtml(word.language)}
                            </span>
                          `
                        : ""
                }

            </div>


            ${
                word.pronunciation
                    ? `
                        <div class="vocabulary-item">

                            <strong>
                                Pronunciation
                            </strong>

                            <p>
                                ${escapeHtml(
                                    word.pronunciation
                                )}
                            </p>

                        </div>
                      `
                    : ""
            }


            <div class="vocabulary-item">

                <strong>
                    Meaning
                </strong>

                <p>
                    ${escapeHtml(
                        word.meaning || ""
                    )}
                </p>

            </div>


            ${
                word.example
                    ? `
                        <div class="vocabulary-item">

                            <strong>
                                Example
                            </strong>

                            <p>
                                ${escapeHtml(
                                    word.example
                                )}
                            </p>

                        </div>
                      `
                    : ""
            }


            ${
                word.example_pronunciation
                    ? `
                        <div class="vocabulary-item">

                            <strong>
                                Example Pronunciation
                            </strong>

                            <p>
                                ${escapeHtml(
                                    word.example_pronunciation
                                )}
                            </p>

                        </div>
                      `
                    : ""
            }


            ${
                word.example_meaning
                    ? `
                        <div class="vocabulary-item">

                            <strong>
                                Example Meaning
                            </strong>

                            <p>
                                ${escapeHtml(
                                    word.example_meaning
                                )}
                            </p>

                        </div>
                      `
                    : ""
            }


            <div class="vocabulary-date">
                ${formatDate(word.generated_at)}
            </div>

        </div>
    `;
}


function formatDate(dateValue) {
    if (!dateValue) {
        return "Unknown";
    }

    return new Date(dateValue).toLocaleString(
        "en-IN",
        {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


document
    .getElementById("save-settings")
    .addEventListener(
        "click",
        saveSettings
    );


loadSettings();