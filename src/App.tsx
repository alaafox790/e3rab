/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, BookOpenText, Camera, Share2, Copy, Check, ArrowRight, Mic, MicOff, AlignLeft, TextCursor, MapPin, Filter, Megaphone, RefreshCw, Trash2, Table, AlignJustify, StickyNote, Key, Lock, LayoutGrid, Feather, ScrollText, Clock, Save, Bookmark, MessageCircle, Info, X, LogOut, Sparkles, Moon, ChevronDown, List } from 'lucide-react';
import { analyzeSentence, searchGrammarRule, analyzePoetry, analyzeSpelling, generateDictation } from './services/geminiService';
import { AnalyzedWord, SpellingResult } from './types';
import Markdown from 'react-markdown';
import { db, auth, googleProvider } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
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
        <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-4" dir="rtl">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg text-center border border-emerald-100">
            <h2 className="text-2xl font-bold text-red-600 mb-4">عذراً، حدث خطأ غير متوقع!</h2>
            <p className="text-stone-600 mb-6">واجه التطبيق مشكلة أثناء عرض البيانات. يرجى تحديث الصفحة والمحاولة مرة أخرى.</p>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.reload()} 
              className="bg-brand text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-light"
            >
              تحديث الصفحة
            </motion.button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const getCategoryStyles = (category: string) => {
  if (!category) return { text: 'text-stone-600', badge: 'bg-stone-50 text-stone-600 border-stone-200', bg: 'bg-stone-50/30', border: 'border-stone-200' };
  
  if (category.includes('فعل')) {
    return {
      text: 'text-red-600',
      badge: 'bg-red-50 text-red-600 border-red-200',
      bg: 'bg-red-50/30',
      border: 'border-red-100 hover:border-red-300'
    };
  }
  if (category.includes('حرف')) {
    return {
      text: 'text-purple-600',
      badge: 'bg-purple-50 text-purple-600 border-purple-200',
      bg: 'bg-purple-50/30',
      border: 'border-purple-100 hover:border-purple-300'
    };
  }
  if (category.includes('ضمير')) {
    return {
      text: 'text-amber-600',
      badge: 'bg-amber-50 text-amber-600 border-amber-200',
      bg: 'bg-amber-50/30',
      border: 'border-amber-100 hover:border-amber-300'
    };
  }
  if (category.includes('مرفوع') || category.includes('مبتدأ') || category.includes('فاعل')) {
    return {
      text: 'text-emerald-600',
      badge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      bg: 'bg-emerald-50/30',
      border: 'border-emerald-100 hover:border-emerald-300'
    };
  }
  if (category.includes('منصوب') || category.includes('مفعول')) {
    return {
      text: 'text-orange-600',
      badge: 'bg-orange-50 text-orange-600 border-orange-200',
      bg: 'bg-orange-50/30',
      border: 'border-orange-100 hover:border-orange-300'
    };
  }
  if (category.includes('مجرور') || category.includes('مضاف')) {
    return {
      text: 'text-cyan-600',
      badge: 'bg-cyan-50 text-cyan-600 border-cyan-200',
      bg: 'bg-cyan-50/30',
      border: 'border-cyan-100 hover:border-cyan-300'
    };
  }
  if (category.includes('اسم') || category.includes('خبر') || category.includes('منادى')) {
    return {
      text: 'text-blue-600',
      badge: 'bg-blue-50 text-blue-600 border-blue-200',
      bg: 'bg-blue-50/30',
      border: 'border-blue-100 hover:border-blue-300'
    };
  }
  return {
    text: 'text-stone-600',
    badge: 'bg-stone-50 text-stone-600 border-stone-200',
    bg: 'bg-stone-50/30',
    border: 'border-stone-100 hover:border-stone-300'
  };
};

const colorizeDiacritics = (text: string) => {
  if (!text) return text;
  // Diacritics (Short vowels)
  const diacriticsRegex = /([\u064B-\u0652])/g;
  
  const parts = text.split(diacriticsRegex);
  return parts.map((part, index) => {
    if (part.match(diacriticsRegex)) {
      return <span key={index} className="text-red-500 font-bold">{part}</span>;
    }
    return part;
  });
};

const grammaticalTerms: Record<string, string> = {
  'فاعل': 'اسم مرفوع يدل على من قام بالفعل',
  'مفعول به': 'اسم منصوب وقع عليه فعل الفاعل',
  'مبتدأ': 'اسم مرفوع تبدأ به الجملة الاسمية',
  'خبر': 'ما يكمل معنى المبتدأ ويتمم الفائدة',
  'مضاف إليه': 'اسم مجرور ينسب إلى اسم قبله ليعرفه أو يخصصه',
  'نعت': 'تابع يذكر لبيان صفة في متبوعه',
  'صفة': 'تابع يذكر لبيان صفة في متبوعه',
  'حال': 'اسم منصوب يبين هيئة الفاعل أو المفعول به عند وقوع الفعل',
  'تمييز': 'اسم نكرة منصوب يزيل الإبهام عن كلمة أو جملة قبله',
  'ظرف زمان': 'اسم منصوب يدل على زمان وقوع الفعل',
  'ظرف مكان': 'اسم منصوب يدل على مكان وقوع الفعل',
  'فعل ماض': 'فعل يدل على حدث وقع في الزمن الماضي',
  'فعل مضارع': 'فعل يدل على حدث يقع في الزمن الحاضر أو المستقبل',
  'فعل أمر': 'فعل يطلب به حدوث شيء في المستقبل',
  'حرف جر': 'حرف يجر الاسم الذي بعده',
  'اسم مجرور': 'الاسم الذي يقع بعد حرف الجر',
  'توكيد': 'تابع يذكر لتقوية المعنى وتأكيده',
  'بدل': 'تابع يمهد له بذكر المتبوع قبله',
  'اسم إن': 'اسم منصوب يقع بعد إن أو إحدى أخواتها',
  'خبر إن': 'اسم مرفوع يكمل معنى اسم إن',
  'اسم كان': 'اسم مرفوع يقع بعد كان أو إحدى أخواتها',
  'خبر كان': 'اسم منصوب يكمل معنى اسم كان'
};

const AnalysisText = ({ text }: { text: string }) => {
  if (!text) return null;

  const terms = Object.keys(grammaticalTerms).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`(${terms.join('|')})`, 'g');

  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        if (grammaticalTerms[part]) {
          return (
            <span key={index} className="relative group inline-block cursor-help border-b-2 border-dotted border-emerald-400/50 hover:text-emerald-600 transition-colors">
              {colorizeDiacritics(part)}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-emerald-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center shadow-lg font-sans font-normal leading-relaxed">
                {grammaticalTerms[part]}
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-emerald-800"></span>
              </span>
            </span>
          );
        }
        return <span key={index}>{colorizeDiacritics(part)}</span>;
      })}
    </>
  );
};

function Splash({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, []); // Empty dependency array prevents timer reset on re-renders

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col items-center justify-center p-6 bg-brand overflow-hidden"
      dir="rtl"
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
            animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity }}
            className="text-6xl md:text-7xl font-bold text-white font-ruqaa inline-block"
          >
            ض
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
            لغة
          </motion.span>
          <span>الضاد</span>
        </motion.h1>
        
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-white/90 text-lg md:text-xl font-medium text-center drop-shadow-md mb-2"
        >
          إعداد وتصميم أ/ علاء الوكيل
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="text-white text-center mb-8 bg-white/10 px-8 py-4 rounded-3xl backdrop-blur-sm border border-white/20 shadow-xl"
        >
          <p className="text-sm opacity-80 mb-1">إهداء خاص إلى الموجه الأول</p>
          <p className="text-2xl font-bold mb-1">الأستاذة هالة بلال</p>
          <p className="text-xs opacity-70">موجه أول اللغة العربية - إدارة سوهاج التعليمية</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.8 }}
          className="flex gap-3 mt-8"
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
  "جاري صياغة الإعراب التفصيلي... ✍️",
  "جاري رفع الصورة... 🖼️",
  "نضع اللمسات الأخيرة... ✨"
];

interface AccessCode {
  code: string;
  expiresAt: number;
}

const generateRandomCode = () => Math.floor(10000 + Math.random() * 90000).toString();

function LoginScreen({ onLogin }: { onLogin: (isTrial: boolean) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validCodes, setValidCodes] = useState<AccessCode[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'access'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.codes && data.codes.length > 0 && typeof data.codes[0] === 'string') {
          setValidCodes(data.codes.map((c: string) => ({ code: c, expiresAt: Date.now() + 60 * 60 * 1000 })));
        } else {
          setValidCodes(data.codes || []);
        }
      } else {
        // Initialize if not exists
        const initialCode = generateRandomCode();
        setDoc(doc(db, 'settings', 'access'), { codes: [{ code: initialCode, expiresAt: Date.now() + 60 * 60 * 1000 }] });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGenerateNewCode = async () => {
    const newCode = generateRandomCode();
    const activeCodes = validCodes.filter(c => c.expiresAt > Date.now());
    const newCodes = [{ code: newCode, expiresAt: Date.now() + 60 * 60 * 1000 }, ...activeCodes];
    await setDoc(doc(db, 'settings', 'access'), { codes: newCodes });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericCode = parseInt(code, 10);
    
    if (code === '2020') {
      setShowAdmin(true);
      setError(false);
    } else if (code === '555') {
      onLogin(false);
    } else if (numericCode >= 100 && numericCode <= 120 && code === numericCode.toString()) {
      onLogin(true); // Permanent access for codes 100-120
    } else if (validCodes.some(c => c.code === code && c.expiresAt > Date.now())) {
      onLogin(true); // 1-hour access for valid generated codes
    } else {
      setError(true);
      setCode('');
    }
  };

  if (showAdmin) {
    return (
      <div className="min-h-screen bg-[#064e3b] flex items-center justify-center p-4 font-sans" dir="rtl">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#065f46] p-8 rounded-3xl shadow-xl w-full max-w-md border border-emerald-400/30 text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-6">لوحة الإدارة - توليد الأكواد</h2>
          <p className="text-emerald-200/70 mb-4">أحدث كود دخول صالح هو:</p>
          <div className="bg-emerald-800/30 border-2 border-emerald-500/50 rounded-2xl p-6 mb-4">
            <span className="text-5xl font-bold text-emerald-300 tracking-widest">{validCodes[0]?.code || '...'}</span>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerateNewCode}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all text-lg mb-6 shadow-md"
          >
            توليد كود جديد
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onLogin(false)}
            className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all text-lg mb-4"
          >
            الدخول للتطبيق كمسؤول
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setShowAdmin(false); setCode(''); }}
            className="w-full bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold py-4 rounded-2xl transition-all text-lg"
          >
            العودة لتسجيل الدخول
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#064e3b] flex items-center justify-center p-4 font-sans relative overflow-hidden" dir="rtl">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none"></div>

      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#065f46] p-6 md:p-8 rounded-[2rem] shadow-2xl w-full max-w-[400px] border border-emerald-400/20 relative z-10"
      >
        <div className="flex flex-col items-center mb-4">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 rounded-full border border-emerald-700/50 flex items-center justify-center mb-4 bg-emerald-900/20"
          >
            <span className="text-4xl font-bold text-emerald-400 font-ruqaa">ع</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-white font-sans text-center mb-1">
            معرب الجمل العربية
          </h1>
          <p className="text-emerald-300 text-center text-sm font-medium mb-1">
            المحلل النحوي الذكي
          </p>
          <p className="text-emerald-200 text-center text-xs font-medium mb-1 opacity-80">
            اعداد أ/علاء الوكيل - معلم خبير
          </p>
          <div className="mt-4 mb-6 px-6 py-4 bg-emerald-800/40 rounded-2xl border border-emerald-400/30 text-center shadow-lg">
            <p className="text-emerald-100 font-serif leading-relaxed">
              <span className="text-sm block mb-1 opacity-90">إهداء خاص إلى الموجه الأول</span>
              <span className="font-bold text-emerald-300 text-xl block mb-1">الأستاذة هالة بلال</span>
              <span className="text-xs block opacity-80">موجه أول اللغة العربية - إدارة سوهاج التعليمية</span>
            </p>
          </div>


        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-emerald-300 text-sm font-bold px-1">اكتب كود الدخول</label>
            <div className={`relative flex items-center bg-white rounded-2xl overflow-hidden transition-all ${error ? 'ring-2 ring-red-500' : 'focus-within:ring-2 focus-within:ring-emerald-400'}`}>
              <div className="px-4 text-emerald-500">
                <Lock size={20} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(false);
                }}
                className="flex-1 py-3 bg-transparent outline-none text-stone-800 text-lg font-medium tracking-widest"
                dir="ltr"
                placeholder="•••••"
                maxLength={5}
                autoFocus
              />
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="px-4 text-emerald-500 hover:text-emerald-700 transition-colors"
              >
                <Feather size={20} className={showPassword ? "opacity-100" : "opacity-50"} />
              </motion.button>
            </div>
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-xs mt-1 px-1 font-bold"
              >
                الكود خطا اتصل بالدعم الفنى
              </motion.p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold py-3 rounded-2xl transition-all text-lg flex items-center justify-center gap-2"
          >
            دخول <Feather size={20} className="rotate-45" />
          </motion.button>
        </form>

        <div className="mt-6 text-center">
          <a 
            href="https://wa.me/201030302005" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-emerald-100 hover:text-white font-medium transition-colors bg-white/10 px-4 py-2 rounded-full text-sm border border-white/10 backdrop-blur-sm"
          >
            <MessageCircle size={16} />
            الدعم الفنى
          </a>
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
  const [mode, setMode] = useState<'full' | 'partial' | 'sentence-position' | 'extract' | 'vocative' | 'convert' | 'notes' | 'compare' | 'detailed'>('full');
  const [displayMode, setDisplayMode] = useState<'table' | 'separated' | 'cards' | 'bubbles' | 'accordion'>('cards');
  const [expandedAccordion, setExpandedAccordion] = useState<number | null>(null);
  const [showDisplayModes, setShowDisplayModes] = useState(false);
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
  const [isChallengeMode, setIsChallengeMode] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'parser' | 'rules' | 'poetry' | 'spelling' | 'saved'>('parser');
  const [showModeBubbles, setShowModeBubbles] = useState(false);
  const [ruleQuery, setRuleQuery] = useState('');
  const [ruleResult, setRuleResult] = useState('');
  const [ruleLoading, setRuleLoading] = useState(false);
  const [poetryQuery, setPoetryQuery] = useState('');
  const [poetryResult, setPoetryResult] = useState('');
  const [poetryLoading, setPoetryLoading] = useState(false);
  const [spellingQuery, setSpellingQuery] = useState('');
  const [spellingResult, setSpellingResult] = useState<SpellingResult | null>(null);
  const [dictationResult, setDictationResult] = useState<string | null>(null);
  const [spellingLoading, setSpellingLoading] = useState(false);
  const [spellingMode, setSpellingMode] = useState<'analyze' | 'dictation'>('analyze');
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
    setDisplayMode('cards');
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
    setResult([]); // Clear previous result to show loading indicator initially
    setDisplayMode('cards');
    
    try {
      const base64Image = image ? image.split(',')[1] : undefined;
      
      let analysis = await analyzeSentence(
        sentence, 
        mode, 
        targetWords, 
        base64Image, 
        showAllFacets,
        (chunk) => {
          // Update result incrementally
          const validChunk = chunk.filter(item => item && typeof item === 'object' && item.word);
          if (validChunk.length > 0) {
            setResult(validChunk);
          }
        }
      );
      
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

  const renderRuleWithInteractiveExamples = (text: string) => {
    if (!text) return null;
    const parts = text.split(/<example>(.*?)<\/example>/gs);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is an example
        return (
          <motion.button
            key={index}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSentence(part.trim());
              setActiveTab('parser');
              setMode('full');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-block bg-brand/10 text-brand px-3 py-1 rounded-lg font-bold mx-1 my-1 hover:bg-brand hover:text-white transition-colors cursor-pointer border border-brand/20 shadow-sm"
            title="انقر لإعراب هذا المثال"
          >
            {colorizeDiacritics(part)}
          </motion.button>
        );
      }
      return <span key={index}>{colorizeDiacritics(part)}</span>;
    });
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
      if (spellingMode === 'analyze') {
        const result = await analyzeSpelling(spellingQuery);
        setSpellingResult(result);
        setDictationResult(null);
      } else {
        const result = await generateDictation(spellingQuery);
        setDictationResult(result);
        setSpellingResult(null);
      }
    } catch (error) {
      console.error(error);
      if (spellingMode === 'analyze') {
        setSpellingResult({
          correctedText: 'حدث خطأ أثناء مراجعة الإملاء.',
          corrections: []
        });
      } else {
        setDictationResult('حدث خطأ أثناء إنشاء قطعة الإملاء.');
      }
    } finally {
      setSpellingLoading(false);
    }
  };

  const renderSpellingResult = () => {
    if (!spellingResult) return null;

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
        <div className="w-full overflow-hidden">
          <div className="flex bg-stone-100 p-1 rounded-xl overflow-x-auto hide-scrollbar w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setDisplayMode('table')} className={`shrink-0 flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-lg transition-all ${displayMode === 'table' ? 'bg-white shadow-sm text-brand font-bold' : 'text-stone-500 hover:text-stone-700'}`}>
              <Table size={18} /> جدول
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setDisplayMode('separated')} className={`shrink-0 flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-lg transition-all ${displayMode === 'separated' ? 'bg-white shadow-sm text-brand font-bold' : 'text-stone-500 hover:text-stone-700'}`}>
              <AlignJustify size={18} /> مفصل
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setDisplayMode('cards')} className={`shrink-0 flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-lg transition-all ${displayMode === 'cards' ? 'bg-white shadow-sm text-brand font-bold' : 'text-stone-500 hover:text-stone-700'}`}>
              <LayoutGrid size={18} /> بطاقات
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setDisplayMode('accordion')} className={`shrink-0 flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-lg transition-all ${displayMode === 'accordion' ? 'bg-white shadow-sm text-brand font-bold' : 'text-stone-500 hover:text-stone-700'}`}>
              <List size={18} /> طي
            </motion.button>
          </div>
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

            {displayMode === 'accordion' && (
              <div className="flex flex-col gap-3">
                {spellingResult.corrections.map((correction, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                    <button
                      onClick={() => setExpandedAccordion(expandedAccordion === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-4 bg-white hover:bg-stone-50 transition-colors text-right"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-red-500 line-through decoration-red-300 font-bold">{correction.original}</span>
                        <ArrowRight className="text-stone-400" size={16} />
                        <span className="text-green-600 font-bold">{correction.corrected}</span>
                      </div>
                      <ChevronDown size={20} className={`text-stone-400 transition-transform duration-300 ${expandedAccordion === idx ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {expandedAccordion === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 pt-0 border-t border-stone-100 bg-stone-50/50">
                            <div className="prose prose-stone prose-sm max-w-none mt-4">
                              <Markdown>
                                {correction.reason}
                              </Markdown>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
        <div className="h-screen overflow-hidden bg-[#f0f9f6] font-sans relative flex flex-col md:flex-row" dir="rtl" style={{ fontSize: `${fontSize}px` }}>
          {/* Top Banner for Timer */}
          {isTrial && timeLeft !== null && (
            <div className="w-full bg-red-600 text-white py-3 px-4 shadow-md z-30 relative flex justify-center items-center gap-3 md:fixed md:top-0 md:left-0 md:right-0">
              <Clock size={20} className="animate-pulse" />
              <span className="font-bold text-lg">الوقت المتبقي لجلستك:</span>
              <span className="font-mono text-xl tracking-widest font-bold bg-white/20 px-3 py-1 rounded-lg" dir="ltr">
                {formatTime(timeLeft)}
              </span>
            </div>
          )}

          {/* Sidebar */}
          <aside className={`w-full md:w-[340px] bg-[#f8fdfc] border-b md:border-b-0 md:border-l border-emerald-100 flex flex-col z-20 shrink-0 shadow-sm relative ${isTrial ? 'md:mt-14' : ''}`}>
            <div className="p-4 md:p-6 border-b border-emerald-50 flex flex-col xl:flex-row items-center xl:items-start justify-between gap-4 text-center xl:text-right relative">
              <div className="absolute top-4 left-4 z-50">
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.9 }} 
                  onClick={handleLogout} 
                  className="bg-white hover:bg-red-50 text-emerald-500 hover:text-red-600 p-2 rounded-full transition-colors shadow-sm border border-emerald-100 flex items-center justify-center" 
                  title="تسجيل الخروج"
                >
                  <LogOut size={16} />
                </motion.button>
              </div>
              <div className="flex items-center gap-3 md:gap-4">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shadow-sm shrink-0"
                >
                  <span className="text-xl md:text-2xl font-bold text-brand font-ruqaa">ع</span>
                </motion.div>
                <div className="flex flex-col items-start">
                  <h1 className="text-xl md:text-2xl font-bold text-emerald-800 font-ruqaa whitespace-nowrap">
                    معرب الجمل
                  </h1>
                  <span className="text-[10px] md:text-xs font-medium text-emerald-600 mt-1 whitespace-nowrap">
                    علاء الوكيل
                  </span>
                </div>
              </div>
              
              <div className="text-[10px] md:text-xs text-emerald-400 font-serif leading-relaxed opacity-80 italic whitespace-nowrap hidden md:block">
                أنا البحرُ في أحشائِهِ الدُّرُّ كامنٌ<br/>
                فهل سألوا الغوّاصَ عن صدفاتي؟
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 flex flex-row md:flex-col gap-2 overflow-x-auto hide-scrollbar">
              {[
                { id: 'parser', label: 'إعرب', icon: <AlignLeft size={20} /> },
                { id: 'rules', label: 'البحث عن قاعدة', icon: <Search size={20} /> },
                { id: 'poetry', label: 'أبيات شعرية', icon: <Feather size={20} /> },
                { id: 'spelling', label: 'الإملاء الدقيق', icon: <Check size={20} /> },
                { id: 'saved', label: 'المحفوظات', icon: <Bookmark size={20} /> }
              ].map((tab) => (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap shadow-sm ${
                    activeTab === tab.id 
                      ? 'bg-brand text-white shadow-brand/20 border border-transparent' 
                      : 'bg-white text-emerald-700 border border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </motion.button>
              ))}
            </nav>

            <div className="p-4 border-t border-emerald-50 flex flex-col gap-3">
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setFontSize(s => Math.min(s + 2, 24))} className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded-lg transition-colors shadow-sm flex justify-center items-center text-sm font-bold" title="تكبير الخط">+</motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setFontSize(s => Math.max(s - 2, 12))} className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded-lg transition-colors shadow-sm flex justify-center items-center text-sm font-bold" title="تصغير الخط">-</motion.button>
              </div>
              
              <div className="mt-2 pt-3 border-t border-emerald-100/50">
                <div className="text-[10px] text-emerald-400 font-serif text-center leading-relaxed">
                  إهداء خاص إلى الموجه الأول<br/>
                  <span className="font-bold text-emerald-600">الأستاذة هالة بلال</span><br/>
                  موجه أول اللغة العربية - إدارة سوهاج التعليمية
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className={`flex-1 overflow-y-auto relative flex flex-col ${isTrial ? 'md:mt-14' : ''}`}>
            {/* Subtle background pattern/gradient for main app */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-emerald-100/30 to-transparent pointer-events-none"></div>
            
            <div className="p-4 md:p-8 flex-1 flex flex-col">
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto w-full bg-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col flex-1 border border-emerald-100 relative z-10"
              >

            {activeTab === 'parser' && (
              <div className="fixed bottom-8 right-8 left-8 z-50 flex flex-row items-center justify-start gap-4 pointer-events-none">
                <div className="pointer-events-auto shrink-0 relative">
                  {/* Pulsing ring behind the button */}
                  {!showModeBubbles && (
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 bg-brand rounded-full z-0"
                    />
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowModeBubbles(!showModeBubbles)}
                    className="w-16 h-16 bg-brand text-white rounded-full shadow-2xl flex items-center justify-center transition-transform relative z-10"
                  >
                    {showModeBubbles ? <X size={28} /> : <LayoutGrid size={28} />}
                  </motion.button>
                </div>
                
                <AnimatePresence>
                  {showModeBubbles && (
                    <div className="flex flex-row gap-3 items-center overflow-x-auto hide-scrollbar py-4 px-2 pointer-events-auto max-w-full">
                      {[
                        { id: 'full', label: 'إعراب كامل', icon: <AlignLeft size={20} />, color: 'bg-brand' },
                        { id: 'partial', label: 'إعراب محدد', icon: <TextCursor size={20} />, color: 'bg-blue-600' },
                        { id: 'sentence-position', label: 'موقع الجمل', icon: <MapPin size={20} />, color: 'bg-amber-600' },
                        { id: 'extract', label: 'استخراج', icon: <Filter size={20} />, color: 'bg-purple-600' },
                        { id: 'vocative', label: 'نوع المنادى', icon: <Megaphone size={20} />, color: 'bg-rose-600' },
                        { id: 'convert', label: 'تحويل نحوي', icon: <RefreshCw size={20} />, color: 'bg-cyan-600' },
                        { id: 'notes', label: 'ملاحظات', icon: <StickyNote size={20} />, color: 'bg-indigo-600' },
                        { id: 'compare', label: 'مقارنات', icon: <AlignJustify size={20} />, color: 'bg-pink-600' },
                        { id: 'detailed', label: 'التفصيلي جداً', icon: <Sparkles size={20} />, color: 'bg-amber-700' }
                      ].map((m, index) => (
                        <motion.button
                          key={m.id}
                          initial={{ opacity: 0, x: 50, scale: 0.8 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 50, scale: 0.8 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => {
                            setMode(m.id as any);
                            if (m.id === 'detailed') {
                              setShowAllFacets(true);
                            }
                            setShowModeBubbles(false);
                          }}
                          className={`shrink-0 flex items-center gap-3 px-5 py-3 rounded-full shadow-lg transition-colors whitespace-nowrap border ${mode === m.id ? `${m.color} text-white border-transparent` : 'bg-white text-stone-700 hover:bg-stone-50 border-stone-200'}`}
                        >
                          <span className="font-bold">{m.label}</span>
                          {m.icon}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}
            
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
                          className="w-full min-h-[150px] text-xl md:text-2xl leading-relaxed p-6 pb-16 border-2 border-stone-200 rounded-2xl focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none resize-y shadow-inner bg-stone-50/50 font-serif"
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
                            placeholder={mode === 'compare' ? "أدخل الجملة الثانية للمقارنة..." : mode === 'extract' ? "ما الذي تريد استخراجه؟ (مثال: اسم فاعل، صيغة مبالغة، ممنوع من الصرف...)" : mode === 'convert' ? "مثال: حول الجملة الاسمية إلى فعلية، أو حول الحال المفرد إلى جملة..." : mode === 'notes' ? "أي ملاحظات محددة تبحث عنها؟ (اختياري)" : "أدخل الكلمات المراد البحث عنها (مفصولة بفاصلة)..."}
                            className="p-4 text-lg border-2 border-stone-200 rounded-xl focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none bg-stone-50/50"
                          />
                          
                          {mode === 'extract' && (
                            <div className="bg-stone-100 p-4 rounded-xl border border-stone-200">
                              <p className="font-bold text-stone-700 mb-3 text-sm flex items-center gap-2">
                                <Sparkles size={16} className="text-brand" /> خيارات الاستخراج الشائعة:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {["اسم فاعل", "اسم مفعول", "صيغة مبالغة", "ممنوع من الصرف", "فعل مضارع مجزوم", "نعت", "بدل", "توكيد", "حال", "تمييز"].map(opt => (
                                  <button
                                    key={opt}
                                    onClick={() => {
                                      const current = targetWords.split(/[،,]/).map(w => w.trim()).filter(Boolean);
                                      if (current.includes(opt)) {
                                        setTargetWords(current.filter(w => w !== opt).join('، '));
                                      } else {
                                        setTargetWords([...current, opt].join('، '));
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${targetWords.includes(opt) ? 'bg-brand text-white border-brand' : 'bg-white text-stone-600 border-stone-200 hover:border-brand/50 hover:bg-brand/5'}`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {mode === 'convert' && (
                            <div className="bg-stone-100 p-4 rounded-xl border border-stone-200">
                              <p className="font-bold text-stone-700 mb-3 text-sm flex items-center gap-2">
                                <Sparkles size={16} className="text-brand" /> خيارات التحويل الشائعة:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {["المفرد إلى مثنى", "المفرد إلى جمع", "المذكر إلى مؤنث", "الجملة الاسمية إلى فعلية", "الجملة الفعلية إلى اسمية", "المبني للمعلوم إلى مبني للمجهول", "الحال المفرد إلى جملة"].map(opt => (
                                  <button
                                    key={opt}
                                    onClick={() => {
                                      const current = targetWords.split(/[،,]/).map(w => w.trim()).filter(Boolean);
                                      if (current.includes(opt)) {
                                        setTargetWords(current.filter(w => w !== opt).join('، '));
                                      } else {
                                        setTargetWords([...current, opt].join('، '));
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${targetWords.includes(opt) ? 'bg-brand text-white border-brand' : 'bg-white text-stone-600 border-stone-200 hover:border-brand/50 hover:bg-brand/5'}`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

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

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-row gap-4 mt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAnalyze}
                        disabled={!sentence && !image}
                        className={`flex-1 text-white text-xl font-bold px-5 py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg ${!sentence && !image ? 'bg-stone-300 cursor-not-allowed' : 'bg-brand hover:bg-brand-light hover:shadow-brand/30'}`}
                      >
                        <Search size={28} />
                        إعرب
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleClear}
                        className="w-auto bg-white text-red-600 border-2 border-red-100 hover:bg-red-50 hover:border-red-200 text-lg font-bold px-5 py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm"
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
                ) : loading && result.length === 0 ? (
                  <motion.div key="loading" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center justify-center py-24 gap-8">
                    <div className="relative flex items-center justify-center w-32 h-32">
                      {/* Rotating dashed border */}
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full border-2 border-dashed border-teal-400/60"
                      />
                      {/* Inner solid circle with gradient */}
                      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-teal-100 to-teal-200/50 flex items-center justify-center shadow-inner border border-teal-200/50">
                        <Sparkles size={40} className="text-teal-700" strokeWidth={1.5} />
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center gap-4">
                      <h3 className="text-2xl font-bold text-teal-700">{loadingMessage}</h3>
                      
                      {/* Loading dots */}
                      <div className="flex gap-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ 
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{ 
                              duration: 1.5, 
                              repeat: Infinity, 
                              delay: i * 0.2,
                              ease: "easeInOut"
                            }}
                            className="w-3 h-3 rounded-full bg-teal-600"
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col gap-6">
                    {/* Analyzed Sentence Box */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-brand/5 border border-brand/10 rounded-2xl p-6 flex flex-col text-right shadow-sm mt-4 mx-2 md:mx-6"
                      dir="rtl"
                    >
                      <span className="text-brand/60 text-sm font-bold mb-3">الجملة المحللة</span>
                      <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-800 leading-relaxed">
                        {sentence}
                      </h2>
                    </motion.div>

                    <div className="flex flex-col gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                      <div className="flex flex-wrap justify-between items-center gap-4">
                        <div className="flex gap-2">
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setResult([])} 
                            disabled={loading}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-sm border transition-all ${loading ? 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 hover:-translate-x-1'}`}
                          >
                            <ArrowRight size={20} className="rotate-180" /> رجوع
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleClear} 
                            disabled={loading}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-sm border transition-all ${loading ? 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}
                          >
                            <Trash2 size={20} /> مسح الكل
                          </motion.button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsChallengeMode(!isChallengeMode)} 
                            className={`bg-white border px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold shadow-sm ${isChallengeMode ? 'border-brand text-brand bg-brand/10' : 'border-stone-200 text-stone-700 hover:bg-stone-50'}`}
                          >
                            <Feather size={18} />
                            {isChallengeMode ? 'إظهار الإعراب' : 'وضع التحدي'}
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSaveResult} 
                            disabled={isSaving}
                            className={`bg-white border border-stone-200 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-stone-50 font-bold shadow-sm ${saveSuccess ? 'text-green-600 border-green-200 bg-green-50' : ''}`}
                          >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : saveSuccess ? <Check size={18} /> : <Save size={18} />}
                            {saveSuccess ? 'تم الحفظ' : 'حفظ الإعراب'}
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleCopy} 
                            className="bg-white border border-stone-200 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-stone-50 font-bold shadow-sm"
                          >
                            {copied ? <Check size={18} className="text-brand" /> : <Copy size={18} />}
                            {copied ? 'تم النسخ' : 'نسخ الإعراب'}
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleShare} 
                            className="bg-white border border-stone-200 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-stone-50 font-bold shadow-sm"
                          >
                            <Share2 size={18} />
                            مشاركة
                          </motion.button>
                        </div>
                      </div>

                      <div className="w-full flex justify-center mt-8 mb-8">
                        <div className="bg-stone-100 p-1.5 rounded-2xl flex items-center gap-1 shadow-inner overflow-x-auto max-w-full">
                          {[
                            { id: 'cards', icon: <LayoutGrid size={18} />, label: 'بطاقات' },
                            { id: 'accordion', icon: <List size={18} />, label: 'طي' },
                            { id: 'bubbles', icon: <MessageCircle size={18} />, label: 'فقاعات' },
                            { id: 'table', icon: <Table size={18} />, label: 'جدول' },
                            { id: 'separated', icon: <AlignJustify size={18} />, label: 'فواصل' }
                          ].map((mode) => (
                            <motion.button
                              key={mode.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setDisplayMode(mode.id as any)}
                              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all whitespace-nowrap ${displayMode === mode.id ? 'bg-white shadow-sm text-brand font-bold' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200/50'}`}
                            >
                              {mode.icon}
                              <span>{mode.label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden bg-white rounded-2xl shadow-sm border border-stone-200 p-2">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={displayMode}
                          initial={{ opacity: 0, x: -30 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 30 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="w-full"
                        >
                          {displayMode === 'bubbles' ? (
                        <div className="flex flex-col gap-6 p-4">
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
                                        <motion.button 
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={(e) => { e.stopPropagation(); setSelectedBubble(null); }}
                                          className="text-stone-400 hover:text-stone-600 transition-colors p-1"
                                        >
                                          <X size={18} />
                                        </motion.button>
                                      </div>
                                      
                                      <div className="text-center mb-4">
                                        <div className="text-2xl font-bold font-serif text-stone-800">
                                          {colorizeDiacritics(item.word)}
                                        </div>
                                      </div>
                                      
                                      <div className="text-stone-700 text-sm leading-relaxed text-center border-t border-stone-100 pt-4">
                                        {isChallengeMode ? '...' : <AnalysisText text={item.analysis.includes(':') && item.analysis.split(':')[0].trim().split(' ').length <= 2 
                                          ? item.analysis.split(':').slice(1).join(':').trim() 
                                          : item.analysis} />}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                          {result.map((item, index) => (
                            <motion.div
                              layout
                              initial={{ opacity: 0, scale: 0.95, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              key={index}
                              className={`p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col gap-4 group border ${getCategoryStyles(item.category).bg} ${getCategoryStyles(item.category).border}`}
                              dir="rtl"
                            >
                              <div className="flex justify-between items-center border-b border-stone-50 pb-4">
                                <span className={`font-bold font-serif group-hover:scale-105 transition-transform ${getCategoryStyles(item.category).text}`} style={{ fontSize: '1.75em' }}>
                                  {colorizeDiacritics(item.word)}
                                </span>
                                <span className={`px-4 py-1.5 rounded-full border font-bold text-xs ${getCategoryStyles(item.category).badge}`}>
                                  {item.category}
                                </span>
                              </div>
                              <div className="text-stone-700 leading-relaxed font-serif text-right" style={{ fontSize: '1.15em' }}>
                                {isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : displayMode === 'table' ? (
                        <div className="w-full overflow-x-auto hide-scrollbar rounded-2xl border border-stone-200">
                          <table className="w-full border-collapse text-right min-w-[600px]">
                            <thead>
                              <tr className="bg-stone-50 text-stone-800 border-b border-stone-200">
                                <th className="p-4 font-bold whitespace-nowrap" style={{ fontSize: '1.125em' }}>الكلمة</th>
                                <th className="p-4 font-bold whitespace-nowrap" style={{ fontSize: '1.125em' }}>التصنيف</th>
                                <th className="p-4 font-bold" style={{ fontSize: '1.125em' }}>الإعراب</th>
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
                                  className={`border-b last:border-0 ${getCategoryStyles(item.category).bg} ${getCategoryStyles(item.category).border}`}
                                >
                                  <td className={`p-5 font-bold font-serif whitespace-nowrap ${getCategoryStyles(item.category).text}`} style={{ fontSize: '1.5em' }}>
                                    {colorizeDiacritics(item.word)}
                                  </td>
                                  <td className="p-5 font-medium whitespace-nowrap" style={{ fontSize: '1.125em' }}>
                                    <span className={`px-4 py-1.5 rounded-full border font-bold inline-block ${getCategoryStyles(item.category).badge}`} style={{ fontSize: '0.875em' }}>{item.category}</span>
                                  </td>
                                  <td className="p-5 text-stone-800 leading-relaxed min-w-[300px]" style={{ fontSize: '1.25em' }}>
                                    {isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : displayMode === 'accordion' ? (
                        <div className="flex flex-col gap-3 p-4">
                          {result.map((item, index) => (
                            <div key={index} className={`rounded-2xl border shadow-sm overflow-hidden ${getCategoryStyles(item.category).bg} ${getCategoryStyles(item.category).border}`}>
                              <button
                                onClick={() => setExpandedAccordion(expandedAccordion === index ? null : index)}
                                className="w-full flex items-center justify-between p-5 hover:bg-white/50 transition-colors text-right"
                                dir="rtl"
                              >
                                <div className="flex items-center gap-4">
                                  <span className={`font-bold font-serif ${getCategoryStyles(item.category).text}`} style={{ fontSize: '1.5em' }}>
                                    {colorizeDiacritics(item.word)}
                                  </span>
                                  <span className={`px-3 py-1 rounded-full border font-bold text-xs ${getCategoryStyles(item.category).badge}`}>
                                    {item.category}
                                  </span>
                                </div>
                                <ChevronDown size={20} className={`text-stone-400 transition-transform duration-300 ${expandedAccordion === index ? 'rotate-180' : ''}`} />
                              </button>
                              <AnimatePresence>
                                {expandedAccordion === index && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="overflow-hidden"
                                    dir="rtl"
                                  >
                                    <div className="p-5 pt-0 border-t border-stone-100 bg-stone-50/50">
                                      <div className="text-stone-700 leading-relaxed font-serif text-right mt-4" style={{ fontSize: '1.15em' }}>
                                        {isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-4 p-4">
                          {result.map((item, index) => (
                            <motion.div 
                              layout
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              key={index}
                              className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex items-start gap-4 hover:border-brand/20 transition-colors"
                            >
                              <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-bold font-serif text-xl ${getCategoryStyles(item.category).badge}`}>
                                {colorizeDiacritics(item.word.charAt(0))}
                              </div>
                              <div className="flex-grow">
                                <h4 className={`font-bold font-serif text-xl mb-1 ${getCategoryStyles(item.category).text}`}>
                                  {colorizeDiacritics(item.word)}
                                </h4>
                                <p className="text-stone-700 leading-relaxed font-serif text-lg">
                                  {isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                        </motion.div>
                      </AnimatePresence>
                      
                      {loading && (
                        <div className="flex justify-center items-center py-8">
                          <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-sm border border-stone-200">
                            <Loader2 className="animate-spin text-brand" size={20} />
                            <span className="font-bold text-stone-600 text-sm">{loadingMessage}</span>
                          </div>
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && ruleQuery.trim()) {
                        handleSearchRule();
                      }
                    }}
                    placeholder="أدخل اسم القاعدة (مثال: كان وأخواتها)..."
                    className="flex-grow min-w-0 p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand outline-none font-serif text-lg"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSearchRule}
                    disabled={ruleLoading || !ruleQuery.trim()}
                    className={`shrink-0 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md ${ruleLoading || !ruleQuery.trim() ? 'bg-stone-400 cursor-not-allowed' : 'bg-brand hover:bg-brand-light hover:shadow-brand/30'}`}
                  >
                    {ruleLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        <Search size={20} />
                        بحث
                      </>
                    )}
                  </motion.button>
                </div>

                <div className="bg-stone-100 p-4 rounded-xl border border-stone-200">
                  <p className="font-bold text-stone-700 mb-3 text-sm flex items-center gap-2">
                    <Sparkles size={16} className="text-brand" /> كلمات مفتاحية سريعة:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["المبتدأ والخبر", "كان وأخواتها", "إن وأخواتها", "الفاعل", "المفعول به", "المضاف إليه", "النعت", "الحال", "التمييز", "المستثنى", "المنادى", "الممنوع من الصرف", "الأفعال الخمسة", "الأسماء الخمسة", "الفعل المضارع"].map(opt => (
                      <button
                        key={opt}
                        onClick={() => {
                          setRuleQuery(opt);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${ruleQuery === opt ? 'bg-brand text-white border-brand' : 'bg-white text-stone-600 border-stone-200 hover:border-brand/50 hover:bg-brand/5'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                {ruleResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 bg-white rounded-xl border border-stone-200 text-stone-800 leading-relaxed whitespace-pre-line relative font-serif text-lg">
                    {renderRuleWithInteractiveExamples(ruleResult)}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && poetryQuery.trim()) {
                        e.preventDefault();
                        handlePoetryAnalyze();
                      }
                    }}
                    placeholder="أدخل بيتاً شعرياً لتحليله، أو كلمة للبحث عن بيت يحتوي عليها..."
                    className="flex-grow min-w-0 p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand outline-none resize-y min-h-[120px] font-serif text-lg"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePoetryAnalyze}
                    disabled={poetryLoading || !poetryQuery.trim()}
                    className={`shrink-0 text-white px-6 py-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all shadow-md min-w-[120px] ${poetryLoading || !poetryQuery.trim() ? 'bg-stone-400 cursor-not-allowed' : 'bg-brand hover:bg-brand-light hover:shadow-brand/30'}`}
                  >
                    {poetryLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        <Search size={24} />
                        بحث / تحليل
                      </>
                    )}
                  </motion.button>
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
                    placeholder={spellingMode === 'analyze' ? "أدخل النص هنا لمراجعته إملائياً وتصحيحه..." : "أدخل اسم القاعدة الإملائية (مثال: الهمزة المتطرفة)..."}
                    className="flex-grow min-w-0 p-3 border border-stone-300 dark:border-stone-600 rounded-xl focus:ring-2 focus:ring-brand outline-none resize-y min-h-[120px] font-serif text-lg dark:bg-stone-700 dark:text-stone-100"
                  />
                  <div className="flex flex-col gap-2 shrink-0 min-w-[120px]">
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-2 text-sm font-bold text-stone-700 dark:text-stone-300">
                        <input type="radio" checked={spellingMode === 'analyze'} onChange={() => setSpellingMode('analyze')} />
                        تصحيح إملائي
                      </label>
                      <label className="flex items-center gap-2 text-sm font-bold text-stone-700 dark:text-stone-300">
                        <input type="radio" checked={spellingMode === 'dictation'} onChange={() => setSpellingMode('dictation')} />
                        إنشاء إملاء
                      </label>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSpellingAnalyze}
                      disabled={spellingLoading}
                      className={`text-white flex-grow px-6 py-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all shadow-md ${spellingLoading ? 'bg-stone-400 cursor-not-allowed' : 'bg-brand hover:bg-brand-light hover:shadow-brand/30'}`}
                    >
                      {spellingLoading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <>
                          <BookOpenText />
                          {spellingMode === 'analyze' ? 'تصحيح' : 'إنشاء'}
                        </>
                      )}
                    </motion.button>
                    {(spellingQuery || spellingResult || dictationResult) && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setSpellingQuery(''); setSpellingResult(null); setDictationResult(null); }}
                        className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                      >
                        <Trash2 size={18} />
                        مسح
                      </motion.button>
                    )}
                  </div>
                </div>
                <AnimatePresence mode="wait">
                {spellingResult && renderSpellingResult()}
                {dictationResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-100 leading-relaxed whitespace-pre-line relative font-serif text-lg">
                    <h3 className="text-xl font-bold text-brand mb-4 flex items-center gap-2">
                      <BookOpenText className="text-brand" />
                      قطعة الإملاء المقترحة
                    </h3>
                    {dictationResult}
                  </motion.div>
                )}
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
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => auth.currentUser && fetchSavedResults(auth.currentUser.uid)}
                    className="p-2 text-stone-500 hover:text-brand bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
                    title="تحديث"
                  >
                    <RefreshCw size={20} className={loadingSaved ? "animate-spin" : ""} />
                  </motion.button>
                </div>

                {!auth.currentUser ? (
                  <div className="text-center py-12 bg-stone-50 rounded-2xl border border-stone-200">
                    <Save size={48} className="mx-auto text-stone-300 mb-4" />
                    <p className="text-stone-600 mb-4 text-lg">يجب تسجيل الدخول لحفظ وعرض نتائجك</p>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => signInWithPopup(auth, googleProvider)}
                      className="bg-brand text-white px-6 py-2 rounded-xl font-bold hover:bg-brand-light transition-colors"
                    >
                      تسجيل الدخول
                    </motion.button>
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
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteSaved(item.id)}
                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </motion.button>
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
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
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
                            عرض الإعراب <ArrowRight size={16} className="rotate-180" />
                          </motion.button>
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
          </main>
        </div>
      )}
    </ErrorBoundary>
  );
}
