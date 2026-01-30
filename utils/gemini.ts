import { GoogleGenerativeAI } from "@google/generative-ai";

export const validateGeminiConnection = async (apiKey: string) => {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    await model.generateContent("Hola");
    return true;
  } catch (error: any) {
    if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
      throw new Error(`La API "Generative Language API" no está habilitada en Google Cloud para esta API Key o el modelo no está disponible.`);
    }
    throw error;
  }
};

export const queryGemini = async (apiKey: string, prompt: string, contextData: string) => {
  if (!apiKey) throw new Error("Falta la API Key");

  const genAI = new GoogleGenerativeAI(apiKey);
  // Actualizamos a gemini-2.0-flash según la recomendación de AI Studio
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const fullPrompt = `
    Eres un asistente experto en análisis de datos de ventas.
    Tienes acceso a los siguientes datos (en formato resumido o JSON):
    
    ${contextData}
    
    Responde a la siguiente pregunta del usuario basándote ÚNICAMENTE en estos datos.
    Si la respuesta no está en los datos, dilo claramente.
    Sé conciso y directo. Si te piden comparar, da números exactos.
    
    Pregunta: ${prompt}
  `;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error("Gemini Error Details:", error);
    if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
      throw new Error(`Error 404: El modelo no está disponible. Asegúrate de tener habilitada la "Generative Language API" en tu consola de Google Cloud.`);
    }
    throw error;
  }
};
