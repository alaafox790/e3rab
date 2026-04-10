import { AnalyzedWord, SpellingResult } from "../types";

// نظام تخزين مؤقت متطور يحفظ النتائج في localStorage لسرعة الوصول وتقليل استهلاك الـ API
const CACHE_NAME = 'arabic_grammar_app_cache_v1';
const MAX_CACHE_ITEMS = 50;

const getPersistentCache = (): Map<string, any> => {
  try {
    const saved = localStorage.getItem(CACHE_NAME);
    if (saved) {
      const parsed = JSON.parse(saved);
      return new Map(parsed);
    }
  } catch (e) {
    console.warn("Failed to load cache from localStorage", e);
  }
  return new Map();
};

const savePersistentCache = (cache: Map<string, any>) => {
  try {
    // الحفاظ على حجم معقول للتخزين المؤقت
    if (cache.size > MAX_CACHE_ITEMS) {
      const keys = Array.from(cache.keys());
      for (let i = 0; i < cache.size - MAX_CACHE_ITEMS; i++) {
        cache.delete(keys[i]);
      }
    }
    localStorage.setItem(CACHE_NAME, JSON.stringify(Array.from(cache.entries())));
  } catch (e) {
    console.warn("Failed to save cache to localStorage", e);
  }
};

const apiCache = getPersistentCache();

export async function analyzeSentence(
  sentence: string, 
  mode: 'full' | 'partial' | 'sentence-position' | 'extract' | 'vocative' | 'convert' | 'notes' | 'compare' | 'detailed', 
  targetWords?: string, 
  image?: string, 
  showAllFacets?: boolean, 
  onChunk?: (words: AnalyzedWord[]) => void
): Promise<AnalyzedWord[]> {
  const cacheKey = `analyze_${mode}_${sentence.trim()}_${targetWords?.trim() || ''}_${image ? 'with_image' : 'no_image'}_${showAllFacets ? 'all_facets' : 'normal'}`;
  
  if (apiCache.has(cacheKey)) {
    const cached = apiCache.get(cacheKey);
    if (onChunk) {
      // محاكاة التدفق للنتائج المخزنة لتحسين تجربة المستخدم
      onChunk(cached);
    }
    return cached;
  }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence, mode, targetWords, image, showAllFacets })
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = 'Failed to analyze sentence';
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulatedText = "";
    let finalResult: AnalyzedWord[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      accumulatedText += decoder.decode(value, { stream: true });
      
      // Extract complete JSON objects using regex
      const matches = accumulatedText.match(/\{[^{}]+\}/g);
      if (matches) {
        const parsedWords: AnalyzedWord[] = [];
        for (const match of matches) {
          try {
            parsedWords.push(JSON.parse(match));
          } catch (e) {
            // Ignore incomplete JSON objects
          }
        }
        if (parsedWords.length > 0) {
          finalResult = parsedWords;
          if (onChunk) onChunk(finalResult);
        }
      }
    }

    // Try to parse the whole text just in case the regex missed something at the end
    try {
      const fullParsed = JSON.parse(accumulatedText);
      if (Array.isArray(fullParsed)) {
        finalResult = fullParsed;
      }
    } catch (e) {
      // It's okay if it fails, we rely on the incremental parsing
    }

    apiCache.set(cacheKey, finalResult);
    savePersistentCache(apiCache);
    return finalResult;
  } catch (error: any) {
    console.error("API Error:", error);
    const errorMessage = error.message || String(error);
    
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
    savePersistentCache(apiCache);
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
    savePersistentCache(apiCache);
    return finalResult;
  } catch (error: any) {
    console.error("API Error:", error);
    return "فقد الاتصال بالخادم. يرجى التأكد من جودة اتصالك بالإنترنت والمحاولة مجدداً.";
  }
}

export async function analyzeSpelling(text: string, retryCount = 0): Promise<SpellingResult> {
  const cacheKey = `spelling_${text.trim()}`;
  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey);
  }

  try {
    const response = await fetch('/api/spelling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const responseText = await response.text();
    if (!response.ok) {
      let errorMessage = 'Failed to analyze spelling';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = JSON.parse(responseText);
    const finalResult: SpellingResult = {
      correctedText: data.correctedText || 'عذراً، لم أتمكن من تصحيح هذا النص.',
      corrections: data.corrections || []
    };
    apiCache.set(cacheKey, finalResult);
    savePersistentCache(apiCache);
    return finalResult;
  } catch (error: any) {
    console.error("API Error:", error);
    throw new Error("فقد الاتصال بالخادم. يرجى التأكد من جودة اتصالك بالإنترنت والمحاولة مجدداً.");
  }
}

export async function generateDictation(ruleName: string, retryCount = 0): Promise<string> {
  const cacheKey = `dictation_${ruleName.trim()}`;
  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey);
  }

  try {
    const response = await fetch('/api/dictation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleName })
    });

    const text = await response.text();
    if (!response.ok) {
      let errorMessage = 'Failed to generate dictation';
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = JSON.parse(text);
    const finalResult = data.text || 'عذراً، لم أتمكن من إنشاء قطعة إملاء.';
    apiCache.set(cacheKey, finalResult);
    savePersistentCache(apiCache);
    return finalResult;
  } catch (error: any) {
    console.error("API Error:", error);
    return "فقد الاتصال بالخادم. يرجى التأكد من جودة اتصالك بالإنترنت والمحاولة مجدداً.";
  }
}
