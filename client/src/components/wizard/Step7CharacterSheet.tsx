import { useState, useEffect } from "react";
import type { Character, Class, Race, Background, Subclass } from "../../types";
import TextWithTooltips from "../TextWithTooltips";
import Tooltip from "../Tooltip";
import TooltipContent from "../TooltipContent";
import { apiUrl } from "../../config/api";

// Helper function to check if an entry name is a feature (not descriptive info like Age, Size, etc.)
const isFeature = (name: string): boolean => {
  const nonFeatureKeywords = [
    "age", "size", "speed", "languages", "alignment", 
    "height and weight", "height", "weight", "ability score increase",
    "ability scores", "proficiencies", "starting proficiencies",
    "starting equipment", "equipment", "description", "names"
  ];
  const nameLower = name.toLowerCase();
  return !nonFeatureKeywords.some(keyword => nameLower.includes(keyword));
};

// Component to load and display feature tooltip (similar to Step2Class)
const FeatureTooltip = ({ featureName, level }: { featureName: string; level?: number }) => {
  const [featureData, setFeatureData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadFeature = async () => {
    if (featureData || loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        apiUrl(`api/data/lookup/optionalfeature/${encodeURIComponent(featureName)}`)
      );
      if (response.ok) {
        const data = await response.json();
        setFeatureData(data);
      }
    } catch (error) {
      console.error("Error loading feature:", error);
    } finally {
      setLoading(false);
    }
  };

  // Only show tooltip if it's actually a feature
  if (!isFeature(featureName)) {
    return <span className="font-medium">{featureName}</span>;
  }

  return (
    <Tooltip
      content={
        <TooltipContent
          type="optionalfeature"
          name={featureName}
          data={featureData}
          loading={loading}
        />
      }
    >
      <span
        className="text-amber-700 hover:text-amber-800 cursor-help underline"
        onMouseEnter={loadFeature}
      >
        {featureName}
      </span>
    </Tooltip>
  );
};

// Component to load and display spell tooltip
const SpellTooltip = ({ spellName }: { spellName: string }) => {
  const [spellData, setSpellData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadSpell = async () => {
    if (spellData || loading) return;
    setLoading(true);
    try {
        const response = await fetch(
          apiUrl(`api/data/lookup/spell/${encodeURIComponent(spellName)}`)
        );
      if (response.ok) {
        const data = await response.json();
        setSpellData(data);
      }
    } catch (error) {
      console.error("Error loading spell:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip
      content={
        <TooltipContent
          type="spell"
          name={spellName}
          data={spellData}
          loading={loading}
        />
      }
    >
      <span
        className="text-sm text-amber-700 hover:text-amber-800 cursor-help underline"
        onMouseEnter={loadSpell}
      >
        {spellName}
      </span>
    </Tooltip>
  );
};

interface Step10CharacterSheetProps {
  character: Partial<Character>;
  onComplete: (event: any) => void;
}

export default function Step10CharacterSheet({ character, onComplete }: Step7CharacterSheetProps) {
  const [classData, setClassData] = useState<Class | null>(null);
  const [raceData, setRaceData] = useState<Race | null>(null);
  const [subraceData, setSubraceData] = useState<any>(null);
  const [subclassData, setSubclassData] = useState<Subclass | null>(null);
  const [backgroundData, setBackgroundData] = useState<Background | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!character.id) {
      console.error("Character ID not found");
      return;
    }

    setExporting(true);
    try {
      const response = await fetch(apiUrl(`api/characters/${character.id}/export-pdf`), {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to export PDF");
      }

      // Get PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${character.name || "character"}_sheet.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("Không thể xuất PDF. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [classRes, raceRes, subraceRes, subclassRes, backgroundRes] = await Promise.all([
          character.className ? fetch(apiUrl(`api/data/classes/${character.className}`)).then(r => r.ok ? r.json() : null).catch(() => null) : null,
          character.race ? fetch(apiUrl(`api/data/races/${character.race}`)).then(r => r.ok ? r.json() : null).catch(() => null) : null,
          character.subrace ? fetch(apiUrl(`api/data/subraces/${character.subrace}`)).then(r => r.ok ? r.json() : null).catch(() => null) : null,
          character.className && character.subclass ? fetch(apiUrl(`api/data/classes/${character.className}/subclasses`)).then(r => {
            if (r.ok) return r.json();
            return null;
          }).then((subclasses: Subclass[] | null) => {
            if (subclasses && character.subclass) {
              return subclasses.find(s => s.name === character.subclass) || null;
            }
            return null;
          }).catch(() => null) : null,
          character.background ? fetch(apiUrl(`api/data/backgrounds/${character.background}`)).then(r => r.ok ? r.json() : null).catch(() => null) : null,
        ]);

        if (classRes) setClassData(classRes);
        if (raceRes) setRaceData(raceRes);
        if (subraceRes) setSubraceData(subraceRes);
        if (subclassRes) setSubclassData(subclassRes);
        if (backgroundRes) setBackgroundData(backgroundRes);
      } catch (error) {
        console.error("Error loading character sheet data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [character]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-slate-600">Đang tải thông tin nhân vật...</div>
      </div>
    );
  }

  const stats = character.calculatedStats;
  const abilityScores = character.abilityScores || {
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
  };

  const getModifier = (score: number): number => {
    return Math.floor((score - 10) / 2);
  };

  const abilityModifiers = {
    str: getModifier(abilityScores.str),
    dex: getModifier(abilityScores.dex),
    con: getModifier(abilityScores.con),
    int: getModifier(abilityScores.int),
    wis: getModifier(abilityScores.wis),
    cha: getModifier(abilityScores.cha),
  };

  const formatModifier = (mod: number): string => {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <h2 className="text-2xl font-bold text-slate-800">Character Sheet</h2>
          <p className="text-slate-600 mt-2">Xem lại và hoàn thiện nhân vật của bạn</p>
        </div>
        {character.id && (
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-white transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Đang tạo PDF...</span>
              </>
            ) : (
              <>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export PDF</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Basic Information */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-xl font-semibold text-slate-800 mb-4">Thông tin cơ bản</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-slate-600">Tên:</span>
            <span className="ml-2 text-slate-800">{character.name || "Chưa đặt tên"}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-600">Cấp độ:</span>
            <span className="ml-2 text-slate-800">{character.level || 1}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-600">Chủng tộc:</span>
            <span className="ml-2 text-slate-800">
              {character.race}
              {character.subrace && ` (${character.subrace})`}
            </span>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-600">Lớp:</span>
            <span className="ml-2 text-slate-800">
              {character.className}
              {character.subclass && ` - ${character.subclass}`}
            </span>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-600">Background:</span>
            <span className="ml-2 text-slate-800">{character.background}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-600">Alignment:</span>
            <span className="ml-2 text-slate-800">{character.alignment}</span>
          </div>
        </div>
      </div>

      {/* Ability Scores & Calculated Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ability Scores */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-4">Ability Scores</h3>
          <div className="space-y-3">
            {Object.entries(abilityScores).map(([key, score]) => {
              const mod = abilityModifiers[key as keyof typeof abilityModifiers];
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600 capitalize">{key}:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-800">{score}</span>
                    <span className="text-slate-600">({formatModifier(mod)})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calculated Stats */}
        {stats && (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Chỉ số tính toán</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">AC:</span>
                <span className="text-slate-800">{stats.ac}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Initiative:</span>
                <span className="text-slate-800">{formatModifier(stats.initiative)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Speed:</span>
                <span className="text-slate-800">{stats.speed} ft</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Passive Perception:</span>
                <span className="text-slate-800">{stats.passivePerception}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Proficiency Bonus:</span>
                <span className="text-slate-800">{formatModifier(stats.proficiencyBonus)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">HP:</span>
                <span className="text-slate-800">{stats.hp} / {stats.maxHp}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Hit Die:</span>
                <span className="text-slate-800">{stats.hitDie}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Saving Throws */}
      {stats && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-4">Saving Throws</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats.savingThrows).map(([ability, data]) => (
              <div key={ability} className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 capitalize">
                  {ability}
                  {data.proficient && <span className="ml-1 text-amber-600">●</span>}
                </span>
                <span className="text-slate-800">{formatModifier(data.modifier)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-xl font-semibold text-slate-800 mb-4">Skills</h3>
        {stats && stats.skills && Object.keys(stats.skills).length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats.skills)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([skill, data]) => (
                <div key={skill} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">
                    {skill}
                    {data.proficient && <span className="ml-1 text-amber-600">●</span>}
                  </span>
                  <span className="text-slate-800">{formatModifier(data.modifier)}</span>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Chưa có skill nào được tính toán. Vui lòng quay lại bước trước để tính toán lại.</div>
        )}
      </div>

      {/* Equipment */}
      {stats && stats.expandedEquipment.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-4">Trang bị</h3>
          <div className="space-y-1">
            {stats.expandedEquipment.map((item, index) => (
              <div key={index} className="text-sm text-slate-700">
                <TextWithTooltips text={item} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spells */}
      {character.spells && Object.values(character.spells).some(spells => spells && spells.length > 0) && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-4">Spells</h3>
          <div className="space-y-4">
            {character.spells.cantrips && character.spells.cantrips.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-700 mb-2">Cantrips:</h4>
                <div className="flex flex-wrap gap-2">
                  {character.spells.cantrips.map(spell => (
                    <SpellTooltip key={spell} spellName={spell} />
                  ))}
                </div>
              </div>
            )}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
              const spells = character.spells?.[`level${level}` as keyof typeof character.spells] as string[] | undefined;
              if (!spells || spells.length === 0) return null;
              return (
                <div key={level}>
                  <h4 className="font-medium text-slate-700 mb-2">Level {level}:</h4>
                  <div className="flex flex-wrap gap-2">
                    {spells.map(spell => (
                      <SpellTooltip key={spell} spellName={spell} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Class & Race Features */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-xl font-semibold text-slate-800 mb-4">Tính năng Class & Race</h3>
        <div className="space-y-4">
          {/* Class Features */}
          {classData && classData.classFeatures && classData.classFeatures.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-700 mb-2">Class Features:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                {classData.classFeatures
                  .filter((feature: any) => {
                    // Filter features by character level
                    if (typeof feature === "string") {
                      const match = feature.match(/\|\|(\d+)/);
                      if (match) {
                        const featureLevel = parseInt(match[1]);
                        return featureLevel <= (character.level || 1);
                      }
                      return true; // If no level specified, show it
                    } else if (feature && typeof feature === "object" && feature.classFeature) {
                      const match = feature.classFeature.match(/\|\|(\d+)/);
                      if (match) {
                        const featureLevel = parseInt(match[1]);
                        return featureLevel <= (character.level || 1);
                      }
                      return true;
                    }
                    return true;
                  })
                  .map((feature: any, index: number) => {
                    // Parse feature name from format "FeatureName|Class||Level"
                    let featureName = "";
                    let featureLevel: number | undefined;
                    if (typeof feature === "string") {
                      const parts = feature.split("|");
                      featureName = parts[0] || feature;
                      const match = feature.match(/\|\|(\d+)/);
                      if (match) {
                        featureLevel = parseInt(match[1]);
                      }
                    } else if (feature && typeof feature === "object") {
                      if (feature.name) {
                        featureName = feature.name;
                      } else if (feature.classFeature) {
                        const parts = feature.classFeature.split("|");
                        featureName = parts[0] || feature.classFeature;
                        const match = feature.classFeature.match(/\|\|(\d+)/);
                        if (match) {
                          featureLevel = parseInt(match[1]);
                        }
                      }
                    }
                    if (!featureName) return null;
                    return (
                      <li key={index}>
                        <FeatureTooltip featureName={featureName} level={featureLevel} />
                      </li>
                    );
                  })
                  .filter((item: any) => item !== null)}
              </ul>
            </div>
          )}

          {/* Subclass Features */}
          {subclassData && subclassData.subclassFeatures && subclassData.subclassFeatures.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-700 mb-2">Subclass Features ({subclassData.name}):</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                {subclassData.subclassFeatures
                  .filter((feature: any) => {
                    // Filter by character level
                    if (typeof feature === "string") {
                      const match = feature.match(/\|\|(\d+)/);
                      if (match) {
                        const featureLevel = parseInt(match[1]);
                        return featureLevel <= (character.level || 1);
                      }
                      return true;
                    }
                    return true;
                  })
                  .map((feature: any, index: number) => {
                    let featureName = "";
                    let featureLevel: number | undefined;
                    if (typeof feature === "string") {
                      const parts = feature.split("|");
                      featureName = parts[0] || feature;
                      const match = feature.match(/\|\|(\d+)/);
                      if (match) {
                        featureLevel = parseInt(match[1]);
                      }
                    }
                    if (!featureName) return null;
                    return (
                      <li key={index}>
                        <FeatureTooltip featureName={featureName} level={featureLevel} />
                      </li>
                    );
                  })
                  .filter((item: any) => item !== null)}
              </ul>
            </div>
          )}

          {/* Subclass Entries (if no subclassFeatures) */}
          {subclassData && (!subclassData.subclassFeatures || subclassData.subclassFeatures.length === 0) && subclassData.entries && subclassData.entries.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-700 mb-2">Subclass Features ({subclassData.name}):</h4>
              <div className="space-y-2 text-sm text-slate-600">
                {subclassData.entries.map((entry: any, index: number) => {
                  if (typeof entry === "string") {
                    return (
                      <div key={index}>
                        <TextWithTooltips text={entry} />
                      </div>
                    );
                  } else if (entry && typeof entry === "object") {
                    if (entry.name) {
                      return (
                        <div key={index}>
                          <div className="font-medium mb-1">
                            <FeatureTooltip featureName={entry.name} />
                          </div>
                          {entry.entries && Array.isArray(entry.entries) && (
                            <div className="ml-4 space-y-1">
                              {entry.entries.map((e: any, i: number) => {
                                if (typeof e === "string") {
                                  return (
                                    <div key={i}>
                                      <TextWithTooltips text={e} />
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    } else if (entry.type === "entries" && entry.entries) {
                      return (
                        <div key={index} className="space-y-1">
                          {entry.entries.map((e: any, i: number) => {
                            if (typeof e === "string") {
                              return (
                                <div key={i}>
                                  <TextWithTooltips text={e} />
                                </div>
                              );
                            } else if (e && typeof e === "object" && e.name) {
                              return (
                                <div key={i}>
                                  <div className="font-medium mb-1">
                                    <FeatureTooltip featureName={e.name} />
                                  </div>
                                  {e.entries && Array.isArray(e.entries) && (
                                    <div className="ml-4">
                                      {e.entries.map((subE: any, subI: number) => {
                                        if (typeof subE === "string") {
                                          return (
                                            <div key={subI}>
                                              <TextWithTooltips text={subE} />
                                            </div>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      );
                    }
                  }
                  return null;
                })}
              </div>
            </div>
          )}

          {/* Race Features */}
          {raceData && raceData.entries && raceData.entries.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-700 mb-2">Race Features:</h4>
              <div className="space-y-2 text-sm text-slate-600">
                {raceData.entries.map((entry: any, index: number) => {
                  if (typeof entry === "string") {
                    return (
                      <div key={index}>
                        <TextWithTooltips text={entry} />
                      </div>
                    );
                  } else if (entry && typeof entry === "object") {
                    if (entry.name) {
                      return (
                        <div key={index}>
                          <div className="font-medium mb-1">
                            <FeatureTooltip featureName={entry.name} />
                          </div>
                          {entry.entries && Array.isArray(entry.entries) && (
                            <div className="ml-4 space-y-1">
                              {entry.entries.map((e: any, i: number) => {
                                if (typeof e === "string") {
                                  return (
                                    <div key={i}>
                                      <TextWithTooltips text={e} />
                                    </div>
                                  );
                                } else if (e && typeof e === "object" && e.name) {
                                  return (
                                    <div key={i}>
                                      <div className="font-medium mb-1">
                                        <FeatureTooltip featureName={e.name} />
                                      </div>
                                      {e.entries && Array.isArray(e.entries) && (
                                        <div className="ml-4">
                                          {e.entries.map((subE: any, subI: number) => {
                                            if (typeof subE === "string") {
                                              return (
                                                <div key={subI}>
                                                  <TextWithTooltips text={subE} />
                                                </div>
                                              );
                                            }
                                            return null;
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    } else if (entry.type === "entries" && entry.entries) {
                      return (
                        <div key={index} className="space-y-1">
                          {entry.entries.map((e: any, i: number) => {
                            if (typeof e === "string") {
                              return (
                                <div key={i}>
                                  <TextWithTooltips text={e} />
                                </div>
                              );
                            } else if (e && typeof e === "object" && e.name) {
                              return (
                                <div key={i}>
                                  <div className="font-medium mb-1">
                                    <FeatureTooltip featureName={e.name} />
                                  </div>
                                  {e.entries && Array.isArray(e.entries) && (
                                    <div className="ml-4">
                                      {e.entries.map((subE: any, subI: number) => {
                                        if (typeof subE === "string") {
                                          return (
                                            <div key={subI}>
                                              <TextWithTooltips text={subE} />
                                            </div>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      );
                    }
                  }
                  return null;
                })}
              </div>
            </div>
          )}

          {/* Subrace Features */}
          {subraceData && subraceData.entries && subraceData.entries.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-700 mb-2">Subrace Features ({subraceData.name}):</h4>
              <div className="space-y-2 text-sm text-slate-600">
                {subraceData.entries.map((entry: any, index: number) => {
                  if (typeof entry === "string") {
                    return (
                      <div key={index}>
                        <TextWithTooltips text={entry} />
                      </div>
                    );
                  } else if (entry && typeof entry === "object") {
                    if (entry.name) {
                      return (
                        <div key={index}>
                          <div className="font-medium mb-1">
                            <FeatureTooltip featureName={entry.name} />
                          </div>
                          {entry.entries && Array.isArray(entry.entries) && (
                            <div className="ml-4 space-y-1">
                              {entry.entries.map((e: any, i: number) => {
                                if (typeof e === "string") {
                                  return (
                                    <div key={i}>
                                      <TextWithTooltips text={e} />
                                    </div>
                                  );
                                } else if (e && typeof e === "object" && e.name) {
                                  return (
                                    <div key={i}>
                                      <div className="font-medium mb-1">
                                        <FeatureTooltip featureName={e.name} />
                                      </div>
                                      {e.entries && Array.isArray(e.entries) && (
                                        <div className="ml-4">
                                          {e.entries.map((subE: any, subI: number) => {
                                            if (typeof subE === "string") {
                                              return (
                                                <div key={subI}>
                                                  <TextWithTooltips text={subE} />
                                                </div>
                                              );
                                            }
                                            return null;
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    } else if (entry.type === "entries" && entry.entries) {
                      return (
                        <div key={index} className="space-y-1">
                          {entry.entries.map((e: any, i: number) => {
                            if (typeof e === "string") {
                              return (
                                <div key={i}>
                                  <TextWithTooltips text={e} />
                                </div>
                              );
                            } else if (e && typeof e === "object" && e.name) {
                              return (
                                <div key={i}>
                                  <div className="font-medium mb-1">
                                    <FeatureTooltip featureName={e.name} />
                                  </div>
                                  {e.entries && Array.isArray(e.entries) && (
                                    <div className="ml-4">
                                      {e.entries.map((subE: any, subI: number) => {
                                        if (typeof subE === "string") {
                                          return (
                                            <div key={subI}>
                                              <TextWithTooltips text={subE} />
                                            </div>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      );
                    }
                  }
                  return null;
                })}
              </div>
            </div>
          )}

          {/* Show message if no features */}
          {(!classData || !classData.classFeatures || classData.classFeatures.length === 0) &&
           (!subclassData || (!subclassData.subclassFeatures || subclassData.subclassFeatures.length === 0) && (!subclassData.entries || subclassData.entries.length === 0)) &&
           (!raceData || !raceData.entries || raceData.entries.length === 0) &&
           (!subraceData || !subraceData.entries || subraceData.entries.length === 0) && (
            <div className="text-sm text-slate-500">Chưa có tính năng nào được tải</div>
          )}
        </div>
      </div>

      {/* Personal Information */}
      {(character.ideals || character.bonds || character.flaws || character.notes) && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-4">Thông tin cá nhân</h3>
          <div className="space-y-3">
            {character.ideals && (
              <div>
                <span className="text-sm font-medium text-slate-600">Ideals:</span>
                <p className="text-slate-700 mt-1">{character.ideals}</p>
              </div>
            )}
            {character.bonds && (
              <div>
                <span className="text-sm font-medium text-slate-600">Bonds:</span>
                <p className="text-slate-700 mt-1">{character.bonds}</p>
              </div>
            )}
            {character.flaws && (
              <div>
                <span className="text-sm font-medium text-slate-600">Flaws:</span>
                <p className="text-slate-700 mt-1">{character.flaws}</p>
              </div>
            )}
            {character.notes && (
              <div>
                <span className="text-sm font-medium text-slate-600">Notes:</span>
                <p className="text-slate-700 mt-1">{character.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

