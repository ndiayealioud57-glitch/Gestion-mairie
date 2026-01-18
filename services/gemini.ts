
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeDocument = async (text?: string, imageData?: string) => {
  try {
    const parts: any[] = [];
    
    if (imageData) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData.split(',')[1] // Extract base64 part
        }
      });
    }

    const prompt = text 
      ? `Analyse ce texte de document administratif pour la mairie de Sandiara : "${text}". Extrais les métadonnées.`
      : `Analyse cette image de document (scan) pour la mairie de Sandiara. Fais l'OCR et extrais les métadonnées pour le classement.`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Titre formel extrait ou généré." },
            summary: { type: Type.STRING, description: "Résumé très court de l'objet." },
            category: { 
              type: Type.STRING, 
              description: "Courrier Entrant, Courrier Sortant, Arrêté Municipal, Délibération, Note Interne, Dossier Foncier." 
            },
            service: { type: Type.STRING, description: "Service municipal concerné." },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "summary", "category", "service", "tags"]
        }
      }
    });

    const jsonStr = response.text?.trim() || "{}";
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Erreur d'analyse Gemini:", error);
    return null;
  }
};
