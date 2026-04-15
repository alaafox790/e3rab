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

const executeWithRetry = async (operation: () => Promise<any>, maxRetries = 3, baseDelay = 2000) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      const errorMsg = error?.message || String(error);
      const isOverloaded = error?.status === 503 || errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('UNAVAILABLE');
      const isQuotaExceeded = error?.status === 429 || errorMsg.includes('429') || errorMsg.includes('Quota exceeded') || errorMsg.includes('RESOURCE_EXHAUSTED');
      
      if (isOverloaded || isQuotaExceeded) {
        if (attempt >= maxRetries) {
          if (isQuotaExceeded) {
            throw new Error("عذراً، تم تجاوز الحد المسموح به من الطلبات المجانية حالياً. يرجى الانتظار دقيقة واحدة ثم المحاولة مرة أخرى.");
          }
          throw new Error("عذراً، خوادم الذكاء الاصطناعي مشغولة حالياً. يرجى المحاولة مرة أخرى بعد ثوانٍ قليلة.");
        }
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`API ${isQuotaExceeded ? 'Quota' : 'Overload'} error. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt} of ${maxRetries})`);
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
  const { sentence, mode, targetWords, image, showAllFacets, customCategories } = req.body;
  
  const isSingleWord = !sentence.trim().includes(' ');
  const speedInstruction = isSingleWord ? "\n**تعليمات للسرعة:** بما أن المدخل كلمة واحدة، قدم إجابة مختصرة ومباشرة جداً دون إطالة." : "";
  
  let prompt = '';
  const languageInstruction = "\n**هام جداً:** يجب أن تكون الإجابة باللغة العربية فقط." + speedInstruction;
  
  const defaultCategories = "مبتدأ، خبر، فاعل، مفعول به، فعل، حرف، اسم مجرور، مضاف إليه، نعت، حال، تمييز، اسم إن، خبر إن، اسم كان، خبر كان، مفعول مطلق، مفعول لأجله، ظرف، معطوف، بدل، توكيد، أخرى";
  const categoriesString = customCategories && customCategories.length > 0 ? customCategories.join('، ') : defaultCategories;
  
  if (mode === 'full') {
    prompt = `أنت خبير في النحو العربي والصرف. قم بإعراب الجملة التالية إعراباً تفصيلياً دقيقاً وفقاً لقواعد النحو العربي الفصيح.${languageInstruction}
    **تعليمات هامة جداً:**
    1. يجب تشكيل الكلمات في حقل word تشكيلاً كاملاً ودقيقاً (الفتحة، الضمة، الكسرة، السكون، الشدة، التنوين).
    2. في حقل category، يجب أن تختار القيمة الأدق من هذه القائمة: (${categoriesString}).
    3. في حقل analysis، قدم الإعراب الكامل (الحالة الإعرابية، العلامة، والسبب).
    الجملة هي: "${sentence}".`;
  } else if (mode === 'partial') {
    prompt = `أنت خبير في النحو العربي. قم بإعراب الكلمات المحددة فقط من الجملة التالية إعراباً دقيقاً.${languageInstruction}
    الجملة: "${sentence}"
    الكلمات المطلوب إعرابها: "${targetWords}"
    **تعليمات هامة:**
    1. يجب تشكيل الكلمات في حقل word تشكيلاً كاملاً.
    2. في حقل category، اختر من: (${categoriesString}).`;
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
    prompt = `أنت مرجع في علوم اللغة العربية. قم بإعراب الجملة التالية إعراباً تفصيلياً شاملاً وعميقاً (إعراب متقدم).${languageInstruction}
    **تعليمات صارمة:**
    1. تشكيل كامل ودقيق لكل حرف في حقل word.
    2. في حقل category، اختر القيمة الأدق: (مبتدأ، خبر، فاعل، مفعول به، فعل، حرف، اسم مجرور، مضاف إليه، نعت، حال، تمييز، اسم إن، خبر إن، اسم كان، خبر كان، مفعول مطلق، مفعول لأجله، ظرف، معطوف، بدل، توكيد، أخرى).
    3. في حقل analysis، قدم شرحاً وافياً يتضمن: الموقع الإعرابي، الحالة، العلامة الإعرابية وسببها.
    4. **ميزات الإعراب المتقدم (يجب تضمينها إن وجدت):**
       - **متعلق الجار والمجرور والظرف:** اذكر دائماً متعلق الجار والمجرور أو الظرف (بأي فعل أو مشتق يتعلق؟).
       - **ضمير الشأن:** إذا كان هناك ضمير شأن، وضحه واشرح موقعه.
       - **الاختلافات الجوهرية الدقيقة:** إذا كانت الكلمة تحتمل إعرابين متقاربين (مثل النعت والبدل، أو الحال والتمييز، أو المفعول لأجله والمفعول المطلق)، اشرح الفرق ولماذا تم ترجيح الإعراب المختار.
       - **الأوجه الإعرابية الأخرى:** اذكر أي أوجه إعرابية أخرى محتملة للكلمة إن وجدت.
       - **الاستثناءات والحالات الصعبة:** اشرح أي استثناءات نحوية شائعة أو حالات صعبة تتعلق بتركيب الجملة، مثل الترتيب غير المعتاد للكلمات (التقديم والتأخير) أو الأشكال النحوية الأقل شيوعاً.
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
      model: "gemini-2.5-pro",
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
      model: "gemini-2.5-pro",
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
      model: "gemini-2.5-pro",
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
      model: "gemini-2.5-pro",
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
      model: "gemini-2.5-pro",
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

app.post("/api/diacritize", async (req, res) => {
  const { text } = req.body;
  const isSingleWord = !text.trim().includes(' ');
  const speedInstruction = isSingleWord ? " أجب بكلمة واحدة فقط مشكّلة دون أي إضافات." : "";
  
  const prompt = `قم بتشكيل النص العربي التالي تشكيلاً كاملاً وصحيحاً نحوياً ولغوياً.${speedInstruction} أعد النص المشكّل فقط بدون أي إضافات أو شروحات:
  "${text}"`;
  try {
    const ai = getAI();
    const response = await executeWithRetry(() => ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    }));
    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/quiz/generate", async (req, res) => {
  const { topic } = req.body;
  const prompt = `أنت معلم لغة عربية خبير. قم بتوليد سؤال تحدي (اختبر نفسك) في النحو أو الصرف حول موضوع: "${topic}".
  إذا كان الموضوع "عشوائي"، فاختر قاعدة نحوية أو صرفية مشهورة (مثل اسم الفاعل، اسم المفعول، الحال، التمييز، المنادى، الممنوع من الصرف، إلخ).
  السؤال يجب أن يكون عبارة عن جملة أو بيت شعر أو آية قرآنية، ويطلب من المستخدم استخراج شيء معين أو إعراب كلمة أو تحويل جملة.
  يجب أن تكون الإجابة بصيغة JSON فقط، وتحتوي على:
  1. "question": نص السؤال بوضوح (مثال: استخرج اسم الفاعل من الجملة التالية...).
  2. "type": نوع السؤال (مثال: استخراج، إعراب، تحويل).
  3. "context": الجملة أو النص الذي يدور حوله السؤال (مشكّل تشكيلاً صحيحاً).`;
  
  try {
    const ai = getAI();
    const response = await executeWithRetry(() => ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            type: { type: Type.STRING },
            context: { type: Type.STRING }
          },
          required: ['question', 'type', 'context']
        }
      }
    }));
    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/quiz/evaluate", async (req, res) => {
  const { questionData, userAnswer } = req.body;
  const prompt = `أنت معلم لغة عربية خبير. قم بتقييم إجابة الطالب على السؤال التالي:
  السؤال: ${questionData.question}
  النص: ${questionData.context}
  إجابة الطالب: ${userAnswer}
  
  يجب أن تكون الإجابة بصيغة JSON فقط، وتحتوي على:
  1. "isCorrect": قيمة منطقية (true/false) تشير إلى ما إذا كانت الإجابة صحيحة أم لا (اقبل الإجابات الصحيحة حتى لو كانت بصيغة مختلفة قليلاً).
  2. "feedback": تعليق تشجيعي وتوضيحي يشرح لماذا الإجابة صحيحة أو خاطئة.
  3. "correctAnswer": الإجابة النموذجية الكاملة.`;
  
  try {
    const ai = getAI();
    const response = await executeWithRetry(() => ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            correctAnswer: { type: Type.STRING }
          },
          required: ['isCorrect', 'feedback', 'correctAnswer']
        }
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
