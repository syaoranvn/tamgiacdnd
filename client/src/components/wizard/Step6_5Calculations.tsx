import { useEffect } from "react";
import type { Character, CalculatedStats, AbilityKey, Class, Race, Background } from "../../types";
import { apiUrl } from "../../config/api";

interface Step6_5CalculationsProps {
  character: Partial<Character>;
  onUpdate: (updates: Partial<Character>) => void;
}

export default function Step6_5Calculations({ character, onUpdate }: Step6_5CalculationsProps) {
  useEffect(() => {
    if (!character.className || !character.race || !character.abilityScores || !character.level) {
      console.log("Step6_5Calculations: Missing required data", {
        className: character.className,
        race: character.race,
        abilityScores: character.abilityScores,
        level: character.level
      });
      return;
    }

    // Normalize class and race names to lowercase for API
    const className = character.className.toLowerCase();
    const raceName = character.race.toLowerCase();

    // Load required data
    Promise.all([
      fetch(apiUrl(`api/data/classes/${className}`))
        .then(async (r) => {
          if (!r.ok) {
            const errorText = await r.text();
            console.error(`Failed to load class ${className}:`, r.status, errorText);
            return null;
          }
          return r.json();
        })
        .catch((err) => {
          console.error(`Error fetching class ${className}:`, err);
          return null;
        }),
      fetch(apiUrl(`api/data/races/${raceName}`))
        .then(async (r) => {
          if (!r.ok) {
            const errorText = await r.text();
            console.error(`Failed to load race ${raceName}:`, r.status, errorText);
            return null;
          }
          return r.json();
        })
        .catch((err) => {
          console.error(`Error fetching race ${raceName}:`, err);
          return null;
        }),
      character.subrace
        ? fetch(apiUrl(`api/data/subraces/${character.subrace}`))
            .then(async (r) => {
              if (!r.ok) {
                console.error(`Failed to load subrace ${character.subrace}:`, r.status);
                return null;
              }
              return r.json();
            })
            .catch((err) => {
              console.error(`Error fetching subrace ${character.subrace}:`, err);
              return null;
            })
        : Promise.resolve(null),
      character.background
        ? fetch(apiUrl(`api/data/backgrounds/${character.background}`))
            .then(async (r) => {
              if (!r.ok) {
                console.error(`Failed to load background ${character.background}:`, r.status);
                return null;
              }
              return r.json();
            })
            .catch((err) => {
              console.error(`Error fetching background ${character.background}:`, err);
              return null;
            })
        : Promise.resolve(null),
    ]).then(async ([classData, raceData, subraceData, backgroundData]) => {
      console.log("Step6_5Calculations: Loaded data", {
        classData: classData ? "✓" : "✗",
        raceData: raceData ? "✓" : "✗",
        subraceData: subraceData ? "✓" : "✗",
        backgroundData: backgroundData ? "✓" : "✗",
      });

      if (!classData || !raceData) {
        console.error("Failed to load class or race data", {
          className: character.className,
          race: character.race,
          classData: classData ? "loaded" : "missing",
          raceData: raceData ? "loaded" : "missing",
        });
        return;
      }

      try {
        const expandedEquipment = await expandEquipment(character.equipment || []);
        const calculatedStats = calculateStats(
          character,
          classData as Class,
          raceData as Race,
          subraceData,
          backgroundData as Background | null,
          expandedEquipment
        );

        console.log("Step6_5Calculations: Calculated stats", calculatedStats);
        onUpdate({ calculatedStats });
      } catch (error) {
        console.error("Error in calculateStats:", error);
      }
    }).catch((error) => {
      console.error("Error calculating stats:", error);
    });
  }, [character.className, character.race, character.subrace, character.background, character.abilityScores, character.level, character.equipment, character.classSkillChoices, character.backgroundSkillChoices, character.raceSkillChoices, onUpdate]);

  // This step is hidden, so return null
  return null;
}

function calculateStats(
  character: Partial<Character>,
  classData: Class,
  raceData: Race,
  subraceData: any,
  backgroundData: Background | null,
  expandedEquipment: string[]
): CalculatedStats {
  const level = character.level || 1;
  const abilityScores = character.abilityScores || {
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
  };

  // Calculate ability modifiers
  const getModifier = (score: number): number => {
    return Math.floor((score - 10) / 2);
  };

  const modifiers = {
    str: getModifier(abilityScores.str),
    dex: getModifier(abilityScores.dex),
    con: getModifier(abilityScores.con),
    int: getModifier(abilityScores.int),
    wis: getModifier(abilityScores.wis),
    cha: getModifier(abilityScores.cha),
  };

  // Proficiency Bonus (PHB p.12: +2 at level 1-4, +3 at level 5-8, +4 at level 9-12, +5 at level 13-16, +6 at level 17-20)
  const proficiencyBonus = Math.floor((level - 1) / 4) + 2;

  // Speed (from race/subrace)
  let speed = 30; // Default
  if (raceData.speed) {
    if (typeof raceData.speed === "number") {
      speed = raceData.speed;
    } else if (raceData.speed.walk) {
      speed = raceData.speed.walk;
    }
  }
  if (subraceData?.speed) {
    if (typeof subraceData.speed === "number") {
      speed = subraceData.speed;
    } else if (subraceData.speed.walk) {
      speed = subraceData.speed.walk;
    }
  }

  // AC (Armor Class) - Base 10 + Dex modifier, modified by armor
  let ac = 10 + modifiers.dex;
  // TODO: Check if character has armor equipped and adjust AC accordingly
  // For now, base AC calculation

  // Initiative = Dex modifier
  const initiative = modifiers.dex;

  // Passive Perception = 10 + Wisdom modifier + proficiency (if proficient)
  // We'll calculate this after determining skill proficiencies

  // Saving Throws (from class)
  const savingThrows: Record<AbilityKey, { proficient: boolean; modifier: number }> = {
    str: { proficient: false, modifier: modifiers.str },
    dex: { proficient: false, modifier: modifiers.dex },
    con: { proficient: false, modifier: modifiers.con },
    int: { proficient: false, modifier: modifiers.int },
    wis: { proficient: false, modifier: modifiers.wis },
    cha: { proficient: false, modifier: modifiers.cha },
  };

  if (classData.proficiency) {
    classData.proficiency.forEach((ability: AbilityKey) => {
      savingThrows[ability].proficient = true;
      savingThrows[ability].modifier = modifiers[ability] + proficiencyBonus;
    });
  }

  // HP Calculation
  // First level: max hit die + Con modifier
  // Subsequent levels: average of hit die (rounded up) + Con modifier
  const hitDie = classData.hd?.faces || 8;
  const conMod = modifiers.con;
  const firstLevelHp = hitDie + conMod;
  const subsequentLevelHp = Math.ceil((hitDie + 1) / 2) + conMod; // Average rounded up
  const maxHp = firstLevelHp + (subsequentLevelHp * (level - 1));
  const hp = maxHp; // Start at max HP

  // Skills
  const skills: Record<string, { proficient: boolean; modifier: number }> = {};
  
  // Get all skills
  const allSkills = [
    "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
    "History", "Insight", "Intimidation", "Investigation", "Medicine",
    "Nature", "Perception", "Performance", "Persuasion", "Religion",
    "Sleight of Hand", "Stealth", "Survival"
  ];

  // Initialize all skills
  allSkills.forEach(skill => {
    const ability = getSkillAbility(skill);
    skills[skill] = {
      proficient: false,
      modifier: modifiers[ability]
    };
  });

  // Apply class skill proficiencies
  if (classData.startingProficiencies?.skills) {
    classData.startingProficiencies.skills.forEach((skillChoice: any) => {
      if (skillChoice.choose) {
        // Character should have chosen skills
        if (character.classSkillChoices) {
          character.classSkillChoices.forEach(skillName => {
            // Normalize skill name (lowercase, handle spaces)
            const normalizedSkillName = skillName.toLowerCase().trim();
            const skillKey = Object.keys(skills).find(
              k => k.toLowerCase() === normalizedSkillName
            );
            if (skillKey) {
              skills[skillKey].proficient = true;
              const ability = getSkillAbility(skillKey);
              skills[skillKey].modifier = modifiers[ability] + proficiencyBonus;
            }
          });
        }
      }
    });
  }

  // Apply background skill proficiencies
  if (backgroundData?.skillProficiencies) {
    backgroundData.skillProficiencies.forEach((skillProf: any) => {
      if (typeof skillProf === "string") {
        const skillName = skillProf;
        if (skills[skillName]) {
          skills[skillName].proficient = true;
          const ability = getSkillAbility(skillName);
          skills[skillName].modifier = modifiers[ability] + proficiencyBonus;
        }
      } else if (skillProf.any) {
        // Character should have chosen skills
        if (character.backgroundSkillChoices) {
          character.backgroundSkillChoices.forEach(skillName => {
            if (skills[skillName]) {
              skills[skillName].proficient = true;
              const ability = getSkillAbility(skillName);
              skills[skillName].modifier = modifiers[ability] + proficiencyBonus;
            }
          });
        }
      }
    });
  }

  // Apply race skill proficiencies
  if (character.raceSkillChoices) {
    character.raceSkillChoices.forEach(skillName => {
      if (skills[skillName]) {
        skills[skillName].proficient = true;
        const ability = getSkillAbility(skillName);
        skills[skillName].modifier = modifiers[ability] + proficiencyBonus;
      }
    });
  }

  // Passive Perception
  const passivePerception = 10 + (skills["Perception"]?.modifier || modifiers.wis);

  return {
    ac,
    initiative,
    speed,
    passivePerception,
    proficiencyBonus,
    savingThrows,
    hp,
    maxHp,
    hitDie: `1d${hitDie}`,
    skills,
    expandedEquipment,
  };
}

function getSkillAbility(skill: string): AbilityKey {
  const skillMap: Record<string, AbilityKey> = {
    "Acrobatics": "dex",
    "Animal Handling": "wis",
    "Arcana": "int",
    "Athletics": "str",
    "Deception": "cha",
    "History": "int",
    "Insight": "wis",
    "Intimidation": "cha",
    "Investigation": "int",
    "Medicine": "wis",
    "Nature": "int",
    "Perception": "wis",
    "Performance": "cha",
    "Persuasion": "cha",
    "Religion": "int",
    "Sleight of Hand": "dex",
    "Stealth": "dex",
    "Survival": "wis",
  };
  return skillMap[skill] || "int";
}

async function expandEquipment(equipment: string[]): Promise<string[]> {
  const expanded: string[] = [];
  
  for (const item of equipment) {
    // Check if item is a pack (e.g., "Explorer's Pack", "Dungeoneer's Pack")
    // Also check for items that might contain "pack" in their name or are known packs
    const itemLower = item.toLowerCase();
    const isPack = itemLower.includes("pack") || 
                   itemLower.includes("scholar's pack") ||
                   itemLower.includes("explorer's pack") ||
                   itemLower.includes("dungeoneer's pack") ||
                   itemLower.includes("priest's pack") ||
                   itemLower.includes("diplomat's pack") ||
                   itemLower.includes("entertainer's pack") ||
                   itemLower.includes("burglar's pack");
    
    if (isPack) {
      try {
        // Try multiple variations of the pack name
        let itemData = null;
        const variations = [
          item,
          item.replace(/\(.*\)/g, "").trim(), // Remove parentheses
          item.split("(")[0].trim(), // Get part before parentheses
        ];
        
        for (const variation of variations) {
          const response = await fetch(apiUrl(`api/data/lookup/item/${encodeURIComponent(variation)}`));
          if (response.ok) {
            itemData = await response.json();
            break;
          }
        }
        
        if (itemData) {
          // Add pack name
          expanded.push(item);
          
          // Add pack contents
          if (itemData.contents && Array.isArray(itemData.contents)) {
            itemData.contents.forEach((content: any) => {
              if (typeof content === "string") {
                expanded.push(`  └─ ${content}`);
              } else if (content.item) {
                const contentName = typeof content.item === "string" 
                  ? content.item.split("|")[0] 
                  : content.item;
                const quantity = content.quantity ? ` (${content.quantity})` : "";
                expanded.push(`  └─ ${contentName}${quantity}`);
              } else if (content.special) {
                expanded.push(`  └─ ${content.special}`);
              }
            });
          }
        } else {
          // If pack not found, just add the item
          expanded.push(item);
        }
      } catch (error) {
        console.error(`Error expanding pack ${item}:`, error);
        // Fallback: just add the item
        expanded.push(item);
      }
    } else {
      // Not a pack, just add the item
      expanded.push(item);
    }
  }
  
  return expanded;
}

