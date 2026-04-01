export interface AnalyzedWord {
  word: string;
  category: 'فعل' | 'اسم' | 'مرفوع' | 'منصوب' | 'مجزوم' | 'مجرور' | 'أخرى' | 'جملة' | 'استخراج' | 'منادى' | 'تحويل' | 'ملاحظات' | 'مقارنة';
  analysis: string;
}

export interface SpellingCorrection {
  original: string;
  corrected: string;
  reason: string;
}

export interface SpellingResult {
  correctedText: string;
  corrections: SpellingCorrection[];
}
