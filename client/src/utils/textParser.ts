/**
 * Parse D&D 5e text format tags like {@spell name}, {@item name|source}, etc.
 * Returns clean text without tags
 */
export const parseText = (text: string): string => {
  if (typeof text !== "string") return text;
  
  // Remove all {@...} tags and extract content
  // Format: {@type name|source|extra} -> name
  // IMPORTANT: Don't trim the result to preserve spacing
  return text.replace(/\{@([^}]+)\}/g, (_match, content) => {
    // Split by | to get parts
    const parts = content.split("|");
    // First part after type is usually the name
    const namePart = parts[0]?.trim() || "";
    
    // Handle {@i ...} tags - just remove them (they're italic markers)
    if (namePart === "i" || namePart.startsWith("i ")) {
      // Return the rest of the content after "i "
      if (namePart.startsWith("i ")) {
        return namePart.substring(2);
      }
      return "";
    }
    
    // Extract type (spell, item, skill, condition, etc.)
    // Support variantrule and all other types
    const typeMatch = namePart?.match(/^(spell|item|skill|condition|action|filter|book|class|race|feat|optionalfeature|language|damage|dice|dc|hit|atk|object|creature|monster|background|variantrule|h|m)\s+(.+)$/i);
    
    if (typeMatch) {
      // Return just the name (keep original spacing around)
      return typeMatch[2] || namePart;
    }
    
    // Handle special case: variantrule without space (e.g., {@variantrule name})
    if (namePart.startsWith("variantrule")) {
      const variantMatch = namePart.match(/^variantrule\s+(.+)$/i);
      if (variantMatch) {
        return variantMatch[1];
      }
      // If no space, try to get name from second part
      if (parts.length > 1) {
        return parts[1]?.trim() || "";
      }
      return "optional class features";
    }
    
    // If no type prefix, return the first part
    return namePart || "";
  });
};

/**
 * Extract all tags from text for tooltip purposes
 */
export const extractTags = (text: string): Array<{ type: string; name: string; full: string }> => {
  if (typeof text !== "string") return [];
  
  const tags: Array<{ type: string; name: string; full: string }> = [];
  const regex = /\{@([^}]+)\}/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const content = match[1];
    const parts = content.split("|");
    const firstPart = parts[0]?.trim() || "";
    
    // Handle special single-character types first: {@h}, {@m}, {@i}
    if (firstPart === "h") {
      tags.push({
        type: "hit",
        name: "Hit",
        full: match[0],
      });
      continue;
    }
    if (firstPart === "m") {
      tags.push({
        type: "miss",
        name: "Miss",
        full: match[0],
      });
      continue;
    }
    // Skip {@i ...} tags - they're just italic markers, not tooltip targets
    if (firstPart === "i" || firstPart.startsWith("i ")) {
      continue;
    }
    
    // Extract type and name - support more types
    // Pattern: type name or just type (for special cases)
    const typeMatch = firstPart.match(/^(spell|item|skill|condition|action|filter|book|class|race|feat|optionalfeature|language|damage|dice|dc|hit|atk|object|creature|monster|background|variantrule|5etools|chapter)(?:\s+(.+))?$/i);
    
    if (typeMatch) {
      let type = typeMatch[1].toLowerCase();
      let name = typeMatch[2]?.trim() || "";
      
      // Skip types that don't need tooltips
      if (type === "5etools" || type === "book" || type === "chapter") {
        continue;
      }
      
      // Skip spell lists and other non-entity references
      const nameLower = name.toLowerCase();
      if (type === "spell" && (
        nameLower.includes("list") || 
        nameLower.includes("spell list") ||
        nameLower.endsWith("spells") ||
        nameLower.includes("spells")
      )) {
        continue;
      }
      
      if (type === "filter") {
        // Try to extract actual type from filter
        const filterMatch = name.match(/(spell|item|class|race|feat|condition|skill|background|monster|creature|variantrule)/i);
        if (filterMatch) {
          type = filterMatch[1].toLowerCase();
        } else {
          continue; // Skip unknown filters
        }
      }
      
      // Handle variantrule - extract name from firstPart or remaining parts
      if (type === "variantrule") {
        if (!name) {
          // Try to extract from full content if name is empty
          const variantMatch = content.match(/variantrule\s+(.+?)(?:\||$)/i);
          if (variantMatch) {
            name = variantMatch[1].trim();
          } else if (parts.length > 1) {
            // Try to get name from second part
            name = parts[1]?.trim() || "";
          }
        }
        // If still no name, use a default
        if (!name) {
          name = "optional class features";
        }
      }
      
      // For types without name, use type as name
      if (!name) {
        if (type === "hit") {
          name = "Hit";
        } else if (type === "miss") {
          name = "Miss";
        } else {
          name = type;
        }
      }
      
      tags.push({
        type,
        name: name,
        full: match[0],
      });
    } else if (firstPart) {
      // Try to infer type from context or use first part as name
      // Skip if it looks like a number or special syntax
      if (!/^\d+$/.test(firstPart) && !firstPart.includes("=") && !firstPart.startsWith("i ")) {
        tags.push({
          type: "unknown",
          name: firstPart,
          full: match[0],
        });
      }
    }
  }
  
  return tags;
};

/**
 * Parse weapon/item names from format {@item name|source|plural}
 */
export const parseItemName = (item: string): string => {
  if (typeof item !== "string") return item;
  
  const match = item.match(/\{@item\s+([^|]+)/);
  if (match) {
    return match[1].trim();
  }
  
  // If already parsed or simple string
  return parseText(item);
};

