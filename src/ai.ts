import { GoogleGenAI, Type } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getLocationName = async (latitude: number, longitude: number, language: string = "English") => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `What is the city and state for these coordinates: ${latitude}, ${longitude}? Return ONLY the "City, State, Country" format in ${language}.`
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error getting location name:", error);
    return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  }
};

export const predictPrice = async (day: number, demand: number, rainfall: number, crop: string, location: string, quantity: number = 1, language: string = "English") => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Use Google Search to find the LATEST and MOST ACCURATE market prices (Mandi prices) for ${crop} in ${location || "India"}. 
      Search for data from reliable sources like Agmarknet, local government agriculture portals, or recent news reports.
      The user wants to know the price for ${quantity} kg.
      Consider seasonal factors, current demand (index: ${demand}), and recent weather conditions (rainfall: ${rainfall}mm).
      Provide a realistic price in Indian Rupees (INR).
      
      IMPORTANT: All text descriptions (like source titles) should be in ${language}.
      
      Return ONLY a JSON object with:
      - "unitPrice": number (price for 1kg in INR)
      - "totalPrice": number (price for ${quantity}kg in INR)
      - "confidence": number (0-1 score of how accurate this prediction is based on available data)
      - "sources": array of objects with "title" (string) and "url" (string) of the sources used`,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0,
        seed: 42,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            unitPrice: { type: Type.NUMBER, description: "Price per 1kg in INR" },
            totalPrice: { type: Type.NUMBER, description: "Total price for the requested quantity in INR" },
            confidence: { type: Type.NUMBER, description: "Accuracy confidence score" },
            sources: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING }
                },
                required: ["title", "url"]
              },
              description: "List of sources with titles and URLs found via Google Search"
            }
          },
          required: ["unitPrice", "totalPrice", "confidence", "sources"]
        }
      }
    });
    return JSON.parse(response.text.replace(/```json\n?|```/g, "").trim());
  } catch (error) {
    console.error("Price prediction error:", error);
    throw error;
  }
};

export const analyzeQuality = async (base64Image: string, language: string = "English") => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: `Analyze the quality of this crop image. Return a JSON object with 'grade' and 'reason'. 
          IMPORTANT: The 'grade' and 'reason' MUST be in ${language}. 
          For 'grade', use the equivalent of "Grade A (Fresh)", "Grade B", or "Grade C" in ${language}.` },
        { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            grade: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["grade", "reason"]
        }
      }
    });
    return JSON.parse(response.text.replace(/```json\n?|```/g, "").trim());
  } catch (error) {
    console.error("Quality analysis error:", error);
    throw error;
  }
};

export const processVoiceCommand = async (command: string, context: any, language: string = "English") => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The user said: "${command}". 
      Context: ${JSON.stringify(context)}. 
      You are an AgriNet AI assistant. Your goal is to help farmers and buyers navigate the app and get information.
      
      IMPORTANT: Respond in ${language}. If the user's command is in ${language}, respond in ${language}.
      
      App Capabilities:
      - Dashboard: Overview of activities, price prediction, and quality analysis.
      - Marketplace: Buying and selling crops.
      - Profile: User settings and role management.
      - Messages: Chatting with farmers or buyers about products.
      - Price Prediction: AI-driven market price forecasting for crops like Wheat, Soybean, Rice, etc.
      - Quality Analysis: Camera-based crop health and grade checking.

      User Context:
      - Role: ${context.userRole || "Guest"}
      - Current Page: ${context.currentView}
      - Selected Crop for Prediction: ${context.selectedCrop}

      Instructions:
      1. If the user wants to go somewhere (e.g., "Take me to the market", "Show dashboard", "Check my messages"), set the appropriate NAVIGATE action.
      2. If the user asks for a price prediction (e.g., "What's the price of wheat?", "Predict price of tomato"), set the PREDICT_PRICE action.
      3. If the user asks about quality (e.g., "Check my crop", "Is this good?"), set the ANALYZE_QUALITY action.
      4. Provide a friendly, spoken response in the "text" field.
      5. IMPORTANT: Always extract the specific crop name mentioned by the user (e.g., "Tomato", "Potato", "Wheat", "Soybean") and put it in the "crop" field. If they don't mention a crop, use the context's selectedCrop.
      6. If you don't understand, ask for clarification politely.

      Possible actions:
      - "NAVIGATE_DASHBOARD", "NAVIGATE_MARKETPLACE", "NAVIGATE_PROFILE", "NAVIGATE_MESSAGES", "PREDICT_PRICE", "ANALYZE_QUALITY", "NONE"

      Return a JSON object with:
      - "text": string (spoken response)
      - "action": string (one of the actions above)
      - "crop": string (the name of the crop mentioned, capitalized, e.g., "Tomato")
      - "quantity": number (optional, the amount in kg if the user mentioned one, e.g., "5 kg" -> 5)`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            action: { 
              type: Type.STRING,
              enum: ["NAVIGATE_DASHBOARD", "NAVIGATE_MARKETPLACE", "NAVIGATE_PROFILE", "NAVIGATE_MESSAGES", "PREDICT_PRICE", "ANALYZE_QUALITY", "NONE"]
            },
            crop: { type: Type.STRING, description: "The crop mentioned by the user, if any." },
            quantity: { type: Type.NUMBER, description: "The quantity in kg mentioned by the user, if any." }
          },
          required: ["text", "action"]
        }
      }
    });
    return JSON.parse(response.text.replace(/```json\n?|```/g, "").trim());
  } catch (error) {
    console.error("Voice command processing error:", error);
    return { 
      text: "I'm sorry, I'm having trouble understanding that right now. Could you try again?",
      action: "NONE"
    };
  }
};
