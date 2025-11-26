const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const path = require("path");
const http = require("http");

// Helper function to make HTTP requests
function httpRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 4000,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ ok: true, status: res.statusCode, json: () => Promise.resolve(JSON.parse(data)) });
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else {
          resolve({ ok: false, status: res.statusCode, json: () => Promise.resolve(null) });
        }
      });
    });

    req.on("error", (e) => {
      reject(e);
    });

    req.end();
  });
}

/**
 * Parse and format special tags like {@item dagger|phb|daggers}, {@spell minor illusion}, etc.
 */
function formatSpecialTags(text) {
  if (!text || typeof text !== "string") {
    return text;
  }
  
  // Replace {@item name|source|plural} with just "name"
  // Handle cases like {@item thieves' tools|PHB} - match everything up to | or }
  text = text.replace(/{@item\s+([^}]+?)(?:\|[^}]*)?}/gi, (match, itemName) => {
    // Extract just the item name (before the first |)
    const name = itemName.split('|')[0].trim();
    return name;
  });
  
  // Replace {@spell name} with just "name"
  text = text.replace(/{@spell\s+([^}]+)}/gi, "$1");
  
  // Replace {@skill name} with just "name"
  text = text.replace(/{@skill\s+([^}]+)}/gi, "$1");
  
  // Replace {@language name} with just "name"
  text = text.replace(/{@language\s+([^}]+)}/gi, "$1");
  
  // Replace {@damage type} with just "type"
  text = text.replace(/{@damage\s+([^}]+)}/gi, "$1");
  
  // Replace {@condition name} with just "name"
  text = text.replace(/{@condition\s+([^}]+)}/gi, "$1");
  
  // Replace {@filter name|...} with just "name"
  text = text.replace(/{@filter\s+([^|}]+)(?:\|[^}]*)?}/gi, "$1");
  
  // Replace {@dice XdY} with "XdY"
  text = text.replace(/{@dice\s+([^}]+)}/gi, "$1");
  
  // Replace {@status name} with just "name"
  text = text.replace(/{@status\s+([^}]+)}/gi, "$1");
  
  // Replace any remaining {@...} tags with empty string
  text = text.replace(/{@[^}]+}/g, "");
  
  return text.trim();
}

/**
 * Remove characters that the PDF's WinAnsi font cannot render
 */
function sanitizeForPdfValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  let strValue = String(value);
  
  // First, format special tags
  strValue = formatSpecialTags(strValue);

  // Handle special Vietnamese characters that don't decompose well
  strValue = strValue.replace(/đ/g, "d").replace(/Đ/g, "D");

  // Remove diacritics
  strValue = strValue.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Strip any remaining characters outside extended ASCII
  strValue = strValue.replace(/[^\x00-\xFF]/g, "");

  return strValue;
}

/**
 * Safely set a PDF form field value
 */
function setField(form, fieldName, value) {
  // Try exact field name first
  if (trySetField(form, fieldName, value)) {
    return true;
  }
  
  // Try with trailing space (some PDF fields have trailing spaces)
  if (trySetField(form, fieldName + " ", value)) {
    return true;
  }
  
  // Try with 2 trailing spaces (some PDF fields have 2 trailing spaces, e.g., "Wpn3 AtkBonus  ")
  if (trySetField(form, fieldName + "  ", value)) {
    return true;
  }
  
  // Try trimmed version (in case field name has leading/trailing spaces)
  const trimmed = fieldName.trim();
  if (trimmed !== fieldName && trySetField(form, trimmed, value)) {
    return true;
  }
  
  return false;
}

function trySetField(form, fieldName, value) {
  try {
    const field = form.getTextField(fieldName);
    if (field && value !== undefined && value !== null) {
      field.setText(sanitizeForPdfValue(value));
      return true;
    }
  } catch (e) {
    // Field might not exist or be wrong type, try checkbox
    try {
      const checkbox = form.getCheckBox(fieldName);
      if (checkbox) {
        if (value === true || value === "true" || value === 1) {
          checkbox.check();
        } else {
          checkbox.uncheck();
        }
        return true;
      }
    } catch (e2) {
      // Field doesn't exist, skip silently
    }
  }
  return false;
}

/**
 * Try to set a field with logging for debugging
 */
function setFieldWithLog(form, fieldName, value, skillName = "") {
  const result = setField(form, fieldName, value);
  if (!result && skillName) {
    // Log when a skill field fails to set
    console.log(`[PDF Export] Failed to set skill field "${fieldName}" for skill "${skillName}" with value "${value}"`);
  }
  return result;
}

/**
 * Helper to extract feature names from entries recursively
 * ONLY extracts feature names, NO descriptions
 */
function extractFeatureNames(entries, level = 1) {
  const features = [];
  if (!entries || !Array.isArray(entries)) return features;
  
  entries.forEach((entry) => {
    if (typeof entry === "string") {
      // Check if it's a feature with level requirement (e.g., "Feature Name||3")
      const levelMatch = entry.match(/\|\|(\d+)$/);
      if (levelMatch) {
        const requiredLevel = parseInt(levelMatch[1]);
        if (requiredLevel <= level) {
          const featureName = entry.replace(/\s*\|\|\d+$/, "").trim();
          // Extract just the feature name part (before any description)
          const nameOnly = featureName.split(/[\.\!\?]/)[0].trim();
          if (nameOnly && nameOnly.length <= 80 && !features.includes(nameOnly)) {
            features.push(nameOnly);
          }
        }
      } else {
        // For string entries without level, only take if it's VERY short (likely a feature name)
        // Skip anything longer than 50 characters or contains sentence punctuation
        const trimmed = entry.trim();
        if (trimmed.length > 3 && trimmed.length <= 50 && 
            !trimmed.includes(".") && !trimmed.includes("!") && !trimmed.includes("?") &&
            !trimmed.includes(",") && !trimmed.includes(";")) {
          const lowerTrimmed = trimmed.toLowerCase();
          // Skip if it looks like a description
          const isDescription = 
            lowerTrimmed.includes("you know") ||
            lowerTrimmed.includes("through ") ||
            lowerTrimmed.includes("work with") ||
            lowerTrimmed.includes("what was") ||
            lowerTrimmed.includes("some ") ||
            lowerTrimmed.startsWith("suggested") ||
            lowerTrimmed.includes("age") || 
            lowerTrimmed.includes("size") || 
            lowerTrimmed.includes("speed") ||
            lowerTrimmed.includes("language") ||
            lowerTrimmed.includes("ability score") ||
            lowerTrimmed.includes("proficiency") ||
            lowerTrimmed.includes("at ") ||
            lowerTrimmed.includes("when ") ||
            lowerTrimmed.includes("starting at");
          
          if (!isDescription && trimmed.length > 5) {
            if (!features.includes(trimmed)) {
              features.push(trimmed);
            }
          }
        }
      }
    } else if (entry && typeof entry === "object") {
      // Object with name property - ONLY take the name, NEVER descriptions
      if (entry.name) {
        const name = entry.name.toLowerCase();
        // Skip non-feature entries and description-like names
        if (!name.includes("age") && !name.includes("size") && 
            !name.includes("speed") && !name.includes("language") &&
            !name.includes("ability score") && !name.includes("proficiency") &&
            !name.includes("skill") && !name.includes("tool") &&
            !name.includes("equipment") && !name.includes("starting") &&
            !name.includes("suggested characteristics")) {
          // Remove "Feature: " prefix if present (for background features)
          let featureName = entry.name;
          if (featureName.startsWith("Feature: ")) {
            featureName = featureName.substring("Feature: ".length).trim();
          }
          // ONLY add the name, NEVER any description text from entries
          if (!features.includes(featureName)) {
            features.push(featureName);
          }
        }
      }
      // Recursively check entries property for nested feature names only
      // But skip if this entry already has a name (to avoid duplicating with descriptions)
      if (entry.entries && Array.isArray(entry.entries) && !entry.name) {
        const nestedFeatures = extractFeatureNames(entry.entries, level);
        nestedFeatures.forEach((f) => {
          if (!features.includes(f)) {
            features.push(f);
          }
        });
      }
    }
  });
  
  return features;
}

/**
 * Load features from class, subclass, race, subrace, background
 */
async function loadFeatures(character) {
  console.log("[PDF Export] ========== loadFeatures START ==========");
  console.log("[PDF Export] Character data:", {
    className: character.className,
    subclass: character.subclass,
    race: character.race,
    subrace: character.subrace,
    background: character.background,
    level: character.level
  });
  
  const features = [];
  const characterLevel = character.level || 1;
  
  try {
    // Load class features
    if (character.className) {
      const className = character.className.toLowerCase();
      console.log(`[PDF Export] Loading class features for: ${className}`);
      try {
        const classResponse = await httpRequest(`http://localhost:4000/api/data/classes/${className}`);
        console.log(`[PDF Export] Class response status: ${classResponse.status}`);
        if (classResponse.ok) {
          const classData = await classResponse.json();
          console.log(`[PDF Export] Class data keys:`, Object.keys(classData || {}));
          console.log(`[PDF Export] Class data.class type:`, Array.isArray(classData.class) ? `array[${classData.class?.length}]` : typeof classData.class);
          
          // Handle both formats: {class: [...]} or direct object
          let classInfo = null;
          if (classData.class && Array.isArray(classData.class) && classData.class[0]) {
            classInfo = classData.class[0];
          } else if (classData.classFeatures || classData.name) {
            // Direct object format
            classInfo = classData;
          }
          
          if (classInfo) {
            console.log(`[PDF Export] Class info keys:`, Object.keys(classInfo || {}));
            // Load from classFeatures array
            console.log(`[PDF Export] Class has classFeatures:`, !!classInfo.classFeatures);
            if (classInfo.classFeatures) {
              console.log(`[PDF Export] Class features count:`, classInfo.classFeatures.length);
              classInfo.classFeatures.forEach((feature) => {
              if (typeof feature === "string") {
                // Format: "Feature Name|Class||Level" or "Feature Name||Level"
                const parts = feature.split("|");
                const featureName = parts[0] ? parts[0].trim() : "";
                if (featureName) {
                  // Check level requirement
                  const levelMatch = feature.match(/\|\|(\d+)/);
                  if (levelMatch) {
                    const level = parseInt(levelMatch[1]);
                    if (level <= characterLevel && !features.includes(featureName)) {
                      features.push(featureName);
                    }
                  } else if (!features.includes(featureName)) {
                    // No level requirement, add it
                    features.push(featureName);
                  }
                }
              } else if (feature && typeof feature === "object") {
                // Format: { "classFeature": "Feature Name|Class||Level", ... }
                if (feature.classFeature && typeof feature.classFeature === "string") {
                  const parts = feature.classFeature.split("|");
                  const featureName = parts[0] ? parts[0].trim() : "";
                  if (featureName) {
                    const levelMatch = feature.classFeature.match(/\|\|(\d+)/);
                    if (levelMatch) {
                      const level = parseInt(levelMatch[1]);
                      if (level <= characterLevel && !features.includes(featureName)) {
                        features.push(featureName);
                      }
                    } else if (!features.includes(featureName)) {
                      features.push(featureName);
                    }
                  }
                } else if (feature.name && !features.includes(feature.name)) {
                  features.push(feature.name);
                }
              }
            });
          }
          // Also check entries for features
          if (classInfo.entries) {
            console.log(`[PDF Export] Class has entries, extracting features...`);
            const entryFeatures = extractFeatureNames(classInfo.entries, characterLevel);
            console.log(`[PDF Export] Extracted ${entryFeatures.length} features from class entries`);
            entryFeatures.forEach((f) => {
              if (!features.includes(f)) {
                features.push(f);
              }
            });
          }
          } else {
            console.log(`[PDF Export] No class info found in response`);
          }
        } else {
          console.log(`[PDF Export] Class response not OK`);
        }
      } catch (e) {
        console.error(`[PDF Export] Error fetching class data:`, e);
        console.error(`[PDF Export] Error stack:`, e.stack);
      }
    }
    
    // Load subclass features
    if (character.className && character.subclass) {
      const className = character.className.toLowerCase();
      console.log(`[PDF Export] Loading subclass features for: ${character.subclass} (${className})`);
      try {
        const subclassResponse = await httpRequest(`http://localhost:4000/api/data/classes/${className}/subclasses`);
        console.log(`[PDF Export] Subclass response status: ${subclassResponse.status}`);
        if (subclassResponse.ok) {
          const subclasses = await subclassResponse.json();
          const subclass = Array.isArray(subclasses) ? subclasses.find((s) => s.name === character.subclass) : null;
          if (subclass) {
            // Load from subclassFeatures array
            if (subclass.subclassFeatures) {
              subclass.subclassFeatures.forEach((feature) => {
                if (typeof feature === "string") {
                  // Format: "Feature Name|Class||Subclass||Level"
                  const parts = feature.split("|");
                  const featureName = parts[0] ? parts[0].trim() : "";
                  if (featureName) {
                    // Check level requirement (usually the last number after ||)
                    const levelMatch = feature.match(/\|\|(\d+)/);
                    if (levelMatch) {
                      const level = parseInt(levelMatch[1]);
                      if (level <= characterLevel && !features.includes(featureName)) {
                        features.push(featureName);
                      }
                    } else if (!features.includes(featureName)) {
                      features.push(featureName);
                    }
                  }
                }
              });
            }
            // Also check entries for features
            if (subclass.entries) {
              const entryFeatures = extractFeatureNames(subclass.entries, characterLevel);
              entryFeatures.forEach((f) => {
                if (!features.includes(f)) {
                  features.push(f);
                }
              });
            }
          }
        }
      } catch (e) {
        console.error("[PDF Export] Error loading subclass features:", e);
      }
    }
    
    // Load race features
    if (character.race) {
      const raceName = character.race.toLowerCase();
      console.log(`[PDF Export] Loading race features for: ${raceName}`);
      try {
        const raceResponse = await httpRequest(`http://localhost:4000/api/data/races/${raceName}`);
        console.log(`[PDF Export] Race response status: ${raceResponse.status}`);
        if (raceResponse.ok) {
          const raceData = await raceResponse.json();
        if (raceData.race && raceData.race[0]) {
          const raceInfo = raceData.race[0];
          if (raceInfo.entries) {
            const entryFeatures = extractFeatureNames(raceInfo.entries, characterLevel);
            entryFeatures.forEach((f) => {
              if (!features.includes(f)) {
                features.push(f);
              }
            });
          }
          }
        }
      } catch (e) {
        console.error(`[PDF Export] Error fetching race data:`, e);
      }
    }
    
    // Load subrace features
    if (character.subrace) {
      try {
        console.log(`[PDF Export] Loading subrace features for: ${character.subrace}`);
        const subraceResponse = await httpRequest(`http://localhost:4000/api/data/subraces/${character.subrace}`);
        console.log(`[PDF Export] Subrace response status: ${subraceResponse.status}`);
        if (subraceResponse.ok) {
          const subraceData = await subraceResponse.json();
          if (subraceData.entries) {
            const entryFeatures = extractFeatureNames(subraceData.entries, characterLevel);
            entryFeatures.forEach((f) => {
              if (!features.includes(f)) {
                features.push(f);
              }
            });
          }
        }
      } catch (e) {
        console.error("[PDF Export] Error loading subrace features:", e);
      }
    }
    
    // Load background features
    if (character.background) {
      const backgroundName = character.background.toLowerCase();
      console.log(`[PDF Export] Loading background features for: ${backgroundName}`);
      try {
        const backgroundResponse = await httpRequest(`http://localhost:4000/api/data/backgrounds/${backgroundName}`);
        console.log(`[PDF Export] Background response status: ${backgroundResponse.status}`);
        if (backgroundResponse.ok) {
          const backgroundData = await backgroundResponse.json();
          console.log(`[PDF Export] Background data keys:`, Object.keys(backgroundData || {}));
          console.log(`[PDF Export] Background data.background type:`, Array.isArray(backgroundData.background) ? `array[${backgroundData.background?.length}]` : typeof backgroundData.background);
          
          // Handle both formats: {background: [...]} or direct object
          let bgInfo = null;
          if (backgroundData.background && Array.isArray(backgroundData.background) && backgroundData.background[0]) {
            bgInfo = backgroundData.background[0];
          } else if (backgroundData.entries || backgroundData.name) {
            // Direct object format
            bgInfo = backgroundData;
          }
          
          if (bgInfo) {
            console.log(`[PDF Export] Background info keys:`, Object.keys(bgInfo || {}));
            console.log(`[PDF Export] Background has entries:`, !!bgInfo.entries);
            if (bgInfo.entries) {
              console.log(`[PDF Export] Background entries count:`, bgInfo.entries.length);
              bgInfo.entries.forEach((entry) => {
                if (entry && typeof entry === "object" && entry.name) {
                  const name = entry.name.toLowerCase();
                  // Include feature entries
                  if (name.includes("feature")) {
                    // Remove "Feature: " prefix if present
                    let featureName = entry.name;
                    if (featureName.startsWith("Feature: ")) {
                      featureName = featureName.substring("Feature: ".length).trim();
                    }
                    console.log(`[PDF Export] Found background feature: ${entry.name} -> ${featureName}`);
                    if (!features.includes(featureName)) {
                      features.push(featureName);
                    }
                  }
                }
              });
              // Also extract from nested entries
              const entryFeatures = extractFeatureNames(bgInfo.entries, characterLevel);
              console.log(`[PDF Export] Extracted ${entryFeatures.length} features from background entries`);
              entryFeatures.forEach((f) => {
                if (!features.includes(f)) {
                  features.push(f);
                }
              });
            }
          } else {
            console.log(`[PDF Export] No background info found in response`);
          }
        }
      } catch (e) {
        console.error(`[PDF Export] Error fetching background data:`, e);
      }
    }
    
    // Add feats
    if (character.feats && character.feats.length > 0) {
      character.feats.forEach((feat) => {
        if (!features.includes(feat)) {
          features.push(feat);
        }
      });
    }
  } catch (error) {
    console.error("[PDF Export] Error loading features:", error);
    console.error("[PDF Export] Error stack:", error.stack);
  }
  
  console.log(`[PDF Export] ========== loadFeatures END ==========`);
  console.log(`[PDF Export] Total features loaded: ${features.length}`);
  if (features.length > 0) {
    console.log(`[PDF Export] Features list:`, features);
    // Clean up features: format special tags properly
    const cleanedFeatures = features.map(feature => {
      if (typeof feature === "string") {
        // Use formatSpecialTags to properly parse all tag types
        return formatSpecialTags(feature);
      }
      return feature;
    }).filter(f => f && f.length > 0); // Remove empty features
    
    console.log(`[PDF Export] Cleaned features (${cleanedFeatures.length}):`, cleanedFeatures);
    return cleanedFeatures;
  } else {
    console.log(`[PDF Export] WARNING: No features found!`);
    return [];
  }
}

/**
 * Main function to export character to PDF
 */
async function exportCharacterToPDF(character) {
  console.log("[PDF Export] ========== exportCharacterToPDF START ==========");
  console.log("[PDF Export] Character:", {
    name: character.name,
    className: character.className,
    level: character.level,
    race: character.race
  });
  
  // Load PDF template
  const pdfPath = path.join(__dirname, "..", "data", "5E_CharacterSheet_Fillable.pdf");
  console.log("[PDF Export] PDF path:", pdfPath);
  if (!fs.existsSync(pdfPath)) {
    console.error("[PDF Export] ERROR: PDF template không tồn tại tại:", pdfPath);
    throw new Error("PDF template không tồn tại");
  }
  console.log("[PDF Export] PDF template found, loading...");

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  // Debug: List all field names (only on first run or when debugging)
  if (process.env.DEBUG_PDF_FIELDS === "true") {
    console.log("[PDF Export] Listing all PDF field names:");
    const allFields = form.getFields();
    allFields.forEach((field, index) => {
      const name = field.getName().toLowerCase();
      if (name.includes("stealth") || name.includes("deception") || name.includes("history") || 
          name.includes("investigation") || name.includes("perception") || name.includes("acrobatics") ||
          name.includes("athletics") || name.includes("sleight") || name.includes("animal") ||
          name.includes("arcana") || name.includes("insight") || name.includes("intimidation") ||
          name.includes("medicine") || name.includes("nature") || name.includes("performance") ||
          name.includes("persuasion") || name.includes("religion") || name.includes("survival")) {
        console.log(`  ${index}: ${field.getName()} (${field.constructor.name})`);
      }
    });
  }

  const stats = character.calculatedStats || {};
  
  // Helper to format modifier
  const formatMod = (mod) => mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : "+0";
  
  // ========== BASIC INFORMATION ==========
  setField(form, "CharacterName", character.name || "");
  setField(form, "CharacterName 2", character.name || "");
  setField(form, "ClassLevel", `${character.className || ""} ${character.level || 1}`);
  setField(form, "Background", character.background || "");
  setField(form, "PlayerName", "");
  let raceText = character.race || "";
  if (character.subrace) {
    raceText = `${character.race || ""} (${character.subrace})`;
  }
  setField(form, "Race", raceText); // PDF field is "Race " (with trailing space) - handled by setField
  setField(form, "Alignment", character.alignment || "");
  setField(form, "XP", character.experiencePoints !== undefined ? String(character.experiencePoints) : "0");
  // Note: "ExperiencePoints" field doesn't exist in PDF, only "XP" exists
  
  // Physical Description
  setField(form, "Age", character.age || "");
  setField(form, "Height", character.height || "");
  setField(form, "Weight", character.weight || "");
  setField(form, "Hair", character.hair || "");
  setField(form, "Eyes", character.eyes || "");
  setField(form, "Skin", character.skin || "");
  
  // ========== ABILITY SCORES ==========
  if (character.abilityScores) {
    const scores = character.abilityScores;
    // Note: Full names (Strength, Dexterity, etc.) don't exist in PDF, only abbreviated (STR, DEX, etc.)
    
    // Abbreviated (these are the actual PDF field names)
    setField(form, "STR", scores.str || 10);
    setField(form, "DEX", scores.dex || 10);
    setField(form, "CON", scores.con || 10);
    setField(form, "INT", scores.int || 10);
    setField(form, "WIS", scores.wis || 10);
    setField(form, "CHA", scores.cha || 10);
    
    // Modifiers - use from calculatedStats if available, otherwise calculate
    const abilityModifiers = stats.abilityModifiers || {};
    const getMod = (score) => Math.floor((score - 10) / 2);
    const strMod = abilityModifiers.str !== undefined ? abilityModifiers.str : getMod(scores.str || 10);
    const dexMod = abilityModifiers.dex !== undefined ? abilityModifiers.dex : getMod(scores.dex || 10);
    const conMod = abilityModifiers.con !== undefined ? abilityModifiers.con : getMod(scores.con || 10);
    const intMod = abilityModifiers.int !== undefined ? abilityModifiers.int : getMod(scores.int || 10);
    const wisMod = abilityModifiers.wis !== undefined ? abilityModifiers.wis : getMod(scores.wis || 10);
    const chaMod = abilityModifiers.cha !== undefined ? abilityModifiers.cha : getMod(scores.cha || 10);
    
    setField(form, "STRmod", formatMod(strMod));
    setField(form, "DEXmod", formatMod(dexMod)); // PDF field is "DEXmod " (with trailing space) - handled by setField
    setField(form, "CONmod", formatMod(conMod));
    setField(form, "INTmod", formatMod(intMod));
    setField(form, "WISmod", formatMod(wisMod));
    setField(form, "CHAmod", formatMod(chaMod));
    setField(form, "CHamod", formatMod(chaMod)); // PDF has typo "CHamod" instead of "CHAmod"
  }
  
  // ========== SAVING THROWS ==========
  if (stats.savingThrows) {
    const saves = stats.savingThrows;
    setField(form, "ST Strength", formatMod(saves.str?.modifier || 0));
    setField(form, "ST Dexterity", formatMod(saves.dex?.modifier || 0));
    setField(form, "ST Constitution", formatMod(saves.con?.modifier || 0));
    setField(form, "ST Intelligence", formatMod(saves.int?.modifier || 0));
    setField(form, "ST Wisdom", formatMod(saves.wis?.modifier || 0));
    setField(form, "ST Charisma", formatMod(saves.cha?.modifier || 0));
    
    // Proficiency checkboxes
    setField(form, "Check Box 11", saves.str?.proficient || false);
    setField(form, "Check Box 18", saves.dex?.proficient || false);
    setField(form, "Check Box 19", saves.con?.proficient || false);
    setField(form, "Check Box 20", saves.int?.proficient || false);
    setField(form, "Check Box 21", saves.wis?.proficient || false);
    setField(form, "Check Box 22", saves.cha?.proficient || false);
  }
  
  // ========== SKILLS ==========
  // Always fill all 18 skills - ensure every skill has a modifier
  const allSkills = [
    "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
    "History", "Insight", "Intimidation", "Investigation", "Medicine",
    "Nature", "Perception", "Performance", "Persuasion", "Religion",
    "Sleight of Hand", "Stealth", "Survival"
  ];
  
  const skillFields = {
    "Acrobatics": "Acrobatics",
    "Animal Handling": "Animal",
    "Arcana": "Arcana",
    "Athletics": "Athletics",
    "Deception": "Deception",
    "History": "History",
    "Insight": "Insight",
    "Intimidation": "Intimidation",
    "Investigation": "Investigation",
    "Medicine": "Medicine",
    "Nature": "Nature",
    "Perception": "Perception",
    "Performance": "Performance",
    "Persuasion": "Persuasion",
    "Religion": "Religion",
    "Sleight of Hand": "Sleight",
    "Stealth": "Stealth",
    "Survival": "Survival"
  };
  
  const skillCheckboxes = {
    "Acrobatics": "Check Box 23",
    "Animal": "Check Box 24",
    "Arcana": "Check Box 25",
    "Athletics": "Check Box 26",
    "Deception": "Check Box 27",
    "History": "Check Box 28",
    "Insight": "Check Box 29",
    "Intimidation": "Check Box 30",
    "Investigation": "Check Box 31",
    "Medicine": "Check Box 32",
    "Nature": "Check Box 33",
    "Perception": "Check Box 34",
    "Performance": "Check Box 35",
    "Persuasion": "Check Box 36",
    "Religion": "Check Box 37",
    "Sleight": "Check Box 38",
    "Stealth": "Check Box 39",
    "Survival": "Check Box 40"
  };
  
  const getSkillAbility = (skillName) => {
    const skillMap = {
      "Acrobatics": "dex", "Animal Handling": "wis", "Arcana": "int",
      "Athletics": "str", "Deception": "cha", "History": "int",
      "Insight": "wis", "Intimidation": "cha", "Investigation": "int",
      "Medicine": "wis", "Nature": "int", "Perception": "wis",
      "Performance": "cha", "Persuasion": "cha", "Religion": "int",
      "Sleight of Hand": "dex", "Stealth": "dex", "Survival": "wis"
    };
    return skillMap[skillName] || "int";
  };
  
  // Process all 18 skills - ensure every skill is filled
  const skills = stats.skills || {};
  console.log("[PDF Export] Processing skills. Stats.skills:", Object.keys(skills));
  
  allSkills.forEach((skillName) => {
    const fieldPrefix = skillFields[skillName];
    if (!fieldPrefix) {
      console.log(`[PDF Export] No field prefix for skill: ${skillName}`);
      return;
    }
    
    const skill = skills[skillName];
    let modifier = 0;
    let isProficient = false;
    
    if (skill) {
      // Use modifier from calculatedStats
      modifier = skill.modifier !== undefined ? skill.modifier : 0;
      isProficient = skill.proficient === true;
      console.log(`[PDF Export] Skill "${skillName}": modifier=${modifier}, proficient=${isProficient}`);
    } else if (character.abilityScores) {
      // Calculate base modifier if not in stats (fallback)
      const ability = getSkillAbility(skillName);
      const score = character.abilityScores[ability] || 10;
      modifier = Math.floor((score - 10) / 2);
      console.log(`[PDF Export] Skill "${skillName}" not in stats, calculated from ${ability} (${score}): modifier=${modifier}`);
    } else {
      console.log(`[PDF Export] Warning: Skill "${skillName}" has no data and no ability scores to calculate from`);
    }
    
    // Always format modifier (even if 0, show "+0")
    const modifierText = formatMod(modifier);
    
    // Try multiple field name patterns to ensure we hit the right field
    // Note: PDF form field names may vary - try common variations
    // IMPORTANT: Some PDF fields have trailing spaces (e.g., "Deception ", "History ")
    const fieldNamesToTry = [
      fieldPrefix, // Main field name (e.g., "Stealth")
      fieldPrefix + " ", // With trailing space (e.g., "Stealth ") - many PDF fields have this!
      `${fieldPrefix}Mod`, // e.g., "StealthMod"
      `${fieldPrefix} Mod`, // e.g., "Stealth Mod"
      `${fieldPrefix}_Mod`, // e.g., "Stealth_Mod"
      `${fieldPrefix}Modifier`, // e.g., "StealthModifier"
      `${fieldPrefix}ModifierValue`, // e.g., "StealthModifierValue"
      `Skill${fieldPrefix}`, // e.g., "SkillStealth"
      `Skill ${fieldPrefix}`, // e.g., "Skill Stealth"
      // Try with lowercase first letter variations
      fieldPrefix.charAt(0).toLowerCase() + fieldPrefix.slice(1),
      // Try exact skill name (for skills with spaces)
      skillName,
      skillName + " ", // With trailing space
      // Try without spaces
      skillName.replace(/\s+/g, ""),
      skillName.replace(/\s+/g, "").charAt(0).toLowerCase() + skillName.replace(/\s+/g, "").slice(1),
    ];
    
    let setSuccess = false;
    let successfulFieldName = null;
    fieldNamesToTry.forEach(fieldName => {
      if (!setSuccess && setField(form, fieldName, modifierText)) {
        setSuccess = true;
        successfulFieldName = fieldName;
        console.log(`[PDF Export] ✓ Successfully set "${skillName}" modifier using field: "${fieldName}" = "${modifierText}"`);
      }
    });
    
    if (!setSuccess) {
      console.log(`[PDF Export] ✗ WARNING: Failed to set modifier for skill "${skillName}" (modifier: ${modifierText}, tried ${fieldNamesToTry.length} field name variations)`);
      console.log(`[PDF Export]   Tried field names: ${fieldNamesToTry.slice(0, 5).join(", ")}...`);
    }
    
    // Special handling for "Sleight of Hand"
    if (skillName === "Sleight of Hand") {
      setField(form, "SleightofHand", modifierText);
      setField(form, "SleightofHandMod", modifierText);
      setField(form, "Sleight of Hand", modifierText);
    }
    
    // Proficiency checkbox - always set (checked or unchecked)
    if (skillCheckboxes[fieldPrefix]) {
      setField(form, skillCheckboxes[fieldPrefix], isProficient);
    }
    if (skillName === "Sleight of Hand") {
      setField(form, skillCheckboxes["SleightofHand"] || skillCheckboxes["Sleight"], isProficient);
    }
  });
  
  // ========== OTHER STATS ==========
  setField(form, "AC", stats.ac || 10);
  setField(form, "Initiative", formatMod(stats.initiative || 0));
  setField(form, "Speed", stats.speed || 30);
  setField(form, "ProfBonus", formatMod(stats.proficiencyBonus || 2)); // PDF field is "ProfBonus", not "ProficiencyBonus"
  setField(form, "Passive", stats.passivePerception || 10); // PDF field is "Passive", not "PassivePerception"
  
  // HP
  setField(form, "HPMax", stats.hpMax || stats.maxHp || 8);
  setField(form, "HPCurrent", stats.hpCurrent || stats.hp || stats.maxHp || 8);
  // Note: "HP" field doesn't exist in PDF, only "HPMax" and "HPCurrent"
  setField(form, "HDTotal", stats.hitDice || stats.hitDie || "1d8");
  setField(form, "HD", stats.hitDice || stats.hitDie || "1d8");
  
  // ========== EQUIPMENT ==========
  if (stats.expandedEquipment && stats.expandedEquipment.length > 0) {
    const equipmentText = stats.expandedEquipment.join("\n");
    setField(form, "Equipment", equipmentText);
  } else if (character.equipment && character.equipment.length > 0) {
    const equipmentText = character.equipment.join("\n");
    setField(form, "Equipment", equipmentText);
  }
  
  // ========== WEAPONS ==========
  // Use calculated weapons from stats if available
  // PDF field names: "Wpn Name", "Wpn1 AtkBonus", "Wpn1 Damage", "Wpn Name 2", "Wpn2 AtkBonus ", "Wpn2 Damage ", "Wpn Name 3", "Wpn3 AtkBonus  ", "Wpn3 Damage "
  console.log(`[PDF Export] Weapons check - stats.weapons:`, stats.weapons ? `${stats.weapons.length} weapons` : "null");
  console.log(`[PDF Export] Equipment check - character.equipment:`, character.equipment ? `${character.equipment.length} items` : "null");
  console.log(`[PDF Export] Equipment check - stats.expandedEquipment:`, stats.expandedEquipment ? `${stats.expandedEquipment.length} items` : "null");
  
  if (stats.weapons && stats.weapons.length > 0) {
    console.log(`[PDF Export] Filling ${stats.weapons.length} weapons into PDF`);
    stats.weapons.slice(0, 3).forEach((weapon, index) => {
      const weaponNum = index + 1;
      let weaponNameField, atkBonusField, damageField;
      
      if (weaponNum === 1) {
        weaponNameField = "Wpn Name";
        atkBonusField = "Wpn1 AtkBonus";
        damageField = "Wpn1 Damage";
      } else if (weaponNum === 2) {
        weaponNameField = "Wpn Name 2";
        atkBonusField = "Wpn2 AtkBonus"; // PDF field is "Wpn2 AtkBonus " (with trailing space) - handled by setField
        damageField = "Wpn2 Damage"; // PDF field is "Wpn2 Damage " (with trailing space) - handled by setField
      } else {
        weaponNameField = "Wpn Name 3";
        atkBonusField = "Wpn3 AtkBonus"; // PDF field is "Wpn3 AtkBonus  " (with 2 trailing spaces) - handled by setField
        damageField = "Wpn3 Damage"; // PDF field is "Wpn3 Damage " (with trailing space) - handled by setField
      }
      
      console.log(`[PDF Export] Setting weapon ${weaponNum}: ${weapon.name || ""}, atk: ${weapon.attackBonus || 0}, dmg: ${weapon.damage || "1d6"}`);
      setField(form, weaponNameField, weapon.name || "");
      setField(form, atkBonusField, formatMod(weapon.attackBonus || 0));
      setField(form, damageField, `${weapon.damage || "1d6"} ${weapon.damageType || "slashing"}`);
    });
  } else {
    // Fallback to equipment parsing - check character.equipment first if expandedEquipment is empty
    const equipmentList = (stats.expandedEquipment && stats.expandedEquipment.length > 0) 
      ? stats.expandedEquipment 
      : (character.equipment || []);
    console.log(`[PDF Export] No weapons in stats, parsing from equipment (${equipmentList.length} items)`);
    const weapons = [];
    equipmentList.forEach((item) => {
      if (!item || typeof item !== "string") return;
      const itemLower = item.toLowerCase();
      if (itemLower.includes("sword") || itemLower.includes("dagger") || 
          itemLower.includes("axe") || itemLower.includes("mace") ||
          itemLower.includes("bow") || itemLower.includes("crossbow") ||
          itemLower.includes("spear") || itemLower.includes("staff") ||
          itemLower.includes("club") || itemLower.includes("whip") ||
          itemLower.includes("dart") || itemLower.includes("sling") ||
          itemLower.includes("rapier") || itemLower.includes("scimitar") ||
          itemLower.includes("handaxe") || itemLower.includes("javelin")) {
        if (!item.startsWith("  └─")) { // Skip pack contents
          weapons.push(item);
          console.log(`[PDF Export] Found weapon: ${item}`);
        }
      }
    });
    
    console.log(`[PDF Export] Found ${weapons.length} weapons from equipment`);
    
    weapons.slice(0, 3).forEach((weapon, index) => {
      const weaponNum = index + 1;
      let weaponNameField, atkBonusField, damageField;
      
      if (weaponNum === 1) {
        weaponNameField = "Wpn Name";
        atkBonusField = "Wpn1 AtkBonus";
        damageField = "Wpn1 Damage";
      } else if (weaponNum === 2) {
        weaponNameField = "Wpn Name 2";
        atkBonusField = "Wpn2 AtkBonus"; // PDF field is "Wpn2 AtkBonus " (with trailing space) - handled by setField
        damageField = "Wpn2 Damage"; // PDF field is "Wpn2 Damage " (with trailing space) - handled by setField
      } else {
        weaponNameField = "Wpn Name 3";
        atkBonusField = "Wpn3 AtkBonus"; // PDF field is "Wpn3 AtkBonus  " (with 2 trailing spaces) - handled by setField
        damageField = "Wpn3 Damage"; // PDF field is "Wpn3 Damage " (with trailing space) - handled by setField
      }
      
      setField(form, weaponNameField, weapon);
      
      // Calculate attack bonus and damage
      const weaponLower = weapon.toLowerCase();
      let atkAbility = "str";
      if (weaponLower.includes("bow") || weaponLower.includes("crossbow") || 
          weaponLower.includes("dagger") || weaponLower.includes("dart") ||
          weaponLower.includes("sling")) {
        atkAbility = "dex";
      }
      
      const abilityScore = character.abilityScores?.[atkAbility] || 10;
      const abilityMod = Math.floor((abilityScore - 10) / 2);
      const profBonus = stats.proficiencyBonus || 2;
      const atkBonus = abilityMod + profBonus;
      
      setField(form, atkBonusField, formatMod(atkBonus));
      
      // Damage (simplified - would need weapon data for exact dice)
      const damageMap = {
        "dagger": "1d4", "shortsword": "1d6", "longsword": "1d8",
        "greatsword": "2d6", "rapier": "1d8", "scimitar": "1d6",
        "handaxe": "1d6", "greataxe": "1d12", "mace": "1d6",
        "quarterstaff": "1d6", "spear": "1d6", "crossbow": "1d8",
        "longbow": "1d8", "shortbow": "1d6"
      };
      
      let damage = "1d6";
      for (const [weaponType, dice] of Object.entries(damageMap)) {
        if (weaponLower.includes(weaponType)) {
          damage = dice;
          break;
        }
      }
      
      const damageType = weaponLower.includes("bow") || weaponLower.includes("crossbow") || 
                         weaponLower.includes("dart") || weaponLower.includes("sling") ? "piercing" :
                         weaponLower.includes("mace") || weaponLower.includes("club") || 
                         weaponLower.includes("staff") ? "bludgeoning" : "slashing";
      
      setField(form, damageField, `${damage} ${damageType}`);
    });
  }
  
  // ========== SPELLS ==========
  console.log(`[PDF Export] Spells check - character.spells:`, character.spells ? "exists" : "null");
  // Check if character has any spells (from class OR race)
  const hasSpells = character.spells && (
    (character.spells.cantrips && character.spells.cantrips.length > 0) ||
    Object.keys(character.spells).some(key => key.startsWith("level") && character.spells[key] && character.spells[key].length > 0)
  );
  
  if (hasSpells) {
    const classNameLower = character.className ? character.className.toLowerCase() : "";
    const isSpellcaster = ["wizard", "sorcerer", "warlock", "cleric", "druid", 
                          "bard", "ranger", "paladin"].includes(classNameLower);
    console.log(`[PDF Export] Has spells: ${hasSpells}, Is spellcaster: ${isSpellcaster} (class: ${classNameLower})`);
    
    // Export spells (from class OR race/other sources)
    console.log(`[PDF Export] Processing spells${character.className ? ` for ${character.className}` : ""}`);
    
    // Determine spellcasting ability
    let spellcastingAbility = stats.spellcastingAbility;
    let spellSaveDC = stats.spellSaveDC;
    let spellAttackBonus = stats.spellAttackBonus;
    const spellSlots = stats.spellSlots;
    const proficiencyBonus = stats.proficiencyBonus || Math.ceil((character.level || 1) / 4) + 1;
    
    // If not a spellcaster, try to get spellcasting ability from race spells
    if (!isSpellcaster && !spellcastingAbility) {
      // Default to Charisma for most race spells (Tiefling, etc.)
      spellcastingAbility = "cha";
      console.log(`[PDF Export] Character is not a spellcaster, using default spellcasting ability: ${spellcastingAbility}`);
      
      // Try to load race data to get actual spellcasting ability
      if (character.race) {
        try {
          const raceResponse = await httpRequest(`http://localhost:4000/api/data/races/${character.race.toLowerCase()}`);
          if (raceResponse.ok) {
            const raceData = await raceResponse.json();
            if (raceData.additionalSpells && raceData.additionalSpells.length > 0) {
              const firstSpellData = raceData.additionalSpells[0];
              if (firstSpellData.ability) {
                if (typeof firstSpellData.ability === "string") {
                  spellcastingAbility = firstSpellData.ability.toLowerCase();
                } else if (Array.isArray(firstSpellData.ability.choose)) {
                  // If it's a choice, default to first option (usually cha for Tiefling)
                  spellcastingAbility = firstSpellData.ability.choose[0].toLowerCase();
                }
                console.log(`[PDF Export] Found spellcasting ability from race: ${spellcastingAbility}`);
              }
            }
          }
        } catch (e) {
          console.error(`[PDF Export] Error loading race data for spellcasting ability:`, e);
        }
      }
    }
    
    // Calculate spellcasting stats according to PHB rules:
    // Spell Save DC = 8 + spellcasting ability modifier + proficiency bonus
    // Spell Attack Bonus = spellcasting ability modifier + proficiency bonus
    if (!spellSaveDC || !spellAttackBonus) {
      const abilityKey = spellcastingAbility || "cha";
      const abilityScore = character.abilityScores?.[abilityKey] || 10;
      const abilityMod = Math.floor((abilityScore - 10) / 2);
      
      if (!spellSaveDC) {
        spellSaveDC = 8 + abilityMod + proficiencyBonus;
        console.log(`[PDF Export] Calculated Spell Save DC: 8 + ${abilityMod} (${abilityKey} mod) + ${proficiencyBonus} (prof) = ${spellSaveDC}`);
      }
      
      if (spellAttackBonus === undefined || spellAttackBonus === null) {
        spellAttackBonus = abilityMod + proficiencyBonus;
        console.log(`[PDF Export] Calculated Spell Attack Bonus: ${abilityMod} (${abilityKey} mod) + ${proficiencyBonus} (prof) = ${spellAttackBonus}`);
      }
    }
    
    // Set spellcasting class if character is a spellcaster
    if (isSpellcaster && character.className) {
      setField(form, "Spellcasting Class 2", character.className);
    }
    
    // Always fill spellcasting stats if character has spells
    if (spellcastingAbility) {
      const abilityName = spellcastingAbility.toUpperCase().substring(0, 3); // "cha" -> "CHA"
      setField(form, "SpellcastingAbility 2", abilityName);
      console.log(`[PDF Export] Set SpellcastingAbility 2 = ${abilityName}`);
    }
    if (spellSaveDC !== undefined && spellSaveDC !== null) {
      setField(form, "SpellSaveDC  2", spellSaveDC.toString());
      console.log(`[PDF Export] Set SpellSaveDC  2 = ${spellSaveDC}`);
    }
    if (spellAttackBonus !== undefined && spellAttackBonus !== null) {
      setField(form, "SpellAtkBonus 2", formatMod(spellAttackBonus));
      console.log(`[PDF Export] Set SpellAtkBonus 2 = ${formatMod(spellAttackBonus)}`);
    }
    
    // Fill spell slots - always fill if character is a spellcaster, otherwise leave empty (race spells don't use slots)
    if (isSpellcaster) {
        if (spellSlots) {
          for (let level = 1; level <= 9; level++) {
            const levelKey = `level${level}`;
            const slotData = spellSlots[levelKey];
            if (slotData) {
              const fieldIndex = 18 + level; // 19-27
              setField(form, `SlotsTotal ${fieldIndex}`, slotData.total || 0);
              setField(form, `SlotsRemaining ${fieldIndex}`, (slotData.total || 0) - (slotData.used || 0));
            }
          }
        } else {
          // Fallback: calculate spell slots
          const calculateSpellSlots = (className, level) => {
          const slots = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0};
          
          if (["wizard", "cleric", "druid", "bard", "sorcerer"].includes(className)) {
            // Full caster
            const fullCasterSlots = {
              1: [2,0,0,0,0,0,0,0,0], 2: [3,0,0,0,0,0,0,0,0], 3: [4,2,0,0,0,0,0,0,0],
              4: [4,3,0,0,0,0,0,0,0], 5: [4,3,2,0,0,0,0,0,0], 6: [4,3,3,0,0,0,0,0,0],
              7: [4,3,3,1,0,0,0,0,0], 8: [4,3,3,2,0,0,0,0,0], 9: [4,3,3,3,1,0,0,0,0],
              10: [4,3,3,3,2,0,0,0,0], 11: [4,3,3,3,2,1,0,0,0], 12: [4,3,3,3,2,1,0,0,0],
              13: [4,3,3,3,2,1,1,0,0], 14: [4,3,3,3,2,1,1,0,0], 15: [4,3,3,3,2,1,1,1,0],
              16: [4,3,3,3,2,1,1,1,0], 17: [4,3,3,3,2,1,1,1,1], 18: [4,3,3,3,3,1,1,1,1],
              19: [4,3,3,3,3,2,1,1,1], 20: [4,3,3,3,3,2,2,1,1]
            };
            const levelSlots = fullCasterSlots[Math.min(level, 20)] || [0,0,0,0,0,0,0,0,0];
            for (let i = 1; i <= 9; i++) {
              slots[i] = levelSlots[i - 1] || 0;
            }
          } else if (["ranger", "paladin"].includes(className)) {
            // Half caster
            const halfCasterLevel = Math.ceil(level / 2);
            const halfCasterSlots = {
              1: [0,0,0,0,0], 2: [2,0,0,0,0], 3: [3,0,0,0,0], 4: [3,0,0,0,0],
              5: [4,2,0,0,0], 6: [4,2,0,0,0], 7: [4,3,0,0,0], 8: [4,3,0,0,0],
              9: [4,3,2,0,0], 10: [4,3,2,0,0], 11: [4,3,3,0,0], 12: [4,3,3,0,0],
              13: [4,3,3,1,0], 14: [4,3,3,1,0], 15: [4,3,3,2,0], 16: [4,3,3,2,0],
              17: [4,3,3,3,1], 18: [4,3,3,3,1], 19: [4,3,3,3,2], 20: [4,3,3,3,2]
            };
            const levelSlots = halfCasterSlots[Math.min(halfCasterLevel, 20)] || [0,0,0,0,0];
            for (let i = 1; i <= 5; i++) {
              slots[i] = levelSlots[i - 1] || 0;
            }
          } else if (className === "warlock") {
            // Warlock (Pact Magic)
            const warlockSlots = {1:1, 2:2, 3:2, 4:2, 5:2, 6:2, 7:2, 8:2, 9:2, 10:2, 
                                 11:3, 12:3, 13:3, 14:3, 15:3, 16:3, 17:4, 18:4, 19:4, 20:4};
            const numSlots = warlockSlots[Math.min(level, 20)] || 0;
            const slotLevel = Math.min(Math.ceil(level / 2), 5);
            slots[slotLevel] = numSlots;
          }
          
          return slots;
        };
        
        const calculatedSlots = calculateSpellSlots(classNameLower, character.level || 1);
        for (let level = 1; level <= 9; level++) {
          const fieldIndex = 18 + level; // 19-27
          const slots = calculatedSlots[level] || 0;
          setField(form, `SlotsTotal ${fieldIndex}`, slots);
          setField(form, `SlotsRemaining ${fieldIndex}`, slots);
        }
      }
    }
      
      // Individual spells
      const allSpells = [];
      if (character.spells.cantrips) {
        console.log(`[PDF Export] Found ${character.spells.cantrips.length} cantrips`);
        character.spells.cantrips.forEach((spell) => {
          allSpells.push({name: spell, level: 0});
        });
      }
      for (let level = 1; level <= 9; level++) {
        const levelKey = `level${level}`;
        const levelSpells = character.spells[levelKey];
        if (levelSpells && Array.isArray(levelSpells)) {
          console.log(`[PDF Export] Found ${levelSpells.length} level ${level} spells`);
          levelSpells.forEach((spell) => {
            allSpells.push({name: spell, level: level});
          });
        }
      }
      
      console.log(`[PDF Export] Total spells to fill: ${allSpells.length}`);
      
      // Group spells by level
      const spellsByLevel = {};
      allSpells.forEach((spell) => {
        if (!spellsByLevel[spell.level]) {
          spellsByLevel[spell.level] = [];
        }
        spellsByLevel[spell.level].push(spell);
      });
      
      console.log(`[PDF Export] Spells grouped by level:`, Object.keys(spellsByLevel).map(l => `Level ${l}: ${spellsByLevel[l].length}`).join(", "));
      
      // Fill spells into the correct sections by level.
      // FINAL CORRECTED mapping based on detailed image analysis:
      // From the latest image:
      // CANTRIPS section shows: "Burning Hands" (1014), "Chromatic Orb" (1016), "Fire Bolt" (1020), "Acid Splash" (1021), "Blade Ward" (1022)
      // Level 1 section shows: "Charm Person" (1015), "Chill Touch" (1023), "Friends" (1024)
      // Level 2 section shows: "Alter Self" (1030), "Blindness/Deafness" (1031), "Blink" (1032), "Clairvoyance" (1033)
      // Level 3 section: empty (should have "Blink" and "Clairvoyance")
      //
      // Pattern discovered:
      // - CANTRIPS uses: 1014, 1016, 1020, 1021, 1022 (NOT sequential!)
      // - Level 1 uses: 1015, 1023, 1024 (NOT sequential!)
      // - Level 2 uses: 1030, 1031 (correct)
      // - Level 3 uses: 1032, 1033 (but they appear in Level 2 section visually)
      //
      // The PDF fields are NOT in simple sequential order. They appear to be interleaved.
      // Let's map based on where spells actually appear:
      // - CANTRIPS: 1014, 1016, 1020, 1021, 1022, ... (skip 1015, 1017-1019)
      // - Level 1: 1015, 1023, 1024, ... (skip 1014, 1016, 1020-1022)
      // - Level 2: 1030, 1031, ... (correct)
      // - Level 3: 1032, 1033, ... (but visually in Level 2 section - might need 1040+)
      //
      // Actually, let me try a different approach: Maybe the fields are grouped differently
      // Based on observation, let's try:
      // - CANTRIPS: 1014, 1016, 1020, 1021, 1022 (specific fields)
      // - Level 1: 1015, 1023, 1024 (specific fields)
      // - Level 2: 1030, 1031
      // - Level 3: 1040, 1041 (maybe they're in a different section)
      //
      // Simplest fix: Use the fields that actually work based on the pattern
      const spellFieldMapping = {
        0: { label: "CANTRIPS", start: 1014, slots: 10, skipFields: [1015, 1017, 1018, 1019, 1023, 1024] }, // Use 1014, 1016, 1020, 1021, 1022
        1: { label: "Level 1", start: 1015, slots: 10, skipFields: [1014, 1016, 1020, 1021, 1022] }, // Use 1015, 1023, 1024
        2: { label: "Level 2", start: 1030, slots: 10 },
        3: { label: "Level 3", start: 1040, slots: 10 }, // Try 1040 instead of 1032
        4: { label: "Level 4", start: 1050, slots: 10 },
        5: { label: "Level 5", start: 1060, slots: 10 },
        6: { label: "Level 6", start: 1070, slots: 10 },
        7: { label: "Level 7", start: 1080, slots: 10 },
        8: { label: "Level 8", start: 1090, slots: 10 },
        9: { label: "Level 9", start: 10100, slots: 10 },
      };
      
      // Define specific field sequences for each level based on test PDF analysis
      // EXACT mapping from test_spell_fields.pdf visual inspection:
      const spellFieldSequences = {
        0: [1014, 1016, 1017, 1018, 1019, 1020, 1021, 1022], // CANTRIPS: 8 fields (skip 1015)
        1: [1015, 1023, 1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031, 1032, 1033], // Level 1: 12 fields
        2: [1046, 1034, 1035, 1036, 1037, 1038, 1039, 1040, 1041, 1042, 1043, 1044, 1045], // Level 2: 13 fields (starts with 1046!)
        3: [1048, 1047, 1049, 1050, 1051, 1052, 1053, 1054, 1055, 1056, 1057, 1058, 1059], // Level 3: 13 fields (starts with 1048, then 1047!)
        4: [1061, 1060, 1062, 1063, 1064, 1065, 1066, 1067, 1068, 1069, 1070, 1071, 1072], // Level 4: 13 fields (starts with 1061, then 1060!)
        5: [1074, 1073, 1075, 1076, 1077, 1078, 1079, 1080, 1081], // Level 5: 9 fields (starts with 1074, then 1073!)
        6: [1083, 1082, 1084, 1085, 1086, 1087, 1088, 1089, 1090], // Level 6: 9 fields (starts with 1083, then 1082!)
        7: [1092, 1091, 1093, 1094, 1095, 1096, 1097, 1098, 1099], // Level 7: 9 fields (starts with 1092, then 1091!)
        8: [10101, 10100, 10102, 10103, 10104, 10105, 10106], // Level 8: 7 fields (starts with 10101, then 10100!)
        9: [10108, 10107, 10109], // Level 9: 3 fields (starts with 10108, then 10107!)
      };
      
      let spellsSet = 0;
      const fillSpellsForLevel = (levelNumber) => {
        const levelSpells = spellsByLevel[levelNumber];
        if (!levelSpells || levelSpells.length === 0) {
          return;
        }
        
        const mapping = spellFieldMapping[levelNumber];
        if (!mapping) {
          console.log(`[PDF Export] No PDF field mapping for level ${levelNumber}, skipping`);
          return;
        }
        
        const { label } = mapping;
        const fieldSequence = spellFieldSequences[levelNumber] || [];
        
        if (fieldSequence.length === 0) {
          console.log(`[PDF Export] No field sequence defined for level ${levelNumber}, using default`);
          // Fallback to old method
          const { start, slots } = mapping;
          const maxSpells = slots || levelSpells.length;
          levelSpells.slice(0, maxSpells).forEach((spell, index) => {
            const spellFieldNum = start + index;
            const spellText = spell.name;
            console.log(`[PDF Export] Setting ${label} spell "${spell.name}" to field "Spells ${spellFieldNum}"`);
            const success = setField(form, `Spells ${spellFieldNum}`, spellText);
            if (success) {
              spellsSet++;
            } else {
              console.log(`[PDF Export] Failed to set ${label} spell "${spell.name}" to field "Spells ${spellFieldNum}"`);
            }
          });
        } else {
          // Use specific field sequence
          levelSpells.slice(0, fieldSequence.length).forEach((spell, index) => {
            const spellFieldNum = fieldSequence[index];
            const spellText = spell.name;
            console.log(`[PDF Export] Setting ${label} spell "${spell.name}" to field "Spells ${spellFieldNum}"`);
            const success = setField(form, `Spells ${spellFieldNum}`, spellText);
            if (success) {
              spellsSet++;
            } else {
              console.log(`[PDF Export] Failed to set ${label} spell "${spell.name}" to field "Spells ${spellFieldNum}"`);
            }
          });
          
          if (levelSpells.length > fieldSequence.length) {
            console.log(`[PDF Export] WARNING: ${label} has ${levelSpells.length} spells but only ${fieldSequence.length} slots in the PDF.`);
          }
        }
      };
      
      for (let level = 0; level <= 9; level++) {
        fillSpellsForLevel(level);
      }
      
      console.log(`[PDF Export] Successfully set ${spellsSet} spells into PDF`);
  } else {
    console.log(`[PDF Export] No spells data found`);
  }
  
  // ========== FEATURES & TRAITS ==========
  const features = await loadFeatures(character);
  
  // Add subclass features from calculatedStats if available (ONLY NAMES, NO DESCRIPTIONS)
  if (stats.subclassFeatures && Array.isArray(stats.subclassFeatures)) {
    stats.subclassFeatures.forEach((feature) => {
      if (feature && feature.name) {
        // Only add the feature name, no descriptions
        let featureText = feature.name;
        if (feature.level) {
          featureText = `Level ${feature.level}: ${featureText}`;
        }
        // DO NOT add entries/descriptions - just the name
        if (!features.includes(featureText)) {
          features.push(featureText);
        }
      }
    });
    console.log(`[PDF Export] Added ${stats.subclassFeatures.length} subclass features from calculatedStats (names only)`);
  }
  
  // Add resistances to features
  if (stats.resistances && Array.isArray(stats.resistances) && stats.resistances.length > 0) {
    const resistancesText = stats.resistances
      .map(r => r.charAt(0).toUpperCase() + r.slice(1) + " Resistance")
      .join(", ");
    features.push(`Damage Resistances: ${resistancesText}`);
    console.log(`[PDF Export] Added resistances: ${resistancesText}`);
  }
  
  if (features.length > 0) {
    // Join features with double newline for better readability in PDF
    const featuresText = features.join("\n\n");
    console.log(`[PDF Export] Features text (${features.length} features):`, featuresText.substring(0, 200) + "...");
    console.log(`[PDF Export] Full features text length: ${featuresText.length} chars`);
    setField(form, "FeaturesandTraits", featuresText);
    setField(form, "Features and Traits", featuresText);
    setField(form, "Feat+Traits", featuresText);
    // Try alternative field names
    setField(form, "FeaturesandTraits ", featuresText); // With trailing space
    setField(form, "Features & Traits", featuresText);
  } else {
    console.log(`[PDF Export] WARNING: No features found!`);
  }
  
  // ========== PERSONALITY ==========
  setField(form, "Ideals", character.ideals || "");
  setField(form, "Bonds", character.bonds || "");
  setField(form, "Flaws", character.flaws || "");
  setField(form, "PersonalityTraits", character.personalityTraits || ""); // PDF field is "PersonalityTraits " (with trailing space) - handled by setField
  setField(form, "Backstory", character.backstory || "");
  setField(form, "Allies", character.allies || "");
  setField(form, "Treasure", character.treasure || "");
  
  // ========== PROFICIENCIES & LANGUAGES ==========
  console.log("[PDF Export] ========== Loading Proficiencies & Languages ==========");
  const proficiencies = [];
  const languages = [];
  
  try {
    // Load from calculatedStats first (most accurate)
    if (stats.toolProficiencies && Array.isArray(stats.toolProficiencies)) {
      stats.toolProficiencies.forEach((tool) => {
        const formatted = formatSpecialTags(tool);
        if (formatted && !proficiencies.includes(formatted)) {
          proficiencies.push(formatted);
        }
      });
      console.log(`[PDF Export] Loaded ${stats.toolProficiencies.length} tool proficiencies from calculatedStats`);
    }
    
    if (stats.languages && Array.isArray(stats.languages)) {
      stats.languages.forEach((lang) => {
        const formatted = formatSpecialTags(lang);
        if (formatted && !languages.includes(formatted)) {
          languages.push(formatted);
        }
      });
      console.log(`[PDF Export] Loaded ${stats.languages.length} languages from calculatedStats`);
    }
    
    // Load from character.proficiencies (already stored - includes armor, weapons, tools, skills)
    if (character.proficiencies && Array.isArray(character.proficiencies)) {
      character.proficiencies.forEach((prof) => {
        if (prof && typeof prof === "string" && prof.trim()) {
          const trimmed = formatSpecialTags(prof.trim());
          // Skip skills (they're handled separately in skills section)
          const skillNames = ["acrobatics", "athletics", "deception", "history", "insight", 
                             "intimidation", "investigation", "medicine", "nature", "perception",
                             "performance", "persuasion", "religion", "sleight of hand", "stealth", "survival",
                             "animal handling", "arcana", "saving throws"];
          const isSkill = skillNames.some(skill => trimmed.toLowerCase().includes(skill.toLowerCase()));
          if (!isSkill && trimmed && !proficiencies.includes(trimmed)) {
            proficiencies.push(trimmed);
          }
        }
      });
      console.log(`[PDF Export] Loaded ${proficiencies.length} proficiencies from character.proficiencies:`, proficiencies);
    }
    
    // Load class proficiencies (armor, weapons, tools)
    if (character.className) {
      const className = character.className.toLowerCase();
      console.log(`[PDF Export] Loading class proficiencies for: ${className}`);
      try {
        const classResponse = await httpRequest(`http://localhost:4000/api/data/classes/${className}`);
        console.log(`[PDF Export] Class proficiencies response status: ${classResponse.status}`);
        if (classResponse.ok) {
          const classData = await classResponse.json();
          
          // Handle both formats: {class: [...]} or direct object
          let classInfo = null;
          if (classData.class && Array.isArray(classData.class) && classData.class[0]) {
            classInfo = classData.class[0];
          } else if (classData.startingProficiencies || classData.name) {
            // Direct object format
            classInfo = classData;
          }
          
          if (classInfo) {
            console.log(`[PDF Export] Class info has startingProficiencies:`, !!classInfo.startingProficiencies);
            if (classInfo.startingProficiencies) {
              console.log(`[PDF Export] startingProficiencies keys:`, Object.keys(classInfo.startingProficiencies));
            // Armor proficiencies
            if (classInfo.startingProficiencies.armor) {
              classInfo.startingProficiencies.armor.forEach((armor) => {
                if (typeof armor === "string") {
                  // Format special tags and clean up
                  let armorName = formatSpecialTags(armor).trim();
                  // Capitalize first letter
                  if (armorName) {
                    armorName = armorName.charAt(0).toUpperCase() + armorName.slice(1);
                    if (!proficiencies.includes(armorName)) {
                      proficiencies.push(armorName);
                    }
                  }
                } else if (armor && typeof armor === "object" && armor.proficiency) {
                  const profName = formatSpecialTags(armor.proficiency).trim();
                  if (profName) {
                    const formatted = profName.charAt(0).toUpperCase() + profName.slice(1);
                    if (!proficiencies.includes(formatted)) {
                      proficiencies.push(formatted);
                    }
                  }
                }
              });
            }
            // Weapon proficiencies
            if (classInfo.startingProficiencies.weapons) {
              console.log(`[PDF Export] Found ${classInfo.startingProficiencies.weapons.length} weapon proficiencies`);
              classInfo.startingProficiencies.weapons.forEach((weapon) => {
                if (typeof weapon === "string") {
                  // Format special tags and clean up
                  let weaponName = formatSpecialTags(weapon).trim();
                  // Handle special cases like "simple", "martial"
                  if (weaponName === "simple") {
                    weaponName = "Simple weapons";
                  } else if (weaponName === "martial") {
                    weaponName = "Martial weapons";
                  } else {
                    // Capitalize first letter
                    weaponName = weaponName.charAt(0).toUpperCase() + weaponName.slice(1);
                  }
                  if (weaponName && !proficiencies.includes(weaponName)) {
                    proficiencies.push(weaponName);
                    console.log(`[PDF Export] Added weapon proficiency: ${weaponName}`);
                  }
                }
              });
            }
            // Tool proficiencies
            if (classInfo.startingProficiencies.tools) {
              classInfo.startingProficiencies.tools.forEach((tool) => {
                if (typeof tool === "string") {
                  // Format special tags and clean up
                  let toolName = formatSpecialTags(tool).trim();
                  // Remove "any one type of" or similar prefixes
                  toolName = toolName.replace(/^any\s+(one\s+)?(type\s+of\s+)?/i, "").trim();
                  if (toolName) {
                    // Capitalize first letter
                    toolName = toolName.charAt(0).toUpperCase() + toolName.slice(1);
                    if (!proficiencies.includes(toolName)) {
                      proficiencies.push(toolName);
                    }
                  }
                }
              });
            }
            // Tool proficiencies from toolProficiencies array
            if (classInfo.startingProficiencies.toolProficiencies) {
              classInfo.startingProficiencies.toolProficiencies.forEach((toolProf) => {
                if (toolProf && typeof toolProf === "object") {
                  Object.keys(toolProf).forEach((toolName) => {
                    if (toolName) {
                      // Capitalize and format
                      const formattedName = toolName.charAt(0).toUpperCase() + toolName.slice(1);
                      if (!proficiencies.includes(formattedName)) {
                        proficiencies.push(formattedName);
                      }
                    }
                  });
                }
              });
            }
            console.log(`[PDF Export] Loaded class proficiencies:`, proficiencies);
            console.log(`[PDF Export] Total proficiencies after class: ${proficiencies.length}`);
            }
          } else {
            console.log(`[PDF Export] No class data found or class array is empty`);
          }
        } else {
          console.log(`[PDF Export] Class response not OK, status: ${classResponse.status}`);
        }
      } catch (e) {
        console.error(`[PDF Export] Error fetching class proficiencies:`, e);
      }
    }
    
    // Load race languages and tool proficiencies
    if (character.race) {
      const raceName = character.race.toLowerCase();
      console.log(`[PDF Export] Loading race proficiencies for: ${raceName}`);
      try {
        const raceResponse = await httpRequest(`http://localhost:4000/api/data/races/${raceName}`);
        console.log(`[PDF Export] Race proficiencies response status: ${raceResponse.status}`);
        if (raceResponse.ok) {
          const raceData = await raceResponse.json();
          if (raceData.race && raceData.race[0]) {
            const raceInfo = raceData.race[0];
            // Fixed languages from race
          if (raceInfo.languageProficiencies) {
            raceInfo.languageProficiencies.forEach((lang) => {
              if (typeof lang === "string") {
                const langName = formatSpecialTags(lang).trim();
                if (langName && !langName.toLowerCase().includes("any") && !languages.includes(langName)) {
                  languages.push(langName);
                }
              } else if (lang && typeof lang === "object" && lang.standard) {
                lang.standard.forEach((stdLang) => {
                  const formatted = formatSpecialTags(stdLang).trim();
                  if (formatted && !languages.includes(formatted)) {
                    languages.push(formatted);
                  }
                });
              }
            });
          }
          // Tool proficiencies from race
          if (raceInfo.toolProficiencies) {
            raceInfo.toolProficiencies.forEach((toolProf) => {
              if (typeof toolProf === "string") {
                const formatted = formatSpecialTags(toolProf).trim();
                if (formatted && !proficiencies.includes(formatted)) {
                  proficiencies.push(formatted);
                }
              } else if (toolProf && typeof toolProf === "object") {
                Object.keys(toolProf).forEach((toolName) => {
                  const formatted = formatSpecialTags(toolName).trim();
                  if (formatted && !proficiencies.includes(formatted)) {
                    proficiencies.push(formatted);
                  }
                });
              }
            });
          }
          }
        }
      } catch (e) {
        console.error(`[PDF Export] Error fetching race proficiencies:`, e);
      }
    }
    
    // Load subrace languages and tool proficiencies
    if (character.subrace) {
      try {
        console.log(`[PDF Export] Loading subrace proficiencies for: ${character.subrace}`);
        const subraceResponse = await httpRequest(`http://localhost:4000/api/data/subraces/${character.subrace}`);
        console.log(`[PDF Export] Subrace proficiencies response status: ${subraceResponse.status}`);
        if (subraceResponse.ok) {
          const subraceData = await subraceResponse.json();
          // Fixed languages from subrace
          if (subraceData.languageProficiencies) {
            subraceData.languageProficiencies.forEach((lang) => {
              if (typeof lang === "string") {
                const langName = formatSpecialTags(lang).trim();
                if (langName && !langName.toLowerCase().includes("any") && !languages.includes(langName)) {
                  languages.push(langName);
                }
              } else if (lang && typeof lang === "object" && lang.standard) {
                lang.standard.forEach((stdLang) => {
                  const formatted = formatSpecialTags(stdLang).trim();
                  if (formatted && !languages.includes(formatted)) {
                    languages.push(formatted);
                  }
                });
              }
            });
          }
          // Tool proficiencies from subrace
          if (subraceData.toolProficiencies) {
            subraceData.toolProficiencies.forEach((toolProf) => {
              if (typeof toolProf === "string") {
                const formatted = formatSpecialTags(toolProf).trim();
                if (formatted && !proficiencies.includes(formatted)) {
                  proficiencies.push(formatted);
                }
              } else if (toolProf && typeof toolProf === "object") {
                Object.keys(toolProf).forEach((toolName) => {
                  const formatted = formatSpecialTags(toolName).trim();
                  if (formatted && !proficiencies.includes(formatted)) {
                    proficiencies.push(formatted);
                  }
                });
              }
            });
          }
        }
      } catch (e) {
        console.error("[PDF Export] Error loading subrace proficiencies:", e);
      }
    }
    
    // Load background languages and tool proficiencies
    if (character.background) {
      const backgroundName = character.background.toLowerCase();
      console.log(`[PDF Export] Loading background proficiencies for: ${backgroundName}`);
      try {
        const backgroundResponse = await httpRequest(`http://localhost:4000/api/data/backgrounds/${backgroundName}`);
        console.log(`[PDF Export] Background proficiencies response status: ${backgroundResponse.status}`);
        if (backgroundResponse.ok) {
          const backgroundData = await backgroundResponse.json();
          
          // Handle both formats: {background: [...]} or direct object
          let bgInfo = null;
          if (backgroundData.background && Array.isArray(backgroundData.background) && backgroundData.background[0]) {
            bgInfo = backgroundData.background[0];
          } else if (backgroundData.entries || backgroundData.name) {
            // Direct object format
            bgInfo = backgroundData;
          }
          
          if (bgInfo) {
            // Fixed languages from background
            if (bgInfo.languageProficiencies) {
            bgInfo.languageProficiencies.forEach((lang) => {
              if (typeof lang === "string") {
                const langName = formatSpecialTags(lang).trim();
                if (langName && !langName.toLowerCase().includes("any") && !languages.includes(langName)) {
                  languages.push(langName);
                }
              } else if (lang && typeof lang === "object" && lang.standard) {
                lang.standard.forEach((stdLang) => {
                  const formatted = formatSpecialTags(stdLang).trim();
                  if (formatted && !languages.includes(formatted)) {
                    languages.push(formatted);
                  }
                });
              }
            });
          }
          // Tool proficiencies from background
          if (bgInfo.toolProficiencies) {
            bgInfo.toolProficiencies.forEach((toolProf) => {
              if (typeof toolProf === "string") {
                const formatted = formatSpecialTags(toolProf).trim();
                if (formatted && !proficiencies.includes(formatted)) {
                  proficiencies.push(formatted);
                }
              } else if (toolProf && typeof toolProf === "object") {
                Object.keys(toolProf).forEach((toolName) => {
                  const formatted = formatSpecialTags(toolName).trim();
                  if (formatted && !proficiencies.includes(formatted)) {
                    proficiencies.push(formatted);
                  }
                });
              }
            });
          }
          } else {
            console.log(`[PDF Export] No background info found for proficiencies`);
          }
        } else {
          console.log(`[PDF Export] Background response not OK for proficiencies`);
        }
      } catch (e) {
        console.error(`[PDF Export] Error fetching background proficiencies:`, e);
      }
    }
    
    // Add chosen languages from character
    if (character.raceLanguageChoices) {
      character.raceLanguageChoices.forEach((lang) => {
        if (lang && !languages.includes(lang)) {
          languages.push(lang);
        }
      });
    }
    if (character.backgroundLanguageChoices) {
      character.backgroundLanguageChoices.forEach((lang) => {
        if (lang && !languages.includes(lang)) {
          languages.push(lang);
        }
      });
    }
    
    // Add chosen tool proficiencies from character
    if (character.raceToolChoice && !proficiencies.includes(character.raceToolChoice)) {
      proficiencies.push(character.raceToolChoice);
    }
    if (character.backgroundToolChoices && Array.isArray(character.backgroundToolChoices)) {
      character.backgroundToolChoices.forEach((tool) => {
        if (tool && !proficiencies.includes(tool)) {
          proficiencies.push(tool);
        }
      });
    }
    
  } catch (error) {
    console.error("[PDF Export] Error loading proficiencies and languages:", error);
  }
  
  // Helper function to check if item already exists (case-insensitive)
  const itemExists = (array, item) => {
    const itemLower = item.toLowerCase().trim();
    return array.some(existing => existing.toLowerCase().trim() === itemLower);
  };
  
  // Helper function to add item if not exists (case-insensitive)
  const addIfNotExists = (array, item) => {
    if (!itemExists(array, item)) {
      array.push(item.trim());
    }
  };
  
  // Categorize and format proficiencies
  const categorized = {
    languages: [],
    weapons: [],
    tools: [],
    armor: [],
    savingThrows: [],
    other: []
  };
  
  // Add languages (deduplicate case-insensitive)
  languages.forEach(lang => {
    const formatted = formatSpecialTags(lang).trim();
    if (formatted) {
      addIfNotExists(categorized.languages, formatted);
    }
  });
  
  // Categorize proficiencies
  proficiencies.forEach((prof) => {
    const formatted = formatSpecialTags(prof).trim();
    if (!formatted) return;
    
    const lower = formatted.toLowerCase();
    
    // Check for languages (should already be in languages array, but double-check)
    if (itemExists(categorized.languages, formatted)) {
      return; // Skip, already in languages
    }
    
    // Check for weapons
    if (lower.includes("weapon") || lower.includes("sword") || lower.includes("dagger") || 
        lower.includes("axe") || lower.includes("bow") || lower.includes("crossbow") ||
        lower.includes("mace") || lower.includes("spear") || lower.includes("staff") ||
        lower.includes("simple") || lower.includes("martial") ||
        lower === "dart" || lower === "sling" || lower === "club" || lower === "handaxe" ||
        lower === "javelin" || lower === "light hammer" || lower === "quarterstaff" ||
        lower === "sickle" || lower === "unarmed strike" || lower === "light crossbow" ||
        lower === "shortbow" || lower === "blowgun" || lower === "hand crossbow" ||
        lower === "heavy crossbow" || lower === "longbow" || lower === "net" ||
        lower === "battleaxe" || lower === "flail" || lower === "glaive" ||
        lower === "greataxe" || lower === "greatsword" || lower === "halberd" ||
        lower === "lance" || lower === "longsword" || lower === "maul" ||
        lower === "morningstar" || lower === "pike" || lower === "rapier" ||
        lower === "scimitar" || lower === "shortsword" || lower === "trident" ||
        lower === "war pick" || lower === "warhammer" || lower === "whip" ||
        lower === "greatclub") {
      // Extract weapon name (remove "weapon" suffix if present)
      let weaponName = formatted;
      if (lower.endsWith(" weapons")) {
        weaponName = formatted.replace(/\s+weapons?$/i, "");
      }
      // Capitalize first letter for consistency
      weaponName = weaponName.charAt(0).toUpperCase() + weaponName.slice(1);
      addIfNotExists(categorized.weapons, weaponName);
    }
    // Check for armor
    else if (lower.includes("armor") || lower.includes("shield") || 
             lower === "light" || lower === "medium" || lower === "heavy") {
      let armorName = formatted;
      if (lower.endsWith(" armor")) {
        armorName = formatted.replace(/\s+armor$/i, "");
      }
      // Capitalize first letter for consistency
      armorName = armorName.charAt(0).toUpperCase() + armorName.slice(1);
      addIfNotExists(categorized.armor, armorName);
    }
    // Check for saving throws
    else if (lower.includes("saving throw")) {
      const abilityName = formatted.replace(/\s+saving\s+throws?$/i, "");
      const capitalized = abilityName.charAt(0).toUpperCase() + abilityName.slice(1);
      addIfNotExists(categorized.savingThrows, capitalized);
    }
    // Check for tools (musical instruments, artisan's tools, gaming sets, etc.)
    else if (lower.includes("tool") || lower.includes("instrument") || 
             lower.includes("kit") || lower.includes("set") ||
             lower.includes("disguise") || lower.includes("forgery") ||
             lower.includes("herbalism") || lower.includes("navigator") ||
             lower.includes("poisoner") || lower.includes("thieves") ||
             lower.includes("vehicles")) {
      const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);
      addIfNotExists(categorized.tools, capitalized);
    }
    // Other proficiencies
    else {
      const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);
      addIfNotExists(categorized.other, capitalized);
    }
  });
  
  // Build formatted text with categories
  const formattedSections = [];
  
  if (categorized.languages.length > 0) {
    categorized.languages.forEach(lang => {
      formattedSections.push(`Language: ${lang}`);
    });
  }
  
  if (categorized.weapons.length > 0) {
    categorized.weapons.forEach(weapon => {
      formattedSections.push(`Weapon: ${weapon}`);
    });
  }
  
  if (categorized.armor.length > 0) {
    categorized.armor.forEach(armor => {
      formattedSections.push(`Armor: ${armor}`);
    });
  }
  
  if (categorized.tools.length > 0) {
    categorized.tools.forEach(tool => {
      formattedSections.push(`Tool: ${tool}`);
    });
  }
  
  if (categorized.savingThrows.length > 0) {
    categorized.savingThrows.forEach(st => {
      formattedSections.push(`Saving Throw: ${st}`);
    });
  }
  
  if (categorized.other.length > 0) {
    categorized.other.forEach(other => {
      formattedSections.push(`Other: ${other}`);
    });
  }
  
  if (formattedSections.length > 0) {
    const profsText = formattedSections.join("\n");
    console.log(`[PDF Export] Final Proficiencies & Languages (${formattedSections.length} items):`);
    console.log(`[PDF Export] Formatted text:\n${profsText}`);
    setField(form, "ProficienciesLang", profsText);
    // Try alternative field names
    setField(form, "ProficienciesLang ", profsText); // With trailing space
    setField(form, "Proficiencies & Languages", profsText);
  } else {
    console.log(`[PDF Export] WARNING: No proficiencies or languages found!`);
  }
  
  // ========== CURRENCY ==========
  if (character.currency) {
    setField(form, "CP", character.currency.cp || "");
    setField(form, "SP", character.currency.sp || "");
    setField(form, "EP", character.currency.ep || "");
    setField(form, "GP", character.currency.gp || "");
    setField(form, "PP", character.currency.pp || "");
  }
  
  // ========== INSPIRATION ==========
  setField(form, "Inspiration", "");
  
  // Don't flatten form - keep PDF editable so users can modify values
  // form.flatten();
  
  // Generate PDF bytes
  const filledPdfBytes = await pdfDoc.save();
  
  return Buffer.from(filledPdfBytes);
}

module.exports = { exportCharacterToPDF };

