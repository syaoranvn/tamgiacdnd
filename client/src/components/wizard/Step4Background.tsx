import { useState, useEffect } from "react";
import type { Character, Background } from "../../types";
import TextWithTooltips from "../TextWithTooltips";
import { useTranslation } from "../../hooks/useTranslation";
import { useTranslationContext } from "../../contexts/TranslationContext";
import { apiUrl } from "../../config/api";

interface Step4BackgroundProps {
  backgrounds: Background[];
  character: Partial<Character>;
  backgroundSkillChoices?: string[];
  backgroundLanguageChoices?: string[];
  backgroundToolChoices?: string[];
  backgroundEquipmentChoices?: Record<number, string>;
  backgroundFeatureChoices?: string[];
  onUpdate: (updates: Partial<Character>) => void;
  onSelectSkillChoices?: (choices: string[]) => void;
  onSelectLanguageChoices?: (choices: string[]) => void;
  onSelectToolChoices?: (choices: string[]) => void;
  onSelectEquipmentChoices?: (choices: Record<number, string>) => void;
  onSelectFeatureChoices?: (choices: string[]) => void;
}

interface Skill {
  name: string;
  ability?: string | string[];
  [key: string]: any;
}

interface Language {
  name: string;
  type?: string;
  [key: string]: any;
}

// Component để hiển thị background details giống tooltip format
const BackgroundDetailsCard = ({ 
  background,
  backgroundSkillChoices = [],
  backgroundLanguageChoices = [],
  backgroundToolChoices = [],
  backgroundEquipmentChoices = {},
  backgroundFeatureChoices = [],
  allSkills = [],
  allLanguages = [],
  onSelectSkillChoices,
  onSelectLanguageChoices,
  onSelectToolChoices,
  onSelectEquipmentChoices,
  onSelectFeatureChoices,
}: { 
  background: Background;
  backgroundSkillChoices?: string[];
  backgroundLanguageChoices?: string[];
  backgroundToolChoices?: string[];
  backgroundEquipmentChoices?: Record<number, string>;
  backgroundFeatureChoices?: string[];
  allSkills?: Skill[];
  allLanguages?: Language[];
  onSelectSkillChoices?: (choices: string[]) => void;
  onSelectLanguageChoices?: (choices: string[]) => void;
  onSelectToolChoices?: (choices: string[]) => void;
  onSelectEquipmentChoices?: (choices: Record<number, string>) => void;
  onSelectFeatureChoices?: (choices: string[]) => void;
}) => {
  const { translationEnabled } = useTranslationContext();

  const TranslatedText = ({ text }: { text: string }) => {
    const { translated, loading } = useTranslation(text, {
      enabled: translationEnabled,
      immediate: true,
    });

    if (loading && translationEnabled) {
      return (
        <div className="mb-1">
          <span className="text-slate-400 italic text-xs">Đang dịch...</span>
        </div>
      );
    }

    return (
      <div className="mb-1">
        <TextWithTooltips text={translated} />
      </div>
    );
  };

  // Get ability bonuses if available
  const getAbilityBonuses = (ability: any) => {
    if (!ability || !Array.isArray(ability) || ability.length === 0) return [];
    return Object.entries(ability[0])
      .filter(([_, value]) => typeof value === "number" && value > 0)
      .map(([key, value]) => ({ key: key as any, value }));
  };

  const abilityBonuses = getAbilityBonuses(background.ability);
  const abilityLabels: Record<string, string> = {
    str: "STR",
    dex: "DEX",
    con: "CON",
    int: "INT",
    wis: "WIS",
    cha: "CHA",
  };

  // Check for skill choices
  const getSkillChoice = (): { count: number; from?: string[] } | null => {
    if (!background.skillProficiencies) return null;
    
    const skillChoice = background.skillProficiencies.find(
      (sp: any) => sp.any !== undefined || sp.choose !== undefined
    );
    
    if (skillChoice) {
      if (skillChoice.any !== undefined) {
        return { count: skillChoice.any };
      }
      if (skillChoice.choose) {
        return {
          count: skillChoice.choose.count || 1,
          from: skillChoice.choose.from || [],
        };
      }
    }
    
    return null;
  };

  // Check for language choices
  const getLanguageChoice = (): { count: number; standard?: boolean } | null => {
    if (!background.languageProficiencies) return null;
    
    const langChoice = background.languageProficiencies.find(
      (lp: any) => lp.anyStandard !== undefined || lp.any !== undefined
    );
    
    if (langChoice) {
      if (langChoice.anyStandard !== undefined) {
        return { count: langChoice.anyStandard, standard: true };
      }
      if (langChoice.any !== undefined) {
        return { count: langChoice.any, standard: false };
      }
    }
    
    return null;
  };

  // Check for tool choices
  const getToolChoice = (): { count: number; from?: string[] } | null => {
    if (!background.toolProficiencies) return null;
    
    const toolChoice = background.toolProficiencies.find(
      (tp: any) => tp.any !== undefined || tp.choose !== undefined
    );
    
    if (toolChoice) {
      if (toolChoice.any !== undefined) {
        return { count: toolChoice.any };
      }
      if (toolChoice.choose) {
        return {
          count: toolChoice.choose.count || 1,
          from: toolChoice.choose.from || [],
        };
      }
    }
    
    return null;
  };

  const skillChoice = getSkillChoice();
  const languageChoice = getLanguageChoice();
  const toolChoice = getToolChoice();

  // Get fixed skills
  const getFixedSkills = () => {
    if (!background.skillProficiencies) return [];
    return background.skillProficiencies
      .filter((sp: any) => typeof sp === "string" || (!sp.any && !sp.choose))
      .map((sp: any) => {
        if (typeof sp === "string") return sp;
        if (typeof sp === "object") {
          // Object format: { "insight": true, "religion": true }
          return Object.keys(sp).filter(key => sp[key] === true);
        }
        return [];
      })
      .flat();
  };

  // Get fixed languages
  const getFixedLanguages = () => {
    if (!background.languageProficiencies) return [];
    return background.languageProficiencies
      .filter((lp: any) => !lp.anyStandard && !lp.any)
      .map((lp: any) => Object.keys(lp))
      .flat();
  };

  // Get fixed tools
  const getFixedTools = () => {
    if (!background.toolProficiencies) return [];
    return background.toolProficiencies
      .filter((tp: any) => typeof tp === "string" || (!tp.any && !tp.choose))
      .map((tp: any) => typeof tp === "string" ? tp : Object.keys(tp))
      .flat();
  };

  const fixedSkills = getFixedSkills();
  const fixedLanguages = getFixedLanguages();
  const fixedTools = getFixedTools();

  // Format entries for display
  const formatEntry = (entry: any, idx: number): React.ReactNode => {
    if (typeof entry === "string") {
      return <TranslatedText key={idx} text={entry} />;
    }
    
    if (entry.type === "list" && Array.isArray(entry.items)) {
      return (
        <ul key={idx} className="list-disc list-inside mb-2 space-y-1 mt-1 ml-4">
          {entry.items.map((item: any, i: number) => {
            if (typeof item === "string") {
              return (
                <li key={i}>
                  <TextWithTooltips text={item} />
                </li>
              );
            }
            if (item.type === "item" && item.name && item.entry) {
              return (
                <li key={i}>
                  <span className="font-medium text-slate-200">{item.name}</span>{" "}
                  <TextWithTooltips text={item.entry} />
                </li>
              );
            }
            return null;
          })}
        </ul>
      );
    }
    
    if (entry.type === "entries" && entry.name) {
      return (
        <div key={idx} className="mt-2">
          <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
          {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
            return formatEntry(e, i);
          })}
        </div>
      );
    }
    
    return null;
  };

  // Get all entries
  const getAllEntries = (entries: any[] | undefined): any[] => {
    if (!entries || !Array.isArray(entries)) return [];
    return entries;
  };

  const allEntries = getAllEntries(background.entries);

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/95 p-3 text-xs shadow-xl max-w-2xl">
      <div className="font-bold mb-2 text-amber-400 text-sm">{background.name}</div>
      
      {abilityBonuses.length > 0 && (
        <div className="mb-1">
          <span className="font-medium text-slate-200">Ability Score Increase:</span>{" "}
          <span className="text-slate-300">
            {abilityBonuses
              .map(({ key, value }) => `${abilityLabels[key] || key.toUpperCase()} +${value}`)
              .join(", ")}
          </span>
        </div>
      )}
      
      {/* Skill Proficiencies */}
      {(fixedSkills.length > 0 || skillChoice) && (
        <div className="mb-2">
          <span className="font-medium text-slate-200">Skill Proficiencies:</span>{" "}
          {fixedSkills.length > 0 && (
            <span className="text-slate-300">
              {fixedSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}
            </span>
          )}
          {skillChoice && (
            <div className="mt-1">
              <span className="text-slate-300">
                Chọn {skillChoice.count} skill{skillChoice.count > 1 ? "s" : ""}
                {skillChoice.from && ` từ: ${skillChoice.from.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}`}
              </span>
              {skillChoice.from ? (
                // Choose from specific list
                <div className="mt-1 flex flex-wrap gap-2">
                  {skillChoice.from.map((skillName: string) => {
                    const isSelected = backgroundSkillChoices.includes(skillName);
                    return (
                      <button
                        key={skillName}
                        type="button"
                        onClick={() => {
                          if (!onSelectSkillChoices) return;
                          const current = [...backgroundSkillChoices];
                          const index = current.indexOf(skillName);
                          if (index > -1) {
                            current.splice(index, 1);
                          } else {
                            if (current.length < skillChoice.count) {
                              current.push(skillName);
                            }
                          }
                          onSelectSkillChoices(current);
                        }}
                        className={`px-2 py-1 rounded text-xs ${
                          isSelected
                            ? "bg-amber-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        {skillName.charAt(0).toUpperCase() + skillName.slice(1)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                // Choose any skills
                <div className="mt-1 space-y-1">
                  {Array.from({ length: skillChoice.count }).map((_, idx) => (
                    <select
                      key={idx}
                      value={backgroundSkillChoices[idx] || ""}
                      onChange={(e) => {
                        if (!onSelectSkillChoices) return;
                        const current = [...backgroundSkillChoices];
                        if (e.target.value) {
                          // Remove from other dropdowns if already selected
                          const existingIndex = current.indexOf(e.target.value);
                          if (existingIndex > -1 && existingIndex !== idx) {
                            current[existingIndex] = "";
                          }
                          current[idx] = e.target.value;
                          // Remove empty strings
                          const filtered = current.filter(c => c !== "");
                          onSelectSkillChoices(filtered);
                        } else {
                          current[idx] = "";
                          const filtered = current.filter(c => c !== "");
                          onSelectSkillChoices(filtered);
                        }
                      }}
                      className="w-full rounded border border-slate-600 bg-slate-700 text-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="">-- Chọn skill --</option>
                      {allSkills
                        .filter(skill => !backgroundSkillChoices.includes(skill.name) || backgroundSkillChoices[idx] === skill.name)
                        .map(skill => (
                          <option key={skill.name} value={skill.name}>
                            {skill.name}
                          </option>
                        ))}
                    </select>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Language Proficiencies */}
      {(fixedLanguages.length > 0 || languageChoice) && (
        <div className="mb-2">
          <span className="font-medium text-slate-200">Language Proficiencies:</span>{" "}
          {fixedLanguages.length > 0 && (
            <span className="text-slate-300">
              {fixedLanguages.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(", ")}
            </span>
          )}
          {languageChoice && (
            <div className="mt-1">
              <span className="text-slate-300">
                Chọn {languageChoice.count} {languageChoice.standard ? "standard " : ""}language{languageChoice.count > 1 ? "s" : ""}
              </span>
              <div className="mt-1 space-y-1">
                {Array.from({ length: languageChoice.count }).map((_, idx) => (
                  <select
                    key={idx}
                    value={backgroundLanguageChoices[idx] || ""}
                    onChange={(e) => {
                      if (!onSelectLanguageChoices) return;
                      const current = [...backgroundLanguageChoices];
                      if (e.target.value) {
                        // Remove from other dropdowns if already selected
                        const existingIndex = current.indexOf(e.target.value);
                        if (existingIndex > -1 && existingIndex !== idx) {
                          current[existingIndex] = "";
                        }
                        current[idx] = e.target.value;
                        // Remove empty strings
                        const filtered = current.filter(c => c !== "");
                        onSelectLanguageChoices(filtered);
                      } else {
                        current[idx] = "";
                        const filtered = current.filter(c => c !== "");
                        onSelectLanguageChoices(filtered);
                      }
                    }}
                    className="w-full rounded border border-slate-600 bg-slate-700 text-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="">-- Chọn ngôn ngữ --</option>
                    {allLanguages
                      .filter(lang => !backgroundLanguageChoices.includes(lang.name) || backgroundLanguageChoices[idx] === lang.name)
                      .map(lang => (
                        <option key={lang.name} value={lang.name}>
                          {lang.name}
                        </option>
                      ))}
                  </select>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Tool Proficiencies */}
      {(fixedTools.length > 0 || toolChoice) && (
        <div className="mb-2">
          <span className="font-medium text-slate-200">Tool Proficiencies:</span>{" "}
          {fixedTools.length > 0 && (
            <span className="text-slate-300">
              {fixedTools.map(t => typeof t === "string" ? t : Object.keys(t).join(", ")).join(", ")}
            </span>
          )}
          {toolChoice && (
            <div className="mt-1">
              <span className="text-slate-300">
                Chọn {toolChoice.count} tool{toolChoice.count > 1 ? "s" : ""}
                {toolChoice.from && ` từ: ${toolChoice.from.join(", ")}`}
              </span>
              {toolChoice.from ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {toolChoice.from.map((toolName: string) => {
                    const isSelected = backgroundToolChoices.includes(toolName);
                    return (
                      <button
                        key={toolName}
                        type="button"
                        onClick={() => {
                          if (!onSelectToolChoices) return;
                          const current = [...backgroundToolChoices];
                          const index = current.indexOf(toolName);
                          if (index > -1) {
                            current.splice(index, 1);
                          } else {
                            if (current.length < toolChoice.count) {
                              current.push(toolName);
                            }
                          }
                          onSelectToolChoices(current);
                        }}
                        className={`px-2 py-1 rounded text-xs ${
                          isSelected
                            ? "bg-amber-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        {toolName}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-1">
                  <input
                    type="text"
                    value={backgroundToolChoices.join(", ")}
                    onChange={(e) => {
                      if (!onSelectToolChoices) return;
                      const tools = e.target.value.split(",").map(t => t.trim()).filter(t => t);
                      onSelectToolChoices(tools);
                    }}
                    placeholder="Nhập tên tool (cách nhau bằng dấu phẩy)"
                    className="w-full rounded border border-slate-600 bg-slate-700 text-slate-300 px-2 py-1 text-xs"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Entries */}
      {allEntries.length > 0 && (
        <div className="mt-3 text-slate-300 leading-relaxed border-t border-slate-700 pt-3">
          {allEntries.map((entry, idx) => formatEntry(entry, idx))}
        </div>
      )}
    </div>
  );
};

export default function Step4Background({
  backgrounds,
  character,
  backgroundSkillChoices = [],
  backgroundLanguageChoices = [],
  backgroundToolChoices = [],
  backgroundEquipmentChoices = {},
  backgroundFeatureChoices = [],
  onUpdate,
  onSelectSkillChoices,
  onSelectLanguageChoices,
  onSelectToolChoices,
  onSelectEquipmentChoices,
  onSelectFeatureChoices,
}: Step4BackgroundProps) {
  const [selectedBackgroundData, setSelectedBackgroundData] = useState<Background | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [allLanguages, setAllLanguages] = useState<Language[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [loadingLanguages, setLoadingLanguages] = useState(false);

  // Load skills and languages when needed
  useEffect(() => {
    const needsSkills = selectedBackgroundData?.skillProficiencies?.some(
      (sp: any) => sp.any !== undefined || sp.choose !== undefined
    );
    const needsLanguages = selectedBackgroundData?.languageProficiencies?.some(
      (lp: any) => lp.anyStandard !== undefined || lp.any !== undefined
    );

    if (needsSkills && allSkills.length === 0) {
      loadSkills();
    }
    if (needsLanguages && allLanguages.length === 0) {
      loadLanguages();
    }
  }, [selectedBackgroundData]);

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

  const handleBackgroundSelect = (backgroundName: string) => {
    onUpdate({ background: backgroundName });
    const bg = backgrounds.find((b) => b.name === backgroundName);
    setSelectedBackgroundData(bg || null);
    // Reset choices when background changes
    if (onSelectSkillChoices) onSelectSkillChoices([]);
    if (onSelectLanguageChoices) onSelectLanguageChoices([]);
    if (onSelectToolChoices) onSelectToolChoices([]);
    if (onSelectEquipmentChoices) onSelectEquipmentChoices({});
    if (onSelectFeatureChoices) onSelectFeatureChoices([]);
  };

  useEffect(() => {
    if (character.background) {
      const bg = backgrounds.find((b) => b.name === character.background);
      setSelectedBackgroundData(bg || null);
    }
  }, [character.background, backgrounds]);

  return (
    <div>
      <h2 className="mb-4 font-display text-2xl text-ink">Bước 4: Chọn Background</h2>
      <p className="mb-6 text-slate-600">
        Background cho bạn 2 kỹ năng thành thạo, công cụ, ngôn ngữ, trang bị khởi đầu và 1 tính năng vai trò.
      </p>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Xuất thân (Background) *
          </label>
          <select
            value={character.background || ""}
            onChange={(e) => handleBackgroundSelect(e.target.value)}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            required
          >
            <option value="">-- Chọn xuất thân --</option>
            {backgrounds.map((bg) => (
              <option key={bg.name} value={bg.name}>
                {bg.name}
              </option>
            ))}
          </select>
          {selectedBackgroundData && (
            <BackgroundDetailsCard
              background={selectedBackgroundData}
              backgroundSkillChoices={backgroundSkillChoices}
              backgroundLanguageChoices={backgroundLanguageChoices}
              backgroundToolChoices={backgroundToolChoices}
              backgroundEquipmentChoices={backgroundEquipmentChoices}
              backgroundFeatureChoices={backgroundFeatureChoices}
              allSkills={allSkills}
              allLanguages={allLanguages}
              onSelectSkillChoices={onSelectSkillChoices}
              onSelectLanguageChoices={onSelectLanguageChoices}
              onSelectToolChoices={onSelectToolChoices}
              onSelectEquipmentChoices={onSelectEquipmentChoices}
              onSelectFeatureChoices={onSelectFeatureChoices}
            />
          )}
        </div>
      </div>
    </div>
  );
}

