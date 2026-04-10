import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type, ThinkingLevel, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Gemini API Initialization
const getAI = () => {
  // إعطاء الأولوية لمفتاح المستخدم الخاص
  const apiKey = process.env.USER_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing in environment variables. Please add your API key.");
  }
  return new GoogleGenAI({ apiKey });
};

const executeWithRetry = async (operation: () => Promise<any>, maxRetries = 3, baseDelay = 1000) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      const isOverloaded = error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('high demand') || error?.message?.includes('UNAVAILABLE');
      if (isOverloaded) {
        if (attempt >= maxRetries) {
          throw new Error("الخدمة تواجه ضغطاً عالياً حالياً. يرجى المحاولة مرة أخرى بعد قليل.");
        }
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`API overloaded (503). Retrying in ${delay}ms... (Attempt ${attempt} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env: process.env.GEMINI_API_KEY ? "set" : "missing" });
});

app.post("/api/analyze", async (req, res) => {
  const { sentence, mode, targetWords, image, showAllFacets } = req.body;
  
  let prompt = '';
  const languageInstruction = "\n**هام جداً:** يجب أن تكون الإجابة باللغة العربية فقط.";
  
  if (mode === 'full') {
    prompt = `قم بإعراب الجملة التالية إعراباً تفصيلياً.${languageInstruction}
    **هام جداً:**
    1. يجب تشكيل الكلمات في حقل word تشكيلاً كاملاً (الفتحة، الضمة، الكسرة، السكون، الشدة، التنوين) كما في المثال: الشَّبَحُ، وَصَلَ، الْفَاعِلُ.
    2. في حقل category، يجب أن تختار قيمة دقيقة من هذه القيم فقط: (مبتدأ، خبر، فاعل، مفعول به، فعل، حرف، اسم، أخرى).
    الجملة هي: "${sentence}".`;
  } else if (mode === 'partial') {
    prompt = `قم بإعراب الكلمات التالية فقط من الجملة "${sentence}".${languageInstruction}
    **هام جداً:**
    1. يجب تشكيل الكلمات في حقل word تشكيلاً كاملاً (الفتحة، الضمة، الكسرة، السكون، الشدة، التنوين).
    2. في حقل category، يجب أن تختار قيمة دقيقة من هذه القيم فقط: (مبتدأ، خبر، فاعل، مفعول به، فعل، حرف، اسم، أخرى).
    الكلمات هي: "${targetWords}".`;
  } else if (mode === 'sentence-position') {
    prompt = `استخرج الجمل الفرعية في الجملة التالية: "${sentence}"، وبين موقعها من الإعراب (لها محل أو ليس لها محل) مع التعليل.${languageInstruction}`;
  } else if (mode === 'extract') {
    prompt = `استخرج من النص التالي: "${sentence}" المطلوب الآتي: "${targetWords}".${languageInstruction}
    في حقل word ضع الكلمة المستخرجة، وفي حقل category اختر 'استخراج'، وفي حقل analysis ضع نوع الاستخراج (مثلاً: اسم فاعل) وسببه أو وزنه أو فعله.
    ${showAllFacets ? '**ملاحظة هامة (خيار متقدم):** يرجى ذكر جميع الأوجه الممكنة والصحيحة للكلمة المستخرجة من حيث التشكيل أو الوزن (مثل مَطْلَع ومَطْلِع لاسم المكان من طلع) مع توضيح الفرق أو سبب الجواز في حقل analysis.' : ''}`;
  } else if (mode === 'vocative') {
    prompt = `استخرج المنادى من الجملة أو النص التالي: "${sentence}" وبين نوعه (مضاف، شبيه بالمضاف، نكرة مقصودة، نكرة غير مقصودة، علم مفرد) وحكمه الإعرابي.${languageInstruction}
    في حقل word ضع المنادى، وفي حقل category اختر 'منادى'، وفي حقل analysis ضع نوعه وحكمه الإعرابي.`;
  } else if (mode === 'convert') {
    prompt = `قم بالتحويل النحوي المطلوب على الجملة التالية: "${sentence}".${languageInstruction}
    المطلوب: "${targetWords}". (مثال: حول الجملة الاسمية إلى فعلية، أو حول الحال المفرد إلى جملة، إلخ).
    في حقل word ضع الجملة بعد التحويل، وفي حقل category اختر 'تحويل'، وفي حقل analysis اشرح ما قمت به باختصار مع ذكر التغييرات الإعرابية التي حدثت.
    ${showAllFacets ? '**ملاحظة هامة (خيار متقدم):** يرجى ذكر جميع الأوجه الممكنة والصحيحة للتحويل من حيث التشكيل أو الصياغة مع توضيح الفرق أو سبب الجواز في حقل analysis.' : ''}`;
  } else if (mode === 'notes') {
    prompt = `استخرج الملاحظات النحوية أو الصرفية أو البلاغية البارزة من النص التالي: "${sentence}".${languageInstruction}
    ${targetWords ? `ركز بشكل خاص على: "${targetWords}".` : ''}
    في حقل word ضع الكلمة أو العبارة المتعلقة بالملاحظة، وفي حقل category اختر 'ملاحظات'، وفي حقل analysis اكتب الملاحظة بوضوح وإيجاز.`;
  } else if (mode === 'compare') {
    prompt = `قم بمقارنة نحوية أو بلاغية أو دلالية بين الجملتين التاليتين:${languageInstruction}
    الجملة الأولى: "${sentence}"
    الجملة الثانية: "${targetWords}"
    في حقل word ضع وجه المقارنة أو الكلمة، وفي حقل category اختر 'مقارنة'، وفي حقل analysis اكتب تفاصيل المقارنة بوضوح.`;
  } else if (mode === 'detailed') {
    prompt = `قم بإعراب الجملة التالية إعراباً تفصيلياً جداً وشاملاً.${languageInstruction}
    **هام جداً:**
    1. يجب تشكيل الكلمات في حقل word تشكيلاً كاملاً.
    2. في حقل category، يجب أن تختار قيمة دقيقة من هذه القيم فقط: (مبتدأ، خبر، فاعل، مفعول به، فعل، حرف، اسم، أخرى).
    3. في حقل analysis، قدم شرحاً مفصلاً جداً لكل كلمة، مع ذكر جميع الأوجه الإعرابية الممكنة، والتعليل النحوي، والموقع الإعرابي، والعلامة الإعرابية، وسببها.
    الجملة هي: "${sentence}".`;
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
    const responseStream = await executeWithRetry(() => ai.models.generateContentStream({
      model: "gemini-3.1-flash-lite-preview",
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
    }));

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of responseStream) {
      res.write(chunk.text);
    }
    res.end();
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "حدث خطأ غير متوقع في السيرفر" });
    } else {
      res.end();
    }
  }
});

app.post("/api/rule", async (req, res) => {
  const { ruleName } = req.body;
  const prompt = `اشرح قاعدة "${ruleName}" في النحو العربي بإيجاز. صغ الإجابة بشكل منظم وواضح.
ملاحظة هامة جداً: أي أمثلة تذكرها في الشرح (سواء كانت آيات قرآنية، أبيات شعرية، أو جمل عادية)، يجب أن تضعها داخل وسوم <example> هكذا: <example>المثال هنا</example>.`;
  
  try {
    const ai = getAI();
    const response = await executeWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt
    }));
    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/poetry", async (req, res) => {
  const { verse } = req.body;
  const prompt = `
المستخدم أدخل النص التالي: "${verse}"
إذا كان النص عبارة عن كلمة واحدة أو عبارة قصيرة (يبدو ككلمة بحث)، قم بالبحث عن بيت شعر عربي فصيح يحتوي على هذه الكلمة أو يحمل معناها.
إذا وجدت بيتاً، اكتب البيت الشعري أولاً، ثم اذكر اسم الشاعر (إن عُرف)، ثم اشرح البيت باختصار.
إذا لم تجد أي بيت شعر يحتوي على الكلمة أو معناها، يجب أن ترد حصراً بالعبارة التالية: "لا يوجد بيت شعر به هذه الكلمة".
أما إذا كان النص المدخل عبارة عن بيت شعري كامل، فقم بتحليله وشرحه تحليلاً أدبياً ولغوياً بشكل منظم وواضح.
`;
  
  try {
    const ai = getAI();
    const response = await executeWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt
    }));
    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/dictation", async (req, res) => {
  const { ruleName } = req.body;
  const prompt = `قم بإنشاء قطعة إملاء قصيرة ومناسبة لاختبار القاعدة الإملائية التالية: "${ruleName}". يجب أن تكون القطعة مفيدة ومكتوبة بلغة عربية فصحى سليمة.`;
  try {
    const ai = getAI();
    const response = await executeWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    }));
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
    const response = await executeWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    }));
    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Setup Vite or Static serving
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  // We use a dynamic import for vite so it doesn't break Vercel builds
  import("vite").then(async ({ createServer: createViteServer }) => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

export default app;
