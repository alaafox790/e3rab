/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, BookOpenText, Camera, Share2, Copy, Check, ArrowRight, Mic, MicOff, AlignLeft, TextCursor, MapPin, Filter, Megaphone, RefreshCw, Trash2, Table, AlignJustify, StickyNote, Key } from 'lucide-react';
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
            <button onClick={() => window.location.reload()} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700">
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const categoryColors: Record<AnalyzedWord['category'] | 'جملة' | 'ملاحظات', string> = {
  'فعل': 'text-red-600',
  'اسم': 'text-blue-600',
  'مرفوع': 'text-green-700',
  'منصوب': 'text-yellow-700',
  'مجزوم': 'text-purple-600',
  'مجرور': 'text-orange-600',
  'أخرى': 'text-stone-600',
  'جملة': 'text-teal-600',
  'استخراج': 'text-indigo-600',
  'منادى': 'text-pink-600',
  'تحويل': 'text-cyan-600',
  'ملاحظات': 'text-indigo-500',
};

function Splash({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-900 via-teal-900 to-stone-900"
    >
      <div className="flex-grow flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8 p-6 bg-white/10 rounded-full backdrop-blur-sm border border-white/20 shadow-2xl"
        >
          <BookOpenText size={80} className="text-amber-400" />
        </motion.div>
        
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-5xl md:text-7xl font-bold text-amber-400 mb-6 text-center font-serif drop-shadow-lg flex flex-col items-center gap-4"
        >
          <span>معرب الجمل العربية</span>
          <span className="text-sm md:text-base bg-amber-600/30 text-amber-200 px-4 py-1 rounded-full font-sans tracking-wider border border-amber-500/30">تحديث رقم 101</span>
        </motion.h1>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-xl md:text-2xl text-emerald-100 mb-12 text-center max-w-lg leading-relaxed font-light flex flex-col gap-2"
        >
          <span className="font-bold text-white drop-shadow-md">مديرية التربية والتعليم بسوهاج</span>
          <span className="text-amber-200">إهداء الدكتور أسامة مصطفى</span>
          <span className="text-lg text-emerald-200/90">موجه عام اللغة العربية بالديوان</span>
        </motion.div>
      </div>
      
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.8 }}
        className="flex flex-col items-center gap-8 mb-12 w-full max-w-md"
      >
        <div className="text-amber-200/80 font-serif text-lg px-8 py-3 border-t border-b border-amber-500/30 tracking-wide text-center w-full">
          تصميم وإعداد / علاء الوكيل
        </div>

        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(217,119,6,0.6)" }}
          whileTap={{ scale: 0.95 }}
          onClick={onComplete}
          className="bg-amber-600 text-white px-16 py-5 rounded-full text-2xl font-bold flex items-center gap-4 hover:bg-amber-500 transition-all shadow-[0_0_20px_rgba(217,119,6,0.4)]"
        >
          دخول <ArrowRight size={28} />
        </motion.button>
      </motion.div>
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

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [sentence, setSentence] = useState('');
  const [mode, setMode] = useState<'full' | 'partial' | 'sentence-position' | 'extract' | 'vocative' | 'convert' | 'notes'>('full');
  const [displayMode, setDisplayMode] = useState<'table' | 'separated'>('table');
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

  const handleSelectApiKey = async () => {
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        alert("تم تحديث مفتاح API بنجاح! يمكنك الآن الاستمرار في الاستخدام بدون قيود.");
      } else {
        alert("عذراً، هذه الميزة غير متوفرة في هذه البيئة.");
      }
    } catch (error) {
      console.error("Error selecting API key:", error);
    }
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
    const text = result.map(r => `${r.word}: ${r.analysis}`).join('\n');
    if (navigator.share) {
      navigator.share({ title: 'نتائج الإعراب', text });
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

  return (
    <ErrorBoundary>
      <AnimatePresence>
        {showSplash && <Splash onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      
      {!showSplash && (
        <div className="min-h-screen bg-stone-100 p-4 md:p-8 font-sans" dir="rtl" style={{ fontSize: `${fontSize}px` }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-md flex flex-col min-h-[80vh]"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex-grow flex flex-col items-center justify-center">
                <h1 className="text-3xl font-bold text-stone-900 text-center">معرب الجمل العربية</h1>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mt-2">تحديث رقم 101</span>
              </div>
              <div className="flex flex-col gap-2 shrink-0 items-end">
                <button 
                  onClick={handleSelectApiKey} 
                  className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 transition-colors mb-1"
                  title="استخدام مفتاح API خاص لتجاوز حدود الاستخدام"
                >
                  <Key size={14} /> إضافة مفتاح API خاص
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setFontSize(s => Math.min(s + 2, 24))} className="bg-stone-200 p-2 rounded-lg">+</button>
                  <button onClick={() => setFontSize(s => Math.max(s - 2, 12))} className="bg-stone-200 p-2 rounded-lg">-</button>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mb-6 border-b border-stone-200 pb-2">
              <button 
                onClick={() => setActiveTab('parser')}
                className={`pb-2 px-4 ${activeTab === 'parser' ? 'border-b-2 border-emerald-600 font-bold' : 'text-stone-500'}`}
              >
                الإعراب
              </button>
              <button 
                onClick={() => setActiveTab('rules')}
                className={`pb-2 px-4 ${activeTab === 'rules' ? 'border-b-2 border-emerald-600 font-bold' : 'text-stone-500'}`}
              >
                البحث عن قاعدة
              </button>
              <button 
                onClick={() => setActiveTab('poetry')}
                className={`pb-2 px-4 ${activeTab === 'poetry' ? 'border-b-2 border-emerald-600 font-bold' : 'text-stone-500'}`}
              >
                أبيات شعرية
              </button>
            </div>
            
            {activeTab === 'parser' && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3 mb-8">
                  <button
                    onClick={() => setMode('full')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl transition-all duration-300 ${mode === 'full' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 scale-[1.02] border border-emerald-400' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 hover:shadow-sm'}`}
                  >
                    <AlignLeft size={28} className={mode === 'full' ? 'text-white' : 'text-emerald-500'} /> 
                    <span className="font-semibold text-xs md:text-sm text-center">إعراب كامل</span>
                  </button>
                  
                  <button
                    onClick={() => setMode('partial')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl transition-all duration-300 ${mode === 'partial' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20 scale-[1.02] border border-blue-400' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 hover:shadow-sm'}`}
                  >
                    <TextCursor size={28} className={mode === 'partial' ? 'text-white' : 'text-blue-500'} /> 
                    <span className="font-semibold text-xs md:text-sm text-center">إعراب محدد</span>
                  </button>
                  
                  <button
                    onClick={() => setMode('sentence-position')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl transition-all duration-300 ${mode === 'sentence-position' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 scale-[1.02] border border-amber-400' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 hover:shadow-sm'}`}
                  >
                    <MapPin size={28} className={mode === 'sentence-position' ? 'text-white' : 'text-amber-500'} /> 
                    <span className="font-semibold text-xs md:text-sm text-center">موقع الجمل</span>
                  </button>
                  
                  <button
                    onClick={() => setMode('extract')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl transition-all duration-300 ${mode === 'extract' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20 scale-[1.02] border border-purple-400' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 hover:shadow-sm'}`}
                  >
                    <Filter size={28} className={mode === 'extract' ? 'text-white' : 'text-purple-500'} /> 
                    <span className="font-semibold text-xs md:text-sm text-center">استخراج</span>
                  </button>
                  
                  <button
                    onClick={() => setMode('vocative')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl transition-all duration-300 ${mode === 'vocative' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 scale-[1.02] border border-rose-400' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 hover:shadow-sm'}`}
                  >
                    <Megaphone size={28} className={mode === 'vocative' ? 'text-white' : 'text-rose-500'} /> 
                    <span className="font-semibold text-xs md:text-sm text-center">نوع المنادى</span>
                  </button>
                  
                  <button
                    onClick={() => setMode('convert')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl transition-all duration-300 ${mode === 'convert' ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20 scale-[1.02] border border-cyan-400' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 hover:shadow-sm'}`}
                  >
                    <RefreshCw size={28} className={mode === 'convert' ? 'text-white' : 'text-cyan-500'} /> 
                    <span className="font-semibold text-xs md:text-sm text-center">تحويل نحوي</span>
                  </button>
                  
                  <button
                    onClick={() => setMode('notes')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl transition-all duration-300 ${mode === 'notes' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20 scale-[1.02] border border-indigo-400' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 hover:shadow-sm'}`}
                  >
                    <StickyNote size={28} className={mode === 'notes' ? 'text-white' : 'text-indigo-500'} /> 
                    <span className="font-semibold text-xs md:text-sm text-center">ملاحظات</span>
                  </button>
                  
                  <button
                    onClick={handleClear}
                    className="flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl transition-all duration-300 bg-stone-100 text-red-500 hover:bg-red-50 hover:text-red-600 border border-stone-200 hover:border-red-200 hover:shadow-sm col-span-2 md:col-span-3 lg:col-span-4"
                  >
                    <Trash2 size={28} /> 
                    <span className="font-semibold text-xs md:text-sm text-center">مسح وبدء جديد</span>
                  </button>
                </div>

                <div className="flex bg-stone-100 p-1 rounded-md w-fit mb-6">
                  <button
                    onClick={() => setDisplayMode('table')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-sm text-sm md:text-base transition-all ${displayMode === 'table' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    <Table size={18} /> عرض كجدول
                  </button>
                  <button
                    onClick={() => setDisplayMode('separated')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-sm text-sm md:text-base transition-all ${displayMode === 'separated' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    <AlignJustify size={18} /> عرض بفواصل | |
                  </button>
                </div>

                <div className="flex flex-col gap-2 mb-6">
                  <div className="relative">
                    <textarea
                      value={sentence}
                      onChange={(e) => setSentence(e.target.value)}
                      placeholder={mode === 'extract' ? "أدخل القطعة أو النص هنا..." : mode === 'vocative' ? "أدخل أسلوب النداء هنا..." : mode === 'convert' ? "أدخل الجملة الأصلية هنا..." : mode === 'notes' ? "أدخل النص لاستخراج الملاحظات النحوية..." : "أدخل الجملة..."}
                      className="w-full min-h-[120px] p-4 pb-14 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-y"
                    />
                    <div className="absolute bottom-3 left-3 flex gap-2">
                      <button
                        onClick={toggleListening}
                        className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'}`}
                        title="التحدث بالصوت"
                      >
                        {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600" title="إرفاق صورة">
                        <Camera size={20} />
                      </button>
                    </div>
                  </div>
                  {image && <img src={image} alt="uploaded" className="max-h-40 rounded-xl" />}
                  {(mode === 'partial' || mode === 'extract' || mode === 'convert' || mode === 'notes') && (
                    <input
                      type="text"
                      value={targetWords}
                      onChange={(e) => setTargetWords(e.target.value)}
                      placeholder={mode === 'extract' ? "ما الذي تريد استخراجه؟ (مثال: اسم فاعل، صيغة مبالغة، ممنوع من الصرف...)" : mode === 'convert' ? "ما هو التحويل المطلوب؟ (مثال: حول الجملة الاسمية إلى فعلية، أو حول الحال المفرد إلى جملة)" : mode === 'notes' ? "أي ملاحظات محددة تبحث عنها؟ (اختياري)" : "أدخل الكلمات المراد إعرابها (مفصولة بفاصلة)..."}
                      className="p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  )}
                  <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className={`text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors min-w-[200px] ${loading ? 'bg-stone-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" />
                        <span className="text-sm">{loadingMessage}</span>
                      </>
                    ) : (
                      <>
                        <Search />
                        إعراب
                      </>
                    )}
                  </button>
                  {errorMessage && (
                    <div className="p-4 bg-red-100 text-red-700 border border-red-300 rounded-xl mt-2 flex items-center justify-between">
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>

                {result.length > 0 && (
                  <div className="overflow-x-auto flex-grow">
                    <div className="flex gap-2 mb-2">
                      <button onClick={handleCopy} className="bg-stone-200 px-3 py-1 rounded-lg flex items-center gap-1 text-sm">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'تم النسخ' : 'نسخ'}
                      </button>
                      <button onClick={handleShare} className="bg-stone-200 px-3 py-1 rounded-lg flex items-center gap-1 text-sm">
                        <Share2 size={16} />
                        مشاركة
                      </button>
                    </div>
                    {displayMode === 'table' ? (
                      <table className="w-full border-collapse text-right">
                        <thead>
                          <tr className="bg-stone-100 text-stone-800">
                            <th className="p-3 border-b">الكلمة</th>
                            <th className="p-3 border-b">التصنيف</th>
                            <th className="p-3 border-b">الإعراب</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.map((item, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-stone-50' : 'bg-white'}>
                              <td className={`p-4 text-2xl font-medium ${categoryColors[item.category]}`}>{item.word}</td>
                              <td className="p-4 text-lg text-stone-600">{item.category}</td>
                              <td className="p-4 text-lg text-stone-800 leading-relaxed">{item.analysis}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-xl leading-loose p-4 bg-white rounded-xl border border-stone-200">
                        {result.map((item, index) => (
                          <span key={index}>
                            <span className={`font-bold ${categoryColors[item.category]}`}>{item.word}</span>
                            <span className="text-stone-600"> ({item.analysis})</span>
                            {index < result.length - 1 && <span className="mx-2 text-stone-400 font-bold">| |</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'rules' && (
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ruleQuery}
                    onChange={(e) => setRuleQuery(e.target.value)}
                    placeholder="أدخل اسم القاعدة (مثال: كان وأخواتها)..."
                    className="flex-grow min-w-0 p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <button
                    onClick={handleSearchRule}
                    disabled={ruleLoading}
                    className={`shrink-0 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${ruleLoading ? 'bg-stone-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
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
                {ruleResult && (
                  <div className="p-6 bg-white rounded-xl border border-stone-200 text-stone-800 leading-relaxed whitespace-pre-line relative">
                    {ruleResult}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'poetry' && (
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <textarea
                    value={poetryQuery}
                    onChange={(e) => setPoetryQuery(e.target.value)}
                    placeholder="أدخل البيت الشعري هنا (مثال: الخيل والليل والبيداء تعرفني...)"
                    className="flex-grow min-w-0 p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-y min-h-[120px]"
                  />
                  <button
                    onClick={handlePoetryAnalyze}
                    disabled={poetryLoading}
                    className={`shrink-0 text-white px-6 py-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors min-w-[120px] ${poetryLoading ? 'bg-stone-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
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
                {poetryResult && (
                  <div className="p-6 bg-white rounded-xl border border-stone-200 text-stone-800 leading-relaxed whitespace-pre-line relative">
                    {poetryResult}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </ErrorBoundary>
  );
}
