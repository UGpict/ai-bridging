import { GoogleGenAI } from "@google/genai";

export const geminiModel = "gemini-3.1-flash-lite";

function getAI(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.FIREBASE_PROJECT_ID,
    location: "global",
  });
}

function isRateLimitError(e: unknown): boolean {
  if (e instanceof Error) {
    return e.message.includes("429") || e.message.toLowerCase().includes("rate limit") || e.message.toLowerCase().includes("quota");
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === maxRetries - 1 || !isRateLimitError(e)) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw new Error("リトライ上限に達しました");
}

export async function generateContent(prompt: string): Promise<string> {
  const ai = getAI();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: prompt,
    });
    return response.text ?? "";
  });
}

export async function generateContentWithHistory(
  systemInstruction: string,
  messages: { role: "user" | "model"; content: string }[]
): Promise<string> {
  const ai = getAI();
  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: geminiModel,
      config: { systemInstruction },
      contents,
    });
    return response.text ?? "";
  });
}
