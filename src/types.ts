export interface AnalyzedWord {
  word: string;
  category: 'فعل' | 'اسم' | 'مرفوع' | 'منصوب' | 'مجزوم' | 'مجرور' | 'أخرى' | 'جملة' | 'استخراج' | 'منادى' | 'تحويل';
  analysis: string;
}
