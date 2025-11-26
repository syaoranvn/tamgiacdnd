import { useEffect, useRef, useState } from "react";
import type { Character, CalculatedStats, AbilityKey, Class, Race, Background } from "../../types";
import { apiUrl } from "../../config/api";

interface Step6CalculationsProps {
  character: Partial<Character>;
  onUpdate: (updates: Partial<Character>) => void;
}

export default function Step6Calculations({ character, onUpdate }: Step6CalculationsProps) {
  const lastCalculatedRef = useRef<string>("");
  const [isCalculating, setIsCalculating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    setIsCalculating(true);
    setError(null);
    if (!character.className || !character.race || !character.abilityScores || !character.level) {
      console.log("Step6Calculations: Missing required data", {
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
      character.subclass && character.className
        ? Promise.all([
            // Load subclass list
            fetch(apiUrl(`api/data/classes/${character.className}/subclasses`))
              .then(async (r) => {
                if (!r.ok) {
                  console.error(`Failed to load subclasses:`, r.status);
                  return null;
                }
                const subclasses = await r.json();
                if (character.subclass) {
                  return subclasses.find((s: any) => s.name === character.subclass) || null;
                }
                return null;
              })
              .catch((err) => {
                console.error(`Error fetching subclasses:`, err);
                return null;
              }),
            // Load full class data to get subclassFeature array
            fetch(apiUrl(`api/data/classes/${character.className.toLowerCase()}`))
              .then(async (r) => {
                if (!r.ok) return null;
                return r.json();
              })
              .catch(() => null)
          ]).then(([subclassData, classData]) => {
            return { subclassData, classData };
          })
        : Promise.resolve({ subclassData: null, classData: null }),
    ]).then(async ([classData, raceData, subraceData, backgroundData, subclassInfo]) => {
      const subclassData = subclassInfo?.subclassData || null;
      const fullClassData = subclassInfo?.classData || classData;
      console.log("Step6Calculations: Loaded data", {
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
        // Combine equipment from character and background
        let allEquipment = [...(character.equipment || [])];
        
        // Add background equipment
        if (backgroundData?.startingEquipment) {
          backgroundData.startingEquipment.forEach((equipItem: any) => {
            if (typeof equipItem === "string") {
              if (!allEquipment.includes(equipItem)) {
                allEquipment.push(equipItem);
              }
            } else if (equipItem.equipment) {
              // Handle equipment with quantity
              const itemName = typeof equipItem.equipment === "string" 
                ? equipItem.equipment 
                : equipItem.equipment.name || equipItem.equipment;
              const quantity = equipItem.quantity || 1;
              const fullName = quantity > 1 ? `${itemName} (${quantity})` : itemName;
              if (!allEquipment.includes(fullName) && !allEquipment.includes(itemName)) {
                allEquipment.push(fullName);
              }
            }
          });
        }
        
        const expandedEquipment = await expandEquipment(allEquipment);
        
        // Load and filter subclass features based on level and choices
        let activeSubclassFeatures: any[] = [];
        if (character.subclass && fullClassData?.subclassFeature && character.subclassChoices) {
          const subclassShortName = subclassData?.shortName || subclassData?.name;
          const characterLevel = character.level || 1;
          
          // Filter subclass features by subclass and level
          activeSubclassFeatures = fullClassData.subclassFeature.filter((sf: any) => {
            // Check if feature belongs to selected subclass
            const matchesSubclass = sf.className === character.className && 
                                   (sf.subclassShortName === subclassShortName || 
                                    sf.subclass === subclassShortName ||
                                    sf.subclass === character.subclass);
            
            // Check if feature is available at current level
            const matchesLevel = !sf.level || sf.level <= characterLevel;
            
            return matchesSubclass && matchesLevel;
          });
          
          console.log("[Step6Calculations] Active subclass features:", activeSubclassFeatures);
        }
        
        const calculatedStats = calculateStats(
          character,
          classData as Class,
          raceData as Race,
          subraceData,
          backgroundData as Background | null,
          expandedEquipment,
          activeSubclassFeatures
        );

        console.log("Step6Calculations: Calculated stats", calculatedStats);
        
        // Collect all proficiencies (skills, tools, languages, etc.) into character.proficiencies array
        const allProficiencies: string[] = [];
        
        // Add skill proficiencies
        Object.entries(calculatedStats.skills || {}).forEach(([skill, data]) => {
          if (data.proficient) {
            allProficiencies.push(skill);
          }
        });
        
        // Add tool proficiencies
        if (calculatedStats.toolProficiencies) {
          calculatedStats.toolProficiencies.forEach(tool => {
            if (!allProficiencies.includes(tool)) {
              allProficiencies.push(tool);
            }
          });
        }
        
        // Add languages
        if (calculatedStats.languages) {
          calculatedStats.languages.forEach(lang => {
            if (!allProficiencies.includes(lang)) {
              allProficiencies.push(lang);
            }
          });
        }
        
        // Add saving throw proficiencies
        Object.entries(calculatedStats.savingThrows || {}).forEach(([ability, data]) => {
          if (data.proficient) {
            const abilityName = ability.charAt(0).toUpperCase() + ability.slice(1) + " Saving Throws";
            if (!allProficiencies.includes(abilityName)) {
              allProficiencies.push(abilityName);
            }
          }
        });
        
        // Add weapon proficiencies from race
        if (raceData.weaponProficiencies) {
          raceData.weaponProficiencies.forEach((weapon: string) => {
            if (!allProficiencies.includes(weapon)) {
              allProficiencies.push(weapon);
            }
          });
        }
        
        // Add armor proficiencies from race
        if (raceData.armorProficiencies) {
          raceData.armorProficiencies.forEach((armor: string) => {
            if (!allProficiencies.includes(armor)) {
              allProficiencies.push(armor);
            }
          });
        }
        
        // Add weapon proficiencies from subrace
        if (subraceData?.weaponProficiencies) {
          subraceData.weaponProficiencies.forEach((weapon: string) => {
            if (!allProficiencies.includes(weapon)) {
              allProficiencies.push(weapon);
            }
          });
        }
        
        // Add armor proficiencies from subrace
        if (subraceData?.armorProficiencies) {
          subraceData.armorProficiencies.forEach((armor: string) => {
            if (!allProficiencies.includes(armor)) {
              allProficiencies.push(armor);
            }
          });
        }
        
        // Add weapon proficiencies from class
        if (classData.startingProficiencies?.weapons) {
          classData.startingProficiencies.weapons.forEach((weapon: string) => {
            if (!allProficiencies.includes(weapon)) {
              allProficiencies.push(weapon);
            }
          });
        }
        
        // Add armor proficiencies from class
        if (classData.startingProficiencies?.armor) {
          classData.startingProficiencies.armor.forEach((armor: string) => {
            if (!allProficiencies.includes(armor)) {
              allProficiencies.push(armor);
            }
          });
        }
        
        // Create a hash of the calculated stats to avoid unnecessary updates
        const statsHash = JSON.stringify(calculatedStats);
        
        // Only update if stats have actually changed
        if (lastCalculatedRef.current !== statsHash) {
          lastCalculatedRef.current = statsHash;
          onUpdate({ 
            calculatedStats,
            proficiencies: allProficiencies,
            subclassFeatures: activeSubclassFeatures.length > 0 ? activeSubclassFeatures : undefined
          });
        }
        setIsCalculating(false);
      } catch (error) {
        console.error("Error in calculateStats:", error);
        setError("Có lỗi xảy ra khi tính toán. Vui lòng kiểm tra console.");
        setIsCalculating(false);
      }
    }).catch((error) => {
      console.error("Error calculating stats:", error);
      setError("Có lỗi xảy ra khi tải dữ liệu. Vui lòng kiểm tra console.");
      setIsCalculating(false);
    });
    // Remove onUpdate and character.equipment from dependencies to avoid infinite loop
    // Equipment is handled inside the effect, and onUpdate should be stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.className, character.race, character.subrace, character.background, character.abilityScores, character.level, character.classSkillChoices, character.backgroundSkillChoices, character.raceSkillChoices, character.raceToolChoice, character.backgroundToolChoices, character.subclassChoices, character.raceLanguageChoices, character.backgroundLanguageChoices]);

  const stats = character.calculatedStats;
  const formatModifier = (mod: number): string => {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  return (
    <div>
      <h2 className="mb-4 font-display text-2xl text-ink">Bước 6: Tính toán chỉ số</h2>
      <p className="mb-6 text-slate-600">
        Tính toán AC, Initiative, Speed, Passive Perception, Proficiency Bonus, Saving Throws và HP.
      </p>

      {isCalculating && (
        <div className="text-center py-8">
          <div className="text-slate-600">Đang tính toán các chỉ số phụ...</div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {!isCalculating && stats && (
        <div className="space-y-6">
          <div className="rounded-lg border border-amber-100 bg-white p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Chỉ số đã tính toán</h3>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">Armor Class (AC)</div>
                <div className="text-2xl font-bold text-slate-800">{stats.ac}</div>
              </div>
              
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">Initiative</div>
                <div className="text-2xl font-bold text-slate-800">{formatModifier(stats.initiative)}</div>
              </div>
              
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">Speed</div>
                <div className="text-2xl font-bold text-slate-800">{stats.speed} ft</div>
              </div>
              
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">Passive Perception</div>
                <div className="text-2xl font-bold text-slate-800">{stats.passivePerception}</div>
              </div>
              
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">Proficiency Bonus</div>
                <div className="text-2xl font-bold text-slate-800">{formatModifier(stats.proficiencyBonus)}</div>
              </div>
              
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">Hit Points (HP)</div>
                <div className="text-2xl font-bold text-slate-800">{stats.hp} / {stats.maxHp}</div>
                <div className="text-xs text-slate-500 mt-1">Hit Die: {stats.hitDie}</div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-medium text-slate-700 mb-3">Saving Throws</h4>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {Object.entries(stats.savingThrows || {}).map(([ability, data]) => (
                  <div key={ability} className="flex items-center justify-between rounded border border-slate-200 bg-white p-2">
                    <span className="text-sm font-medium text-slate-600 capitalize">{ability}</span>
                    <div className="flex items-center gap-2">
                      {data.proficient && <span className="text-amber-600 text-xs">●</span>}
                      <span className="text-slate-800 font-medium">{formatModifier(data.modifier)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-medium text-slate-700 mb-3">Skills ({Object.keys(stats.skills || {}).length} skills)</h4>
              <div className="rounded border border-slate-200 bg-white p-4 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {Object.entries(stats.skills || {})
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([skill, data]) => (
                      <div key={skill} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">{skill}</span>
                        <div className="flex items-center gap-2">
                          {data.proficient && <span className="text-amber-600 text-xs">●</span>}
                          <span className="text-slate-800 font-medium">{formatModifier(data.modifier)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isCalculating && !stats && !error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Chưa có dữ liệu để tính toán. Vui lòng hoàn thành các bước trước.
        </div>
      )}
    </div>
  );
}

function calculateStats(
  character: Partial<Character>,
  classData: Class,
  raceData: Race,
  subraceData: any,
  backgroundData: Background | null,
  expandedEquipment: string[],
  activeSubclassFeatures: any[] = []
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
  
  // Check for subclass features that modify AC (e.g., Draconic Resilience: AC = 13 + Dex when unarmored)
  let hasUnarmoredACBonus = false;
  let unarmoredAC = 0;
  activeSubclassFeatures.forEach((feature: any) => {
    if (feature.name === "Draconic Resilience" || 
        (feature.entries && Array.isArray(feature.entries) && 
         feature.entries.some((e: any) => typeof e === "string" && e.includes("AC equals 13")))) {
      // Draconic Resilience: AC = 13 + Dex when unarmored
      hasUnarmoredACBonus = true;
      unarmoredAC = 13 + modifiers.dex;
    }
  });
  
  // Check if character has armor equipped and adjust AC accordingly
  const armorItems = expandedEquipment.filter(item => {
    const itemLower = item.toLowerCase();
    return itemLower.includes("armor") || itemLower.includes("leather") ||
           itemLower.includes("chain") || itemLower.includes("plate") ||
           itemLower.includes("scale") || itemLower.includes("splint") ||
           itemLower.includes("studded") || itemLower.includes("padded") ||
           itemLower.includes("hide") || itemLower.includes("breastplate") ||
           itemLower.includes("half plate") || itemLower.includes("ring mail") ||
           itemLower.includes("ringmail");
  });
  
  // Check for shield
  const hasShield = expandedEquipment.some(item => {
    const itemLower = item.toLowerCase();
    return itemLower.includes("shield");
  });
  
  if (armorItems.length > 0) {
    // Get armor AC from first armor item
    const firstArmor = armorItems[0].toLowerCase();
    if (firstArmor.includes("plate") && !firstArmor.includes("half")) {
      ac = 18; // Plate mail (no Dex modifier)
    } else if (firstArmor.includes("splint")) {
      ac = 17; // Splint mail (no Dex modifier)
    } else if ((firstArmor.includes("chain") && firstArmor.includes("mail")) || firstArmor.includes("chainmail")) {
      ac = 16; // Chain mail (no Dex modifier)
    } else if (firstArmor.includes("half plate") || firstArmor.includes("halfplate")) {
      ac = 15 + Math.min(modifiers.dex, 2); // Half plate (Dex max +2)
    } else if (firstArmor.includes("breastplate")) {
      ac = 14 + Math.min(modifiers.dex, 2); // Breastplate (Dex max +2)
    } else if (firstArmor.includes("scale")) {
      ac = 14 + Math.min(modifiers.dex, 2); // Scale mail (Dex max +2)
    } else if (firstArmor.includes("studded")) {
      ac = 12 + modifiers.dex; // Studded leather
    } else if (firstArmor.includes("hide")) {
      ac = 12 + Math.min(modifiers.dex, 2); // Hide armor (Dex max +2)
    } else if (firstArmor.includes("leather")) {
      ac = 11 + modifiers.dex; // Leather armor
    } else if (firstArmor.includes("padded")) {
      ac = 11 + modifiers.dex; // Padded armor
    } else if (firstArmor.includes("ring mail") || firstArmor.includes("ringmail")) {
      ac = 14; // Ring mail (no Dex modifier)
    } else {
      // Default: assume light armor
      ac = 11 + modifiers.dex;
    }
  }
  
  // Add shield bonus
  if (hasShield) {
    ac += 2;
  }
  
  // Check for Mage Armor spell (AC = 13 + Dex modifier)
  const hasMageArmor = expandedEquipment.some(item => {
    const itemLower = item.toLowerCase();
    return itemLower.includes("mage armor") || itemLower.includes("magearmor");
  });
  if (hasMageArmor && armorItems.length === 0) {
    ac = 13 + modifiers.dex; // Mage Armor overrides unarmored AC
  } else if (armorItems.length === 0 && hasUnarmoredACBonus) {
    // Apply unarmored AC bonus from subclass feature if no armor
    ac = unarmoredAC;
  }

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
        // Fixed skill proficiency
        const skillName = skillProf;
        // Normalize skill name (handle case and spaces)
        const normalizedSkillName = skillName.toLowerCase().trim();
        const skillKey = Object.keys(skills).find(
          k => k.toLowerCase() === normalizedSkillName
        );
        if (skillKey) {
          skills[skillKey].proficient = true;
          const ability = getSkillAbility(skillKey);
          skills[skillKey].modifier = modifiers[ability] + proficiencyBonus;
        }
      } else if (typeof skillProf === "object") {
        // Object format: { "insight": true, "religion": true } or { "any": 2 }
        if (skillProf.any) {
          // Character should have chosen skills
          if (character.backgroundSkillChoices) {
            character.backgroundSkillChoices.forEach(skillName => {
              // Normalize skill name
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
        } else {
          // Object with skill names as keys: { "insight": true, "religion": true }
          Object.keys(skillProf).forEach(skillName => {
            if (skillProf[skillName] === true) {
              // Normalize skill name
              const normalizedSkillName = skillName.toLowerCase().trim();
              const skillKey = Object.keys(skills).find(
                k => k.toLowerCase() === normalizedSkillName
              );
              if (skillKey) {
                skills[skillKey].proficient = true;
                const ability = getSkillAbility(skillKey);
                skills[skillKey].modifier = modifiers[ability] + proficiencyBonus;
              }
            }
          });
        }
      } else if (skillProf.choose) {
        // Background with skill choices
        if (character.backgroundSkillChoices) {
          character.backgroundSkillChoices.forEach(skillName => {
            // Normalize skill name
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

  // Apply race skill proficiencies
  // First, apply from raceData.skillProficiencies (if any)
  if (raceData.skillProficiencies) {
    raceData.skillProficiencies.forEach((skillProf: any) => {
      if (typeof skillProf === "string") {
        const skillName = skillProf;
        // Normalize skill name (handle case and spaces)
        const normalizedSkillName = skillName.toLowerCase().trim();
        const skillKey = Object.keys(skills).find(
          k => k.toLowerCase() === normalizedSkillName
        );
        if (skillKey) {
          skills[skillKey].proficient = true;
          const ability = getSkillAbility(skillKey);
          skills[skillKey].modifier = modifiers[ability] + proficiencyBonus;
        }
      } else if (skillProf.any) {
        // Character should have chosen skills
        if (character.raceSkillChoices) {
          character.raceSkillChoices.forEach(skillName => {
            // Normalize skill name
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
  
  // Apply from character.raceSkillChoices (for races that require choices)
  if (character.raceSkillChoices) {
    character.raceSkillChoices.forEach(skillName => {
      // Normalize skill name
      const normalizedSkillName = skillName.toLowerCase().trim();
      const skillKey = Object.keys(skills).find(
        k => k.toLowerCase() === normalizedSkillName
      );
      if (skillKey) {
        // Only apply if not already proficient (avoid double counting)
        if (!skills[skillKey].proficient) {
          skills[skillKey].proficient = true;
          const ability = getSkillAbility(skillKey);
          skills[skillKey].modifier = modifiers[ability] + proficiencyBonus;
        }
      }
    });
  }
  
  // Apply subrace skill proficiencies (if any)
  if (subraceData?.skillProficiencies) {
    subraceData.skillProficiencies.forEach((skillProf: any) => {
      if (typeof skillProf === "string") {
        const skillName = skillProf;
        // Normalize skill name
        const normalizedSkillName = skillName.toLowerCase().trim();
        const skillKey = Object.keys(skills).find(
          k => k.toLowerCase() === normalizedSkillName
        );
        if (skillKey) {
          skills[skillKey].proficient = true;
          const ability = getSkillAbility(skillKey);
          skills[skillKey].modifier = modifiers[ability] + proficiencyBonus;
        }
      }
    });
  }

  // Passive Perception
  const passivePerception = 10 + (skills["Perception"]?.modifier || modifiers.wis);

  // Tool Proficiencies
  const toolProficiencies: string[] = [];
  
  // From race
  if (raceData.toolProficiencies) {
    raceData.toolProficiencies.forEach((toolProf: any) => {
      if (typeof toolProf === "string") {
        if (!toolProficiencies.includes(toolProf)) {
          toolProficiencies.push(toolProf);
        }
      } else if (toolProf.choose) {
        // Tool choice from race
        if (character.raceToolChoice && !toolProficiencies.includes(character.raceToolChoice)) {
          toolProficiencies.push(character.raceToolChoice);
        }
      }
    });
  }
  
  // From subrace
  if (subraceData?.toolProficiencies) {
    subraceData.toolProficiencies.forEach((toolProf: any) => {
      if (typeof toolProf === "string") {
        if (!toolProficiencies.includes(toolProf)) {
          toolProficiencies.push(toolProf);
        }
      }
    });
  }
  
  // From class
  if (classData.startingProficiencies?.tools) {
    classData.startingProficiencies.tools.forEach((tool: string) => {
      if (!toolProficiencies.includes(tool)) {
        toolProficiencies.push(tool);
      }
    });
  }
  
  // From background
  if (backgroundData?.toolProficiencies) {
    backgroundData.toolProficiencies.forEach((toolProf: any) => {
      if (typeof toolProf === "string") {
        if (!toolProficiencies.includes(toolProf)) {
          toolProficiencies.push(toolProf);
        }
      } else if (toolProf.choose) {
        // Tool choice from background
        if (character.backgroundToolChoices) {
          character.backgroundToolChoices.forEach((tool: string) => {
            if (!toolProficiencies.includes(tool)) {
              toolProficiencies.push(tool);
            }
          });
        }
      }
    });
  }

  // Languages
  const languages: string[] = [];
  
  // From race
  if (raceData.languageProficiencies) {
    raceData.languageProficiencies.forEach((langProf: any) => {
      if (typeof langProf === "string") {
        if (!languages.includes(langProf)) {
          languages.push(langProf);
        }
      } else if (langProf.choose) {
        // Language choice from race
        if (character.raceLanguageChoices) {
          character.raceLanguageChoices.forEach((lang: string) => {
            if (!languages.includes(lang)) {
              languages.push(lang);
            }
          });
        }
      }
    });
  }
  
  // From subrace
  if (subraceData?.languageProficiencies) {
    subraceData.languageProficiencies.forEach((langProf: any) => {
      if (typeof langProf === "string") {
        if (!languages.includes(langProf)) {
          languages.push(langProf);
        }
      }
    });
  }
  
  // From background
  if (backgroundData?.languageProficiencies) {
    backgroundData.languageProficiencies.forEach((langProf: any) => {
      if (typeof langProf === "string") {
        if (!languages.includes(langProf)) {
          languages.push(langProf);
        }
      } else if (langProf.choose) {
        // Language choice from background
        if (character.backgroundLanguageChoices) {
          character.backgroundLanguageChoices.forEach((lang: string) => {
            if (!languages.includes(lang)) {
              languages.push(lang);
            }
          });
        }
      }
    });
  }

  // Damage Resistances
  const resistances: string[] = [];
  
  // From race
  if (raceData.resist) {
    if (Array.isArray(raceData.resist)) {
      raceData.resist.forEach((res: string) => {
        if (!resistances.includes(res)) {
          resistances.push(res);
        }
      });
    } else if (typeof raceData.resist === "string") {
      if (!resistances.includes(raceData.resist)) {
        resistances.push(raceData.resist);
      }
    }
  }
  
  // From subrace
  if (subraceData?.resist) {
    if (Array.isArray(subraceData.resist)) {
      subraceData.resist.forEach((res: string) => {
        if (!resistances.includes(res)) {
          resistances.push(res);
        }
      });
    } else if (typeof subraceData.resist === "string") {
      if (!resistances.includes(subraceData.resist)) {
        resistances.push(subraceData.resist);
      }
    }
  }
  
  // From subclass choices (e.g., Draconic Sorcerer fire resistance)
  if (character.subclass && character.subclassChoices) {
    // Check for Draconic Ancestry choice
    const draconicAncestry = character.subclassChoices["Dragon Ancestor_Dragon Ancestor"] || 
                             character.subclassChoices["Dragon Ancestor"];
    
    if (draconicAncestry) {
      // Map dragon type to damage resistance
      const dragonResistanceMap: Record<string, string> = {
        "Black": "acid",
        "Blue": "lightning",
        "Brass": "fire",
        "Bronze": "lightning",
        "Copper": "acid",
        "Gold": "fire",
        "Green": "poison",
        "Red": "fire",
        "Silver": "cold",
        "White": "cold"
      };
      
      const resistance = dragonResistanceMap[draconicAncestry];
      if (resistance && !resistances.includes(resistance)) {
        resistances.push(resistance);
      }
    }
    
    // Check for Elemental Affinity feature (level 6) - grants resistance when spending sorcery points
    // This is conditional, so we might want to note it differently, but for now we'll add it
    // Actually, Elemental Affinity only grants resistance when spending sorcery points, not permanent
    // So we won't add it to permanent resistances
  }

  // Calculate weapons (attack bonus and damage)
  const weapons: Array<{
    name: string;
    attackBonus: number;
    damage: string;
    damageType: string;
  }> = [];
  
  // Weapon damage types and dice mapping
  const weaponDamageMap: Record<string, { dice: string; type: string; ability: string }> = {
    "club": { dice: "1d4", type: "bludgeoning", ability: "str" },
    "dagger": { dice: "1d4", type: "piercing", ability: "str/dex" },
    "greatclub": { dice: "1d8", type: "bludgeoning", ability: "str" },
    "handaxe": { dice: "1d6", type: "slashing", ability: "str" },
    "javelin": { dice: "1d6", type: "piercing", ability: "str" },
    "light hammer": { dice: "1d4", type: "bludgeoning", ability: "str" },
    "mace": { dice: "1d6", type: "bludgeoning", ability: "str" },
    "quarterstaff": { dice: "1d6", type: "bludgeoning", ability: "str" },
    "sickle": { dice: "1d4", type: "slashing", ability: "str" },
    "spear": { dice: "1d6", type: "piercing", ability: "str" },
    "unarmed strike": { dice: "1", type: "bludgeoning", ability: "str" },
    "light crossbow": { dice: "1d8", type: "piercing", ability: "dex" },
    "dart": { dice: "1d4", type: "piercing", ability: "str/dex" },
    "shortbow": { dice: "1d6", type: "piercing", ability: "dex" },
    "sling": { dice: "1d4", type: "bludgeoning", ability: "dex" },
    "battleaxe": { dice: "1d8", type: "slashing", ability: "str" },
    "flail": { dice: "1d8", type: "bludgeoning", ability: "str" },
    "glaive": { dice: "1d10", type: "slashing", ability: "str" },
    "greataxe": { dice: "1d12", type: "slashing", ability: "str" },
    "greatsword": { dice: "2d6", type: "slashing", ability: "str" },
    "halberd": { dice: "1d10", type: "slashing", ability: "str" },
    "lance": { dice: "1d12", type: "piercing", ability: "str" },
    "longsword": { dice: "1d8", type: "slashing", ability: "str" },
    "maul": { dice: "2d6", type: "bludgeoning", ability: "str" },
    "morningstar": { dice: "1d8", type: "piercing", ability: "str" },
    "pike": { dice: "1d10", type: "piercing", ability: "str" },
    "rapier": { dice: "1d8", type: "piercing", ability: "str/dex" },
    "scimitar": { dice: "1d6", type: "slashing", ability: "str/dex" },
    "shortsword": { dice: "1d6", type: "piercing", ability: "str/dex" },
    "trident": { dice: "1d6", type: "piercing", ability: "str" },
    "war pick": { dice: "1d8", type: "piercing", ability: "str" },
    "warhammer": { dice: "1d8", type: "bludgeoning", ability: "str" },
    "whip": { dice: "1d4", type: "slashing", ability: "str/dex" },
    "blowgun": { dice: "1", type: "piercing", ability: "dex" },
    "hand crossbow": { dice: "1d6", type: "piercing", ability: "dex" },
    "heavy crossbow": { dice: "1d10", type: "piercing", ability: "dex" },
    "longbow": { dice: "1d8", type: "piercing", ability: "dex" },
    "net": { dice: "0", type: "special", ability: "dex" }
  };
  
  // Find weapons in equipment
  const weaponItems = expandedEquipment.filter(item => {
    if (item.startsWith("  └─")) return false; // Skip pack contents
    const itemLower = item.toLowerCase().trim();
    
    // Skip obvious non-weapons
    if (itemLower.includes("armor") || itemLower.includes("clothes") || 
        itemLower.includes("pouch") || itemLower.includes("pack") ||
        itemLower.includes("letter") || itemLower.includes("scroll") ||
        itemLower.includes("kit") || itemLower.includes("book") ||
        itemLower.includes("bolts") || itemLower.includes("arrows") ||
        itemLower.includes("component")) {
      return false;
    }
    
    // Check if it's a weapon
    return itemLower.includes("sword") || itemLower.includes("axe") || 
           itemLower.includes("bow") || itemLower.includes("crossbow") ||
           itemLower.includes("mace") || itemLower.includes("dagger") ||
           itemLower.includes("spear") || itemLower.includes("staff") ||
           itemLower.includes("whip") || itemLower.includes("hammer") ||
           itemLower.includes("flail") || itemLower.includes("rapier") ||
           itemLower.includes("scimitar") || itemLower.includes("warhammer") ||
           itemLower.includes("lance") || itemLower.includes("trident") ||
           itemLower.includes("halberd") || itemLower.includes("glaive") ||
           itemLower.includes("sickle") || itemLower.includes("club") ||
           itemLower.includes("quarterstaff") || itemLower.includes("dart") ||
           itemLower.includes("sling") || itemLower.includes("blowgun");
  });
  
  // Calculate weapon stats
  weaponItems.slice(0, 3).forEach(weapon => {
    const weaponLower = weapon.toLowerCase().trim();
    const cleanWeaponName = weaponLower.replace(/\s*\([^)]*\)\s*/g, "").trim();
    
    // Normalize weapon name
    let normalizedWeapon = cleanWeaponName;
    if (normalizedWeapon.includes("crossbow")) {
      if (weaponLower.includes("heavy") || cleanWeaponName.endsWith(" b")) {
        normalizedWeapon = "heavy crossbow";
      } else if (weaponLower.includes("light") || cleanWeaponName.endsWith("t")) {
        normalizedWeapon = "light crossbow";
      } else if (weaponLower.includes("hand")) {
        normalizedWeapon = "hand crossbow";
      } else {
        normalizedWeapon = "light crossbow";
      }
    }
    if (normalizedWeapon.includes("dagger")) {
      normalizedWeapon = "dagger";
    }
    
    // Find weapon data
    let weaponData = null;
    for (const [weaponKey, data] of Object.entries(weaponDamageMap)) {
      if (normalizedWeapon === weaponKey || normalizedWeapon.includes(weaponKey) || weaponKey.includes(normalizedWeapon)) {
        weaponData = data;
        break;
      }
    }
    
    // If no match, try with original weaponLower
    if (!weaponData) {
      for (const [weaponKey, data] of Object.entries(weaponDamageMap)) {
        const cleaned = weaponLower.replace(/\s*\([^)]*\)\s*/g, "").trim();
        if (cleaned.includes(weaponKey) || weaponKey.includes(cleaned)) {
          weaponData = data;
          break;
        }
      }
    }
    
    // Determine ability modifier to use
    let weaponMod = modifiers.str;
    if (weaponData) {
      if (weaponData.ability === "dex") {
        weaponMod = modifiers.dex;
      } else if (weaponData.ability === "str/dex") {
        weaponMod = Math.max(modifiers.str, modifiers.dex); // Finesse - use higher
      }
    }
    
    const attackBonus = weaponMod + proficiencyBonus;
    const damage = weaponData ? weaponData.dice : "1d6";
    const damageType = weaponData ? weaponData.type : "slashing";
    
    weapons.push({
      name: weapon.split("(")[0].trim(), // Remove quantity if present
      attackBonus,
      damage,
      damageType,
    });
  });
  
  // Calculate spellcasting stats (if spellcaster)
  let spellSlots: Record<string, { total: number; used: number }> | undefined = undefined;
  let spellSaveDC: number | undefined = undefined;
  let spellAttackBonus: number | undefined = undefined;
  let spellcastingAbility: string | undefined = undefined;
  
  const classNameLower = character.className?.toLowerCase() || "";
  const isSpellcaster = ["wizard", "sorcerer", "warlock", "cleric", "druid", 
                        "bard", "ranger", "paladin"].includes(classNameLower);
  
  if (isSpellcaster) {
    // Determine spellcasting ability
    const spellcastingAbilityMap: Record<string, string> = {
      "wizard": "int", "sorcerer": "cha", "warlock": "cha",
      "cleric": "wis", "druid": "wis", "bard": "cha",
      "ranger": "wis", "paladin": "cha"
    };
    
    spellcastingAbility = spellcastingAbilityMap[classNameLower] || "int";
    const abilityScore = abilityScores[spellcastingAbility as AbilityKey] || 10;
    const abilityMod = Math.floor((abilityScore - 10) / 2);
    spellSaveDC = 8 + abilityMod + proficiencyBonus;
    spellAttackBonus = abilityMod + proficiencyBonus;
    
    // Calculate spell slots
    spellSlots = {};
    if (["wizard", "cleric", "druid", "bard", "sorcerer"].includes(classNameLower)) {
      // Full caster
      const fullCasterSlots: Record<number, number[]> = {
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
        const slots = levelSlots[i - 1] || 0;
        if (slots > 0) {
          spellSlots[`level${i}`] = { total: slots, used: 0 };
        }
      }
    } else if (["ranger", "paladin"].includes(classNameLower)) {
      // Half caster
      const halfCasterLevel = Math.ceil(level / 2);
      const halfCasterSlots: Record<number, number[]> = {
        1: [0,0,0,0,0], 2: [2,0,0,0,0], 3: [3,0,0,0,0], 4: [3,0,0,0,0],
        5: [4,2,0,0,0], 6: [4,2,0,0,0], 7: [4,3,0,0,0], 8: [4,3,0,0,0],
        9: [4,3,2,0,0], 10: [4,3,2,0,0], 11: [4,3,3,0,0], 12: [4,3,3,0,0],
        13: [4,3,3,1,0], 14: [4,3,3,1,0], 15: [4,3,3,2,0], 16: [4,3,3,2,0],
        17: [4,3,3,3,1], 18: [4,3,3,3,1], 19: [4,3,3,3,2], 20: [4,3,3,3,2]
      };
      const levelSlots = halfCasterSlots[Math.min(halfCasterLevel, 20)] || [0,0,0,0,0];
      for (let i = 1; i <= 5; i++) {
        const slots = levelSlots[i - 1] || 0;
        if (slots > 0) {
          spellSlots[`level${i}`] = { total: slots, used: 0 };
        }
      }
    } else if (classNameLower === "warlock") {
      // Warlock (Pact Magic)
      const warlockSlots: Record<number, number> = {
        1:1, 2:2, 3:2, 4:2, 5:2, 6:2, 7:2, 8:2, 9:2, 10:2, 
        11:3, 12:3, 13:3, 14:3, 15:3, 16:3, 17:4, 18:4, 19:4, 20:4
      };
      const numSlots = warlockSlots[Math.min(level, 20)] || 0;
      const slotLevel = Math.min(Math.ceil(level / 2), 5);
      if (numSlots > 0) {
        spellSlots[`level${slotLevel}`] = { total: numSlots, used: 0 };
      }
    }
  }

  return {
    ac,
    initiative,
    speed,
    passivePerception,
    proficiencyBonus,
    abilityModifiers: modifiers,
    savingThrows,
    hp,
    hpCurrent: maxHp, // Start at max HP
    hpMax: maxHp,
    maxHp,
    hitDie: `1d${hitDie}`,
    hitDice: `1d${hitDie}`,
    skills,
    toolProficiencies: toolProficiencies.length > 0 ? toolProficiencies : undefined,
    resistances: resistances.length > 0 ? resistances : undefined,
    languages: languages.length > 0 ? languages : undefined,
    expandedEquipment,
    weapons: weapons.length > 0 ? weapons : undefined,
    spellSlots,
    spellSaveDC,
    spellAttackBonus,
    spellcastingAbility,
    subclassFeatures: activeSubclassFeatures.length > 0 ? activeSubclassFeatures : undefined,
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

