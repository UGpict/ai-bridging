import { GoogleGenAI } from "@google/genai";

export const geminiModel = "gemini-3.1-flash-lite";

function getAI(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.FIREBASE_PROJECT_ID,
    location: "global",
  });
}

export async function generateContent(prompt: string): Promise<string> {
  const ai = getAI();
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
  const ai = getAI();
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
