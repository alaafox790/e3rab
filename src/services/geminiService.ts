import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

// نظام تخزين مؤقت لحفظ النتائج السابقة وتقليل الضغط على السيرفر
const apiCache = new Map<string, any>();

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("عذراً، مفتاح API غير متوفر. يرجى إضافة GEMINI_API_KEY في إعدادات البيئة (Environment Variables) في Vercel.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface AnalyzedWord {
  word: string;
  category: 'فعل' | 'اسم' | 'مرفوع' | 'منصوب' | 'مجزوم' | 'مجرور' | 'أخرى' | 'جملة' | 'استخراج' | 'منادى' | 'تحويل';
  analysis: string;
}

export async function analyzeSentence(sentence: string, mode: 'full' | 'partial' | 'sentence-position' | 'extract' | 'vocative' | 'convert', targetWords?: string, image?: string, retryCount = 0): Promise<AnalyzedWord[]> {
  const cacheKey = `analyze_${mode}_${sentence.trim()}_${targetWords?.trim() || ''}_${image ? 'with_image' : 'no_image'}`;
  
  // التحقق مما إذا كانت النتيجة موجودة في الذاكرة المؤقتة
  if (apiCache.has(cacheKey)) {
    console.log("Returning cached result for analyzeSentence");
    return apiCache.get(cacheKey);
  }

  let prompt = '';
  if (mode === 'full') {
    prompt = `قم بإعراب الجملة التالية إعراباً تفصيلياً، مع التشكيل الكامل لكل كلمة: "${sentence}".`;
  } else if (mode === 'partial') {
    prompt = `قم بإعراب الكلمات التالية فقط من الجملة "${sentence}" مع التشكيل الكامل: "${targetWords}".`;
  } else if (mode === 'sentence-position') {
    prompt = `استخرج الجمل الفرعية في الجملة التالية: "${sentence}"، وبين موقعها من الإعراب (لها محل أو ليس لها محل) مع التعليل.`;
  } else if (mode === 'extract') {
    prompt = `استخرج من النص التالي: "${sentence}" المطلوب الآتي: "${targetWords}".
    في حقل word ضع الكلمة المستخرجة، وفي حقل category اختر 'استخراج'، وفي حقل analysis ضع نوع الاستخراج (مثلاً: اسم فاعل) وسببه أو وزنه أو فعله.`;
  } else if (mode === 'vocative') {
    prompt = `استخرج المنادى من الجملة أو النص التالي: "${sentence}" وبين نوعه (مضاف، شبيه بالمضاف، نكرة مقصودة، نكرة غير مقصودة، علم مفرد) وحكمه الإعرابي.
    في حقل word ضع المنادى، وفي حقل category اختر 'منادى'، وفي حقل analysis ضع نوعه وحكمه الإعرابي.`;
  } else if (mode === 'convert') {
    prompt = `قم بالتحويل النحوي المطلوب على الجملة التالية: "${sentence}".
    المطلوب: "${targetWords}". (مثال: حول الجملة الاسمية إلى فعلية، أو حول الحال المفرد إلى جملة، إلخ).
    في حقل word ضع الجملة بعد التحويل، وفي حقل category اختر 'تحويل'، وفي حقل analysis اشرح ما قمت به باختصار مع ذكر التغييرات الإعرابية التي حدثت.`;
  }

  const contents: any[] = [];
  if (image) {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: image,
      },
    });
  }
  contents.push({ text: prompt });

  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING, description: "الكلمة أو الجملة" },
              category: { 
                type: Type.STRING, 
                description: "يجب أن تكون إحدى القيم التالية: فعل، اسم، مرفوع، منصوب، مجزوم، مجرور، أخرى، جملة، استخراج، منادى، تحويل"
              },
              analysis: { type: Type.STRING, description: "الإعراب أو الموقع الإعرابي" }
            },
            required: ['word', 'category', 'analysis']
          }
        }
      }
    });
    
    const finalResult = JSON.parse(response.text || '[]') as AnalyzedWord[];
    apiCache.set(cacheKey, finalResult); // حفظ النتيجة في الذاكرة المؤقتة
    return finalResult;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorMessage = error.message || String(error);
    
    // لا نقم بإعادة المحاولة إذا كان الخطأ 429 (تجاوز الحد) لأن ذلك يضاعف المشكلة
    const isRateLimit = errorMessage.includes("429") || errorMessage.includes("Too Many Requests") || errorMessage.includes("quota");
    const isRetryable = !isRateLimit && (errorMessage.includes("500") || errorMessage.includes("503") || errorMessage.includes("Internal error") || errorMessage.includes("fetch failed") || errorMessage.includes("network") || errorMessage.includes("timeout"));

    if (isRetryable && retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 2000;
      console.log(`Retrying API call (attempt ${retryCount + 1}) after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return analyzeSentence(sentence, mode, targetWords, image, retryCount + 1);
    }
    
    if (isRateLimit) {
       throw new Error("عذراً، تم تجاوز الحد المجاني للطلبات (15 طلب/دقيقة). يرجى الانتظار نصف دقيقة ثم المحاولة.");
    }
    
    throw new Error("فقد الاتصال بالذكاء الاصطناعي. يرجى التأكد من جودة اتصالك بالإنترنت والمحاولة مجدداً.");
  }
}

export async function searchGrammarRule(ruleName: string, retryCount = 0): Promise<string> {
  const cacheKey = `rule_${ruleName.trim()}`;
  if (apiCache.has(cacheKey)) {
    console.log("Returning cached result for searchGrammarRule");
    return apiCache.get(cacheKey);
  }

  const prompt = `اشرح قاعدة "${ruleName}" في النحو العربي بإيجاز.
  يجب أن يتضمن الشرح:
  1. تعريف القاعدة.
  2. أهم الملحوظات.
  3. التنبيهات.
  4. الشواذ إن وجدت.
  صغ الإجابة بشكل منظم وواضح.`;

  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    const finalResult = response.text || 'عذراً، لم أتمكن من العثور على شرح لهذه القاعدة.';
    apiCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorMessage = error.message || String(error);
    
    const isRateLimit = errorMessage.includes("429") || errorMessage.includes("Too Many Requests") || errorMessage.includes("quota");
    const isRetryable = !isRateLimit && (errorMessage.includes("500") || errorMessage.includes("503") || errorMessage.includes("Internal error") || errorMessage.includes("fetch failed") || errorMessage.includes("network") || errorMessage.includes("timeout"));

    if (isRetryable && retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 2000;
      console.log(`Retrying API call (attempt ${retryCount + 1}) after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return searchGrammarRule(ruleName, retryCount + 1);
    }
    
    if (isRateLimit) {
       return "عذراً، تم تجاوز الحد المجاني للطلبات (15 طلب/دقيقة). يرجى الانتظار نصف دقيقة ثم المحاولة.";
    }
    
    return "فقد الاتصال بالذكاء الاصطناعي. يرجى التأكد من جودة اتصالك بالإنترنت والمحاولة مجدداً.";
  }
}

export async function analyzePoetry(verse: string, retryCount = 0): Promise<string> {
  const cacheKey = `poetry_${verse.trim()}`;
  if (apiCache.has(cacheKey)) {
    console.log("Returning cached result for analyzePoetry");
    return apiCache.get(cacheKey);
  }

  const prompt = `قم بتحليل وشرح البيت الشعري التالي تحليلاً أدبياً ولغوياً: "${verse}".
  يجب أن يتضمن التحليل:
  1. شرح المعنى الإجمالي للبيت.
  2. الصور الجمالية والبلاغية (إن وجدت).
  3. إعراب أهم الكلمات أو الجمل في البيت.
  4. البحر الشعري (إن أمكن).
  صغ الإجابة بشكل منظم وواضح.`;

  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    const finalResult = response.text || 'عذراً، لم أتمكن من تحليل هذا البيت.';
    apiCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorMessage = error.message || String(error);
    
    const isRateLimit = errorMessage.includes("429") || errorMessage.includes("Too Many Requests") || errorMessage.includes("quota");
    const isRetryable = !isRateLimit && (errorMessage.includes("500") || errorMessage.includes("503") || errorMessage.includes("Internal error") || errorMessage.includes("fetch failed") || errorMessage.includes("network") || errorMessage.includes("timeout"));

    if (isRetryable && retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 2000;
      console.log(`Retrying API call (attempt ${retryCount + 1}) after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return analyzePoetry(verse, retryCount + 1);
    }
    
    if (isRateLimit) {
       return "عذراً، تم تجاوز الحد المجاني للطلبات (15 طلب/دقيقة). يرجى الانتظار نصف دقيقة ثم المحاولة.";
    }
    
    return "فقد الاتصال بالذكاء الاصطناعي. يرجى التأكد من جودة اتصالك بالإنترنت والمحاولة مجدداً.";
  }
}
