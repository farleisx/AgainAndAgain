import './index.css';
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';

// Tailwind CSS is included via a global stylesheet for this example.
// In a real project, you would set up PostCSS. For Vercel, this is automatically handled.

const firebaseConfig = __firebase_config;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper function to handle the dynamic typing effect
const TypingEffect = ({ words }) => {
  const [currentWord, setCurrentWord] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const handleTyping = () => {
      const fullTxt = words[wordIndex];
      const speed = isDeleting ? 50 : 150;

      setCurrentWord(isDeleting ? fullTxt.substring(0, charIndex - 1) : fullTxt.substring(0, charIndex + 1));
      setCharIndex(prev => isDeleting ? prev - 1 : prev + 1);

      if (!isDeleting && charIndex === fullTxt.length) {
        setTimeout(() => setIsDeleting(true), 1500);
      } else if (isDeleting && charIndex === 0) {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
      }
    };

    const typingTimeout = setTimeout(handleTyping, 100);
    return () => clearTimeout(typingTimeout);
  }, [charIndex, isDeleting, wordIndex, words]);

  return <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 font-bold">{currentWord}</span>;
};

const App = () => {
  const [currentPage, setCurrentPage] = useState('landing');
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [code, setCode] = useState(`<!DOCTYPE html>
<html>
<head>
  <title>My First Project</title>
  <style>
    body {
      background-color: #1a202c;
      color: #cbd5e0;
      font-family: sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    h1 {
      font-size: 2.5rem;
      background: -webkit-linear-gradient(45deg, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  </style>
</head>
<body>
  <h1>Hello, World!</h1>
</body>
</html>`);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([{ role: 'assistant', content: 'Hey, I am your personal coding assistant. How can I help you today?' }]);
  const [isTyping, setIsTyping] = useState(false);

  const iframeRef = useRef(null);

  // Auth State Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        setCurrentPage('dashboard');
        // Example of saving user data to Firestore
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { email: user.email, lastLogin: new Date() }, { merge: true });
        
        // Example of fetching and updating data from Firestore
        const userCodeRef = doc(db, 'user_data', user.uid);
        const userCodeSnap = await getDoc(userCodeRef);
        if (userCodeSnap.exists()) {
            setCode(userCodeSnap.data().htmlCode);
        } else {
            // Save initial code for new users
            await setDoc(userCodeRef, { htmlCode: code });
        }
      } else {
        setUser(null);
        setCurrentPage('landing');
      }
      setIsAuthReady(true);
    });

    // Clean up listener on unmount
    return () => unsub();
  }, [code]);

  // Live preview effect
  useEffect(() => {
    if (iframeRef.current) {
      const iframeDoc = iframeRef.current.contentDocument;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(code);
        iframeDoc.close();
      }
    }
  }, [code]);

  // Handle Auth submission
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error(error);
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setChatHistory([{ role: 'assistant', content: 'Hey, I am your personal coding assistant. How can I help you today?' }]);
  };

  // Handle AI Agent Chat
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');
    setIsTyping(true);

    // This is a simulated API call. Replace this with your actual API call.
    // The API key must be stored in a Vercel environment variable.
    // In Vercel, the environment variable is named "VITE_GEMINI_API_KEY".
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';

    try {
      // Dummy response for demonstration
      const dummyResponse = "I can't execute code directly, but I can help you with that. The code you provided looks like a simple HTML document. If you want to add a button, you can add a `<button>` element inside the `<body>`.";

      setChatHistory(prev => [...prev, { role: 'assistant', content: dummyResponse }]);
    } catch (error) {
      console.error("Gemini API Error:", error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, I am unable to connect to the AI agent right now. Please try again later.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Helper function to save code to Firestore
  const saveCodeToFirestore = async (newCode) => {
    if (user) {
        const userCodeRef = doc(db, 'user_data', user.uid);
        await setDoc(userCodeRef, { htmlCode: newCode }, { merge: true });
    }
  };

  const handleCodeChange = (e) => {
    const newCode = e.target.value;
    setCode(newCode);
    saveCodeToFirestore(newCode); // Save code as the user types
  };

  // Render different pages based on state
  const renderPage = () => {
    if (!isAuthReady) {
      return (
        <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      );
    }

    switch (currentPage) {
      case 'landing':
        return (
          <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
            <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-8">
              <h1 className="text-2xl font-bold">Infinitive.app</h1>
              <button
                onClick={() => setCurrentPage('auth')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-2 px-6 rounded-full shadow-lg transition-transform transform hover:scale-105"
              >
                Login / Sign up
              </button>
            </header>
            <main className="text-center mt-20">
              <h2 className="text-5xl md:text-7xl font-extrabold leading-tight">
                Build anything with <br />
                <TypingEffect words={["web apps.", "eCommerce stores.", "games.", "portfolios."]} />
              </h2>
              <p className="mt-6 text-xl text-gray-400 max-w-2xl mx-auto">
                The world's first AI-powered environment where you can code, collaborate, and deploy, all from your browser.
              </p>
            </main>
          </div>
        );

      case 'auth':
        return (
          <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl p-8 transform transition-all hover:scale-105 duration-300">
              <div className="flex justify-center mb-6">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${isLogin ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                >
                  Login
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ml-4 ${!isLogin ? 'bg-pink-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                >
                  Sign Up
                </button>
              </div>
              <form onSubmit={handleAuthSubmit} className="space-y-6">
                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                    required
                  />
                </div>
                {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
                <button
                  type="submit"
                  className="w-full py-3 rounded-full font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-transform transform hover:scale-105"
                >
                  {isLogin ? 'Login' : 'Sign Up'}
                </button>
              </form>
              <button
                onClick={() => setCurrentPage('landing')}
                className="mt-4 w-full py-2 rounded-full font-semibold text-gray-400 hover:text-white transition-colors"
              >
                Back to home
              </button>
            </div>
          </div>
        );

      case 'dashboard':
        return (
          <div className="flex flex-col h-screen bg-gray-900 text-white">
            <header className="flex justify-between items-center p-4 bg-gray-800 shadow-md">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Infinitive.app</h1>
                <span className="text-sm text-gray-400">User: {user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-full shadow-lg transition-transform transform hover:scale-105"
              >
                Log Out
              </button>
            </header>
            <main className="flex flex-1 overflow-hidden">
              {/* AI Agent Chat */}
              <div className="w-1/4 p-4 flex flex-col bg-gray-800 border-r border-gray-700">
                <h2 className="text-lg font-semibold mb-4 text-purple-400">Agent AI</h2>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {chatHistory.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-3 rounded-lg max-w-[85%] ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="p-3 rounded-lg bg-gray-700 text-gray-400 animate-pulse">
                        Typing...
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={handleChatSubmit} className="mt-4 flex">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 px-4 py-2 bg-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ask me anything..."
                  />
                  <button type="submit" className="ml-2 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full transition-transform transform hover:scale-110">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.769 59.769 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  </button>
                </form>
              </div>

              {/* Code Editor */}
              <div className="flex-1 p-4 bg-gray-900 overflow-hidden">
                <h2 className="text-lg font-semibold mb-4 text-purple-400">Code Editor</h2>
                <textarea
                  className="w-full h-full bg-gray-800 text-gray-300 font-mono text-sm p-4 rounded-lg shadow-inner outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  value={code}
                  onChange={handleCodeChange}
                />
              </div>

              {/* Live Preview */}
              <div className="w-1/3 p-4 bg-gray-800 border-l border-gray-700">
                <h2 className="text-lg font-semibold mb-4 text-purple-400">Live Preview</h2>
                <div className="w-full h-full bg-white rounded-lg shadow-xl overflow-hidden">
                  <iframe
                    ref={iframeRef}
                    title="Live Preview"
                    className="w-full h-full border-none"
                    sandbox="allow-scripts allow-forms allow-same-origin"
                  ></iframe>
                </div>
              </div>
            </main>
          </div>
        );

      default:
        return null;
    }
  };

  return renderPage();
};

export default App;
