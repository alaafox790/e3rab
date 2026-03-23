import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface AnalyzedWord {
  word: string;
  category: 'فعل' | 'اسم' | 'مرفوع' | 'منصوب' | 'مجزوم' | 'مجرور' | 'أخرى' | 'جملة';
  analysis: string;
}

export async function analyzeSentence(sentence: string, mode: 'full' | 'partial' | 'sentence-position', targetWords?: string, image?: string) {
  let prompt = '';
  if (mode === 'full') {
    prompt = `قم بإعراب الجملة التالية إعراباً تفصيلياً، مع التشكيل الكامل لكل كلمة: "${sentence}".`;
  } else if (mode === 'partial') {
    prompt = `قم بإعراب الكلمات التالية فقط من الجملة "${sentence}" مع التشكيل الكامل: "${targetWords}".`;
  } else {
    prompt = `استخرج الجمل الفرعية في الجملة التالية: "${sentence}"، وبين موقعها من الإعراب (لها محل أو ليس لها محل) مع التعليل.`;
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
              enum: ['فعل', 'اسم', 'مرفوع', 'منصوب', 'مجزوم', 'مجرور', 'أخرى', 'جملة'] 
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  
  return response.text || 'عذراً، لم أتمكن من العثور على شرح لهذه القاعدة.';
}
