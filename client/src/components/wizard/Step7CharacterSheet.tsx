import { useState, useEffect, useMemo } from "react";
import type { Character, Class, Race, Background, Subclass } from "../../types";
import TextWithTooltips from "../TextWithTooltips";
import Tooltip from "../Tooltip";
import TooltipContent from "../TooltipContent";
import { apiUrl } from "../../config/api";
import { parseText } from "../../utils/textParser";

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

// Helper function to check if a feature name is a background feature (should not be loaded as optional feature)
const isBackgroundFeature = (name: string): boolean => {
  const nameLower = name.toLowerCase();
  // Check for "Feature: " prefix
  if (nameLower.startsWith("feature: ")) {
    return true;
  }
  // Check for common background entry names that are not optional features
  const backgroundEntryNames = [
    "suggested characteristics",
    "specialty",
    "criminal contact",
    "shelter of the faithful",
    "false identity",
    "by popular demand",
    "position of privilege",
    "rustic hospitality",
    "wanderer",
    "researcher",
    "guild membership",
    "ship's passage",
    "all eyes on you",
    "bad reputation",
    "harrowing event",
    "renown",
    "retainers",
    "discovery"
  ];
  return backgroundEntryNames.some(bgName => nameLower === bgName || nameLower.includes(bgName));
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
  
  // Don't try to load background features as optional features
  if (isBackgroundFeature(featureName)) {
    // Remove "Feature: " prefix for display
    const displayName = featureName.startsWith("Feature: ") 
      ? featureName.substring("Feature: ".length).trim() 
      : featureName;
    return <span className="font-medium">{displayName}</span>;
  }
  
  // Don't try to load if it's clearly not an optional feature (e.g., "Suggested Characteristics")
  const nameLower = featureName.toLowerCase();
  if (nameLower.includes("suggested") || nameLower.includes("characteristics") || 
      nameLower.includes("specialty") || nameLower.includes("personality")) {
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

const FeatureEntryTooltip = ({ entry }: { entry: any }) => {
  if (!entry) return null;
  const normalizedEntry = typeof entry === "string" ? { name: entry, entries: [] } : entry;
  if (!normalizedEntry?.name) return null;

  let displayName = normalizedEntry.name;
  if (displayName.startsWith("Feature: ")) {
    displayName = displayName.substring("Feature: ".length).trim();
  }

  const featureData = {
    name: displayName,
    entries: normalizedEntry.entries || [],
  };

  return (
    <Tooltip
      content={
        <TooltipContent
          type="optionalfeature"
          name={displayName}
          data={featureData}
          loading={false}
        />
      }
    >
      <span className="text-amber-700 hover:text-amber-800 cursor-help underline font-medium">
        {displayName}
      </span>
    </Tooltip>
  );
};

const cleanSpecialTags = (text: string): string => {
  if (!text) return "";
  const parsed = parseText(text);
  return typeof parsed === "string" ? parsed.trim() : text;
};

const buildFeatureListItems = (entries: any[] | undefined, keyPrefix: string): JSX.Element[] => {
  const items: JSX.Element[] = [];
  if (!entries) return items;

  entries.forEach((entry, index) => {
    const key = `${keyPrefix}-${index}`;
    if (typeof entry === "object" && entry !== null) {
      if (entry.name && isFeature(entry.name)) {
        items.push(
          <div key={key}>
            <FeatureEntryTooltip entry={entry} />
          </div>
        );
      }
      if (entry.entries && Array.isArray(entry.entries)) {
        items.push(...buildFeatureListItems(entry.entries, key));
      }
    }
  });

  return items;
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
  const [currentView, setCurrentView] = useState<"character" | "spell">("character");

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

  const categorizedProficiencies = useMemo(() => {
    const categories = {
      languages: [] as string[],
      weapons: [] as string[],
      armor: [] as string[],
      tools: [] as string[],
      savingThrows: [] as string[],
      other: [] as string[],
    };

    const addUnique = (list: string[], value?: string) => {
      if (!value) return;
      const formatted = cleanSpecialTags(value).trim();
      if (!formatted) return;
      const exists = list.some(item => item.toLowerCase() === formatted.toLowerCase());
      if (!exists) {
        list.push(formatted);
      }
    };

    stats?.languages?.forEach(lang => addUnique(categories.languages, lang));
    stats?.toolProficiencies?.forEach(tool => addUnique(categories.tools, tool));

    const skillKeywords = [
      "acrobatics","animal handling","arcana","athletics","deception","history","insight",
      "intimidation","investigation","medicine","nature","perception","performance",
      "persuasion","religion","sleight of hand","stealth","survival"
    ];

    (character.proficiencies || []).forEach((prof) => {
      if (typeof prof !== "string") return;
      const formatted = cleanSpecialTags(prof).trim();
      if (!formatted) return;
      const lower = formatted.toLowerCase();

      // Skip skills (already displayed in Skills grid)
      if (skillKeywords.some((skill) => lower.includes(skill))) {
        return;
      }

      // Treat entries labeled as languages explicitly
      if (lower.includes("language")) {
        const cleanedLang = formatted.replace(/language[s]*[:]?/i, "").trim() || formatted;
        addUnique(categories.languages, cleanedLang);
        return;
      }

      const isWeapon =
        lower.includes("weapon") ||
        ["sword","dagger","axe","bow","crossbow","mace","spear","staff","dart","sling","club","handaxe","javelin",
         "hammer","quarterstaff","sickle","unarmed strike","shortbow","blowgun","rapier","scimitar","shortsword",
         "longsword","warhammer","trident","whip","glaive","halberd","greataxe","greatsword","maul","pike","lance",
         "battleaxe","morningstar","net"].some(keyword => lower.includes(keyword));

      const isArmor =
        lower.includes("armor") ||
        lower.includes("shield") ||
        ["light","medium","heavy"].includes(lower);

      const isSavingThrow = lower.includes("saving throw");

      const isTool =
        lower.includes("tool") ||
        lower.includes("instrument") ||
        lower.includes("kit") ||
        lower.includes("set") ||
        lower.includes("herbalism") ||
        lower.includes("poisoner") ||
        lower.includes("vehicles") ||
        lower.includes("thieves") ||
        lower.includes("disguise") ||
        lower.includes("forgery") ||
        lower.includes("navigator");

      if (isWeapon) {
        addUnique(categories.weapons, formatted.replace(/\s+weapons?$/i, "").trim());
      } else if (isArmor) {
        addUnique(categories.armor, formatted.replace(/\s+armor$/i, "").trim());
      } else if (isSavingThrow) {
        const cleaned = formatted.replace(/\s+saving\s+throws?$/i, "").trim();
        addUnique(categories.savingThrows, cleaned);
      } else if (isTool) {
        addUnique(categories.tools, formatted);
      } else {
        addUnique(categories.other, formatted);
      }
    });

    return categories;
  }, [character.proficiencies, stats?.toolProficiencies, stats?.languages]);

  const normalizeFeatureName = (name: string) => name?.toLowerCase().trim();

  const findFeatureEntry = (features: any[] | undefined, featureName: string) => {
    if (!features || !featureName) return null;
    const normalized = normalizeFeatureName(featureName);
    return (
      features.find(
        (feature) =>
          feature &&
          typeof feature === "object" &&
          feature.name &&
          normalizeFeatureName(feature.name) === normalized
      ) || null
    );
  };

  const findClassFeatureEntry = (featureName: string) =>
    findFeatureEntry((classData as any)?.classFeature, featureName);

  const findSubclassFeatureEntry = (featureName: string) =>
    findFeatureEntry((subclassData as any)?.subclassFeature, featureName);

  const classFeatureItems: JSX.Element[] =
    classData?.classFeatures
      ?.filter((feature: any) => {
        if (typeof feature === "string") {
          const match = feature.match(/\|\|(\d+)/);
          if (match) {
            const featureLevel = parseInt(match[1]);
            return featureLevel <= (character.level || 1);
          }
          return true;
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

        const classFeatureEntry = findClassFeatureEntry(featureName);

        if (classFeatureEntry) {
          return (
            <div key={`class-feature-${index}`}>
              <FeatureEntryTooltip entry={classFeatureEntry} />
              {featureLevel && (
                <span className="text-slate-500 ml-1 text-xs align-middle">Lv. {featureLevel}</span>
              )}
            </div>
          );
        }

        return (
          <div key={`class-feature-${index}`}>
            <FeatureTooltip featureName={featureName} level={featureLevel} />
          </div>
        );
      })
      .filter((item): item is JSX.Element => item !== null) || [];

  const subclassFeatureItems: JSX.Element[] =
    stats?.subclassFeatures?.map((feature: any, index: number) => (
      <div key={`active-subclass-feature-${index}`}>
        <FeatureEntryTooltip entry={feature} />
        {feature.level && <span className="text-slate-500"> (Level {feature.level})</span>}
      </div>
    )) || [];

  const shouldShowSubclassFallback = (!stats || !stats.subclassFeatures || stats.subclassFeatures.length === 0);

  const subclassFallbackItems: JSX.Element[] =
    shouldShowSubclassFallback && subclassData?.subclassFeatures
      ? subclassData.subclassFeatures
          .filter((feature: any) => {
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
            if (typeof feature !== "string") return null;
            const parts = feature.split("|");
            const featureName = parts[0] || feature;
            let featureLevel: number | undefined;
            const match = feature.match(/\|\|(\d+)/);
            if (match) {
              featureLevel = parseInt(match[1]);
            }
            if (!featureName) return null;

            const subclassFeatureEntry = findSubclassFeatureEntry(featureName);
            if (subclassFeatureEntry) {
              return (
                <div key={`subclass-fallback-${index}`}>
                  <FeatureEntryTooltip entry={subclassFeatureEntry} />
                  {featureLevel && (
                    <span className="text-slate-500 ml-1 text-xs align-middle">Lv. {featureLevel}</span>
                  )}
                </div>
              );
            }

            return (
              <div key={`subclass-fallback-${index}`}>
                <FeatureTooltip featureName={featureName} level={featureLevel} />
              </div>
            );
          })
          .filter((item): item is JSX.Element => item !== null)
      : [];

  const subclassEntryItems: JSX.Element[] =
    (!subclassData?.subclassFeatures || subclassData.subclassFeatures.length === 0)
      ? buildFeatureListItems(subclassData?.entries, "subclass-entry")
      : [];

  const raceFeatureItems = buildFeatureListItems(raceData?.entries, "race");

  const subraceFeatureItems: JSX.Element[] =
    subraceData && subraceData.entries
      ? subraceData.entries
          .map((entry: any, index: number) => {
            if (typeof entry === "string") {
              return null;
            } else if (entry && typeof entry === "object" && entry.name) {
              const nameLower = entry.name.toLowerCase();
              if (
                !nameLower.includes("age") &&
                !nameLower.includes("size") &&
                !nameLower.includes("speed") &&
                !nameLower.includes("language") &&
                !nameLower.includes("ability score") &&
                !nameLower.includes("proficiency") &&
                !nameLower.includes("skill") &&
                !nameLower.includes("tool") &&
                !nameLower.includes("equipment") &&
                !nameLower.includes("starting")
              ) {
                return (
                  <div key={`subrace-feature-${index}`}>
                    <FeatureEntryTooltip entry={entry} />
                  </div>
                );
              }
            }
            return null;
          })
          .filter((item): item is JSX.Element => item !== null)
      : [];

  const backgroundMainFeature =
    backgroundData && backgroundData.feature
      ? typeof backgroundData.feature === "string"
        ? { name: backgroundData.feature, entries: [] }
        : backgroundData.feature
      : null;

  const backgroundFeatureItems: JSX.Element[] = backgroundData
    ? [
        ...(backgroundMainFeature
          ? [
              <div key="background-main-feature">
                <FeatureEntryTooltip entry={backgroundMainFeature} />
              </div>,
            ]
          : []),
        ...buildFeatureListItems(backgroundData.entries, "background"),
      ]
    : [];

  const hasAnyFeatures =
    classFeatureItems.length > 0 ||
    subclassFeatureItems.length > 0 ||
    subclassFallbackItems.length > 0 ||
    subclassEntryItems.length > 0 ||
    raceFeatureItems.length > 0 ||
    subraceFeatureItems.length > 0 ||
    backgroundFeatureItems.length > 0;

  const renderProficiencyLines = (label: string, items: string[]) =>
    items.map((item, index) => (
      <div key={`${label}-${index}`} className="leading-tight">
        <span className="font-semibold">{label}: </span>
        <span>{item}</span>
      </div>
    ));

  const hasCategorizedProficiencies =
    categorizedProficiencies.languages.length > 0 ||
    categorizedProficiencies.weapons.length > 0 ||
    categorizedProficiencies.armor.length > 0 ||
    categorizedProficiencies.tools.length > 0 ||
    categorizedProficiencies.savingThrows.length > 0 ||
    categorizedProficiencies.other.length > 0;

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-slate-600">Đang tải thông tin nhân vật...</div>
      </div>
    );
  }

  const hasSpells = character.spells && Object.values(character.spells).some(spells => spells && spells.length > 0);

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header with Export Button and View Toggle */}
      <div className="bg-white border-b border-slate-300 px-6 py-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">{character.name || "Character Name"}</h1>
        <div className="flex items-center gap-3">
          {/* View Toggle Buttons */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setCurrentView("character")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === "character"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Character Sheet
            </button>
            {hasSpells && (
              <button
                type="button"
                onClick={() => setCurrentView("spell")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "spell"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Spell Sheet
              </button>
            )}
          </div>
          {character.id && (
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 bg-red-600 px-4 py-2 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {exporting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Đang tạo PDF...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export PDF</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Content - Conditional Rendering based on currentView */}
      {currentView === "spell" && hasSpells ? (
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Spell Sheet View */}
          <div className="bg-white border border-slate-300 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Spell Sheet</h2>
            <div className="space-y-6">
              {/* Spellcasting Info */}
              {stats && (stats.spellSaveDC || stats.spellAttackBonus) && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {stats.spellSaveDC && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded">
                      <div className="text-xs text-slate-600 font-medium mb-1">SPELL SAVE DC</div>
                      <div className="text-2xl font-bold text-slate-900">{stats.spellSaveDC}</div>
                    </div>
                  )}
                  {stats.spellAttackBonus !== undefined && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded">
                      <div className="text-xs text-slate-600 font-medium mb-1">SPELL ATTACK BONUS</div>
                      <div className="text-2xl font-bold text-slate-900">{formatModifier(stats.spellAttackBonus)}</div>
                    </div>
                  )}
                  {stats.spellcastingAbility && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded">
                      <div className="text-xs text-slate-600 font-medium mb-1">SPELLCASTING ABILITY</div>
                      <div className="text-2xl font-bold text-slate-900 uppercase">{stats.spellcastingAbility}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Spell Slots */}
              {stats?.spellSlots && Object.keys(stats.spellSlots).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">Spell Slots</h3>
                  <div className="grid grid-cols-5 gap-3">
                    {Object.entries(stats.spellSlots).map(([level, slotData]: [string, any]) => (
                      <div key={level} className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
                        <div className="text-xs text-slate-600 font-medium mb-1">Level {level.replace("level", "")}</div>
                        <div className="text-xl font-bold text-slate-900">
                          {slotData.used || 0} / {slotData.total}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spells by Level */}
              <div className="space-y-6">
                {character.spells.cantrips && character.spells.cantrips.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-3 border-b border-slate-300 pb-2">
                      Cantrips (0-level)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {character.spells.cantrips.map(spell => (
                        <div key={spell} className="bg-slate-50 border border-slate-200 p-3 rounded">
                          <SpellTooltip spellName={spell} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                  const spells = character.spells?.[`level${level}` as keyof typeof character.spells] as string[] | undefined;
                  if (!spells || spells.length === 0) return null;
                  return (
                    <div key={level}>
                      <h3 className="text-lg font-semibold text-slate-900 mb-3 border-b border-slate-300 pb-2">
                        Level {level} Spells
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {spells.map(spell => (
                          <div key={spell} className="bg-slate-50 border border-slate-200 p-3 rounded">
                            <SpellTooltip spellName={spell} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Basic Info Bar */}
        <div className="bg-white border border-slate-300 p-4 mb-4 grid grid-cols-6 gap-4 text-sm">
          <div>
            <span className="text-slate-600 font-medium">Class & Level:</span>
            <div className="text-slate-900 font-semibold">
              {character.className} {character.level || 1}
              {character.subclass && ` (${character.subclass})`}
            </div>
          </div>
          <div>
            <span className="text-slate-600 font-medium">Background:</span>
            <div className="text-slate-900 font-semibold">{character.background}</div>
          </div>
          <div>
            <span className="text-slate-600 font-medium">Player Name:</span>
            <div className="text-slate-900 font-semibold">-</div>
          </div>
          <div>
            <span className="text-slate-600 font-medium">Race:</span>
            <div className="text-slate-900 font-semibold">
              {character.race}
              {character.subrace && ` (${character.subrace})`}
            </div>
          </div>
          <div>
            <span className="text-slate-600 font-medium">Alignment:</span>
            <div className="text-slate-900 font-semibold">{character.alignment}</div>
          </div>
          <div>
            <span className="text-slate-600 font-medium">Experience Points:</span>
            <div className="text-slate-900 font-semibold">-</div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Abilities, Saves, Skills */}
          <div className="lg:col-span-1 space-y-4">
            {/* Ability Scores */}
            <div className="bg-white border border-slate-300 p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-300 pb-1">ABILITIES</h3>
              <div className="space-y-3">
                {Object.entries(abilityScores).map(([key, score]) => {
                  const mod = abilityModifiers[key as keyof typeof abilityModifiers];
                  const abbr = key.substring(0, 3).toUpperCase();
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-slate-700 uppercase">{abbr}</div>
                        <div className="text-2xl font-bold text-slate-900 text-center border border-slate-300 rounded bg-slate-50 py-1">
                          {score}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-slate-600">Modifier</div>
                        <div className="text-lg font-semibold text-slate-900 text-center border border-slate-300 rounded bg-slate-50 py-1">
                          {formatModifier(mod)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Saving Throws */}
            {stats && (
              <div className="bg-white border border-slate-300 p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-300 pb-1">SAVING THROWS</h3>
                <div className="space-y-2">
                  {Object.entries(stats.savingThrows).map(([ability, data]) => {
                    const abbr = ability.substring(0, 3).toUpperCase();
                    return (
                      <div key={ability} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={data.proficient}
                            readOnly
                            className="w-4 h-4 border-slate-300 rounded"
                          />
                          <span className="text-slate-700 font-medium">{abbr}</span>
                        </div>
                        <span className="text-slate-900 font-semibold w-8 text-right">{formatModifier(data.modifier)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Skills */}
            {stats && stats.skills && Object.keys(stats.skills).length > 0 && (
              <div className="bg-white border border-slate-300 p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-300 pb-1">SKILLS</h3>
                <div className="space-y-2">
                  {Object.entries(stats.skills)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([skill, data]) => (
                      <div key={skill} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={data.proficient}
                            readOnly
                            className="w-4 h-4 border-slate-300 rounded"
                          />
                          <span className="text-slate-700">{skill}</span>
                        </div>
                        <span className="text-slate-900 font-semibold w-8 text-right">{formatModifier(data.modifier)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Stats, Proficiencies, Features */}
          <div className="lg:col-span-2 space-y-4">
            {/* Top Stats Row */}
            {stats && (
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white border border-slate-300 p-3 text-center">
                  <div className="text-xs text-slate-600 font-medium mb-1">ARMOR CLASS</div>
                  <div className="text-2xl font-bold text-slate-900">{stats.ac}</div>
                </div>
                <div className="bg-white border border-slate-300 p-3 text-center">
                  <div className="text-xs text-slate-600 font-medium mb-1">INITIATIVE</div>
                  <div className="text-2xl font-bold text-slate-900">{formatModifier(stats.initiative)}</div>
                </div>
                <div className="bg-white border border-slate-300 p-3 text-center">
                  <div className="text-xs text-slate-600 font-medium mb-1">SPEED</div>
                  <div className="text-2xl font-bold text-slate-900">{stats.speed}</div>
                </div>
                <div className="bg-white border border-slate-300 p-3 text-center">
                  <div className="text-xs text-slate-600 font-medium mb-1">PROFICIENCY BONUS</div>
                  <div className="text-2xl font-bold text-slate-900">{formatModifier(stats.proficiencyBonus)}</div>
                </div>
              </div>
            )}

            {/* HP and Hit Dice */}
            {stats && (
              <div className="bg-white border border-slate-300 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-600 font-medium mb-1">HIT POINTS</div>
                    <div className="text-xl font-bold text-slate-900">{stats.hp} / {stats.maxHp}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600 font-medium mb-1">HIT DICE</div>
                    <div className="text-xl font-bold text-slate-900">{stats.hitDie}</div>
                  </div>
                </div>
                {stats.passivePerception && (
                  <div className="mt-3 pt-3 border-t border-slate-300">
                    <div className="text-xs text-slate-600 font-medium mb-1">PASSIVE WISDOM (PERCEPTION)</div>
                    <div className="text-lg font-bold text-slate-900">{stats.passivePerception}</div>
                  </div>
                )}
              </div>
            )}

            {/* Proficiencies & Languages */}
            <div className="bg-white border border-slate-300 p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-300 pb-1">OTHER PROFICIENCIES & LANGUAGES</h3>
              <div className="text-sm text-slate-700 space-y-1">
                {renderProficiencyLines("Language", categorizedProficiencies.languages)}
                {renderProficiencyLines("Weapon", categorizedProficiencies.weapons)}
                {renderProficiencyLines("Armor", categorizedProficiencies.armor)}
                {renderProficiencyLines("Tool", categorizedProficiencies.tools)}
                {renderProficiencyLines("Other", categorizedProficiencies.other)}
                {stats?.resistances && stats.resistances.length > 0 && (
                  <div className="pt-1">
                    <span className="font-semibold">Damage Resistances: </span>
                    {stats.resistances
                      .map(resistance => resistance.charAt(0).toUpperCase() + resistance.slice(1))
                      .join(", ")}
                  </div>
                )}
                {!hasCategorizedProficiencies && (!stats?.resistances || stats.resistances.length === 0) && (
                  <div className="text-slate-500">Chưa có thông tin kỹ năng nào</div>
                )}
              </div>
            </div>

            {/* Features & Traits */}
            <div className="bg-white border border-slate-300 p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-300 pb-1">FEATURES & TRAITS</h3>
              <div className="space-y-3 text-sm text-slate-700">
                {classFeatureItems.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-900 mb-1">Class Features:</div>
                    <div className="space-y-1 ml-2">{classFeatureItems}</div>
                  </div>
                )}

                {subclassFeatureItems.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-900 mb-1">Subclass Features ({character.subclass}):</div>
                    <div className="space-y-1 ml-2">{subclassFeatureItems}</div>
                  </div>
                )}

                {subclassFeatureItems.length === 0 && subclassFallbackItems.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-900 mb-1">Subclass Features ({subclassData?.name || character.subclass}):</div>
                    <div className="space-y-1 ml-2">{subclassFallbackItems}</div>
                  </div>
                )}

                {subclassFeatureItems.length === 0 &&
                  subclassFallbackItems.length === 0 &&
                  subclassEntryItems.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-900 mb-1">Subclass Features ({subclassData?.name || character.subclass}):</div>
                      <div className="space-y-1 ml-2">{subclassEntryItems}</div>
                    </div>
                  )}

                {raceFeatureItems.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-900 mb-1">Race Features:</div>
                    <div className="space-y-1 ml-2">{raceFeatureItems}</div>
                  </div>
                )}

                {subraceFeatureItems.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-900 mb-1">
                      Subrace Features {subraceData?.name ? `(${subraceData.name})` : ""}
                    </div>
                    <div className="space-y-1 ml-2">{subraceFeatureItems}</div>
                  </div>
                )}

                {backgroundFeatureItems.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-900 mb-1">
                      Background Features {backgroundData?.name ? `(${backgroundData.name})` : ""}
                    </div>
                    <div className="space-y-1 ml-2">{backgroundFeatureItems}</div>
                  </div>
                )}

                {!hasAnyFeatures && (
                  <div className="text-slate-500">Chưa có tính năng nào được tải</div>
                )}
              </div>
            </div>

            {/* Equipment */}
            {stats && stats.expandedEquipment.length > 0 && (
              <div className="bg-white border border-slate-300 p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-300 pb-1">EQUIPMENT</h3>
                <div className="space-y-1 text-sm text-slate-700">
                  {stats.expandedEquipment.map((item, index) => (
                    <div key={index}>
                      <TextWithTooltips text={item} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spells */}
            {character.spells && Object.values(character.spells).some(spells => spells && spells.length > 0) && (
              <div className="bg-white border border-slate-300 p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-300 pb-1">SPELLS</h3>
                <div className="space-y-3 text-sm">
                  {character.spells.cantrips && character.spells.cantrips.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-1">Cantrips:</h4>
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
                        <h4 className="font-semibold text-slate-700 mb-1">Level {level}:</h4>
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

            {/* Personal Information */}
            {(character.ideals || character.bonds || character.flaws || character.notes) && (
              <div className="bg-white border border-slate-300 p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-300 pb-1">CHARACTER DETAILS</h3>
                <div className="space-y-3 text-sm">
                  {character.ideals && (
                    <div>
                      <span className="font-semibold text-slate-700">Ideals: </span>
                      <span className="text-slate-600">{character.ideals}</span>
                    </div>
                  )}
                  {character.bonds && (
                    <div>
                      <span className="font-semibold text-slate-700">Bonds: </span>
                      <span className="text-slate-600">{character.bonds}</span>
                    </div>
                  )}
                  {character.flaws && (
                    <div>
                      <span className="font-semibold text-slate-700">Flaws: </span>
                      <span className="text-slate-600">{character.flaws}</span>
                    </div>
                  )}
                  {character.notes && (
                    <div>
                      <span className="font-semibold text-slate-700">Notes: </span>
                      <span className="text-slate-600">{character.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

