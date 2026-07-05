// Paste your Google Apps Script web app URL here after setup (see google-apps-script/SETUP.md)
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbx74AeCLw-jTkYK4_5LfGxh0lPGs-hKQpk3triCklrtGbhslDprGteMUW-NiP_-G9myzA/exec";

const PRE_QUESTIONS = [
  {
    id: "preQ1",
    en: 'Have you ever heard of the biological term "Central Dogma" before today?',
    zh: "在今天之前，你聽過生物學上的「中心法則（Central Dogma）」嗎？",
    options: [
      { value: "A", en: "Yes, and I know what it means.", zh: "聽過，而且我知道那是什麼。" },
      { value: "B", en: "I've heard the name, but don't really know what it does.", zh: "聽過名字，但不太清楚它是幹嘛的。" },
      { value: "C", en: "Never heard of it.", zh: "完全沒聽過。" },
    ],
  },
  {
    id: "preQ2",
    en: "In your intuition, which of the following is the correct order of how our body creates traits (like eye color) from our underlying genetic code?",
    zh: "憑你的直覺，我們的身體是如何從底層的遺傳密碼製造出外在特徵（例如眼睛顏色）的？正確的順序可能是？",
    options: [
      { value: "A", en: "DNA → mRNA → Protein", zh: "DNA → mRNA → Protein（蛋白質）" },
      { value: "B", en: "Protein → mRNA → DNA", zh: "Protein（蛋白質）→ mRNA → DNA" },
      { value: "C", en: "I don't know (IDK)", zh: "我不知道（IDK）" },
    ],
  },
  {
    id: "preQ3",
    en: "Look at these biological terms: DNA, Nucleotide, Organism, Protein. Which one is the smallest, baseline building block?",
    zh: "看看這幾個生物學名詞：DNA、核苷酸（Nucleotide）、完整生物（Organism）、蛋白質（Protein）。你認為哪一個是裡面最小、最源頭的基礎積木？",
    options: [
      { value: "A", en: "DNA", zh: "DNA" },
      { value: "B", en: "Nucleotide", zh: "核苷酸（Nucleotide）" },
      { value: "C", en: "I don't know (IDK)", zh: "我不知道（IDK）" },
    ],
  },
];

const POST_QUESTIONS = [
  {
    id: "postQ1",
    en: "Now that you've finished the game, what is the exact evolutionary sequence you completed to build a full living organism?",
    zh: "玩完遊戲後，請問你剛剛在遊戲中把元素一路合併、最後組裝出完整生物（Organism）的正確演變順序是？",
    options: [
      { value: "A", en: "DNA → Nucleotide → mRNA → Protein → Organism", zh: "DNA → Nucleotide → mRNA → Protein → Organism" },
      { value: "B", en: "Nucleotide → DNA → mRNA → Protein → Organism", zh: "Nucleotide（核苷酸）→ DNA → mRNA → Protein → Organism" },
      { value: "C", en: "Protein → mRNA → DNA → Nucleotide → Organism", zh: "Protein → mRNA → DNA → Nucleotide → Organism" },
    ],
  },
  {
    id: "postQ2",
    en: 'When your DNA leveled up in the game, it "transcribed" into a temporary message carrier before becoming a protein. What was that intermediate stage?',
    zh: "在遊戲中，當你的 DNA 升級時，它會先「轉錄」成一個臨時的訊息攜帶者，然後才變成蛋白質。請問那個中間階段的元素是什麼？",
    options: [
      { value: "A", en: "mRNA", zh: "mRNA" },
      { value: "B", en: "Enzyme", zh: "酵素（Enzyme）" },
      { value: "C", en: "Chromosome", zh: "染色體（Chromosome）" },
    ],
  },
  {
    id: "postQ3",
    en: "What was the very first, basic element to start the chain of life?",
    zh: "請問最基礎的「起點元素」是什麼？",
    options: [
      { value: "A", en: "DNA", zh: "DNA" },
      { value: "B", en: "Protein", zh: "蛋白質（Protein）" },
      { value: "C", en: "Nucleotide", zh: "核苷酸（Nucleotide）" },
    ],
  },
];

function renderSurveyQuestions(container, questions) {
  if (!container) return;
  container.innerHTML = "";

  questions.forEach((question, index) => {
    const block = document.createElement("fieldset");
    block.className = "survey-question";
    block.dataset.questionId = question.id;

    const legend = document.createElement("legend");
    legend.className = "survey-legend";
    legend.innerHTML =
      `<span class="survey-q-num">Q${index + 1}</span>` +
      `<span class="survey-q-en">${question.en}</span>` +
      `<span class="survey-q-zh">${question.zh}</span>`;
    block.appendChild(legend);

    question.options.forEach((option) => {
      const label = document.createElement("label");
      label.className = "survey-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = question.id;
      input.value = option.value;
      input.required = true;

      const text = document.createElement("span");
      text.className = "survey-option-text";
      text.innerHTML =
        `<span class="survey-opt-en">${option.en}</span>` +
        `<span class="survey-opt-zh">${option.zh}</span>`;

      label.appendChild(input);
      label.appendChild(text);
      block.appendChild(label);
    });

    container.appendChild(block);
  });
}

function readSurveyAnswers(questions) {
  const answers = {};
  let complete = true;

  questions.forEach((question) => {
    const selected = document.querySelector(`input[name="${question.id}"]:checked`);
    if (!selected) {
      complete = false;
      answers[question.id] = "";
    } else {
      answers[question.id] = selected.value;
    }
  });

  return { answers, complete };
}

function createSurveySessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function submitSurveyResponse(payload) {
  if (!GOOGLE_SHEETS_URL) {
    console.warn("GOOGLE_SHEETS_URL is not set — survey data was not sent to Google Sheets.");
    return { ok: false, skipped: true };
  }

  try {
    await fetch(GOOGLE_SHEETS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: true };
  } catch (err) {
    console.error("Survey submit failed:", err);
    return { ok: false, error: err };
  }
}

function initSurveyUI() {
  renderSurveyQuestions(document.getElementById("pretest-questions"), PRE_QUESTIONS);
  renderSurveyQuestions(document.getElementById("posttest-questions"), POST_QUESTIONS);
}

initSurveyUI();
