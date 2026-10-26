// ---- Data: your deck lives in this array (resets on refresh in this version) ----
let deck = [
  {
    id: 1,
    q: "What does git commit do?",
    a: "Saves a snapshot of your staged changes to the project history.",
  },
  {
    id: 2,
    q: "What does a bug report need most?",
    a: "The exact error, what you did, what you expected, and what happened.",
  },
  {
    id: 3,
    q: "Why build one feature at a time?",
    a: "Small steps are easy to test, and easy to undo when something breaks.",
  },
  {
    id: 4,
    q: "What is a spec?",
    a: "A short description of what the app does and what “done” looks like.",
  },
];
let nextId = 5;

// ---- Quiz state ----
let queue = [],
  pos = 0,
  flipped = false,
  right = [],
  wrong = [];

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
    $("redo").onclick = () => startQuiz(wrong.slice());
    return;
  }

  const c = queue[pos];
  el.innerHTML = `
    <div class="meta"><span>Card ${pos + 1} of ${queue.length}</span><span>${right.length} right · ${wrong.length} missed</span></div>
    <div class="bar"><div style="width:${(pos / queue.length) * 100}%"></div></div>
    <div class="card ${flipped ? "answer" : ""}" id="card" tabindex="0" role="button" aria-label="Flip card">
      <span class="side">${flipped ? "Answer" : "Question"}</span>
      ${esc(flipped ? c.a : c.q)}
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
  (ok ? right : wrong).push(queue[pos]);
  pos++;
  flipped = false;
  renderQuiz();
}

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,textarea") || $("quiz").hidden) return;
  if (e.code === "Space" && pos < queue.length && queue.length) {
    e.preventDefault();
    flip();
  }
});

// ---- Cards tab ----
function renderCards() {
  $("cards").innerHTML = `
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
        <li><div><b>${esc(c.q)}</b><span>${esc(c.a)}</span></div>
        <button class="del" data-id="${c.id}" aria-label="Delete card">Delete</button></li>`,
              )
              .join("")
          : '<li class="empty" style="display:block;border:none;background:none">No cards yet.</li>'
      }
    </ul>`;
  $("add").onclick = () => {
    const q = $("nq").value.trim(),
      a = $("na").value.trim();
    if (!q || !a) {
      $("msg").textContent = "Fill in both the question and the answer.";
      return;
    }
    deck.push({ id: nextId++, q, a });
    queue = []; // rebuild the quiz next time it opens
    renderCards();
    $("msg").textContent = "Card added.";
  };
  document.querySelectorAll(".del").forEach(
    (b) =>
      (b.onclick = () => {
        deck = deck.filter((c) => c.id !== Number(b.dataset.id));
        queue = [];
        renderCards();
      }),
  );
}

// ---- Tabs ----
function show(which) {
  const quiz = which === "quiz";
  $("quiz").hidden = !quiz;
  $("cards").hidden = quiz;
  $("tab-quiz").setAttribute("aria-selected", quiz);
  $("tab-cards").setAttribute("aria-selected", !quiz);
  if (quiz) renderQuiz();
  else renderCards();
}
$("tab-quiz").onclick = () => show("quiz");
$("tab-cards").onclick = () => show("cards");

show("quiz");
