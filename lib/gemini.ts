import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

export const geminiModel = "gemini-2.5-pro";

export async function generateContent(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: geminiModel,
    contents: prompt,
  });
  return response.text ?? "";
}

export async function generateContentWithHistory(
  systemInstruction: string,
  messages: { role: "user" | "model"; content: string }[]
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const response = await ai.models.generateContent({
    model: geminiModel,
    config: { systemInstruction },
    contents,
  });
  return response.text ?? "";
}
