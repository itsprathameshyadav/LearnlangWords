const SUPABASE_URL="https://hriymqcbdsbzerucgvrx.supabase.co"
const SUPABASE_KEY="sb_publishable_g-wbrT-Hvj3BTl2PNWLw_A_yCwGREQl"

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const saveButton = document.getElementById("saveButton");
const message = document.getElementById("message");


function getIndiaDate() {

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());

}


function formatTime(dateString) {

    const date = new Date(dateString);

    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);

}


function formatDate(dateString) {

    const date = new Date(dateString);

    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);

}


function formatIndiaDate(dateString) {

    const date = new Date(dateString);

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(date);

}


async function loadSettings() {

    const { data, error } = await supabaseClient
        .from("settings")
        .select("*")
        .eq("id", 1)
        .single();


    if (error) {

        console.error(error);

        message.textContent =
            "Unable to load settings.";

        return;

    }


    document.getElementById("email").value =
        data.email || "";

    document.getElementById("language").value =
        data.language || "English";

    document.getElementById("words").value =
        data.words_per_day || 1;

}


async function loadVocabulary() {

    const { data, error } = await supabaseClient
        .from("vocabulary")
        .select("*")
        .order("generated_at", {
            ascending: false
        });


    if (error) {

        console.error(error);

        return;

    }


    const wordsLearned =
        document.getElementById("wordsLearned");

    const wordsToday =
        document.getElementById("wordsToday");

    const lastRun =
        document.getElementById("lastRun");


    wordsLearned.textContent =
        data.length;


    const today =
        getIndiaDate();


    const todayData =
        data.filter(item => {

            return formatIndiaDate(
                item.generated_at
            ) === today;

        });


    wordsToday.textContent =
        todayData.length;


    if (data.length > 0) {

        lastRun.textContent =
            formatTime(
                data[0].generated_at
            );

    }


    displayToday(todayData);

    displayHistory(data);

}


function displayToday(data) {

    const container =
        document.getElementById("todayWords");


    if (data.length === 0) {

        container.innerHTML = `
            <div class="empty-icon">Aa</div>

            <h3>No words yet</h3>

            <p>
                Your vocabulary words will appear here.
            </p>
        `;

        return;

    }


    container.innerHTML = "";


    data.forEach(item => {

        const card =
            document.createElement("div");


        card.className =
            "word-card";


        card.innerHTML = `
            <p class="word-language">
                ${item.language}
            </p>

            <h3>
                ${item.word}
            </h3>

            <div class="word-info">

                <strong>
                    Meaning
                </strong>

                <p>
                    ${item.meaning}
                </p>

            </div>

            <div class="word-info">

                <strong>
                    Example
                </strong>

                <p>
                    ${item.example}
                </p>

            </div>
        `;


        container.appendChild(card);

    });

}


function displayHistory(data) {

    const container =
        document.getElementById("historyList");


    if (data.length === 0) {

        container.innerHTML = `
            <div class="history-empty">
                Your generated words will appear here.
            </div>
        `;

        return;

    }


    container.innerHTML = "";


    data.forEach(item => {

        const row =
            document.createElement("div");


        row.className =
            "history-row";


        row.innerHTML = `
            <div>

                <strong>
                    ${item.word}
                </strong>

                <span>
                    ${item.language}
                </span>

            </div>

            <time>
                ${formatDate(item.generated_at)}
            </time>
        `;


        container.appendChild(row);

    });

}


saveButton.addEventListener(
    "click",
    async function () {

        const email =
            document
                .getElementById("email")
                .value
                .trim();


        const language =
            document.getElementById("language").value;


        const words =
            parseInt(
                document.getElementById("words").value
            );


        if (!email) {

            message.textContent =
                "Please enter your email address.";

            return;

        }


        if (!email.includes("@")) {

            message.textContent =
                "Please enter a valid email address.";

            return;

        }


        saveButton.disabled = true;


        message.textContent =
            "Saving settings...";


        const { error } =
            await supabaseClient
                .from("settings")
                .update({
                    email: email,
                    language: language,
                    words_per_day: words
                })
                .eq("id", 1);


        saveButton.disabled = false;


        if (error) {

            console.error(error);

            message.textContent =
                "Failed to save settings.";

            return;

        }


        message.textContent =
            "Settings saved successfully.";

    }
);


loadSettings();

loadVocabulary();