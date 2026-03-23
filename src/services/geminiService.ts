import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

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

export async function analyzeSentence(sentence: string, mode: 'full' | 'partial' | 'sentence-position' | 'extract' | 'vocative' | 'convert', targetWords?: string, image?: string) {
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
              enum: ['فعل', 'اسم', 'مرفوع', 'منصوب', 'مجزوم', 'مجرور', 'أخرى', 'جملة', 'استخراج', 'منادى', 'تحويل'] 
            },
            analysis: { type: Type.STRING, description: "الإعراب أو الموقع الإعرابي" }
          },
          required: ['word', 'category', 'analysis']
        }
      }
    }
  });
  
  return JSON.parse(response.text || '[]') as AnalyzedWord[];
}

export async function searchGrammarRule(ruleName: string) {
  const prompt = `اشرح قاعدة "${ruleName}" في النحو العربي بإيجاز.
  يجب أن يتضمن الشرح:
  1. تعريف القاعدة.
  2. أهم الملحوظات.
  3. التنبيهات.
  4. الشواذ إن وجدت.
  صغ الإجابة بشكل منظم وواضح.`;

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  
  return response.text || 'عذراً، لم أتمكن من العثور على شرح لهذه القاعدة.';
}
