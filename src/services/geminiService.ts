import { AnalyzedWord } from "../types";

// نظام تخزين مؤقت لحفظ النتائج السابقة وتقليل الضغط على السيرفر
const apiCache = new Map<string, any>();

export async function analyzeSentence(sentence: string, mode: 'full' | 'partial' | 'sentence-position' | 'extract' | 'vocative' | 'convert', targetWords?: string, image?: string, retryCount = 0): Promise<AnalyzedWord[]> {
  const cacheKey = `analyze_${mode}_${sentence.trim()}_${targetWords?.trim() || ''}_${image ? 'with_image' : 'no_image'}`;
  
  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey);
  }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence, mode, targetWords, image })
    });

    const text = await response.text();
    if (!response.ok) {
      let errorMessage = 'Failed to analyze sentence';
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    try {
      const finalResult = JSON.parse(text) as AnalyzedWord[];
      apiCache.set(cacheKey, finalResult);
      return finalResult;
    } catch (e) {
      console.error("Failed to parse JSON response:", text);
      throw new Error(`استجابة غير صالحة من السيرفر: ${text.substring(0, 100)}`);
    }
  } catch (error: any) {
    console.error("API Error:", error);
    const errorMessage = error.message || String(error);
    
    const isRateLimit = errorMessage.includes("429") || errorMessage.includes("Too Many Requests") || errorMessage.includes("quota");
    
    if (isRateLimit) {
       throw new Error("عذراً، تم تجاوز الحد المجاني للطلبات (15 طلب/دقيقة). يرجى الانتظار نصف دقيقة ثم المحاولة.");
    }
    
    // إظهار رسالة الخطأ الحقيقية إذا كانت متوفرة
    if (errorMessage && errorMessage !== "Failed to fetch") {
      throw new Error(`خطأ في السيرفر: ${errorMessage}`);
    }
    
    throw new Error("فقد الاتصال بالخادم. يرجى التأكد من تشغيل السيرفر وجودة اتصالك بالإنترنت.");
  }
}

export async function searchGrammarRule(ruleName: string, retryCount = 0): Promise<string> {
  const cacheKey = `rule_${ruleName.trim()}`;
  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey);
  }

  try {
    const response = await fetch('/api/rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleName })
    });

    const text = await response.text();
    if (!response.ok) {
      let errorMessage = 'Failed to search rule';
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = JSON.parse(text);
    const finalResult = data.text || 'عذراً، لم أتمكن من العثور على شرح لهذه القاعدة.';
    apiCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (error: any) {
    console.error("API Error:", error);
    return "فقد الاتصال بالخادم. يرجى التأكد من جودة اتصالك بالإنترنت والمحاولة مجدداً.";
  }
}

export async function analyzePoetry(verse: string, retryCount = 0): Promise<string> {
  const cacheKey = `poetry_${verse.trim()}`;
  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey);
  }

  try {
    const response = await fetch('/api/poetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verse })
    });

    const text = await response.text();
    if (!response.ok) {
      let errorMessage = 'Failed to analyze poetry';
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = JSON.parse(text);
    const finalResult = data.text || 'عذراً، لم أتمكن من تحليل هذا البيت.';
    apiCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (error: any) {
    console.error("API Error:", error);
    return "فقد الاتصال بالخادم. يرجى التأكد من جودة اتصالك بالإنترنت والمحاولة مجدداً.";
  }
}
