import { GoogleLogin } from "@react-oauth/google";
import { useCallback, useEffect, useRef, useState } from "react";
import { authAPI, wordsAPI, attemptsAPI, shadowingAPI, groupsAPI } from "./api";
import "./app.css";
import "./quiz.css";

// ─── Screens ──────────────────────────────────────────────────────────────────
const SCREENS = {
  LOGIN: "LOGIN",
  HOME: "HOME",
  CATEGORY: "CATEGORY",
  QUIZ: "QUIZ",
  RESULTS: "RESULTS",
  PROFILE: "PROFILE",
  SHADOWING_LEVELS: "SHADOWING_LEVELS",
  SHADOWING_QUIZ: "SHADOWING_QUIZ",
  SHADOWING_RESULTS: "SHADOWING_RESULTS",
  MY_GROUPS: "MY_GROUPS",
  GROUP_DETAIL: "GROUP_DETAIL",
  GROUP_QUIZ: "GROUP_QUIZ",
  GROUP_RESULTS: "GROUP_RESULTS",
};

// ─── TTS Utility ─────────────────────────────────────────────────────────────
function getBestVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // 1. Google UK English Female (preferred)
  const ukFemale = voices.find(
    (v) => v.name === "Google UK English Female"
  );
  if (ukFemale) return ukFemale;
  // 2. Any en-GB voice
  const enGB = voices.find((v) => v.lang === "en-GB");
  if (enGB) return enGB;
  // 3. Microsoft Natural (Edge)
  const natural = voices.find(
    (v) => /natural/i.test(v.name) && v.lang.startsWith("en")
  );
  if (natural) return natural;
  // 4. Any Google English voice
  const google = voices.find(
    (v) => /google/i.test(v.name) && v.lang.startsWith("en")
  );
  if (google) return google;
  // 5. Any English voice
  return voices.find((v) => v.lang.startsWith("en")) || voices[0];
}

function speakText(text, { rate = 0.92, onEnd } = {}) {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = rate;
  utt.pitch = 1;
  utt.volume = 1;
  if (onEnd) utt.onend = onEnd;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    const best = getBestVoice();
    if (best) utt.voice = best;
    window.speechSynthesis.speak(utt);
  } else {
    // Voices not yet loaded — wait for them
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      const best = getBestVoice();
      if (best) utt.voice = best;
      window.speechSynthesis.speak(utt);
    };
  }
}

// Keep backward-compat call used in QuizScreen
function speakWord(word) {
  speakText(word);
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

// ─── AdUnit Component ─────────────────────────────────────────────────────────
function AdUnit({ slot, style = {} }) {
  const ref = useRef(null);
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // AdSense not loaded yet
    }
  }, []);

  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: "block", ...style }}
      data-ad-client="ca-pub-2749327485848465"
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState(SCREENS.LOGIN);
  const [user, setUser] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [quizResults, setQuizResults] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [shadowingResults, setShadowingResults] = useState(null);
  const [shadowingAttempts, setShadowingAttempts] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupQuizResults, setGroupQuizResults] = useState(null);

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

  const handleStartShadowing = (level) => {
    setSelectedLevel(level);
    setScreen(SCREENS.SHADOWING_QUIZ);
  };

  const handleGroupQuizComplete = (results) => {
    setGroupQuizResults(results);
    setScreen(SCREENS.GROUP_RESULTS);
  };

  const handleShadowingComplete = async (newAttempts) => {
    try {
      await shadowingAPI.saveAttempts(newAttempts);
    } catch (error) {
      console.error("Failed to save shadowing attempts:", error);
    }
    setShadowingResults(newAttempts);
    setScreen(SCREENS.SHADOWING_RESULTS);
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

  // Load both word and shadowing attempts when profile opens
  useEffect(() => {
    if (user && screen === SCREENS.PROFILE) {
      const loadAttempts = async () => {
        try {
          const [wordRes, shadowRes] = await Promise.all([
            attemptsAPI.getAllAttempts(),
            shadowingAPI.getAllAttempts(),
          ]);
          setAttempts(wordRes.data);
          setShadowingAttempts(shadowRes.data);
        } catch (error) {
          console.error("Failed to load attempts:", error);
        }
      };
      loadAttempts();
    }
  }, [user, screen]);

  return (
    <div className="app-root">
      {screen === SCREENS.LOGIN && (
        <LoginScreen onSuccess={handleGoogleLoginSuccess} />
      )}
      {screen === SCREENS.HOME && (
        <HomeScreen
          user={user}
          onSelectFeature={() => setScreen(SCREENS.CATEGORY)}
          onShadowing={() => setScreen(SCREENS.SHADOWING_LEVELS)}
          onGroups={() => setScreen(SCREENS.MY_GROUPS)}
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
          shadowingAttempts={shadowingAttempts}
          onBack={() => setScreen(SCREENS.HOME)}
          onLogout={handleLogout}
        />
      )}
      {screen === SCREENS.MY_GROUPS && (
        <MyGroupsScreen
          user={user}
          onOpenGroup={(group) => { setSelectedGroup(group); setScreen(SCREENS.GROUP_DETAIL); }}
          onBack={() => setScreen(SCREENS.HOME)}
        />
      )}
      {screen === SCREENS.GROUP_DETAIL && (
        <GroupDetailScreen
          group={selectedGroup}
          onStartQuiz={() => { setGroupQuizResults(null); setScreen(SCREENS.GROUP_QUIZ); }}
          onBack={() => setScreen(SCREENS.MY_GROUPS)}
          onGroupUpdated={(g) => setSelectedGroup(g)}
        />
      )}
      {screen === SCREENS.GROUP_QUIZ && (
        <GroupQuizScreen
          group={selectedGroup}
          onComplete={handleGroupQuizComplete}
          onBack={() => setScreen(SCREENS.GROUP_DETAIL)}
        />
      )}
      {screen === SCREENS.GROUP_RESULTS && (
        <GroupResultsScreen
          results={groupQuizResults}
          group={selectedGroup}
          onHome={() => setScreen(SCREENS.HOME)}
          onRetry={() => setScreen(SCREENS.GROUP_QUIZ)}
          onBack={() => setScreen(SCREENS.GROUP_DETAIL)}
        />
      )}
      {screen === SCREENS.SHADOWING_LEVELS && (
        <ShadowingLevelScreen
          onSelect={handleStartShadowing}
          onBack={() => setScreen(SCREENS.HOME)}
        />
      )}
      {screen === SCREENS.SHADOWING_QUIZ && (
        <ShadowingQuizScreen
          level={selectedLevel}
          onComplete={handleShadowingComplete}
          onBack={() => setScreen(SCREENS.SHADOWING_LEVELS)}
        />
      )}
      {screen === SCREENS.SHADOWING_RESULTS && (
        <ShadowingResultsScreen
          results={shadowingResults}
          level={selectedLevel}
          onHome={() => setScreen(SCREENS.HOME)}
          onRetry={() => setScreen(SCREENS.SHADOWING_QUIZ)}
        />
      )}

      {/* Background ad panels — desktop only, shown in the 15% strips left/right of the card */}
      <div className="bg-ad bg-ad-left">
        <AdUnit slot="9729254192" />
      </div>
      <div className="bg-ad bg-ad-right">
        <AdUnit slot="8006155169" />
      </div>
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
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo-icon">🎧</div>
        <h1 className="login-title">English Backbone</h1>
        <p className="login-sub">Listen. Spell. Master.</p>

        <div className="login-features">
          {["🔊 Listen to words", "✍️ Spell them out", "📊 Track progress"].map(f => (
            <div key={f} className="login-chip">{f}</div>
          ))}
        </div>

        <div style={{ opacity: isLoading ? 0.7 : 1 }}>
          <GoogleLogin onSuccess={handleLogin} onError={() => alert("Login failed")} />
        </div>

        <p className="login-note">Sign in with Google to get started</p>
      </div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ user, onSelectFeature, onShadowing, onGroups, onProfile }) {
  const isBlocked = user?.is_blocked_groups;
  const features = [
    {
      icon: "🎧",
      label: "Word by Listening",
      desc: "Hear it, spell it",
      active: true,
      action: onSelectFeature,
    },
    {
      icon: "🗣️",
      label: "Shadowing Practice",
      desc: "Hear it, say it",
      active: true,
      action: onShadowing,
    },
    {
      icon: isBlocked ? "🔒" : "📁",
      label: "My Groups",
      desc: isBlocked ? "Locked by admin" : "Build your own lists",
      active: !isBlocked,
      action: onGroups,
      locked: isBlocked,
    },
  ];

  return (
    <div className="app-screen">
      <div className="screen-card">
        <div className="card-head">
          <div className="home-user-row">
            <div>
              <p className="home-greet">Welcome back 👋</p>
              <h2 className="home-username">{user?.name}</h2>
            </div>
            <button className="home-avatar" onClick={onProfile}>
              {user?.name?.[0]?.toUpperCase()}
            </button>
          </div>
        </div>

        <div className="screen-body">
          <h3 className="section-title">Choose a Mode</h3>
          <div className="features-grid">
            {features.map((f) => (
              <button
                key={f.label}
                className={`feature-card${f.locked ? " locked" : ""}`}
                onClick={f.active ? f.action : undefined}
                disabled={!f.active}
              >
                <div className="feature-card-icon">{f.icon}</div>
                <div className="feature-card-text">
                  <span className="feature-card-label">{f.label}</span>
                  <span className="feature-card-desc">{f.desc}</span>
                </div>
                {f.active && !f.locked && <div className="feature-card-badge">Play →</div>}
                {f.locked && <div className="feature-card-badge" style={{ background: "#fee2e2", color: "#dc2626" }}>Locked</div>}
              </button>
            ))}
          </div>
        </div>
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
    <div className="app-screen">
      <div className="screen-card">
        <div className="card-head">
          <div className="card-head-row">
            <button className="back-btn" onClick={onBack}>
              <i className="fa-solid fa-arrow-left" /> Back
            </button>
            <span className="card-badge">Pick a Category</span>
          </div>
          <h1 className="card-head-title">Select a Letter</h1>
          <p className="card-head-sub">Tap a letter to start spelling words from that category</p>
        </div>

        <div className="screen-body">
          <div className="kbd-wrap">
            {rows.map((row, ri) => (
              <div key={ri} className="kbd-row">
                {row.map((letter) => (
                  <button key={letter} className="kbd-key" onClick={() => onSelect(letter)}>
                    {letter}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quiz Screen ──────────────────────────────────────────────────────────────
function QuizScreen({ category, onComplete, onBack }) {
  const [words, setWords]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [index, setIndex]       = useState(0);
  const [input, setInput]       = useState("");
  const [feedback, setFeedback] = useState(null); // null | "correct" | "wrong"
  const [score, setScore]       = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); // used by countdown effect
  const inputRef = useRef(null);

  /* fetch words */
  useEffect(() => {
    (async () => {
      try {
        const res = await wordsAPI.getWordsByLetter(category);
        setWords(shuffleArray(res.data));
        setLoading(false);
      } catch {
        alert("Failed to load words");
        onBack();
      }
    })();
  }, [category, onBack]);

  /* auto-play + focus on new word */
  useEffect(() => {
    if (words.length > 0 && index < words.length) {
      setTimeout(() => playAudio(), 400);
      inputRef.current?.focus();
    }
  }, [index, words]);

  /* countdown timer — resets each new word */
  useEffect(() => {
    if (loading) return;
    setTimeLeft(60);
    const t = setInterval(() => {
      setTimeLeft(n => { if (n <= 1) { clearInterval(t); return 0; } return n - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [index, loading]);

  const current = words[index];

  const playAudio = useCallback(() => {
    if (!current) return;
    setIsPlaying(true);
    speakWord(current.word);
    setTimeout(() => setIsPlaying(false), 1800);
  }, [current]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    const isCorrect = input.trim().toLowerCase() === current.word.toLowerCase();
    const attempt = { word: current.word, user_answer: input.trim(), is_correct: isCorrect, category, timestamp: new Date().toISOString() };
    setAttempts(prev => [...prev, attempt]);
    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (index + 1 >= words.length) { onComplete([...attempts]); return; }
    setIndex(i => i + 1);
    setInput("");
    setFeedback(null);
  };

  const handleKeyDown = e => {
    if (e.key === "Enter") { feedback ? handleNext() : handleSubmit(); }
  };

  /* loading states */
  if (loading) return (
    <div className="quiz-root" style={{ alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#fff", fontSize: 22, fontFamily: "'Jost', sans-serif" }}>Loading words…</p>
    </div>
  );
  if (words.length === 0) return (
    <div className="quiz-root" style={{ alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#fff", fontSize: 22, fontFamily: "'Jost', sans-serif" }}>No words found for this category.</p>
      <button onClick={onBack} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 8, border: "none", background: "rgb(254,98,73)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Go Back</button>
    </div>
  );

  /* step progress dots (4 checkpoints across word list) */
  return (
    <div className="quiz-root">
      <div className="quiz-card">

        {/* back + score */}
        <div className="quiz-meta-row">
          <button className="quiz-back-btn" onClick={onBack}>
            <i className="fa-solid fa-arrow-left" /> Back
          </button>
          <span className="quiz-score">⭐ {score} pts &nbsp;|&nbsp; {index + 1} / {words.length}</span>
        </div>

        {/* question / hint */}
        <h1 className="quiz-question">
          {current?.description || current?.hint || "Listen and type the word"}
        </h1>

        {/* option boxes */}
        <div className="quiz-fieldset">

          {/* round play button */}
          <button
            className={`round-play-btn${isPlaying ? " playing" : ""}`}
            onClick={playAudio}
            aria-label="Play word"
          >
            <i className={`fa-solid ${isPlaying ? "fa-volume-high" : "fa-play"}`} />
          </button>

          {/* text input + arrow button side by side */}
          <div className="quiz-input-row">
            <div className={`quiz-option${feedback === "correct" ? " correct" : feedback === "wrong" ? " wrong" : ""}`}>
              <input
                ref={inputRef}
                className={`quiz-input${feedback === "correct" ? " correct" : feedback === "wrong" ? " wrong" : ""}`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type the word you heard…"
                readOnly={!!feedback}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {!feedback && (
              <button className="quiz-input-arrow" onClick={handleSubmit} aria-label="Check answer">
                <i className="fa-solid fa-arrow-right" />
              </button>
            )}
          </div>

          {/* feedback strip — directly under the input row */}
          {feedback === "correct" && (
            <div className="quiz-feedback ok">
              ✅ &nbsp;<strong>Correct! +1 pt</strong>&nbsp;&nbsp;
              <span style={{ color: "rgb(254,98,73)", fontWeight: 900, letterSpacing: 2 }}>"{current.word}"</span>
            </div>
          )}
          {feedback === "wrong" && (
            <div className="quiz-feedback bad">
              ❌ &nbsp;<strong>Not quite!</strong>&nbsp; Correct:&nbsp;
              <strong style={{ color: "rgb(254,98,73)" }}>{current.word}</strong>
              &nbsp;— You wrote: <em>{input}</em>
            </div>
          )}
        </div>

        {/* nav buttons */}
        <div className="quiz-nav">
          {attempts.length > 0 && (
            <button onClick={() => onComplete([...attempts])}>
              <i className="fa-solid fa-arrow-left" /> FINISH EARLY
            </button>
          )}
          {!feedback ? (
            <button className="next-btn quiz-nav-check" onClick={handleSubmit}>
              CHECK ANSWER <i className="fa-solid fa-arrow-right" />
            </button>
          ) : (
            <button className="next-btn" onClick={handleNext}>
              {index + 1 >= words.length ? "SEE RESULTS 🏆" : <>NEXT WORD <i className="fa-solid fa-arrow-right" /></>}
            </button>
          )}
        </div>
      </div>
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
    <div className="app-screen">
      <div className="screen-card">
        <div className="card-head">
          <h1 className="card-head-title">Quiz Results 🎉</h1>
          <p className="card-head-sub">Category: <strong style={{ color: "var(--primary)" }}>{category}</strong></p>
        </div>

        <div className="screen-body">
          {/* Stats */}
          <div className="results-summary">
            <div className="stats-row">
              {[
                { label: "Total",    value: total,        color: "var(--primary)" },
                { label: "Correct",  value: correct,      color: "#22c55e" },
                { label: "Wrong",    value: wrong,        color: "#ef4444" },
                { label: "Accuracy", value: `${accuracy}%`, color: "var(--dark)" },
              ].map(s => (
                <div key={s.label} className="stat-box">
                  <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Accuracy bar */}
          <div className="acc-bar-wrap">
            <div className="acc-bar"><div className="acc-fill" style={{ width: `${accuracy}%` }} /></div>
          </div>

          <div className="results-section-title">Attempted Words</div>
          <div className="result-list">
            {results.map((r, i) => {
              const userAnswer = r.user_answer ?? r.answer ?? r.userAnswer ?? "";
              const correctAnswer = r.word ?? r.content ?? "";
              const isCorrect = r.is_correct ?? (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase());
              return (
                <div key={i} className="result-row">
                  <div className="result-dot" style={{ background: isCorrect ? "#22c55e" : "#ef4444" }} />
                  <div style={{ flex: 1 }}>
                    <div className="result-word">{i + 1}. {correctAnswer}</div>
                    <div className="result-your">You wrote: <strong>"{userAnswer}"</strong></div>
                    {!isCorrect && <div className="result-correct">Correct: <strong>"{correctAnswer}"</strong></div>}
                  </div>
                  <div className="result-badge" style={{ background: isCorrect ? "#dcfce7" : "#fee2e2", color: isCorrect ? "#16a34a" : "#dc2626" }}>
                    {isCorrect ? "✓" : "✗"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="screen-nav">
          <button onClick={onRetry}><i className="fa-solid fa-rotate-right" /> RETRY</button>
          <button className="primary" onClick={onHome}><i className="fa-solid fa-house" /> HOME</button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────
function ProfileScreen({ user, attempts, shadowingAttempts, onBack, onLogout }) {
  // Deduplicate word attempts — keep latest per word+category
  const getLatestWordAttempts = (allAttempts) => {
    const latestByWord = {};
    allAttempts.forEach((attempt) => {
      const key = `${attempt.word.toLowerCase()}_${attempt.category}`;
      if (!latestByWord[key] || new Date(attempt.created_at) > new Date(latestByWord[key].created_at)) {
        latestByWord[key] = attempt;
      }
    });
    return Object.values(latestByWord);
  };

  // Deduplicate shadowing attempts — keep latest per sentence+level
  const getLatestShadowingAttempts = (allAttempts) => {
    const latestBySentence = {};
    allAttempts.forEach((attempt) => {
      const key = `${attempt.level_id}_${attempt.sentence}`;
      if (!latestBySentence[key] || new Date(attempt.created_at) > new Date(latestBySentence[key].created_at)) {
        latestBySentence[key] = attempt;
      }
    });
    return Object.values(latestBySentence);
  };

  const [localAttempts, setLocalAttempts] = useState(attempts);
  const [localShadowingAttempts, setLocalShadowingAttempts] = useState(shadowingAttempts || []);

  useEffect(() => { setLocalAttempts(attempts); }, [attempts]);
  useEffect(() => { setLocalShadowingAttempts(shadowingAttempts || []); }, [shadowingAttempts]);

  const handleDeleteWord = async (word, category) => {
    try {
      await attemptsAPI.deleteAttempt(word, category);
      setLocalAttempts((prev) =>
        prev.filter((a) => !(a.word === word && a.category === category))
      );
    } catch (error) {
      console.error("Failed to delete attempt:", error);
      alert("Could not delete. Please try again.");
    }
  };

  const handleDeleteShadowing = async (id) => {
    try {
      await shadowingAPI.deleteAttempt(id);
      setLocalShadowingAttempts((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error("Failed to delete shadowing attempt:", error);
      alert("Could not delete. Please try again.");
    }
  };

  const latestWordAttempts = getLatestWordAttempts(localAttempts);
  const latestShadowingAttempts = getLatestShadowingAttempts(localShadowingAttempts);

  // Combined stats
  const allLatest = [...latestWordAttempts, ...latestShadowingAttempts];
  const total = allLatest.length;
  const shadowingCorrect = latestShadowingAttempts.filter((a) =>
    a.user_answer.trim().toLowerCase() === a.sentence.toLowerCase()
  ).length;
  const correct = latestWordAttempts.filter((a) => a.is_correct).length + shadowingCorrect;
  const wrong = total - correct;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Word category stats
  const catStats = {};
  latestWordAttempts.forEach((a) => {
    if (!catStats[a.category]) catStats[a.category] = { total: 0, correct: 0 };
    catStats[a.category].total++;
    if (a.is_correct) catStats[a.category].correct++;
  });

  // Shadowing level stats
  const levelStats = {};
  latestShadowingAttempts.forEach((a) => {
    const levelName = a.level?.name || `Level ${a.level_id}`;
    if (!levelStats[levelName]) levelStats[levelName] = { total: 0, correct: 0 };
    levelStats[levelName].total++;
    if (a.user_answer.trim().toLowerCase() === a.sentence.toLowerCase()) {
      levelStats[levelName].correct++;
    }
  });

  // Combined history sorted newest first
  const wordRows = localAttempts.map((a) => ({ ...a, _type: "word" }));
  const shadowRows = localShadowingAttempts.map((a) => ({ ...a, _type: "shadowing" }));
  const combinedHistory = [...wordRows, ...shadowRows].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const [tab, setTab] = useState("overview");
  const [historyFilter, setHistoryFilter] = useState("all");

  const filteredHistory = combinedHistory.filter((attempt) => {
    if (historyFilter === "all") return true;
    return attempt._type === historyFilter;
  });

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="app-screen">
      <div className="screen-card">
        <div className="card-head">
          <div className="card-head-row">
            <button className="back-btn" onClick={onBack}><i className="fa-solid fa-arrow-left" /> Back</button>
            <h2 style={{ fontSize: "clamp(18px,4vw,24px)", fontWeight: 900, color: "var(--dark)", margin: 0 }}>My Profile</h2>
          </div>
        </div>

        <div className="screen-body">
          {/* Profile info */}
          <div className="profile-info-box">
            <div className="profile-avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div className="profile-name">{user?.name}</div>
              <div className="profile-email">{user?.email}</div>
            </div>
            <button className="logout-btn" onClick={onLogout}>Logout</button>
          </div>

          {/* Stats */}
          <div className="results-summary">
            <div className="stats-row">
              {[
                { label: "Attempted", value: total,        color: "var(--primary)" },
                { label: "Correct",   value: correct,      color: "#22c55e" },
                { label: "Wrong",     value: wrong,        color: "#ef4444" },
                { label: "Accuracy",  value: `${accuracy}%`, color: "var(--dark)" },
              ].map(s => (
                <div key={s.label} className="stat-box">
                  <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {total > 0 && (
            <div className="acc-bar-wrap">
              <div className="acc-bar"><div className="acc-fill" style={{ width: `${accuracy}%` }} /></div>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs-row">
            {["overview", "history"].map(t => (
              <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                {t === "overview" ? "📊 By Category" : "📋 History"}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div>
              {Object.keys(catStats).length > 0 && <div className="results-section-title">🎧 Word by Listening</div>}
              {Object.entries(catStats).map(([cat, stats]) => {
                const pct = Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={cat} className="cat-stat-row">
                    <div className="cat-stat-letter">{cat}</div>
                    <div className="cat-stat-bar-wrap">
                      <div className="cat-stat-bar"><div className="cat-stat-fill" style={{ width: `${pct}%` }} /></div>
                      <div className="cat-stat-nums">{stats.correct}/{stats.total} correct ({pct}%)</div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(levelStats).length > 0 && <div className="results-section-title" style={{ marginTop: 16 }}>🗣️ Shadowing Practice</div>}
              {Object.entries(levelStats).map(([levelName, stats]) => {
                const pct = Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={levelName} className="cat-stat-row">
                    <div className="cat-stat-letter" style={{ fontSize: 10, background: "#ede9fe", color: "#7c3aed", border: "2px solid #7c3aed" }}>{levelName.slice(0,3)}</div>
                    <div className="cat-stat-bar-wrap">
                      <div className="cat-stat-bar"><div className="cat-stat-fill" style={{ width: `${pct}%`, background: "#7c3aed" }} /></div>
                      <div className="cat-stat-nums">{levelName} — {stats.correct}/{stats.total} correct ({pct}%)</div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(catStats).length === 0 && Object.keys(levelStats).length === 0 && (
                <p className="empty-msg">No quiz attempts yet. Start playing! 🎮</p>
              )}
            </div>
          )}

          {tab === "history" && (
            <div>
              {combinedHistory.length > 0 && (
                <div className="history-controls">
                  {[
                    { key: "all", label: "All" },
                    { key: "word", label: "Words" },
                    { key: "shadowing", label: "Shadowing" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      className={`filter-pill${historyFilter === option.key ? " active" : ""}`}
                      onClick={() => setHistoryFilter(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {filteredHistory.length === 0 && (
                <p className="empty-msg">
                  {combinedHistory.length === 0
                    ? "No attempts yet. Start playing! 🎮"
                    : "No attempts match this filter. Try another view."}
                </p>
              )}

              {filteredHistory.map((a, i) => {
                const isWord = a._type === "word";
                const isCorrect = isWord
                  ? a.is_correct ?? a.user_answer.trim().toLowerCase() === a.word.toLowerCase()
                  : a.user_answer.trim().toLowerCase() === a.sentence.toLowerCase();
                return (
                  <div
                    key={`${a._type}-${a.id ?? a.word}-${a.category ?? a.level_id}-${a.created_at ?? i}`}
                    className="history-row"
                  >
                    <div className="history-dot" style={{ background: isCorrect ? "#22c55e" : "#ef4444" }} />
                    <div style={{ flex: 1 }}>
                      <div className="history-row-top">
                        {isWord ? (
                          <>
                            <span>🎧</span>
                            <span className="history-word">{a.word}</span>
                            <span className="history-cat">[{a.category}]</span>
                          </>
                        ) : (
                          <>
                            <span>🗣️</span>
                            <span className="history-cat" style={{ color: "#7c3aed" }}>{a.level?.name || `Level ${a.level_id}`}</span>
                          </>
                        )}
                      </div>

                      <div className="history-detail">
                        <div className="history-answer" style={{ color: isCorrect ? "#22c55e" : "#ef4444" }}>
                          {isWord ? `Your answer: "${a.user_answer}"` : `You said: "${a.user_answer.length > 50 ? a.user_answer.slice(0, 50) + "…" : a.user_answer}"`}
                        </div>
                        {!isCorrect && (
                          <div className="history-correct">
                            {isWord ? `Correct: "${a.word}"` : `Expected: "${a.sentence}"`}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div className="result-badge" style={{ background: isCorrect ? "#dcfce7" : "#fee2e2", color: isCorrect ? "#16a34a" : "#dc2626" }}>
                        {isCorrect ? "✓" : "✗"}
                      </div>
                      <button className="del-btn" onClick={() => isWord ? handleDeleteWord(a.word, a.category) : handleDeleteShadowing(a.id)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── My Groups Screen ─────────────────────────────────────────────────────────
function MyGroupsScreen({ onOpenGroup, onBack }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await groupsAPI.getGroups();
      setGroups(res.data);
    } catch (err) {
      if (err.response?.data?.blocked) setBlocked(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const res = await groupsAPI.createGroup({ name: formName.trim(), description: formDesc.trim() });
      setGroups((prev) => [res.data, ...prev]);
      setFormName(""); setFormDesc(""); setShowForm(false);
    } catch (err) {
      if (err.response?.data?.blocked) setBlocked(true);
      else alert("Failed to create group.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this group and all its items?")) return;
    try {
      await groupsAPI.deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch {
      alert("Failed to delete group.");
    }
  };

  if (loading) {
    return (
      <div style={styles.screen}>
        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>Loading groups...</div>
      </div>
    );
  }

  return (
    <div className="app-screen">
      <div className="screen-card">
        <div className="card-head">
          <div className="card-head-row">
            <button className="back-btn" onClick={onBack}><i className="fa-solid fa-arrow-left" /> Back</button>
            <h2 style={{ fontSize: "clamp(18px,4vw,22px)", fontWeight: 900, color: "var(--dark)", margin: 0 }}>My Groups</h2>
          </div>
        </div>
        <div className="screen-body">
          {blocked ? (
            <div className="locked-banner">🔒 An admin has restricted your ability to create groups.</div>
          ) : showForm ? (
            <div style={{ marginBottom: 16 }}>
              <div className="results-section-title" style={{ marginBottom: 10 }}>New Group</div>
              <input className="form-input" placeholder="Group name *" value={formName} onChange={e => setFormName(e.target.value)} maxLength={100} autoFocus />
              <textarea className="form-input" style={{ minHeight: 72, resize: "vertical", paddingTop: 14 }} placeholder="Description (optional)" value={formDesc} onChange={e => setFormDesc(e.target.value)} maxLength={500} />
              <div style={{ display: "flex", gap: 0, marginTop: 4 }}>
                <button className="nav-btn primary" onClick={handleCreate} disabled={saving || !formName.trim()}>{saving ? "Creating…" : "Create Group"}</button>
                <button className="nav-btn" onClick={() => { setShowForm(false); setFormName(""); setFormDesc(""); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="inline-btn primary" onClick={() => setShowForm(true)}>
              <i className="fa-solid fa-plus" /> New Group
            </button>
          )}
          {!blocked && groups.length === 0 && !showForm && <p className="empty-msg">📁 No groups yet. Create your first group!</p>}
          {groups.map(g => (
            <div key={g.id} className="group-card" onClick={() => onOpenGroup(g)}>
              <div style={{ flex: 1 }}>
                <div className="group-name">{g.name}</div>
                {g.description && <div className="group-meta">{g.description.length > 70 ? g.description.slice(0,70)+"…" : g.description}</div>}
                <div className="group-meta" style={{ color: "var(--primary)", fontWeight: 700, marginTop: 4 }}>{g.items_count} item{g.items_count !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fa-solid fa-chevron-right" style={{ color: "var(--grey)" }} />
                <button className="del-btn" onClick={e => handleDelete(g.id, e)} title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Group Detail Screen ───────────────────────────────────────────────────────
function GroupDetailScreen({ group, onStartQuiz, onBack, onGroupUpdated }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [itemContent, setItemContent] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await groupsAPI.getGroup(group.id);
      setItems(res.data.items || []);
      onGroupUpdated(res.data);
    } catch (err) {
      if (err.response?.data?.blocked) setBlocked(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [group.id]);

  const handleAddItem = async () => {
    if (!itemContent.trim()) return;
    setSaving(true);
    try {
      const res = await groupsAPI.addItem(group.id, {
        content: itemContent.trim(),
        description: itemDesc.trim() || null,
      });
      setItems((prev) => [res.data, ...prev]);
      setItemContent(""); setItemDesc(""); setShowForm(false);
    } catch (err) {
      if (err.response?.data?.blocked) setBlocked(true);
      else alert("Failed to add item.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await groupsAPI.deleteItem(group.id, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      alert("Failed to delete item.");
    }
  };


  if (loading) return (
    <div className="app-screen" style={{ alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#fff", fontSize: 20, fontFamily: "var(--font)" }}>Loading…</p>
    </div>
  );

  return (
    <div className="app-screen">
      <div className="screen-card">
        <div className="card-head">
          <div className="card-head-row">
            <button className="back-btn" onClick={onBack}><i className="fa-solid fa-arrow-left" /> Back</button>
            <span className="card-badge">{items.length} items</span>
          </div>
          <h1 className="card-head-title">{group.name}</h1>
          {group.description && <p className="card-head-sub">{group.description}</p>}
        </div>
        <div className="screen-body">
          {blocked && <div className="locked-banner">🔒 Adding items is locked by admin.</div>}
          {!blocked && (showForm ? (
            <div style={{ marginBottom: 16 }}>
              <div className="results-section-title" style={{ marginBottom: 10 }}>Add Item</div>
              <input className="form-input" placeholder="Word or sentence *" value={itemContent} onChange={e => setItemContent(e.target.value)} autoFocus />
              <input className="form-input" placeholder="Description / hint (optional)" value={itemDesc} onChange={e => setItemDesc(e.target.value)} />
              <div style={{ display: "flex" }}>
                <button className="nav-btn primary" onClick={handleAddItem} disabled={saving || !itemContent.trim()}>{saving ? "Adding…" : "Add Item"}</button>
                <button className="nav-btn" onClick={() => { setShowForm(false); setItemContent(""); setItemDesc(""); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="inline-btn primary" onClick={() => setShowForm(true)}>
              <i className="fa-solid fa-plus" /> Add Word or Sentence
            </button>
          ))}
          {items.length === 0 ? (
            <p className="empty-msg">📝 No items yet. Add your first word or sentence.</p>
          ) : (
            items.map(item => (
              <div key={item.id} className="word-item">
                <div style={{ flex: 1 }}>
                  <div className="word-content">{item.content}</div>
                  {item.description && <div className="word-desc">{item.description}</div>}
                </div>
                <button className="del-btn" onClick={() => handleDeleteItem(item.id)} title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
        {items.length > 0 && (
          <div className="screen-nav">
            <button className="primary" onClick={() => onStartQuiz(items)}>
              <i className="fa-solid fa-play" /> START QUIZ ({items.length} items)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Group Quiz Screen ─────────────────────────────────────────────────────────
function GroupQuizScreen({ group, onComplete, onBack }) {
  const [words] = useState(() => shuffleArray(group.items || []));
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const inputRef = useRef(null);

  const current = words[index];

  const playAudio = useCallback(() => {
    if (!current) return;
    setIsPlaying(true);
    speakText(current.content);
    setTimeout(() => setIsPlaying(false), 1800);
  }, [current]);

  useEffect(() => {
    if (words.length > 0) {
      setTimeout(() => playAudio(), 400);
      inputRef.current?.focus();
    }
  }, [index]);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  if (words.length === 0) {
    return (
      <div style={styles.screen}>
        <div style={styles.navRow}>
          <button style={styles.backBtn} onClick={onBack}>← Back</button>
        </div>
        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
          No words in this group to quiz on.
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!input.trim()) return;
    const isCorrect = input.trim().toLowerCase() === current.content.toLowerCase();
    const attempt = {
      word: current.content,
      user_answer: input.trim(),
      is_correct: isCorrect,
      description: current.description,
    };
    const updated = [...results, attempt];
    setResults(updated);
    if (isCorrect) { setScore((s) => s + 1); setFeedback("correct"); }
    else setFeedback("wrong");
  };

  const handleNext = () => {
    if (index + 1 >= words.length) {
      onComplete(results.concat());
    } else {
      setIndex((i) => i + 1);
      setInput("");
      setFeedback(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { if (feedback) handleNext(); else handleSubmit(); }
  };

  return (
    <div className="quiz-root">
      <div className="quiz-card">
        <div className="quiz-meta-row">
          <button className="quiz-back-btn" onClick={onBack}><i className="fa-solid fa-arrow-left" /> Back</button>
          <span className="quiz-score">📁 {group.name} &nbsp;|&nbsp; ⭐ {score} pts</span>
        </div>
        <h1 className="quiz-question">Listen and type the word</h1>
        <div className="quiz-fieldset">
          <button className={`round-play-btn${isPlaying ? " playing" : ""}`} onClick={playAudio} aria-label="Play word">
            <i className={`fa-solid ${isPlaying ? "fa-volume-high" : "fa-play"}`} />
          </button>
          <div className="quiz-input-row">
            <div className={`quiz-option${feedback === "correct" ? " correct" : feedback === "wrong" ? " wrong" : ""}`}>
              <input ref={inputRef} className={`quiz-input${feedback === "correct" ? " correct" : feedback === "wrong" ? " wrong" : ""}`}
                value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Type what you heard…" readOnly={!!feedback} autoComplete="off" spellCheck={false} />
            </div>
            {!feedback && (
              <button className="quiz-input-arrow" onClick={handleSubmit} aria-label="Check answer">
                <i className="fa-solid fa-arrow-right" />
              </button>
            )}
          </div>
          {feedback === "correct" && (
            <div className="quiz-feedback ok">
              ✅ &nbsp;<strong>Correct! +1 pt</strong>&nbsp;
              <span style={{ color: "var(--primary)", fontWeight: 900 }}>"{current.content}"</span>
              {current.description && <span style={{ width: "100%", marginTop: 4, fontSize: "0.88em", color: "#166534" }}>📖 {current.description}</span>}
            </div>
          )}
          {feedback === "wrong" && (
            <div className="quiz-feedback bad">
              ❌ &nbsp;<strong>Not quite!</strong>&nbsp; Correct: <strong style={{ color: "var(--primary)" }}>{current.content}</strong>&nbsp;— You wrote: <em>{input}</em>
              {current.description && <span style={{ width: "100%", marginTop: 4, fontSize: "0.88em", color: "#991b1b" }}>📖 {current.description}</span>}
            </div>
          )}
        </div>
        <div className="quiz-nav">
          {results.length > 0 && <button onClick={() => onComplete([...results])}>← FINISH EARLY</button>}
          {!feedback
            ? <button className="next-btn quiz-nav-check" onClick={handleSubmit}>CHECK ANSWER <i className="fa-solid fa-arrow-right" /></button>
            : <button className="next-btn" onClick={handleNext}>{index+1 >= words.length ? "SEE RESULTS 🏆" : <>NEXT WORD <i className="fa-solid fa-arrow-right" /></>}</button>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Group Results Screen ──────────────────────────────────────────────────────
function GroupResultsScreen({ results, group, onHome, onRetry, onBack }) {
  if (!results || results.length === 0) return (
    <div className="app-screen" style={{ alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#fff", fontFamily: "var(--font)" }}>No results to display.</p>
    </div>
  );

  const total = results.length;
  const correct = results.filter(r => r.is_correct).length;
  const wrong = total - correct;
  const accuracy = Math.round((correct / total) * 100);

  return (
    <div className="app-screen">
      <div className="screen-card">
        <div className="card-head">
          <h1 className="card-head-title">Quiz Results 🎉</h1>
          <p className="card-head-sub">Group: <strong style={{ color: "var(--primary)" }}>{group?.name}</strong></p>
        </div>
        <div className="screen-body">
          <div className="results-summary">
            <div className="stats-row">
              {[{ label:"Total",value:total,color:"var(--primary)" },{ label:"Correct",value:correct,color:"#22c55e" },{ label:"Wrong",value:wrong,color:"#ef4444" },{ label:"Accuracy",value:`${accuracy}%`,color:"var(--dark)" }].map(s => (
                <div key={s.label} className="stat-box"><span className="stat-value" style={{ color: s.color }}>{s.value}</span><span className="stat-label">{s.label}</span></div>
              ))}
            </div>
          </div>
          <div className="acc-bar-wrap"><div className="acc-bar"><div className="acc-fill" style={{ width: `${accuracy}%` }} /></div></div>
          <div className="results-section-title">Attempted Words</div>
          <div className="result-list">
            {results.map((r, i) => (
              <div key={i} className="result-row">
                <div className="result-dot" style={{ background: r.is_correct ? "#22c55e" : "#ef4444" }} />
                <div style={{ flex: 1 }}>
                  <div className="result-word">{i+1}. {r.word}</div>
                  <div className="result-your">You wrote: <strong>"{r.user_answer || ""}"</strong></div>
                  {!r.is_correct && <div className="result-correct">Correct: <strong>"{r.word}"</strong></div>}
                </div>
                <div className="result-badge" style={{ background: r.is_correct ? "#dcfce7" : "#fee2e2", color: r.is_correct ? "#16a34a" : "#dc2626" }}>{r.is_correct ? "✓" : "✗"}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="screen-nav">
          <button onClick={onBack}><i className="fa-solid fa-arrow-left" /> GROUP</button>
          <button onClick={onRetry}><i className="fa-solid fa-rotate-right" /> RETRY</button>
          <button className="primary" onClick={onHome}><i className="fa-solid fa-house" /> HOME</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shadowing Level Screen ───────────────────────────────────────────────────
function ShadowingLevelScreen({ onSelect, onBack }) {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const response = await shadowingAPI.getLevels();
        setLevels(response.data);
      } catch (error) {
        console.error("Failed to fetch levels:", error);
        alert("Failed to load levels");
        onBack();
      } finally {
        setLoading(false);
      }
    };
    fetchLevels();
  }, [onBack]);

  return (
    <div className="app-screen">
      <div className="screen-card">
        <div className="card-head">
          <div className="card-head-row">
            <button className="back-btn" onClick={onBack}><i className="fa-solid fa-arrow-left" /> Back</button>
          </div>
          <h1 className="card-head-title">Shadowing Practice</h1>
          <p className="card-head-sub">🗣️ Listen to sentences and repeat them aloud</p>
        </div>
        <div className="screen-body">
          <h3 className="section-title">Select a Level</h3>
          {loading ? <p className="empty-msg">Loading levels…</p>
          : levels.length === 0 ? <p className="empty-msg">No levels available yet.</p>
          : levels.map((level, i) => {
            const dots = ["#22c55e","#3b82f6","var(--primary)","#8b5cf6","#ec4899","#f97316"];
            return (
              <button key={level.id} className="level-btn" onClick={() => onSelect(level)}>
                <div className="level-btn-dot" style={{ background: dots[i % dots.length] }} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div className="level-btn-name">{level.name}</div>
                  <div className="level-btn-sub">Tap to start practice</div>
                </div>
                <i className="fa-solid fa-play" style={{ color: "var(--grey)", fontSize: 18 }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Shadowing Quiz Screen ─────────────────────────────────────────────────────
function ShadowingQuizScreen({ level, onComplete, onBack }) {
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const fetchSentences = async () => {
      try {
        const response = await shadowingAPI.getSentences(level.id);
        setSentences(response.data.sentences);
      } catch (error) {
        console.error("Failed to fetch sentences:", error);
        alert("Failed to load sentences");
        onBack();
      } finally {
        setLoading(false);
      }
    };
    fetchSentences();
  }, [level.id, onBack]);

  const current = sentences[index];

  const playSentence = useCallback(() => {
    if (!current) return;
    setIsPlaying(true);
    speakText(current.sentence, { onEnd: () => setIsPlaying(false) });
    // Fallback timeout in case onend doesn't fire
    setTimeout(() => setIsPlaying(false), current.sentence.length * 75 + 1500);
  }, [current]);

  useEffect(() => {
    if (sentences.length > 0 && index < sentences.length) {
      setTimeout(() => playSentence(), 500);
    }
  }, [index, sentences]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicError("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    setMicError(null);
    setTranscript("");

    const recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }
      if (finalTranscript) {
        setTranscript(finalTranscript);
        submitAnswer(finalTranscript);
      } else {
        setTranscript(interimTranscript);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "no-speech") {
        setMicError("No speech detected. Please try again.");
      } else if (event.error === "not-allowed") {
        setMicError("Microphone access denied. Please allow microphone in your browser settings.");
      } else {
        setMicError(`Error: ${event.error}. Please try again.`);
      }
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleTryAgain = () => {
    setTranscript("");
    setFeedback(null);
    setMicError(null);
  };

  const submitAnswer = (spokenText) => {
    const normalize = (str) =>
      str.trim().toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");

    const isCorrect = normalize(spokenText) === normalize(current.sentence);
    const attempt = {
      level_id: level.id,
      sentence: current.sentence,
      user_answer: spokenText,
      is_correct: isCorrect,
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
    if (index + 1 >= sentences.length) {
      onComplete(attempts.concat());
    } else {
      setIndex((i) => i + 1);
      setTranscript("");
      setFeedback(null);
      setMicError(null);
    }
  };

  if (loading) return (
    <div className="quiz-root" style={{ alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#fff", fontSize: 20, fontFamily: "var(--font)" }}>Loading sentences…</p>
    </div>
  );
  if (sentences.length === 0) return (
    <div className="quiz-root" style={{ alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#fff", fontSize: 20, fontFamily: "var(--font)" }}>No sentences for this level.</p>
      <button onClick={onBack} style={{ marginTop: 16, padding: "10px 24px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Go Back</button>
    </div>
  );

  return (
    <div className="quiz-root">
      <div className="quiz-card">
        <div className="quiz-meta-row">
          <button className="quiz-back-btn" onClick={onBack}><i className="fa-solid fa-arrow-left" /> Back</button>
          <span className="quiz-score">🗣️ {level.name} &nbsp;|&nbsp; ⭐ {score} pts &nbsp;|&nbsp; {index+1}/{sentences.length}</span>
        </div>
        <h1 className="quiz-question">Listen and repeat the sentence aloud</h1>
        <div className="quiz-fieldset">
          {/* Play button */}
          <button className={`round-play-btn${isPlaying ? " playing" : ""}`} onClick={playSentence} aria-label="Play sentence">
            <i className={`fa-solid ${isPlaying ? "fa-volume-high" : "fa-play"}`} />
          </button>
          {/* Transcript / mic area */}
          {!feedback && (
            <div className="quiz-option" style={{ flexDirection: "column", alignItems: "flex-start", height: "auto", minHeight: 70, padding: "14px 20px", gap: 0 }}>
              <span className="quiz-option-label" style={{ fontSize: "clamp(13px,3vw,18px)", fontStyle: transcript ? "normal" : "italic" }}>
                {transcript ? `"${transcript}"` : isListening ? "Listening… speak now" : "Your spoken answer will appear here"}
              </span>
              {micError && <span style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>{micError}</span>}
            </div>
          )}
          {/* Mic button */}
          {!feedback && (
            <button
              className={`quiz-option audio-btn${isListening ? " playing" : ""}`}
              onClick={startListening}
              disabled={isListening || isPlaying}
              style={{ borderColor: isListening ? "var(--primary)" : undefined }}
            >
              <i className={`fa-solid ${isListening ? "fa-microphone-lines" : "fa-microphone"} quiz-option-icon`} style={{ color: isListening ? "var(--primary)" : undefined }} />
              <span className="quiz-option-label">{isListening ? "Listening…" : "Tap to Speak"}</span>
            </button>
          )}
        </div>
        {feedback === "correct" && (
          <div className="quiz-feedback ok">
            ✅ &nbsp;<strong>Perfect! +1 pt</strong>&nbsp;
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>"{current.sentence}"</span>
          </div>
        )}
        {feedback === "wrong" && (
          <div className="quiz-feedback bad">
            ❌ &nbsp;<strong>Not quite!</strong>&nbsp; Correct: <strong style={{ color: "var(--primary)" }}>"{current.sentence}"</strong>&nbsp;— You said: <em>"{transcript}"</em>
          </div>
        )}
        <div className="quiz-nav">
          {attempts.length > 0 && !feedback && <button onClick={() => onComplete([...attempts])}>← FINISH EARLY</button>}
          {feedback && <button onClick={handleTryAgain}>TRY AGAIN</button>}
          {!feedback
            ? null
            : <button className="next-btn" onClick={handleNext}>{index+1 >= sentences.length ? "SEE RESULTS 🏆" : <>NEXT <i className="fa-solid fa-arrow-right" /></>}</button>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Shadowing Results Screen ──────────────────────────────────────────────────
function ShadowingResultsScreen({ results, level, onHome, onRetry }) {
  if (!results || results.length === 0) return (
    <div className="app-screen" style={{ alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#fff", fontFamily: "var(--font)" }}>No results to display.</p>
    </div>
  );

  const total = results.length;
  const correct = results.filter(r => r.is_correct).length;
  const wrong = total - correct;
  const accuracy = Math.round((correct / total) * 100);

  return (
    <div className="app-screen">
      <div className="screen-card">
        <div className="card-head">
          <h1 className="card-head-title">Shadowing Results 🎉</h1>
          <p className="card-head-sub">Level: <strong style={{ color: "var(--primary)" }}>{level?.name}</strong></p>
        </div>
        <div className="screen-body">
          <div className="results-summary">
            <div className="stats-row">
              {[{ label:"Total",value:total,color:"var(--primary)" },{ label:"Correct",value:correct,color:"#22c55e" },{ label:"Wrong",value:wrong,color:"#ef4444" },{ label:"Accuracy",value:`${accuracy}%`,color:"var(--dark)" }].map(s => (
                <div key={s.label} className="stat-box"><span className="stat-value" style={{ color: s.color }}>{s.value}</span><span className="stat-label">{s.label}</span></div>
              ))}
            </div>
          </div>
          <div className="acc-bar-wrap"><div className="acc-bar"><div className="acc-fill" style={{ width: `${accuracy}%` }} /></div></div>
          <div className="results-section-title">Attempted Sentences</div>
          <div className="result-list">
            {results.map((r, i) => (
              <div key={i} className="result-row">
                <div className="result-dot" style={{ background: r.is_correct ? "#22c55e" : "#ef4444", alignSelf: "flex-start", marginTop: 4 }} />
                <div style={{ flex: 1 }}>
                  <div className="result-word" style={{ fontSize: "clamp(13px,2.5vw,15px)" }}>{i+1}. {r.sentence}</div>
                  <div className="result-your">You said: <strong>"{r.user_answer || ""}"</strong></div>
                  {!r.is_correct && <div className="result-correct">Expected: <strong>"{r.sentence}"</strong></div>}
                </div>
                <div className="result-badge" style={{ background: r.is_correct ? "#dcfce7" : "#fee2e2", color: r.is_correct ? "#16a34a" : "#dc2626" }}>{r.is_correct ? "✓" : "✗"}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="screen-nav">
          <button onClick={onRetry}><i className="fa-solid fa-rotate-right" /> RETRY</button>
          <button className="primary" onClick={onHome}><i className="fa-solid fa-house" /> HOME</button>
        </div>
      </div>
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
  featureCardLocked: { border: "2px solid #fca5a5", opacity: 0.85, cursor: "not-allowed" },
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
  tryAgainBtn: {
    marginTop: 10,
    background: "transparent",
    color: "#7c3aed",
    border: "2px solid #7c3aed",
    borderRadius: 12,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
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
  overviewSectionLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#64748b",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: "1px solid #e2e8f0",
  },
  historyTypeBadgeWord: { fontSize: 13, flexShrink: 0 },
  historyTypeBadgeShadow: { fontSize: 13, flexShrink: 0 },
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
  // Groups Styles
  lockedBanner: {
    background: "#fff5f5",
    border: "2px solid #fecaca",
    borderRadius: 20,
    padding: "32px 24px",
    textAlign: "center",
    marginBottom: 16,
  },
  groupForm: {
    background: "#fff",
    border: "2px solid #e2e8f0",
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  groupInput: {
    width: "100%",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    color: "#1a1a2e",
    outline: "none",
    background: "#f8fafc",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  groupCard: {
    background: "#fff",
    borderRadius: 14,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    cursor: "pointer",
    border: "1.5px solid #e2e8f0",
  },
  groupDeleteBtn: {
    background: "#fee2e2",
    border: "1.5px solid #fca5a5",
    borderRadius: 8,
    color: "#dc2626",
    cursor: "pointer",
    padding: "5px 7px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  groupItemRow: {
    background: "#fff",
    borderRadius: 12,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    border: "1px solid #f1f5f9",
  },
  // Shadowing Styles
  shadowingHeroBanner: {
    background: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
    borderRadius: 20,
    padding: "20px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  voiceInputArea: {
    background: "#f8fafc",
    border: "2px solid #e2e8f0",
    borderRadius: 14,
    padding: "18px 20px",
    minHeight: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    textAlign: "center",
  },
  transcriptText: {
    fontSize: 16,
    fontWeight: 600,
    color: "#1a1a2e",
    fontStyle: "italic",
  },
  transcriptPlaceholder: {
    fontSize: 14,
    color: "#94a3b8",
  },
  micBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #7c3aed, #8b5cf6)",
    border: "none",
    borderRadius: 16,
    padding: "20px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    boxShadow: "0 8px 24px rgba(124,58,237,0.35)",
    transition: "transform 0.15s",
    gap: 4,
  },
  micBtnListening: {
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    boxShadow: "0 8px 24px rgba(220,38,38,0.35)",
    transform: "scale(1.02)",
  },
  micError: {
    background: "#fee2e2",
    color: "#dc2626",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
};
