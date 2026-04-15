import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

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
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ word, analysis, category, index, categoryStyles, onRemove }) => {
  const styles = categoryStyles || {
    bg: 'bg-white',
    border: 'border-stone-200',
    text: 'text-brand',
    badge: 'bg-stone-100 text-stone-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col gap-4 group border relative ${styles.bg} ${styles.border}`}
      dir="rtl"
    >
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-4 left-4 p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors z-10"
          title="حذف هذه الكلمة"
        >
          <X size={16} />
        </button>
      )}
      <div className="flex justify-between items-center border-b border-stone-100 pb-4">
        <h3 className={`font-bold font-serif group-hover:scale-105 transition-transform ${styles.text}`} style={{ fontSize: '1.75em' }}>
          {word}
        </h3>
        {category && (
          <span className={`px-4 py-1.5 rounded-full border font-bold text-xs ${styles.badge}`}>
            {category}
          </span>
        )}
      </div>
      <div className="text-stone-900 leading-[1.8] font-serif text-right" style={{ fontSize: '1.2em' }}>
        {analysis}
      </div>
    </motion.div>
  );
};
