import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronDown } from 'lucide-react';

interface AnalysisCardProps {
  word: React.ReactNode;
  analysis: React.ReactNode;
  category?: string;
  index: number;
  categoryStyles?: {
    bg: string;
    border: string;
    text: string;
    badge: string;
  };
  onRemove?: () => void;
  isExpandable?: boolean;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ word, analysis, category, index, categoryStyles, onRemove, isExpandable = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const styles = categoryStyles || {
    bg: 'bg-white',
    border: 'border-stone-200',
    text: 'text-brand',
    badge: 'bg-stone-100 text-stone-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 100 }}
      whileHover={{ y: -5, scale: 1.02 }}
      className={`p-6 rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 flex flex-col gap-4 group border-2 relative overflow-hidden bg-gradient-to-br from-white to-stone-50 ${styles.border}`}
      dir="rtl"
    >
      <div className={`absolute top-0 right-0 w-2 h-full transition-opacity duration-300 opacity-50 group-hover:opacity-100 ${styles.bg}`}></div>
      
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-4 left-4 p-2 rounded-full bg-white/90 text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all z-10 shadow-sm opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
          title="حذف هذه الكلمة"
        >
          <X size={16} />
        </button>
      )}
      
      <div className="flex justify-between items-start border-b border-stone-100/80 pb-4 relative z-10">
        <h3 className={`font-bold font-serif group-hover:translate-x-[-4px] transition-transform duration-300 ${styles.text}`} style={{ fontSize: '1.85em' }}>
          {word}
        </h3>
        {category && (
          <span className={`px-4 py-1.5 rounded-full border font-bold text-sm shadow-sm backdrop-blur-sm ${styles.badge}`}>
            {category}
          </span>
        )}
      </div>
      
      <div className="text-stone-800 leading-[1.9] font-serif text-right relative z-10" style={{ fontSize: '1.25em' }}>
        {isExpandable ? (
          <div className="flex flex-col gap-2">
            <div className={`transition-all duration-300 ${!isExpanded ? 'line-clamp-3' : ''}`}>
              {analysis}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              className="text-sm font-bold text-brand hover:text-brand/80 self-start mt-2 flex items-center gap-1 bg-brand/5 px-3 py-1.5 rounded-full transition-colors"
            >
              {isExpanded ? 'عرض أقل' : 'قراءة المزيد'}
              <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        ) : (
          analysis
        )}
      </div>
    </motion.div>
  );
};
