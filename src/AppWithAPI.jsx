import { GoogleLogin } from "@react-oauth/google";
import { useCallback, useEffect, useRef, useState } from "react";
import { authAPI, wordsAPI, attemptsAPI } from "./api";

// ─── Screens ──────────────────────────────────────────────────────────────────
const SCREENS = {
  LOGIN: "LOGIN",
  HOME: "HOME",
  CATEGORY: "CATEGORY",
  QUIZ: "QUIZ",
  RESULTS: "RESULTS",
  PROFILE: "PROFILE",
};

// ─── TTS Utility ─────────────────────────────────────────────────────────────
function speakWord(word, rate = 0.85) {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.rate = rate;
  utt.pitch = 1;
  window.speechSynthesis.speak(utt);
}

// ─── Shuffle Utility ──────────────────────────────────────────────────────────
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState(SCREENS.LOGIN);
  const [user, setUser] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [quizResults, setQuizResults] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("auth_token");
    const savedUser = localStorage.getItem("user");
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      setScreen(SCREENS.HOME);
    }
  }, []);

  const handleGoogleLoginSuccess = async (credentialResponse) => {
    try {
      const response = await authAPI.googleLogin(credentialResponse.credential);
      localStorage.setItem("auth_token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      setUser(response.data.user);
      setScreen(SCREENS.HOME);
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    setUser(null);
    setScreen(SCREENS.LOGIN);
  };

  const handleStartQuiz = (cat) => {
    setSelectedCategory(cat);
    setScreen(SCREENS.QUIZ);
  };

  const handleQuizComplete = async (newAttempts) => {
    try {
      // Save attempts to database
      await attemptsAPI.saveAttempts(newAttempts);
      setAttempts((prev) => [...prev, ...newAttempts]);
    } catch (error) {
      console.error("Failed to save attempts:", error);
      // Still show results even if save fails
      setAttempts((prev) => [...prev, ...newAttempts]);
    }
    // Store results and show results screen
    setQuizResults(newAttempts);
    setScreen(SCREENS.RESULTS);
  };

  // Load attempts from database when user logs in
  useEffect(() => {
    if (user && screen === SCREENS.PROFILE) {
      const loadAttempts = async () => {
        try {
          const response = await attemptsAPI.getAllAttempts();
          setAttempts(response.data);
        } catch (error) {
          console.error("Failed to load attempts:", error);
        }
      };
      loadAttempts();
    }
  }, [user, screen]);

  return (
    <div style={styles.appRoot}>
      <div style={styles.bgDecor1} />
      <div style={styles.bgDecor2} />
      {screen === SCREENS.LOGIN && (
        <LoginScreen onSuccess={handleGoogleLoginSuccess} />
      )}
      {screen === SCREENS.HOME && (
        <HomeScreen
          user={user}
          onSelectFeature={() => setScreen(SCREENS.CATEGORY)}
          onProfile={() => setScreen(SCREENS.PROFILE)}
          onLogout={handleLogout}
        />
      )}
      {screen === SCREENS.CATEGORY && (
        <CategoryScreen
          onSelect={handleStartQuiz}
          onBack={() => setScreen(SCREENS.HOME)}
        />
      )}
      {screen === SCREENS.QUIZ && (
        <QuizScreen
          category={selectedCategory}
          onComplete={handleQuizComplete}
          onBack={() => setScreen(SCREENS.CATEGORY)}
        />
      )}
      {screen === SCREENS.RESULTS && (
        <ResultsScreen
          results={quizResults}
          category={selectedCategory}
          onHome={() => setScreen(SCREENS.HOME)}
          onRetry={() => setScreen(SCREENS.QUIZ)}
        />
      )}
      {screen === SCREENS.PROFILE && (
        <ProfileScreen
          user={user}
          attempts={attempts}
          onBack={() => setScreen(SCREENS.HOME)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (credentialResponse) => {
    setIsLoading(true);
    onSuccess(credentialResponse);
  };

  return (
    <div style={styles.loginWrapper}>
      <div style={styles.loginCard}>
        <div style={styles.loginLogo}>
          <div style={styles.logoIcon}>🎧</div>
          <h1 style={styles.loginTitle}>WordEar</h1>
          <p style={styles.loginSub}>Listen. Spell. Master.</p>
        </div>

        <div style={styles.loginFeatures}>
          {["🔊 Listen to words", "✍️ Spell them out", "📊 Track progress"].map(
            (f) => (
              <div key={f} style={styles.featureChip}>
                {f}
              </div>
            )
          )}
        </div>

        <div style={{ opacity: isLoading ? 0.7 : 1, marginBottom: 20 }}>
          <GoogleLogin
            onSuccess={handleLogin}
            onError={() => alert("Login failed")}
          />
        </div>

        <p style={styles.loginNote}>
          Sign in with Google to get started
        </p>
      </div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ user, onSelectFeature, onProfile, onLogout }) {
  const features = [
    {
      icon: "🎧",
      label: "Word by Listening",
      desc: "Hear it, spell it",
      active: true,
      action: onSelectFeature,
    },
    { icon: "📖", label: "Vocabulary Builder", desc: "Coming soon", active: false },
    { icon: "🏆", label: "Daily Challenge", desc: "Coming soon", active: false },
    { icon: "🎯", label: "Speed Mode", desc: "Coming soon", active: false },
  ];

  return (
    <div style={styles.screen}>
      <div style={styles.homeHeader}>
        <div>
          <p style={styles.greet}>Welcome back 👋</p>
          <h2 style={styles.userName}>{user?.name}</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.avatarBtn} onClick={onProfile}>
            <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
          </button>
          <button style={styles.logoutBtn} onClick={onLogout}>
            🚪
          </button>
        </div>
      </div>

      <div style={styles.heroBanner}>
        <div style={styles.heroBannerInner}>
          <h3 style={styles.heroTitle}>Ready to train your ear?</h3>
          <p style={styles.heroSub}>
            Listen to words and spell them correctly to earn points.
          </p>
        </div>
        <div style={styles.heroBannerEmoji}>🎧</div>
      </div>

      <h3 style={styles.sectionLabel}>Choose a Mode</h3>
      <div style={styles.featuresGrid}>
        {features.map((f) => (
          <button
            key={f.label}
            style={{
              ...styles.featureCard,
              ...(f.active
                ? styles.featureCardActive
                : styles.featureCardDisabled),
            }}
            onClick={f.active ? f.action : undefined}
            disabled={!f.active}
          >
            <div style={styles.featureCardIcon}>{f.icon}</div>
            <div style={styles.featureCardLabel}>{f.label}</div>
            <div style={styles.featureCardDesc}>{f.desc}</div>
            {f.active && <div style={styles.featureCardBadge}>Play →</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Category Screen ──────────────────────────────────────────────────────────
function CategoryScreen({ onSelect, onBack }) {
  const rows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ];

  return (
    <div style={styles.screen}>
      <div style={styles.navRow}>
        <button style={styles.backBtn} onClick={onBack}>
          ← Back
        </button>
        <h2 style={styles.screenTitle}>Pick a Category</h2>
        <div style={{ width: 60 }} />
      </div>

      <p style={styles.catSubtitle}>
        Select a letter to start spelling words from that category
      </p>

      <div style={styles.keyboardContainer}>
        {rows.map((row, ri) => (
          <div key={ri} style={styles.keyboardRow}>
            {row.map((letter) => (
              <button
                key={letter}
                style={styles.keyBtn}
                onClick={() => onSelect(letter)}
              >
                <span style={styles.keyBtnLetter}>{letter}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quiz Screen ──────────────────────────────────────────────────────────────
function QuizScreen({ category, onComplete, onBack }) {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const fetchWords = async () => {
      try {
        const response = await wordsAPI.getWordsByLetter(category);
        const shuffledWords = shuffleArray(response.data);
        setWords(shuffledWords);
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch words:", error);
        alert("Failed to load words");
        onBack();
      }
    };
    fetchWords();
  }, [category, onBack]);

  useEffect(() => {
    if (words.length > 0 && index < words.length) {
      setTimeout(() => playAudio(), 400);
      inputRef.current?.focus();
    }
  }, [index, words]);

  const current = words[index];

  const playAudio = useCallback(() => {
    if (!current) return;
    setIsPlaying(true);
    speakWord(current.word);
    setTimeout(() => setIsPlaying(false), 1800);
  }, [current]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    const isCorrect =
      input.trim().toLowerCase() === current.word.toLowerCase();
    const attempt = {
      word: current.word,
      user_answer: input.trim(),
      is_correct: isCorrect,
      category,
      timestamp: new Date().toISOString(),
    };
    setAttempts((prev) => [...prev, attempt]);
    if (isCorrect) {
      setScore((s) => s + 1);
      setFeedback("correct");
    } else {
      setFeedback("wrong");
    }
  };

  const handleNext = () => {
    if (index + 1 >= words.length) {
      onComplete(attempts.concat());
    } else {
      setIndex((i) => i + 1);
      setInput("");
      setFeedback(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (feedback) handleNext();
      else handleSubmit();
    }
  };

  if (loading) {
    return (
      <div style={styles.screen}>
        <div style={{ textAlign: "center", padding: "40px" }}>Loading words...</div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div style={styles.screen}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          No words found for this category
        </div>
      </div>
    );
  }

  const progressPct = Math.round((index / words.length) * 100);

  return (
    <div style={styles.screen}>
      <div style={styles.quizHeader}>
        <button style={styles.backBtn} onClick={onBack}>
          ← Back
        </button>
        <div style={styles.quizMeta}>
          <span style={styles.quizCat}>Category: {category}</span>
          <span style={styles.quizScore}>⭐ {score} pts</span>
        </div>
      </div>

      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${progressPct}%` }} />
      </div>
      <div style={styles.progressLabel}>
        {index + 1} / {words.length}
      </div>

      <div style={styles.audioSection}>
        <div style={styles.audioHint}>
          {current?.description || current?.hint || ""}
        </div>
        <button
          style={{
            ...styles.audioBtn,
            ...(isPlaying ? styles.audioBtnPlaying : {}),
          }}
          onClick={playAudio}
        >
          <span style={styles.audioIcon}>{isPlaying ? "🔊" : "▶"}</span>
          <span style={styles.audioBtnText}>
            {isPlaying ? "Playing..." : "Play Word"}
          </span>
        </button>
        <p style={styles.audioSub}>
          Press the button to hear the word, then type it below
        </p>
      </div>

      <div style={styles.inputSection}>
        <input
          ref={inputRef}
          style={{
            ...styles.wordInput,
            borderColor:
              feedback === "correct"
                ? "#22c55e"
                : feedback === "wrong"
                ? "#ef4444"
                : "#e2e8f0",
            boxShadow:
              feedback === "correct"
                ? "0 0 0 4px rgba(34,197,94,0.15)"
                : feedback === "wrong"
                ? "0 0 0 4px rgba(239,68,68,0.15)"
                : "none",
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type the word you heard..."
          disabled={!!feedback}
          autoComplete="off"
          spellCheck={false}
        />

        {!feedback && (
          <button style={styles.submitBtn} onClick={handleSubmit}>
            Check Answer →
          </button>
        )}
      </div>

      {feedback === "correct" && (
        <div style={styles.feedbackCorrect}>
          <div style={styles.feedbackIcon}>✅</div>
          <div style={styles.feedbackTitle}>Correct! +1 point</div>
          <div style={styles.feedbackWord}>"{current.word}"</div>
          <button style={styles.nextBtn} onClick={handleNext}>
            {index + 1 >= words.length ? "See Results 🏆" : "Next Word →"}
          </button>
        </div>
      )}

      {feedback === "wrong" && (
        <div style={styles.feedbackWrong}>
          <div style={styles.feedbackIcon}>❌</div>
          <div style={styles.feedbackTitle}>Not quite!</div>
          <div style={styles.feedbackCorrectWord}>
            Correct spelling:{" "}
            <strong style={{ color: "#f97316" }}>{current.word}</strong>
          </div>
          <div style={styles.feedbackYours}>Your answer: <em>{input}</em></div>
          <button style={styles.nextBtnOrange} onClick={handleNext}>
            {index + 1 >= words.length ? "See Results 🏆" : "Next Word →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────
function ResultsScreen({ results, category, onHome, onRetry }) {
  if (!results || results.length === 0) {
    return (
      <div style={styles.screen}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          No results to display
        </div>
      </div>
    );
  }

  const total = results.length;
  const correct = results.filter((r) => r.is_correct).length;
  const wrong = total - correct;
  const accuracy = Math.round((correct / total) * 100);

  return (
    <div style={styles.screen}>
      <div style={styles.navRow}>
        <h2 style={styles.screenTitle}>Quiz Results 🎉</h2>
      </div>

      {/* Stats Summary */}
      <div style={styles.resultsSummary}>
        <div style={styles.resultsCategory}>Category: <strong>{category}</strong></div>
        <div style={styles.resultsStats}>
          <div style={styles.statItem}>
            <div style={{ ...styles.statValue, color: "#6366f1" }}>{total}</div>
            <div style={styles.statLabel}>Total</div>
          </div>
          <div style={styles.statItem}>
            <div style={{ ...styles.statValue, color: "#22c55e" }}>{correct}</div>
            <div style={styles.statLabel}>Correct</div>
          </div>
          <div style={styles.statItem}>
            <div style={{ ...styles.statValue, color: "#ef4444" }}>{wrong}</div>
            <div style={styles.statLabel}>Wrong</div>
          </div>
          <div style={styles.statItem}>
            <div style={{ ...styles.statValue, color: "#f97316" }}>{accuracy}%</div>
            <div style={styles.statLabel}>Accuracy</div>
          </div>
        </div>
      </div>

      {/* Accuracy Bar */}
      <div style={styles.accuracySection}>
        <div style={styles.accBar}>
          <div style={{ ...styles.accFill, width: `${accuracy}%` }} />
        </div>
      </div>

      {/* Attempted Words List */}
      <div style={styles.resultsTitle}>Attempted Words</div>
      <div style={styles.resultsList}>
        {results.map((result, index) => (
          <div key={index} style={styles.resultItem}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1 }}>
              <div
                style={{
                  ...styles.resultDot,
                  background: result.is_correct ? "#22c55e" : "#ef4444",
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={styles.resultWord}>{index + 1}. {result.word}</div>
                {!result.is_correct && (
                  <div style={styles.resultYourAnswer}>
                    You wrote: <strong>"{result.user_answer}"</strong>
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                ...styles.resultBadge,
                background: result.is_correct ? "#dcfce7" : "#fee2e2",
                color: result.is_correct ? "#16a34a" : "#dc2626",
              }}
            >
              {result.is_correct ? "✓" : "✗"}
            </div>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div style={styles.resultsButtons}>
        <button style={styles.retryBtn} onClick={onRetry}>
          🔄 Retry This Category
        </button>
        <button style={styles.homeBtn} onClick={onHome}>
          🏠 Back to Home
        </button>
      </div>
    </div>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────
function ProfileScreen({ user, attempts, onBack }) {
  // Get only the latest attempt for each word
  const getLatestAttempts = (allAttempts) => {
    const latestByWord = {};
    allAttempts.forEach((attempt) => {
      const key = `${attempt.word.toLowerCase()}_${attempt.category}`;
      if (!latestByWord[key] || new Date(attempt.created_at) > new Date(latestByWord[key].created_at)) {
        latestByWord[key] = attempt;
      }
    });
    return Object.values(latestByWord);
  };

  const latestAttempts = getLatestAttempts(attempts);
  const total = latestAttempts.length;
  const correct = latestAttempts.filter((a) => a.is_correct).length;
  const wrong = total - correct;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const catStats = {};
  latestAttempts.forEach((a) => {
    if (!catStats[a.category])
      catStats[a.category] = { total: 0, correct: 0 };
    catStats[a.category].total++;
    if (a.is_correct) catStats[a.category].correct++;
  });

  const [tab, setTab] = useState("overview");

  return (
    <div style={styles.screen}>
      <div style={styles.navRow}>
        <button style={styles.backBtn} onClick={onBack}>
          ← Back
        </button>
        <h2 style={styles.screenTitle}>My Profile</h2>
        <div style={{ width: 60 }} />
      </div>

      <div style={styles.profileCard}>
        <div style={styles.profileAvatar}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={styles.profileName}>{user?.name}</div>
          <div style={styles.profileEmail}>{user?.email}</div>
        </div>
      </div>

      <div style={styles.statsRow}>
        {[
          { label: "Attempted", value: total, color: "#6366f1" },
          { label: "Correct", value: correct, color: "#22c55e" },
          { label: "Wrong", value: wrong, color: "#ef4444" },
          { label: "Accuracy", value: `${accuracy}%`, color: "#f97316" },
        ].map((s) => (
          <div key={s.label} style={styles.statCard}>
            <div style={{ ...styles.statValue, color: s.color }}>
              {s.value}
            </div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div style={styles.accSection}>
          <div style={styles.accLabel}>Overall Accuracy</div>
          <div style={styles.accBar}>
            <div style={{ ...styles.accFill, width: `${accuracy}%` }} />
          </div>
          <div style={styles.accPct}>{accuracy}%</div>
        </div>
      )}

      <div style={styles.tabs}>
        {["overview", "history"].map((t) => (
          <button
            key={t}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === "overview" ? "📊 By Category" : "📋 History"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={styles.catList}>
          {Object.keys(catStats).length === 0 && (
            <p style={styles.emptyMsg}>No quiz attempts yet. Start playing! 🎮</p>
          )}
          {Object.entries(catStats).map(([cat, stats]) => {
            const pct = Math.round((stats.correct / stats.total) * 100);
            return (
              <div key={cat} style={styles.catStatRow}>
                <div style={styles.catStatLetter}>{cat}</div>
                <div style={styles.catStatInfo}>
                  <div style={styles.catStatBar}>
                    <div style={{ ...styles.catStatFill, width: `${pct}%` }} />
                  </div>
                  <div style={styles.catStatNums}>
                    {stats.correct}/{stats.total} correct ({pct}%)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "history" && (
        <div style={styles.historyList}>
          {latestAttempts.length === 0 && (
            <p style={styles.emptyMsg}>No attempts yet. Start playing! 🎮</p>
          )}
          {[...latestAttempts].reverse().map((a, i) => (
            <div key={i} style={styles.historyRow}>
              <div
                style={{
                  ...styles.historyDot,
                  background: a.is_correct ? "#22c55e" : "#ef4444",
                }}
              />
              <div style={styles.historyInfo}>
                <span style={styles.historyWord}>{a.word}</span>
                <span style={styles.historyCat}>[{a.category}]</span>
                {!a.is_correct && (
                  <span style={styles.historyWrong}>
                    You wrote: "{a.user_answer}"
                  </span>
                )}
              </div>
              <div
                style={{
                  ...styles.historyBadge,
                  background: a.is_correct ? "#dcfce7" : "#fee2e2",
                  color: a.is_correct ? "#16a34a" : "#dc2626",
                }}
              >
                {a.is_correct ? "✓" : "✗"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Styles (same as before with additions) ──────────────────────────────────
const PRIMARY = "#fe6249";
const PRIMARY_LIGHT = "#ffe7e5";
const DARK = "#1a1a2e";
const CARD = "#ffffff";

const styles = {
  appRoot: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  bgDecor1: {
    position: "fixed",
    top: -100,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(254,98,73,0.15) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  bgDecor2: {
    position: "fixed",
    bottom: -150,
    left: -100,
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  screen: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "96vh",
    overflowY: "auto",
    background: "#f8fafc",
    borderRadius: 24,
    padding: "20px 16px 32px",
    boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
    position: "relative",
    zIndex: 1,
  },
  loginWrapper: {
    width: "100%",
    maxWidth: 420,
    padding: 16,
    zIndex: 1,
  },
  loginCard: {
    background: "#fff",
    borderRadius: 28,
    padding: "40px 32px",
    boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
    textAlign: "center",
  },
  loginLogo: { marginBottom: 24 },
  logoIcon: { fontSize: 56, marginBottom: 8 },
  loginTitle: {
    fontSize: 36,
    fontWeight: 900,
    color: DARK,
    margin: 0,
    letterSpacing: -1,
  },
  loginSub: { color: "#94a3b8", fontSize: 16, margin: "6px 0 0" },
  loginFeatures: { display: "flex", flexDirection: "column", gap: 8, margin: "24px 0" },
  featureChip: {
    background: "#f1f5f9",
    borderRadius: 12,
    padding: "10px 16px",
    fontSize: 15,
    color: "#475569",
    textAlign: "left",
  },
  loginNote: { fontSize: 12, color: "#94a3b8", marginTop: 12 },
  homeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  logoutBtn: {
    background: "#f1f5f9",
    border: "none",
    borderRadius: 10,
    width: 46,
    height: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 20,
  },
  greet: { margin: 0, fontSize: 13, color: "#94a3b8" },
  userName: { margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: DARK },
  avatarBtn: { background: "none", border: "none", cursor: "pointer", padding: 0 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${PRIMARY}, #f97316)`,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 15,
  },
  heroBanner: {
    background: `linear-gradient(135deg, ${PRIMARY} 0%, #f97316 100%)`,
    borderRadius: 20,
    padding: "20px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    color: "#fff",
  },
  heroBannerInner: {},
  heroTitle: { margin: 0, fontSize: 19, fontWeight: 800 },
  heroSub: { margin: "6px 0 0", fontSize: 13, opacity: 0.85 },
  heroBannerEmoji: { fontSize: 44 },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 12,
  },
  featuresGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  featureCard: {
    background: CARD,
    border: "none",
    borderRadius: 16,
    padding: "18px 14px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    transition: "transform 0.15s",
  },
  featureCardActive: { border: `2px solid ${PRIMARY}` },
  featureCardDisabled: { opacity: 0.5, cursor: "not-allowed" },
  featureCardIcon: { fontSize: 28, marginBottom: 8 },
  featureCardLabel: { fontSize: 14, fontWeight: 700, color: DARK },
  featureCardDesc: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  featureCardBadge: {
    marginTop: 10,
    display: "inline-block",
    background: PRIMARY_LIGHT,
    color: PRIMARY,
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 20,
  },
  navRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    background: "#f1f5f9",
    border: "none",
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 14,
    fontWeight: 600,
    color: "#475569",
    cursor: "pointer",
  },
  screenTitle: { fontSize: 18, fontWeight: 800, color: DARK, margin: 0 },
  catSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 20,
  },
  keyboardContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "center",
  },
  keyboardRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  keyBtn: {
    width: 42,
    height: 52,
    background: CARD,
    border: `2px solid #e2e8f0`,
    borderRadius: 10,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
    boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
  },
  keyBtnLetter: { fontSize: 18, fontWeight: 800, color: DARK },
  quizHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  quizMeta: { display: "flex", gap: 12, alignItems: "center" },
  quizCat: {
    background: PRIMARY_LIGHT,
    color: PRIMARY,
    borderRadius: 20,
    padding: "4px 12px",
    fontSize: 13,
    fontWeight: 700,
  },
  quizScore: { fontSize: 15, fontWeight: 700, color: DARK },
  progressBar: {
    height: 6,
    background: "#e2e8f0",
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    background: `linear-gradient(90deg, ${PRIMARY}, #f97316)`,
    borderRadius: 99,
    transition: "width 0.4s ease",
  },
  progressLabel: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "right",
    marginBottom: 16,
  },
  audioSection: {
    background: CARD,
    borderRadius: 20,
    padding: "24px 20px",
    textAlign: "center",
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  audioHint: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 16,
    fontStyle: "italic",
  },
  audioBtn: {
    background: `linear-gradient(135deg, ${PRIMARY}, #f97316)`,
    border: "none",
    borderRadius: 50,
    width: 100,
    height: 100,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
    boxShadow: `0 8px 24px rgba(254,98,73,0.35)`,
    transition: "transform 0.15s",
  },
  audioBtnPlaying: {
    transform: "scale(1.1)",
    boxShadow: `0 12px 32px rgba(254,98,73,0.45)`,
  },
  audioIcon: { fontSize: 32, color: "#fff" },
  audioBtnText: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  audioSub: { fontSize: 12, color: "#94a3b8", margin: 0 },
  inputSection: { marginBottom: 16 },
  wordInput: {
    width: "100%",
    border: "2px solid #e2e8f0",
    borderRadius: 14,
    padding: "14px 18px",
    fontSize: 20,
    fontWeight: 700,
    color: DARK,
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    textAlign: "center",
    letterSpacing: 2,
    background: CARD,
    boxSizing: "border-box",
  },
  submitBtn: {
    width: "100%",
    marginTop: 12,
    background: DARK,
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  feedbackCorrect: {
    background: "#f0fdf4",
    border: "2px solid #bbf7d0",
    borderRadius: 20,
    padding: "20px",
    textAlign: "center",
  },
  feedbackWrong: {
    background: "#fff5f5",
    border: "2px solid #fecaca",
    borderRadius: 20,
    padding: "20px",
    textAlign: "center",
  },
  feedbackIcon: { fontSize: 36, marginBottom: 8 },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: DARK,
    marginBottom: 4,
  },
  feedbackWord: {
    fontSize: 22,
    fontWeight: 900,
    color: "#16a34a",
    letterSpacing: 2,
  },
  feedbackCorrectWord: { fontSize: 16, color: "#374151", marginBottom: 4 },
  feedbackYours: { fontSize: 14, color: "#94a3b8", marginBottom: 12 },
  nextBtn: {
    marginTop: 14,
    background: "#22c55e",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  nextBtnOrange: {
    marginTop: 14,
    background: PRIMARY,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  profileCard: {
    background: CARD,
    borderRadius: 20,
    padding: "16px 20px",
    display: "flex",
    gap: 14,
    alignItems: "center",
    marginBottom: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${PRIMARY}, #f97316)`,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 20,
    flexShrink: 0,
  },
  profileName: { fontSize: 18, fontWeight: 800, color: DARK },
  profileEmail: { fontSize: 13, color: "#64748b" },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    background: CARD,
    borderRadius: 14,
    padding: "12px 8px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  statValue: { fontSize: 22, fontWeight: 900 },
  statLabel: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  accSection: { marginBottom: 16 },
  accLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
  },
  accBar: {
    height: 10,
    background: "#e2e8f0",
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 4,
  },
  accFill: {
    height: "100%",
    background: `linear-gradient(90deg, #22c55e, #16a34a)`,
    borderRadius: 99,
    transition: "width 0.6s ease",
  },
  accPct: { fontSize: 12, color: "#64748b", textAlign: "right" },
  tabs: { display: "flex", gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    background: "#f1f5f9",
    border: "none",
    borderRadius: 12,
    padding: "10px",
    fontSize: 14,
    fontWeight: 600,
    color: "#64748b",
    cursor: "pointer",
  },
  tabActive: { background: DARK, color: "#fff" },
  catList: { display: "flex", flexDirection: "column", gap: 10 },
  catStatRow: { display: "flex", gap: 12, alignItems: "center" },
  catStatLetter: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: PRIMARY_LIGHT,
    color: PRIMARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 18,
    flexShrink: 0,
  },
  catStatInfo: { flex: 1 },
  catStatBar: {
    height: 6,
    background: "#e2e8f0",
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 3,
  },
  catStatFill: {
    height: "100%",
    background: `linear-gradient(90deg, ${PRIMARY}, #f97316)`,
    borderRadius: 99,
  },
  catStatNums: { fontSize: 12, color: "#64748b" },
  historyList: { display: "flex", flexDirection: "column", gap: 8 },
  historyRow: {
    background: CARD,
    borderRadius: 12,
    padding: "12px 14px",
    display: "flex",
    gap: 10,
    alignItems: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  },
  historyDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  historyInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  historyWord: { fontSize: 15, fontWeight: 700, color: DARK },
  historyCat: { fontSize: 12, color: "#94a3b8" },
  historyWrong: { fontSize: 12, color: "#ef4444" },
  historyBadge: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 14,
    flexShrink: 0,
  },
  emptyMsg: { textAlign: "center", color: "#94a3b8", fontSize: 14, padding: "20px 0" },
  // Results Screen Styles
  resultsSummary: {
    background: "linear-gradient(135deg, #fe6249 0%, #f97316 100%)",
    borderRadius: 16,
    padding: "20px",
    color: "#fff",
    marginBottom: 20,
  },
  resultsCategory: {
    fontSize: 14,
    marginBottom: 12,
    opacity: 0.9,
  },
  resultsStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 12,
  },
  statItem: {
    textAlign: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: 900,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.8,
  },
  accuracySection: {
    marginBottom: 20,
  },
  accBar: {
    height: 8,
    background: "#e2e8f0",
    borderRadius: 99,
    overflow: "hidden",
  },
  accFill: {
    height: "100%",
    background: "linear-gradient(90deg, #22c55e, #16a34a)",
    borderRadius: 99,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1a1a2e",
    marginBottom: 12,
  },
  resultsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 20,
  },
  resultItem: {
    background: "#ffffff",
    borderRadius: 12,
    padding: "12px 14px",
    display: "flex",
    gap: 10,
    alignItems: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  },
  resultDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  resultWord: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1a1a2e",
  },
  resultYourAnswer: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  resultBadge: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
  },
  resultsButtons: {
    display: "flex",
    gap: 12,
    flexDirection: "column",
  },
  retryBtn: {
    background: "#fe6249",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  homeBtn: {
    background: "#1a1a2e",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
};
