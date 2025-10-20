
import { GoogleGenAI, Chat } from "@google/genai";
import { Message, Role } from '../types';

let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;

const getAI = () => {
  if (!ai) {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

const getSystemInstruction = (languageName: string) => {
    return `You are Poly, a friendly and encouraging language tutor. The user wants to learn ${languageName}. Your primary role is to have a natural conversation with them in ${languageName}.
- Your responses MUST be primarily in ${languageName}.
- If the user makes a mistake in grammar or vocabulary, gently correct them. First provide the corrected sentence in ${languageName}, then provide a very short, simple explanation in English inside parentheses. For example: "أنا أذهب إلى المكتبة. (The verb conjugation was slightly off. 'أذهب' is correct for 'I go'.)"
- Keep your responses concise and conversational to encourage the user to speak.
- Occasionally, introduce new vocabulary or suggest a simple conversational scenario (e.g., "Let's pretend you are ordering a coffee.").
- Your main language of conversation is ${languageName}. Only provide explanations in English.
`;
}


export const startChatSession = (languageName: string): void => {
    const genAI = getAI();
    chat = genAI.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: getSystemInstruction(languageName),
        }
    });
};

export const sendMessageToAI = async (message: string): Promise<string> => {
    if (!chat) {
        throw new Error("Chat session not initialized. Call startChatSession first.");
    }
    try {
        const result = await chat.sendMessage({ message });
        return result.text;
    } catch (error) {
        console.error("Error sending message to Gemini:", error);
        return "Sorry, I encountered an error. Please try again.";
    }
};
