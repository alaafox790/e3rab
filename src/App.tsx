/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, BookOpenText, Camera, Share2, Copy, Check, ArrowRight, Mic, MicOff, AlignLeft, TextCursor, MapPin, Filter, Megaphone, RefreshCw, Trash2, Table, AlignJustify, StickyNote, Key, Lock, LayoutGrid, Feather, ScrollText, Clock, Save, Bookmark, MessageCircle, Info, X, LogOut, Sparkles, Moon, ChevronDown, List, Network, MousePointerClick, ChevronRight, ChevronLeft, Wand2, ArrowUpDown, ArrowUp, ArrowDown, Grid, GalleryHorizontal } from 'lucide-react';
import { analyzeSentence, searchGrammarRule, analyzePoetry, analyzeSpelling, generateDictation, autoDiacritize, generateQuizQuestion, evaluateQuizAnswer } from './services/geminiService';
import { AnalyzedWord, SpellingResult } from './types';
import Markdown from 'react-markdown';
import { db, auth, googleProvider } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { AnalysisCard } from './components/AnalysisCard';
import * as d3 from 'd3';

const MindmapView = ({ sentence, result, getCategoryStyles, colorizeDiacritics, onRemove }: any) => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!result || result.length === 0) return;

    const width = 800;
    const height = 600;

    const initialNodes = [
      { id: 'root', label: sentence, isRoot: true, radius: 80, x: width/2, y: height/2 },
      ...result.map((item: any, i: number) => ({
        id: `node-${i}`,
        item,
        isRoot: false,
        radius: 60,
        x: width/2 + Math.random() * 100 - 50,
        y: height/2 + Math.random() * 100 - 50
      }))
    ];

    const initialLinks = result.map((_: any, i: number) => ({
      source: 'root',
      target: `node-${i}`
    }));

    const simulation = d3.forceSimulation(initialNodes)
      .force("link", d3.forceLink(initialLinks).id((d: any) => d.id).distance(180))
      .force("charge", d3.forceManyBody().strength(-800))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.radius + 20));

    simulation.on("tick", () => {
      setNodes([...initialNodes]);
      setLinks([...initialLinks]);
    });

    return () => {
      simulation.stop();
    };
  }, [sentence, result]);

  return (
    <div className="relative w-full max-w-5xl mx-auto h-[600px] bg-stone-50 rounded-3xl border border-stone-200 shadow-inner overflow-hidden" ref={containerRef} dir="rtl">
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
        {links.map((link, i) => (
          <line
            key={i}
            x1={link.source.x}
            y1={link.source.y}
            x2={link.target.x}
            y2={link.target.y}
            stroke="#cbd5e1"
            strokeWidth="2"
          />
        ))}
      </svg>

      {nodes.map((node) => {
        if (node.isRoot) {
          return (
            <div
              key={node.id}
              className="absolute z-20 bg-brand text-white px-6 py-4 rounded-2xl font-bold font-serif text-xl shadow-lg text-center max-w-[250px]"
              style={{
                left: `${(node.x / 800) * 100}%`,
                top: `${(node.y / 600) * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {node.label}
            </div>
          );
        }

        const { item } = node;
        return (
          <div
            key={node.id}
            className={`absolute z-10 w-40 p-3 rounded-xl shadow-md border flex flex-col items-center gap-2 hover:scale-105 transition-transform group ${getCategoryStyles(item.category).bg} ${getCategoryStyles(item.category).border}`}
            style={{
              left: `${(node.x / 800) * 100}%`,
              top: `${(node.y / 600) * 100}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {onRemove && (
              <button
                onClick={() => onRemove(item)}
                className="absolute -top-2 -left-2 p-1 bg-white rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                title="حذف هذه الكلمة"
              >
                <X size={14} />
              </button>
            )}
            <span className={`font-bold font-serif text-lg ${getCategoryStyles(item.category).text}`}>
              {colorizeDiacritics(item.word)}
            </span>
            <span className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${getCategoryStyles(item.category).badge}`}>
              {item.category}
            </span>
          </div>
        );
      })}
    </div>
  );
};

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
  'خبر كان': 'اسم منصوب يكمل معنى اسم كان',
  'مرفوع': 'حالة إعرابية علامتها الأصلية الضمة',
  'منصوب': 'حالة إعرابية علامتها الأصلية الفتحة',
  'مجرور': 'حالة إعرابية علامتها الأصلية الكسرة',
  'مجزوم': 'حالة إعرابية خاصة بالفعل المضارع علامتها الأصلية السكون',
  'مبني': 'ما يلزم آخره حالة واحدة لا تتغير بتغير موقعه في الجملة',
  'معرب': 'ما يتغير آخره بتغير موقعه في الجملة',
  'مفعول مطلق': 'مصدر منصوب يذكر بعد فعل من لفظه لتأكيده أو بيان نوعه أو عدده',
  'مفعول لأجله': 'اسم منصوب يذكر لبيان سبب وقوع الفعل',
  'مفعول معه': 'اسم منصوب يقع بعد واو بمعنى (مع) لبيان ما فُعل الفعل بمصاحبته',
  'مستثنى': 'اسم يذكر بعد أداة استثناء مخالفا لما قبلها في الحكم',
  'منادى': 'اسم يطلب إقباله بأداة نداء',
  'ضمير متصل': 'ضمير يتصل بكلمة قبله ولا يستقل بنفسه',
  'ضمير منفصل': 'ضمير يستقل بنفسه ولا يتصل بكلمة قبله',
  'ضمير مستتر': 'ضمير لا يظهر في اللفظ ويقدر في الذهن',
  'ممنوع من الصرف': 'اسم معرب لا ينون ويجر بالفتحة نيابة عن الكسرة'
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
            <span key={index} className="font-bold text-brand">
              {colorizeDiacritics(part)}
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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="text-white text-center mb-10 bg-white/15 px-10 py-8 rounded-[3rem] backdrop-blur-md border-2 border-white/30 shadow-2xl"
        >
          <p className="text-xl opacity-90 mb-3 font-medium">إهداء خاص إلى الموجه الأول</p>
          <p className="text-4xl md:text-5xl font-bold mb-3 tracking-tight drop-shadow-lg">الأستاذة هالة بلال</p>
          <p className="text-lg opacity-80 font-medium">موجه أول اللغة العربية - إدارة سوهاج التعليمية</p>
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
      <div className="min-h-screen bg-[#0d1b18] flex items-center justify-center p-4 font-sans" dir="rtl">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#152a25] p-8 rounded-3xl shadow-xl w-full max-w-md border border-emerald-800/30 text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-6">لوحة الإدارة - توليد الأكواد</h2>
          <p className="text-emerald-200/70 mb-4">أحدث كود دخول صالح هو:</p>
          <div className="bg-emerald-900/30 border-2 border-emerald-700/50 rounded-2xl p-6 mb-4">
            <span className="text-5xl font-bold text-emerald-400 tracking-widest">{validCodes[0]?.code || '...'}</span>
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
    <div className="min-h-screen bg-[#0d1b18] flex items-center justify-center p-4 font-sans relative overflow-hidden" dir="rtl">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-900/20 blur-[100px] pointer-events-none"></div>

      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#11221e] p-6 md:p-8 rounded-[2rem] shadow-2xl w-full max-w-[400px] border border-emerald-800/20 relative z-10"
      >
        <div className="flex flex-col items-center mb-4">
          <motion.div 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 rounded-full border border-emerald-700/50 flex items-center justify-center mb-4 bg-emerald-900/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
          >
            <span className="text-4xl font-bold text-emerald-400 font-ruqaa">ع</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-white font-sans text-center mb-1">
            معرب الجمل العربية
          </h1>
          <p className="text-emerald-500 text-center text-sm font-medium mb-1">
            المحلل النحوي الذكي
          </p>
          <p className="text-emerald-400 text-center text-xs font-medium mb-1 opacity-80">
            اعداد أ/علاء الوكيل - معلم خبير
          </p>
          <div className="mt-4 mb-6 px-6 py-6 bg-emerald-900/40 rounded-[2.5rem] border-2 border-emerald-500/30 text-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <p className="text-emerald-100 font-serif leading-relaxed">
              <span className="text-lg block mb-2 opacity-95 font-medium">إهداء خاص إلى الموجه الأول</span>
              <span className="font-bold text-emerald-200 text-3xl block mb-2 drop-shadow-sm">الأستاذة هالة بلال</span>
              <span className="text-sm block opacity-90 font-medium">موجه أول اللغة العربية - إدارة سوهاج التعليمية</span>
            </p>
          </div>


        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-emerald-500 text-sm font-bold px-1">اكتب كود الدخول</label>
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
                className="px-4 text-emerald-400 hover:text-emerald-600 transition-colors"
              >
                <Feather size={20} className={showPassword ? "opacity-100" : "opacity-50"} />
              </motion.button>
            </div>
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-xs mt-1 px-1 font-bold"
              >
                الكود خطا اتصل بالدعم الفنى
              </motion.p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => onLogin(true)}
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
            className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-600 font-medium transition-colors bg-emerald-50 px-4 py-2 rounded-full text-sm border border-emerald-100"
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
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('category_colors');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('category_colors', JSON.stringify(categoryColors));
  }, [categoryColors]);

  const getCategoryStyles = (category: string) => {
    if (!category) return { text: 'text-stone-600', badge: 'bg-stone-50 text-stone-600 border-stone-200', bg: 'bg-stone-50/30', border: 'border-stone-200' };
    
    // Default colors if not customized
    const defaultColors: Record<string, string> = {
      'فعل': 'red',
      'حرف': 'purple',
      'ضمير': 'amber',
      'مرفوع': 'emerald',
      'منصوب': 'orange',
      'مجرور': 'cyan',
      'اسم': 'blue',
    };

    const customColor = Object.entries(categoryColors).find(([key]) => category.includes(key))?.[1];
    const color = customColor || Object.entries(defaultColors).find(([key]) => category.includes(key))?.[1] || 'stone';

    return {
      text: `text-${color}-600`,
      badge: `bg-${color}-50 text-${color}-600 border-${color}-200`,
      bg: `bg-${color}-50/30`,
      border: `border-${color}-100 hover:border-${color}-300`
    };
  };

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<'full' | 'partial' | 'sentence-position' | 'extract' | 'vocative' | 'convert' | 'notes' | 'compare' | 'detailed'>('full');
  const [displayMode, setDisplayMode] = useState<'interactive' | 'table' | 'separated' | 'cards' | 'bubbles' | 'accordion' | 'mindmap' | 'list' | 'carousel' | 'grid'>('interactive');
  const [expandedAccordion, setExpandedAccordion] = useState<number | null>(null);
  const [showDisplayModes, setShowDisplayModes] = useState(false);
  const [selectedBubble, setSelectedBubble] = useState<number | null>(null);
  const [selectedInteractiveWord, setSelectedInteractiveWord] = useState<number | null>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDiacritizing, setIsDiacritizing] = useState(false);
  const [customCategoriesInput, setCustomCategoriesInput] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [sortBy, setSortBy] = useState<'original' | 'word' | 'category' | 'length'>('original');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const ITEMS_PER_PAGE = 24;
  const displayModesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (displayModesRef.current && !displayModesRef.current.contains(event.target as Node)) {
        setShowDisplayModes(false);
      }
    };
    if (showDisplayModes) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDisplayModes]);

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
  
  const [activeTab, setActiveTab] = useState<'parser' | 'rules' | 'poetry' | 'spelling' | 'quiz' | 'saved'>('parser');
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
  
  const [quizTopic, setQuizTopic] = useState('عشوائي');
  const [quizQuestion, setQuizQuestion] = useState<{ question: string, type: string, context: string } | null>(null);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizEvaluation, setQuizEvaluation] = useState<{ isCorrect: boolean, feedback: string, correctAnswer: string } | null>(null);
  const [quizEvalLoading, setQuizEvalLoading] = useState(false);

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
    setDisplayMode('interactive');
    setRuleQuery('');
    setRuleResult('');
    setImage(null);
    setErrorMessage(null);
    setCurrentPage(1);
    setSelectedInteractiveWord(0);
  };

  const handleRemoveWord = (wordToRemove: AnalyzedWord) => {
    setResult(prev => prev.filter(item => item !== wordToRemove));
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    setResult(prev => prev.filter(item => item.category !== categoryToRemove));
    if (filterCategory === categoryToRemove) {
      setFilterCategory(null);
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

  const handleAutoDiacritize = async () => {
    if (!sentence.trim()) return;
    setIsDiacritizing(true);
    setErrorMessage(null);
    try {
      const diacritized = await autoDiacritize(sentence);
      setSentence(diacritized);
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setIsDiacritizing(false);
    }
  };

  const triggerSuccessVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Vibrate for 50ms, pause for 50ms, vibrate for 50ms
      navigator.vibrate([50, 50, 50]);
    }
  };

  const handleGenerateQuiz = async () => {
    setQuizLoading(true);
    setQuizQuestion(null);
    setQuizAnswer('');
    setQuizEvaluation(null);
    try {
      const question = await generateQuizQuestion(quizTopic);
      setQuizQuestion(question);
      triggerSuccessVibration();
    } catch (error) {
      console.error(error);
      setErrorMessage('حدث خطأ أثناء توليد السؤال.');
    } finally {
      setQuizLoading(false);
    }
  };

  const handleEvaluateQuiz = async () => {
    if (!quizAnswer.trim() || !quizQuestion) return;
    
    setQuizEvalLoading(true);
    try {
      const evaluation = await evaluateQuizAnswer(quizQuestion, quizAnswer);
      setQuizEvaluation(evaluation);
      triggerSuccessVibration();
    } catch (error) {
      console.error(error);
      setErrorMessage('حدث خطأ أثناء تقييم الإجابة.');
    } finally {
      setQuizEvalLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!sentence.trim() && !image) return;
    
    setLoading(true);
    setErrorMessage(null);
    setResult([]); // Clear previous result to show loading indicator initially
    setDisplayMode('interactive');
    setCurrentPage(1);
    setSelectedInteractiveWord(0);
    
    try {
      const base64Image = image ? image.split(',')[1] : undefined;
      const customCategories = customCategoriesInput.split('،').map(c => c.trim()).filter(c => c);
      
      let analysis = await analyzeSentence(
        sentence, 
        mode, 
        targetWords, 
        base64Image, 
        showAllFacets,
        customCategories.length > 0 ? customCategories : undefined,
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
      triggerSuccessVibration();
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
      triggerSuccessVibration();
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
      triggerSuccessVibration();
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
        triggerSuccessVibration();
      } else {
        const result = await generateDictation(spellingQuery);
        setDictationResult(result);
        setSpellingResult(null);
        triggerSuccessVibration();
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

  const isFocusMode = activeTab === 'parser' && (result.length > 0 || loading);

  const processedResult = useMemo(() => {
    let res = [...result];
    
    if (filterCategory) {
      res = res.filter(item => item.category === filterCategory);
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      res = res.filter(item => 
        item.analysis.toLowerCase().includes(lowerQuery) || 
        item.word.toLowerCase().includes(lowerQuery) ||
        (item.category && item.category.toLowerCase().includes(lowerQuery))
      );
    }
    
    if (sortBy !== 'original') {
      res.sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'word') {
          comparison = a.word.localeCompare(b.word, 'ar');
        } else if (sortBy === 'category') {
          comparison = (a.category || '').localeCompare(b.category || '', 'ar');
        } else if (sortBy === 'length') {
          comparison = a.word.length - b.word.length;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }
    
    return res;
  }, [result, sortBy, sortOrder, filterCategory, searchQuery]);

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const totalPages = Math.ceil(processedResult.length / ITEMS_PER_PAGE);
  const paginatedResult = processedResult.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <AnimatePresence>
        {showSplash && <Splash onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      
      {!showSplash && (
        <div className="h-screen overflow-hidden bg-[#fdfbf7] font-sans relative flex flex-col md:flex-row" dir="rtl" style={{ fontSize: `${fontSize}px` }}>
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
          <aside className={`w-full md:w-[340px] bg-white border-b md:border-b-0 md:border-l border-stone-200 flex flex-col z-20 shrink-0 shadow-sm relative ${isTrial ? 'md:mt-14' : ''} ${isFocusMode ? 'hidden' : ''}`}>
            <div className="p-4 md:p-6 border-b border-stone-100 flex flex-col xl:flex-row items-center xl:items-start justify-between gap-4 text-center xl:text-right relative">
              <div className="absolute top-4 left-4 z-50">
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.9 }} 
                  onClick={handleLogout} 
                  className="bg-white hover:bg-red-50 text-stone-500 hover:text-red-600 p-2 rounded-full transition-colors shadow-sm border border-stone-200 flex items-center justify-center" 
                  title="تسجيل الخروج"
                >
                  <LogOut size={16} />
                </motion.button>
              </div>
              <div className="flex items-center gap-3 md:gap-4">
                <motion.div 
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shadow-sm shrink-0"
                >
                  <span className="text-xl md:text-2xl font-bold text-brand font-ruqaa">ع</span>
                </motion.div>
                <div className="flex flex-col items-start">
                  <h1 className="text-xl md:text-2xl font-bold text-stone-800 font-ruqaa whitespace-nowrap">
                    معرب الجمل
                  </h1>
                  <span className="text-[10px] md:text-xs font-medium text-stone-500 mt-1 whitespace-nowrap">
                    علاء الوكيل
                  </span>
                </div>
              </div>
              
              <div className="text-[10px] md:text-xs text-stone-400 font-serif leading-relaxed opacity-80 italic whitespace-nowrap hidden md:block">
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
                { id: 'quiz', label: 'اختبر نفسك', icon: <Wand2 size={20} /> },
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
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </motion.button>
              ))}
            </nav>

            <div className="p-4 border-t border-stone-100 flex flex-col gap-3">
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setFontSize(s => Math.min(s + 2, 24))} className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 p-1.5 rounded-lg transition-colors shadow-sm flex justify-center items-center text-sm font-bold" title="تكبير الخط">+</motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setFontSize(s => Math.max(s - 2, 12))} className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 p-1.5 rounded-lg transition-colors shadow-sm flex justify-center items-center text-sm font-bold" title="تصغير الخط">-</motion.button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className={`flex-1 overflow-y-auto relative flex flex-col ${isTrial ? 'md:mt-14' : ''}`}>
            {/* Subtle background pattern/gradient for main app */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-brand/5 to-transparent pointer-events-none"></div>
            
            <div className="p-4 md:p-8 flex-1 flex flex-col">
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto w-full bg-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col flex-1 border border-amber-100 relative z-10"
              >

            {activeTab === 'parser' && (
              <div className="fixed bottom-8 right-8 left-8 z-50 flex items-center justify-end pointer-events-none">
                <motion.div 
                  className="bg-white/90 backdrop-blur-md border border-stone-200 rounded-full shadow-lg p-2 flex flex-row gap-2 items-center pointer-events-auto overflow-hidden max-w-full"
                  initial={false}
                  animate={{ width: isExpanded ? '100%' : '50px' }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-brand text-white shrink-0"
                  >
                    {isExpanded ? <X size={16} /> : <LayoutGrid size={16} />}
                  </button>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-row gap-2 items-center overflow-x-auto hide-scrollbar flex-1"
                        dir="rtl"
                      >
                        {[
                          { id: 'full', label: 'إعراب كامل', icon: <AlignLeft size={16} />, color: 'bg-brand' },
                          { id: 'partial', label: 'إعراب محدد', icon: <TextCursor size={16} />, color: 'bg-blue-600' },
                          { id: 'sentence-position', label: 'موقع الجمل', icon: <MapPin size={16} />, color: 'bg-amber-600' },
                          { id: 'extract', label: 'استخراج', icon: <Filter size={16} />, color: 'bg-purple-600' },
                          { id: 'vocative', label: 'نوع المنادى', icon: <Megaphone size={16} />, color: 'bg-rose-600' },
                          { id: 'convert', label: 'تحويل نحوي', icon: <RefreshCw size={16} />, color: 'bg-cyan-600' },
                          { id: 'notes', label: 'ملاحظات', icon: <StickyNote size={16} />, color: 'bg-indigo-600' },
                          { id: 'compare', label: 'مقارنات', icon: <AlignJustify size={16} />, color: 'bg-pink-600' },
                          { id: 'detailed', label: 'إعراب متقدم', icon: <Sparkles size={16} />, color: 'bg-amber-700' }
                        ].map((m, index) => (
                          <motion.button
                            key={m.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setMode(m.id as any);
                              if (m.id === 'detailed') {
                                setShowAllFacets(true);
                              }
                            }}
                            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full shadow-sm transition-colors whitespace-nowrap border text-sm ${mode === m.id ? `${m.color} text-white border-transparent` : 'bg-white text-stone-700 hover:bg-stone-100 border-stone-200'}`}
                          >
                            <span className="font-medium">{m.label}</span>
                            {m.icon}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
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
                            onClick={handleAutoDiacritize}
                            disabled={isDiacritizing || !sentence.trim()}
                            className={`p-3 rounded-xl transition-all shadow-sm flex items-center gap-2 ${isDiacritizing ? 'bg-stone-100 text-stone-400 cursor-not-allowed' : 'bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20'}`}
                            title="تشكيل تلقائي"
                          >
                            {isDiacritizing ? <Loader2 size={22} className="animate-spin" /> : <Wand2 size={22} />}
                            <span className="text-sm font-bold hidden sm:inline">تشكيل تلقائي</span>
                          </motion.button>
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

                      {(mode === 'full' || mode === 'partial') && (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                            className="flex items-center gap-2 text-sm text-stone-500 hover:text-brand transition-colors w-fit"
                          >
                            {showAdvancedOptions ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
                            خيارات متقدمة (تخصيص التصنيفات)
                          </button>
                          
                          <AnimatePresence>
                            {showAdvancedOptions && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl mt-2">
                                  <label className="block text-sm font-bold text-stone-700 mb-2">
                                    التصنيفات النحوية المخصصة (مفصولة بفاصلة عربية '،')
                                  </label>
                                  <input
                                    type="text"
                                    value={customCategoriesInput}
                                    onChange={(e) => setCustomCategoriesInput(e.target.value)}
                                    placeholder="مثال: اسم، فعل، حرف، مبتدأ، خبر، فاعل..."
                                    className="w-full text-sm p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white"
                                  />
                                  <p className="text-xs text-stone-500 mt-2">
                                    اترك الحقل فارغاً لاستخدام التصنيفات الافتراضية.
                                  </p>
                                  <div className="mt-4">
                                    <label className="block text-sm font-bold text-stone-700 mb-2">
                                      تخصيص ألوان التصنيفات
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                      {['فعل', 'حرف', 'ضمير', 'مرفوع', 'منصوب', 'مجرور', 'اسم'].map(cat => (
                                        <div key={cat} className="flex items-center gap-2">
                                          <span className="text-xs text-stone-600 w-12">{cat}</span>
                                          <select
                                            value={categoryColors[cat] || 'stone'}
                                            onChange={(e) => setCategoryColors({...categoryColors, [cat]: e.target.value})}
                                            className="text-xs p-1 border border-stone-300 rounded flex-1"
                                          >
                                            {['red', 'purple', 'amber', 'emerald', 'orange', 'cyan', 'blue', 'stone'].map(color => (
                                              <option key={color} value={color}>{color}</option>
                                            ))}
                                          </select>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
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
                            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold shadow-md border transition-all ${loading ? 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed' : 'bg-brand text-white border-brand hover:bg-brand-light hover:-translate-x-1'}`}
                          >
                            <ArrowRight size={20} className="rotate-180" /> رجوع
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
                            {saveSuccess ? 'تم الحفظ' : 'حفظ'}
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleCopy} 
                            className="bg-white border border-stone-200 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-stone-50 font-bold shadow-sm"
                          >
                            {copied ? <Check size={18} className="text-brand" /> : <Copy size={18} />}
                            {copied ? 'تم النسخ' : 'نسخ'}
                          </motion.button>
                        </div>
                      </div>

                      <div className="w-full flex flex-col items-center mt-8 mb-8 gap-4">
                        <div className="relative" ref={displayModesRef}>
                          <button
                            onClick={() => setShowDisplayModes(!showDisplayModes)}
                            className="flex items-center gap-3 px-6 py-3 bg-white border border-stone-200 rounded-2xl shadow-sm hover:shadow-md transition-all text-stone-700 font-bold"
                          >
                            <span className="text-stone-500">طريقة العرض:</span>
                            <div className="flex items-center gap-2 text-brand">
                              {(() => {
                                const modes = [
                                  { id: 'interactive', icon: <MousePointerClick size={18} />, label: 'تفاعلي' },
                                  { id: 'cards', icon: <LayoutGrid size={18} />, label: 'بطاقات' },
                                  { id: 'accordion', icon: <List size={18} />, label: 'طي' },
                                  { id: 'bubbles', icon: <MessageCircle size={18} />, label: 'فقاعات' },
                                  { id: 'table', icon: <Table size={18} />, label: 'جدول' },
                                  { id: 'separated', icon: <AlignJustify size={18} />, label: 'فواصل' },
                                  { id: 'mindmap', icon: <Network size={18} />, label: 'خريطة ذهنية' },
                                  { id: 'list', icon: <AlignLeft size={18} />, label: 'قائمة' },
                                  { id: 'carousel', icon: <GalleryHorizontal size={18} />, label: 'دوار' },
                                  { id: 'grid', icon: <Grid size={18} />, label: 'شبكة' }
                                ];
                                const current = modes.find(m => m.id === displayMode);
                                return (
                                  <>
                                    {current?.icon}
                                    <span>{current?.label}</span>
                                  </>
                                );
                              })()}
                            </div>
                            <ChevronDown size={18} className={`text-stone-400 transition-transform ${showDisplayModes ? 'rotate-180' : ''}`} />
                          </button>

                          <AnimatePresence>
                            {showDisplayModes && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute top-full mt-2 right-0 w-64 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 overflow-hidden"
                              >
                                <div className="max-h-80 overflow-y-auto p-2 flex flex-col gap-1">
                                  {[
                                    { id: 'interactive', icon: <MousePointerClick size={18} />, label: 'تفاعلي' },
                                    { id: 'cards', icon: <LayoutGrid size={18} />, label: 'بطاقات' },
                                    { id: 'accordion', icon: <List size={18} />, label: 'طي' },
                                    { id: 'bubbles', icon: <MessageCircle size={18} />, label: 'فقاعات' },
                                    { id: 'table', icon: <Table size={18} />, label: 'جدول' },
                                    { id: 'separated', icon: <AlignJustify size={18} />, label: 'فواصل' },
                                    { id: 'mindmap', icon: <Network size={18} />, label: 'خريطة ذهنية' },
                                    { id: 'list', icon: <AlignLeft size={18} />, label: 'قائمة' },
                                    { id: 'carousel', icon: <GalleryHorizontal size={18} />, label: 'دوار' },
                                    { id: 'grid', icon: <Grid size={18} />, label: 'شبكة' }
                                  ].map((mode) => (
                                    <button
                                      key={mode.id}
                                      onClick={() => {
                                        setDisplayMode(mode.id as any);
                                        setShowDisplayModes(false);
                                      }}
                                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${displayMode === mode.id ? 'bg-brand/10 text-brand font-bold' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                                    >
                                      <div className={displayMode === mode.id ? 'text-brand' : 'text-stone-400'}>
                                        {mode.icon}
                                      </div>
                                      <span>{mode.label}</span>
                                      {displayMode === mode.id && <Check size={16} className="mr-auto text-brand" />}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Filter & Sort Options */}
                        <div className="flex flex-col gap-4 mt-4 w-full max-w-4xl bg-white p-4 rounded-xl border border-stone-200 shadow-sm" dir="rtl">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="relative w-full sm:w-64">
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <Search size={16} className="text-stone-400" />
                              </div>
                              <input
                                type="text"
                                placeholder="ابحث في الإعراب أو الكلمات..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-3 pr-10 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
                              />
                              {searchQuery && (
                                <button
                                  onClick={() => setSearchQuery('')}
                                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-stone-400 hover:text-stone-600"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-stone-600 flex items-center gap-1">
                                <ArrowUpDown size={16} /> ترتيب حسب:
                              </span>
                              <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="text-sm p-2 rounded-lg border border-stone-200 bg-stone-50 focus:ring-2 focus:ring-brand/20 outline-none"
                              >
                                <option value="original">الترتيب الأصلي</option>
                                <option value="word">الكلمة أبجدياً</option>
                                <option value="category">التصنيف</option>
                                <option value="length">طول الكلمة</option>
                              </select>
                              
                              {sortBy !== 'original' && (
                                <button
                                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                  className="p-2 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 transition-colors"
                                  title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
                                >
                                  {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  const shareData = {
                                    title: 'نتائج إعراب الجملة',
                                    text: `إليك نتائج إعراب الجملة: "${sentence}"\n\n${result.map(r => `${r.word}: ${r.analysis}`).join('\n')}`,
                                    url: window.location.href,
                                  };
                                  try {
                                    if (navigator.share) {
                                      await navigator.share(shareData);
                                    } else {
                                      await navigator.clipboard.writeText(`${shareData.text}\n\n${shareData.url}`);
                                      alert('تم نسخ الرابط والنتائج إلى الحافظة!');
                                    }
                                  } catch (err) {
                                    console.error('Error sharing:', err);
                                  }
                                }}
                                className="p-2 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 transition-colors"
                                title="مشاركة"
                              >
                                <Share2 size={18} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-stone-100">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-stone-600 flex items-center gap-1">
                                <Filter size={16} /> تصفية:
                              </span>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setFilterCategory(null)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${filterCategory === null ? 'bg-stone-800 text-white border-stone-800' : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'}`}
                                >
                                  الكل
                                </button>
                                {Array.from(new Set(result.map(item => item.category))).filter(Boolean).map((category, idx) => (
                                  <div key={idx} className="flex items-center">
                                    <button
                                      onClick={() => setFilterCategory(filterCategory === category ? null : category)}
                                      className={`px-3 py-1.5 rounded-r-full text-xs font-bold transition-all border border-l-0 ${filterCategory === category ? 'bg-brand text-white border-brand shadow-md' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'}`}
                                    >
                                      {category}
                                    </button>
                                    <button
                                      onClick={() => handleRemoveCategory(category)}
                                      className={`px-2 py-1.5 rounded-l-full text-xs transition-all border border-r-0 flex items-center justify-center ${filterCategory === category ? 'bg-brand text-white border-brand hover:bg-red-500 hover:border-red-500' : 'bg-white text-stone-400 border-stone-200 hover:bg-red-50 hover:text-red-500'}`}
                                      title="حذف هذا التصنيف"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
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
                          {displayMode === 'interactive' ? (
                        <div className="flex flex-col gap-8 p-8 items-center">
                          <div className="flex flex-wrap justify-center gap-3 rtl leading-loose">
                            {paginatedResult.map((item, index) => {
                              return (
                                <motion.button
                                  key={index}
                                  whileHover={{ scale: 1.05, y: -2 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setSelectedInteractiveWord(index)}
                                  className={`text-2xl md:text-4xl font-serif font-bold px-4 py-2 rounded-2xl transition-all ${selectedInteractiveWord === index ? 'bg-brand text-white shadow-lg scale-110' : `bg-white ${getCategoryStyles(item.category).text} hover:bg-stone-100 shadow-sm border border-stone-200`}`}
                                >
                                  {colorizeDiacritics(item.word)}
                                </motion.button>
                              );
                            })}
                          </div>
                          
                          <AnimatePresence mode="wait">
                            {selectedInteractiveWord !== null && paginatedResult[selectedInteractiveWord] && (
                              <motion.div
                                key={selectedInteractiveWord}
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                transition={{ type: "spring", bounce: 0.4 }}
                                className={`w-full max-w-3xl p-8 rounded-3xl shadow-xl border ${getCategoryStyles(paginatedResult[selectedInteractiveWord].category).bg} ${getCategoryStyles(paginatedResult[selectedInteractiveWord].category).border}`}
                              >
                                <div className="flex justify-between items-center mb-6 border-b border-stone-200/50 pb-4">
                                  <div className="flex items-center gap-4">
                                    <h3 className={`text-3xl font-serif font-bold ${getCategoryStyles(paginatedResult[selectedInteractiveWord].category).text}`}>
                                      {colorizeDiacritics(paginatedResult[selectedInteractiveWord].word)}
                                    </h3>
                                    <button
                                      onClick={() => {
                                        handleRemoveWord(paginatedResult[selectedInteractiveWord]);
                                        setSelectedInteractiveWord(null);
                                      }}
                                      className="p-2 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                      title="حذف هذه الكلمة"
                                    >
                                      <X size={20} />
                                    </button>
                                  </div>
                                  <span className={`px-4 py-2 rounded-full text-sm font-bold border ${getCategoryStyles(paginatedResult[selectedInteractiveWord].category).badge}`}>
                                    {paginatedResult[selectedInteractiveWord].category}
                                  </span>
                                </div>
                                <div className="text-2xl leading-[2.2] text-stone-900 font-serif bg-white/60 p-6 rounded-2xl shadow-sm border border-white/50">
                                  {isChallengeMode ? '...' : <AnalysisText text={paginatedResult[selectedInteractiveWord].analysis} />}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : displayMode === 'bubbles' ? (
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
                            {paginatedResult.map((item, index) => (
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
                                        <div className="flex items-center gap-1">
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={(e) => { e.stopPropagation(); handleRemoveWord(item); setSelectedBubble(null); }}
                                            className="text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors p-1 rounded-full"
                                            title="حذف هذه الكلمة"
                                          >
                                            <Trash2 size={16} />
                                          </motion.button>
                                          <motion.button 
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedBubble(null); }}
                                            className="text-stone-400 hover:text-stone-600 transition-colors p-1 rounded-full"
                                          >
                                            <X size={18} />
                                          </motion.button>
                                        </div>
                                      </div>
                                      
                                      <div className="text-center mb-4">
                                        <div className="text-2xl font-bold font-serif text-stone-800">
                                          {colorizeDiacritics(item.word)}
                                        </div>
                                      </div>
                                      
                                      <div className="text-stone-900 leading-[1.8] text-center border-t border-stone-100 pt-4 font-serif" style={{ fontSize: '1.15em' }}>
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
                          {paginatedResult.map((item, index) => (
                            <AnalysisCard
                              key={index}
                              index={index}
                              word={colorizeDiacritics(item.word)}
                              analysis={isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                              category={item.category}
                              categoryStyles={getCategoryStyles(item.category)}
                              onRemove={() => handleRemoveWord(item)}
                            />
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
                                <th className="p-4 font-bold w-12"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedResult.map((item, index) => (
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
                                  <td className="p-5 text-stone-900 leading-[1.8] font-serif min-w-[300px]" style={{ fontSize: '1.25em' }}>
                                    {isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                                  </td>
                                  <td className="p-5 text-center">
                                    <button
                                      onClick={() => handleRemoveWord(item)}
                                      className="p-2 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                      title="حذف هذه الكلمة"
                                    >
                                      <X size={18} />
                                    </button>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : displayMode === 'accordion' ? (
                        <div className="flex flex-col gap-3 p-4">
                          {paginatedResult.map((item, index) => (
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
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRemoveWord(item); }}
                                    className="p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="حذف هذه الكلمة"
                                  >
                                    <X size={18} />
                                  </button>
                                  <ChevronDown size={20} className={`text-stone-400 transition-transform duration-300 ${expandedAccordion === index ? 'rotate-180' : ''}`} />
                                </div>
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
                                      <div className="text-stone-900 leading-[1.8] font-serif text-right mt-4" style={{ fontSize: '1.2em' }}>
                                        {isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      ) : displayMode === 'mindmap' ? (
                        <MindmapView 
                          sentence={sentence} 
                          result={paginatedResult} 
                          getCategoryStyles={getCategoryStyles} 
                          colorizeDiacritics={colorizeDiacritics} 
                          onRemove={handleRemoveWord}
                        />
                      ) : displayMode === 'list' ? (
                        <div className="flex flex-col gap-2 p-4">
                          {paginatedResult.map((item, index) => (
                            <motion.div
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              key={index}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border shadow-sm group relative gap-4 ${getCategoryStyles(item.category).bg} ${getCategoryStyles(item.category).border}`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-grow">
                                <div className="flex items-center justify-between sm:w-48 shrink-0">
                                  <span className={`font-bold font-serif ${getCategoryStyles(item.category).text}`} style={{ fontSize: '1.25em' }}>
                                    {colorizeDiacritics(item.word)}
                                  </span>
                                  <span className={`px-3 py-1 rounded-full border font-bold text-xs whitespace-nowrap ${getCategoryStyles(item.category).badge}`}>
                                    {item.category}
                                  </span>
                                </div>
                                <div className="text-stone-900 leading-[1.8] font-serif flex-grow text-right sm:pr-4 sm:border-r border-stone-200/50 pt-2 sm:pt-0 border-t sm:border-t-0" style={{ fontSize: '1.15em' }}>
                                  {isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveWord(item)}
                                className="absolute top-2 left-2 sm:static p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors sm:opacity-0 group-hover:opacity-100 shrink-0 sm:mr-4"
                                title="حذف هذه الكلمة"
                              >
                                <X size={16} />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      ) : displayMode === 'carousel' ? (
                        <div className="flex overflow-x-auto gap-6 p-4 pb-8 hide-scrollbar snap-x snap-mandatory" dir="rtl">
                          {paginatedResult.map((item, index) => (
                            <motion.div
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.05 }}
                              key={index}
                              className={`shrink-0 w-80 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4 group border relative snap-center ${getCategoryStyles(item.category).bg} ${getCategoryStyles(item.category).border}`}
                            >
                              <button
                                onClick={() => handleRemoveWord(item)}
                                className="absolute top-4 left-4 p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 z-10"
                                title="حذف هذه الكلمة"
                              >
                                <X size={16} />
                              </button>
                              <div className="flex justify-between items-center border-b border-stone-100 pb-4">
                                <h3 className={`font-bold font-serif ${getCategoryStyles(item.category).text}`} style={{ fontSize: '1.75em' }}>
                                  {colorizeDiacritics(item.word)}
                                </h3>
                                <span className={`px-3 py-1 rounded-full border font-bold text-xs ${getCategoryStyles(item.category).badge}`}>
                                  {item.category}
                                </span>
                              </div>
                              <div className="text-stone-900 leading-[1.8] font-serif text-right overflow-y-auto max-h-48 hide-scrollbar" style={{ fontSize: '1.2em' }}>
                                {isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : displayMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                          {paginatedResult.map((item, index) => (
                            <motion.div
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.05 }}
                              key={index}
                              className={`p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group border relative ${getCategoryStyles(item.category).bg} ${getCategoryStyles(item.category).border}`}
                            >
                              <button
                                onClick={() => handleRemoveWord(item)}
                                className="absolute top-3 left-3 p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 z-10"
                                title="حذف هذه الكلمة"
                              >
                                <X size={16} />
                              </button>
                              <div className="flex flex-col gap-2 border-b border-stone-100 pb-3">
                                <h3 className={`font-bold font-serif ${getCategoryStyles(item.category).text}`} style={{ fontSize: '1.5em' }}>
                                  {colorizeDiacritics(item.word)}
                                </h3>
                                <span className={`self-start px-2.5 py-1 rounded-full border font-bold text-[10px] ${getCategoryStyles(item.category).badge}`}>
                                  {item.category}
                                </span>
                              </div>
                              <div className="text-stone-900 leading-[1.8] font-serif text-right" style={{ fontSize: '1.1em' }}>
                                {isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-4 p-4">
                          {paginatedResult.map((item, index) => (
                            <motion.div 
                              layout
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              key={index}
                              className={`bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex items-start gap-4 hover:border-brand/20 transition-colors relative group`}
                            >
                              <button
                                onClick={() => handleRemoveWord(item)}
                                className="absolute top-4 left-4 p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                title="حذف هذه الكلمة"
                              >
                                <X size={16} />
                              </button>
                              <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-bold font-serif text-xl ${getCategoryStyles(item.category).badge}`}>
                                {colorizeDiacritics(item.word.charAt(0))}
                              </div>
                              <div className="flex-grow">
                                <h4 className={`font-bold font-serif text-xl mb-1 ${getCategoryStyles(item.category).text}`}>
                                  {colorizeDiacritics(item.word)}
                                </h4>
                                <p className="text-stone-900 leading-[1.8] font-serif text-lg">
                                  {isChallengeMode ? '...' : <AnalysisText text={item.analysis} />}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                        </motion.div>
                      </AnimatePresence>
                      
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 py-6 border-t border-stone-100 mt-4" dir="rtl">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setSelectedInteractiveWord(0); }}
                            disabled={currentPage === 1}
                            className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-50 shadow-sm"
                          >
                            <ChevronRight size={24} />
                          </motion.button>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-stone-500 font-medium">صفحة</span>
                            <span className="bg-brand/10 text-brand font-bold px-3 py-1 rounded-lg min-w-[2.5rem] text-center">
                              {currentPage}
                            </span>
                            <span className="text-stone-500 font-medium">من</span>
                            <span className="font-bold text-stone-700">{totalPages}</span>
                          </div>
                          
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setSelectedInteractiveWord(0); }}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-50 shadow-sm"
                          >
                            <ChevronLeft size={24} />
                          </motion.button>
                        </div>
                      )}
                      
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
            {activeTab === 'quiz' && (
              <motion.div key="quiz" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-6">
                <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2 mb-4">
                  <Wand2 className="text-brand" />
                  اختبر نفسك
                </h2>
                
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col gap-4">
                  <label className="font-bold text-stone-700">اختر موضوع الاختبار:</label>
                  <select 
                    value={quizTopic} 
                    onChange={(e) => setQuizTopic(e.target.value)}
                    className="p-4 text-lg border-2 border-stone-200 rounded-xl focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none bg-stone-50/50"
                  >
                    <option value="عشوائي">عشوائي (شامل)</option>
                    <option value="اسم الفاعل">اسم الفاعل</option>
                    <option value="اسم المفعول">اسم المفعول</option>
                    <option value="صيغ المبالغة">صيغ المبالغة</option>
                    <option value="اسم الآلة">اسم الآلة</option>
                    <option value="الحال">الحال (مفرد، جملة، شبه جملة)</option>
                    <option value="التمييز">التمييز</option>
                    <option value="المنادى">المنادى</option>
                    <option value="الممنوع من الصرف">الممنوع من الصرف</option>
                  </select>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGenerateQuiz}
                    disabled={quizLoading}
                    className="bg-brand text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-brand/30 hover:bg-brand-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {quizLoading ? <Loader2 className="animate-spin" /> : <Wand2 />}
                    {quizLoading ? 'جاري توليد السؤال...' : 'ابدأ التحدي'}
                  </motion.button>
                </div>

                <AnimatePresence>
                  {quizQuestion && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col gap-6">
                      <div className="bg-stone-50 p-6 rounded-xl border border-stone-100">
                        <span className="inline-block bg-brand/10 text-brand px-3 py-1 rounded-lg text-sm font-bold mb-4">
                          {quizQuestion.type}
                        </span>
                        <p className="text-xl md:text-2xl font-serif leading-loose text-stone-800">
                          {colorizeDiacritics(quizQuestion.question)}
                        </p>
                        {quizQuestion.context && (
                          <p className="text-stone-500 mt-4 text-sm bg-white p-3 rounded-lg border border-stone-200">
                            {quizQuestion.context}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-4">
                        <textarea
                          value={quizAnswer}
                          onChange={(e) => setQuizAnswer(e.target.value)}
                          placeholder="اكتب إجابتك هنا..."
                          className="w-full min-h-[120px] text-lg p-4 border-2 border-stone-200 rounded-xl focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none resize-y bg-stone-50/50"
                        />
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleEvaluateQuiz}
                          disabled={quizEvalLoading || !quizAnswer.trim()}
                          className="bg-stone-800 text-white py-3 px-6 rounded-xl font-bold hover:bg-stone-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 self-end"
                        >
                          {quizEvalLoading ? <Loader2 className="animate-spin" /> : <Check />}
                          تحقق من الإجابة
                        </motion.button>
                      </div>

                      <AnimatePresence>
                        {quizEvaluation && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={`p-6 rounded-xl border ${quizEvaluation.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-3 mb-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${quizEvaluation.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {quizEvaluation.isCorrect ? <Check size={24} /> : <X size={24} />}
                              </div>
                              <h3 className={`text-xl font-bold ${quizEvaluation.isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                                {quizEvaluation.isCorrect ? 'إجابة صحيحة! أحسنت' : 'إجابة غير دقيقة'}
                              </h3>
                            </div>
                            
                            <div className="space-y-4 text-stone-800 leading-relaxed font-serif text-lg">
                              <p>{quizEvaluation.feedback}</p>
                              {!quizEvaluation.isCorrect && (
                                <div className="bg-white p-4 rounded-lg border border-red-100 mt-4">
                                  <span className="font-bold text-red-800 block mb-2">الإجابة النموذجية:</span>
                                  {quizEvaluation.correctAnswer}
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-6 flex justify-end">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleGenerateQuiz}
                                className="bg-white border border-stone-200 text-stone-700 px-6 py-2 rounded-lg font-bold hover:bg-stone-50 transition-colors shadow-sm"
                              >
                                سؤال آخر
                              </motion.button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
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
                               item.mode === 'vocative' ? 'منادى' : 
                               item.mode === 'detailed' ? 'إعراب متقدم' : item.mode}
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
    </>
  );
}
