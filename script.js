// --- Word Collections ---
const WORD_SETS = {
  easy: [
    "cat", "dog", "sun", "fun", "run", "happy", "blue", "star", "play", "ball",
    "tree", "bird", "fish", "toy", "duck", "park", "jump", "smile", "milk", "kind"
  ],
  medium: [
    "keyboard", "practice", "journey", "awesome", "freedom", "challenge",
    "victory", "galaxy", "starlight", "champion", "adventure", "learning",
    "speed", "focus", "rhythm", "energy", "creativity", "dynamic", "spark"
  ],
  hard: [
    "technological", "architecture", "extraordinary", "synchronize",
    "philosophical", "biodiversity", "unbelievable", "optimization",
    "methodology", "infrastructure", "quantifiable", "subterranean"
  ]
};

// --- Web Audio API Synth Engine ---
let audioMuted = false;
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function playSound(freq, type = 'sine', duration = 0.05) {
  if (audioMuted) return;
  if (!audioCtx) audioCtx = new AudioContext();
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio context safety catch
  }
}

// --- Engine State Variables ---
let currentWords = [];
let wordString = "";
let charPointer = 0;
let timeRemaining = 30;
let totalTime = 30;
let timerInterval = null;
let isPlaying = false;

// Metrics
let totalTypedKeys = 0;
let correctCharacters = 0;
let backspaceCount = 0;
let currentStreak = 0;
let maxStreak = 0;

// Track individual status of typed indexes: true (correct), false (incorrect)
let charStatusHistory = [];

// --- DOM References ---
const wordDisplayEl = document.getElementById("word-display");
const hiddenInputEl = document.getElementById("hidden-input");
const typingBoxEl = document.getElementById("typing-box");
const gameCardEl = document.getElementById("game-card");

const timerEl = document.getElementById("timer");
const wpmEl = document.getElementById("wpm");
const accuracyEl = document.getElementById("accuracy");
const streakEl = document.getElementById("streak");
const backspacesEl = document.getElementById("backspaces");

const difficultySelect = document.getElementById("difficulty-select");
const timeSelect = document.getElementById("time-select");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const soundBtn = document.getElementById("sound-btn");

const modalEl = document.getElementById("result-modal");
const modalRestartBtn = document.getElementById("modal-restart-btn");
const finalWpmEl = document.getElementById("final-wpm");
const finalAccuracyEl = document.getElementById("final-accuracy");
const finalStreakEl = document.getElementById("final-streak");
const finalBackspacesEl = document.getElementById("final-backspaces");
const finalScoreEl = document.getElementById("final-score");
const modalTitleEl = document.getElementById("modal-title");
const modalRatingEl = document.getElementById("modal-rating");

// --- Setup & Listeners ---
function init() {
  timeSelect.addEventListener("change", updateTimeSetting);
  difficultySelect.addEventListener("change", generateWordList);
  
  typingBoxEl.addEventListener("click", () => hiddenInputEl.focus());
  
  // Backspace & key capture handling
  hiddenInputEl.addEventListener("keydown", handleKeyDown);
  hiddenInputEl.addEventListener("input", handleInput);

  soundBtn.addEventListener("click", toggleSound);
  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", resetGame);
  modalRestartBtn.addEventListener("click", () => {
    hideModal();
    resetGame();
    startGame();
  });

  // Global Start Shortcut
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !isPlaying && document.activeElement !== difficultySelect && document.activeElement !== timeSelect) {
      e.preventDefault();
      startGame();
    }
  });

  generateWordList();
}

function toggleSound() {
  audioMuted = !audioMuted;
  soundBtn.textContent = audioMuted ? "🔇" : "🔊";
}

function updateTimeSetting() {
  totalTime = parseInt(timeSelect.value);
  timeRemaining = totalTime;
  timerEl.textContent = `${timeRemaining}s`;
}

function generateWordList() {
  const level = difficultySelect.value;
  const library = WORD_SETS[level];
  currentWords = [];
  
  for (let i = 0; i < 40; i++) {
    const randomIndex = Math.floor(Math.random() * library.length);
    currentWords.push(library[randomIndex]);
  }
  
  wordString = currentWords.join(" ");
  renderText();
}

function renderText() {
  wordDisplayEl.innerHTML = "";
  wordString.split("").forEach((char, index) => {
    const span = document.createElement("span");
    span.classList.add("char");
    span.textContent = char;
    if (index === 0) span.classList.add("current");
    wordDisplayEl.appendChild(span);
  });
}

// --- Typing Mechanics & Backspace Logic ---
function startGame() {
  if (isPlaying) return;
  
  resetGame();
  isPlaying = true;
  hiddenInputEl.focus();
  startBtn.disabled = true;

  timerInterval = setInterval(() => {
    timeRemaining--;
    timerEl.textContent = `${timeRemaining}s`;
    
    calculateStats();

    if (timeRemaining <= 0) {
      endGame();
    }
  }, 1000);
}

function handleKeyDown(e) {
  if (!isPlaying) return;

  const charElements = wordDisplayEl.querySelectorAll(".char");

  // Handle Backspace Key explicitly
  if (e.key === "Backspace") {
    if (charPointer > 0) {
      backspaceCount++;
      backspacesEl.textContent = backspaceCount;

      // Remove current cursor highlight
      if (charPointer < charElements.length) {
        charElements[charPointer].classList.remove("current");
      }

      // Step back
      charPointer--;

      // Check if previous state was correct or error
      const wasCorrect = charStatusHistory.pop();
      if (wasCorrect) {
        correctCharacters--;
      }

      // Reset style on target letter
      charElements[charPointer].classList.remove("correct", "incorrect");
      charElements[charPointer].classList.add("current");

      playSound(350, 'triangle', 0.04); // Backspace SFX
    }
  }
}

function handleInput(e) {
  if (!isPlaying) return;

  const charElements = wordDisplayEl.querySelectorAll(".char");
  const inputValue = hiddenInputEl.value;
  const typedChar = inputValue[inputValue.length - 1];

  // Process standard character keypress
  if (typedChar && charPointer < charElements.length) {
    totalTypedKeys++;
    const targetChar = wordString[charPointer];

    charElements[charPointer].classList.remove("current");

    if (typedChar === targetChar) {
      charElements[charPointer].classList.add("correct");
      correctCharacters++;
      charStatusHistory.push(true);
      
      // Update Streaks
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
      
      // Pitch scaling SFX for streak feedback
      const streakPitch = Math.min(500 + (currentStreak * 15), 1000);
      playSound(streakPitch, 'sine', 0.03);
    } else {
      charElements[charPointer].classList.add("incorrect");
      charStatusHistory.push(false);
      
      // Reset streak and trigger error feedback
      currentStreak = 0;
      playSound(150, 'sawtooth', 0.08);
      
      // Screen Shake
      gameCardEl.classList.add("shake");
      setTimeout(() => gameCardEl.classList.remove("shake"), 200);
    }

    charPointer++;

    if (charPointer < charElements.length) {
      charElements[charPointer].classList.add("current");
    } else {
      // Loop word set if completed early
      generateWordList();
      charPointer = 0;
    }
  }

  hiddenInputEl.value = "";
  streakEl.textContent = `${currentStreak}x`;
  calculateStats();
}

function calculateStats() {
  const timeElapsed = totalTime - timeRemaining;
  
  // Words per minute formula
  const wpm = timeElapsed > 0 ? Math.round((correctCharacters / 5) / (timeElapsed / 60)) : 0;
  
  // Accuracy percentage
  const accuracy = totalTypedKeys > 0 ? Math.round((correctCharacters / totalTypedKeys) * 100) : 100;

  wpmEl.textContent = wpm;
  accuracyEl.textContent = `${accuracy}%`;

  return { wpm, accuracy };
}

function resetGame() {
  clearInterval(timerInterval);
  isPlaying = false;
  charPointer = 0;
  totalTypedKeys = 0;
  correctCharacters = 0;
  backspaceCount = 0;
  currentStreak = 0;
  maxStreak = 0;
  charStatusHistory = [];
  
  updateTimeSetting();
  wpmEl.textContent = "0";
  accuracyEl.textContent = "100%";
  streakEl.textContent = "0x";
  backspacesEl.textContent = "0";
  
  startBtn.disabled = false;
  hiddenInputEl.value = "";
  
  generateWordList();
}

function endGame() {
  clearInterval(timerInterval);
  isPlaying = false;
  startBtn.disabled = false;

  const { wpm, accuracy } = calculateStats();
  
  // Score formula factoring Streak Bonus
  const score = Math.round((wpm * (accuracy / 100) * 10) + (maxStreak * 5));

  finalWpmEl.textContent = wpm;
  finalAccuracyEl.textContent = `${accuracy}%`;
  finalStreakEl.textContent = maxStreak;
  finalBackspacesEl.textContent = backspaceCount;
  finalScoreEl.textContent = score;

  // Rank designations
  if (wpm >= 60) {
    modalTitleEl.textContent = "⚡ Speed Demon!";
    modalRatingEl.textContent = "Rank: Legendary Typist";
  } else if (wpm >= 35) {
    modalTitleEl.textContent = "🎉 Great Job!";
    modalRatingEl.textContent = "Rank: Pro Keyboardist";
  } else {
    modalTitleEl.textContent = "👍 Good Effort!";
    modalRatingEl.textContent = "Rank: Rising Star";
  }

  showModal();
  triggerConfetti();
}

// --- Effects & Canvas Confetti ---
function showModal() {
  modalEl.classList.remove("hidden");
}

function hideModal() {
  modalEl.classList.add("hidden");
}

function triggerConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ["#6c5ce7", "#00cec9", "#00b894", "#fdcb6e", "#e84393"];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 14 - 3,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 100
    });
  }

  function renderParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    particles.forEach((p) => {
      if (p.life > 0) {
        active = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life -= 1.5;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (active) {
      requestAnimationFrame(renderParticles);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  renderParticles();
}

document.addEventListener("DOMContentLoaded", init);
