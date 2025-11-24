import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion,
} from 'firebase/firestore';
import { 
  Users, 
  Play, 
  CheckCircle, 
  Trophy, 
  Send, 
  Copy,
  Monitor,
  MessageSquare,
  SkipForward,
  Crown,
  Palette,
  ChevronDown,
  Plus,
  Settings,
  X,
  Pause,
  Check,
  Link as LinkIcon,
  Share2,
  ArrowLeft,
  Volume2,
  VolumeX,
  Clock,
  AlertTriangle
} from 'lucide-react';

// --- Firebase Setup ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const playSound = (type) => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === 'success') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); 
    osc.frequency.setValueAtTime(659.25, now + 0.1); 
    osc.frequency.setValueAtTime(783.99, now + 0.2); 
    osc.frequency.setValueAtTime(1046.50, now + 0.3); 
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.6);
  } else if (type === 'tick') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'timeup') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.5);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.linearRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'ready') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(400, now + 0.3);
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }
};

// --- CONFETTI ---
const Confetti = () => {
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 rounded-sm animate-confetti"
          style={{
            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            left: `${Math.random() * 100}%`,
            top: '-20px',
            animationDuration: `${Math.random() * 2 + 2}s`,
            animationDelay: `${Math.random() * 0.5}s`
          }}
        />
      ))}
    </div>
  );
};

// --- THEMES ---
const DEFAULT_THEMES = {
  classic: {
    label: "Classic Mix",
    color: "from-indigo-500 to-purple-600",
    words: ["Spiderman", "Pizza", "Moonwalk", "Statue of Liberty", "Zombie", "Harry Potter", "Ballet", "Traffic Cop", "Selfie", "Toothbrush", "Elvis Presley", "Sumo Wrestler", "Titanic", "Ninja", "Ice Cream", "Vampire", "Astronaut", "Surfing", "Mummy", "Cowboy", "Yoga", "Karaoke", "DJ", "Bartender"]
  },
  thanksgiving: {
    label: "Thanksgiving Feast",
    color: "from-orange-500 to-red-600",
    words: ["Turkey", "Stuffing", "Gravy", "Mashed Potatoes", "Pumpkin Pie", "Pilgrim", "Football", "Black Friday", "Nap", "Wishbone", "Family Photo", "Leaf Pile", "Scarecrow", "Corn Maze", "Food Coma", "Carving Turkey", "Leftovers"]
  },
  christmas: {
    label: "Christmas & Holidays",
    color: "from-red-600 to-green-600",
    words: ["Santa Claus", "Rudolph", "Elf", "Snowball Fight", "Christmas Tree", "Stocking", "Chimney", "Cookies", "Sleigh", "Grinch", "Snowman", "Nutcracker", "Gingerbread Man", "Decorating", "Reindeer", "Hot Cocoa", "Home Alone", "Ugly Sweater"]
  },
  movies: {
    label: "Blockbuster Movies",
    color: "from-blue-600 to-cyan-500",
    words: ["Star Wars", "Avengers", "Frozen", "The Lion King", "Jurassic Park", "Shrek", "Toy Story", "The Matrix", "Forrest Gump", "E.T.", "Indiana Jones", "Wonder Woman", "Batman", "Joker", "Minions", "Ghostbusters", "Titanic", "Harry Potter"]
  }
};

const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [guessInput, setGuessInput] = useState('');
  const messagesEndRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Theme Builder
  const [showThemeBuilder, setShowThemeBuilder] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeWords, setNewThemeWords] = useState('');

  // Detect Blob/Preview Mode
  const isPreview = typeof window !== 'undefined' && window.location.protocol === 'blob:';

  // --- Auto-Fill URL ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('room');
    if (codeFromUrl) setRoomCode(codeFromUrl);
  }, []);

  // --- Auth ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error(err);
      }
    };
    initAuth();
    onAuthStateChanged(auth, setUser);
  }, []);

  // --- Sync ---
  useEffect(() => {
    if (!user || !joinedRoom || !roomCode) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', roomCode);
    const unsubscribe = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (gameState && data.lastEventId !== gameState.lastEventId) {
          if (data.lastEventType === 'success') {
             if (soundEnabled) playSound('success');
             setShowConfetti(true);
             setTimeout(() => setShowConfetti(false), 3000);
          }
          if (data.lastEventType === 'timeup' && soundEnabled) playSound('timeup');
        }
        setGameState(data);
      } else {
        setError("Room not found.");
        setJoinedRoom(false);
      }
    });
    return () => unsubscribe();
  }, [user, joinedRoom, roomCode, gameState, soundEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState?.messages]);

  // --- Logic ---
  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    setLoading(true);
    setError('');
    const code = roomCode.toUpperCase().trim();
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', code);

    try {
      const docSnap = await getDoc(gameRef);
      const newPlayer = { uid: user.uid, name: playerName, score: 0, isReady: false };

      if (!docSnap.exists()) {
        await setDoc(gameRef, {
          players: [newPlayer],
          messages: [],
          status: 'LOBBY', 
          theme: 'classic', 
          customThemes: {},
          currentTurnIndex: 0,
          currentWord: '',
          roundEndTime: null,
          hostId: user.uid,
          isPaused: false,
          timerRemaining: 0,
          turnsPlayed: 0,
          maxTurnsPerPlayer: 2, 
          lastEventId: 0,
          lastEventType: ''
        });
      } else {
        const data = docSnap.data();
        if (!data.players.some(p => p.uid === user.uid)) {
           await updateDoc(gameRef, { players: arrayUnion(newPlayer) });
        }
      }
      setRoomCode(code);
      setJoinedRoom(true);
      
      // Try to update URL history if not blob
      try {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('room', code);
        window.history.replaceState({}, '', newUrl);
      } catch (e) {
        // Blob url updates often fail, ignore
      }

    } catch (err) {
      console.error(err);
      setError("Failed to join.");
    } finally {
      setLoading(false);
    }
  };

  // --- SIMPLIFIED COPY ---
  const copyInvite = () => {
    // If preview/blob, we can't share URL. Just copy code.
    if (isPreview) {
      copyToClipboard(roomCode);
      return;
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomCode);
      // ONLY copy the URL string, nothing else
      copyToClipboard(url.toString());
    } catch (e) {
      copyToClipboard(roomCode);
    }
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => legacyCopy(text));
    } else {
        legacyCopy(text);
    }
  };

  const legacyCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    textArea.style.left = "0";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    } catch (err) {
        console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  // --- Game Flow ---
  const startGame = async () => {
    if (!gameState) return;
    triggerPreTurn();
  };

  const triggerPreTurn = async () => {
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', roomCode);
    await updateDoc(gameRef, {
      status: 'PRE_TURN',
      roundEndTime: Date.now() + 4000, 
    });
    if (gameState.hostId === user.uid) {
      setTimeout(() => startActualRound(), 4000);
    }
  };

  const startActualRound = async () => {
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', roomCode);
    const firstWord = getWordForTheme(gameState.theme);
    await updateDoc(gameRef, {
      status: 'PLAYING',
      currentWord: firstWord,
      roundEndTime: Date.now() + 90000,
      isPaused: false
    });
  };

  const nextTurn = async (wasCorrect) => {
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', roomCode);
    const updatedPlayers = [...gameState.players];
    
    if (wasCorrect) {
        const actorIndex = gameState.currentTurnIndex;
        if (actorIndex !== -1) updatedPlayers[actorIndex].score += 500;
    }

    const newTurnsPlayed = gameState.turnsPlayed + 1;
    const isGameOver = newTurnsPlayed >= (updatedPlayers.length * gameState.maxTurnsPerPlayer);

    if (isGameOver) {
      await updateDoc(gameRef, {
        status: 'GAME_OVER',
        players: updatedPlayers,
        lastEventId: Date.now(),
        lastEventType: wasCorrect ? 'success' : 'skip'
      });
    } else {
      const nextIndex = (gameState.currentTurnIndex + 1) % updatedPlayers.length;
      const nextWord = getWordForTheme(gameState.theme);
      
      await updateDoc(gameRef, {
        players: updatedPlayers,
        currentTurnIndex: nextIndex,
        currentWord: nextWord,
        status: 'PRE_TURN',
        roundEndTime: Date.now() + 4000,
        lastEventId: Date.now(),
        lastEventType: wasCorrect ? 'success' : 'skip',
        turnsPlayed: newTurnsPlayed
      });

      if (gameState.hostId === user.uid) {
        setTimeout(() => startActualRound(), 4000);
      }
    }
  };

  const handleCorrect = async (guesserUid) => {
    if (!gameState || gameState.status !== 'PLAYING' || gameState.isPaused) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', roomCode);
    
    const updatedPlayers = [...gameState.players];
    if (guesserUid) {
        const gIndex = updatedPlayers.findIndex(p => p.uid === guesserUid);
        if (gIndex !== -1) updatedPlayers[gIndex].score += 1000;
    }
    
    await updateDoc(gameRef, {
        players: updatedPlayers,
        messages: arrayUnion({
            id: Date.now(),
            sender: guesserUid ? updatedPlayers.find(p => p.uid === guesserUid)?.name : "System",
            text: `Correct! The word was ${gameState.currentWord}`,
            type: 'correct',
            uid: guesserUid || 'system'
        })
    });
    
    nextTurn(true);
  };

  const cancelRound = async () => {
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', roomCode);
    await updateDoc(gameRef, { status: 'LOBBY' });
  };

  const resetGame = async () => {
      const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', roomCode);
      const resetPlayers = gameState.players.map(p => ({...p, score: 0, isReady: false}));
      await updateDoc(gameRef, {
          status: 'LOBBY',
          players: resetPlayers,
          turnsPlayed: 0,
          messages: []
      });
  };

  // --- Helpers ---
  const getCombinedThemes = () => ({ ...DEFAULT_THEMES, ...(gameState?.customThemes || {}) });
  const getCurrentTheme = () => getCombinedThemes()[gameState?.theme] || DEFAULT_THEMES.classic;
  const getWordForTheme = (themeKey) => {
    const t = getCombinedThemes()[themeKey] || DEFAULT_THEMES.classic;
    return t.words[Math.floor(Math.random() * t.words.length)];
  };
  const saveCustomTheme = async () => {
    if (newThemeWords.split(',').length < 5) return alert("Need 5+ words!");
    const themeId = normalize(newThemeName);
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', roomCode);
    await updateDoc(gameRef, {
      [`customThemes.${themeId}`]: {
        label: newThemeName,
        color: "from-pink-500 to-rose-500",
        words: newThemeWords.split(',').map(w => w.trim()).filter(w => w.length > 0)
      },
      theme: themeId 
    });
    setShowThemeBuilder(false);
  };

  const toggleReady = async () => {
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', roomCode);
    const updated = gameState.players.map(p => p.uid === user.uid ? { ...p, isReady: !p.isReady } : p);
    await updateDoc(gameRef, { players: updated });
  };
  
  // --- Render ---

  if (!user) return <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white">Loading...</div>;
  if (!joinedRoom) return <JoinScreen {...{ playerName, setPlayerName, roomCode, setRoomCode, joinRoom, loading, error }} />;
  if (!gameState) return <div className="min-h-screen bg-indigo-950 text-white flex items-center justify-center">Syncing...</div>;

  const currentPlayer = gameState.players[gameState.currentTurnIndex] || {};
  const isMyTurn = currentPlayer.uid === user.uid;
  const isHost = gameState.hostId === user.uid;
  const currentTheme = getCurrentTheme();

  // GLOBAL OVERLAYS
  if (showConfetti) return <><Confetti /><GameScreen {...{user, gameState, currentPlayer, isMyTurn, isHost, currentTheme, handleCorrect, nextTurn, cancelRound, soundEnabled, setSoundEnabled, isPreview, copyInvite}} /></>;
  if (gameState.status === 'GAME_OVER') return <GameOverScreen {...{gameState, isHost, resetGame}} />;
  if (gameState.status === 'PRE_TURN') return <PreTurnScreen {...{currentPlayer, roundEndTime: gameState.roundEndTime}} />;
  if (showThemeBuilder) return <ThemeBuilder {...{newThemeName, setNewThemeName, newThemeWords, setNewThemeWords, saveCustomTheme, setShowThemeBuilder}} />;
  
  if (gameState.status === 'LOBBY') return (
    <LobbyScreen 
      {...{
        gameState, user, isHost, roomCode, copyInvite, copied, 
        toggleReady, startGame, setShowThemeBuilder, 
        currentTheme, setRoomCode: (v) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'charades_ultimate_v11', roomCode), { theme: v }),
        themes: getCombinedThemes(),
        isPreview // Pass down blob detection
      }} 
    />
  );

  return (
    <GameScreen 
       {...{
         user, gameState, currentPlayer, isMyTurn, isHost, currentTheme, 
         handleCorrect, nextTurn, cancelRound, soundEnabled, setSoundEnabled,
         copyInvite
       }} 
    />
  );
}

// --- SUB COMPONENTS ---

const JoinScreen = ({ playerName, setPlayerName, roomCode, setRoomCode, joinRoom, loading, error }) => (
  <div className="min-h-screen bg-indigo-950 text-white p-6 flex flex-col items-center justify-center font-sans">
    <div className="max-w-md w-full space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4 shadow-2xl shadow-purple-500/20 transform rotate-3">
            <Trophy size={40} />
        </div>
        <h1 className="text-5xl font-black text-white tracking-tight">Charades!</h1>
        <p className="text-indigo-300 text-lg">The Ultimate Party Game</p>
      </div>
      <div className="bg-indigo-900/50 backdrop-blur-xl p-8 rounded-3xl border border-indigo-800 shadow-2xl">
        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Your Name</label>
            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full bg-indigo-950/50 border border-indigo-700 rounded-xl px-4 py-4 text-white text-lg focus:border-purple-500 outline-none mt-2 transition-colors" placeholder="e.g. Aunt Jemima" />
          </div>
          <div>
            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Room Code</label>
            <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} className="w-full bg-indigo-950/50 border border-indigo-700 rounded-xl px-4 py-4 text-white text-lg focus:border-purple-500 outline-none mt-2 uppercase font-mono tracking-widest" placeholder="CODE" />
          </div>
          {error && <div className="text-red-400 text-sm text-center font-medium">{error}</div>}
          <button onClick={joinRoom} disabled={loading} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 rounded-xl shadow-lg transition active:scale-95 text-lg">
            {loading ? 'Connecting...' : 'Join Party'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

const PreTurnScreen = ({ currentPlayer, roundEndTime }) => (
  <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-300">
    <h2 className="text-indigo-300 text-xl font-bold uppercase tracking-widest mb-6">Up Next</h2>
    <div className="w-32 h-32 rounded-full bg-white text-indigo-900 flex items-center justify-center text-6xl font-black mb-8 shadow-2xl border-8 border-purple-500">
      {currentPlayer.name[0]}
    </div>
    <h1 className="text-5xl font-black text-white mb-4">{currentPlayer.name}</h1>
    <p className="text-white/60 text-lg">Get ready to act!</p>
    <div className="mt-12 scale-150">
      <GameTimer endTime={roundEndTime} simple={true} />
    </div>
  </div>
);

const GameOverScreen = ({ gameState, isHost, resetGame }) => {
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  return (
    <div className="min-h-screen bg-indigo-950 text-white p-6 flex flex-col items-center justify-center animate-in fade-in">
       <Confetti />
       <div className="text-center mb-10 z-10">
         <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 mb-2 drop-shadow-sm">GAME OVER</h1>
         <p className="text-indigo-300 text-xl">And the Oscar goes to...</p>
       </div>

       {/* Podium */}
       <div className="flex items-end justify-center gap-4 mb-12 w-full max-w-lg z-10">
          {/* 2nd Place */}
          {sortedPlayers[1] && (
            <div className="flex flex-col items-center w-1/3">
              <div className="w-16 h-16 rounded-full bg-slate-400 text-indigo-900 font-bold flex items-center justify-center text-2xl mb-2 border-4 border-indigo-800">2</div>
              <div className="bg-indigo-800/50 w-full h-32 rounded-t-2xl flex flex-col justify-end p-2 text-center border-t border-x border-indigo-700">
                 <span className="font-bold truncate w-full">{sortedPlayers[1].name}</span>
                 <span className="text-sm opacity-70">{sortedPlayers[1].score}</span>
              </div>
            </div>
          )}
          
          {/* 1st Place */}
          <div className="flex flex-col items-center w-1/3">
             <Crown size={48} className="text-yellow-400 mb-2 animate-bounce" />
             <div className="w-20 h-20 rounded-full bg-yellow-400 text-indigo-900 font-black flex items-center justify-center text-3xl mb-2 border-4 border-yellow-200 shadow-[0_0_30px_rgba(250,204,21,0.4)]">1</div>
             <div className="bg-indigo-800 w-full h-48 rounded-t-2xl flex flex-col justify-end p-2 text-center border-t border-x border-indigo-600 shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/20 to-transparent"></div>
                <span className="font-black text-xl truncate w-full relative z-10">{winner.name}</span>
                <span className="text-yellow-400 font-mono font-bold relative z-10">{winner.score}</span>
             </div>
          </div>

          {/* 3rd Place */}
          {sortedPlayers[2] && (
             <div className="flex flex-col items-center w-1/3">
              <div className="w-14 h-14 rounded-full bg-orange-700 text-indigo-100 font-bold flex items-center justify-center text-xl mb-2 border-4 border-indigo-900">3</div>
              <div className="bg-indigo-800/30 w-full h-24 rounded-t-2xl flex flex-col justify-end p-2 text-center border-t border-x border-indigo-800">
                 <span className="font-bold truncate w-full opacity-80">{sortedPlayers[2].name}</span>
                 <span className="text-sm opacity-60">{sortedPlayers[2].score}</span>
              </div>
            </div>
          )}
       </div>

       {isHost && (
         <button onClick={resetGame} className="bg-white text-indigo-900 font-black py-4 px-12 rounded-full shadow-xl hover:scale-105 transition z-10 flex items-center gap-2">
           <Play size={20} /> Play Again
         </button>
       )}
    </div>
  );
};

const LobbyScreen = ({ gameState, user, isHost, roomCode, copyInvite, copied, toggleReady, startGame, setShowThemeBuilder, currentTheme, setRoomCode, themes, isPreview }) => {
  const me = gameState.players.find(p => p.uid === user.uid);
  const allReady = gameState.players.every(p => p.isReady);
  
  // Clean link logic for display
  let displayLink = "Deploy to share link";
  try {
     const url = new URL(window.location.href);
     if (url.protocol !== 'blob:') {
         url.searchParams.set('room', roomCode);
         displayLink = url.toString();
     }
  } catch(e) {}

  return (
    <div className="min-h-screen bg-indigo-950 text-white p-6 overflow-y-auto pb-24">
       <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className={`bg-gradient-to-br ${currentTheme.color} rounded-3xl p-6 text-center shadow-lg relative overflow-hidden`}>
            <h2 className="text-white/80 text-xs uppercase tracking-widest mb-2 font-bold">Join Code</h2>
            <div className="text-6xl font-black font-mono tracking-wider mb-4 text-white drop-shadow-md">{roomCode}</div>
            
            <div className="flex gap-2 mb-2">
               <div className="flex-1 bg-black/20 rounded-xl p-3 flex items-center gap-2 overflow-hidden">
                 <LinkIcon size={14} className="text-white/60 shrink-0" />
                 <div className="truncate text-xs font-mono text-white opacity-90 text-left">
                    {isPreview ? "Link unavailable in preview" : displayLink}
                 </div>
               </div>
               <button onClick={copyInvite} className="bg-white text-indigo-900 p-3 rounded-xl font-bold hover:bg-indigo-50 transition shrink-0 w-12 flex items-center justify-center">
                 {copied ? <Check size={20} /> : <Copy size={20} />}
               </button>
            </div>
            
            {isPreview && (
              <div className="bg-yellow-500/20 border border-yellow-500/50 p-2 rounded-lg text-[10px] text-yellow-100 flex items-center gap-2 text-left">
                <AlertTriangle size={14} className="shrink-0 text-yellow-400" />
                This is a preview. To share a real link, you must deploy this code.
              </div>
            )}
          </div>

          {/* Theme */}
          <div className="bg-indigo-900/40 rounded-2xl p-4 border border-indigo-800">
             <div className="flex items-center justify-between mb-3">
                <div className="text-indigo-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                  <Palette size={14} /> Theme
                </div>
                {isHost && (
                  <button onClick={() => setShowThemeBuilder(true)} className="text-xs text-purple-400 font-bold hover:text-purple-300 flex items-center gap-1 bg-indigo-950 px-3 py-1 rounded-lg border border-indigo-800">
                    <Plus size={12} /> Custom
                  </button>
                )}
             </div>
             {isHost ? (
               <div className="relative">
                 <select value={gameState.theme} onChange={(e) => setRoomCode(e.target.value)} className="w-full appearance-none bg-indigo-950 border border-indigo-700 rounded-xl px-4 py-4 text-white font-bold outline-none focus:border-purple-500 transition-colors cursor-pointer">
                   <optgroup label="Official Packs">{Object.entries(DEFAULT_THEMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</optgroup>
                   {gameState.customThemes && <optgroup label="Community Packs">{Object.entries(gameState.customThemes).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</optgroup>}
                 </select>
                 <ChevronDown className="absolute right-4 top-4 text-indigo-400 pointer-events-none" size={20} />
               </div>
             ) : (
               <div className="bg-indigo-950 border border-indigo-700 rounded-xl px-4 py-4 text-white font-bold flex justify-between items-center">
                 {currentTheme.label}
                 <span className="text-[10px] bg-indigo-800 px-2 py-1 rounded text-indigo-300 uppercase">Host controls</span>
               </div>
             )}
          </div>

          {/* Players */}
          <div className="space-y-2">
            <div className="flex justify-between items-end px-2">
              <h3 className="text-indigo-400 font-bold uppercase text-xs">Roster ({gameState.players.length})</h3>
            </div>
            {gameState.players.map((p, i) => (
              <div key={i} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${p.isReady ? 'bg-green-900/20 border-green-500/50' : 'bg-indigo-900/20 border-indigo-800/50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner ${p.isReady ? 'bg-green-500 text-indigo-950' : 'bg-indigo-700 text-white'}`}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <span className={`font-bold ${p.isReady ? 'text-white' : 'text-indigo-300'}`}>{p.name}</span>
                  {p.uid === gameState.hostId && <Crown size={16} className="text-yellow-400" />}
                </div>
                {p.isReady && <div className="bg-green-500/20 text-green-400 p-1 rounded-full"><Check size={16} strokeWidth={3} /></div>}
              </div>
            ))}
          </div>
       </div>

       {/* Footer Actions */}
       <div className="fixed bottom-0 left-0 right-0 p-4 bg-indigo-950/80 backdrop-blur-lg border-t border-indigo-800 z-50">
          <div className="max-w-md mx-auto space-y-3">
            <button onClick={toggleReady} className={`w-full font-black py-4 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-lg transform active:scale-95 ${me?.isReady ? 'bg-indigo-800 text-indigo-300' : 'bg-purple-600 text-white animate-pulse'}`}>
              {me?.isReady ? 'Waiting for others...' : "I'M READY!"}
            </button>
            {isHost && (
              <button onClick={startGame} disabled={!allReady} className={`w-full font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 text-lg transition ${allReady ? 'bg-green-500 text-indigo-900 hover:bg-green-400' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                <Play size={24} fill="currentColor" /> START GAME
              </button>
            )}
          </div>
       </div>
    </div>
  );
};

const GameScreen = ({ user, gameState, currentPlayer, isMyTurn, isHost, currentTheme, handleCorrect, nextTurn, cancelRound, soundEnabled, setSoundEnabled, copyInvite }) => {
  const [guess, setGuess] = useState('');
  
  return (
    <div className="fixed inset-0 bg-indigo-950 text-white flex flex-col max-w-md mx-auto border-x border-indigo-900 shadow-2xl">
       {/* Header */}
       <div className="bg-indigo-900 p-3 flex justify-between items-center shadow-md z-20 shrink-0">
          <div className="flex items-center gap-3">
             <button onClick={cancelRound} className="p-2 hover:bg-white/10 rounded-full transition text-indigo-300"><ArrowLeft size={20}/></button>
             <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">Acting Now</span>
                <span className="font-bold text-white leading-none">{currentPlayer.name}</span>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 text-indigo-400 hover:text-white">{soundEnabled ? <Volume2 size={20}/> : <VolumeX size={20}/>}</button>
             <div className="bg-indigo-950 px-3 py-1.5 rounded-lg border border-indigo-800 flex items-center gap-2">
               <Clock size={14} className="text-purple-400" />
               <GameTimer endTime={gameState.roundEndTime} onTimeUp={() => isHost && nextTurn(false)} soundEnabled={soundEnabled} />
             </div>
          </div>
       </div>

       {/* Main Area */}
       <div className="flex-1 relative bg-indigo-950 flex flex-col overflow-hidden">
          {isMyTurn ? (
             <div className="flex flex-col h-full">
                <div className="flex-1 bg-white text-indigo-950 flex flex-col items-center justify-center p-6 relative">
                   <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-indigo-100 text-indigo-900 text-xs font-bold uppercase tracking-wider">Secret Word</div>
                   <button onClick={() => nextTurn(false)} className="absolute top-4 right-4 text-xs font-bold text-indigo-400 flex items-center gap-1 bg-indigo-50 px-3 py-2 rounded-full">Skip <SkipForward size={14}/></button>
                   <h1 className="text-5xl font-black text-center leading-tight break-words animate-in zoom-in">{gameState.currentWord}</h1>
                   <p className="mt-4 text-sm font-bold text-indigo-300 uppercase tracking-widest">{currentTheme.label}</p>
                </div>
                <button onClick={() => handleCorrect()} className="flex-1 bg-green-500 hover:bg-green-400 text-indigo-900 flex flex-col items-center justify-center p-6 transition group active:bg-green-600">
                   <div className="bg-green-900/20 p-5 rounded-full mb-4 group-active:scale-90 transition"><Check size={48} strokeWidth={4}/></div>
                   <span className="text-3xl font-black uppercase tracking-tight">Someone Guessed It!</span>
                </button>
             </div>
          ) : (
             <div className="flex flex-col h-full bg-indigo-900/20">
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                   {gameState.messages.map(m => (
                     <div key={m.id} className={`flex flex-col ${m.type === 'correct' ? 'items-center my-4' : m.uid === user.uid ? 'items-end' : 'items-start'}`}>
                        {m.type === 'correct' ? (
                           <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-full font-bold shadow-lg text-sm flex items-center gap-2 animate-bounce">
                             <Trophy size={16}/> {m.text}
                           </div>
                        ) : (
                           <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium ${m.uid === user.uid ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-indigo-800 text-indigo-100 rounded-tl-none'}`}>
                              <span className="text-[10px] opacity-60 block uppercase mb-1 font-bold">{m.sender}</span>
                              {m.text}
                           </div>
                        )}
                     </div>
                   ))}
                </div>
                {/* Input */}
                <div className="p-3 bg-indigo-950/80 backdrop-blur border-t border-indigo-800">
                   <form onSubmit={(e) => { e.preventDefault(); if(guess.trim()){ handleCorrect(user.uid); setGuess(''); } }} className="flex gap-2">
                      <input value={guess} onChange={e => setGuess(e.target.value)} placeholder="Type your guess..." className="flex-1 bg-indigo-900 border-transparent rounded-xl px-4 text-white focus:border-purple-500 outline-none transition" />
                      <button type="submit" disabled={!guess.trim()} className="bg-purple-600 text-white p-3 rounded-xl font-bold disabled:opacity-50"><Send size={20}/></button>
                   </form>
                   <p className="text-center text-[10px] text-indigo-400 mt-2">Typing correct answer awards points automatically</p>
                </div>
             </div>
          )}
       </div>

       {/* Scores */}
       <div className="bg-indigo-950 border-t border-indigo-900 p-3 pb-safe z-10">
          <div className="flex gap-4 overflow-x-auto no-scrollbar">
             {gameState.players.sort((a,b) => b.score - a.score).map(p => (
               <div key={p.uid} className={`flex flex-col items-center min-w-[50px] ${p.uid === currentPlayer.uid ? 'opacity-100' : 'opacity-50'}`}>
                  <div className="text-[10px] font-bold text-indigo-300 truncate max-w-[64px]">{p.name}</div>
                  <div className="font-black text-white">{p.score}</div>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
};

const GameTimer = ({ endTime, onTimeUp, simple, soundEnabled }) => {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endTime) return;
    const i = setInterval(() => {
      const diff = Math.ceil((endTime - Date.now())/1000);
      if (diff !== left) {
          setLeft(Math.max(0, diff));
          if (diff <= 5 && diff > 0 && !simple && soundEnabled) playSound('tick');
      }
      if (diff <= 0) { clearInterval(i); onTimeUp && onTimeUp(); }
    }, 1000);
    return () => clearInterval(i);
  }, [endTime, left, soundEnabled]);
  return <span className={`font-mono font-bold ${left <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{Math.floor(left/60)}:{(left%60).toString().padStart(2,'0')}</span>;
};

const ThemeBuilder = ({ newThemeName, setNewThemeName, newThemeWords, setNewThemeWords, saveCustomTheme, setShowThemeBuilder }) => (
    <div className="fixed inset-0 bg-indigo-950/90 z-[60] flex items-center justify-center p-6 backdrop-blur-sm">
    <div className="bg-slate-900 w-full max-w-md rounded-3xl p-6 border border-slate-700 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings size={20} /> Create Theme
        </h2>
        <button onClick={() => setShowThemeBuilder(false)} className="text-slate-400 hover:text-white">
            <X size={24} />
        </button>
        </div>
        <div className="space-y-4">
        <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Theme Name</label>
            <input 
            type="text" 
            value={newThemeName}
            onChange={(e) => setNewThemeName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none mt-2"
            placeholder="e.g. Inside Jokes"
            />
        </div>
        <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
            <span>Words (Comma Separated)</span>
            <span className={newThemeWords.split(',').length < 5 ? 'text-red-400' : 'text-green-400'}>
                {newThemeWords ? newThemeWords.split(',').length : 0} words
            </span>
            </label>
            <textarea 
            value={newThemeWords}
            onChange={(e) => setNewThemeWords(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none mt-2 h-32 text-sm"
            placeholder="Grandma's Cookies, The Dog, Summer Vacation..."
            />
        </div>
        <button 
            onClick={saveCustomTheme}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl shadow-lg mt-2"
        >
            Save Theme
        </button>
        </div>
    </div>
    </div>



