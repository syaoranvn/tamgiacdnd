import { useState, useEffect, useRef } from "react";
import type { Character, Class } from "../../types";
import TextWithTooltips from "../TextWithTooltips";
import Tooltip from "../Tooltip";
import TooltipContent from "../TooltipContent";
import ConfirmDialog from "../ConfirmDialog";
import { apiUrl } from "../../config/api";

interface Step9SpellsProps {
  character: Partial<Character>;
  onUpdate: (updates: Partial<Character>) => void;
}

interface Spell {
  name: string;
  level: number;
  school: string;
  time: any[];
  range: any;
  components: any;
  duration: any[];
  entries: any[];
  [key: string]: any;
}

export default function Step9Spells({
  character,
  onUpdate,
}: Step6SpellsProps) {
  const [classData, setClassData] = useState<Class | null>(null);
  const [allSpells, setAllSpells] = useState<Spell[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpells, setSelectedSpells] = useState<{
    cantrips?: string[];
    level1?: string[];
    level2?: string[];
    level3?: string[];
    level4?: string[];
    level5?: string[];
    level6?: string[];
    level7?: string[];
    level8?: string[];
    level9?: string[];
  }>(character.spells || {});
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);
  const [spellDetails, setSpellDetails] = useState<any>(null);
  const [loadingSpellDetails, setLoadingSpellDetails] = useState(false);
  const [showRitualOnly, setShowRitualOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [showConcentrationOnly, setShowConcentrationOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [comparisonSpells, setComparisonSpells] = useState<string[]>([]);
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });
  const [showComparison, setShowComparison] = useState(false);
  const [viewMode, setViewMode] = useState<"level" | "school">("level");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [mouseDownTime, setMouseDownTime] = useState<number>(0);
  const [mouseDownSpell, setMouseDownSpell] = useState<string | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Spellcasting classes
  const spellcastingClasses = ["Wizard", "Sorcerer", "Warlock", "Cleric", "Druid", "Bard", "Ranger", "Paladin"];

  useEffect(() => {
    if (character.className && spellcastingClasses.includes(character.className)) {
      loadClassData(character.className);
      loadSpells(character.className, character.level || 1);
    }
  }, [character.className, character.level]);

  useEffect(() => {
    // Update character spells when selectedSpells changes
    onUpdate({ spells: selectedSpells });
  }, [selectedSpells]);

  const loadClassData = async (className: string) => {
    try {
      const response = await fetch(
        apiUrl(`api/data/classes/${className.toLowerCase()}`)
      );
      if (response.ok) {
        const data = await response.json();
        setClassData(data);
      }
    } catch (error) {
      console.error("Error loading class data:", error);
    }
  };

  const loadSpells = async (className: string, level: number) => {
    try {
      setLoading(true);
      const response = await fetch(
        apiUrl(`api/data/spells/class/${className}?level=${level}`)
      );
      if (response.ok) {
        const data = await response.json();
        setAllSpells(data);
      }
    } catch (error) {
      console.error("Error loading spells:", error);
    } finally {
      setLoading(false);
    }
  };

  // Determine if class uses prepared spells or known spells
  const isPreparedSpellcaster = () => {
    if (!classData) return false;
    // Classes with preparedSpells: Cleric, Druid, Paladin, Wizard
    return !!classData.preparedSpells;
  };

  // Calculate spells known/prepared based on class and level
  const getSpellLimits = () => {
    if (!classData || !character.level) return null;

    const level = character.level;
    const limits: {
      cantrips?: number;
      spellsKnown?: number;
      preparedSpells?: string; // Formula like "<$level$> + <$int_mod$>"
      isPrepared?: boolean;
    } = {};

    // Get cantrip progression
    if (classData.cantripProgression && Array.isArray(classData.cantripProgression)) {
      limits.cantrips = classData.cantripProgression[level - 1] || 0;
    }

    // Determine if prepared or known
    limits.isPrepared = isPreparedSpellcaster();

    if (limits.isPrepared) {
      // Prepared spellcasters: Cleric, Druid, Paladin, Wizard
      // Get prepared spells formula
      if (classData.preparedSpells) {
        limits.preparedSpells = classData.preparedSpells;
      }
      
      // For Wizard: also track spells in spellbook
      if (classData.spellsKnownProgressionFixed && Array.isArray(classData.spellsKnownProgressionFixed)) {
        if (level === 1) {
          limits.spellsKnown = classData.spellsKnownProgressionFixed[0] || 6;
        } else {
          const initial = classData.spellsKnownProgressionFixed[0] || 6;
          const perLevel = classData.spellsKnownProgressionFixed[1] || 2;
          limits.spellsKnown = initial + (level - 1) * perLevel;
        }
      }
    } else {
      // Known spellcasters: Bard, Sorcerer, Warlock, Ranger
      // Get spells known progression
      if (classData.spellsKnownProgression && Array.isArray(classData.spellsKnownProgression)) {
        limits.spellsKnown = classData.spellsKnownProgression[level - 1] || 0;
      }
    }

    return limits;
  };

  const spellLimits = getSpellLimits();

  // Get max spell level available at character level
  const getMaxSpellLevel = () => {
    if (!character.level) return 0;
    return Math.min(9, Math.ceil(character.level / 2));
  };

  const maxSpellLevel = getMaxSpellLevel();

  // Get ability modifier for prepared spells calculation
  const getAbilityModifier = () => {
    if (!classData?.spellcastingAbility || !character.abilityScores) return 0;
    const abilityKey = classData.spellcastingAbility.toLowerCase();
    const score = character.abilityScores[abilityKey as keyof typeof character.abilityScores] || 10;
    return Math.floor((score - 10) / 2);
  };

  // Calculate prepared spells count
  const getPreparedSpellsCount = () => {
    if (!spellLimits?.preparedSpells || !character.level) return null;
    
    // Parse formula like "<$level$> + <$int_mod$>" or "<$level$> / 2 + <$cha_mod$>"
    const formula = spellLimits.preparedSpells;
    const level = character.level;
    const abilityMod = getAbilityModifier();
    
    // Parse different formula patterns
    if (formula.includes("level") && formula.includes("mod")) {
      // Check for half caster (Paladin, Ranger)
      if (formula.includes("/ 2")) {
        return Math.floor(level / 2) + abilityMod;
      }
      // Full caster (Cleric, Druid, Wizard)
      return level + abilityMod;
    }
    
    return null;
  };

  const preparedSpellsCount = getPreparedSpellsCount();
  const isPrepared = spellLimits?.isPrepared || false;

  // Get spell slots progression
  const getSpellSlots = () => {
    if (!classData || !character.level) return null;

    // Find spell slots table in classTableGroups
    const classTableGroups = classData.classTableGroups;
    if (!classTableGroups || !Array.isArray(classTableGroups)) return null;

    // Try to find standard spell slots table (for full/half casters)
    let spellSlotsTable = classTableGroups.find(
      (group: any) => group.title === "Spell Slots per Spell Level" && group.rowsSpellProgression
    );

    if (spellSlotsTable?.rowsSpellProgression) {
      const level = character.level;
      const slotsRow = spellSlotsTable.rowsSpellProgression[level - 1];

      if (!slotsRow || !Array.isArray(slotsRow)) return null;

      // Return spell slots for current level [1st, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th, 9th]
      return {
        level1: slotsRow[0] || 0,
        level2: slotsRow[1] || 0,
        level3: slotsRow[2] || 0,
        level4: slotsRow[3] || 0,
        level5: slotsRow[4] || 0,
        level6: slotsRow[5] || 0,
        level7: slotsRow[6] || 0,
        level8: slotsRow[7] || 0,
        level9: slotsRow[8] || 0,
        allRows: spellSlotsTable.rowsSpellProgression, // For displaying full table
        isWarlock: false,
      };
    }

    // Try to find Warlock-style table (has "Spell Slots" and "Slot Level" columns)
    const warlockTable = classTableGroups.find(
      (group: any) => group.colLabels && 
      group.colLabels.includes("Spell Slots") && 
      group.colLabels.includes("Slot Level") &&
      group.rows
    );

    if (warlockTable?.rows) {
      const level = character.level;
      const row = warlockTable.rows[level - 1];

      if (!row || !Array.isArray(row)) return null;

      // Warlock table structure: [Cantrips, Spells Known, Spell Slots, Slot Level, Invocations]
      const spellSlotsCount = typeof row[2] === "number" ? row[2] : 0;
      const slotLevel = typeof row[3] === "string" ? row[3] : "1st";
      
      // Extract slot level number from string like "{@filter 1st|spells|level=1|class=Warlock}"
      const slotLevelMatch = slotLevel.match(/level=(\d+)/);
      const slotLevelNum = slotLevelMatch ? parseInt(slotLevelMatch[1]) : 1;

      // Warlock only has one type of slot at each level
      const slots: Record<string, number> = {
        level1: 0,
        level2: 0,
        level3: 0,
        level4: 0,
        level5: 0,
        level6: 0,
        level7: 0,
        level8: 0,
        level9: 0,
      };
      
      if (slotLevelNum >= 1 && slotLevelNum <= 9) {
        slots[`level${slotLevelNum}` as keyof typeof slots] = spellSlotsCount;
      }

      return {
        ...slots,
        allRows: warlockTable.rows,
        isWarlock: true,
        warlockSlotLevel: slotLevelNum,
        warlockSlotCount: spellSlotsCount,
      };
    }

    return null;
  };

  const spellSlots = getSpellSlots();

  // Filter spells by level
  const getSpellsByLevel = (spellLevel: number) => {
    let filtered = allSpells.filter(spell => spell.level === spellLevel);
    
    // Filter by ritual if enabled
    if (showRitualOnly) {
      filtered = filtered.filter(spell => spell.meta?.ritual === true);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(spell => 
        spell.name.toLowerCase().includes(query) ||
        (spell.school && getSchoolName(spell.school).toLowerCase().includes(query))
      );
    }
    
    // Filter by school
    if (selectedSchools.length > 0) {
      filtered = filtered.filter(spell => 
        spell.school && selectedSchools.includes(spell.school)
      );
    }
    
    // Filter by level (additional level filter)
    if (selectedLevels.length > 0) {
      filtered = filtered.filter(spell => selectedLevels.includes(spell.level));
    }
    
    // Filter by components
    if (selectedComponents.length > 0) {
      filtered = filtered.filter(spell => {
        if (!spell.components) return false;
        return selectedComponents.some(comp => {
          if (comp === "V") return spell.components.v === true;
          if (comp === "S") return spell.components.s === true;
          if (comp === "M") return !!spell.components.m;
          return false;
        });
      });
    }
    
    // Filter by concentration
    if (showConcentrationOnly) {
      filtered = filtered.filter(spell => {
        if (!spell.duration || !Array.isArray(spell.duration)) return false;
        return spell.duration.some((d: any) => d.concentration === true);
      });
    }
    
    return filtered;
  };

  // Get school name from abbreviation
  const getSchoolName = (school: string) => {
    const schoolMap: Record<string, string> = {
      "A": "Abjuration",
      "C": "Conjuration",
      "D": "Divination",
      "E": "Enchantment",
      "V": "Evocation",
      "I": "Illusion",
      "N": "Necromancy",
      "T": "Transmutation",
    };
    return schoolMap[school] || school;
  };

  // Get spells by school
  const getSpellsBySchool = (school: string) => {
    let filtered = allSpells.filter(spell => spell.school === school);
    
    // Apply all filters
    if (showRitualOnly) {
      filtered = filtered.filter(spell => spell.meta?.ritual === true);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(spell => 
        spell.name.toLowerCase().includes(query) ||
        (spell.school && getSchoolName(spell.school).toLowerCase().includes(query))
      );
    }
    
    if (selectedLevels.length > 0) {
      filtered = filtered.filter(spell => selectedLevels.includes(spell.level));
    }
    
    if (selectedComponents.length > 0) {
      filtered = filtered.filter(spell => {
        if (!spell.components) return false;
        return selectedComponents.some(comp => {
          if (comp === "V") return spell.components.v === true;
          if (comp === "S") return spell.components.s === true;
          if (comp === "M") return !!spell.components.m;
          return false;
        });
      });
    }
    
    if (showConcentrationOnly) {
      filtered = filtered.filter(spell => {
        if (!spell.duration || !Array.isArray(spell.duration)) return false;
        return spell.duration.some((d: any) => d.concentration === true);
      });
    }
    
    // Group by level
    const grouped: Record<number, Spell[]> = {};
    filtered.forEach(spell => {
      if (!grouped[spell.level]) {
        grouped[spell.level] = [];
      }
      grouped[spell.level].push(spell);
    });
    
    // Sort spells within each level
    Object.keys(grouped).forEach(level => {
      grouped[parseInt(level)].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return grouped;
  };

  // Get all schools present in spells
  const getAllSchools = () => {
    const schools = new Set<string>();
    allSpells.forEach(spell => {
      if (spell.school) {
        schools.add(spell.school);
      }
    });
    return Array.from(schools).sort();
  };

  // Load spell details
  const loadSpellDetails = async (spellName: string) => {
    if (spellDetails && spellDetails.name === spellName) return; // Already loaded
    
    setLoadingSpellDetails(true);
    try {
      const response = await fetch(
        apiUrl(`api/data/spells/${encodeURIComponent(spellName)}`)
      );
      if (response.ok) {
        const data = await response.json();
        setSpellDetails(data);
      }
    } catch (error) {
      console.error("Error loading spell details:", error);
    } finally {
      setLoadingSpellDetails(false);
    }
  };

  // Handle spell details view
  const handleViewSpellDetails = (spellName: string) => {
    const spell = allSpells.find(s => s.name === spellName);
    if (spell) {
      setViewingSpell(spell);
      loadSpellDetails(spellName);
    }
  };

  // Handle spell comparison
  const handleToggleComparison = (spellName: string) => {
    if (comparisonSpells.includes(spellName)) {
      setComparisonSpells(comparisonSpells.filter(s => s !== spellName));
    } else {
      if (comparisonSpells.length < 4) {
        setComparisonSpells([...comparisonSpells, spellName]);
      } else {
        setAlertDialog({
          isOpen: true,
          title: "Giới hạn so sánh",
          message: "Bạn chỉ có thể so sánh tối đa 4 spells cùng lúc",
        });
      }
    }
  };

  // Load comparison spell details
  const [comparisonSpellDetails, setComparisonSpellDetails] = useState<Record<string, any>>({});
  const [loadingComparison, setLoadingComparison] = useState<Record<string, boolean>>({});

  useEffect(() => {
    comparisonSpells.forEach(async (spellName) => {
      if (!comparisonSpellDetails[spellName] && !loadingComparison[spellName]) {
        setLoadingComparison(prev => ({ ...prev, [spellName]: true }));
        try {
          const response = await fetch(
            apiUrl(`api/data/spells/${encodeURIComponent(spellName)}`)
          );
          if (response.ok) {
            const data = await response.json();
            setComparisonSpellDetails(prev => ({ ...prev, [spellName]: data }));
          }
        } catch (error) {
          console.error("Error loading comparison spell:", error);
        } finally {
          setLoadingComparison(prev => ({ ...prev, [spellName]: false }));
        }
      }
    });
  }, [comparisonSpells]);

  // Toggle section open/close
  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Handle spell selection
  const handleSpellToggle = (spellName: string, spellLevel: number, e?: React.MouseEvent) => {
    // If Ctrl+Click or right-click, show details instead
    if (e && (e.ctrlKey || e.metaKey || e.button === 2)) {
      e.preventDefault();
      handleViewSpellDetails(spellName);
      return;
    }
    
    // Normal click - just select/deselect
    const levelKey = spellLevel === 0 ? "cantrips" : `level${spellLevel}` as keyof typeof selectedSpells;
    const current = selectedSpells[levelKey] || [];
    const index = current.indexOf(spellName);

    let newSelected: string[];
    if (index > -1) {
      // Remove spell
      newSelected = current.filter(s => s !== spellName);
    } else {
      // Add spell (check limits)
      if (spellLevel === 0) {
        // Cantrips
        const maxCantrips = spellLimits?.cantrips || 0;
        if (current.length < maxCantrips) {
          newSelected = [...current, spellName];
        } else {
          return; // Can't add more cantrips
        }
      } else {
        // Regular spells
        if (isPrepared) {
          // Prepared spellcasters: can prepare from full spell list
          // For Wizard: also limited by spells in spellbook
          if (spellLimits?.spellsKnown !== undefined) {
            // Wizard: limited by spells in spellbook
            const totalSelected = Object.values(selectedSpells)
              .flat()
              .filter(s => !selectedSpells.cantrips?.includes(s) && s !== spellName).length;
            
            if (totalSelected < spellLimits.spellsKnown) {
              newSelected = [...current, spellName];
            } else {
              return; // Can't add more spells to spellbook
            }
          } else {
            // Other prepared casters: no limit on selection (can prepare from full list)
            newSelected = [...current, spellName];
          }
        } else {
          // Known spellcasters: limited by spells known
          const maxSpells = spellLimits?.spellsKnown || 0;
          const totalSelected = Object.values(selectedSpells)
            .flat()
            .filter(s => !selectedSpells.cantrips?.includes(s) && s !== spellName).length;
          
          if (totalSelected < maxSpells) {
            newSelected = [...current, spellName];
          } else {
            return; // Can't add more spells
          }
        }
      }
    }

    setSelectedSpells({
      ...selectedSpells,
      [levelKey]: newSelected,
    });
  };

  // Check if class is a spellcaster
  if (!character.className || !spellcastingClasses.includes(character.className)) {
    return (
      <div>
        <h2 className="mb-4 font-display text-2xl text-ink">Bước 6: Chọn phép thuật</h2>
        <p className="mb-6 text-slate-600">
          Lớp {character.className} không phải là lớp sử dụng phép thuật. Bạn có thể bỏ qua bước này.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h2 className="mb-4 font-display text-2xl text-ink">Bước 6: Chọn phép thuật</h2>
        <p className="mb-6 text-slate-600">Đang tải danh sách phép thuật...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-2xl text-ink">Bước 6: Chọn phép thuật</h2>
      <p className="mb-6 text-slate-600">
        Chọn các phép thuật mà nhân vật {character.name} biết hoặc có thể chuẩn bị.
      </p>

      <div className="mb-6 space-y-4">
        {spellLimits && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-2 font-semibold text-amber-900">Giới hạn phép thuật</h3>
            <div className="space-y-1 text-sm text-amber-800">
              {spellLimits.cantrips !== undefined && (
                <div>
                  <strong>Cantrips Known:</strong> {spellLimits.cantrips} (đã chọn: {selectedSpells.cantrips?.length || 0})
                </div>
              )}
              {isPrepared ? (
                <>
                  {preparedSpellsCount !== null && (
                    <div>
                      <strong>Spells Prepared:</strong> {preparedSpellsCount} (có thể chuẩn bị mỗi ngày)
                      <div className="ml-4 mt-1 text-xs text-amber-700">
                        Đã chọn: {Object.values(selectedSpells).flat().filter(s => !selectedSpells.cantrips?.includes(s)).length} spells
                      </div>
                    </div>
                  )}
                  {spellLimits.spellsKnown !== undefined && (
                    <div className="mt-2">
                      <strong>Spells in Spellbook (Wizard only):</strong> {spellLimits.spellsKnown}
                      <div className="ml-4 mt-1 text-xs text-amber-700">
                        Đã chọn: {Object.values(selectedSpells).flat().filter(s => !selectedSpells.cantrips?.includes(s)).length} spells
                      </div>
                    </div>
                  )}
                  {!spellLimits.spellsKnown && (
                    <div className="mt-2 text-xs text-amber-700 italic">
                      * Có thể chuẩn bị từ toàn bộ spell list của class
                    </div>
                  )}
                </>
              ) : (
                <>
                  {spellLimits.spellsKnown !== undefined && (
                    <div>
                      <strong>Spells Known:</strong> {spellLimits.spellsKnown} (biết cố định)
                      <div className="ml-4 mt-1 text-xs text-amber-700">
                        Đã chọn: {Object.values(selectedSpells).flat().filter(s => !selectedSpells.cantrips?.includes(s)).length} / {spellLimits.spellsKnown}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {spellSlots && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-3 font-semibold text-blue-900">Spell Slots (Cấp {character.level})</h3>
            {spellSlots.isWarlock ? (
              <div className="space-y-2">
                <div className="rounded border border-blue-300 bg-white p-3 text-center">
                  <div className="text-xs text-blue-600 font-medium">Slot Level {spellSlots.warlockSlotLevel}</div>
                  <div className="text-2xl font-bold text-blue-900">{spellSlots.warlockSlotCount}</div>
                  <div className="text-xs text-blue-700 mt-1">spell slots</div>
                </div>
                <div className="text-xs text-blue-700 italic">
                  * Warlock có spell slots riêng, tất cả đều ở cấp {spellSlots.warlockSlotLevel}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-9 gap-2 text-center text-sm">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((slotLevel) => {
                    const slots = spellSlots[`level${slotLevel}` as keyof typeof spellSlots] as number;
                    return (
                      <div key={slotLevel} className="rounded border border-blue-300 bg-white p-2">
                        <div className="text-xs text-blue-600 font-medium">{slotLevel}</div>
                        <div className="text-lg font-bold text-blue-900">{slots}</div>
                      </div>
                    );
                  })}
                </div>
                {spellSlots.allRows && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-blue-800 hover:text-blue-900">
                      Xem bảng spell slots đầy đủ (Level 1-20)
                    </summary>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-blue-100">
                            <th className="border border-blue-300 px-2 py-1 text-left">Level</th>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                              <th key={level} className="border border-blue-300 px-2 py-1 text-center">
                                {level}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {spellSlots.allRows.map((row: number[], index: number) => {
                            const rowLevel = index + 1;
                            const isCurrentLevel = rowLevel === character.level;
                            return (
                              <tr
                                key={rowLevel}
                                className={isCurrentLevel ? "bg-amber-100 font-semibold" : ""}
                              >
                                <td className={`border border-blue-300 px-2 py-1 ${isCurrentLevel ? "text-amber-900" : ""}`}>
                                  {rowLevel}
                                </td>
                                {row.map((slots, slotIndex) => (
                                  <td
                                    key={slotIndex}
                                    className={`border border-blue-300 px-2 py-1 text-center ${
                                      isCurrentLevel ? "text-amber-900" : ""
                                    }`}
                                  >
                                    {slots}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Search and Filter */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Tìm kiếm spell theo tên hoặc school..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showRitualOnly}
                onChange={(e) => setShowRitualOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Ritual only</span>
            </label>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition-all hover:bg-slate-50"
            >
              {showFilters ? "Ẩn Filters" : "Hiện Filters"}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-700">Advanced Filters</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* School Filter */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">School</label>
                <div className="space-y-1">
                  {[
                    { value: "A", label: "Abjuration" },
                    { value: "C", label: "Conjuration" },
                    { value: "D", label: "Divination" },
                    { value: "E", label: "Enchantment" },
                    { value: "V", label: "Evocation" },
                    { value: "I", label: "Illusion" },
                    { value: "N", label: "Necromancy" },
                    { value: "T", label: "Transmutation" },
                  ].map((school) => (
                    <label key={school.value} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedSchools.includes(school.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSchools([...selectedSchools, school.value]);
                          } else {
                            setSelectedSchools(selectedSchools.filter(s => s !== school.value));
                          }
                        }}
                        className="h-3 w-3 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>{school.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Level Filter */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">Level</label>
                <div className="space-y-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                    <label key={level} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedLevels.includes(level)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLevels([...selectedLevels, level]);
                          } else {
                            setSelectedLevels(selectedLevels.filter(l => l !== level));
                          }
                        }}
                        className="h-3 w-3 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>{level === 0 ? "Cantrip" : `Level ${level}`}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Components Filter */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">Components</label>
                <div className="space-y-1">
                  {[
                    { value: "V", label: "Verbal (V)" },
                    { value: "S", label: "Somatic (S)" },
                    { value: "M", label: "Material (M)" },
                  ].map((comp) => (
                    <label key={comp.value} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedComponents.includes(comp.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedComponents([...selectedComponents, comp.value]);
                          } else {
                            setSelectedComponents(selectedComponents.filter(c => c !== comp.value));
                          }
                        }}
                        className="h-3 w-3 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>{comp.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Other Filters */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">Other</label>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={showConcentrationOnly}
                      onChange={(e) => setShowConcentrationOnly(e.target.checked)}
                      className="h-3 w-3 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>Concentration only</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSchools([]);
                    setSelectedLevels([]);
                    setSelectedComponents([]);
                    setShowConcentrationOnly(false);
                    setShowRitualOnly(false);
                    setSearchQuery("");
                  }}
                  className="mt-3 rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 transition-all hover:bg-slate-100"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comparison Panel */}
      {comparisonSpells.length > 0 && (
        <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-purple-900">
              So sánh Spells ({comparisonSpells.length}/4)
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowComparison(!showComparison)}
                className="rounded border border-purple-300 bg-white px-3 py-1 text-xs text-purple-700 transition-all hover:bg-purple-100"
              >
                {showComparison ? "Ẩn" : "Hiện"} So sánh
              </button>
              <button
                type="button"
                onClick={() => {
                  setComparisonSpells([]);
                  setComparisonSpellDetails({});
                }}
                className="rounded border border-red-300 bg-white px-3 py-1 text-xs text-red-700 transition-all hover:bg-red-100"
              >
                Xóa tất cả
              </button>
            </div>
          </div>
          {showComparison && (
            <div className="overflow-x-auto">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparisonSpells.length}, minmax(250px, 1fr))` }}>
                {comparisonSpells.map((spellName) => {
                  const spell = allSpells.find(s => s.name === spellName);
                  const details = comparisonSpellDetails[spellName];
                  const isLoading = loadingComparison[spellName];
                  
                  return (
                    <div key={spellName} className="rounded-lg border border-purple-300 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="font-semibold text-purple-900">{spellName}</div>
                        <button
                          type="button"
                          onClick={() => handleToggleComparison(spellName)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      </div>
                      {isLoading ? (
                        <div className="text-xs text-slate-500">Đang tải...</div>
                      ) : details ? (
                        <div className="space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-medium text-slate-600">Level:</span>{" "}
                              <span className="text-slate-800">
                                {details.level === 0 ? "Cantrip" : details.level}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-600">School:</span>{" "}
                              <span className="text-slate-800">{getSchoolName(details.school || "")}</span>
                            </div>
                            {details.time && (
                              <div>
                                <span className="font-medium text-slate-600">Casting Time:</span>{" "}
                                <span className="text-slate-800">
                                  {Array.isArray(details.time) 
                                    ? details.time.map((t: any) => `${t.number} ${t.unit}`).join(", ")
                                    : details.time}
                                </span>
                              </div>
                            )}
                            {details.range && (
                              <div>
                                <span className="font-medium text-slate-600">Range:</span>{" "}
                                <span className="text-slate-800">
                                  {typeof details.range === "object" && details.range.distance
                                    ? `${details.range.distance.amount} ${details.range.distance.type}`
                                    : details.range}
                                </span>
                              </div>
                            )}
                            {details.components && (
                              <div>
                                <span className="font-medium text-slate-600">Components:</span>{" "}
                                <span className="text-slate-800">
                                  {[
                                    details.components.v && "V",
                                    details.components.s && "S",
                                    details.components.m && "M",
                                  ].filter(Boolean).join(", ")}
                                </span>
                              </div>
                            )}
                            {details.duration && (
                              <div>
                                <span className="font-medium text-slate-600">Duration:</span>{" "}
                                <span className="text-slate-800">
                                  {Array.isArray(details.duration)
                                    ? details.duration.map((d: any) => {
                                        if (d.type === "timed") {
                                          return `${d.duration.amount} ${d.duration.type}${d.concentration ? " (Concentration)" : ""}`;
                                        }
                                        return d.type || d;
                                      }).join(", ")
                                    : details.duration}
                                </span>
                              </div>
                            )}
                          </div>
                          {details.meta?.ritual && (
                            <div>
                              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                                Ritual
                              </span>
                            </div>
                          )}
                          {details.entries && (
                            <div className="mt-2 border-t border-purple-200 pt-2">
                              <div className="font-medium text-slate-600 mb-1">Description:</div>
                              <div className="text-slate-700 leading-relaxed max-h-32 overflow-y-auto">
                                {Array.isArray(details.entries) ? (
                                  details.entries.slice(0, 3).map((entry: any, idx: number) => {
                                    if (typeof entry === "string") {
                                      return (
                                        <div key={idx} className="mb-1">
                                          <TextWithTooltips text={entry} />
                                        </div>
                                      );
                                    }
                                    return null;
                                  })
                                ) : (
                                  <TextWithTooltips text={String(details.entries)} />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">Chưa tải thông tin</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setViewMode("level")}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            viewMode === "level"
              ? "border-b-2 border-amber-600 text-amber-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Theo Level
        </button>
        <button
          type="button"
          onClick={() => setViewMode("school")}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            viewMode === "school"
              ? "border-b-2 border-amber-600 text-amber-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Theo School
        </button>
      </div>

      <div className="space-y-6">
        {viewMode === "level" ? (
          <>
            {/* Cantrips (Level 0) */}
            {maxSpellLevel >= 0 && (
          <div>
            <details className="mb-3">
              <summary className="cursor-pointer text-lg font-semibold text-slate-800 hover:text-amber-600">
                Cantrips (Cấp 0)
                {spellLimits?.cantrips && (
                  <span className="ml-2 text-sm font-normal text-slate-600">
                    (Chọn {spellLimits.cantrips}, đã chọn: {selectedSpells.cantrips?.length || 0})
                  </span>
                )}
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {getSpellsByLevel(0).map((spell) => {
                const isSelected = selectedSpells.cantrips?.includes(spell.name) || false;
                const isViewing = viewingSpell?.name === spell.name;
                return (
                  <Tooltip
                    key={spell.name}
                    content={
                      isViewing && spellDetails ? (
                        <TooltipContent
                          type="spell"
                          name={spell.name}
                          data={spellDetails}
                          loading={loadingSpellDetails}
                        />
                      ) : (
                        <div className="text-xs p-2">
                          <div className="font-medium text-white mb-1">{spell.name}</div>
                          <div className="text-slate-300 text-xs">
                            Click để chọn • Ctrl+Click hoặc giữ chuột để xem chi tiết
                          </div>
                        </div>
                      )
                    }
                    delay={isViewing ? 0 : 300}
                    disablePinOnClick={true}
                  >
                      <button
                        type="button"
                        onClick={(e) => {
                          // If Ctrl+Click, show details
                          if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            handleViewSpellDetails(spell.name);
                            return;
                          }
                          // Normal click - just select/deselect
                          handleSpellToggle(spell.name, 0, e);
                        }}
                        onMouseDown={(e) => {
                          // If Ctrl+Click, show details immediately
                          if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            handleViewSpellDetails(spell.name);
                            return;
                          }
                          // Start tracking long press
                          const startTime = Date.now();
                          const spellName = spell.name;
                          setMouseDownTime(startTime);
                          setMouseDownSpell(spellName);
                          
                          // Clear any existing timeout
                          if (longPressTimeoutRef.current) {
                            clearTimeout(longPressTimeoutRef.current);
                          }
                          
                          // Set timeout for long press (capture spellName in closure)
                          longPressTimeoutRef.current = setTimeout(() => {
                            handleViewSpellDetails(spellName);
                            longPressTimeoutRef.current = null;
                          }, 500);
                        }}
                        onMouseUp={() => {
                          // Clear long press timeout
                          if (longPressTimeoutRef.current) {
                            clearTimeout(longPressTimeoutRef.current);
                            longPressTimeoutRef.current = null;
                          }
                          setMouseDownSpell(null);
                        }}
                        onMouseLeave={() => {
                          // Clear long press timeout
                          if (longPressTimeoutRef.current) {
                            clearTimeout(longPressTimeoutRef.current);
                            longPressTimeoutRef.current = null;
                          }
                          setMouseDownSpell(null);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleViewSpellDetails(spell.name);
                        }}
                      disabled={
                        !isSelected &&
                        (selectedSpells.cantrips?.length || 0) >= (spellLimits?.cantrips || 0)
                      }
                      className={`rounded-lg border p-3 text-left text-sm transition-all relative ${
                        isSelected
                          ? "border-amber-500 bg-amber-100 text-amber-900"
                          : "border-slate-300 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50"
                      } ${
                        !isSelected &&
                        (selectedSpells.cantrips?.length || 0) >= (spellLimits?.cantrips || 0)
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <div className="font-medium">{spell.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        {spell.school && (
                          <span>{getSchoolName(spell.school)}</span>
                        )}
                        {spell.meta?.ritual && (
                          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                            Ritual
                          </span>
                        )}
                      </div>
                      {isViewing && (
                        <div className="absolute top-1 right-1 text-xs text-amber-600 font-bold">
                          ⓘ
                        </div>
                      )}
                      {comparisonSpells.includes(spell.name) && (
                        <div className="absolute bottom-1 right-1 rounded-full bg-purple-500 p-1 text-white">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 flex gap-1">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComparison(spell.name);
                          }}
                          className={`rounded px-2 py-0.5 text-xs transition-all cursor-pointer ${
                            comparisonSpells.includes(spell.name)
                              ? "bg-purple-500 text-white"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                          }`}
                          title="Thêm vào so sánh"
                        >
                          {comparisonSpells.includes(spell.name) ? "✓" : "⚖"}
                        </div>
                      </div>
                    </button>
                  </Tooltip>
                );
              })}
              </div>
            </details>
          </div>
        )}

        {/* Regular Spells (Level 1-9) */}
        {Array.from({ length: maxSpellLevel }, (_, i) => i + 1).map((spellLevel) => {
          const spells = getSpellsByLevel(spellLevel);
          if (spells.length === 0) return null;

          const levelKey = `level${spellLevel}` as keyof typeof selectedSpells;
          const selectedCount = selectedSpells[levelKey]?.length || 0;
          const totalSelected = Object.values(selectedSpells)
            .flat()
            .filter(s => !selectedSpells.cantrips?.includes(s)).length;
          const maxSpells = isPrepared 
            ? (spellLimits?.spellsKnown || Infinity) // Prepared: no limit (or spellbook limit for Wizard)
            : (spellLimits?.spellsKnown || 0); // Known: limited by spells known

          return (
            <div key={spellLevel}>
              <details className="mb-3">
                <summary className="cursor-pointer text-lg font-semibold text-slate-800 hover:text-amber-600">
                  Cấp {spellLevel}
                  <span className="ml-2 text-sm font-normal text-slate-600">
                    {isPrepared ? (
                      spellLimits?.spellsKnown !== undefined ? (
                        `(Đã chọn: ${selectedCount} / Tổng: ${totalSelected} / ${maxSpells} trong spellbook)`
                      ) : (
                        `(Đã chọn: ${selectedCount} / Tổng: ${totalSelected} - Có thể chuẩn bị ${preparedSpellsCount} mỗi ngày)`
                      )
                    ) : (
                      `(Đã chọn: ${selectedCount} / Tổng: ${totalSelected} / ${maxSpells})`
                    )}
                  </span>
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {spells.map((spell) => {
                  const isSelected = selectedSpells[levelKey]?.includes(spell.name) || false;
                  const isViewing = viewingSpell?.name === spell.name;
                  return (
                    <Tooltip
                      key={spell.name}
                      content={
                        isViewing && spellDetails ? (
                          <TooltipContent
                            type="spell"
                            name={spell.name}
                            data={spellDetails}
                            loading={loadingSpellDetails}
                          />
                        ) : (
                          <div className="text-xs p-2">
                            <div className="font-medium text-white mb-1">{spell.name}</div>
                            <div className="text-slate-300 text-xs">
                              Click để chọn • Ctrl+Click hoặc giữ chuột để xem chi tiết
                            </div>
                          </div>
                        )
                      }
                      delay={isViewing ? 0 : 300}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          // If Ctrl+Click, show details
                          if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            handleViewSpellDetails(spell.name);
                            return;
                          }
                          // Normal click - just select/deselect
                          handleSpellToggle(spell.name, spellLevel, e);
                        }}
                        onMouseDown={(e) => {
                          // If Ctrl+Click, show details immediately
                          if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            handleViewSpellDetails(spell.name);
                            return;
                          }
                          // Start tracking long press
                          const startTime = Date.now();
                          const spellName = spell.name;
                          setMouseDownTime(startTime);
                          setMouseDownSpell(spellName);
                          
                          // Clear any existing timeout
                          if (longPressTimeoutRef.current) {
                            clearTimeout(longPressTimeoutRef.current);
                          }
                          
                          // Set timeout for long press (capture spellName in closure)
                          longPressTimeoutRef.current = setTimeout(() => {
                            handleViewSpellDetails(spellName);
                            longPressTimeoutRef.current = null;
                          }, 500);
                        }}
                        onMouseUp={() => {
                          // Clear long press timeout
                          if (longPressTimeoutRef.current) {
                            clearTimeout(longPressTimeoutRef.current);
                            longPressTimeoutRef.current = null;
                          }
                          setMouseDownSpell(null);
                        }}
                        onMouseLeave={() => {
                          // Clear long press timeout
                          if (longPressTimeoutRef.current) {
                            clearTimeout(longPressTimeoutRef.current);
                            longPressTimeoutRef.current = null;
                          }
                          setMouseDownSpell(null);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleViewSpellDetails(spell.name);
                        }}
                        disabled={
                          !isSelected && 
                          (!isPrepared || (isPrepared && spellLimits?.spellsKnown !== undefined)) &&
                          totalSelected >= maxSpells
                        }
                        className={`rounded-lg border p-3 text-left text-sm transition-all relative ${
                          isSelected
                            ? "border-amber-500 bg-amber-100 text-amber-900"
                            : "border-slate-300 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50"
                        } ${
                          !isSelected && 
                          (!isPrepared || (isPrepared && spellLimits?.spellsKnown !== undefined)) &&
                          totalSelected >= maxSpells
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        <div className="font-medium">
                          <TextWithTooltips text={spell.name} />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          {spell.school && (
                            <span>{getSchoolName(spell.school)}</span>
                          )}
                          {spell.meta?.ritual && (
                            <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                              Ritual
                            </span>
                          )}
                        </div>
                        {isViewing && (
                          <div className="absolute top-1 right-1 text-xs text-amber-600 font-bold">
                            ⓘ
                          </div>
                        )}
                        {comparisonSpells.includes(spell.name) && (
                          <div className="absolute bottom-1 right-1 rounded-full bg-purple-500 p-1 text-white">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1 flex gap-1">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleComparison(spell.name);
                            }}
                            className={`rounded px-2 py-0.5 text-xs transition-all cursor-pointer ${
                              comparisonSpells.includes(spell.name)
                                ? "bg-purple-500 text-white"
                                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                            }`}
                            title="Thêm vào so sánh"
                          >
                            {comparisonSpells.includes(spell.name) ? "✓" : "⚖"}
                          </div>
                        </div>
                      </button>
                    </Tooltip>
                  );
                })}
                </div>
              </details>
            </div>
          );
        })}
          </>
        ) : (
          /* School View */
          getAllSchools().map((school) => {
            const spellsByLevel = getSpellsBySchool(school);
            const schoolSpells = Object.values(spellsByLevel).flat();
            
            if (schoolSpells.length === 0) return null;
            
            // Filter by selected schools if any
            if (selectedSchools.length > 0 && !selectedSchools.includes(school)) {
              return null;
            }
            
            return (
              <div key={school} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-4 text-xl font-semibold text-slate-800">
                  {getSchoolName(school)}
                  <span className="ml-2 text-sm font-normal text-slate-600">
                    ({schoolSpells.length} spells)
                  </span>
                </h3>
                
                {Object.keys(spellsByLevel)
                  .map(level => parseInt(level))
                  .sort((a, b) => a - b)
                  .map((spellLevel) => {
                    const spells = spellsByLevel[spellLevel];
                    if (spells.length === 0) return null;
                    
                    const levelKey = spellLevel === 0 ? "cantrips" : `level${spellLevel}` as keyof typeof selectedSpells;
                    const selectedCount = spellLevel === 0 
                      ? (selectedSpells.cantrips?.length || 0)
                      : (selectedSpells[levelKey]?.length || 0);
                    
                    return (
                      <div key={spellLevel} className="mb-4">
                        <details className="mb-2">
                          <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-amber-600">
                            {spellLevel === 0 ? "Cantrips" : `Level ${spellLevel}`}
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              ({spells.length} spells, đã chọn: {selectedCount})
                            </span>
                          </summary>
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {spells.map((spell) => {
                            const isSelected = spellLevel === 0
                              ? selectedSpells.cantrips?.includes(spell.name) || false
                              : selectedSpells[levelKey]?.includes(spell.name) || false;
                            const isViewing = viewingSpell?.name === spell.name;
                            
                            return (
                    <Tooltip
                      key={spell.name}
                      content={
                        isViewing && spellDetails ? (
                          <TooltipContent
                            type="spell"
                            name={spell.name}
                            data={spellDetails}
                            loading={loadingSpellDetails}
                          />
                        ) : (
                          <div className="text-xs p-2">
                            <div className="font-medium text-white mb-1">{spell.name}</div>
                            <div className="text-slate-300 text-xs">
                              Click để chọn • Ctrl+Click hoặc giữ chuột để xem chi tiết
                            </div>
                          </div>
                        )
                      }
                      delay={isViewing ? 0 : 300}
                      disablePinOnClick={true}
                    >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    // If Ctrl+Click, show details
                                    if (e.ctrlKey || e.metaKey) {
                                      e.preventDefault();
                                      handleViewSpellDetails(spell.name);
                                      return;
                                    }
                                    // Normal click - just select/deselect
                                    handleSpellToggle(spell.name, spellLevel, e);
                                  }}
                                  onMouseDown={(e) => {
                                    // If Ctrl+Click, show details immediately
                                    if (e.ctrlKey || e.metaKey) {
                                      e.preventDefault();
                                      handleViewSpellDetails(spell.name);
                                      return;
                                    }
                                    // Start tracking long press
                                    setMouseDownTime(Date.now());
                                    setMouseDownSpell(spell.name);
                                    
                                    // Set timeout for long press
                                    const timeoutId = setTimeout(() => {
                                      if (mouseDownSpell === spell.name && Date.now() - mouseDownTime >= 500) {
                                        handleViewSpellDetails(spell.name);
                                      }
                                    }, 500);
                                    
                                    // Store timeout ID to clear if mouse up before 500ms
                                    (e.currentTarget as any).__longPressTimeout = timeoutId;
                                  }}
                                  onMouseUp={(e) => {
                                    // Clear long press timeout
                                    const timeoutId = (e.currentTarget as any).__longPressTimeout;
                                    if (timeoutId) {
                                      clearTimeout(timeoutId);
                                      delete (e.currentTarget as any).__longPressTimeout;
                                    }
                                    setMouseDownSpell(null);
                                  }}
                                  onMouseLeave={(e) => {
                                    // Clear long press timeout
                                    const timeoutId = (e.currentTarget as any).__longPressTimeout;
                                    if (timeoutId) {
                                      clearTimeout(timeoutId);
                                      delete (e.currentTarget as any).__longPressTimeout;
                                    }
                                    setMouseDownSpell(null);
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleViewSpellDetails(spell.name);
                                  }}
                                  disabled={
                                    spellLevel === 0
                                      ? !isSelected && (selectedSpells.cantrips?.length || 0) >= (spellLimits?.cantrips || 0)
                                      : !isSelected && 
                                        (!isPrepared || (isPrepared && spellLimits?.spellsKnown !== undefined)) &&
                                        (Object.values(selectedSpells).flat().filter(s => !selectedSpells.cantrips?.includes(s)).length >= (isPrepared ? (spellLimits?.spellsKnown || Infinity) : (spellLimits?.spellsKnown || 0)))
                                  }
                                  className={`rounded-lg border p-3 text-left text-sm transition-all relative ${
                                    isSelected
                                      ? "border-amber-500 bg-amber-100 text-amber-900"
                                      : "border-slate-300 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50"
                                  } ${
                                    spellLevel === 0
                                      ? (!isSelected && (selectedSpells.cantrips?.length || 0) >= (spellLimits?.cantrips || 0))
                                        ? "opacity-50 cursor-not-allowed"
                                        : ""
                                      : (!isSelected && 
                                        (!isPrepared || (isPrepared && spellLimits?.spellsKnown !== undefined)) &&
                                        (Object.values(selectedSpells).flat().filter(s => !selectedSpells.cantrips?.includes(s)).length >= (isPrepared ? (spellLimits?.spellsKnown || Infinity) : (spellLimits?.spellsKnown || 0))))
                                        ? "opacity-50 cursor-not-allowed"
                                        : ""
                                  }`}
                                >
                                  <div className="font-medium">
                                    {spellLevel > 0 ? <TextWithTooltips text={spell.name} /> : spell.name}
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                    {spell.meta?.ritual && (
                                      <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                                        Ritual
                                      </span>
                                    )}
                                  </div>
                                  {isViewing && (
                                    <div className="absolute top-1 right-1 text-xs text-amber-600 font-bold">
                                      ⓘ
                                    </div>
                                  )}
                                  {comparisonSpells.includes(spell.name) && (
                                    <div className="absolute bottom-1 right-1 rounded-full bg-purple-500 p-1 text-white">
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                      </svg>
                                    </div>
                                  )}
                                  <div className="absolute bottom-1 left-1 flex gap-1">
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleComparison(spell.name);
                                      }}
                                      className={`rounded px-2 py-0.5 text-xs transition-all cursor-pointer ${
                                        comparisonSpells.includes(spell.name)
                                          ? "bg-purple-500 text-white"
                                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                      }`}
                                      title="Thêm vào so sánh"
                                    >
                                      {comparisonSpells.includes(spell.name) ? "✓" : "⚖"}
                                    </div>
                                  </div>
                                </button>
                              </Tooltip>
                            );
                          })}
                          </div>
                        </details>
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        onConfirm={() => setAlertDialog({ isOpen: false, title: "", message: "" })}
        onCancel={() => setAlertDialog({ isOpen: false, title: "", message: "" })}
        type="alert"
      />
    </div>
  );
}

