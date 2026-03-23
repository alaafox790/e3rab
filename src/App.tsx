/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, BookOpenText, Camera, Share2, Copy, Check, ArrowRight, Mic, MicOff } from 'lucide-react';
import { analyzeSentence, AnalyzedWord, searchGrammarRule } from './services/geminiService';
import Auth from './components/Auth';

const categoryColors: Record<AnalyzedWord['category'] | 'جملة', string> = {
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
};

function Splash({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col items-center justify-end p-6"
    >
      <img src="/splash.png" alt="Splash Screen" className="absolute inset-0 w-full h-full object-cover" />
      
      <div className="relative z-10 text-amber-100 mb-6 font-serif text-lg bg-black/30 px-4 py-2 rounded-lg">
        تصميم وإعداد / علاء الوكيل
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onComplete}
        className="relative z-10 bg-amber-800 text-amber-100 border border-amber-600 px-12 py-4 rounded-full text-xl font-bold flex items-center gap-2 hover:bg-amber-900 transition-all shadow-lg shadow-black/50 mb-12"
      >
        دخول <ArrowRight />
      </motion.button>
    </motion.div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('isRegistered'));
  const [sentence, setSentence] = useState('');
  const [mode, setMode] = useState<'full' | 'partial' | 'sentence-position' | 'extract' | 'vocative' | 'convert'>('full');
  const [displayMode, setDisplayMode] = useState<'table' | 'separated'>('table');
  const [targetWords, setTargetWords] = useState('');
  const [result, setResult] = useState<AnalyzedWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  
  const [activeTab, setActiveTab] = useState<'parser' | 'rules'>('parser');
  const [ruleQuery, setRuleQuery] = useState('');
  const [ruleResult, setRuleResult] = useState('');
  const [ruleLoading, setRuleLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedResults, setSavedResults] = useState<{id: number, sentence: string, result: AnalyzedWord[]}[]>([]);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('savedResults');
    if (saved) {
      setSavedResults(JSON.parse(saved));
    }

    // Initialize Speech Recognition
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
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('عذراً، متصفحك لا يدعم ميزة التعرف على الصوت.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSave = () => {
    const newSaved = [...savedResults, { id: Date.now(), sentence, result }];
    setSavedResults(newSaved);
    localStorage.setItem('savedResults', JSON.stringify(newSaved));
  };

  const handleDeleteSaved = (id: number) => {
    const newSaved = savedResults.filter(r => r.id !== id);
    setSavedResults(newSaved);
    localStorage.setItem('savedResults', JSON.stringify(newSaved));
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
    try {
      const base64Image = image ? image.split(',')[1] : undefined;
      const analysis = await analyzeSentence(sentence, mode, targetWords, base64Image);
      setResult(analysis);
    } catch (error) {
      console.error(error);
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

  return (
    <>
      <AnimatePresence>
        {showSplash && <Splash onComplete={() => setShowSplash(false)} />}
        {!showSplash && !isLoggedIn && <Auth onLoginSuccess={() => setIsLoggedIn(true)} />}
      </AnimatePresence>
      
      {!showSplash && isLoggedIn && (
        <div className="min-h-screen bg-stone-100 p-4 md:p-8 font-sans" dir="rtl" style={{ fontSize: `${fontSize}px` }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-md flex flex-col min-h-[80vh]"
          >
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-stone-900 text-center flex-grow">معرب الجمل العربية</h1>
              <div className="flex gap-2">
                <button onClick={() => setFontSize(s => Math.min(s + 2, 24))} className="bg-stone-200 p-2 rounded-lg">+</button>
                <button onClick={() => setFontSize(s => Math.max(s - 2, 12))} className="bg-stone-200 p-2 rounded-lg">-</button>
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
            </div>
            
            {activeTab === 'parser' ? (
              <>
                <div className="flex flex-wrap gap-4 mb-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode === 'full'} onChange={() => setMode('full')} />
                    إعراب الجملة كاملة
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode === 'partial'} onChange={() => setMode('partial')} />
                    إعراب كلمات محددة
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode === 'sentence-position'} onChange={() => setMode('sentence-position')} />
                    الموقع الإعرابي للجمل
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode === 'extract'} onChange={() => setMode('extract')} />
                    استخراج (صرف/نحو)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode === 'vocative'} onChange={() => setMode('vocative')} />
                    نوع المنادى
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode === 'convert'} onChange={() => setMode('convert')} />
                    تحويل نحوي
                  </label>
                  <label className="flex items-center gap-2 text-red-600">
                    <input type="radio" checked={false} onChange={handleClear} />
                    مسح النتائج وبدء جديد
                  </label>
                </div>

                <div className="flex flex-wrap gap-4 mb-4 p-3 bg-stone-50 rounded-xl">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={displayMode === 'table'} onChange={() => setDisplayMode('table')} />
                    عرض كجدول
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={displayMode === 'separated'} onChange={() => setDisplayMode('separated')} />
                    عرض بفواصل | |
                  </label>
                </div>

                <div className="flex flex-col gap-2 mb-6">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sentence}
                      onChange={(e) => setSentence(e.target.value)}
                      placeholder={mode === 'extract' ? "أدخل القطعة أو النص هنا..." : mode === 'vocative' ? "أدخل أسلوب النداء هنا..." : mode === 'convert' ? "أدخل الجملة الأصلية هنا..." : "أدخل الجملة..."}
                      className="flex-grow p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                      onClick={toggleListening}
                      className={`p-3 rounded-xl transition-colors ${isListening ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-stone-200 hover:bg-stone-300'}`}
                      title="التحدث بالصوت"
                    >
                      {isListening ? <MicOff /> : <Mic />}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="bg-stone-200 p-3 rounded-xl hover:bg-stone-300" title="إرفاق صورة">
                      <Camera />
                    </button>
                  </div>
                  {image && <img src={image} alt="uploaded" className="max-h-40 rounded-xl" />}
                  {(mode === 'partial' || mode === 'extract' || mode === 'convert') && (
                    <input
                      type="text"
                      value={targetWords}
                      onChange={(e) => setTargetWords(e.target.value)}
                      placeholder={mode === 'extract' ? "ما الذي تريد استخراجه؟ (مثال: اسم فاعل، صيغة مبالغة، ممنوع من الصرف...)" : mode === 'convert' ? "ما هو التحويل المطلوب؟ (مثال: حول الجملة الاسمية إلى فعلية، أو حول الحال المفرد إلى جملة)" : "أدخل الكلمات المراد إعرابها (مفصولة بفاصلة)..."}
                      className="p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  )}
                  <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Search />}
                    إعراب
                  </button>
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
                      <button onClick={handleSave} className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg flex items-center gap-1 text-sm">
                        <Check size={16} />
                        حفظ النتيجة
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

                {savedResults.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-2xl font-bold mb-4">النتائج المحفوظة</h2>
                    {savedResults.map(r => (
                      <div key={r.id} className="bg-white p-4 rounded-xl border border-stone-200 mb-4 flex justify-between items-center">
                        <div>
                          <p className="font-bold">{r.sentence}</p>
                          <p className="text-sm text-stone-500">{new Date(r.id).toLocaleString()}</p>
                        </div>
                        <button onClick={() => handleDeleteSaved(r.id)} className="text-red-500 hover:text-red-700">حذف</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ruleQuery}
                    onChange={(e) => setRuleQuery(e.target.value)}
                    placeholder="أدخل اسم القاعدة (مثال: كان وأخواتها)..."
                    className="flex-grow p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <button
                    onClick={handleSearchRule}
                    disabled={ruleLoading}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    {ruleLoading ? <Loader2 className="animate-spin" /> : <BookOpenText />}
                    بحث
                  </button>
                </div>
                {ruleResult && (
                  <div className="p-6 bg-white rounded-xl border border-stone-200 text-stone-800 leading-relaxed whitespace-pre-line">
                    {ruleResult}
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-auto pt-6 border-t border-stone-200">
              <button 
                onClick={() => {
                  localStorage.removeItem('isRegistered');
                  setIsLoggedIn(false);
                }}
                className="w-full bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
              >
                تسجيل الخروج
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
