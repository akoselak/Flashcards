// ---- Storage: the only place that touches localStorage ----
const STORAGE_KEY = "flashcards.deck";

const STARTER_DECK = [
  {
    id: 1,
    q: "What does git commit do?",
    a: "Saves a snapshot of your staged changes to the project history.",
    right: 0,
    wrong: 0,
  },
  {
    id: 2,
    q: "What does a bug report need most?",
    a: "The exact error, what you did, what you expected, and what happened.",
    right: 0,
    wrong: 0,
  },
  {
    id: 3,
    q: "Why build one feature at a time?",
    a: "Small steps are easy to test, and easy to undo when something breaks.",
    right: 0,
    wrong: 0,
  },
  {
    id: 4,
    q: "What is a spec?",
    a: "A short description of what the app does and what “done” looks like.",
    right: 0,
    wrong: 0,
  },
];

// Makes sure a card has numeric counters, even if it was saved before they existed
function normalize(c) {
  return { ...c, right: Number(c.right) || 0, wrong: Number(c.wrong) || 0 };
}

function loadDeck() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return STARTER_DECK.map(normalize); // first visit: nothing saved yet
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) return parsed.map(normalize); // includes an empty [] deck
  } catch (err) {
    console.warn("Could not load saved deck:", err);
  }
  return STARTER_DECK.map(normalize); // fallback if data is corrupt
}

function saveDeck() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
  } catch (err) {
    console.warn("Could not save deck:", err);
  }
}

// The deck's name is stored separately from the cards, so the card format never changes
const NAME_KEY = "flashcards.name";

function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch (err) {
    return "";
  }
}

function saveName() {
  try {
    localStorage.setItem(NAME_KEY, deckName);
  } catch (err) {
    console.warn("Could not save deck name:", err);
  }
}

// ---- Data ----
let deck = loadDeck();
let deckName = loadName();
// Next id must be higher than any saved id, or new cards could collide with old ones
let nextId = deck.reduce((max, c) => Math.max(max, c.id), 0) + 1;

// ---- Quiz state ----
let queue = [],
  pos = 0,
  flipped = false,
  right = [],
  wrong = [];

// ---- Random mode state ----
let rCard = null,
  rFlipped = false,
  rRight = 0,
  rWrong = 0;

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Weights: harder cards get a higher weight (1 to 5, unseen cards = 3) ----
const WEIGHT_MIN = 1,
  WEIGHT_MAX = 5;

// Computed from the card's own counts only, so one card's weight never depends on another's
function weightOf(c) {
  const missRate = (c.wrong + 1) / (c.right + c.wrong + 2); // smoothed: unseen card = 0.5
  return WEIGHT_MIN + (WEIGHT_MAX - WEIGHT_MIN) * missRate;
}

// One independent draw: chance of picking a card = its weight / total weight
function drawWeighted(cards) {
  const total = cards.reduce((sum, c) => sum + weightOf(c), 0);
  let r = Math.random() * total;
  for (const c of cards) {
    r -= weightOf(c);
    if (r < 0) return c;
  }
  return cards[cards.length - 1]; // guards against floating-point rounding
}

// Each draw is independent (with replacement), so a card can appear more than once or not at all
function buildWeightedQueue(cards, n) {
  return Array.from({ length: n }, () => drawWeighted(cards));
}

// ---- Quiz tab ----
function startQuiz(cards) {
  queue = shuffle(cards);
  pos = 0;
  flipped = false;
  right = [];
  wrong = [];
  renderQuiz();
}

function renderQuiz() {
  const el = $("quiz");
  if (deck.length === 0) {
    el.innerHTML =
      '<p class="empty">Your deck is empty. Add a card on the Cards tab to start.</p>';
    return;
  }
  if (queue.length === 0) {
    startQuiz(deck);
    return;
  }

  if (pos >= queue.length) {
    const pct = Math.round((right.length / queue.length) * 100);
    el.innerHTML = `
      <div class="done">
        <p class="big">${right.length}/${queue.length}</p>
        <p>${pct}% correct</p>
        <div class="row">
          <button class="btn ghost" id="again">Restart deck</button>
          <button class="btn" id="redo" ${wrong.length ? "" : "disabled"}>Review ${wrong.length} missed</button>
        </div>
      </div>`;
    $("again").onclick = () => startQuiz(deck);
    // A card can be drawn and missed twice in one round, so review each missed card once
    $("redo").onclick = () => startQuiz([...new Set(wrong)]);
    return;
  }

  const c = queue[pos];
  el.innerHTML = `
    <div class="meta"><span>Card ${pos + 1} of ${queue.length}</span><span>${right.length} right · ${wrong.length} missed</span></div>
    <div class="bar"><div style="width:${(pos / queue.length) * 100}%"></div></div>
    <div class="card ${flipped ? "answer" : ""}" id="card" tabindex="0" role="button" aria-label="Flip card">
      <span class="side">${flipped ? "Answer" : "Question"}</span>
      <span class="text">${esc(flipped ? c.a : c.q)}</span>
    </div>
    ${
      flipped
        ? `<div class="row"><button class="btn bad" id="miss">Missed it</button><button class="btn good" id="got">Got it</button></div>`
        : `<p class="hint">Tap the card or press Space to reveal the answer</p>`
    }`;
  $("card").onclick = flip;
  if (flipped) {
    $("got").onclick = () => answer(true);
    $("miss").onclick = () => answer(false);
  }
}

function flip() {
  flipped = !flipped;
  renderQuiz();
}

function answer(ok) {
  const card = queue[pos];
  if (ok) {
    right.push(card);
    card.right++;
  } else {
    wrong.push(card);
    card.wrong++;
  }
  saveDeck();
  pos++;
  flipped = false;
  renderQuiz();
}

// ---- Random tab ----
// Every card has the same chance: pick a random index from 0 to deck.length - 1
function pickRandom(){
  if (deck.length === 0) { rCard = null; rFlipped = false; return; }
  // Every card except the one just shown, unless it's the only card
  const pool = deck.length > 1 ? deck.filter(c => c !== rCard) : deck;
  rCard = pool[Math.floor(Math.random() * pool.length)];
  rFlipped = false;
}

function renderRandom() {
  const el = $("random");
  if (deck.length === 0) {
    el.innerHTML =
      '<p class="empty">Your deck is empty. Add a card on the Cards tab to start.</p>';
    return;
  }
  if (!rCard || !deck.includes(rCard)) pickRandom(); // e.g. the card was deleted

  el.innerHTML = `
    <div class="meta"><span>Random card</span><span>${rRight} right · ${rWrong} missed this session</span></div>
    <div class="card ${rFlipped ? "answer" : ""}" id="rcard" tabindex="0" role="button" aria-label="Flip card">
      <span class="side">${rFlipped ? "Answer" : "Question"}</span>
      <span class="text">${esc(rFlipped ? rCard.a : rCard.q)}</span>
    </div>
    ${
      rFlipped
        ? `<div class="row"><button class="btn bad" id="rmiss">Missed it</button><button class="btn good" id="rgot">Got it</button></div>`
        : `<p class="hint">Tap the card or press Space to reveal the answer</p>`
    }`;
  $("rcard").onclick = flipRandom;
  if (rFlipped) {
    $("rgot").onclick = () => answerRandom(true);
    $("rmiss").onclick = () => answerRandom(false);
  }
}

function flipRandom() {
  rFlipped = !rFlipped;
  renderRandom();
}

function answerRandom(ok) {
  if (ok) {
    rCard.right++;
    rRight++;
  } else {
    rCard.wrong++;
    rWrong++;
  }
  saveDeck();
  pickRandom();
  renderRandom();
}

// ---- Space bar flips whichever card mode is showing ----
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,textarea") || e.code !== "Space") return;
  if (!$("quiz").hidden && queue.length && pos < queue.length) {
    e.preventDefault();
    flip();
  } else if (!$("random").hidden && rCard) {
    e.preventDefault();
    flipRandom();
  }
});

// ---- Cards tab ----
function renderCards() {
  $("cards").innerHTML = `
    <label for="deckname">Deck name</label>
    <input id="deckname" type="text" maxlength="60" placeholder="flashcards" value="${esc(deckName)}">
    <p class="hint" id="filehint"></p>
    <label for="nq">Question</label>
    <textarea id="nq" placeholder="What is a variable?"></textarea>
    <label for="na">Answer</label>
    <textarea id="na" placeholder="A named place to store a value."></textarea>
    <div class="row"><button class="btn" id="add">Add card</button></div>
    <p class="hint" id="msg" aria-live="polite"></p>
    <ul class="list">
      ${
        deck.length
          ? deck
              .map(
                (c) => `
        <li><div><b>${esc(c.q)}</b><span>${esc(c.a)}</span>
        <span style="display:block;margin-top:4px">${c.right} right · ${c.wrong} missed</span></div>
        <button class="del" data-id="${c.id}" aria-label="Delete card">Delete</button></li>`,
              )
              .join("")
          : '<li class="empty" style="display:block;border:none;background:none">No cards yet.</li>'
      }
    </ul>`;
  // Typing updates the saved name and the filename preview without redrawing the tab (keeps focus)
  const updateHint = () => {
    $("filehint").textContent =
      `Exports as ${fileBase()}.json or ${fileBase()}.txt`;
  };
  $("deckname").oninput = (e) => {
    deckName = e.target.value;
    saveName();
    updateHint();
  };
  updateHint();

  $("add").onclick = () => {
    const q = $("nq").value.trim(),
      a = $("na").value.trim();
    if (!q || !a) {
      $("msg").textContent = "Fill in both the question and the answer.";
      return;
    }
    deck.push({ id: nextId++, q, a, right: 0, wrong: 0 });
    saveDeck(); // save after adding
    queue = []; // rebuild the quiz next time it opens
    renderCards();
    $("msg").textContent = "Card added.";
  };
  document.querySelectorAll(".del").forEach(
    (b) =>
      (b.onclick = () => {
        deck = deck.filter((c) => c.id !== Number(b.dataset.id));
        saveDeck(); // save after deleting
        queue = [];
        renderCards();
      }),
  );
}

// ---- Tabs ----
let currentTab = "quiz";

function show(which) {
  currentTab = which;
  for (const name of ["quiz", "random", "cards"]) {
    $(name).hidden = name !== which;
    $("tab-" + name).setAttribute("aria-selected", name === which);
  }
  if (which === "quiz") renderQuiz();
  else if (which === "random") {
    pickRandom();
    renderRandom();
  } // fresh card each time you open it
  else renderCards();
}
$("tab-quiz").onclick = () => show("quiz");
$("tab-random").onclick = () => show("random");
$("tab-cards").onclick = () => show("cards");

// ---- Import (.json or .txt) ----
// Every parser throws an Error on the first problem, so a bad file never reaches the deck.

// Removes one matching pair of surrounding quotes: 'text' or "text"
function stripQuotes(s) {
  const t = s.trim();
  const first = t[0],
    last = t[t.length - 1];
  if (t.length >= 2 && (first === "'" || first === '"') && first === last) {
    return t.slice(1, -1).trim();
  }
  return t;
}

// Block format: a line starting with "Q:" begins a question and a line starting with "A:" begins its answer.
// Every line after that, up to the next "Q:" or "A:" line, belongs to the same block.
function parseTxt(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/); // drop BOM, handle Windows line endings
  const cards = [];
  let block = null; // the Q or A block being collected: { kind, line, lines }
  let pendingQ = null,
    pendingLine = 0;

  // Closes the current block: joins its lines into one text and files it as a question or an answer
  function finishBlock() {
    if (!block) return;
    const body = stripQuotes(block.lines.join("\n").trim()); // trims blank lines at both ends only
    if (body === "")
      throw new Error(`Line ${block.line} has no text after “${block.kind}:”.`);
    if (block.kind === "Q") {
      pendingQ = body;
      pendingLine = block.line;
    } else {
      cards.push({ q: pendingQ, a: body, right: 0, wrong: 0 });
      pendingQ = null;
    }
    block = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\s+$/, ""); // trailing spaces never matter
    const m = raw.match(/^\s*([QA])\s*:\s*(.*)$/i);

    if (m) {
      // a new block starts here
      finishBlock();
      const kind = m[1].toUpperCase();
      const expected = pendingQ === null ? "Q" : "A";
      if (kind !== expected)
        throw new Error(
          `Line ${i + 1} should start with “${expected}:” but starts with “${kind}:”.`,
        );
      block = { kind, line: i + 1, lines: [m[2]] };
    } else if (block) {
      block.lines.push(raw); // continuation: keeps indentation and blank lines
    } else if (raw.trim() !== "") {
      throw new Error(`Line ${i + 1} appears before the first “Q:” line.`);
    }
  }
  finishBlock();

  if (pendingQ !== null)
    throw new Error(
      `The question on line ${pendingLine} has no “A:” block after it.`,
    );
  if (cards.length === 0) throw new Error("No cards were found in the file.");
  return cards;
}

// A count must be a whole number of 0 or more (negatives would break the weights)
const toCount = (v) => Math.max(0, Math.floor(Number(v) || 0));

// Expects an array of objects with text in "q" and "a"; counts are optional
function parseJson(text) {
  let data;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("The file is not valid JSON.");
  }

  if (!Array.isArray(data))
    throw new Error("The JSON must be an array of cards.");
  if (data.length === 0) throw new Error("No cards were found in the file.");

  return data.map((c, i) => {
    const ok =
      c &&
      typeof c === "object" &&
      typeof c.q === "string" &&
      c.q.trim() !== "" &&
      typeof c.a === "string" &&
      c.a.trim() !== "";
    if (!ok) throw new Error(`Card ${i + 1} needs non-empty “q” and “a” text.`);
    return {
      q: c.q.trim(),
      a: c.a.trim(),
      right: toCount(c.right ?? c.r), // accepts right/wrong or r/w
      wrong: toCount(c.wrong ?? c.w),
    };
  });
}

// Picks the parser by file extension, then gives every card a fresh id (the file's ids are ignored)
function buildDeckFromFile(name, text) {
  const ext = name.split(".").pop().toLowerCase();
  let cards;
  if (ext === "json") cards = parseJson(text);
  else if (ext === "txt") cards = parseTxt(text);
  else throw new Error("Please choose a .json or .txt file.");
  return cards.map((c, i) => ({
    id: i + 1,
    q: c.q,
    a: c.a,
    right: c.right,
    wrong: c.wrong,
  }));
}

// ---- Export helpers ----
// Writes cards in the same Q:/A: block format the importer reads. Text is wrapped in single quotes
// (the importer removes one pair), so text that itself starts and ends with quotes survives a round trip.
function toTxt(cards) {
  return cards.map((c) => `Q: '${c.q}'\nA: '${c.a}'`).join("\n\n") + "\n";
}

// In a .txt file, a second or later line starting with "Q:" or "A:" would be read as a new block
function hasAmbiguousLine(c) {
  return [c.q, c.a].some((t) =>
    t
      .split("\n")
      .slice(1)
      .some((l) => /^\s*[QA]\s*:/i.test(l)),
  );
}

function setImportMessage(text, ok) {
  const el = $("import-msg");
  el.textContent = text;
  el.className = "msg " + (ok ? "ok" : "err");
}

$("import-btn").onclick = () => $("import-file").click();

$("import-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const newDeck = buildDeckFromFile(file.name, text); // throws before the deck is touched

    if (
      !confirm(
        `Replace your ${deck.length} current card(s) with ${newDeck.length} imported card(s)? This can’t be undone.`,
      )
    ) {
      setImportMessage("", true);
      return;
    }

    deck = newDeck;
    deckName = file.name.replace(/\.[^.]+$/, ""); // the file's name (without extension) becomes the deck name
    saveName();
    nextId = deck.length + 1;
    saveDeck();
    queue = []; // rebuild the quiz from the new deck
    rCard = null; // forget the old random card
    show(currentTab); // redraw whichever tab is open
    setImportMessage(`Imported ${deck.length} card(s).`, true);
  } catch (err) {
    setImportMessage(
      `Import failed: ${err.message} Your deck was not changed.`,
      false,
    );
  } finally {
    e.target.value = ""; // lets you pick the same file again
  }
};

// ---- Export (.json or .txt) ----
function downloadFile(filename, text, mime) {
  const url = URL.createObjectURL(
    new Blob([text], { type: mime + ";charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // give the browser time to start the download
}

// Turns the deck name into a safe filename (no extension). Falls back to "flashcards".
function fileBase() {
  const cleaned = deckName
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "") // characters filenames can't contain
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "") // no leading or trailing dots
    .slice(0, 60)
    .trim();
  if (cleaned === "") return "flashcards";
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(cleaned)
    ? "_" + cleaned
    : cleaned; // names Windows reserves
}

function exportDeck(kind) {
  if (deck.length === 0) {
    setImportMessage("Nothing to export: your deck is empty.", false);
    return;
  }

  // Exported copies get fresh ids and counts reset to 0. The deck in the app is not touched.
  const cards = deck.map((c, i) => ({
    id: i + 1,
    q: c.q,
    a: c.a,
    right: 0,
    wrong: 0,
  }));
  const base = fileBase();

  if (kind === "json") {
    downloadFile(
      `${base}.json`,
      JSON.stringify(cards, null, 2) + "\n",
      "application/json",
    );
    setImportMessage(
      `Exported ${cards.length} card(s) to ${base}.json with counts reset to 0. Your deck here is unchanged.`,
      true,
    );
  } else {
    downloadFile(`${base}.txt`, toTxt(cards), "text/plain");
    const risky = cards.filter(hasAmbiguousLine).length;
    if (risky === 0) {
      setImportMessage(
        `Exported ${cards.length} card(s) to ${base}.txt. The .txt format has no counts.`,
        true,
      );
    } else {
      setImportMessage(
        `Exported ${cards.length} card(s) to ${base}.txt, but ${risky} card(s) have a line starting with “Q:” or “A:” that a .txt import would misread. Use .json for a lossless copy.`,
        false,
      );
    }
  }
}

const exportBtn = $("export-btn"),
  exportMenu = $("export-menu");
function toggleExportMenu(open) {
  exportMenu.hidden = !open;
  exportBtn.setAttribute("aria-expanded", String(open));
}
exportBtn.onclick = (e) => {
  e.stopPropagation();
  toggleExportMenu(exportMenu.hidden);
};
document.addEventListener("click", () => toggleExportMenu(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") toggleExportMenu(false);
});
$("export-json").onclick = () => exportDeck("json");
$("export-txt").onclick = () => exportDeck("txt");

show("quiz");
