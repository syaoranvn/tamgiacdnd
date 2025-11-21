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

// In-memory storage
const characters = [];

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
  res.status(201).json(character);
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

  res.json(characters[index]);
});

// Delete character
app.delete("/api/characters/:id", (req, res) => {
  const index = characters.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Nhân vật không tồn tại" });
  }

  characters.splice(index, 1);
  res.status(204).send();
});

// Export character sheet to PDF
app.post("/api/characters/:id/export-pdf", async (req, res) => {
  try {
    const character = characters.find((c) => c.id === req.params.id);
    if (!character) {
      return res.status(404).json({ error: "Nhân vật không tồn tại" });
    }

    // Load PDF template
    const pdfPath = path.join(__dirname, "..", "data", "5E_CharacterSheet_Fillable.pdf");
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: "PDF template không tồn tại" });
    }

    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // Helper function to safely set field value
    const setField = (fieldName, value) => {
      try {
        const field = form.getTextField(fieldName);
        if (field && value !== undefined && value !== null) {
          field.setText(String(value));
        }
      } catch (e) {
        // Field might not exist or be wrong type, skip
        try {
          const checkbox = form.getCheckBox(fieldName);
          if (checkbox && value) {
            checkbox.check();
          }
        } catch (e2) {
          // Field doesn't exist, skip
        }
      }
    };

    // Basic Information
    setField("CharacterName", character.name || "");
    setField("ClassLevel", `${character.className || ""} ${character.level || 1}`);
    setField("Background", character.background || "");
    setField("PlayerName", ""); // Not stored
    setField("Race", character.race || "");
    if (character.subrace) {
      setField("Race", `${character.race || ""} (${character.subrace})`);
    }
    setField("Alignment", character.alignment || "");
    setField("ExperiencePoints", ""); // Not stored

    // Ability Scores
    if (character.abilityScores) {
      setField("Strength", character.abilityScores.str || 10);
      setField("Dexterity", character.abilityScores.dex || 10);
      setField("Constitution", character.abilityScores.con || 10);
      setField("Intelligence", character.abilityScores.int || 10);
      setField("Wisdom", character.abilityScores.wis || 10);
      setField("Charisma", character.abilityScores.cha || 10);
    }

    // Ability Modifiers
    if (character.calculatedStats) {
      const stats = character.calculatedStats;
      const getModifier = (score) => Math.floor((score - 10) / 2);
      
      if (character.abilityScores) {
        setField("STRmod", getModifier(character.abilityScores.str || 10));
        setField("DEXmod", getModifier(character.abilityScores.dex || 10));
        setField("CONmod", getModifier(character.abilityScores.con || 10));
        setField("INTmod", getModifier(character.abilityScores.int || 10));
        setField("WISmod", getModifier(character.abilityScores.wis || 10));
        setField("CHamod", getModifier(character.abilityScores.cha || 10));
      }

      // Calculated Stats
      setField("AC", stats.ac || 10);
      setField("Initiative", stats.initiative || 0);
      setField("Speed", stats.speed || 30);
      setField("Passive", stats.passivePerception || 10);
      setField("ProficiencyBonus", stats.proficiencyBonus || 2);
      setField("HPMax", stats.maxHp || 0);
      setField("HP", stats.hp || 0);
      setField("HDTotal", stats.hitDie || "");
    }

    // Skills - Mark proficient ones
    if (character.calculatedStats && character.calculatedStats.skills) {
      const skills = character.calculatedStats.skills;
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

      Object.entries(skillFields).forEach(([skillName, fieldPrefix]) => {
        const skill = skills[skillName];
        if (skill) {
          setField(`${fieldPrefix}Mod`, skill.modifier || 0);
          if (skill.proficient) {
            setField(`Proficiency${fieldPrefix}`, true);
          }
        }
      });
    }

    // Saving Throws
    if (character.calculatedStats && character.calculatedStats.savingThrows) {
      const saves = character.calculatedStats.savingThrows;
      setField("ST Strength", saves.str?.modifier || 0);
      setField("ST Dexterity", saves.dex?.modifier || 0);
      setField("ST Constitution", saves.con?.modifier || 0);
      setField("ST Intelligence", saves.int?.modifier || 0);
      setField("ST Wisdom", saves.wis?.modifier || 0);
      setField("ST Charisma", saves.cha?.modifier || 0);
      
      if (saves.str?.proficient) setField("Check Box 11", true);
      if (saves.dex?.proficient) setField("Check Box 18", true);
      if (saves.con?.proficient) setField("Check Box 19", true);
      if (saves.int?.proficient) setField("Check Box 20", true);
      if (saves.wis?.proficient) setField("Check Box 21", true);
      if (saves.cha?.proficient) setField("Check Box 22", true);
    }

    // Equipment
    if (character.calculatedStats && character.calculatedStats.expandedEquipment) {
      const equipment = character.calculatedStats.expandedEquipment.join(", ");
      setField("Equipment", equipment);
    } else if (character.equipment) {
      setField("Equipment", character.equipment.join(", "));
    }

    // Spells
    if (character.spells) {
      const allSpells = [];
      if (character.spells.cantrips) allSpells.push(...character.spells.cantrips.map(s => `Cantrip: ${s}`));
      for (let level = 1; level <= 9; level++) {
        const levelKey = `level${level}`;
        const levelSpells = character.spells[levelKey];
        if (levelSpells && Array.isArray(levelSpells)) {
          allSpells.push(...levelSpells.map(s => `Level ${level}: ${s}`));
        }
      }
      setField("Spells", allSpells.join(", "));
    }

    // Features & Traits
    const features = [];
    if (character.className) features.push(`Class: ${character.className}`);
    if (character.subclass) features.push(`Subclass: ${character.subclass}`);
    if (character.race) features.push(`Race: ${character.race}`);
    if (character.subrace) features.push(`Subrace: ${character.subrace}`);
    if (character.background) features.push(`Background: ${character.background}`);
    if (character.feats && character.feats.length > 0) {
      features.push(`Feats: ${character.feats.join(", ")}`);
    }
    setField("Features and Traits", features.join("\n"));

    // Personality
    if (character.ideals) setField("Ideals", character.ideals);
    if (character.bonds) setField("Bonds", character.bonds);
    if (character.flaws) setField("Flaws", character.flaws);

    // Flatten form to make it non-editable
    form.flatten();

    // Generate PDF bytes
    const filledPdfBytes = await pdfDoc.save();

    // Send PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${character.name || "character"}_sheet.pdf"`);
    res.send(Buffer.from(filledPdfBytes));
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

  res.json(data.class[0]);
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
app.get("/api/data/lookup/:type/:name", (req, res) => {
  const { type, name } = req.params;
  
  try {
    switch (type) {
      case "spell":
        const searchName = name.toLowerCase();
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
        // Use index for O(1) lookup
        if (dataIndexes.features) {
          const feature = dataIndexes.features.get(name.toLowerCase());
          if (feature) return res.json(feature);
        }
        // Fallback - search in cached class files
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
        
        const featureSearchName = name.toLowerCase();
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
