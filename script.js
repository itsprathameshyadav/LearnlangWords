const SUPABASE_URL="https://hriymqcbdsbzerucgvrx.supabase.co"
const SUPABASE_KEY="sb_publishable_g-wbrT-Hvj3BTl2PNWLw_A_yCwGREQl"

const { createClient } = supabase;

const db = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


let learners = [];
let selectedLearner = null;
let vocabulary = [];


// -----------------------------
// ELEMENTS
// -----------------------------

const learnerSelect = document.getElementById("learner-select");

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

const addLearnerButton = document.getElementById("add-learner-btn");
const learnerModal = document.getElementById("learner-modal");
const closeModalButton = document.getElementById("close-modal");

const newLearnerEmail = document.getElementById("new-learner-email");
const createLearnerButton = document.getElementById("create-learner");
const learnerMessage = document.getElementById("learner-message");


// -----------------------------
// LOAD LEARNERS
// -----------------------------

async function loadLearners() {

    const { data, error } = await db
        .from("learners")
        .select("*")
        .order("id", { ascending: true });

    if (error) {
        console.error(error);
        learnerSelect.innerHTML = `
            <option value="">Unable to load learners</option>
        `;
        return;
    }

    learners = data || [];

    learnerSelect.innerHTML = "";

    if (learners.length === 0) {

        learnerSelect.innerHTML = `
            <option value="">No learners</option>
        `;

        clearDashboard();
        return;
    }

    learners.forEach(learner => {

        const option = document.createElement("option");

        option.value = learner.id;

        option.textContent =
            learner.email || `Learner ${learner.id}`;

        learnerSelect.appendChild(option);
    });

    selectedLearner = learners[0];

    learnerSelect.value = selectedLearner.id;

    await loadSelectedLearner();
}


// -----------------------------
// LOAD SELECTED LEARNER
// -----------------------------

async function loadSelectedLearner() {

    const id = Number(learnerSelect.value);

    selectedLearner =
        learners.find(learner => Number(learner.id) === id);

    if (!selectedLearner) {
        return;
    }

    emailInput.value = selectedLearner.email || "";

    languageInput.value =
        selectedLearner.language || "English";

    learnInInput.value =
        selectedLearner.learn_in || "English";

    wordsPerDayInput.value =
        selectedLearner.words_per_day || 1;

    heroLanguage.textContent =
        selectedLearner.language || "—";

    heroLearnIn.textContent =
        selectedLearner.learn_in || "—";

    dailyGoal.textContent =
        selectedLearner.words_per_day || 0;

    await loadVocabulary();
}


// -----------------------------
// LOAD VOCABULARY
// -----------------------------

async function loadVocabulary() {

    if (!selectedLearner) {
        return;
    }

    const { data, error } = await db
        .from("vocabulary")
        .select("*")
        .eq("learner_id", selectedLearner.id)
        .order("generated_at", { ascending: false });

    if (error) {
        console.error(error);
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

        return getIndiaDate(word.generated_at) === today;
    });

    const historyWords = vocabulary.filter(word => {

        if (!word.generated_at) {
            return false;
        }

        return getIndiaDate(word.generated_at) !== today;
    });


    wordsLearned.textContent = vocabulary.length;

    wordsToday.textContent = todayWords.length;

    todayCount.textContent =
        `${todayWords.length} ${todayWords.length === 1 ? "word" : "words"}`;

    historyCount.textContent =
        `${historyWords.length} ${historyWords.length === 1 ? "word" : "words"}`;


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
                <div class="empty-icon">✦</div>
                <h3>No words yet</h3>
                <p>Your daily vocabulary will appear here.</p>
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
                <div class="empty-icon">◷</div>
                <h3>Your history is empty</h3>
                <p>Previously learned words will appear here.</p>
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

    const card = document.createElement("article");

    card.className = "vocabulary-card";

    const date = formatDate(word.generated_at);

    card.innerHTML = `

        <div class="word-header">

            <div>

                <h3>${escapeHtml(word.word || "")}</h3>

                ${
                    word.pronunciation
                        ? `<p class="pronunciation">
                            ${escapeHtml(word.pronunciation)}
                           </p>`
                        : ""
                }

            </div>

            <span class="word-date">
                ${date}
            </span>

        </div>


        <div class="meaning">
            ${escapeHtml(word.meaning || "")}
        </div>


        <div class="example-box">

            <p class="example-label">
                Example
            </p>

            <p class="example-text">
                ${escapeHtml(word.example || "")}
            </p>


            ${
                word.example_pronunciation
                    ? `
                    <p class="example-pronunciation">
                        ${escapeHtml(word.example_pronunciation)}
                    </p>
                    `
                    : ""
            }


            ${
                word.example_meaning
                    ? `
                    <p class="example-meaning">
                        ${escapeHtml(word.example_meaning)}
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

    if (!selectedLearner) {
        return;
    }

    saveSettingsButton.disabled = true;

    saveMessage.textContent = "Saving...";

    const updatedSettings = {

        email: emailInput.value.trim(),

        language:
            languageInput.value,

        learn_in:
            learnInInput.value,

        words_per_day:
            Number(wordsPerDayInput.value)

    };


    const { data, error } = await db
        .from("learners")
        .update(updatedSettings)
        .eq("id", selectedLearner.id)
        .select()
        .single();


    if (error) {

        console.error(error);

        saveMessage.textContent =
            "Could not save settings.";

        saveSettingsButton.disabled = false;

        return;
    }


    selectedLearner = data;

    learners = learners.map(learner => {

        if (Number(learner.id) === Number(data.id)) {
            return data;
        }

        return learner;
    });


    heroLanguage.textContent =
        data.language;

    heroLearnIn.textContent =
        data.learn_in;

    dailyGoal.textContent =
        data.words_per_day;


    saveMessage.textContent =
        "Settings saved successfully ✓";


    setTimeout(() => {

        saveMessage.textContent = "";

    }, 3000);


    saveSettingsButton.disabled = false;
}


// -----------------------------
// CHANGE LEARNER
// -----------------------------

learnerSelect.addEventListener(
    "change",
    async () => {

        await loadSelectedLearner();

    }
);


// -----------------------------
// ADD LEARNER
// -----------------------------

addLearnerButton.addEventListener(
    "click",
    () => {

        newLearnerEmail.value = "";

        learnerMessage.textContent = "";

        learnerModal.classList.add("show");

    }
);


closeModalButton.addEventListener(
    "click",
    () => {

        learnerModal.classList.remove("show");

    }
);


learnerModal.addEventListener(
    "click",
    event => {

        if (event.target === learnerModal) {

            learnerModal.classList.remove("show");

        }

    }
);


createLearnerButton.addEventListener(
    "click",
    createLearner
);


async function createLearner() {

    const email =
        newLearnerEmail.value.trim();


    if (!email) {

        learnerMessage.textContent =
            "Please enter an email address.";

        return;
    }


    createLearnerButton.disabled = true;

    learnerMessage.textContent =
        "Creating learner...";


    const { data, error } = await db
        .from("learners")
        .insert({

            email: email,

            language: "English",

            learn_in: "English",

            words_per_day: 2,

            automation_started: false,

            active: true

        })
        .select()
        .single();


    if (error) {

        console.error(error);

        learnerMessage.textContent =
            "Could not create learner.";

        createLearnerButton.disabled = false;

        return;
    }


    learners.push(data);


    const option =
        document.createElement("option");

    option.value = data.id;

    option.textContent = data.email;

    learnerSelect.appendChild(option);

    learnerSelect.value = data.id;

    selectedLearner = data;


    learnerModal.classList.remove("show");


    await loadSelectedLearner();


    createLearnerButton.disabled = false;
}


// -----------------------------
// NAVIGATION
// -----------------------------

const navItems =
    document.querySelectorAll(".nav-item");


navItems.forEach(item => {

    item.addEventListener("click", () => {

        const section =
            item.dataset.section;


        navItems.forEach(nav => {

            nav.classList.remove("active");

        });

        item.classList.add("active");


        document
            .querySelectorAll(".page-section")
            .forEach(page => {

                page.classList.remove("active");

            });


        const target =
            document.getElementById(
                `${section}-section`
            );


        if (target) {
            target.classList.add("active");
        }


        const pageTitle =
            document.getElementById("page-title");


        if (section === "dashboard") {

            pageTitle.textContent =
                "Dashboard";

        } else if (section === "vocabulary") {

            pageTitle.textContent =
                "Vocabulary";

        } else if (section === "settings") {

            pageTitle.textContent =
                "Settings";
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    });

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
        `Last word ${formatRelativeTime(latest)}`;
}


// -----------------------------
// DATE HELPERS
// -----------------------------

function getIndiaDate(dateString = null) {

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
    ).format(new Date(dateString));
}


function formatRelativeTime(dateString) {

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
        Math.floor(difference / 60);


    if (hours < 24) {
        return `${hours} hr ago`;
    }


    const days =
        Math.floor(hours / 24);


    return `${days} day${days === 1 ? "" : "s"} ago`;
}


// -----------------------------
// SECURITY
// -----------------------------

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// -----------------------------
// CLEAR DASHBOARD
// -----------------------------

function clearDashboard() {

    heroLanguage.textContent = "—";

    heroLearnIn.textContent = "—";

    wordsLearned.textContent = "0";

    wordsToday.textContent = "0";

    dailyGoal.textContent = "0";

    todayCount.textContent = "0 words";

    historyCount.textContent = "0 words";

    todayVocabulary.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">+</div>
            <h3>No learners yet</h3>
            <p>Add a learner to start using LearnLangWords.</p>
        </div>
    `;

    previousVocabulary.innerHTML = "";
}


// -----------------------------
// START
// -----------------------------

loadLearners();