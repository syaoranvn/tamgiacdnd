import { useState, useEffect, useMemo } from "react";
import type { Class, Subclass, Feat } from "../../types";
import { parseText, parseItemName } from "../../utils/textParser";
import Tooltip from "../Tooltip";
import TextWithTooltips from "../TextWithTooltips";
import TooltipContent from "../TooltipContent";
import { apiUrl } from "../../config/api";

// Component to load and display feature tooltip
const FeatureTooltip = ({ featureName, level }: { featureName: string; level: string }) => {
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
      <div
        className="flex items-center gap-2 cursor-help"
        onMouseEnter={loadFeature}
      >
        <span className="font-medium text-amber-700">Lv {level}:</span>
        <span className="text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-800">
          {featureName}
        </span>
      </div>
    </Tooltip>
  );
};

interface Step2ClassProps {
  classes: Class[];
  selectedClass?: string;
  selectedLevel?: number;
  selectedSubclass?: string;
  selectedFeats?: string[];
  classSkillChoices?: string[];
  subclassChoices?: Record<string, any>; // Store choices for subclass features (e.g., { "Draconic Ancestry": "Red" })
  onSelectClass: (className: string) => void;
  onSelectLevel: (level: number) => void;
  onSelectSubclass: (subclass: string) => void;
  onSelectFeats: (feats: string[]) => void;
  onSelectSkillChoices?: (choices: string[]) => void;
  onSelectSubclassChoices?: (choices: Record<string, any>) => void;
}

const getASILevels = (classFeatures: any[]): number[] => {
  if (!classFeatures) return [];
  const asiLevels: number[] = [];
  classFeatures.forEach((feature) => {
    if (
      typeof feature === "string" &&
      feature.includes("Ability Score Improvement")
    ) {
      const match = feature.match(/\|\|(\d+)$/);
      if (match) {
        const level = parseInt(match[1]);
        if (level >= 4) asiLevels.push(level);
      }
    }
  });
  return asiLevels.sort((a, b) => a - b);
};

interface Skill {
  name: string;
  ability?: string | string[];
  [key: string]: any;
}

export default function Step2Class({
  classes,
  selectedClass,
  selectedLevel = 1,
  selectedSubclass,
  selectedFeats = [],
  classSkillChoices = [],
  subclassChoices = {},
  onSelectClass,
  onSelectLevel,
  onSelectSubclass,
  onSelectFeats,
  onSelectSkillChoices,
  onSelectSubclassChoices,
}: Step2ClassProps) {
  const [selectedClassData, setSelectedClassData] = useState<Class | null>(null);
  const [subclasses, setSubclasses] = useState<Subclass[]>([]);
  const [selectedSubclassData, setSelectedSubclassData] = useState<Subclass | null>(null);
  const [subclassFeaturesData, setSubclassFeaturesData] = useState<any[]>([]);
  const [loadingSubclassFeatures, setLoadingSubclassFeatures] = useState(false);
  const [feats, setFeats] = useState<Feat[]>([]);
  const [showClassDetails, setShowClassDetails] = useState(false);
  const [showSubclassDetails, setShowSubclassDetails] = useState(false);
  const [showFeatDetails, setShowFeatDetails] = useState<string | null>(null);
  const [loadingSubclasses, setLoadingSubclasses] = useState(false);
  const [loadingFeats, setLoadingFeats] = useState(false);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

  // Get subclass level for a class (static mapping based on PHB and other sources)
  const getSubclassLevel = (className: string): number => {
    const subclassLevelMap: Record<string, number> = {
      // Level 1
      "Cleric": 1,
      "Sorcerer": 1,
      "Warlock": 1,
      "Mystic": 1,
      // Level 2
      "Wizard": 2,
      "Druid": 2,
      // Level 3
      "Fighter": 3,
      "Rogue": 3,
      "Bard": 3,
      "Barbarian": 3,
      "Monk": 3,
      "Paladin": 3,
      "Ranger": 3,
      "Artificer": 3,
    };
    return subclassLevelMap[className] || 3; // Default to 3 if unknown
  };

  const subclassLevel = selectedClass ? getSubclassLevel(selectedClass) : null;

  useEffect(() => {
    if (selectedClass) {
      const classData = classes.find((c) => c.name === selectedClass);
      setSelectedClassData(classData || null);
      
      // Load subclasses if level is high enough
      if (subclassLevel !== null && selectedLevel >= subclassLevel) {
        loadSubclasses(selectedClass);
      } else {
        setSubclasses([]);
        setSelectedSubclassData(null);
        onSelectSubclass(""); // Clear subclass if level is too low
      }
      
      if (selectedLevel >= 4) {
        loadFeats();
      }
    } else {
      setSelectedClassData(null);
      setSubclasses([]);
      setSelectedSubclassData(null);
    }
  }, [selectedClass, classes, selectedLevel, subclassLevel]);

  // Load full subclass data and features when selected
  useEffect(() => {
    if (selectedSubclass && selectedClass) {
      const loadFullSubclassData = async () => {
        try {
          const response = await fetch(
            apiUrl(`api/data/subclasses/${selectedClass}/${encodeURIComponent(selectedSubclass)}`)
          );
          if (response.ok) {
            const fullSubclassData = await response.json();
            console.log("[Step2Class] Loaded full subclass data:", fullSubclassData);
            setSelectedSubclassData(fullSubclassData);
            
            // Load subclass features data from class file
            if (fullSubclassData.subclassFeatures && fullSubclassData.subclassFeatures.length > 0) {
              setLoadingSubclassFeatures(true);
              try {
                // Load class file to get subclassFeature entries
                const classResponse = await fetch(
                  apiUrl(`api/data/classes/${selectedClass.toLowerCase()}`)
                );
                if (classResponse.ok) {
                  const classData = await classResponse.json();
                  
                  // Find subclassFeature entries in class data
                  const subclassFeatureEntries: any[] = [];
                  if (classData.subclassFeature && Array.isArray(classData.subclassFeature)) {
                    // Filter subclassFeature entries for this subclass
                    const subclassShortName = fullSubclassData.shortName || fullSubclassData.name;
                    console.log("[Step2Class] Looking for subclass features with:", {
                      className: selectedClass,
                      subclassShortName,
                      subclassName: fullSubclassData.name
                    });
                    
                    classData.subclassFeature.forEach((sf: any) => {
                      // Check if this subclassFeature belongs to the selected subclass
                      const matchesClass = sf.className === selectedClass;
                      const matchesSubclass = sf.subclassShortName === subclassShortName || 
                                             sf.subclassShortName === fullSubclassData.name ||
                                             sf.subclass === subclassShortName ||
                                             sf.subclass === fullSubclassData.name;
                      
                      if (matchesClass && matchesSubclass) {
                        // Only include features available at current level
                        if (!sf.level || sf.level <= selectedLevel) {
                          console.log("[Step2Class] Found matching subclassFeature:", sf.name, "level:", sf.level);
                          subclassFeatureEntries.push(sf);
                        }
                      }
                    });
                  }
                  
                  console.log("[Step2Class] Found subclassFeature entries:", subclassFeatureEntries);
                  setSubclassFeaturesData(subclassFeatureEntries);
                }
              } catch (e) {
                console.error("Error loading subclass features:", e);
                setSubclassFeaturesData([]);
              }
              setLoadingSubclassFeatures(false);
            }
            
            // Auto-expand details when subclass is selected
            setShowSubclassDetails(true);
          } else {
            console.warn("[Step2Class] Failed to load full subclass data, using basic data");
            // Fallback to basic subclass data from list
            const subclass = subclasses.find((s) => s.name === selectedSubclass);
            setSelectedSubclassData(subclass || null);
            setShowSubclassDetails(true);
          }
        } catch (error) {
          console.error("Error loading full subclass data:", error);
          // Fallback to basic subclass data from list
          const subclass = subclasses.find((s) => s.name === selectedSubclass);
          setSelectedSubclassData(subclass || null);
          setShowSubclassDetails(true);
        }
      };
      loadFullSubclassData();
    } else {
      setSelectedSubclassData(null);
      setSubclassFeaturesData([]);
      setShowSubclassDetails(false);
    }
  }, [selectedSubclass, selectedClass, subclasses, selectedLevel]);

  // Load skills if class has skill choices
  useEffect(() => {
    if (selectedClassData?.startingProficiencies?.skills) {
      const hasSkillChoice = selectedClassData.startingProficiencies.skills.some(
        (skill: any) => skill.choose
      );
      if (hasSkillChoice && allSkills.length === 0) {
        loadSkills();
      }
    } else {
      setAllSkills([]);
    }
  }, [selectedClassData]);

  const loadSkills = async () => {
    setLoadingSkills(true);
    try {
      const response = await fetch(apiUrl("api/data/skills"));
      if (response.ok) {
        const data = await response.json();
        setAllSkills(data.skills || []);
      }
    } catch (error) {
      console.error("Error loading skills:", error);
    } finally {
      setLoadingSkills(false);
    }
  };

  // Get skill choice info from class
  const getSkillChoice = () => {
    if (!selectedClassData?.startingProficiencies?.skills) return null;
    
    for (const skillChoice of selectedClassData.startingProficiencies.skills) {
      if (skillChoice.choose && skillChoice.choose.from && skillChoice.choose.count) {
        return {
          count: skillChoice.choose.count,
          from: skillChoice.choose.from.map((s: string) => s.toLowerCase()),
        };
      }
    }
    return null;
  };

  const skillChoice = getSkillChoice();

  const handleSkillChoiceChange = (index: number, value: string) => {
    if (!onSelectSkillChoices || !skillChoice) return;
    
    const newChoices = [...classSkillChoices];
    newChoices[index] = value;
    
    // Ensure unique selections
    const uniqueChoices = Array.from(new Set(newChoices.filter(Boolean)));
    if (uniqueChoices.length <= skillChoice.count) {
      // Pad with empty strings to maintain array length
      while (uniqueChoices.length < skillChoice.count) {
        uniqueChoices.push("");
      }
      onSelectSkillChoices(uniqueChoices);
    }
  };

  const loadSubclasses = async (className: string) => {
    try {
      setLoadingSubclasses(true);
      const response = await fetch(
        apiUrl(`api/data/classes/${className}/subclasses`)
      );
      if (response.ok) {
        const data = await response.json();
        setSubclasses(data);
        if (selectedSubclass && !data.find((s: Subclass) => s.name === selectedSubclass)) {
          onSelectSubclass("");
        }
      } else {
        setSubclasses([]);
      }
    } catch (error) {
      console.error("Error loading subclasses:", error);
      setSubclasses([]);
    } finally {
      setLoadingSubclasses(false);
    }
  };

  const loadFeats = async () => {
    try {
      setLoadingFeats(true);
      const response = await fetch(apiUrl("api/data/feats/phb"));
      if (response.ok) {
        const data = await response.json();
        setFeats(data);
      }
    } catch (error) {
      console.error("Error loading feats:", error);
    } finally {
      setLoadingFeats(false);
    }
  };

  const asiLevels = useMemo(() => {
    if (!selectedClassData?.classFeatures) return [];
    return getASILevels(selectedClassData.classFeatures);
  }, [selectedClassData]);

  const availableASILevels = useMemo(() => {
    return asiLevels.filter((level) => selectedLevel >= level);
  }, [asiLevels, selectedLevel]);

  const handleFeatToggle = (featName: string) => {
    if (selectedFeats.includes(featName)) {
      onSelectFeats(selectedFeats.filter((f) => f !== featName));
    } else {
      // Check if we can add more feats (one per ASI level)
      if (selectedFeats.length < availableASILevels.length) {
        onSelectFeats([...selectedFeats, featName]);
      }
    }
  };


  const formatEntry = (entry: any): string => {
    if (typeof entry === "string") {
      return parseText(entry);
    }
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

  const getClassDescription = (classData: Class): any[] => {
    const descriptions: any[] = [];
    
    // Try to get description from various possible fields
    if (classData.entries && Array.isArray(classData.entries)) {
      classData.entries.forEach((entry: any) => {
        if (typeof entry === "string") {
          descriptions.push({ type: "text", content: formatEntry(entry) });
        } else if (entry && typeof entry === "object" && entry.name) {
          descriptions.push({
            type: "feature",
            name: entry.name,
            content: formatEntry(entry),
          });
        }
      });
    }
    
    // If no entries, provide basic info
    if (descriptions.length === 0) {
      descriptions.push({
        type: "text",
        content: `${classData.name} là một lớp trong D&D 5e.`,
      });
      if (classData.hd) {
        descriptions.push({
          type: "text",
          content: `Hit Die: d${classData.hd.faces}`,
        });
      }
      if (classData.spellcastingAbility) {
        descriptions.push({
          type: "text",
          content: `Khả năng phép thuật: ${classData.spellcastingAbility.toUpperCase()}`,
        });
      }
    }
    
    return descriptions;
  };

  const formatClassFeature = (feature: any): { name: string; level: string } => {
    if (typeof feature === "string") {
      const parts = feature.split("|");
      const name = parts[0] || "Unknown";
      const levelMatch = feature.match(/\|\|(\d+)/);
      const level = levelMatch ? levelMatch[1] : "";
      return { name, level };
    } else if (feature && typeof feature === "object" && feature.classFeature) {
      const parts = feature.classFeature.split("|");
      const name = parts[0] || "Unknown";
      const levelMatch = feature.classFeature.match(/\|\|(\d+)/);
      const level = levelMatch ? levelMatch[1] : "";
      return { name, level };
    }
    return { name: "Unknown", level: "" };
  };

  return (
    <div>
      <h2 className="mb-4 font-display text-2xl text-ink">Bước 2: Chọn lớp</h2>
      <p className="mb-6 text-slate-600">
        Lớp xác định nghề nghiệp và khả năng đặc biệt của nhân vật. Mỗi lớp có các
        tính năng riêng, thành thạo vũ khí/giáp, và kỹ năng.
      </p>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Chọn lớp *
          </label>
          <select
            value={selectedClass || ""}
            onChange={(e) => {
              onSelectClass(e.target.value);
              onSelectSubclass("");
              onSelectFeats([]);
            }}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            required
          >
            <option value="">-- Chọn lớp --</option>
            {classes.map((cls) => (
              <option key={cls.name} value={cls.name}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Cấp độ (1-20) *
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={selectedLevel}
            onChange={(e) => onSelectLevel(parseInt(e.target.value))}
            className="w-full accent-amber-500"
          />
          <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
            <span>Cấp độ {selectedLevel}</span>
            <span>Hệ số thành thạo: +{Math.floor((selectedLevel - 1) / 4) + 2}</span>
          </div>
        </div>

        {selectedClassData && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-6">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="font-display text-xl text-ink">
                {selectedClassData.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowClassDetails(!showClassDetails)}
                className="text-sm text-amber-700 underline-offset-2 hover:underline"
              >
                {showClassDetails ? "Ẩn chi tiết" : "Xem chi tiết"}
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-slate-700">Hit Die:</span> d
                {selectedClassData.hd?.faces || 8}
              </div>
              <div>
                <span className="font-medium text-slate-700">Thành thạo Saving Throw:</span>{" "}
                {selectedClassData.proficiency
                  ?.map((p) => p.toUpperCase())
                  .join(", ") || "N/A"}
              </div>
              {selectedClassData.startingProficiencies?.armor && (
                <div>
                  <span className="font-medium text-slate-700">Thành thạo Giáp:</span>{" "}
                  {selectedClassData.startingProficiencies.armor.join(", ")}
                </div>
              )}
              {selectedClassData.startingProficiencies?.weapons && (
                <div>
                  <span className="font-medium text-slate-700">Thành thạo Vũ khí:</span>{" "}
                  <span>
                    {selectedClassData.startingProficiencies.weapons
                      .map(parseItemName)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>

            {showClassDetails && (
              <div className="mt-6 space-y-2 border-t border-amber-200 pt-4 text-sm text-slate-600">
                {selectedClassData.entries && getAllEntries(selectedClassData.entries).length > 0 ? (
                  getAllEntries(selectedClassData.entries)
                    .slice(0, 5)
                    .map((entry: any, idx: number) => (
                      <div key={idx} className="rounded-lg bg-white/50 p-3">
                        <div className="font-medium text-slate-700 mb-1">{entry.name}</div>
                        <div className="text-slate-600">
                          {Array.isArray(entry.entries)
                            ? entry.entries
                                .filter((e: any) => typeof e === "string")
                                .slice(0, 2)
                                .map((e: string, i: number) => (
                                  <div key={i}>
                                    <TextWithTooltips text={e} />
                                  </div>
                                ))
                            : <TextWithTooltips text={formatEntry(entry)} />}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="space-y-2">
                    {getClassDescription(selectedClassData).map((desc, idx) => (
                      <div key={idx} className="rounded-lg bg-white/50 p-3 text-slate-600">
                        {desc.type === "feature" ? (
                          <>
                            <div className="font-medium text-slate-700 mb-1">{desc.name}</div>
                            <div>{desc.content}</div>
                          </>
                        ) : (
                          <div>{desc.content}</div>
                        )}
                      </div>
                    ))}
                    {selectedClassData.classFeatures && selectedClassData.classFeatures.length > 0 && (
                      <div className="mt-3 rounded-lg bg-white/50 p-3">
                        <div className="font-medium text-slate-700 mb-2">
                          Class Features (theo level):
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                          {selectedClassData.classFeatures
                            .slice(0, 15)
                            .map((feature: any, idx: number) => {
                              const { name, level } = formatClassFeature(feature);
                              const cleanName = formatEntry(name);
                              // Create a FeatureTooltip component that loads data on hover
                              return (
                                <FeatureTooltip
                                  key={idx}
                                  featureName={cleanName}
                                  level={level}
                                />
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selectedClassData && subclassLevel !== null && selectedLevel >= subclassLevel && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Chọn {selectedClassData.subclassTitle || "Subclass"} * (Level {subclassLevel})
            </label>
            {loadingSubclasses ? (
              <div className="text-sm text-slate-500">Đang tải...</div>
            ) : subclasses.length > 0 ? (
              <select
                value={selectedSubclass || ""}
                onChange={(e) => onSelectSubclass(e.target.value)}
                className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
                required
              >
                <option value="">-- Chọn {selectedClassData.subclassTitle || "Subclass"} --</option>
                {subclasses.map((subclass) => (
                  <option key={subclass.name} value={subclass.name}>
                    {subclass.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-amber-600">Không tìm thấy subclass cho class này.</div>
            )}

            {selectedSubclassData && (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
                <div className="mb-2 flex items-start justify-between">
                  <h4 className="font-medium text-slate-700">
                    {selectedSubclassData.name}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowSubclassDetails(!showSubclassDetails)}
                    className="text-xs text-amber-700 underline-offset-2 hover:underline"
                  >
                    {showSubclassDetails ? "Ẩn" : "Chi tiết"}
                  </button>
                </div>
                {showSubclassDetails && (
                  <div className="mt-3 space-y-3 border-t border-amber-200 pt-3 text-sm">
                    {loadingSubclassFeatures ? (
                      <div className="text-slate-500 text-sm">Đang tải chi tiết...</div>
                    ) : (
                      <>
                        {/* Show entries from subclass data if available */}
                        {selectedSubclassData.entries && getAllEntries(selectedSubclassData.entries).length > 0 && (
                          getAllEntries(selectedSubclassData.entries).map((entry: any, idx: number) => {
                            // Check if entry has choices
                            const hasChoice = entry.choose && entry.choose.from && entry.choose.count;
                            const choiceKey = entry.name || `choice_${idx}`;
                            const currentChoice = subclassChoices[choiceKey];
                            
                            return (
                              <div key={idx} className="rounded-lg bg-white/50 p-3">
                                <div className="font-medium text-slate-700 mb-2">
                                  {entry.name}
                                </div>
                                <div className="text-slate-600 space-y-2">
                                  {Array.isArray(entry.entries)
                                    ? entry.entries
                                        .filter((e: any) => typeof e === "string")
                                        .map((e: string, i: number) => (
                                          <div key={i}>
                                            <TextWithTooltips text={e} />
                                          </div>
                                        ))
                                    : <TextWithTooltips text={formatEntry(entry)} />}
                                  
                                  {/* Show choice UI if entry has choices */}
                                  {hasChoice && (
                                    <div className="mt-3 pt-3 border-t border-amber-200">
                                      <label className="block text-xs font-medium text-slate-700 mb-2">
                                        Chọn {entry.choose.count} {entry.choose.count === 1 ? "lựa chọn" : "lựa chọn"}:
                                      </label>
                                      {Array.isArray(entry.choose.from) ? (
                                        <div className="space-y-2">
                                          {entry.choose.from.map((option: any, optIdx: number) => {
                                            const optionName = typeof option === "string" ? option : option.name || option;
                                            const optionValue = typeof option === "string" ? option : option.name || option;
                                            const isSelected = Array.isArray(currentChoice) 
                                              ? currentChoice.includes(optionValue)
                                              : currentChoice === optionValue;
                                            
                                            return (
                                              <label key={optIdx} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type={entry.choose.count === 1 ? "radio" : "checkbox"}
                                                  name={choiceKey}
                                                  checked={isSelected}
                                                  onChange={() => {
                                                    if (!onSelectSubclassChoices) return;
                                                    
                                                    const newChoices = { ...subclassChoices };
                                                    
                                                    if (entry.choose.count === 1) {
                                                      // Single choice (radio)
                                                      newChoices[choiceKey] = optionValue;
                                                    } else {
                                                      // Multiple choices (checkbox)
                                                      const currentArray = Array.isArray(currentChoice) ? currentChoice : currentChoice ? [currentChoice] : [];
                                                      const index = currentArray.indexOf(optionValue);
                                                      
                                                      if (index > -1) {
                                                        currentArray.splice(index, 1);
                                                      } else if (currentArray.length < entry.choose.count) {
                                                        currentArray.push(optionValue);
                                                      }
                                                      
                                                      newChoices[choiceKey] = currentArray;
                                                    }
                                                    
                                                    onSelectSubclassChoices(newChoices);
                                                  }}
                                                  className="accent-amber-600"
                                                />
                                                <span className="text-slate-700">{optionName}</span>
                                              </label>
                                            );
                                          })}
                                          {currentChoice && (
                                            <div className="text-xs text-amber-700 mt-2">
                                              Đã chọn: {Array.isArray(currentChoice) ? currentChoice.join(", ") : currentChoice}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-slate-500">
                                          Không có lựa chọn khả dụng
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                        
                        {/* Show features data with entries and choices */}
                        {subclassFeaturesData.length > 0 && subclassFeaturesData.map((feature: any, idx: number) => {
                          if (!feature || !feature.entries) return null;
                          
                          console.log(`[Step2Class] Rendering feature: ${feature.name}`, feature);
                          
                          // Check if feature has a table with choices (like Dragon Ancestor)
                          const hasTable = feature.entries.some((e: any) => e.type === "table" && e.caption && e.caption.includes("Draconic Ancestry"));
                          const choiceKey = `Dragon Ancestor_${feature.name}`;
                          const currentChoice = subclassChoices[choiceKey];
                          
                          // Dragon types from the table
                          const dragonTypes = hasTable ? [
                            "Black", "Blue", "Brass", "Bronze", "Copper", 
                            "Gold", "Green", "Red", "Silver", "White"
                          ] : null;
                          
                          return (
                            <div key={idx} className="rounded-lg bg-white/50 p-3">
                              <div className="font-medium text-slate-700 mb-2">
                                {feature.name}
                              </div>
                              <div className="text-slate-600 space-y-2">
                                {/* Render all entries */}
                                {feature.entries.map((entry: any, entryIdx: number) => {
                                  if (typeof entry === "string") {
                                    return (
                                      <div key={entryIdx}>
                                        <TextWithTooltips text={entry} />
                                      </div>
                                    );
                                  } else if (entry && typeof entry === "object") {
                                    // Skip table for now, we'll add choice UI below
                                    if (entry.type === "table") {
                                      return null; // Skip table rendering, we'll show choice UI instead
                                    }
                                    // Render other entry types
                                    if (entry.entries && Array.isArray(entry.entries)) {
                                      return entry.entries
                                        .filter((e: any) => typeof e === "string")
                                        .map((e: string, i: number) => (
                                          <div key={`${entryIdx}_${i}`}>
                                            <TextWithTooltips text={e} />
                                          </div>
                                        ));
                                    }
                                  }
                                  return null;
                                })}
                                
                                {/* Show dragon type choice if this is Dragon Ancestor feature */}
                                {hasTable && dragonTypes && (
                                  <div className="mt-3 pt-3 border-t border-amber-200">
                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                      Chọn loại rồng (Dragon Ancestor):
                                    </label>
                                    <div className="space-y-2">
                                      {dragonTypes.map((dragonType: string) => {
                                        const isSelected = currentChoice === dragonType;
                                        
                                        return (
                                          <label key={dragonType} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                              type="radio"
                                              name={choiceKey}
                                              checked={isSelected}
                                              onChange={() => {
                                                if (!onSelectSubclassChoices) return;
                                                const newChoices = { ...subclassChoices };
                                                newChoices[choiceKey] = dragonType;
                                                onSelectSubclassChoices(newChoices);
                                              }}
                                              className="accent-amber-600"
                                            />
                                            <span className="text-slate-700">{dragonType}</span>
                                          </label>
                                        );
                                      })}
                                      {currentChoice && (
                                        <div className="text-xs text-amber-700 mt-2">
                                          Đã chọn: {currentChoice}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Show choice UI if entry has choices */}
                                {feature.choose && feature.choose.from && feature.choose.count && (
                                  <div className="mt-3 pt-3 border-t border-amber-200">
                                    <label className="block text-xs font-medium text-slate-700 mb-2">
                                      Chọn {feature.choose.count} {feature.choose.count === 1 ? "lựa chọn" : "lựa chọn"}:
                                    </label>
                                    {Array.isArray(feature.choose.from) ? (
                                      <div className="space-y-2">
                                        {feature.choose.from.map((option: any, optIdx: number) => {
                                          const optionName = typeof option === "string" ? option : option.name || option;
                                          const optionValue = typeof option === "string" ? option : option.name || option;
                                          const isSelected = Array.isArray(currentChoice) 
                                            ? currentChoice.includes(optionValue)
                                            : currentChoice === optionValue;
                                          
                                          return (
                                            <label key={optIdx} className="flex items-center gap-2 cursor-pointer">
                                              <input
                                                type={feature.choose.count === 1 ? "radio" : "checkbox"}
                                                name={choiceKey}
                                                checked={isSelected}
                                                onChange={() => {
                                                  if (!onSelectSubclassChoices) return;
                                                  
                                                  const newChoices = { ...subclassChoices };
                                                  
                                                  if (feature.choose.count === 1) {
                                                    newChoices[choiceKey] = optionValue;
                                                  } else {
                                                    const currentArray = Array.isArray(currentChoice) ? currentChoice : currentChoice ? [currentChoice] : [];
                                                    const index = currentArray.indexOf(optionValue);
                                                    
                                                    if (index > -1) {
                                                      currentArray.splice(index, 1);
                                                    } else if (currentArray.length < feature.choose.count) {
                                                      currentArray.push(optionValue);
                                                    }
                                                    
                                                    newChoices[choiceKey] = currentArray;
                                                  }
                                                  
                                                  onSelectSubclassChoices(newChoices);
                                                }}
                                                className="accent-amber-600"
                                              />
                                              <span className="text-slate-700">{optionName}</span>
                                            </label>
                                          );
                                        })}
                                        {currentChoice && (
                                          <div className="text-xs text-amber-700 mt-2">
                                            Đã chọn: {Array.isArray(currentChoice) ? currentChoice.join(", ") : currentChoice}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-500">
                                        Không có lựa chọn khả dụng
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selectedClassData &&
          selectedLevel >= 4 &&
          availableASILevels.length > 0 &&
          (loadingFeats ? (
            <div className="text-sm text-slate-500">Đang tải feats...</div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Chọn Feat hoặc Tăng chỉ số (Ability Score Improvement)
              </label>
              <p className="mb-3 text-xs text-slate-500">
                Bạn có {availableASILevels.length} lựa chọn ở cấp độ{" "}
                {availableASILevels.join(", ")}. Mỗi lựa chọn: chọn 1 Feat HOẶC tăng 2
                chỉ số (hoặc 1 chỉ số +2).
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto rounded-2xl border border-amber-100 bg-white p-4">
                {feats.map((feat) => {
                  const isSelected = selectedFeats.includes(feat.name);
                  const canSelect =
                    selectedFeats.length < availableASILevels.length;
                  return (
                    <div
                      key={feat.name}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                        isSelected
                          ? "border-amber-500 bg-amber-50"
                          : canSelect
                          ? "border-slate-200 hover:border-amber-300"
                          : "border-slate-200 opacity-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleFeatToggle(feat.name)}
                        disabled={!isSelected && !canSelect}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-slate-700">{feat.name}</div>
                            {feat.ability && feat.ability.length > 0 && (
                              <div className="mt-1 text-xs text-slate-500">
                                Tăng:{" "}
                                {Object.entries(feat.ability[0])
                                  .filter(([_, v]) => typeof v === "number" && v > 0)
                                  .map(([k, v]) => `${k.toUpperCase()} +${v}`)
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setShowFeatDetails(
                                showFeatDetails === feat.name ? null : feat.name
                              )
                            }
                            className="text-xs text-amber-700 underline-offset-2 hover:underline"
                          >
                            {showFeatDetails === feat.name ? "Ẩn" : "Chi tiết"}
                          </button>
                        </div>
                        {showFeatDetails === feat.name && feat.entries && (
                          <div className="mt-2 space-y-1 border-t border-amber-200 pt-2 text-xs text-slate-600">
                            {feat.entries
                              .filter((e: any) => typeof e === "string")
                              .slice(0, 2)
                              .map((e: string, i: number) => (
                                <div key={i}>
                                  <TextWithTooltips text={e} />
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedFeats.length > 0 && (
                <div className="mt-3 text-sm text-slate-600">
                  <strong>Đã chọn:</strong> {selectedFeats.join(", ")} (
                  {selectedFeats.length}/{availableASILevels.length})
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
