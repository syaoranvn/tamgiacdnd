import { useState, useEffect } from "react";
import type { Race, Subrace } from "../../types";
import { parseText } from "../../utils/textParser";
import TextWithTooltips from "../TextWithTooltips";
import { apiUrl } from "../../config/api";

interface Step1RaceProps {
  races: Race[];
  selectedRace?: string;
  selectedSubrace?: string;
  raceAbilityChoices?: string[]; // Array of ability keys chosen (e.g., ["str", "dex"])
  raceSkillChoices?: string[]; // Array of skill names chosen
  raceFeatChoices?: string[]; // Array of feat names chosen
  raceLanguageChoices?: string[]; // Array of language names chosen
  raceResistanceChoice?: string; // Chosen damage resistance type
  raceToolChoice?: string; // Chosen tool proficiency
  raceDraconicAncestry?: string; // Chosen draconic ancestry
  onSelectRace: (race: string) => void;
  onSelectSubrace: (subrace: string) => void;
  onSelectAbilityChoices?: (choices: string[]) => void;
  onSelectSkillChoices?: (choices: string[]) => void;
  onSelectFeatChoices?: (choices: string[]) => void;
  onSelectLanguageChoices?: (choices: string[]) => void;
  onSelectResistanceChoice?: (choice: string) => void;
  onSelectToolChoice?: (choice: string) => void;
  onSelectDraconicAncestry?: (choice: string) => void;
}

interface Skill {
  name: string;
  ability?: string | string[];
  [key: string]: any;
}

interface Feat {
  name: string;
  source: string;
  [key: string]: any;
}

interface Language {
  name: string;
  source: string;
  type?: string;
  [key: string]: any;
}

export default function Step1Race({
  races,
  selectedRace,
  selectedSubrace,
  raceAbilityChoices = [],
  raceSkillChoices = [],
  raceFeatChoices = [],
  raceLanguageChoices = [],
  raceResistanceChoice,
  raceToolChoice,
  raceDraconicAncestry,
  onSelectRace,
  onSelectSubrace,
  onSelectAbilityChoices,
  onSelectSkillChoices,
  onSelectFeatChoices,
  onSelectLanguageChoices,
  onSelectResistanceChoice,
  onSelectToolChoice,
  onSelectDraconicAncestry,
}: Step1RaceProps) {
  const [selectedRaceData, setSelectedRaceData] = useState<Race | null>(null);
  const [subraces, setSubraces] = useState<Subrace[]>([]);
  const [selectedSubraceData, setSelectedSubraceData] = useState<Subrace | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loadingSubraces, setLoadingSubraces] = useState(false);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [allFeats, setAllFeats] = useState<Feat[]>([]);
  const [allLanguages, setAllLanguages] = useState<Language[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [loadingFeats, setLoadingFeats] = useState(false);
  const [loadingLanguages, setLoadingLanguages] = useState(false);

  useEffect(() => {
    if (selectedRace) {
      const race = races.find((r) => r.name === selectedRace);
      setSelectedRaceData(race || null);
      loadSubraces(selectedRace);
    } else {
      setSelectedRaceData(null);
      setSubraces([]);
      setSelectedSubraceData(null);
    }
  }, [selectedRace, races]);

  useEffect(() => {
    if (selectedSubrace && subraces.length > 0) {
      const subrace = subraces.find((s) => (s.name || "Standard Human") === selectedSubrace);
      setSelectedSubraceData(subrace || null);
    } else {
      setSelectedSubraceData(null);
    }
  }, [selectedSubrace, subraces]);

  // Load skills, feats, and languages when needed
  useEffect(() => {
    const needsSkills = selectedSubraceData?.skillProficiencies?.some(
      (sp: any) => sp.any !== undefined
    ) || selectedRaceData?.skillProficiencies?.some(
      (sp: any) => sp.any !== undefined
    );
    
    const needsFeats = selectedSubraceData?.feats?.some(
      (f: any) => f.any !== undefined
    ) || selectedRaceData?.feats?.some(
      (f: any) => f.any !== undefined
    );

    const needsLanguages = selectedSubraceData?.languageProficiencies?.some(
      (lp: any) => lp.anyStandard !== undefined || lp.any !== undefined
    ) || selectedRaceData?.languageProficiencies?.some(
      (lp: any) => lp.anyStandard !== undefined || lp.any !== undefined
    );

    if (needsSkills && allSkills.length === 0) {
      loadSkills();
    }
    if (needsFeats && allFeats.length === 0) {
      loadFeats();
    }
    if (needsLanguages && allLanguages.length === 0) {
      loadLanguages();
    }
  }, [selectedRaceData, selectedSubraceData]);

  const loadSkills = async () => {
    try {
      setLoadingSkills(true);
      const response = await fetch(apiUrl("api/data/skills"));
      if (response.ok) {
        const data = await response.json();
        setAllSkills(data);
      }
    } catch (error) {
      console.error("Error loading skills:", error);
    } finally {
      setLoadingSkills(false);
    }
  };

  const loadFeats = async () => {
    try {
      setLoadingFeats(true);
      const response = await fetch(apiUrl("api/data/feats/phb"));
      if (response.ok) {
        const data = await response.json();
        setAllFeats(data);
      }
    } catch (error) {
      console.error("Error loading feats:", error);
    } finally {
      setLoadingFeats(false);
    }
  };

  const loadLanguages = async () => {
    try {
      setLoadingLanguages(true);
      const response = await fetch(apiUrl("api/data/languages/standard"));
      if (response.ok) {
        const data = await response.json();
        setAllLanguages(data);
      }
    } catch (error) {
      console.error("Error loading languages:", error);
    } finally {
      setLoadingLanguages(false);
    }
  };

  const loadSubraces = async (raceName: string) => {
    try {
      setLoadingSubraces(true);
      const response = await fetch(
        apiUrl(`api/data/races/${raceName}/subraces`)
      );
      if (response.ok) {
        const data = await response.json();
        // Filter out entries without names (they might be variant rules)
        const validSubraces = data.filter((s: Subrace) => s.name && s.name.trim() !== "");
        setSubraces(validSubraces);
        // Reset subrace selection if current subrace is not available
        if (selectedSubrace && !validSubraces.find((s: Subrace) => s.name === selectedSubrace)) {
          onSelectSubrace("");
        }
      } else {
        setSubraces([]);
      }
    } catch (error) {
      console.error("Error loading subraces:", error);
      setSubraces([]);
    } finally {
      setLoadingSubraces(false);
    }
  };

  const handleRaceSelect = (raceName: string) => {
    onSelectRace(raceName);
    onSelectSubrace(""); // Reset subrace when race changes
  };

  const getSpeed = (speed: number | { walk: number } | undefined) => {
    if (typeof speed === "number") return speed;
    if (speed && typeof speed === "object" && "walk" in speed) return speed.walk;
    return 30;
  };

  const getAbilityBonuses = (ability: Race["ability"] | Subrace["ability"]) => {
    if (!ability || ability.length === 0) return [];
    const abilityData = ability[0];
    
    // Handle "choose" case (variant human)
    if (abilityData.choose && abilityData.choose.from && abilityData.choose.count) {
      return [{ 
        key: "choose", 
        value: abilityData.choose.count,
        from: abilityData.choose.from 
      }];
    }
    
    // Handle fixed bonuses
    return Object.entries(abilityData)
      .filter(([key, value]) => key !== "choose" && typeof value === "number" && value > 0)
      .map(([key, value]) => ({ key: key as any, value }));
  };
  
  const formatAbilityBonuses = (bonuses: ReturnType<typeof getAbilityBonuses>) => {
    if (bonuses.length === 0) return "";
    
    // Check if it's a "choose" type
    const chooseBonus = bonuses.find(b => b.key === "choose");
    if (chooseBonus && chooseBonus.from) {
      return `Chọn ${chooseBonus.value} chỉ số từ: ${chooseBonus.from.map((a: string) => a.toUpperCase()).join(", ")}`;
    }
    
    // Format fixed bonuses
    return bonuses.map((b) => `${b.key.toUpperCase()} +${b.value}`).join(", ");
  };
  
  // Check if race/subrace has ability choices (prioritize subrace, then race)
  const getAbilityChoice = (): { count: number; from: string[] } | null => {
    // Check subrace first
    if (selectedSubraceData?.ability && selectedSubraceData.ability.length > 0) {
      const abilityData = selectedSubraceData.ability[0];
      if (abilityData.choose && abilityData.choose.from && abilityData.choose.count) {
        return {
          count: abilityData.choose.count,
          from: abilityData.choose.from,
        };
      }
    }
    
    // Then check race
    if (selectedRaceData?.ability && selectedRaceData.ability.length > 0) {
      const abilityData = selectedRaceData.ability[0];
      if (abilityData.choose && abilityData.choose.from && abilityData.choose.count) {
        return {
          count: abilityData.choose.count,
          from: abilityData.choose.from,
        };
      }
    }
    
    return null;
  };
  
  const abilityChoice = getAbilityChoice();
  
  const handleAbilityChoiceToggle = (abilityKey: string) => {
    if (!onSelectAbilityChoices || !abilityChoice) return;
    
    const currentChoices = [...raceAbilityChoices];
    const index = currentChoices.indexOf(abilityKey);
    
    if (index > -1) {
      // Remove if already selected
      currentChoices.splice(index, 1);
    } else {
      // Add if not selected and under limit
      if (currentChoices.length < abilityChoice.count) {
        currentChoices.push(abilityKey);
      }
    }
    
    onSelectAbilityChoices(currentChoices);
  };
  
  const abilityLabels: Record<string, string> = {
    str: "STR (Sức mạnh)",
    dex: "DEX (Nhanh nhẹn)",
    con: "CON (Thể chất)",
    int: "INT (Thông minh)",
    wis: "WIS (Khôn ngoan)",
    cha: "CHA (Cuốn hút)",
  };

  // Check if race/subrace has skill choices (prioritize subrace)
  const getSkillChoice = (): { count: number } | null => {
    // Check subrace first
    if (selectedSubraceData?.skillProficiencies) {
      const subraceSkillChoice = selectedSubraceData.skillProficiencies.find(
        (sp: any) => sp.any !== undefined
      );
      if (subraceSkillChoice && subraceSkillChoice.any) {
        return { count: subraceSkillChoice.any };
      }
    }
    
    // Then check race
    if (selectedRaceData?.skillProficiencies) {
      const raceSkillChoice = selectedRaceData.skillProficiencies.find(
        (sp: any) => sp.any !== undefined
      );
      if (raceSkillChoice && raceSkillChoice.any) {
        return { count: raceSkillChoice.any };
      }
    }
    
    return null;
  };

  // Check if race/subrace has feat choices (prioritize subrace)
  const getFeatChoice = (): { count: number } | null => {
    // Check subrace first
    if (selectedSubraceData?.feats) {
      const subraceFeatChoice = selectedSubraceData.feats.find(
        (f: any) => f.any !== undefined
      );
      if (subraceFeatChoice && subraceFeatChoice.any) {
        return { count: subraceFeatChoice.any };
      }
    }
    
    // Then check race
    if (selectedRaceData?.feats) {
      const raceFeatChoice = selectedRaceData.feats.find(
        (f: any) => f.any !== undefined
      );
      if (raceFeatChoice && raceFeatChoice.any) {
        return { count: raceFeatChoice.any };
      }
    }
    
    return null;
  };

  const skillChoice = getSkillChoice();
  const featChoice = getFeatChoice();

  const handleSkillChoiceChange = (skillName: string) => {
    if (!onSelectSkillChoices || !skillChoice) return;
    
    const currentChoices = [...raceSkillChoices];
    const index = currentChoices.indexOf(skillName);
    
    if (index > -1) {
      currentChoices.splice(index, 1);
    } else {
      if (currentChoices.length < skillChoice.count) {
        currentChoices.push(skillName);
      }
    }
    
    onSelectSkillChoices(currentChoices);
  };

  const handleFeatChoiceChange = (featName: string) => {
    if (!onSelectFeatChoices || !featChoice) return;
    
    const currentChoices = [...raceFeatChoices];
    const index = currentChoices.indexOf(featName);
    
    if (index > -1) {
      currentChoices.splice(index, 1);
    } else {
      if (currentChoices.length < featChoice.count) {
        currentChoices.push(featName);
      }
    }
    
    onSelectFeatChoices(currentChoices);
  };

  // Check if race/subrace has language choices (prioritize subrace)
  const getLanguageChoice = (): { count: number } | null => {
    // Check subrace first
    if (selectedSubraceData?.languageProficiencies) {
      const subraceLangChoice = selectedSubraceData.languageProficiencies.find(
        (lp: any) => lp.anyStandard !== undefined || lp.any !== undefined
      );
      if (subraceLangChoice) {
        const count = subraceLangChoice.anyStandard || subraceLangChoice.any || 0;
        if (count > 0) {
          return { count };
        }
      }
    }
    
    // Then check race
    if (selectedRaceData?.languageProficiencies) {
      const raceLangChoice = selectedRaceData.languageProficiencies.find(
        (lp: any) => lp.anyStandard !== undefined || lp.any !== undefined
      );
      if (raceLangChoice) {
        const count = raceLangChoice.anyStandard || raceLangChoice.any || 0;
        if (count > 0) {
          return { count };
        }
      }
    }
    
    return null;
  };

  const languageChoice = getLanguageChoice();

  const handleLanguageChoiceChange = (languageName: string) => {
    if (!onSelectLanguageChoices || !languageChoice) return;
    
    const currentChoices = [...raceLanguageChoices];
    const index = currentChoices.indexOf(languageName);
    
    if (index > -1) {
      currentChoices.splice(index, 1);
    } else {
      if (currentChoices.length < languageChoice.count) {
        currentChoices.push(languageName);
      }
    }
    
    onSelectLanguageChoices(currentChoices);
  };

  // Check if race/subrace has resistance choice
  const getResistanceChoice = (): { from: string[] } | null => {
    // Check subrace first
    if (selectedSubraceData?.resist) {
      const subraceResist = selectedSubraceData.resist.find(
        (r: any) => r && typeof r === "object" && r.choose
      );
      if (subraceResist?.choose?.from) {
        return { from: subraceResist.choose.from };
      }
    }
    
    // Then check race
    if (selectedRaceData?.resist) {
      const raceResist = selectedRaceData.resist.find(
        (r: any) => r && typeof r === "object" && r.choose
      );
      if (raceResist?.choose?.from) {
        return { from: raceResist.choose.from };
      }
    }
    
    return null;
  };

  // Check if race/subrace has tool choice
  const getToolChoice = (): { from: string[] } | null => {
    // Check subrace first
    if (selectedSubraceData?.toolProficiencies) {
      const subraceTool = selectedSubraceData.toolProficiencies.find(
        (tp: any) => tp && typeof tp === "object" && tp.choose
      );
      if (subraceTool?.choose?.from) {
        return { from: subraceTool.choose.from };
      }
    }
    
    // Then check race
    if (selectedRaceData?.toolProficiencies) {
      const raceTool = selectedRaceData.toolProficiencies.find(
        (tp: any) => tp && typeof tp === "object" && tp.choose
      );
      if (raceTool?.choose?.from) {
        return { from: raceTool.choose.from };
      }
    }
    
    return null;
  };

  // Check if race has Draconic Ancestry (Dragonborn)
  const getDraconicAncestryOptions = (): string[] | null => {
    if (selectedRaceData?.name === "Dragonborn" || selectedSubraceData?.raceName === "Dragonborn") {
      // Standard draconic ancestry options
      return ["Black", "Blue", "Brass", "Bronze", "Copper", "Gold", "Green", "Red", "Silver", "White"];
    }
    return null;
  };

  const resistanceChoice = getResistanceChoice();
  const toolChoice = getToolChoice();
  const draconicAncestryOptions = getDraconicAncestryOptions();

  const formatEntry = (entry: any): string => {
    if (typeof entry === "string") return parseText(entry);
    if (entry && typeof entry === "object") {
      if (Array.isArray(entry.entries)) {
        return entry.entries.map((e: any) => formatEntry(e)).join(" ");
      }
      if (entry.name) return entry.name;
    }
    return "";
  };

  const getAllEntries = (entries: any[]): any[] => {
    if (!entries) return [];
    return entries.filter((e) => e && typeof e === "object" && e.name);
  };

  return (
    <div>
      <h2 className="mb-4 font-display text-2xl text-ink">Bước 1: Chọn chủng tộc</h2>
      <p className="mb-6 text-slate-600">
        Chủng tộc xác định ngoại hình và tài năng tự nhiên của nhân vật. Mỗi chủng tộc
        có các đặc điểm riêng và tăng chỉ số khả năng.
      </p>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Chọn chủng tộc *
          </label>
          <select
            value={selectedRace || ""}
            onChange={(e) => handleRaceSelect(e.target.value)}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            required
          >
            <option value="">-- Chọn chủng tộc --</option>
            {races.map((race) => (
              <option key={race.name} value={race.name}>
                {race.name}
              </option>
            ))}
          </select>
        </div>

        {selectedRaceData && subraces.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Chọn chủng tộc phụ (Subrace)
            </label>
            {loadingSubraces ? (
              <div className="text-sm text-slate-500">Đang tải...</div>
            ) : (
              <select
                value={selectedSubrace || ""}
                onChange={(e) => onSelectSubrace(e.target.value)}
                className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
              >
                <option value="">-- Không chọn (tùy chọn) --</option>
                {subraces.map((subrace) => (
                  <option key={subrace.name || "Standard Human"} value={subrace.name || "Standard Human"}>
                    {subrace.name || "Standard Human"}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {selectedRaceData && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-6">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="font-display text-xl text-ink">
                {selectedRaceData.name}
                {selectedSubraceData && ` (${selectedSubraceData.name})`}
              </h3>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-amber-700 underline-offset-2 hover:underline"
              >
                {showDetails ? "Ẩn chi tiết" : "Xem chi tiết"}
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-slate-700">Kích thước:</span>{" "}
                {selectedRaceData.size?.join(", ") || "Medium"}
              </div>
              <div>
                <span className="font-medium text-slate-700">Tốc độ:</span>{" "}
                {getSpeed(selectedRaceData.speed)} feet
              </div>
              {selectedRaceData.ability && selectedRaceData.ability.length > 0 && (
                <div>
                  <span className="font-medium text-slate-700">Tăng chỉ số (Race):</span>{" "}
                  <span className="text-slate-600">
                    {formatAbilityBonuses(getAbilityBonuses(selectedRaceData.ability))}
                  </span>
                </div>
              )}
              {selectedSubraceData?.ability &&
                selectedSubraceData.ability.length > 0 && (
                  <div>
                    <span className="font-medium text-slate-700">
                      Tăng chỉ số (Subrace):
                    </span>{" "}
                    <span className="text-slate-600">
                      {formatAbilityBonuses(getAbilityBonuses(selectedSubraceData.ability))}
                    </span>
                  </div>
                )}
              {/* Show combined ability score increases */}
              {((selectedRaceData.ability && selectedRaceData.ability.length > 0) ||
                (selectedSubraceData?.ability && selectedSubraceData.ability.length > 0)) && (
                <div className="pt-2 border-t border-amber-200">
                  <span className="font-semibold text-slate-800">Tổng tăng chỉ số:</span>{" "}
                  <span className="text-slate-700 font-medium">
                    {(() => {
                      const raceBonuses = selectedRaceData.ability 
                        ? getAbilityBonuses(selectedRaceData.ability) 
                        : [];
                      const subraceBonuses = selectedSubraceData?.ability 
                        ? getAbilityBonuses(selectedSubraceData.ability) 
                        : [];
                      
                      // If either has "choose", show that
                      const chooseBonus = [...raceBonuses, ...subraceBonuses].find(b => b.key === "choose");
                      if (chooseBonus && chooseBonus.from) {
                        return `Chọn ${chooseBonus.value} chỉ số từ: ${chooseBonus.from.map((a: string) => a.toUpperCase()).join(", ")}`;
                      }
                      
                      // Combine fixed bonuses
                      const combined: Record<string, number> = {};
                      [...raceBonuses, ...subraceBonuses].forEach(b => {
                        if (b.key !== "choose" && typeof b.value === "number") {
                          combined[b.key] = (combined[b.key] || 0) + b.value;
                        }
                      });
                      
                      const combinedList = Object.entries(combined)
                        .filter(([_, v]) => v > 0)
                        .map(([k, v]) => `${k.toUpperCase()} +${v}`);
                      
                      return combinedList.length > 0 ? combinedList.join(", ") : "Không có";
                    })()}
                  </span>
                </div>
              )}
              {selectedSubraceData?.darkvision && (
                <div>
                  <span className="font-medium text-slate-700">Darkvision:</span>{" "}
                  {selectedSubraceData.darkvision} feet
                </div>
              )}
              {selectedRaceData.darkvision && !selectedSubraceData?.darkvision && (
                <div>
                  <span className="font-medium text-slate-700">Darkvision:</span>{" "}
                  {selectedRaceData.darkvision} feet
                </div>
              )}
              
              {/* Fixed Resistances */}
              {(() => {
                const raceResist = selectedRaceData.resist || [];
                const subraceResist = selectedSubraceData?.resist || [];
                const fixedResists = [...raceResist, ...subraceResist].filter(
                  (r) => typeof r === "string"
                );
                if (fixedResists.length > 0) {
                  return (
                    <div>
                      <span className="font-medium text-slate-700">Kháng sát thương:</span>{" "}
                      <span className="text-slate-600">{fixedResists.join(", ")}</span>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* Fixed Skill Proficiencies */}
              {(() => {
                const raceSkills = selectedRaceData.skillProficiencies || [];
                const subraceSkills = selectedSubraceData?.skillProficiencies || [];
                const fixedSkills = [...raceSkills, ...subraceSkills]
                  .filter((sp: any) => {
                    // Only show fixed skills, not "any" choices
                    return typeof sp === "object" && !sp.any && !sp.choose;
                  })
                  .map((sp: any) => Object.keys(sp)[0])
                  .filter(Boolean);
                if (fixedSkills.length > 0) {
                  return (
                    <div>
                      <span className="font-medium text-slate-700">Kỹ năng:</span>{" "}
                      <span className="text-slate-600">
                        {fixedSkills.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* Weapon Proficiencies */}
              {(() => {
                const raceWeapons = selectedRaceData.weaponProficiencies || [];
                const subraceWeapons = selectedSubraceData?.weaponProficiencies || [];
                const allWeapons = [...raceWeapons, ...subraceWeapons];
                if (allWeapons.length > 0) {
                  const weaponList = allWeapons
                    .flatMap((wp: any) => Object.keys(wp || {}))
                    .map((w: string) => w.split("|")[0])
                    .filter(Boolean);
                  if (weaponList.length > 0) {
                    return (
                      <div>
                        <span className="font-medium text-slate-700">Thành thạo vũ khí:</span>{" "}
                        <span className="text-slate-600">
                          <TextWithTooltips text={weaponList.join(", ")} />
                        </span>
                      </div>
                    );
                  }
                }
                return null;
              })()}
              
              {/* Fixed Language Proficiencies */}
              {(() => {
                const raceLangs = selectedRaceData.languageProficiencies || [];
                const subraceLangs = selectedSubraceData?.languageProficiencies || [];
                const fixedLangs = [...raceLangs, ...subraceLangs]
                  .filter((lp: any) => {
                    // Only show fixed languages, not "anyStandard" or "any" choices
                    return typeof lp === "object" && !lp.anyStandard && !lp.any;
                  })
                  .flatMap((lp: any) => Object.keys(lp || {}).filter((k) => k !== "other"))
                  .filter(Boolean);
                if (fixedLangs.length > 0) {
                  return (
                    <div>
                      <span className="font-medium text-slate-700">Ngôn ngữ:</span>{" "}
                      <span className="text-slate-600">
                        {fixedLangs.map((l: string) => l.charAt(0).toUpperCase() + l.slice(1)).join(", ")}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            
            {/* Ability Score Choice UI */}
            {abilityChoice && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <div className="mb-3">
                  <span className="font-semibold text-slate-800">
                    Chọn {abilityChoice.count} chỉ số để tăng +1:
                  </span>
                  <p className="text-xs text-slate-600 mt-1">
                    Đã chọn: {raceAbilityChoices.length} / {abilityChoice.count}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {abilityChoice.from.map((abilityKey: string) => {
                    const isSelected = raceAbilityChoices.includes(abilityKey);
                    const canSelect = raceAbilityChoices.length < abilityChoice.count || isSelected;
                    
                    return (
                      <button
                        key={abilityKey}
                        type="button"
                        onClick={() => handleAbilityChoiceToggle(abilityKey)}
                        disabled={!canSelect && !isSelected}
                        className={`
                          rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors
                          ${
                            isSelected
                              ? "border-amber-500 bg-amber-100 text-amber-800"
                              : canSelect
                              ? "border-slate-300 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50"
                              : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                          }
                        `}
                      >
                        {abilityLabels[abilityKey] || abilityKey.toUpperCase()}
                        {isSelected && " ✓"}
                      </button>
                    );
                  })}
                </div>
                {raceAbilityChoices.length === abilityChoice.count && (
                  <div className="mt-3 text-sm text-green-700 font-medium">
                    ✓ Đã chọn đủ {abilityChoice.count} chỉ số
                  </div>
                )}
              </div>
            )}

            {/* Skill Choice UI */}
            {skillChoice && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <div className="mb-3">
                  <span className="font-semibold text-slate-800">
                    Chọn {skillChoice.count} kỹ năng (Skill):
                  </span>
                  <p className="text-xs text-slate-600 mt-1">
                    Đã chọn: {raceSkillChoices.length} / {skillChoice.count}
                  </p>
                </div>
                {loadingSkills ? (
                  <div className="text-sm text-slate-500">Đang tải danh sách kỹ năng...</div>
                ) : (
                  <div className="space-y-2">
                    {Array.from({ length: skillChoice.count }).map((_, index) => {
                      // Ensure we have enough slots in the array
                      const currentChoices = [...raceSkillChoices];
                      while (currentChoices.length < skillChoice.count) {
                        currentChoices.push("");
                      }
                      
                      return (
                        <select
                          key={index}
                          value={currentChoices[index] || ""}
                          onChange={(e) => {
                            if (onSelectSkillChoices) {
                              const newChoices = [...currentChoices];
                              if (e.target.value) {
                                // Remove from other selects if already selected
                                const existingIndex = newChoices.indexOf(e.target.value);
                                if (existingIndex > -1 && existingIndex !== index) {
                                  newChoices[existingIndex] = "";
                                }
                                newChoices[index] = e.target.value;
                              } else {
                                newChoices[index] = "";
                              }
                              // Filter out empty strings
                              onSelectSkillChoices(newChoices.filter((c) => c !== ""));
                            }
                          }}
                          className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">-- Chọn kỹ năng {index + 1} --</option>
                          {allSkills
                            .filter((skill) => {
                              // Don't show skills already selected in other dropdowns
                              const selectedInOthers = currentChoices.some(
                                (selected, idx) => selected === skill.name && idx !== index
                              );
                              return !selectedInOthers;
                            })
                            .map((skill) => (
                              <option key={skill.name} value={skill.name}>
                                {skill.name}
                              </option>
                            ))}
                        </select>
                      );
                    })}
                  </div>
                )}
                {raceSkillChoices.length === skillChoice.count && (
                  <div className="mt-2 text-sm text-green-700 font-medium">
                    ✓ Đã chọn: {raceSkillChoices.join(", ")}
                  </div>
                )}
              </div>
            )}

            {/* Feat Choice UI */}
            {featChoice && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <div className="mb-3">
                  <span className="font-semibold text-slate-800">
                    Chọn {featChoice.count} feat:
                  </span>
                  <p className="text-xs text-slate-600 mt-1">
                    Đã chọn: {raceFeatChoices.length} / {featChoice.count}
                  </p>
                </div>
                {loadingFeats ? (
                  <div className="text-sm text-slate-500">Đang tải danh sách feats...</div>
                ) : (
                  <select
                    value={raceFeatChoices[0] || ""}
                    onChange={(e) => {
                      if (e.target.value && onSelectFeatChoices) {
                        onSelectFeatChoices([e.target.value]);
                      }
                    }}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">-- Chọn feat --</option>
                    {allFeats.map((feat) => (
                      <option key={feat.name} value={feat.name}>
                        {feat.name}
                      </option>
                    ))}
                  </select>
                )}
                {raceFeatChoices.length === featChoice.count && (
                  <div className="mt-2 text-sm text-green-700 font-medium">
                    ✓ Đã chọn: {raceFeatChoices.join(", ")}
                  </div>
                )}
              </div>
            )}

            {/* Language Choice UI */}
            {languageChoice && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <div className="mb-3">
                  <span className="font-semibold text-slate-800">
                    Chọn {languageChoice.count} ngôn ngữ:
                  </span>
                  <p className="text-xs text-slate-600 mt-1">
                    Đã chọn: {raceLanguageChoices.length} / {languageChoice.count}
                  </p>
                </div>
                {loadingLanguages ? (
                  <div className="text-sm text-slate-500">Đang tải danh sách ngôn ngữ...</div>
                ) : (
                  <div className="space-y-2">
                    {Array.from({ length: languageChoice.count }).map((_, index) => {
                      // Ensure we have enough slots in the array
                      const currentChoices = [...raceLanguageChoices];
                      while (currentChoices.length < languageChoice.count) {
                        currentChoices.push("");
                      }
                      
                      return (
                        <select
                          key={index}
                          value={currentChoices[index] || ""}
                          onChange={(e) => {
                            if (onSelectLanguageChoices) {
                              const newChoices = [...currentChoices];
                              if (e.target.value) {
                                // Remove from other selects if already selected
                                const existingIndex = newChoices.indexOf(e.target.value);
                                if (existingIndex > -1 && existingIndex !== index) {
                                  newChoices[existingIndex] = "";
                                }
                                newChoices[index] = e.target.value;
                              } else {
                                newChoices[index] = "";
                              }
                              // Filter out empty strings
                              onSelectLanguageChoices(newChoices.filter((c) => c !== ""));
                            }
                          }}
                          className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">-- Chọn ngôn ngữ {index + 1} --</option>
                          {allLanguages
                            .filter((lang) => {
                              // Don't show languages already selected in other dropdowns
                              const selectedInOthers = currentChoices.some(
                                (selected, idx) => selected === lang.name && idx !== index
                              );
                              return !selectedInOthers;
                            })
                            .map((lang) => (
                              <option key={lang.name} value={lang.name}>
                                {lang.name}
                              </option>
                            ))}
                        </select>
                      );
                    })}
                  </div>
                )}
                {raceLanguageChoices.length === languageChoice.count && (
                  <div className="mt-2 text-sm text-green-700 font-medium">
                    ✓ Đã chọn: {raceLanguageChoices.join(", ")}
                  </div>
                )}
              </div>
            )}

            {/* Resistance Choice UI (e.g., Dragonborn) */}
            {resistanceChoice && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <div className="mb-3">
                  <span className="font-semibold text-slate-800">
                    Chọn loại kháng sát thương:
                  </span>
                </div>
                <select
                  value={raceResistanceChoice || ""}
                  onChange={(e) => {
                    if (onSelectResistanceChoice) {
                      onSelectResistanceChoice(e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Chọn loại kháng sát thương --</option>
                  {resistanceChoice.from.map((resistance: string) => (
                    <option key={resistance} value={resistance}>
                      {resistance.charAt(0).toUpperCase() + resistance.slice(1)}
                    </option>
                  ))}
                </select>
                {raceResistanceChoice && (
                  <div className="mt-2 text-sm text-green-700 font-medium">
                    ✓ Đã chọn: {raceResistanceChoice.charAt(0).toUpperCase() + raceResistanceChoice.slice(1)}
                  </div>
                )}
              </div>
            )}

            {/* Tool Choice UI (e.g., Dwarf) */}
            {toolChoice && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <div className="mb-3">
                  <span className="font-semibold text-slate-800">
                    Chọn công cụ (Tool):
                  </span>
                </div>
                <select
                  value={raceToolChoice || ""}
                  onChange={(e) => {
                    if (onSelectToolChoice) {
                      onSelectToolChoice(e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Chọn công cụ --</option>
                  {toolChoice.from.map((tool: string) => (
                    <option key={tool} value={tool}>
                      {tool.charAt(0).toUpperCase() + tool.slice(1)}
                    </option>
                  ))}
                </select>
                {raceToolChoice && (
                  <div className="mt-2 text-sm text-green-700 font-medium">
                    ✓ Đã chọn: {raceToolChoice.charAt(0).toUpperCase() + raceToolChoice.slice(1)}
                  </div>
                )}
              </div>
            )}

            {/* Draconic Ancestry Choice UI (Dragonborn) */}
            {draconicAncestryOptions && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <div className="mb-3">
                  <span className="font-semibold text-slate-800">
                    Chọn dòng dõi rồng (Draconic Ancestry):
                  </span>
                </div>
                <select
                  value={raceDraconicAncestry || ""}
                  onChange={(e) => {
                    if (onSelectDraconicAncestry) {
                      onSelectDraconicAncestry(e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Chọn dòng dõi rồng --</option>
                  {draconicAncestryOptions.map((ancestry: string) => (
                    <option key={ancestry} value={ancestry}>
                      {ancestry}
                    </option>
                  ))}
                </select>
                {raceDraconicAncestry && (
                  <div className="mt-2 text-sm text-green-700 font-medium">
                    ✓ Đã chọn: {raceDraconicAncestry}
                  </div>
                )}
              </div>
            )}

            {/* Additional Spells Display */}
            {(() => {
              const raceSpells = selectedRaceData.additionalSpells || [];
              const subraceSpells = selectedSubraceData?.additionalSpells || [];
              const allSpells = [...raceSpells, ...subraceSpells];
              
              if (allSpells.length > 0) {
                return (
                  <div className="mt-4 pt-4 border-t border-amber-200">
                    <div className="mb-2">
                      <span className="font-semibold text-slate-800">Spells:</span>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      {allSpells.map((spellData: any, idx: number) => {
                        const spells: string[] = [];
                        
                        // Known spells
                        if (spellData.known) {
                          Object.keys(spellData.known).forEach((level) => {
                            const levelSpells = spellData.known[level];
                            if (Array.isArray(levelSpells)) {
                              levelSpells.forEach((s: string) => {
                                const spellName = s.split("#")[0].split("|")[0];
                                spells.push(`${spellName} (cantrip)`);
                              });
                            } else if (typeof levelSpells === "string") {
                              const spellName = levelSpells.split("#")[0].split("|")[0];
                              spells.push(`${spellName} (level ${level})`);
                            }
                          });
                        }
                        
                        // Innate spells
                        if (spellData.innate) {
                          Object.keys(spellData.innate).forEach((level) => {
                            const levelData = spellData.innate[level];
                            if (typeof levelData === "string") {
                              const spellName = levelData.split("#")[0].split("|")[0];
                              spells.push(`${spellName} (innate)`);
                            } else if (levelData.daily) {
                              Object.keys(levelData.daily).forEach((spellLevel) => {
                                const dailySpells = levelData.daily[spellLevel];
                                if (Array.isArray(dailySpells)) {
                                  dailySpells.forEach((s: string) => {
                                    const spellName = s.split("#")[0].split("|")[0];
                                    spells.push(`${spellName} (innate, ${spellLevel}${spellLevel === "1" ? "st" : spellLevel === "2" ? "nd" : spellLevel === "3" ? "rd" : "th"} level, daily)`);
                                  });
                                }
                              });
                            }
                          });
                        }
                        
                        return (
                          <div key={idx} className="text-slate-600">
                            {spells.map((spell, i) => (
                              <div key={i}>
                                <TextWithTooltips text={spell} />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {showDetails && (
              <div className="mt-6 space-y-4 border-t border-amber-200 pt-4">
                {selectedRaceData.entries && (
                  <div>
                    <h4 className="mb-2 font-medium text-slate-700">Đặc điểm chủng tộc:</h4>
                  <div className="space-y-2 text-sm text-slate-600">
                    {getAllEntries(selectedRaceData.entries).map((entry: any, idx: number) => (
                        <div key={idx} className="rounded-lg bg-white/50 p-3">
                          <div className="font-medium text-slate-700 mb-1">
                            {entry.name}
                          </div>
                          <div className="text-slate-600">
                            {Array.isArray(entry.entries)
                              ? entry.entries.map((e: any, i: number) => {
                                  if (typeof e === "string") {
                                    return (
                                      <div key={i} className="mb-1">
                                        <TextWithTooltips text={e} />
                                      </div>
                                    );
                                  } else if (e && typeof e === "object") {
                                    // Handle tables, lists, etc.
                                    if (e.type === "table") {
                                      return (
                                        <div key={i} className="mt-2 mb-2">
                                          <div className="font-medium text-slate-700 mb-1">{e.caption || "Table"}</div>
                                          <div className="text-xs text-slate-500">(Table data - xem sách để biết chi tiết)</div>
                                        </div>
                                      );
                                    } else if (e.type === "list" && Array.isArray(e.items)) {
                                      return (
                                        <ul key={i} className="list-disc list-inside mt-1 mb-1 space-y-1">
                                          {e.items.map((item: string, itemIdx: number) => (
                                            <li key={itemIdx}>
                                              <TextWithTooltips text={item} />
                                            </li>
                                          ))}
                                        </ul>
                                      );
                                    }
                                  }
                                  return null;
                                })
                              : <TextWithTooltips text={formatEntry(entry)} />}
                          </div>
                        </div>
                      ))}
                  </div>
                  </div>
                )}

                {selectedSubraceData && selectedSubraceData.entries && (
                  <div>
                    <h4 className="mb-2 font-medium text-slate-700">
                      Đặc điểm chủng tộc phụ ({selectedSubraceData.name}):
                    </h4>
                    <div className="space-y-2 text-sm text-slate-600">
                      {getAllEntries(selectedSubraceData.entries).map((entry: any, idx: number) => (
                          <div key={idx} className="rounded-lg bg-white/50 p-3">
                            <div className="font-medium text-slate-700 mb-1">
                              {entry.name}
                            </div>
                            <div className="text-slate-600">
                              {Array.isArray(entry.entries)
                                ? entry.entries.map((e: any, i: number) => {
                                    if (typeof e === "string") {
                                      return (
                                        <div key={i} className="mb-1">
                                          <TextWithTooltips text={e} />
                                        </div>
                                      );
                                    } else if (e && typeof e === "object") {
                                      // Handle tables, lists, etc.
                                      if (e.type === "table") {
                                        return (
                                          <div key={i} className="mt-2 mb-2">
                                            <div className="font-medium text-slate-700 mb-1">{e.caption || "Table"}</div>
                                            <div className="text-xs text-slate-500">(Table data - xem sách để biết chi tiết)</div>
                                          </div>
                                        );
                                      } else if (e.type === "list" && Array.isArray(e.items)) {
                                        return (
                                          <ul key={i} className="list-disc list-inside mt-1 mb-1 space-y-1">
                                            {e.items.map((item: string, itemIdx: number) => (
                                              <li key={itemIdx}>
                                                <TextWithTooltips text={item} />
                                              </li>
                                            ))}
                                          </ul>
                                        );
                                      }
                                    }
                                    return null;
                                  })
                                : <TextWithTooltips text={formatEntry(entry)} />}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
