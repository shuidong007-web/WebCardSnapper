import { GoogleGenAI, Type } from "@google/genai";
import { CardData } from "../types";

const PROMPT_TEMPLATE = `
Analyze the following raw content extracted from a website (e.g. a product card, an article snippet, or a div):
---
\${content}
---

Return a JSON object with:
1. "title": A catchy, short title (max 40 chars) derived from the content.
2. "summary": A 2-sentence summary of what this specific content block is about.
3. "tags": An array of 3 key hashtags/topics.
4. "colorTheme": A suggested tailwind-compatible color class for the header background (e.g., "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-orange-500", "bg-rose-500", "bg-slate-800").
`;

export const generateCardContent = async (
  content: string
): Promise<Partial<CardData>> => {
  // Use the API key from the environment variable
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Truncate content if it's too massive to avoid token limits, keeping the most relevant start/end
  const truncatedContent = content.length > 5000 
    ? content.substring(0, 4000) + "...[truncated]..." 
    : content;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: PROMPT_TEMPLATE.replace("${content}", truncatedContent),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            tags: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            colorTheme: { type: Type.STRING }
          },
          required: ["title", "summary", "tags", "colorTheme"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};