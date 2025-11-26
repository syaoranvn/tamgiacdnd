import { apiUrl } from "../config/api";

// Translation cache on client
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 2000;

interface TranslateOptions {
  skipTooltipProcessing?: boolean;
}

// Check if text is already in Vietnamese
const isVietnamese = (text: string): boolean => {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
};

// Pattern to match tooltip tags: {@type name|source|extra}
// Common types: spell, item, skill, condition, action, creature, race, background, optionalfeature, etc.
const tooltipTagPattern = /\{@(spell|item|skill|condition|action|creature|monster|race|background|optionalfeature|optfeature|feat|class|language|damage|dice|dc|hit|atk|object|variantrule|h|m|filter|book|sense|ability|savingThrow|skillCheck|scaledamage|scaledice|autodice|chance|recharge|coinflip|footnote|homebrew|note|tip|d20|kbd|i|b)\s+[^}]+\}/gi;

// Split text into parts: tooltip tags and regular text
// Returns array of {text: string, isTooltip: boolean}
// Preserves all whitespace including spaces around tooltip tags
const splitTextWithTooltips = (text: string): Array<{ text: string; isTooltip: boolean }> => {
  const parts: Array<{text: string, isTooltip: boolean}> = [];
  let lastIndex = 0;
  let match;
  
  // Reset regex lastIndex
  tooltipTagPattern.lastIndex = 0;
  
  while ((match = tooltipTagPattern.exec(text)) !== null) {
    // Add text before the tooltip tag (including all whitespace)
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index);
      // Always add, even if it's just whitespace, to preserve spacing
      parts.push({ text: beforeText, isTooltip: false });
    }
    
    // Add the tooltip tag itself
    parts.push({ text: match[0], isTooltip: true });
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after the last tooltip tag (including all whitespace)
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    // Always add, even if it's just whitespace, to preserve spacing
    parts.push({ text: remainingText, isTooltip: false });
  }
  
  // If no tooltip tags found, return the whole text as one part
  if (parts.length === 0) {
    parts.push({ text, isTooltip: false });
  }
  
  return parts;
};

const translateWholeText = async (text: string): Promise<string> => {
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

  return text;
};

// Translate text from English to Vietnamese
export const translateText = async (
  text: string,
  enabled: boolean = true,
  options: TranslateOptions = {}
): Promise<string> => {
  if (!enabled || !text || typeof text !== "string" || text.trim() === "") {
    return text;
  }

  // Check if already Vietnamese
  if (isVietnamese(text)) {
    return text;
  }

  if (options.skipTooltipProcessing) {
    return translateWholeText(text);
  }

  // Split text into parts (tooltip tags and regular text)
  const parts = splitTextWithTooltips(text);
  
  // If no tooltip tags, translate the whole text
  if (parts.length === 1 && !parts[0].isTooltip) {
    return translateWholeText(text);
  }
  
  // If text contains tooltip tags, translate only the non-tooltip parts
  const translatedParts = await Promise.all(
    parts.map(async (part) => {
      if (part.isTooltip) {
        // Keep tooltip tags as-is (no translation)
        return part.text;
      } else {
        // Translate regular text parts
        // If it's only whitespace, preserve it as-is
        if (!part.text.trim()) {
          return part.text; // Preserve whitespace exactly
        }
        
        // For text with content, translate it
        const leadingWhitespace = part.text.match(/^\s*/)?.[0] || "";
        const trailingWhitespace = part.text.match(/\s*$/)?.[0] || "";
        const trimmed = part.text.trim();

        const translated = await translateWholeText(trimmed);

        return leadingWhitespace + translated + trailingWhitespace;
      }
    })
  );
  
  return translatedParts.join("");
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

