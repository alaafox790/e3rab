import { GoogleGenAI, Type } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const response = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
    contents: "أعرب: ذهب الولد إلى المدرسة",
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
          }
        }
      }
    }
  });
  for await (const chunk of response) {
    process.stdout.write(chunk.text);
  }
}
test();