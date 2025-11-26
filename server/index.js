const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// File paths for persistence
const dataDir = path.join(__dirname, "..", "data");
const charactersFilePath = path.join(dataDir, "characters.json");
const sampleCharacterPath = path.join(dataDir, "sample-character.json");

// In-memory storage (kept in sync with disk)
const characters = [];

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const loadCharactersFromFile = () => {
  try {
    ensureDataDir();
    if (!fs.existsSync(charactersFilePath)) {
      console.log("[Characters] Không tìm thấy characters.json, bắt đầu với danh sách rỗng");
      return;
    }
    const raw = fs.readFileSync(charactersFilePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      characters.splice(0, characters.length, ...parsed);
      console.log(`[Characters] Đã load ${characters.length} nhân vật từ file`);
    } else {
      console.warn("[Characters] File characters.json không đúng định dạng array");
    }
  } catch (error) {
    console.error("[Characters] Lỗi load characters.json:", error);
  }
};

const saveCharactersToFile = () => {
  try {
    ensureDataDir();
    fs.writeFileSync(charactersFilePath, JSON.stringify(characters, null, 2), "utf8");
    console.log(`[Characters] Đã lưu ${characters.length} nhân vật vào file`);
  } catch (error) {
    console.error("[Characters] Lỗi lưu characters.json:", error);
  }
};

const loadSampleCharacter = () => {
  try {
    if (!fs.existsSync(sampleCharacterPath)) {
      console.warn("[Characters] sample-character.json không tồn tại");
      return null;
    }
    const raw = fs.readFileSync(sampleCharacterPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("[Characters] Lỗi đọc sample-character.json:", error);
    return null;
  }
};

// Load persisted characters on startup
loadCharactersFromFile();

// Data cache - store all loaded JSON files in memory
const dataCache = {};

// Data indexes - Map structures for fast O(1) lookups
const dataIndexes = {};

// Helper to load JSON data with caching
const loadData = (filePath) => {
  // Return cached data if available
  if (dataCache[filePath]) {
    return dataCache[filePath];
  }
  
  // Load and cache
  try {
    const fullPath = path.join(__dirname, "..", "data", filePath);
    const data = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(data);
    dataCache[filePath] = parsed; // Cache it
    return parsed;
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return null;
  }
};

// Preload and cache all frequently used data files
const preloadData = () => {
  console.log("Preloading data files...");
  
  const filesToCache = [
    "races.json",
    "spells/spells-phb.json",
    "items.json",
    "items-base.json", // Add items-base.json for better item lookup
    "feats.json",
    "backgrounds.json",
    "skills.json",
    "conditionsdiseases.json",
    "bestiary/bestiary-phb.json",
    "variantrules.json",
    "actions.json", // Add actions.json for combat actions
    "book/book-phb.json", // Add book-phb.json for spell lists
    "optionalfeatures.json", // Add optionalfeatures.json for optional feature lookups
    "senses.json", // Add senses.json for sense lookups (Darkvision, etc.)
  ];
  
  const classFiles = [
    "class-barbarian.json",
    "class-bard.json",
    "class-cleric.json",
    "class-druid.json",
    "class-fighter.json",
    "class-monk.json",
    "class-paladin.json",
    "class-ranger.json",
    "class-rogue.json",
    "class-sorcerer.json",
    "class-warlock.json",
    "class-wizard.json",
  ];
  
  filesToCache.forEach(file => {
    loadData(file);
  });
  
  classFiles.forEach(file => {
    loadData(`class/${file}`);
  });
  
  console.log("Data preloaded!");
};

// Build indexes for fast lookups
const buildIndexes = () => {
  console.log("Building indexes...");
  
  // Index spells
  if (dataCache["spells/spells-phb.json"]?.spell) {
    const spellIndex = new Map();
    dataCache["spells/spells-phb.json"].spell.forEach(spell => {
      if (spell.name) {
        spellIndex.set(spell.name.toLowerCase(), spell);
        if (spell.alias) {
          spell.alias.forEach(alias => {
            spellIndex.set(alias.toLowerCase(), spell);
          });
        }
      }
    });
    dataIndexes.spells = spellIndex;
  }
  
  // Index items from both items.json and items-base.json
  const itemIndex = new Map();
  
  // Index from items-base.json (more complete)
  const itemsBaseData = loadData("items-base.json");
  if (itemsBaseData?.baseitem) {
    itemsBaseData.baseitem.forEach(item => {
      if (item.name) {
        const key = item.name.toLowerCase();
        // Prefer items-base.json items (overwrite if exists)
        itemIndex.set(key, item);
      }
    });
  }
  
  // Index from items.json (magic items, etc.)
  if (dataCache["items.json"]?.item) {
    dataCache["items.json"].item.forEach(item => {
      if (item.name) {
        const key = item.name.toLowerCase();
        // Only add if not already in index (items-base.json takes precedence for common items)
        if (!itemIndex.has(key)) {
          itemIndex.set(key, item);
        }
      }
    });
  }
  
  dataIndexes.items = itemIndex;
  
  // Index conditions
  if (dataCache["conditionsdiseases.json"]?.condition) {
    const conditionIndex = new Map();
    dataCache["conditionsdiseases.json"].condition.forEach(cond => {
      if (cond.name) {
        conditionIndex.set(cond.name.toLowerCase(), cond);
      }
    });
    dataIndexes.conditions = conditionIndex;
  }
  
  // Index skills
  if (dataCache["skills.json"]?.skill) {
    const skillIndex = new Map();
    dataCache["skills.json"].skill.forEach(skill => {
      if (skill.name) {
        skillIndex.set(skill.name.toLowerCase(), skill);
      }
    });
    dataIndexes.skills = skillIndex;
  }
  
  // Index backgrounds
  if (dataCache["backgrounds.json"]?.background) {
    const backgroundIndex = new Map();
    dataCache["backgrounds.json"].background.forEach(bg => {
      if (bg.name) {
        backgroundIndex.set(bg.name.toLowerCase(), bg);
      }
    });
    dataIndexes.backgrounds = backgroundIndex;
  }
  
  // Index class features
  const classFiles = [
    "class-barbarian.json",
    "class-bard.json",
    "class-cleric.json",
    "class-druid.json",
    "class-fighter.json",
    "class-monk.json",
    "class-paladin.json",
    "class-ranger.json",
    "class-rogue.json",
    "class-sorcerer.json",
    "class-warlock.json",
    "class-wizard.json",
  ];
  
  const featureIndex = new Map();
  classFiles.forEach(file => {
    const classData = dataCache[`class/${file}`];
    if (classData?.classFeature) {
      classData.classFeature.forEach(feature => {
        if (feature.name) {
          featureIndex.set(feature.name.toLowerCase(), feature);
        }
      });
    }
    if (classData?.optionalfeature) {
      classData.optionalfeature.forEach(feature => {
        if (feature.name) {
          featureIndex.set(feature.name.toLowerCase(), feature);
        }
      });
    }
  });
  dataIndexes.features = featureIndex;
  
  // Index variant rules
  if (dataCache["variantrules.json"]?.variantrule) {
    const variantIndex = new Map();
    dataCache["variantrules.json"].variantrule.forEach(rule => {
      if (rule.name) {
        variantIndex.set(rule.name.toLowerCase(), rule);
      }
    });
    dataIndexes.variantrules = variantIndex;
  }
  
  // Index actions
  if (dataCache["actions.json"]?.action) {
    const actionIndex = new Map();
    dataCache["actions.json"].action.forEach(action => {
      if (action.name) {
        actionIndex.set(action.name.toLowerCase(), action);
      }
    });
    dataIndexes.actions = actionIndex;
  }
  
  // Build class spell lists from book-phb.json
  buildClassSpellLists();
  
  console.log("Indexes built!");
};

// Build class spell lists from book-phb.json
const buildClassSpellLists = () => {
  const bookData = loadData("book/book-phb.json");
  if (!bookData?.data) {
    console.log("Warning: book-phb.json not loaded, cannot build class spell lists");
    return;
  }
  
  // Find the "Spells" section
  const spellsSection = bookData.data.find(
    (section) => section.name === "Spells" && section.type === "section"
  );
  
  if (!spellsSection?.entries) {
    console.log("Warning: Spells section not found in book-phb.json");
    return;
  }
  
  const classSpellLists = {
    Bard: new Set(),
    Cleric: new Set(),
    Druid: new Set(),
    Paladin: new Set(),
    Ranger: new Set(),
    Sorcerer: new Set(),
    Warlock: new Set(),
    Wizard: new Set(),
  };
  
  // Find all class spell list entries
  spellsSection.entries.forEach((entry) => {
    if (entry.type === "entries" && entry.name && entry.name.endsWith(" Spells")) {
      const className = entry.name.replace(" Spells", "").trim();
      
      if (!classSpellLists[className]) {
        console.log(`Warning: Unknown class "${className}" in spell lists`);
        return;
      }
      
      // Extract spell names from all lists in this entry
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach((listEntry) => {
          if (listEntry.type === "list" && listEntry.items && Array.isArray(listEntry.items)) {
            listEntry.items.forEach((item) => {
              if (typeof item === "string") {
                // Extract spell name from {@spell SpellName} format
                const match = item.match(/\{@spell\s+([^}|]+)/);
                if (match) {
                  const spellName = match[1].trim();
                  classSpellLists[className].add(spellName);
                }
              }
            });
          }
        });
      }
    }
  });
  
  // Store in dataIndexes
  dataIndexes.classSpellLists = classSpellLists;
  
  // Log counts for debugging
  Object.keys(classSpellLists).forEach(className => {
    console.log(`${className} spell list: ${classSpellLists[className].size} spells`);
  });
  
  console.log("Class spell lists built!");
};

// Initialize on server start
preloadData();
buildIndexes();

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Get all characters
app.get("/api/characters", (_req, res) => {
  res.json(characters);
});

// Get character by ID
app.get("/api/characters/:id", (req, res) => {
  const character = characters.find((c) => c.id === req.params.id);
  if (!character) {
    return res.status(404).json({ error: "Nhân vật không tồn tại" });
  }
  res.json(character);
});

// Create character
app.post("/api/characters", (req, res) => {
  const payload = req.body || {};

  if (!payload.name || !payload.race || !payload.className) {
    return res.status(400).json({
      error: "Thiếu thông tin bắt buộc: name, race, className",
    });
  }

  const character = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...payload,
  };

  characters.push(character);
  saveCharactersToFile();
  res.status(201).json(character);
});

// Quick create from sample template (for fast testing)
app.post("/api/characters/sample", (req, res) => {
  const sample = loadSampleCharacter();
  if (!sample) {
    return res.status(500).json({ error: "Không tìm thấy sample-character.json" });
  }

  const clone = JSON.parse(JSON.stringify(sample));
  clone.id = uuidv4();
  clone.name = req.body?.name || `${sample.name || "Demo Hero"} ${Math.floor(Math.random() * 900 + 100)}`;
  clone.createdAt = new Date().toISOString();
  clone.updatedAt = undefined;

  characters.push(clone);
  saveCharactersToFile();

  res.status(201).json(clone);
});

// Update character
app.put("/api/characters/:id", (req, res) => {
  const index = characters.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Nhân vật không tồn tại" });
  }

  characters[index] = {
    ...characters[index],
    ...req.body,
    id: req.params.id,
    updatedAt: new Date().toISOString(),
  };

  saveCharactersToFile();
  res.json(characters[index]);
});

// Delete character
app.delete("/api/characters/:id", (req, res) => {
  const index = characters.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Nhân vật không tồn tại" });
  }

  characters.splice(index, 1);
  saveCharactersToFile();
  res.status(204).send();
});

// Import character from external file
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/characters/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Không có file được upload" });
    }

    const file = req.file;
    const isJson = file.mimetype === "application/json" || file.originalname.endsWith(".json");
    const isPdf = file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf");

    if (!isJson && !isPdf) {
      return res.status(400).json({ error: "Chỉ hỗ trợ file JSON hoặc PDF" });
    }

    let characterData;

    if (isJson) {
      // Parse JSON file
      try {
        const jsonContent = file.buffer.toString("utf8");
        characterData = JSON.parse(jsonContent);
      } catch (parseError) {
        return res.status(400).json({ error: "File JSON không hợp lệ: " + parseError.message });
      }
    } else {
      // PDF import - parse PDF form fields
      try {
        const { PDFDocument } = require("pdf-lib");
        const pdfDoc = await PDFDocument.load(file.buffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        
        // Extract all field values (case-insensitive lookup)
        const fieldValues = {};
        const fieldNamesMap = {}; // Map lowercase -> actual field name
        
        fields.forEach((field) => {
          const fieldName = field.getName();
          const fieldNameLower = fieldName.toLowerCase().trim();
          fieldNamesMap[fieldNameLower] = fieldName; // Store original case
          
          try {
            if (field.constructor.name === "PDFTextField") {
              const value = field.getText();
              if (value && value.trim()) {
                fieldValues[fieldName] = value;
                // Also store with lowercase key for easier lookup
                fieldValues[fieldNameLower] = value;
              }
            } else if (field.constructor.name === "PDFCheckBox") {
              fieldValues[fieldName] = field.isChecked();
              fieldValues[fieldNameLower] = field.isChecked();
            } else if (field.constructor.name === "PDFDropdown" || field.constructor.name === "PDFRadioGroup") {
              try {
                const selected = field.getSelected();
                fieldValues[fieldName] = selected;
                fieldValues[fieldNameLower] = selected;
              } catch (e) {
                // Dropdown might not have selection
              }
            }
          } catch (e) {
            // Skip fields that can't be read
            console.log(`[PDF Import] Skipping field ${fieldName}: ${e.message}`);
          }
        });
        
        console.log(`[PDF Import] Found ${Object.keys(fieldValues).length} field values in PDF`);
        console.log(`[PDF Import] Total fields: ${fields.length}`);
        console.log(`[PDF Import] Sample field names:`, Array.from(new Set(Object.keys(fieldNamesMap))).slice(0, 20));
        
        // Helper to get field value (try exact, then lowercase, then with trailing space)
        const getFieldValue = (name) => {
          return fieldValues[name] || 
                 fieldValues[name.toLowerCase()] || 
                 fieldValues[name + " "] ||
                 fieldValues[(name + " ").toLowerCase()] ||
                 "";
        };
        
        const charName = getFieldValue("CharacterName") || getFieldValue("CharacterName 2");
        const classLevel = getFieldValue("ClassLevel");
        const race = getFieldValue("Race");
        
        console.log(`[PDF Import] CharacterName:`, charName);
        console.log(`[PDF Import] ClassLevel:`, classLevel);
        console.log(`[PDF Import] Race:`, race);
        
        // Convert PDF field values to character data (pass both fieldValues and getFieldValue helper)
        characterData = convertPdfFieldsToCharacter(fieldValues, getFieldValue);
        
        console.log(`[PDF Import] Converted character data:`, {
          name: characterData.name,
          race: characterData.race,
          className: characterData.className,
          level: characterData.level
        });
      } catch (pdfError) {
        console.error("[PDF Import] Error parsing PDF:", pdfError);
        return res.status(400).json({ error: "Không thể đọc file PDF: " + pdfError.message });
      }
    }

    // Convert external character format to internal format
    // For PDF, characterData is already in our format, but we still need to normalize it
    const convertedCharacter = convertExternalCharacter(characterData);

    console.log(`[PDF Import] After convertExternalCharacter:`, {
      name: convertedCharacter.name,
      race: convertedCharacter.race,
      className: convertedCharacter.className,
      hasName: !!convertedCharacter.name,
      hasRace: !!convertedCharacter.race,
      hasClassName: !!convertedCharacter.className
    });

    // Validate required fields
    if (!convertedCharacter.name || !convertedCharacter.race || !convertedCharacter.className) {
      console.error("[PDF Import] Validation failed:", {
        name: convertedCharacter.name || "MISSING",
        race: convertedCharacter.race || "MISSING",
        className: convertedCharacter.className || "MISSING"
      });
      return res.status(400).json({
        error: `Thiếu thông tin bắt buộc. Tìm thấy: name="${convertedCharacter.name || ""}", race="${convertedCharacter.race || ""}", className="${convertedCharacter.className || ""}". Vui lòng kiểm tra file PDF có phải từ hệ thống này không.`,
      });
    }

    // Create character
    const character = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...convertedCharacter,
    };

    characters.push(character);
    saveCharactersToFile();

    res.status(201).json(character);
  } catch (error) {
    console.error("Error importing character:", error);
    res.status(500).json({ error: "Không thể import nhân vật: " + error.message });
  }
});

// Helper function to convert external character format to internal format
function convertExternalCharacter(externalData) {
  // If it's already in our format, return as-is (with some cleanup)
  if (externalData.id && externalData.createdAt) {
    // Remove id and timestamps to create new character
    const { id, createdAt, updatedAt, ...rest } = externalData;
    return rest;
  }

  // Try to map common external formats
  const character = {
    name: externalData.name || externalData.characterName || "Imported Character",
    race: externalData.race || externalData.raceName || "",
    subrace: externalData.subrace || externalData.subraceName,
    className: externalData.className || externalData.class || externalData.className || "",
    subclass: externalData.subclass || externalData.subclassName,
    background: externalData.background || externalData.backgroundName || "",
    alignment: externalData.alignment || "",
    level: externalData.level || externalData.characterLevel || 1,
    experiencePoints: externalData.experiencePoints || externalData.xp || 0,
    abilityScores: externalData.abilityScores || {
      str: externalData.strength || externalData.str || 10,
      dex: externalData.dexterity || externalData.dex || 10,
      con: externalData.constitution || externalData.con || 10,
      int: externalData.intelligence || externalData.int || 10,
      wis: externalData.wisdom || externalData.wis || 10,
      cha: externalData.charisma || externalData.cha || 10,
    },
    proficiencies: externalData.proficiencies || externalData.proficiency || [],
    equipment: externalData.equipment || externalData.equipmentList || [],
    spells: externalData.spells || {},
    ideals: externalData.ideals,
    bonds: externalData.bonds,
    flaws: externalData.flaws,
    notes: externalData.notes || externalData.description,
    // Preserve calculated stats if available
    calculatedStats: externalData.calculatedStats,
  };

  // Map spell levels if they use different keys
  if (character.spells && !character.spells.cantrips) {
    const spellMapping = {
      cantrips: ["cantrips", "cantrip", "0"],
      level1: ["level1", "level_1", "1"],
      level2: ["level2", "level_2", "2"],
      level3: ["level3", "level_3", "3"],
      level4: ["level4", "level_4", "4"],
      level5: ["level5", "level_5", "5"],
      level6: ["level6", "level_6", "6"],
      level7: ["level7", "level_7", "7"],
      level8: ["level8", "level_8", "8"],
      level9: ["level9", "level_9", "9"],
    };

    const mappedSpells = {};
    Object.entries(spellMapping).forEach(([targetKey, sourceKeys]) => {
      for (const sourceKey of sourceKeys) {
        if (character.spells[sourceKey]) {
          mappedSpells[targetKey] = character.spells[sourceKey];
          break;
        }
      }
    });
    if (Object.keys(mappedSpells).length > 0) {
      character.spells = mappedSpells;
    }
  }

  return character;
}

// Helper function to convert PDF form fields to character data
function convertPdfFieldsToCharacter(fieldValues, getFieldValue) {
  const character = {};
  
  // Helper function to get field value with multiple fallbacks
  const getValue = (name) => {
    if (getFieldValue) {
      return getFieldValue(name);
    }
    // Fallback if getFieldValue not provided
    return (fieldValues[name] || 
            fieldValues[name.toLowerCase()] || 
            fieldValues[name + " "] ||
            fieldValues[(name + " ").toLowerCase()] ||
            "").trim();
  };
  
  // Basic information
  character.name = getValue("CharacterName") || getValue("CharacterName 2");
  
  // Parse ClassLevel (format: "ClassName Level" or "ClassName  Level")
  const classLevel = getValue("ClassLevel");
  if (classLevel) {
    const parts = classLevel.split(/\s+/);
    if (parts.length >= 2) {
      character.className = parts.slice(0, -1).join(" ");
      character.level = parseInt(parts[parts.length - 1]) || 1;
    } else {
      character.className = classLevel;
      character.level = 1;
    }
  }
  
  // Parse Race (format: "Race" or "Race (Subrace)")
  const raceText = getValue("Race");
  if (raceText) {
    const match = raceText.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      character.race = match[1].trim();
      character.subrace = match[2].trim();
    } else {
      character.race = raceText;
    }
  }
  
  character.background = getValue("Background");
  character.alignment = getValue("Alignment");
  character.experiencePoints = parseInt(getValue("XP") || "0") || 0;
  
  // Physical description
  character.age = getValue("Age");
  character.height = getValue("Height");
  character.weight = getValue("Weight");
  character.hair = getValue("Hair");
  character.eyes = getValue("Eyes");
  character.skin = getValue("Skin");
  
  // Ability scores
  character.abilityScores = {
    str: parseInt(getValue("STR") || "10") || 10,
    dex: parseInt(getValue("DEX") || "10") || 10,
    con: parseInt(getValue("CON") || "10") || 10,
    int: parseInt(getValue("INT") || "10") || 10,
    wis: parseInt(getValue("WIS") || "10") || 10,
    cha: parseInt(getValue("CHA") || "10") || 10,
  };
  
  // Equipment
  const equipmentText = getValue("Equipment");
  if (equipmentText) {
    character.equipment = equipmentText.split("\n").filter(line => line.trim().length > 0);
  } else {
    character.equipment = [];
  }
  
  // Spells - collect from spell fields
  const spells = {
    cantrips: [],
    level1: [],
    level2: [],
    level3: [],
    level4: [],
    level5: [],
    level6: [],
    level7: [],
    level8: [],
    level9: [],
  };
  
  // Spell field sequences (from export mapping)
  const spellFieldSequences = {
    0: [1014, 1016, 1017, 1018, 1019, 1020, 1021, 1022], // CANTRIPS
    1: [1015, 1023, 1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031, 1032, 1033], // Level 1
    2: [1046, 1034, 1035, 1036, 1037, 1038, 1039, 1040, 1041, 1042, 1043, 1044, 1045], // Level 2
    3: [1048, 1047, 1049, 1050, 1051, 1052, 1053, 1054, 1055, 1056, 1057, 1058, 1059], // Level 3
    4: [1061, 1060, 1062, 1063, 1064, 1065, 1066, 1067, 1068, 1069, 1070, 1071, 1072], // Level 4
    5: [1074, 1073, 1075, 1076, 1077, 1078, 1079, 1080, 1081], // Level 5
    6: [1083, 1082, 1084, 1085, 1086, 1087, 1088, 1089, 1090], // Level 6
    7: [1092, 1091, 1093, 1094, 1095, 1096, 1097, 1098, 1099], // Level 7
    8: [10101, 10100, 10102, 10103, 10104, 10105, 10106], // Level 8
    9: [10108, 10107, 10109], // Level 9
  };
  
  Object.entries(spellFieldSequences).forEach(([levelStr, fieldNumbers]) => {
    const level = parseInt(levelStr);
    const levelKey = level === 0 ? "cantrips" : `level${level}`;
    
    fieldNumbers.forEach((fieldNum) => {
      const spellName = getValue(`Spells ${fieldNum}`);
      if (spellName && spellName.length > 0) {
        if (!spells[levelKey].includes(spellName)) {
          spells[levelKey].push(spellName);
        }
      }
    });
  });
  
  // Remove empty spell arrays
  Object.keys(spells).forEach(key => {
    if (spells[key].length === 0) {
      delete spells[key];
    }
  });
  
  if (Object.keys(spells).length > 0) {
    character.spells = spells;
  }
  
  // Features and Traits
  const featuresText = getValue("FeaturesandTraits") || getValue("Features and Traits") || getValue("Feat+Traits");
  if (featuresText) {
    // Store as notes for now (can be parsed later if needed)
    character.notes = featuresText;
  }
  
  // Proficiencies and Languages
  const profsText = getValue("ProficienciesLang") || getValue("Proficiencies & Languages");
  if (profsText) {
    // Parse proficiencies (format: "Language: Common\nWeapon: Longsword\n...")
    const proficiencies = [];
    const lines = profsText.split("\n");
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        // Remove category prefix (e.g., "Language: ", "Weapon: ")
        const match = trimmed.match(/^[^:]+:\s*(.+)$/);
        if (match) {
          proficiencies.push(match[1].trim());
        } else {
          proficiencies.push(trimmed);
        }
      }
    });
    if (proficiencies.length > 0) {
      character.proficiencies = proficiencies;
    }
  }
  
  // Personality
  character.ideals = getValue("Ideals");
  character.bonds = getValue("Bonds");
  character.flaws = getValue("Flaws");
  character.personalityTraits = getValue("PersonalityTraits");
  character.backstory = getValue("Backstory");
  
  return character;
}

// Export character sheet to PDF
const { exportCharacterToPDF } = require("./pdfExport");

app.post("/api/characters/:id/export-pdf", async (req, res) => {
  console.log("[PDF Export] Starting PDF export for character:", req.params.id);
  try {
    const character = characters.find((c) => c.id === req.params.id);
    if (!character) {
      console.log("[PDF Export] Character not found:", req.params.id);
      return res.status(404).json({ error: "Nhân vật không tồn tại" });
    }
    console.log("[PDF Export] Character found:", character.name);
    console.log("[PDF Export] Character has calculatedStats:", !!character.calculatedStats);
    console.log("[PDF Export] About to call exportCharacterToPDF...");

    // Export character to PDF using the new module
    const filledPdfBytes = await exportCharacterToPDF(character);
    
    console.log("[PDF Export] PDF export completed, size:", filledPdfBytes.length, "bytes");

    // Send PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${character.name || "character"}_sheet.pdf"`);
    res.send(filledPdfBytes);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Không thể tạo PDF. Vui lòng thử lại." });
  }
});

// Get PHB races
app.get("/api/data/races/phb", (_req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.race) {
    return res.status(500).json({ error: "Không thể load dữ liệu races" });
  }

  const phbRaces = racesData.race.filter((race) => race.source === "PHB");
  res.json(phbRaces);
});

// Get PHB subraces for a specific race
app.get("/api/data/races/:raceName/subraces", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const raceName = req.params.raceName;
  let phbSubraces = racesData.subrace.filter(
    (subrace) =>
      subrace.raceName === raceName &&
      subrace.raceSource === "PHB" &&
      subrace.source === "PHB"
  );
  
  // For Human, if there's a subrace without a name (Standard Human), add a name
  if (raceName === "Human") {
    phbSubraces = phbSubraces.map((subrace) => {
      if (!subrace.name || subrace.name.trim() === "") {
        return { ...subrace, name: "Standard Human" };
      }
      return subrace;
    });
  }
  
  res.json(phbSubraces);
});

// Get specific subrace by name
app.get("/api/data/subraces/:name", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const subraceName = req.params.name;
  let subrace = racesData.subrace.find(
    (s) => {
      const name = s.name || (s.raceName === "Human" ? "Standard Human" : "");
      return name.toLowerCase() === subraceName.toLowerCase() && s.source === "PHB";
    }
  );

  // Handle "Standard Human" case
  if (!subrace && subraceName.toLowerCase() === "standard human") {
    subrace = racesData.subrace.find(
      (s) => s.raceName === "Human" && (!s.name || s.name.trim() === "") && s.source === "PHB"
    );
    if (subrace) {
      subrace = { ...subrace, name: "Standard Human" };
    }
  }

  if (!subrace) {
    return res.status(404).json({ error: "Không tìm thấy subrace" });
  }

  res.json(subrace);
});

// Get PHB races
app.get("/api/data/races/phb", (_req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.race) {
    return res.status(500).json({ error: "Không thể load dữ liệu races" });
  }

  const phbRaces = racesData.race.filter((race) => race.source === "PHB");
  res.json(phbRaces);
});

// Get PHB subraces for a specific race
app.get("/api/data/races/:raceName/subraces", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const raceName = req.params.raceName;
  let phbSubraces = racesData.subrace.filter(
    (subrace) =>
      subrace.raceName === raceName &&
      subrace.raceSource === "PHB" &&
      subrace.source === "PHB"
  );
  
  // For Human, if there's a subrace without a name (Standard Human), add a name
  if (raceName === "Human") {
    phbSubraces = phbSubraces.map((subrace) => {
      if (!subrace.name || subrace.name.trim() === "") {
        return { ...subrace, name: "Standard Human" };
      }
      return subrace;
    });
  }
  
  res.json(phbSubraces);
});

// Get PHB races
app.get("/api/data/races/phb", (_req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.race) {
    return res.status(500).json({ error: "Không thể load dữ liệu races" });
  }

  const phbRaces = racesData.race.filter((race) => race.source === "PHB");
  res.json(phbRaces);
});

// Get PHB subraces for a specific race
app.get("/api/data/races/:raceName/subraces", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const raceName = req.params.raceName;
  let phbSubraces = racesData.subrace.filter(
    (subrace) =>
      subrace.raceName === raceName &&
      subrace.raceSource === "PHB" &&
      subrace.source === "PHB"
  );
  
  // For Human, if there's a subrace without a name (Standard Human), add a name
  if (raceName === "Human") {
    phbSubraces = phbSubraces.map((subrace) => {
      if (!subrace.name || subrace.name.trim() === "") {
        return { ...subrace, name: "Standard Human" };
      }
      return subrace;
    });
  }
  
  res.json(phbSubraces);
});

// Get specific subrace by name
app.get("/api/data/subraces/:name", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const subraceName = req.params.name;
  let subrace = racesData.subrace.find(
    (s) => {
      const name = s.name || (s.raceName === "Human" ? "Standard Human" : "");
      return name.toLowerCase() === subraceName.toLowerCase() && s.source === "PHB";
    }
  );

  // Handle "Standard Human" case
  if (!subrace && subraceName.toLowerCase() === "standard human") {
    subrace = racesData.subrace.find(
      (s) => s.raceName === "Human" && (!s.name || s.name.trim() === "") && s.source === "PHB"
    );
    if (subrace) {
      subrace = { ...subrace, name: "Standard Human" };
    }
  }

  if (!subrace) {
    return res.status(404).json({ error: "Subrace không tồn tại" });
  }

  res.json(subrace);
});

// Get PHB races
app.get("/api/data/races/phb", (_req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.race) {
    return res.status(500).json({ error: "Không thể load dữ liệu races" });
  }

  const phbRaces = racesData.race.filter((race) => race.source === "PHB");
  res.json(phbRaces);
});

// Get PHB subraces for a specific race
app.get("/api/data/races/:raceName/subraces", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const raceName = req.params.raceName;
  let phbSubraces = racesData.subrace.filter(
    (subrace) =>
      subrace.raceName === raceName &&
      subrace.raceSource === "PHB" &&
      subrace.source === "PHB"
  );
  
  // For Human, if there's a subrace without a name (Standard Human), add a name
  if (raceName === "Human") {
    phbSubraces = phbSubraces.map((subrace) => {
      if (!subrace.name || subrace.name.trim() === "") {
        return { ...subrace, name: "Standard Human" };
      }
      return subrace;
    });
  }
  
  res.json(phbSubraces);
});

// Get specific subrace by name
app.get("/api/data/subraces/:name", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const subraceName = req.params.name;
  let subrace = racesData.subrace.find(
    (subrace) => subrace.name === subraceName || subrace.name?.toLowerCase() === subraceName.toLowerCase()
  );

  // For Human, if there's a subrace without a name (Standard Human), add a name
  if (!subrace && subraceName === "Standard Human") {
    subrace = racesData.subrace.find((subrace) => !subrace.name || subrace.name.trim() === "");
    if (subrace) {
      subrace = { ...subrace, name: "Standard Human" };
    }
  }

  if (!subrace) {
    return res.status(404).json({ error: "Subrace không tồn tại" });
  }

  res.json(subrace);
});

// Get PHB races
app.get("/api/data/races/phb", (_req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.race) {
    return res.status(500).json({ error: "Không thể load dữ liệu races" });
  }

  const phbRaces = racesData.race.filter((race) => race.source === "PHB");
  res.json(phbRaces);
});

// Get PHB subraces for a specific race
app.get("/api/data/races/:raceName/subraces", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const raceName = req.params.raceName;
  let phbSubraces = racesData.subrace.filter(
    (subrace) =>
      subrace.raceName === raceName &&
      subrace.raceSource === "PHB" &&
      subrace.source === "PHB"
  );
  
  // For Human, if there's a subrace without a name (Standard Human), add a name
  if (raceName === "Human") {
    phbSubraces = phbSubraces.map((subrace) => {
      if (!subrace.name || subrace.name.trim() === "") {
        return { ...subrace, name: "Standard Human" };
      }
      return subrace;
    });
  }
  
  res.json(phbSubraces);
});

// Get specific subrace by name
app.get("/api/data/subraces/:name", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const subraceName = req.params.name;
  let subrace = racesData.subrace.find(
    (subrace) => subrace.name === subraceName || subrace.name?.toLowerCase() === subraceName.toLowerCase()
  );

  // For Human, if there's a subrace without a name (Standard Human), add a name
  if (!subrace && subraceName === "Standard Human") {
    subrace = racesData.subrace.find((subrace) => !subrace.name || subrace.name.trim() === "");
    if (subrace) {
      subrace = { ...subrace, name: "Standard Human" };
    }
  }

  if (!subrace) {
    return res.status(404).json({ error: "Subrace không tồn tại" });
  }

  res.json(subrace);
});
app.get("/api/data/races/phb", (_req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.race) {
    return res.status(500).json({ error: "Không thể load dữ liệu races" });
  }

  const phbRaces = racesData.race.filter((race) => race.source === "PHB");
  res.json(phbRaces);
});

// Get PHB subraces for a specific race
app.get("/api/data/races/:raceName/subraces", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const raceName = req.params.raceName;
  let phbSubraces = racesData.subrace.filter(
    (subrace) =>
      subrace.raceName === raceName &&
      subrace.raceSource === "PHB" &&
      subrace.source === "PHB"
  );
  
  // For Human, if there's a subrace without a name (Standard Human), add a name
  if (raceName === "Human") {
    phbSubraces = phbSubraces.map((subrace) => {
      if (!subrace.name || subrace.name.trim() === "") {
        return { ...subrace, name: "Standard Human" };
      }
      return subrace;
    });
  }
  
  res.json(phbSubraces);
});

// Get specific subrace by name
app.get("/api/data/subraces/:name", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.subrace) {
    return res.status(500).json({ error: "Không thể load dữ liệu subraces" });
  }

  const subraceName = req.params.name;
  let subrace = racesData.subrace.find(
    (s) => {
      const name = s.name || (s.raceName === "Human" ? "Standard Human" : "");
      return name.toLowerCase() === subraceName.toLowerCase() && s.source === "PHB";
    }
  );

  // Handle "Standard Human" case
  if (!subrace && subraceName.toLowerCase() === "standard human") {
    subrace = racesData.subrace.find(
      (s) => s.raceName === "Human" && (!s.name || s.name.trim() === "") && s.source === "PHB"
    );
    if (subrace) {
      subrace = { ...subrace, name: "Standard Human" };
    }
  }

  if (!subrace) {
    return res.status(404).json({ error: "Subrace không tồn tại" });
  }

  res.json(subrace);
});

// Get PHB classes
app.get("/api/data/classes/phb", (_req, res) => {
  const classFiles = [
    "class-barbarian.json",
    "class-bard.json",
    "class-cleric.json",
    "class-druid.json",
    "class-fighter.json",
    "class-monk.json",
    "class-paladin.json",
    "class-ranger.json",
    "class-rogue.json",
    "class-sorcerer.json",
    "class-warlock.json",
    "class-wizard.json",
  ];

  const classes = [];
  for (const file of classFiles) {
    const data = loadData(`class/${file}`);
    if (data && data.class && data.class[0] && data.class[0].source === "PHB") {
      classes.push(data.class[0]);
    }
  }

  res.json(classes);
});

// Get PHB backgrounds
app.get("/api/data/backgrounds/phb", (_req, res) => {
  const backgroundsData = loadData("backgrounds.json");
  if (!backgroundsData || !backgroundsData.background) {
    return res.status(500).json({ error: "Không thể load dữ liệu backgrounds" });
  }

  const phbBackgrounds = backgroundsData.background.filter(
    (bg) => bg.source === "PHB"
  );
  res.json(phbBackgrounds);
});

// Get specific background by name
app.get("/api/data/backgrounds/:name", (req, res) => {
  const backgroundsData = loadData("backgrounds.json");
  if (!backgroundsData || !backgroundsData.background) {
    return res.status(500).json({ error: "Không thể load dữ liệu backgrounds" });
  }

  const background = backgroundsData.background.find(
    (bg) => bg.name && bg.name.toLowerCase() === req.params.name.toLowerCase() && bg.source === "PHB"
  );
  if (!background) {
    return res.status(404).json({ error: "Background không tồn tại" });
  }

  res.json(background);
});

// Get specific race by name
app.get("/api/data/races/:name", (req, res) => {
  const racesData = loadData("races.json");
  if (!racesData || !racesData.race) {
    return res.status(500).json({ error: "Không thể load dữ liệu races" });
  }

  const race = racesData.race.find(
    (r) => r.name.toLowerCase() === req.params.name.toLowerCase() && r.source === "PHB"
  );
  if (!race) {
    return res.status(404).json({ error: "Race không tồn tại" });
  }

  res.json(race);
});

// Get specific class by name
app.get("/api/data/classes/:name", (req, res) => {
  const className = req.params.name.toLowerCase();
  const classMap = {
    barbarian: "class-barbarian.json",
    bard: "class-bard.json",
    cleric: "class-cleric.json",
    druid: "class-druid.json",
    fighter: "class-fighter.json",
    monk: "class-monk.json",
    paladin: "class-paladin.json",
    ranger: "class-ranger.json",
    rogue: "class-rogue.json",
    sorcerer: "class-sorcerer.json",
    warlock: "class-warlock.json",
    wizard: "class-wizard.json",
  };

  const file = classMap[className];
  if (!file) {
    return res.status(404).json({ error: "Class không tồn tại" });
  }

  const data = loadData(`class/${file}`);
  if (!data || !data.class || !data.class[0]) {
    return res.status(404).json({ error: "Class không tồn tại" });
  }

  // Return class info with classFeature/subclassFeature arrays if available
  const classInfo = data.class[0];
  if (data.classFeature) {
    classInfo.classFeature = data.classFeature;
  }
  if (data.subclassFeature) {
    classInfo.subclassFeature = data.subclassFeature;
  }

  res.json(classInfo);
});

// Get subclasses for a specific class
app.get("/api/data/classes/:name/subclasses", (req, res) => {
  const className = req.params.name;
  const classMap = {
    Barbarian: "class-barbarian.json",
    Bard: "class-bard.json",
    Cleric: "class-cleric.json",
    Druid: "class-druid.json",
    Fighter: "class-fighter.json",
    Monk: "class-monk.json",
    Paladin: "class-paladin.json",
    Ranger: "class-ranger.json",
    Rogue: "class-rogue.json",
    Sorcerer: "class-sorcerer.json",
    Warlock: "class-warlock.json",
    Wizard: "class-wizard.json",
  };

  const file = classMap[className];
  if (!file) {
    return res.status(404).json({ error: "Class không tồn tại" });
  }

  const data = loadData(`class/${file}`);
  if (!data || !data.subclass) {
    return res.json([]);
  }

  const phbSubclasses = data.subclass.filter(
    (subclass) =>
      subclass.className === className &&
      subclass.classSource === "PHB" &&
      subclass.source === "PHB"
  );
  res.json(phbSubclasses);
});

// Get PHB feats
app.get("/api/data/feats/phb", (_req, res) => {
  const featsData = loadData("feats.json");
  if (!featsData || !featsData.feat) {
    return res.status(500).json({ error: "Không thể load dữ liệu feats" });
  }

  const phbFeats = featsData.feat.filter((feat) => feat.source === "PHB");
  res.json(phbFeats);
});

// Get specific feat by name
app.get("/api/data/feats/:name", (req, res) => {
  const featsData = loadData("feats.json");
  if (!featsData || !featsData.feat) {
    return res.status(500).json({ error: "Không thể load dữ liệu feats" });
  }

  const feat = featsData.feat.find(
    (f) => f.name.toLowerCase() === req.params.name.toLowerCase()
  );
  if (!feat) {
    return res.status(404).json({ error: "Feat không tồn tại" });
  }

  res.json(feat);
});

// Get specific subclass by name
app.get("/api/data/subclasses/:className/:subclassName", (req, res) => {
  const className = req.params.className;
  const subclassName = req.params.subclassName;
  const classMap = {
    Barbarian: "class-barbarian.json",
    Bard: "class-bard.json",
    Cleric: "class-cleric.json",
    Druid: "class-druid.json",
    Fighter: "class-fighter.json",
    Monk: "class-monk.json",
    Paladin: "class-paladin.json",
    Ranger: "class-ranger.json",
    Rogue: "class-rogue.json",
    Sorcerer: "class-sorcerer.json",
    Warlock: "class-warlock.json",
    Wizard: "class-wizard.json",
  };

  const file = classMap[className];
  if (!file) {
    return res.status(404).json({ error: "Class không tồn tại" });
  }

  const data = loadData(`class/${file}`);
  if (!data || !data.subclass) {
    return res.status(404).json({ error: "Subclass không tồn tại" });
  }

  const subclass = data.subclass.find(
    (s) =>
      s.name === subclassName &&
      s.className === className &&
      s.source === "PHB"
  );
  if (!subclass) {
    return res.status(404).json({ error: "Subclass không tồn tại" });
  }

  res.json(subclass);
});

// Get spell by name
app.get("/api/data/spells/:name", (req, res) => {
  const spellName = req.params.name;
  const spellsData = loadData("spells/spells-phb.json");
  
  if (!spellsData || !spellsData.spell) {
    return res.status(500).json({ error: "Không thể load dữ liệu spells" });
  }

  const spell = spellsData.spell.find(
    (s) => s.name.toLowerCase() === spellName.toLowerCase()
  );
  
  if (!spell) {
    return res.status(404).json({ error: "Spell không tồn tại" });
  }

  res.json(spell);
});

// Get spells by class and level
app.get("/api/data/spells/class/:className", (req, res) => {
  const className = req.params.className;
  const level = parseInt(req.query.level) || 1;
  const spellLevel = req.query.spellLevel !== undefined ? parseInt(req.query.spellLevel) : null;
  
  const spellsData = loadData("spells/spells-phb.json");
  if (!spellsData || !spellsData.spell) {
    return res.status(500).json({ error: "Không thể load dữ liệu spells" });
  }

  // Normalize class name (capitalize first letter)
  const normalizedClassName = className.charAt(0).toUpperCase() + className.slice(1);
  
  // Get class spell list from index
  let classSpellSet = null;
  if (dataIndexes.classSpellLists && dataIndexes.classSpellLists[normalizedClassName]) {
    classSpellSet = dataIndexes.classSpellLists[normalizedClassName];
  }
  
  // Filter spells by class spell list
  let filteredSpells = spellsData.spell;
  
  if (classSpellSet) {
    // Filter to only spells in the class spell list
    filteredSpells = filteredSpells.filter(spell => {
      return classSpellSet.has(spell.name);
    });
  }
  
  // Filter by spell level if specified
  if (spellLevel !== null) {
    filteredSpells = filteredSpells.filter(spell => spell.level === spellLevel);
  } else {
    // Filter by max spell level available at character level
    const maxSpellLevel = Math.ceil(level / 2);
    filteredSpells = filteredSpells.filter(spell => spell.level <= maxSpellLevel);
  }
  
  // Sort by level, then by name
  filteredSpells.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.name.localeCompare(b.name);
  });

  res.json(filteredSpells);
});

// Get item by name
app.get("/api/data/items/:name", (req, res) => {
  const itemName = req.params.name;
  const itemsData = loadData("items.json");
  
  if (!itemsData || !itemsData.item) {
    return res.status(500).json({ error: "Không thể load dữ liệu items" });
  }

  // Try to find item by name (case insensitive, partial match)
  const item = itemsData.item.find(
    (i) => i.name && i.name.toLowerCase().includes(itemName.toLowerCase())
  );
  
  if (!item) {
    return res.status(404).json({ error: "Item không tồn tại" });
  }

  res.json(item);
});

// Get items by equipment type (for starting equipment selection)
app.get("/api/data/items/type/:equipmentType", (req, res) => {
  const equipmentType = req.params.equipmentType;
  
  // Load items-base.json first (has base items like weapons, focuses)
  const itemsBaseData = loadData("items-base.json");
  const itemsData = loadData("items.json");
  
  if (!itemsBaseData?.baseitem && !itemsData?.item) {
    return res.status(500).json({ error: "Không thể load dữ liệu items" });
  }

  let filteredItems = [];
  
  // Combine items from both sources (prefer baseitem for common items)
  const allItems = [];
  if (itemsBaseData?.baseitem) {
    allItems.push(...itemsBaseData.baseitem);
  }
  if (itemsData?.item) {
    // Only add items from items.json if not already in baseitem (avoid duplicates)
    const baseItemNames = new Set(itemsBaseData?.baseitem?.map(i => i.name?.toLowerCase()) || []);
    itemsData.item.forEach(item => {
      if (!baseItemNames.has(item.name?.toLowerCase())) {
        allItems.push(item);
      }
    });
  }
  
  // Map equipmentType to item filters
  switch (equipmentType) {
    case "weaponMartial":
      filteredItems = allItems.filter(
        (i) => i.weapon && i.weaponCategory === "martial" && (i.source === "PHB" || i.source === undefined)
      );
      break;
    case "weaponMartialMelee":
      filteredItems = allItems.filter(
        (i) => i.weapon && i.weaponCategory === "martial" && i.type === "M" && (i.source === "PHB" || i.source === undefined)
      );
      break;
    case "weaponMartialRanged":
      filteredItems = allItems.filter(
        (i) => i.weapon && i.weaponCategory === "martial" && i.type === "R" && (i.source === "PHB" || i.source === undefined)
      );
      break;
    case "weaponSimple":
      filteredItems = allItems.filter(
        (i) => i.weapon && i.weaponCategory === "simple" && (i.source === "PHB" || i.source === undefined)
      );
      break;
    case "weaponSimpleMelee":
      filteredItems = allItems.filter(
        (i) => i.weapon && i.weaponCategory === "simple" && i.type === "M" && (i.source === "PHB" || i.source === undefined)
      );
      break;
    case "weaponSimpleRanged":
      filteredItems = allItems.filter(
        (i) => i.weapon && i.weaponCategory === "simple" && i.type === "R" && (i.source === "PHB" || i.source === undefined)
      );
      break;
    case "focusSpellcastingArcane":
      filteredItems = allItems.filter(
        (i) => i.type === "SCF" && i.scfType === "arcane" && (i.source === "PHB" || i.source === undefined)
      );
      break;
    case "focusSpellcastingHoly":
      filteredItems = allItems.filter(
        (i) => i.type === "SCF" && i.scfType === "holy" && (i.source === "PHB" || i.source === undefined)
      );
      break;
    case "focusSpellcastingDruidic":
      filteredItems = allItems.filter(
        (i) => i.type === "SCF" && i.scfType === "druidic" && (i.source === "PHB" || i.source === undefined)
      );
      break;
    default:
      console.log(`Unknown equipment type: ${equipmentType}`);
      return res.status(400).json({ error: `Equipment type không hợp lệ: ${equipmentType}` });
  }

  // Sort by name
  filteredItems.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  console.log(`Equipment type ${equipmentType}: found ${filteredItems.length} items`);
  res.json(filteredItems);
});

// Get all skills
app.get("/api/data/skills", (_req, res) => {
  const skillsData = loadData("skills.json");
  
  if (!skillsData || !skillsData.skill) {
    return res.status(500).json({ error: "Không thể load dữ liệu skills" });
  }

  res.json(skillsData.skill || []);
});

// Get standard languages (PHB)
app.get("/api/data/languages/standard", (_req, res) => {
  const languagesData = loadData("languages.json");
  
  if (!languagesData || !languagesData.language) {
    return res.status(500).json({ error: "Không thể load dữ liệu languages" });
  }

  // Filter for standard languages from PHB
  const standardLanguages = languagesData.language.filter(
    (lang) => lang.type === "standard" && (lang.source === "PHB" || lang.srd === true || lang.basicRules === true)
  );
  
  // Remove duplicates by name
  const uniqueLanguages = [];
  const seen = new Set();
  standardLanguages.forEach((lang) => {
    if (!seen.has(lang.name)) {
      seen.add(lang.name);
      uniqueLanguages.push(lang);
    }
  });
  
  res.json(uniqueLanguages);
});

// Get skill info (just return basic info)
app.get("/api/data/skills/:name", (req, res) => {
  const skillName = req.params.name;
  const skillsData = loadData("skills.json");
  
  if (!skillsData || !skillsData.skill) {
    return res.status(500).json({ error: "Không thể load dữ liệu skills" });
  }

  const skill = skillsData.skill.find(
    (s) => s.name && s.name.toLowerCase() === skillName.toLowerCase()
  );
  
  if (!skill) {
    // Return basic info if not found
    return res.json({
      name: skillName,
      type: "skill",
      description: `${skillName} skill`,
    });
  }

  res.json(skill);
});

// Get condition info
app.get("/api/data/conditions/:name", (req, res) => {
  const conditionName = req.params.name;
  const conditionsData = loadData("conditionsdiseases.json");
  
  if (!conditionsData || !conditionsData.condition) {
    return res.status(500).json({ error: "Không thể load dữ liệu conditions" });
  }

  const condition = conditionsData.condition.find(
    (c) => c.name && c.name.toLowerCase() === conditionName.toLowerCase()
  );
  
  if (!condition) {
    return res.status(404).json({ error: "Condition không tồn tại" });
  }

  res.json(condition);
});

// Generic lookup endpoint for any reference
app.get("/api/data/lookup/:type/:name", async (req, res) => {
  const { type, name } = req.params;
  
  try {
    switch (type) {
      case "spell":
        const decodedSpellName = decodeURIComponent(name);
        const searchName = decodedSpellName.toLowerCase().trim();
        
        // Use index for O(1) lookup
        if (dataIndexes.spells) {
          const spell = dataIndexes.spells.get(searchName);
          if (spell) return res.json(spell);
        }
        
        // Fallback to cache if index not available
        const spellsData = dataCache["spells/spells-phb.json"] || loadData("spells/spells-phb.json");
        if (spellsData?.spell) {
          let spell = spellsData.spell.find(
            (s) => s.name && s.name.toLowerCase() === searchName
          );
          if (!spell) {
            spell = spellsData.spell.find(
              (s) => s.alias && s.alias.some((a) => a.toLowerCase() === searchName)
            );
          }
          if (spell) return res.json(spell);
        }
        break;
      case "item":
        // Decode URL-encoded name
        const decodedItemName = decodeURIComponent(name);
        let searchItemName = decodedItemName.toLowerCase().trim();
        
        // Handle special mappings for spellcasting focuses
        if (searchItemName === "arcane focus" || searchItemName.includes("arcane focus")) {
          // Try multiple variations
          const variations = [
            "spellcasting focus",
            "arcane focus",
            "focus (arcane)",
            "arcane focus (crystal)",
            "arcane focus (orb)",
            "arcane focus (rod)",
            "arcane focus (staff)",
            "arcane focus (wand)"
          ];
          
          for (const variation of variations) {
            if (dataIndexes.items) {
              const item = dataIndexes.items.get(variation);
              if (item) return res.json(item);
            }
            
            const itemsBaseData = loadData("items-base.json");
            if (itemsBaseData?.baseitem) {
              const item = itemsBaseData.baseitem.find(
                (i) => i.name && i.name.toLowerCase() === variation
              );
              if (item) return res.json(item);
            }
            
            const itemsData = dataCache["items.json"] || loadData("items.json");
            if (itemsData?.item) {
              const item = itemsData.item.find(
                (i) => i.name && i.name.toLowerCase() === variation
              );
              if (item) return res.json(item);
            }
          }
          
          // If still not found, return a generic spellcasting focus entry
          return res.json({
            name: "Arcane Focus",
            type: "G",
            rarity: "none",
            value: 5,
            weight: 0,
            entries: [
              "An arcane focus is a special item—an orb, a crystal, a rod, a specially constructed staff, a wand-like length of wood, or some similar item—designed to channel the power of arcane spells. A sorcerer, warlock, or wizard can use such an item as a spellcasting focus."
            ],
            source: "PHB",
            page: 150
          });
        }
        
        // Use index for O(1) lookup
        if (dataIndexes.items) {
          // Try exact match first
          let item = dataIndexes.items.get(searchItemName);
          if (item) return res.json(item);
          
          // Try without parentheses for items like "crossbow bolts (20)"
          const nameWithoutParens = searchItemName.replace(/\s*\([^)]*\)\s*/g, "").trim();
          if (nameWithoutParens !== searchItemName) {
            item = dataIndexes.items.get(nameWithoutParens);
            if (item) return res.json(item);
          }
        }
        
        // Fallback - try items-base.json first (more complete)
        const itemsBaseData = loadData("items-base.json");
        if (itemsBaseData?.baseitem) {
          // Try exact match
          let item = itemsBaseData.baseitem.find(
            (i) => i.name && i.name.toLowerCase() === searchItemName
          );
          if (item) return res.json(item);
          
          // Try without parentheses
          const nameWithoutParens = searchItemName.replace(/\s*\([^)]*\)\s*/g, "").trim();
          if (nameWithoutParens !== searchItemName) {
            item = itemsBaseData.baseitem.find(
              (i) => i.name && i.name.toLowerCase() === nameWithoutParens
            );
            if (item) return res.json(item);
          }
          
          // Try partial match
          item = itemsBaseData.baseitem.find(
            (i) => i.name && i.name.toLowerCase().includes(searchItemName)
          );
          if (item) return res.json(item);
        }
        
        // Fallback to items.json
        const itemsData = dataCache["items.json"] || loadData("items.json");
        if (itemsData?.item) {
          // Try exact match
          let item = itemsData.item.find(
            (i) => i.name && i.name.toLowerCase() === searchItemName
          );
          if (item) return res.json(item);
          
          // Try without parentheses
          const nameWithoutParens = searchItemName.replace(/\s*\([^)]*\)\s*/g, "").trim();
          if (nameWithoutParens !== searchItemName) {
            item = itemsData.item.find(
              (i) => i.name && i.name.toLowerCase() === nameWithoutParens
            );
            if (item) return res.json(item);
          }
          
          // Try partial match as last resort
          item = itemsData.item.find(
            (i) => i.name && i.name.toLowerCase().includes(searchItemName)
          );
          if (item) return res.json(item);
        }
        return res.status(404).json({ error: "Item không tồn tại" });
      case "feat":
        const featsData = loadData("feats.json");
        if (featsData?.feat) {
          const feat = featsData.feat.find(
            (f) => f.name.toLowerCase() === name.toLowerCase()
          );
          if (feat) return res.json(feat);
        }
        break;
      case "class":
        const className = name.toLowerCase();
        const classMap = {
          barbarian: "class-barbarian.json",
          bard: "class-bard.json",
          cleric: "class-cleric.json",
          druid: "class-druid.json",
          fighter: "class-fighter.json",
          monk: "class-monk.json",
          paladin: "class-paladin.json",
          ranger: "class-ranger.json",
          rogue: "class-rogue.json",
          sorcerer: "class-sorcerer.json",
          warlock: "class-warlock.json",
          wizard: "class-wizard.json",
        };
        const file = classMap[className];
        if (file) {
          const data = loadData(`class/${file}`);
          if (data?.class?.[0]) return res.json(data.class[0]);
        }
        break;
      case "race":
        const racesData = loadData("races.json");
        if (racesData?.race) {
          const race = racesData.race.find(
            (r) => r.name.toLowerCase() === name.toLowerCase() && r.source === "PHB"
          );
          if (race) return res.json(race);
        }
        break;
      case "condition":
        // Use index for O(1) lookup
        if (dataIndexes.conditions) {
          const condition = dataIndexes.conditions.get(name.toLowerCase());
          if (condition) return res.json(condition);
        }
        // Fallback
        const conditionsData = dataCache["conditionsdiseases.json"] || loadData("conditionsdiseases.json");
        if (conditionsData?.condition) {
          const condition = conditionsData.condition.find(
            (c) => c.name && c.name.toLowerCase() === name.toLowerCase()
          );
          if (condition) return res.json(condition);
        }
        break;
      case "skill":
        // Use index for O(1) lookup
        if (dataIndexes.skills) {
          const skill = dataIndexes.skills.get(name.toLowerCase());
          if (skill) return res.json(skill);
        }
        // Fallback
        const skillsData = dataCache["skills.json"] || loadData("skills.json");
        if (skillsData?.skill) {
          const skill = skillsData.skill.find(
            (s) => s.name && s.name.toLowerCase() === name.toLowerCase()
          );
          if (skill) return res.json(skill);
        }
        return res.json({
          name: name,
          type: "skill",
          description: `${name} skill`,
        });
      case "damage":
        // Damage types: fire, cold, acid, etc.
        return res.json({
          name: name,
          type: "damage",
          description: `${name} damage type`,
        });
      case "dice":
        // Dice notation: 1d6, 2d8, etc.
        return res.json({
          name: name,
          type: "dice",
          description: `Dice roll: ${name}`,
        });
      case "dc":
        // Difficulty Class
        return res.json({
          name: name,
          type: "dc",
          description: `Difficulty Class: ${name}`,
        });
      case "hit":
        // Hit modifier
        return res.json({
          name: name,
          type: "hit",
          description: `Attack modifier: +${name}`,
        });
      case "atk":
        // Attack type: mw (melee weapon), rw (ranged weapon), ms (melee spell), rs (ranged spell)
        const atkTypes = {
          mw: "Melee Weapon Attack",
          rw: "Ranged Weapon Attack",
          ms: "Melee Spell Attack",
          rs: "Ranged Spell Attack",
        };
        return res.json({
          name: name,
          type: "atk",
          description: atkTypes[name.toLowerCase()] || `Attack type: ${name}`,
        });
      case "object":
        const objectsData = loadData("items.json");
        if (objectsData?.item) {
          const obj = objectsData.item.find(
            (i) => i.name && i.name.toLowerCase().includes(name.toLowerCase())
          );
          if (obj) return res.json(obj);
        }
        return res.json({
          name: name,
          type: "object",
          description: `${name} object`,
        });
      case "creature":
      case "monster":
        // Try bestiary-phb.json first
        const bestiaryPhb = loadData("bestiary/bestiary-phb.json");
        if (bestiaryPhb?.monster) {
          const monster = bestiaryPhb.monster.find(
            (m) => m.name && m.name.toLowerCase() === name.toLowerCase()
          );
          if (monster) return res.json(monster);
        }
        // Try bestiary.json as fallback
        const monstersData = loadData("bestiary.json");
        if (monstersData?.monster) {
          const monster = monstersData.monster.find(
            (m) => m.name && m.name.toLowerCase() === name.toLowerCase()
          );
          if (monster) return res.json(monster);
        }
        return res.json({
          name: name,
          type: type,
          description: `${name} ${type}`,
        });
      case "background":
        // Use index for O(1) lookup
        if (dataIndexes.backgrounds) {
          const background = dataIndexes.backgrounds.get(name.toLowerCase());
          if (background) return res.json(background);
        }
        // Fallback
        const backgroundsData = dataCache["backgrounds.json"] || loadData("backgrounds.json");
        if (backgroundsData?.background) {
          const background = backgroundsData.background.find(
            (b) => b.name && b.name.toLowerCase() === name.toLowerCase()
          );
          if (background) return res.json(background);
        }
        return res.json({
          name: name,
          type: "background",
          description: `${name} background`,
        });
      case "language":
        return res.json({
          name: name,
          type: "language",
          description: `${name} language`,
        });
      case "h":
        return res.json({
          name: "Hit",
          type: "hit",
          description: "The attack hits the target",
        });
      case "m":
        return res.json({
          name: "Miss",
          type: "miss",
          description: "The attack misses the target",
        });
      case "optionalfeature":
        const featureSearchName = name.toLowerCase();
        
        // 1. Search in optionalfeatures.json
        const optionalFeaturesData = dataCache["optionalfeatures.json"] || loadData("optionalfeatures.json");
        if (optionalFeaturesData?.optionalfeature) {
          const optFeature = optionalFeaturesData.optionalfeature.find(
            (f) => f.name && f.name.toLowerCase() === featureSearchName
          );
          if (optFeature) return res.json(optFeature);
        }
        
        // 2. Search in senses.json (for Darkvision, Blindsight, etc.)
        const sensesData = dataCache["senses.json"] || loadData("senses.json");
        if (sensesData?.sense) {
          const sense = sensesData.sense.find(
            (s) => s.name && s.name.toLowerCase() === featureSearchName
          );
          if (sense) return res.json(sense);
        }
        
        // 3. Search in race features from races.json (for Menacing, Relentless Endurance, etc.)
        const raceFeaturesData = dataCache["races.json"] || loadData("races.json");
        if (raceFeaturesData?.race) {
          for (const race of raceFeaturesData.race) {
            if (race.entries && Array.isArray(race.entries)) {
              for (const entry of race.entries) {
                if (entry.name && entry.name.toLowerCase() === featureSearchName && entry.type === "entries") {
                  // Return as a feature object
                  return res.json({
                    name: entry.name,
                    entries: entry.entries,
                    source: race.source || "PHB",
                    page: race.page,
                    type: "raceFeature"
                  });
                }
              }
            }
          }
        }
        
        // 4. Use index for class features lookup
        if (dataIndexes.features) {
          const feature = dataIndexes.features.get(featureSearchName);
          if (feature) return res.json(feature);
        }
        
        // 5. Fallback - search in cached class files
        const classFiles = [
          "class-barbarian.json",
          "class-bard.json",
          "class-cleric.json",
          "class-druid.json",
          "class-fighter.json",
          "class-monk.json",
          "class-paladin.json",
          "class-ranger.json",
          "class-rogue.json",
          "class-sorcerer.json",
          "class-warlock.json",
          "class-wizard.json",
        ];
        
        for (const file of classFiles) {
          const classData = dataCache[`class/${file}`] || loadData(`class/${file}`);
          if (classData?.classFeature) {
            let feature = classData.classFeature.find(
              (f) => f.name && f.name.toLowerCase() === featureSearchName
            );
            if (feature) return res.json(feature);
          }
          if (classData?.optionalfeature) {
            let feature = classData.optionalfeature.find(
              (f) => f.name && f.name.toLowerCase() === featureSearchName
            );
            if (feature) return res.json(feature);
          }
        }
        break;
      case "variantrule":
        // Use index for O(1) lookup
        if (dataIndexes.variantrules) {
          const rule = dataIndexes.variantrules.get(name.toLowerCase());
          if (rule) return res.json(rule);
        }
        // Fallback
        const variantData = dataCache["variantrules.json"] || loadData("variantrules.json");
        if (variantData?.variantrule) {
          const rule = variantData.variantrule.find(
            (r) => r.name && r.name.toLowerCase() === name.toLowerCase()
          );
          if (rule) return res.json(rule);
        }
        return res.json({
          name: name,
          type: "variantrule",
          description: `${name} variant rule`,
        });
      case "action":
        // Use index for O(1) lookup
        if (dataIndexes.actions) {
          const action = dataIndexes.actions.get(name.toLowerCase());
          if (action) return res.json(action);
        }
        // Fallback
        const actionsData = dataCache["actions.json"] || loadData("actions.json");
        if (actionsData?.action) {
          const action = actionsData.action.find(
            (a) => a.name && a.name.toLowerCase() === name.toLowerCase()
          );
          if (action) return res.json(action);
        }
        return res.json({
          name: name,
          type: "action",
          description: `${name} action`,
        });
    }
    
    res.status(404).json({ error: "Không tìm thấy" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Endpoint preload nhẹ - chỉ dữ liệu thường dùng nhất
app.get("/api/data/preload/essential", (req, res) => {
  try {
    const preloadData = {
      conditions: {},
      skills: {},
    };

    // Chỉ preload conditions và skills (nhỏ và thường dùng)
    if (dataIndexes.conditions) {
      dataIndexes.conditions.forEach((condition, key) => {
        preloadData.conditions[key] = condition;
      });
    }

    if (dataIndexes.skills) {
      dataIndexes.skills.forEach((skill, key) => {
        preloadData.skills[key] = skill;
      });
    }

    res.json(preloadData);
  } catch (error) {
    console.error("Error preloading essential data:", error);
    res.status(500).json({ error: "Lỗi preload dữ liệu essential" });
  }
});

// Translation cache on server
const translationCache = new Map();
const MAX_TRANSLATION_CACHE = 5000;

// Endpoint để dịch text
app.post("/api/translate", async (req, res) => {
  const { text } = req.body;
  
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text is required" });
  }

  // Check cache first
  const cacheKey = text.toLowerCase().trim();
  if (translationCache.has(cacheKey)) {
    return res.json({ translated: translationCache.get(cacheKey) });
  }

  try {
    // Use Google Translate API (free tier)
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`
    );

    if (response.ok) {
      const data = await response.json();
      const translated = data[0]?.map((item) => item[0]).join("") || text;
      
      // Cache the result
      if (translationCache.size >= MAX_TRANSLATION_CACHE) {
        const firstKey = translationCache.keys().next().value;
        if (firstKey) {
          translationCache.delete(firstKey);
        }
      }
      translationCache.set(cacheKey, translated);
      
      res.json({ translated });
    } else {
      // Fallback: return original text
      res.json({ translated: text });
    }
  } catch (error) {
    console.error("Translation error:", error);
    // Fallback: return original text
    res.json({ translated: text });
  }
});

// Endpoint để preload tất cả dữ liệu phổ biến
app.get("/api/data/preload", (req, res) => {
  try {
    const preloadData = {
      spells: {},
      items: {},
      conditions: {},
      skills: {},
      backgrounds: {},
      variantrules: {},
      features: {},
    };

    // Preload spells
    if (dataIndexes.spells) {
      dataIndexes.spells.forEach((spell, key) => {
        preloadData.spells[key] = spell;
      });
    }

    // Preload items
    if (dataIndexes.items) {
      dataIndexes.items.forEach((item, key) => {
        preloadData.items[key] = item;
      });
    }

    // Preload conditions
    if (dataIndexes.conditions) {
      dataIndexes.conditions.forEach((condition, key) => {
        preloadData.conditions[key] = condition;
      });
    }

    // Preload skills
    if (dataIndexes.skills) {
      dataIndexes.skills.forEach((skill, key) => {
        preloadData.skills[key] = skill;
      });
    }

    // Preload backgrounds
    if (dataIndexes.backgrounds) {
      dataIndexes.backgrounds.forEach((background, key) => {
        preloadData.backgrounds[key] = background;
      });
    }

    // Preload variantrules
    if (dataIndexes.variantrules) {
      dataIndexes.variantrules.forEach((rule, key) => {
        preloadData.variantrules[key] = rule;
      });
    }

    // Preload features
    if (dataIndexes.features) {
      dataIndexes.features.forEach((feature, key) => {
        preloadData.features[key] = feature;
      });
    }

    res.json(preloadData);
  } catch (error) {
    console.error("Error preloading data:", error);
    res.status(500).json({ error: "Lỗi preload dữ liệu" });
  }
});

app.listen(PORT, () => {
  console.log(`D&D builder API running on http://localhost:${PORT}`);
});
