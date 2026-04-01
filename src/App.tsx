/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, BookOpenText, Camera, Share2, Copy, Check, ArrowRight, Mic, MicOff, AlignLeft, TextCursor, MapPin, Filter, Megaphone, RefreshCw, Trash2, Table, AlignJustify, StickyNote, Key, Lock, LayoutGrid, Feather, ScrollText, Clock, Save, Bookmark, MessageCircle, Info, X, LogOut } from 'lucide-react';
import { analyzeSentence, searchGrammarRule, analyzePoetry, analyzeSpelling } from './services/geminiService';
import { AnalyzedWord, SpellingResult } from './types';
import Markdown from 'react-markdown';
import { db, auth, googleProvider } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4" dir="rtl">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">عذراً، حدث خطأ غير متوقع!</h2>
            <p className="text-stone-600 mb-6">واجه التطبيق مشكلة أثناء عرض البيانات. يرجى تحديث الصفحة والمحاولة مرة أخرى.</p>
            <button onClick={() => window.location.reload()} className="bg-brand text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-light">
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const getCategoryStyles = (category: string) => {
  if (!category) return { text: 'text-stone-600', badge: 'bg-stone-50 text-stone-600 border-stone-200' };
  
  if (category.includes('فعل')) {
    return {
      text: 'text-red-600',
      badge: 'bg-red-50 text-red-600 border-red-200',
    };
  }
  if (category.includes('حرف')) {
    return {
      text: 'text-purple-600',
      badge: 'bg-purple-50 text-purple-600 border-purple-200',
    };
  }
  if (category.includes('ضمير')) {
    return {
      text: 'text-amber-600',
      badge: 'bg-amber-50 text-amber-600 border-amber-200',
    };
  }
  if (category.includes('مرفوع') || category.includes('مبتدأ') || category.includes('فاعل')) {
    return {
      text: 'text-emerald-600',
      badge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    };
  }
  if (category.includes('منصوب') || category.includes('مفعول')) {
    return {
      text: 'text-orange-600',
      badge: 'bg-orange-50 text-orange-600 border-orange-200',
    };
  }
  if (category.includes('مجرور') || category.includes('مضاف')) {
    return {
      text: 'text-cyan-600',
      badge: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    };
  }
  if (category.includes('اسم') || category.includes('خبر') || category.includes('منادى')) {
    return {
      text: 'text-blue-600',
      badge: 'bg-blue-50 text-blue-600 border-blue-200',
    };
  }
  return {
    text: 'text-stone-600',
    badge: 'bg-stone-50 text-stone-600 border-stone-200',
  };
};

const colorizeDiacritics = (text: string) => {
  if (!text) return text;
  const diacriticsRegex = /([\u064B-\u065F\u0670])/g;
  const parts = text.split(diacriticsRegex);
  return parts.map((part, index) => {
    if (part.match(diacriticsRegex)) {
      return <span key={index} className="text-red-500">{part}</span>;
    }
    return part;
  });
};

function Splash({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col items-center justify-center p-6 bg-brand overflow-hidden"
    >
      {/* Subtle + grid pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="plus-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M20 15 L20 25 M15 20 L25 20" stroke="white" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#plus-pattern)" />
        </svg>
      </div>

      {/* Large background circle */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-white/5 blur-2xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", type: "spring", bounce: 0.5 }}
          className="w-32 h-32 md:w-40 md:h-40 bg-white/10 rounded-[2rem] border border-white/20 flex items-center justify-center backdrop-blur-md shadow-2xl mb-8"
        >
          <motion.span 
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: 4 }}
            className="text-6xl md:text-7xl font-bold text-white font-sans inline-block"
          >
            عرب
          </motion.span>
        </motion.div>
        
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-4xl md:text-5xl font-bold text-white mb-4 text-center font-sans drop-shadow-lg flex items-center justify-center gap-3"
        >
          <motion.span
            style={{ display: 'inline-block' }}
            animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
            transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 }}
            className="inline-block origin-bottom"
          >
            معرب
          </motion.span>
          <span>الجمل العربية</span>
        </motion.h1>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="flex gap-3 mt-16"
        >
          <div className="w-3 h-3 rounded-full bg-white/80"></div>
          <div className="w-3 h-3 rounded-full bg-white/30"></div>
          <div className="w-3 h-3 rounded-full bg-white/30"></div>
        </motion.div>
      </div>
    </motion.div>
  );
}

const loadingMessages = [
  "جاري تحليل الجملة... ⏳",
  "جاري استخراج القواعد النحوية... 🔍",
  "جاري تحديد المواقع... 📍",
  "جاري صياغة النتيجة التفصيلية... ✍️",
  "نضع اللمسات الأخيرة... ✨"
];

const generateRandomCode = () => Math.floor(10000 + Math.random() * 90000).toString();

function LoginScreen({ onLogin }: { onLogin: (isTrial: boolean) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [validCodes, setValidCodes] = useState<string[]>(() => {
    const saved = localStorage.getItem('valid_codes');
    if (saved) return JSON.parse(saved);
    const initialCode = generateRandomCode();
    localStorage.setItem('valid_codes', JSON.stringify([initialCode]));
    return [initialCode];
  });

  const handleGenerateNewCode = () => {
    const newCode = generateRandomCode();
    const updatedCodes = [newCode]; // Only keep the latest code
    setValidCodes(updatedCodes);
    localStorage.setItem('valid_codes', JSON.stringify(updatedCodes));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === '2020') {
      setShowAdmin(true);
      setError(false);
    } else if (code === '2323') {
      onLogin(false);
    } else if (validCodes.includes(code)) {
      onLogin(true);
    } else {
      setError(true);
      setCode('');
    }
  };

  if (showAdmin) {
    return (
      <div className="min-h-screen bg-[#0d1b18] flex items-center justify-center p-4 font-sans" dir="rtl">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#152a25] p-8 rounded-3xl shadow-xl w-full max-w-md border border-emerald-800/30 text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-6">لوحة الإدارة - توليد الأكواد</h2>
          <p className="text-emerald-200/70 mb-4">أحدث كود دخول صالح هو:</p>
          <div className="bg-emerald-900/30 border-2 border-emerald-700/50 rounded-2xl p-6 mb-4">
            <span className="text-5xl font-bold text-emerald-400 tracking-widest">{validCodes[0]}</span>
          </div>
          
          <button
            onClick={handleGenerateNewCode}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all text-lg mb-6 shadow-md"
          >
            توليد كود جديد
          </button>
          
          <button
            onClick={() => onLogin(false)}
            className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all text-lg mb-4"
          >
            الدخول للتطبيق كمسؤول
          </button>

          <button
            onClick={() => { setShowAdmin(false); setCode(''); }}
            className="w-full bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold py-4 rounded-2xl transition-all text-lg"
          >
            العودة لتسجيل الدخول
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1b18] flex items-center justify-center p-4 font-sans relative overflow-hidden" dir="rtl">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-900/20 blur-[100px] pointer-events-none"></div>

      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#11221e] p-8 md:p-10 rounded-[2rem] shadow-2xl w-full max-w-[400px] border border-emerald-800/20 relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 rounded-full border border-emerald-700/50 flex items-center justify-center mb-6 bg-emerald-900/20"
          >
            <span className="text-5xl font-bold text-emerald-400 font-ruqaa">م</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-white font-sans text-center mb-2">
            معرب الجمل العربية
          </h1>
          <p className="text-emerald-500 text-center text-sm font-medium">
            المحلل النحوي الذكي
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-emerald-500 text-sm font-bold px-1">كلمة الدخول</label>
            <div className={`relative flex items-center bg-white rounded-2xl overflow-hidden transition-all ${error ? 'ring-2 ring-red-500' : 'focus-within:ring-2 focus-within:ring-emerald-500'}`}>
              <div className="px-4 text-emerald-400">
                <Lock size={20} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(false);
                }}
                className="flex-1 py-4 bg-transparent outline-none text-stone-800 text-lg font-medium"
                dir="ltr"
                autoFocus
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="px-4 text-emerald-400 hover:text-emerald-600 transition-colors"
              >
                <Feather size={20} className={showPassword ? "opacity-100" : "opacity-50"} />
              </button>
            </div>
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-xs mt-1 px-1 font-bold"
              >
                كلمة الدخول غير صحيحة
              </motion.p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold py-4 rounded-2xl transition-all text-lg flex items-center justify-center gap-2 mt-2"
          >
            دخول <Feather size={20} className="rotate-45" />
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-emerald-800/60 text-xs font-medium">
            مدعوم بتقنية Google Gemini AI
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialStartTime, setTrialStartTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('trial_start_time');
    return saved ? parseInt(saved, 10) : null;
  });
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const handleLogin = (trial: boolean) => {
    setIsAuthenticated(true);
    setIsTrial(trial);
    if (trial) {
      const savedStartTime = localStorage.getItem('trial_start_time');
      if (savedStartTime) {
        const startTime = parseInt(savedStartTime, 10);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed < 3600) {
          setTrialStartTime(startTime);
          return;
        }
      }
      const startTime = Date.now();
      setTrialStartTime(startTime);
      localStorage.setItem('trial_start_time', startTime.toString());
    } else {
      localStorage.removeItem('trial_start_time');
      setTrialStartTime(null);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsTrial(false);
    setTimeLeft(null);
  };

  useEffect(() => {
    if (isAuthenticated && isTrial && trialStartTime) {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - trialStartTime) / 1000);
        const remaining = 3600 - elapsed;
        
        if (remaining <= 0) {
          setIsAuthenticated(false);
          setIsTrial(false);
          setTrialStartTime(null);
          localStorage.removeItem('trial_start_time');
          clearInterval(interval);
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isTrial, trialStartTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [showSplash, setShowSplash] = useState(true);
  const [sentence, setSentence] = useState('');
  const [mode, setMode] = useState<'full' | 'partial' | 'sentence-position' | 'extract' | 'vocative' | 'convert' | 'notes' | 'compare'>('full');
  const [displayMode, setDisplayMode] = useState<'table' | 'separated' | 'cards' | 'bubbles'>('bubbles');
  const [selectedBubble, setSelectedBubble] = useState<number | null>(null);

  useEffect(() => {
    const handleClickOutside = () => {
      setSelectedBubble(null);
    };
    if (selectedBubble !== null) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [selectedBubble]);
  const [targetWords, setTargetWords] = useState('');
  const [showAllFacets, setShowAllFacets] = useState(false);
  const [result, setResult] = useState<AnalyzedWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const [fontSize, setFontSize] = useState(16);
  
  const [activeTab, setActiveTab] = useState<'parser' | 'rules' | 'poetry' | 'spelling' | 'saved'>('parser');
  const [showTabBubbles, setShowTabBubbles] = useState(false);
  const [ruleQuery, setRuleQuery] = useState('');
  const [ruleResult, setRuleResult] = useState('');
  const [ruleLoading, setRuleLoading] = useState(false);
  const [poetryQuery, setPoetryQuery] = useState('');
  const [poetryResult, setPoetryResult] = useState('');
  const [poetryLoading, setPoetryLoading] = useState(false);
  const [spellingQuery, setSpellingQuery] = useState('');
  const [spellingResult, setSpellingResult] = useState<SpellingResult | null>(null);
  const [spellingLoading, setSpellingLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedResults, setSavedResults] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchSavedResults(user.uid);
      } else {
        setSavedResults([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchSavedResults = async (userId: string) => {
    setLoadingSaved(true);
    try {
      const q = query(
        collection(db, 'saved_results'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSavedResults(results);
    } catch (error) {
      console.error("Error fetching saved results:", error);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleSaveResult = async () => {
    if (!auth.currentUser) {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error("Error signing in:", error);
        return;
      }
    }

    if (!auth.currentUser || result.length === 0) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'saved_results'), {
        userId: auth.currentUser.uid,
        sentence: sentence || 'صورة',
        mode: mode,
        targetWords: targetWords,
        result: JSON.stringify(result),
        createdAt: serverTimestamp()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchSavedResults(auth.currentUser.uid);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'saved_results');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'saved_results', id));
      setSavedResults(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `saved_results/${id}`);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      let i = 0;
      setLoadingMessage(loadingMessages[0]);
      interval = setInterval(() => {
        i = (i + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[i]);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'ar-SA';

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join('');
          setSentence(transcript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            alert('يرجى السماح بالوصول إلى الميكروفون لاستخدام ميزة الإدخال الصوتي.');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        alert('عذراً، متصفحك لا يدعم ميزة التعرف على الصوت.');
        return;
      }
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error('Failed to start recognition', e);
      }
    }
  };

  const handleClear = () => {
    setResult([]);
    setSentence('');
    setTargetWords('');
    setMode('full');
    setDisplayMode('table');
    setRuleQuery('');
    setRuleResult('');
    setImage(null);
    setErrorMessage(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setSentence('تم رفع صورة، سيتم تحليلها...');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopy = () => {
    const text = result.map(r => `${r.word}: ${r.analysis}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const appLink = "https://ais-pre-3hbnqgqkos4uxfitywzox5-26016155467.europe-west1.run.app";
    const text = `النتائج:\n\n${result.map(r => `${r.word}: ${r.analysis}`).join('\n')}\n\nتمت المعالجة بواسطة تطبيق نتائج الجمل العربية:\n${appLink}`;
    
    if (navigator.share) {
      navigator.share({ 
        title: 'النتائج من تطبيق نتائج الجمل العربية', 
        text: text,
        url: appLink
      }).catch(console.error);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  const handleAnalyze = async () => {
    if (!sentence.trim() && !image) return;
    
    setLoading(true);
    setErrorMessage(null);
    try {
      const base64Image = image ? image.split(',')[1] : undefined;
      let analysis = await analyzeSentence(sentence, mode, targetWords, base64Image, showAllFacets);
      
      // تأمين البيانات لمنع الشاشة البيضاء
      if (!Array.isArray(analysis)) {
        console.error("API did not return an array:", analysis);
        throw new Error("استجابة غير صالحة: البيانات المستلمة ليست مصفوفة.");
      }
      
      // تصفية أي عناصر فارغة أو غير صالحة
      analysis = analysis.filter(item => item && typeof item === 'object' && item.word);
      
      if (analysis.length === 0) {
        throw new Error("لم يتم العثور على نتائج قابلة للعرض.");
      }

      setResult(analysis);
    } catch (error: any) {
      console.error(error);
      const msg = error.message || "حدث خطأ غير متوقع. تأكد من إعداد مفتاح API بشكل صحيح.";
      setErrorMessage(msg);
      setResult([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchRule = async () => {
    if (!ruleQuery.trim()) return;
    
    setRuleLoading(true);
    try {
      const result = await searchGrammarRule(ruleQuery);
      setRuleResult(result);
    } catch (error) {
      console.error(error);
      setRuleResult('حدث خطأ أثناء البحث.');
    } finally {
      setRuleLoading(false);
    }
  };

  const handlePoetryAnalyze = async () => {
    if (!poetryQuery.trim()) return;
    
    setPoetryLoading(true);
    try {
      const result = await analyzePoetry(poetryQuery);
      setPoetryResult(result);
    } catch (error) {
      console.error(error);
      setPoetryResult('حدث خطأ أثناء تحليل البيت.');
    } finally {
      setPoetryLoading(false);
    }
  };

  const handleSpellingAnalyze = async () => {
    if (!spellingQuery.trim()) return;
    
    setSpellingLoading(true);
    try {
      const result = await analyzeSpelling(spellingQuery);
      setSpellingResult(result);
    } catch (error) {
      console.error(error);
      setSpellingResult({
        correctedText: 'حدث خطأ أثناء مراجعة الإملاء.',
        corrections: []
      });
    } finally {
      setSpellingLoading(false);
    }
  };

  const renderSpellingResult = () => {
    if (!spellingResult) return null;

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
        <div className="flex bg-stone-100 p-1 rounded-xl w-fit">
          <button onClick={() => setDisplayMode('table')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${displayMode === 'table' ? 'bg-white shadow-sm text-brand font-bold' : 'text-stone-500 hover:text-stone-700'}`}>
            <Table size={18} /> جدول
          </button>
          <button onClick={() => setDisplayMode('separated')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${displayMode === 'separated' ? 'bg-white shadow-sm text-brand font-bold' : 'text-stone-500 hover:text-stone-700'}`}>
            <AlignJustify size={18} /> مفصل
          </button>
          <button onClick={() => setDisplayMode('cards')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${displayMode === 'cards' ? 'bg-white shadow-sm text-brand font-bold' : 'text-stone-500 hover:text-stone-700'}`}>
            <LayoutGrid size={18} /> بطاقات
          </button>
        </div>

        <div className="p-6 bg-white rounded-xl border border-stone-200 text-stone-800 leading-relaxed whitespace-pre-line relative font-serif text-lg">
          <h3 className="text-xl font-bold text-brand mb-4 flex items-center gap-2">
            <Check className="text-green-600" />
            النص المصحح
          </h3>
          <div className="text-xl">
            {colorizeDiacritics(spellingResult.correctedText)}
          </div>
        </div>

        {spellingResult.corrections.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xl font-bold text-stone-800 mb-6 flex items-center gap-2">
              <BookOpenText className="text-brand" />
              تفاصيل التصحيحات والقواعد
            </h3>

            {displayMode === 'table' && (
              <div className="overflow-x-auto rounded-xl border border-stone-200 shadow-sm">
                <table className="w-full text-right border-collapse bg-white">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="p-4 font-bold text-stone-700 w-1/4">الكلمة الخاطئة</th>
                      <th className="p-4 font-bold text-stone-700 w-1/4">التصحيح</th>
                      <th className="p-4 font-bold text-stone-700 w-1/2">السبب والقاعدة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spellingResult.corrections.map((correction, idx) => (
                      <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                        <td className="p-4 text-red-600 line-through decoration-red-300 font-bold">{correction.original}</td>
                        <td className="p-4 text-green-600 font-bold bg-green-50/30">{correction.corrected}</td>
                        <td className="p-4 text-stone-700 leading-relaxed">
                          <div className="prose prose-stone prose-sm max-w-none prose-p:my-1">
                            <Markdown>
                              {correction.reason}
                            </Markdown>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {displayMode === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {spellingResult.corrections.map((correction, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1 h-full bg-brand"></div>
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-stone-100">
                      <span className="text-red-500 line-through decoration-red-300 text-lg font-bold bg-red-50 px-3 py-1 rounded-lg">{correction.original}</span>
                      <ArrowRight className="text-stone-400" size={20} />
                      <span className="text-green-600 text-lg font-bold bg-green-50 px-3 py-1 rounded-lg">{correction.corrected}</span>
                    </div>
                    <div className="text-stone-700 leading-relaxed">
                      <div className="prose prose-stone prose-sm max-w-none prose-p:my-1">
                        <Markdown>
                          {correction.reason}
                        </Markdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {displayMode === 'separated' && (
              <div className="space-y-6">
                {spellingResult.corrections.map((correction, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm relative">
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                      <div className="flex items-center gap-4 md:w-1/3 shrink-0 bg-stone-50 p-4 rounded-lg border border-stone-100">
                        <div className="flex flex-col gap-2 w-full text-center">
                          <span className="text-red-500 line-through decoration-red-300 text-xl font-bold">{correction.original}</span>
                          <ArrowRight className="text-stone-400 mx-auto rotate-90 md:rotate-0" size={20} />
                          <span className="text-green-600 text-xl font-bold">{correction.corrected}</span>
                        </div>
                      </div>
                      <div className="md:w-2/3">
                        <h4 className="font-bold text-stone-800 mb-2 flex items-center gap-2">
                          <StickyNote size={18} className="text-brand" />
                          الشرح والتفصيل:
                        </h4>
                        <div className="text-stone-700 leading-relaxed bg-brand/5 p-4 rounded-lg border border-brand/10">
                          <div className="prose prose-stone max-w-none prose-p:my-1">
                            <Markdown>
                              {correction.reason}
                            </Markdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <AnimatePresence>
        {showSplash && <Splash onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      
      {!showSplash && (
        <div className="min-h-screen bg-[#fdfbf7] p-4 md:p-8 font-sans relative" dir="rtl" style={{ fontSize: `${fontSize}px` }}>
          {/* Subtle background pattern/gradient for main app */}
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-brand/5 to-transparent pointer-events-none"></div>
          
          <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto bg-white p-6 rounded-3xl shadow-xl flex flex-col min-h-[80vh] border border-amber-100 relative z-10"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex-grow flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-4">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="w-14 h-14 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shadow-sm shrink-0"
                  >
                    <span className="text-3xl font-bold text-brand font-ruqaa">م</span>
                  </motion.div>
                  <div className="flex flex-col items-start">
                    <h1 className="text-3xl md:text-4xl font-bold text-stone-800 font-ruqaa">
                      معرب الجمل العربية
                    </h1>
                    <span className="text-sm font-medium text-stone-500 mt-1">
                      بواسطة Gemini AI
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0 items-end">
                {isTrial && timeLeft !== null && (
                  <div className="bg-red-50 text-red-700 px-3 py-1 rounded-lg text-sm font-bold border border-red-100 flex items-center gap-2">
                    <Clock size={14} />
                    <span>الوقت المتبقي: {formatTime(timeLeft)}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setFontSize(s => Math.min(s + 2, 24))} className="bg-stone-100 hover:bg-stone-200 text-stone-700 p-2 rounded-xl transition-colors shadow-sm" title="تكبير الخط">+</button>
                  <button onClick={() => setFontSize(s => Math.max(s - 2, 12))} className="bg-stone-100 hover:bg-stone-200 text-stone-700 p-2 rounded-xl transition-colors shadow-sm" title="تصغير الخط">-</button>
                  <button onClick={handleLogout} className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-xl transition-colors shadow-sm flex items-center gap-2" title="تسجيل الخروج">
                    <LogOut size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="fixed bottom-8 right-8 z-50 flex flex-col-reverse items-end gap-4">
              <button
                onClick={() => setShowTabBubbles(!showTabBubbles)}
                className="w-16 h-16 bg-brand text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
              >
                {showTabBubbles ? <X size={28} /> : <LayoutGrid size={28} />}
              </button>
              
              <AnimatePresence>
                {showTabBubbles && (
                  <div className="flex flex-col-reverse gap-3 items-end">
                    {[
                      { id: 'parser', label: 'النتيجة', icon: <Feather size={20} /> },
                      { id: 'rules', label: 'البحث عن قاعدة', icon: <BookOpenText size={20} /> },
                      { id: 'poetry', label: 'أبيات شعرية', icon: <ScrollText size={20} /> },
                      { id: 'spelling', label: 'الإملاء الدقيق', icon: <Check size={20} /> },
                      { id: 'saved', label: 'المحفوظات', icon: <Bookmark size={20} /> }
                    ].map((tab, index) => (
                      <motion.button
                        key={tab.id}
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.8 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => {
                          setActiveTab(tab.id as any);
                          setShowTabBubbles(false);
                        }}
                        className={`flex items-center gap-3 px-5 py-3 rounded-full shadow-lg transition-colors whitespace-nowrap border ${activeTab === tab.id ? 'bg-brand text-white border-brand' : 'bg-white text-stone-700 hover:bg-stone-50 border-stone-200'}`}
                      >
                        <span className="font-bold">{tab.label}</span>
                        {tab.icon}
                      </motion.button>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
            
            <AnimatePresence mode="wait">
              {activeTab === 'parser' && (
                <motion.div key="parser" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-grow flex flex-col">
                  <AnimatePresence mode="wait">
                  {result.length === 0 && !loading ? (
                  <motion.div key="input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative">
                        <textarea
                          value={sentence}
                          onChange={(e) => setSentence(e.target.value)}
                          placeholder={mode === 'compare' ? "أدخل الجملة الأولى هنا..." : mode === 'extract' ? "أدخل القطعة أو النص هنا..." : mode === 'vocative' ? "أدخل أسلوب النداء هنا..." : mode === 'convert' ? "أدخل الجملة الأصلية هنا..." : mode === 'notes' ? "أدخل النص لاستخراج الملاحظات النحوية..." : "أدخل الجملة..."}
                          className="w-full min-h-[300px] text-xl md:text-2xl leading-relaxed p-6 pb-16 border-2 border-stone-200 rounded-2xl focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none resize-y shadow-inner bg-stone-50/50 font-serif"
                        />
                        <div className="absolute bottom-4 left-4 flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={toggleListening}
                            className={`p-3 rounded-xl transition-all shadow-sm ${isListening ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse' : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'}`}
                            title="التحدث بالصوت"
                          >
                            {isListening ? <MicOff size={22} /> : <Mic size={22} />}
                          </motion.button>
                          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 shadow-sm" title="إرفاق صورة">
                            <Camera size={22} />
                          </motion.button>
                        </div>
                      </motion.div>
                      
                      {image && <img src={image} alt="uploaded" className="max-h-40 rounded-xl object-contain border border-stone-200" />}
                      
                      {(mode === 'partial' || mode === 'extract' || mode === 'convert' || mode === 'notes' || mode === 'compare') && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="flex flex-col gap-3"
                        >
                          <input
                            type="text"
                            value={targetWords}
                            onChange={(e) => setTargetWords(e.target.value)}
                            placeholder={mode === 'compare' ? "أدخل الجملة الثانية للمقارنة..." : mode === 'extract' ? "ما الذي تريد استخراجه؟ (مثال: اسم فاعل، صيغة مبالغة، ممنوع من الصرف...)" : mode === 'convert' ? "ما هو التحويل المطلوب؟ (مثال: حول الجملة الاسمية إلى فعلية، أو حول الحال المفرد إلى جملة)" : mode === 'notes' ? "أي ملاحظات محددة تبحث عنها؟ (اختياري)" : "أدخل الكلمات المراد البحث عنها (مفصولة بفاصلة)..."}
                            className="p-4 text-lg border-2 border-stone-200 rounded-xl focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none bg-stone-50/50"
                          />
                          {(mode === 'extract' || mode === 'convert') && (
                            <label className="flex items-center gap-2 text-stone-700 cursor-pointer select-none bg-stone-100 p-3 rounded-xl border border-stone-200 w-fit">
                              <input
                                type="checkbox"
                                checked={showAllFacets}
                                onChange={(e) => setShowAllFacets(e.target.checked)}
                                className="w-5 h-5 rounded text-brand focus:ring-brand accent-brand"
                              />
                              <span className="font-bold text-sm">إظهار جميع الأوجه الممكنة (خيار متقدم)</span>
                            </label>
                          )}
                        </motion.div>
                      )}
                    </div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-stone-100 p-2 rounded-2xl border border-stone-200">
                      <div className="flex overflow-x-auto gap-2 snap-x hide-scrollbar pb-1">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMode('full')} className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${mode === 'full' ? 'bg-brand text-white shadow-md' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'}`}>
                          <AlignLeft size={18} /> <span className="font-bold">إعراب كامل</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMode('partial')} className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${mode === 'partial' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'}`}>
                          <TextCursor size={18} /> <span className="font-bold">إعراب محدد</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMode('sentence-position')} className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${mode === 'sentence-position' ? 'bg-amber-600 text-white shadow-md' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'}`}>
                          <MapPin size={18} /> <span className="font-bold">موقع الجمل</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMode('extract')} className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${mode === 'extract' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'}`}>
                          <Filter size={18} /> <span className="font-bold">استخراج</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMode('vocative')} className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${mode === 'vocative' ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'}`}>
                          <Megaphone size={18} /> <span className="font-bold">نوع المنادى</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMode('convert')} className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${mode === 'convert' ? 'bg-cyan-600 text-white shadow-md' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'}`}>
                          <RefreshCw size={18} /> <span className="font-bold">تحويل نحوي</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMode('notes')} className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${mode === 'notes' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'}`}>
                          <StickyNote size={18} /> <span className="font-bold">ملاحظات</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMode('compare')} className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${mode === 'compare' ? 'bg-pink-600 text-white shadow-md' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'}`}>
                          <AlignJustify size={18} /> <span className="font-bold">مقارنات</span>
                        </motion.button>
                      </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-col md:flex-row gap-4 mt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAnalyze}
                        disabled={!sentence && !image}
                        className={`flex-1 text-white text-xl font-bold px-5 py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg ${!sentence && !image ? 'bg-stone-300 cursor-not-allowed' : 'bg-brand hover:bg-brand-light hover:shadow-brand/30'}`}
                      >
                        <Search size={28} />
                        النتيجة
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleClear}
                        className="md:w-auto w-full bg-white text-red-600 border-2 border-red-100 hover:bg-red-50 hover:border-red-200 text-lg font-bold px-5 py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm"
                        title="مسح وبدء جديد"
                      >
                        <Trash2 size={24} />
                        مسح الكل
                      </motion.button>
                    </motion.div>

                    {errorMessage && (
                      <div className="p-4 bg-red-100 text-red-700 border border-red-300 rounded-xl flex items-center justify-between">
                        <span>{errorMessage}</span>
                      </div>
                    )}
                  </motion.div>
                ) : loading ? (
                  <motion.div key="loading" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center justify-center py-24 gap-6">
                    <Loader2 size={64} className="animate-spin text-brand" />
                    <h3 className="text-2xl font-bold text-stone-700">{loadingMessage}</h3>
                  </motion.div>
                ) : (
                  <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col gap-6">
                    <div className="flex flex-wrap justify-between items-center bg-stone-50 p-4 rounded-2xl border border-stone-200 gap-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setResult([])} 
                          className="flex items-center gap-2 bg-white text-stone-700 px-6 py-3 rounded-xl font-bold shadow-sm border border-stone-200 hover:bg-stone-100 transition-all hover:-translate-x-1"
                        >
                          <ArrowRight size={20} className="rotate-180" /> رجوع
                        </button>
                        <button 
                          onClick={handleClear} 
                          className="flex items-center gap-2 bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold shadow-sm border border-red-200 hover:bg-red-100 transition-all"
                        >
                          <Trash2 size={20} /> مسح الكل
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={handleSaveResult} 
                          disabled={isSaving}
                          className={`bg-white border border-stone-200 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-stone-50 font-bold shadow-sm ${saveSuccess ? 'text-green-600 border-green-200 bg-green-50' : ''}`}
                        >
                          {isSaving ? <Loader2 size={18} className="animate-spin" /> : saveSuccess ? <Check size={18} /> : <Save size={18} />}
                          {saveSuccess ? 'تم الحفظ' : 'حفظ النتيجة'}
                        </button>
                        <div className="flex bg-stone-200 p-1 rounded-xl">
                          <button
                            onClick={() => setDisplayMode('bubbles')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${displayMode === 'bubbles' ? 'bg-white text-brand shadow-sm font-bold' : 'text-stone-600 hover:text-stone-800'}`}
                          >
                            <MessageCircle size={18} /> فقاعات
                          </button>
                          <button
                            onClick={() => setDisplayMode('table')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${displayMode === 'table' ? 'bg-white text-brand shadow-sm font-bold' : 'text-stone-600 hover:text-stone-800'}`}
                          >
                            <Table size={18} /> جدول
                          </button>
                          <button
                            onClick={() => setDisplayMode('cards')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${displayMode === 'cards' ? 'bg-white text-brand shadow-sm font-bold' : 'text-stone-600 hover:text-stone-800'}`}
                          >
                            <LayoutGrid size={18} /> بطاقات
                          </button>
                          <button
                            onClick={() => setDisplayMode('separated')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${displayMode === 'separated' ? 'bg-white text-brand shadow-sm font-bold' : 'text-stone-600 hover:text-stone-800'}`}
                          >
                            <AlignJustify size={18} /> فواصل
                          </button>
                        </div>
                        <button onClick={handleCopy} className="bg-white border border-stone-200 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-stone-50 font-bold shadow-sm">
                          {copied ? <Check size={18} className="text-brand" /> : <Copy size={18} />}
                          {copied ? 'تم النسخ' : 'نسخ'}
                        </button>
                        <button onClick={handleShare} className="bg-white border border-stone-200 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-stone-50 font-bold shadow-sm">
                          <Share2 size={18} />
                          مشاركة
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-stone-200 p-2">
                      {displayMode === 'bubbles' ? (
                        <div className="flex flex-col gap-6 p-4">
                          {/* Top Box: Analyzed Sentence */}
                          <div className="bg-brand/5 border border-brand/10 rounded-2xl p-6 flex flex-col text-right shadow-sm">
                            <span className="text-brand/60 text-sm font-bold mb-3">الجملة المحللة</span>
                            <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-800 leading-relaxed">
                              {sentence}
                            </h2>
                          </div>

                          {/* Middle Section: Legend & Info */}
                          <div className="flex flex-wrap items-center justify-center gap-4" dir="rtl">
                            <div className="flex flex-wrap justify-center gap-2">
                              {Array.from(new Set(result.map(item => item.category))).filter(Boolean).map((category, idx) => (
                                <span key={idx} className={`px-4 py-1.5 rounded-full text-sm font-bold ${getCategoryStyles(category).badge}`}>
                                  {category}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 text-stone-500 text-sm">
                              <Info size={16} />
                              <span>اضغط على الكلمة للتفاصيل</span>
                            </div>
                          </div>

                          {/* Bottom Box: Word Bubbles */}
                          <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-sm flex flex-wrap justify-center gap-4" dir="rtl">
                            {result.map((item, index) => (
                              <div key={index} className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedBubble(selectedBubble === index ? null : index); }}>
                                <motion.div
                                  layout
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: index * 0.05 }}
                                  className={`px-6 py-3 rounded-xl font-bold font-serif transition-all hover:scale-105 ${getCategoryStyles(item.category).badge} ${selectedBubble === index ? 'ring-2 ring-brand ring-offset-2' : ''}`}
                                  style={{ fontSize: '1.5em' }}
                                >
                                  {colorizeDiacritics(item.word)}
                                </motion.div>
                                
                                {/* Popup */}
                                <AnimatePresence>
                                  {selectedBubble === index && (
                                    <motion.div 
                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-72 p-5 bg-white border border-stone-200 shadow-2xl rounded-2xl z-50 origin-bottom cursor-default"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex justify-between items-start mb-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getCategoryStyles(item.category).badge}`}>
                                          {item.category}
                                        </span>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); setSelectedBubble(null); }}
                                          className="text-stone-400 hover:text-stone-600 transition-colors p-1"
                                        >
                                          <X size={18} />
                                        </button>
                                      </div>
                                      
                                      <div className="text-center mb-4">
                                        <div className="text-2xl font-bold font-serif text-stone-800">
                                          {colorizeDiacritics(item.word)}
                                        </div>
                                      </div>
                                      
                                      <div className="text-stone-700 text-sm leading-relaxed text-center border-t border-stone-100 pt-4">
                                        {item.analysis.includes(':') && item.analysis.split(':')[0].trim().split(' ').length <= 2 
                                          ? item.analysis.split(':').slice(1).join(':').trim() 
                                          : item.analysis}
                                      </div>
                                      
                                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-stone-200 rotate-45"></div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : displayMode === 'cards' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                          {result.map((item, index) => (
                            <motion.div
                              layout
                              initial={{ opacity: 0, scale: 0.9, y: 20 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              key={index}
                              className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 hover:shadow-md transition-shadow flex flex-col gap-4"
                            >
                              <div className="flex justify-between items-start border-b border-stone-100 pb-4">
                                <span className={`font-bold font-serif ${getCategoryStyles(item.category).text}`} style={{ fontSize: '1.875em' }}>
                                  {colorizeDiacritics(item.word)}
                                </span>
                                <span className={`px-4 py-1.5 rounded-full border font-bold ${getCategoryStyles(item.category).badge}`} style={{ fontSize: '0.875em' }}>
                                  {item.category}
                                </span>
                              </div>
                              <div className="text-stone-800 leading-relaxed" style={{ fontSize: '1.25em' }}>
                                {item.analysis}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : displayMode === 'table' ? (
                        <table className="w-full border-collapse text-right">
                          <thead>
                            <tr className="bg-stone-50 text-stone-800 border-b border-stone-200">
                              <th className="p-4 font-bold" style={{ fontSize: '1.125em' }}>الكلمة</th>
                              <th className="p-4 font-bold" style={{ fontSize: '1.125em' }}>التصنيف</th>
                              <th className="p-4 font-bold" style={{ fontSize: '1.125em' }}>النتيجة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.map((item, index) => (
                              <motion.tr 
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                key={index} 
                                className={`border-b border-stone-100 last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}`}
                              >
                                <td className={`p-5 font-bold font-serif ${getCategoryStyles(item.category).text}`} style={{ fontSize: '1.5em' }}>
                                  {colorizeDiacritics(item.word)}
                                </td>
                                <td className="p-5 font-medium" style={{ fontSize: '1.125em' }}>
                                  <span className={`px-4 py-1.5 rounded-full border font-bold inline-block ${getCategoryStyles(item.category).badge}`} style={{ fontSize: '0.875em' }}>{item.category}</span>
                                </td>
                                <td className="p-5 text-stone-800 leading-relaxed" style={{ fontSize: '1.25em' }}>
                                  {item.analysis}
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="leading-[2.5] p-6" style={{ fontSize: '1.5em' }}>
                          {result.map((item, index) => (
                            <motion.span 
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.1 }}
                              key={index}
                              className="inline-block"
                            >
                              <span className={`font-bold font-serif ${getCategoryStyles(item.category).text}`}>
                                {colorizeDiacritics(item.word)}
                              </span>
                              <span className="text-stone-700"> ({item.analysis})</span>
                              {index < result.length - 1 && <span className="mx-3 text-stone-300 font-bold">| |</span>}
                            </motion.span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'rules' && (
              <motion.div key="rules" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ruleQuery}
                    onChange={(e) => setRuleQuery(e.target.value)}
                    placeholder="أدخل اسم القاعدة (مثال: كان وأخواتها)..."
                    className="flex-grow min-w-0 p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand outline-none font-serif text-lg"
                  />
                  <button
                    onClick={handleSearchRule}
                    disabled={ruleLoading}
                    className={`shrink-0 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md ${ruleLoading ? 'bg-stone-400 cursor-not-allowed' : 'bg-brand hover:bg-brand-light hover:shadow-brand/30'}`}
                  >
                    {ruleLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        <BookOpenText />
                        بحث
                      </>
                    )}
                  </button>
                </div>
                <AnimatePresence mode="wait">
                {ruleResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 bg-white rounded-xl border border-stone-200 text-stone-800 leading-relaxed whitespace-pre-line relative font-serif text-lg">
                    {colorizeDiacritics(ruleResult)}
                  </motion.div>
                )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'poetry' && (
              <motion.div key="poetry" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <textarea
                    value={poetryQuery}
                    onChange={(e) => setPoetryQuery(e.target.value)}
                    placeholder="أدخل البيت الشعري هنا (مثال: الخيل والليل والبيداء تعرفني...)"
                    className="flex-grow min-w-0 p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand outline-none resize-y min-h-[120px] font-serif text-lg"
                  />
                  <button
                    onClick={handlePoetryAnalyze}
                    disabled={poetryLoading}
                    className={`shrink-0 text-white px-6 py-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all shadow-md min-w-[120px] ${poetryLoading ? 'bg-stone-400 cursor-not-allowed' : 'bg-brand hover:bg-brand-light hover:shadow-brand/30'}`}
                  >
                    {poetryLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        <BookOpenText />
                        تحليل
                      </>
                    )}
                  </button>
                </div>
                <AnimatePresence mode="wait">
                {poetryResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 bg-white rounded-xl border border-stone-200 text-stone-800 leading-relaxed whitespace-pre-line relative font-serif text-lg">
                    {colorizeDiacritics(poetryResult)}
                  </motion.div>
                )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'spelling' && (
              <motion.div key="spelling" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <textarea
                    value={spellingQuery}
                    onChange={(e) => setSpellingQuery(e.target.value)}
                    placeholder="أدخل النص هنا لمراجعته إملائياً وتصحيحه..."
                    className="flex-grow min-w-0 p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand outline-none resize-y min-h-[120px] font-serif text-lg"
                  />
                  <div className="flex flex-col gap-2 shrink-0 min-w-[120px]">
                    <button
                      onClick={handleSpellingAnalyze}
                      disabled={spellingLoading}
                      className={`text-white flex-grow px-6 py-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all shadow-md ${spellingLoading ? 'bg-stone-400 cursor-not-allowed' : 'bg-brand hover:bg-brand-light hover:shadow-brand/30'}`}
                    >
                      {spellingLoading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <>
                          <BookOpenText />
                          تصحيح
                        </>
                      )}
                    </button>
                    {(spellingQuery || spellingResult) && (
                      <button
                        onClick={() => { setSpellingQuery(''); setSpellingResult(null); }}
                        className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                      >
                        <Trash2 size={18} />
                        مسح
                      </button>
                    )}
                  </div>
                </div>
                <AnimatePresence mode="wait">
                {spellingResult && renderSpellingResult()}
                </AnimatePresence>
              </motion.div>
            )}
            {activeTab === 'saved' && (
              <motion.div key="saved" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                    <Save className="text-brand" />
                    النتائج المحفوظة
                  </h2>
                  <button 
                    onClick={() => auth.currentUser && fetchSavedResults(auth.currentUser.uid)}
                    className="p-2 text-stone-500 hover:text-brand bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
                    title="تحديث"
                  >
                    <RefreshCw size={20} className={loadingSaved ? "animate-spin" : ""} />
                  </button>
                </div>

                {!auth.currentUser ? (
                  <div className="text-center py-12 bg-stone-50 rounded-2xl border border-stone-200">
                    <Save size={48} className="mx-auto text-stone-300 mb-4" />
                    <p className="text-stone-600 mb-4 text-lg">يجب تسجيل الدخول لحفظ وعرض نتائجك</p>
                    <button 
                      onClick={() => signInWithPopup(auth, googleProvider)}
                      className="bg-brand text-white px-6 py-2 rounded-xl font-bold hover:bg-brand-light transition-colors"
                    >
                      تسجيل الدخول
                    </button>
                  </div>
                ) : loadingSaved ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={40} className="animate-spin text-brand" />
                  </div>
                ) : savedResults.length === 0 ? (
                  <div className="text-center py-12 bg-stone-50 rounded-2xl border border-stone-200">
                    <BookOpenText size={48} className="mx-auto text-stone-300 mb-4" />
                    <p className="text-stone-600 text-lg">لا توجد نتائج محفوظة بعد</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {savedResults.map((item) => (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-4"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="bg-brand/10 text-brand px-3 py-1 rounded-lg text-sm font-bold">
                              {item.mode === 'full' ? 'إعراب كامل' : 
                               item.mode === 'partial' ? 'إعراب محدد' : 
                               item.mode === 'extract' ? 'استخراج' : 
                               item.mode === 'convert' ? 'تحويل' : 
                               item.mode === 'notes' ? 'ملاحظات' : 
                               item.mode === 'compare' ? 'مقارنة' : 
                               item.mode === 'sentence-position' ? 'موقع الجمل' : 
                               item.mode === 'vocative' ? 'منادى' : item.mode}
                            </span>
                            <span className="text-stone-400 text-sm">
                              {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString('ar-EG') : ''}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleDeleteSaved(item.id)}
                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        
                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 font-serif text-lg">
                          {item.sentence}
                        </div>
                        
                        {item.targetWords && (
                          <div className="text-sm text-stone-500">
                            <span className="font-bold">الكلمات المستهدفة:</span> {item.targetWords}
                          </div>
                        )}
                        
                        <div className="mt-2">
                          <button 
                            onClick={() => {
                              try {
                                const parsedResult = JSON.parse(item.result);
                                setResult(parsedResult);
                                setSentence(item.sentence);
                                setMode(item.mode);
                                setTargetWords(item.targetWords || '');
                                setActiveTab('parser');
                              } catch (e) {
                                console.error("Error parsing saved result", e);
                              }
                            }}
                            className="text-brand hover:text-brand-light font-bold flex items-center gap-1"
                          >
                            عرض النتيجة <ArrowRight size={16} className="rotate-180" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
          </motion.div>
        </div>
      )}
    </ErrorBoundary>
  );
}
