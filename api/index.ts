import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// Gemini API Initialization
const getAI = () => {
  const apiKey = process.env.USER_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env: process.env.GEMINI_API_KEY ? "set" : "missing" });
});

app.post("/api/analyze", async (req, res) => {
  const { sentence, mode, targetWords, image, showAllFacets } = req.body;
  
  let prompt = '';
  if (mode === 'full') {
    prompt = `قم بإعراب الجملة التالية إعراباً تفصيلياً، مع التشكيل الكامل لكل كلمة: "${sentence}".`;
  } else if (mode === 'partial') {
    prompt = `قم بإعراب الكلمات التالية فقط من الجملة "${sentence}" مع التشكيل الكامل: "${targetWords}".`;
  } else if (mode === 'sentence-position') {
    prompt = `استخرج الجمل الفرعية في الجملة التالية: "${sentence}"، وبين موقعها من الإعراب (لها محل أو ليس لها محل) مع التعليل.`;
  } else if (mode === 'extract') {
    prompt = `استخرج من النص التالي: "${sentence}" المطلوب الآتي: "${targetWords}".
    في حقل word ضع الكلمة المستخرجة، وفي حقل category اختر 'استخراج'، وفي حقل analysis ضع نوع الاستخراج (مثلاً: اسم فاعل) وسببه أو وزنه أو فعله.
    ${showAllFacets ? '**ملاحظة هامة (خيار متقدم):** يرجى ذكر جميع الأوجه الممكنة والصحيحة للكلمة المستخرجة من حيث التشكيل أو الوزن (مثل مَطْلَع ومَطْلِع لاسم المكان من طلع) مع توضيح الفرق أو سبب الجواز في حقل analysis.' : ''}`;
  } else if (mode === 'vocative') {
    prompt = `استخرج المنادى من الجملة أو النص التالي: "${sentence}" وبين نوعه (مضاف، شبيه بالمضاف، نكرة مقصودة، نكرة غير مقصودة، علم مفرد) وحكمه الإعرابي.
    في حقل word ضع المنادى، وفي حقل category اختر 'منادى'، وفي حقل analysis ضع نوعه وحكمه الإعرابي.`;
  } else if (mode === 'convert') {
    prompt = `قم بالتحويل النحوي المطلوب على الجملة التالية: "${sentence}".
    المطلوب: "${targetWords}". (مثال: حول الجملة الاسمية إلى فعلية، أو حول الحال المفرد إلى جملة، إلخ).
    في حقل word ضع الجملة بعد التحويل، وفي حقل category اختر 'تحويل'، وفي حقل analysis اشرح ما قمت به باختصار مع ذكر التغييرات الإعرابية التي حدثت.
    ${showAllFacets ? '**ملاحظة هامة (خيار متقدم):** يرجى ذكر جميع الأوجه الممكنة والصحيحة للتحويل من حيث التشكيل أو الصياغة مع توضيح الفرق أو سبب الجواز في حقل analysis.' : ''}`;
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

  try {
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
              word: { type: Type.STRING },
              category: { type: Type.STRING },
              analysis: { type: Type.STRING }
            },
            required: ['word', 'category', 'analysis']
          }
        }
      }
    });
    res.json(JSON.parse(response.text || '[]'));
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ غير متوقع في السيرفر" });
  }
});

app.post("/api/rule", async (req, res) => {
  const { ruleName } = req.body;
  const prompt = `اشرح قاعدة "${ruleName}" في النحو العربي بإيجاز. صغ الإجابة بشكل منظم وواضح.`;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/poetry", async (req, res) => {
  const { verse } = req.body;
  const prompt = `قم بتحليل وشرح البيت الشعري التالي تحليلاً أدبياً ولغوياً: "${verse}". صغ الإجابة بشكل منظم وواضح.`;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/spelling", async (req, res) => {
  const { text } = req.body;
  const prompt = `قم بمراجعة النص التالي إملائياً وتصحيح أي أخطاء إملائية أو لغوية فيه.
  النص: "${text}"
  يجب أن تكون الإجابة بصيغة JSON فقط، وتحتوي على:
  1. "correctedText": النص كاملاً بعد التصحيح.
  2. "corrections": مصفوفة تحتوي على الأخطاء التي تم تصحيحها، كل عنصر يحتوي على:
     - "original": الكلمة الخاطئة
     - "corrected": الكلمة الصحيحة
     - "reason": سبب التصحيح بشكل وافي ومفصل جداً مع ذكر القاعدة الإملائية أو النحوية بالتفصيل.
  `;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
