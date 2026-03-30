/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, BookOpenText, Camera, Share2, Copy, Check, ArrowRight, Mic, MicOff, AlignLeft, TextCursor, MapPin, Filter, Megaphone, RefreshCw, Trash2, Table, AlignJustify, StickyNote, Key, Lock, LayoutGrid, Feather, ScrollText } from 'lucide-react';
import { analyzeSentence, searchGrammarRule, analyzePoetry } from './services/geminiService';
import { AnalyzedWord } from './types';

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
  if (category.includes('اسم') || category.includes('مبتدأ') || category.includes('خبر') || category.includes('فاعل') || category.includes('مفعول') || category.includes('مرفوع') || category.includes('منصوب') || category.includes('مجرور') || category.includes('حرف') || category.includes('منادى')) {
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
            display="inline-block"
            animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
            transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 }}
            className="inline-block origin-bottom"
          >
            معرب
          </motion.span>
          <span>الجمل العربية</span>
        </motion.h1>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-lg md:text-xl text-white/70 text-center max-w-lg font-sans"
        >
          إعراب ذكي بقوة الذكاء الاصطناعي
        </motion.div>

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
  "جاري تحديد المواقع الإعرابية... 📍",
  "جاري صياغة الإعراب التفصيلي... ✍️",
  "نضع اللمسات الأخيرة... ✨"
];

const generateRandomCode = () => Math.floor(10000 + Math.random() * 90000).toString();

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const [validCodes, setValidCodes] = useState<string[]>(() => {
    const saved = localStorage.getItem('valid_codes');
    if (saved) return JSON.parse(saved);
    const initialCode = generateRandomCode();
    localStorage.setItem('valid_codes', JSON.stringify([initialCode]));
    return [initialCode];
  });

  const handleGenerateNewCode = () => {
    const newCode = generateRandomCode();
    const updatedCodes = [newCode, ...validCodes].slice(0, 10);
    setValidCodes(updatedCodes);
    localStorage.setItem('valid_codes', JSON.stringify(updatedCodes));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === '2020') {
      setShowAdmin(true);
      setError(false);
    } else if (validCodes.includes(code)) {
      onLogin();
    } else {
      setError(true);
      setCode('');
    }
  };

  if (showAdmin) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans" dir="rtl">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-stone-200 text-center"
        >
          <h2 className="text-2xl font-bold text-stone-800 mb-6">لوحة الإدارة - توليد الأكواد</h2>
          <p className="text-stone-600 mb-4">أحدث كود دخول صالح هو:</p>
          <div className="bg-brand-light/10 border-2 border-brand-light/30 rounded-2xl p-6 mb-4">
            <span className="text-5xl font-bold text-brand tracking-widest">{validCodes[0]}</span>
          </div>
          
          <button
            onClick={handleGenerateNewCode}
            className="w-full bg-brand hover:bg-brand-light text-white font-bold py-3 rounded-xl transition-all text-lg mb-6 shadow-md"
          >
            توليد كود جديد
          </button>
          
          {validCodes.length > 1 && (
            <div className="mb-8 text-right bg-stone-50 p-4 rounded-xl border border-stone-100">
              <p className="text-sm font-bold text-stone-700 mb-2">الأكواد السابقة الصالحة:</p>
              <div className="flex flex-wrap gap-2">
                {validCodes.slice(1).map((c, i) => (
                  <span key={i} className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded text-sm tracking-wider">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setShowAdmin(false); setCode(''); }}
            className="w-full bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold py-4 rounded-2xl transition-all text-lg"
          >
            العودة لتسجيل الدخول
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-4 font-sans relative overflow-hidden" dir="rtl">
      {/* Subtle + grid pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="plus-pattern-login" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M20 15 L20 25 M15 20 L25 20" stroke="white" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#plus-pattern-login)" />
        </svg>
      </div>

      {/* Large background circle */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-white/5 blur-2xl pointer-events-none"></div>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-brand-light/20 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 rounded-full flex items-center justify-center mb-6 shadow-inner border border-amber-300">
            <Feather size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-bold text-brand font-ruqaa text-center mb-2 flex items-center justify-center gap-2">
            <motion.span
              display="inline-block"
              animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
              transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 }}
              className="inline-block origin-bottom"
            >
              معرب
            </motion.span>
            <span>الجمل العربية</span>
          </h1>
          <p className="text-brand/80 mt-2 text-center text-lg font-serif">أهلاً بك في خيمة لغة الضاد</p>
        </div>

        {!showInput ? (
          <button
            onClick={() => setShowInput(true)}
            className="w-full bg-brand hover:bg-brand-light text-white font-bold py-4 rounded-2xl transition-all text-xl shadow-lg shadow-brand/20 active:scale-[0.98]"
          >
            تسجيل الدخول
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
            >
              <input
                type="password"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(false);
                }}
                placeholder="رمز الدخول..."
                className={`w-full p-4 text-center text-3xl tracking-[0.5em] border-2 rounded-2xl outline-none transition-all ${error ? 'border-red-500 bg-red-50 text-red-700' : 'border-amber-200 focus:border-brand focus:ring-4 focus:ring-brand/20 text-brand bg-stone-50'}`}
                dir="ltr"
                autoFocus
              />
              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-sm mt-3 text-center font-bold"
                >
                  الكود غير صحيح. اطلب الكود من المبرمج.
                </motion.p>
              )}
            </motion.div>
            <button
              type="submit"
              className="w-full bg-brand hover:bg-brand-light text-white font-bold py-4 rounded-2xl transition-all text-xl shadow-lg shadow-brand/20 active:scale-[0.98]"
            >
              تأكيد
            </button>
            
            <a 
              href="https://wa.me/201030302005" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 text-brand hover:text-brand-light font-bold bg-brand/5 py-3 rounded-xl transition-colors border border-brand/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-brand">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133-.298-.347-.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              تواصل عبر واتساب لطلب الكود
            </a>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [sentence, setSentence] = useState('');
  const [mode, setMode] = useState<'full' | 'partial' | 'sentence-position' | 'extract' | 'vocative' | 'convert' | 'notes' | 'compare'>('full');
  const [displayMode, setDisplayMode] = useState<'table' | 'separated' | 'cards'>('table');
  const [targetWords, setTargetWords] = useState('');
  const [result, setResult] = useState<AnalyzedWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const [fontSize, setFontSize] = useState(16);
  
  const [activeTab, setActiveTab] = useState<'parser' | 'rules' | 'poetry'>('parser');
  const [ruleQuery, setRuleQuery] = useState('');
  const [ruleResult, setRuleResult] = useState('');
  const [ruleLoading, setRuleLoading] = useState(false);
  const [poetryQuery, setPoetryQuery] = useState('');
  const [poetryResult, setPoetryResult] = useState('');
  const [poetryLoading, setPoetryLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

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
    const text = `نتائج الإعراب:\n\n${result.map(r => `${r.word}: ${r.analysis}`).join('\n')}\n\nتم الإعراب بواسطة تطبيق معرب الجمل العربية:\n${appLink}`;
    
    if (navigator.share) {
      navigator.share({ 
        title: 'نتائج الإعراب من معرب الجمل العربية', 
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
      let analysis = await analyzeSentence(sentence, mode, targetWords, base64Image);
      
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
      const msg = error.message || "حدث خطأ غير متوقع أثناء الإعراب. تأكد من إعداد مفتاح API بشكل صحيح.";
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

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
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
                <h1 className="text-4xl font-bold text-brand text-center font-ruqaa flex items-center justify-center gap-3">
                  <Feather className="text-amber-600" size={32} strokeWidth={1.5} />
                  معرب الجمل العربية
                </h1>
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-4 py-1 rounded-full mt-3 border border-amber-200">تحديث رقم 101</span>
              </div>
              <div className="flex flex-col gap-2 shrink-0 items-end">
                <div className="flex gap-2">
                  <button onClick={() => setFontSize(s => Math.min(s + 2, 24))} className="bg-stone-100 hover:bg-stone-200 text-stone-700 p-2 rounded-xl transition-colors shadow-sm">+</button>
                  <button onClick={() => setFontSize(s => Math.max(s - 2, 12))} className="bg-stone-100 hover:bg-stone-200 text-stone-700 p-2 rounded-xl transition-colors shadow-sm">-</button>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mb-6 border-b border-stone-200 relative">
              {[
                { id: 'parser', label: 'الإعراب' },
                { id: 'rules', label: 'البحث عن قاعدة' },
                { id: 'poetry', label: 'أبيات شعرية' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 px-4 relative transition-colors ${activeTab === tab.id ? 'text-brand font-bold' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              ))}
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
                        <motion.input
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          type="text"
                          value={targetWords}
                          onChange={(e) => setTargetWords(e.target.value)}
                          placeholder={mode === 'compare' ? "أدخل الجملة الثانية للمقارنة..." : mode === 'extract' ? "ما الذي تريد استخراجه؟ (مثال: اسم فاعل، صيغة مبالغة، ممنوع من الصرف...)" : mode === 'convert' ? "ما هو التحويل المطلوب؟ (مثال: حول الجملة الاسمية إلى فعلية، أو حول الحال المفرد إلى جملة)" : mode === 'notes' ? "أي ملاحظات محددة تبحث عنها؟ (اختياري)" : "أدخل الكلمات المراد إعرابها (مفصولة بفاصلة)..."}
                          className="p-4 text-lg border-2 border-stone-200 rounded-xl focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none bg-stone-50/50"
                        />
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
                        إعراب
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
                        <div className="flex bg-stone-200 p-1 rounded-xl">
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
                      {displayMode === 'cards' ? (
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
          </AnimatePresence>
          </motion.div>
        </div>
      )}
    </ErrorBoundary>
  );
}
