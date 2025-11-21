import { apiUrl } from "../config/api";

// Translation cache on client
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 2000;

// Check if text is already in Vietnamese
const isVietnamese = (text: string): boolean => {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
};

// Translate text from English to Vietnamese
export const translateText = async (text: string, enabled: boolean = true): Promise<string> => {
  if (!enabled || !text || typeof text !== "string" || text.trim() === "") {
    return text;
  }

  // Check if already Vietnamese
  if (isVietnamese(text)) {
    return text;
  }

  // Check cache first
  const cacheKey = text.toLowerCase().trim();
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(apiUrl("api/translate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (response.ok) {
      const data = await response.json();
      const translated = data.translated || text;

      // Cache the result
      if (translationCache.size >= MAX_CACHE_SIZE) {
        const firstKey = translationCache.keys().next().value;
        if (firstKey) {
          translationCache.delete(firstKey);
        }
      }
      translationCache.set(cacheKey, translated);

      return translated;
    }
  } catch (error) {
    console.error("Translation error:", error);
  }

  // Fallback: return original text
  return text;
};

// Translate multiple texts in parallel
export const translateBatch = async (
  texts: string[],
  enabled: boolean = true
): Promise<string[]> => {
  if (!enabled) return texts;
  
  const promises = texts.map((text) => translateText(text, enabled));
  return Promise.all(promises);
};

