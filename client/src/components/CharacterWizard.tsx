import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type {
  Character,
  Race,
  Class,
  Background,
  CreationStep,
} from "../types";
import { startPreload } from "./TextWithTooltips";
import Step1Race from "./wizard/Step1Race";
import Step2Class from "./wizard/Step2Class";
import Step3AbilityScores from "./wizard/Step3AbilityScores";
import Step4Description from "./wizard/Step4Description";
import Step5Equipment from "./wizard/Step5Equipment";
import Step6Spells from "./wizard/Step6Spells";
import Step6_5Calculations from "./wizard/Step6_5Calculations";
import Step7CharacterSheet from "./wizard/Step7CharacterSheet";
import ConfirmDialog from "./ConfirmDialog";
import { apiUrl } from "../config/api";

interface CharacterWizardProps {
  initialCharacter?: Character;
  onComplete: (character: Character) => void;
  onCancel: () => void;
}

const STEPS: { number: CreationStep; title: string; hidden?: boolean }[] = [
  { number: 1, title: "Chọn chủng tộc" },
  { number: 2, title: "Chọn lớp" },
  { number: 3, title: "Xác định chỉ số" },
  { number: 4, title: "Mô tả nhân vật" },
  { number: 5, title: "Chọn trang bị" },
  { number: 6, title: "Chọn phép thuật" },
  { number: 6.5, title: "Tính toán chỉ số", hidden: true },
  { number: 7, title: "Hoàn thiện Character Sheet" },
];

export default function CharacterWizard({
  initialCharacter,
  onComplete,
  onCancel,
}: CharacterWizardProps) {
  const [currentStep, setCurrentStep] = useState<CreationStep>(1);
  const [character, setCharacter] = useState<Partial<Character>>(() => {
    if (initialCharacter) {
      return initialCharacter;
    }
    return {
      level: 1,
      abilityScores: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      proficiencies: [],
      equipment: [],
    };
  });

  const [races, setRaces] = useState<Race[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  useEffect(() => {
    loadData();
    // Preload tooltip data khi vào wizard (nơi cần tooltip nhiều nhất)
    startPreload();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [racesRes, classesRes, backgroundsRes] = await Promise.all([
        fetch(apiUrl("api/data/races/phb")),
        fetch(apiUrl("api/data/classes/phb")),
        fetch(apiUrl("api/data/backgrounds/phb")),
      ]);

      if (racesRes.ok) {
        const racesData = await racesRes.json();
        setRaces(racesData);
      }
      if (classesRes.ok) {
        const classesData = await classesRes.json();
        setClasses(classesData);
      }
      if (backgroundsRes.ok) {
        const backgroundsData = await backgroundsRes.json();
        setBackgrounds(backgroundsData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateCharacter = (updates: Partial<Character>) => {
    setCharacter((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (currentStep === 6) {
      // Auto-advance to 6.5 (calculations), then to 7
      setCurrentStep(6.5);
      // After a brief moment, move to step 7
      setTimeout(() => {
        setCurrentStep(7);
      }, 100);
    } else if (currentStep < 6) {
      setCurrentStep((prev) => (prev + 1) as CreationStep);
    }
  };

  const handlePrevious = () => {
    if (currentStep === 7) {
      // Go back to step 6 (skip 6.5)
      setCurrentStep(6);
    } else if (currentStep > 1) {
      setCurrentStep((prev) => {
        if (prev === 6.5) return 6; // Skip 6.5 when going back
        return (prev - 1) as CreationStep;
      });
    }
  };

  const showAlert = (title: string, message: string) => {
    setAlertDialog({ isOpen: true, title, message });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!character.name || !character.race || !character.className) {
      showAlert("Thiếu thông tin", "Vui lòng hoàn thành các bước bắt buộc");
      return;
    }

    try {
      const url = initialCharacter
        ? apiUrl(`api/characters/${initialCharacter.id}`)
        : apiUrl("api/characters");
      const response = await fetch(url, {
        method: initialCharacter ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(character),
      });

      if (!response.ok) throw new Error("Không thể lưu nhân vật");

      const saved = (await response.json()) as Character;
      onComplete(saved);
    } catch (error) {
      console.error("Error saving character:", error);
      showAlert("Lỗi", "Không thể lưu nhân vật. Vui lòng thử lại.");
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!character.race; // Subrace is optional
      case 2:
        // Class is required, subclass is required only if level >= 3
        if (!character.className) return false;
        if (character.level && character.level >= 3) {
          // Check if class has subclasses - this will be validated in Step2Class component
          return true; // Let Step2Class handle subclass validation
        }
        return true;
      case 3:
        return true; // Ability scores always valid
      case 4:
        return !!character.background && !!character.alignment;
      case 5:
        return true; // Equipment is optional
      case 6:
        // Spells are optional (only for spellcasting classes)
        // Check if class is a spellcaster
        const spellcastingClasses = ["Wizard", "Sorcerer", "Warlock", "Cleric", "Druid", "Bard", "Ranger", "Paladin"];
        if (character.className && spellcastingClasses.includes(character.className)) {
          // For now, spells are optional - can proceed even without selecting spells
          return true;
        }
        return true; // Non-spellcasters can skip this step
      case 6.5:
        return true; // Always allow (hidden step)
      case 7:
        return true; // Always allow (final step)
      default:
        return false;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg text-slate-600">Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 rounded-3xl border border-amber-200 bg-white/70 p-8 shadow-sheet backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-700">
            Tam Giác | D&D 5e
          </p>
          <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
            Tạo nhân vật mới
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Theo hướng dẫn trong Player's Handbook
          </p>
        </header>

        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.filter(step => !step.hidden).map((step, index, filteredSteps) => (
              <div key={step.number} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-lg transition-all ${
                      currentStep === step.number || (currentStep === 6.5 && step.number === 7)
                        ? "border-amber-600 bg-amber-600 text-white"
                        : currentStep > step.number || (currentStep === 7 && step.number < 7)
                        ? "border-amber-400 bg-amber-100 text-amber-700"
                        : "border-slate-300 bg-white text-slate-400"
                    }`}
                  >
                    {step.number}
                  </div>
                  <div
                    className={`mt-2 text-center text-xs ${
                      currentStep === step.number || (currentStep === 6.5 && step.number === 7)
                        ? "font-medium text-amber-700"
                        : "text-slate-500"
                    }`}
                  >
                    {step.title}
                  </div>
                </div>
                {index < filteredSteps.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 flex-1 ${
                      currentStep > step.number || (currentStep === 7 && step.number < 7) ? "bg-amber-400" : "bg-slate-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <form 
          onSubmit={handleSubmit} 
          onKeyDown={(e) => {
            // Prevent form submission on Enter key unless on final step
            if (e.key === "Enter" && currentStep < 5) {
              e.preventDefault();
            }
          }}
          className="space-y-6"
        >
          <div className="rounded-3xl border border-amber-100 bg-white/80 p-6 shadow-sheet backdrop-blur">
            {currentStep === 1 && (
              <Step1Race
                races={races}
                selectedRace={character.race}
                selectedSubrace={character.subrace}
                raceAbilityChoices={character.raceAbilityChoices}
                raceSkillChoices={character.raceSkillChoices}
                raceFeatChoices={character.raceFeatChoices}
                raceLanguageChoices={character.raceLanguageChoices}
                raceResistanceChoice={character.raceResistanceChoice}
                raceToolChoice={character.raceToolChoice}
                raceDraconicAncestry={character.raceDraconicAncestry}
                onSelectRace={(race) => updateCharacter({ 
                  race, 
                  subrace: undefined, 
                  raceAbilityChoices: [],
                  raceSkillChoices: [],
                  raceFeatChoices: [],
                  raceLanguageChoices: [],
                  raceResistanceChoice: undefined,
                  raceToolChoice: undefined,
                  raceDraconicAncestry: undefined
                })}
                onSelectSubrace={(subrace) => updateCharacter({ 
                  subrace, 
                  raceAbilityChoices: [],
                  raceSkillChoices: [],
                  raceFeatChoices: [],
                  raceLanguageChoices: [],
                  raceResistanceChoice: undefined,
                  raceToolChoice: undefined,
                  raceDraconicAncestry: undefined
                })}
                onSelectAbilityChoices={(choices) => updateCharacter({ raceAbilityChoices: choices as any })}
                onSelectSkillChoices={(choices) => updateCharacter({ raceSkillChoices: choices })}
                onSelectFeatChoices={(choices) => updateCharacter({ raceFeatChoices: choices })}
                onSelectLanguageChoices={(choices) => updateCharacter({ raceLanguageChoices: choices })}
                onSelectResistanceChoice={(choice) => updateCharacter({ raceResistanceChoice: choice })}
                onSelectToolChoice={(choice) => updateCharacter({ raceToolChoice: choice })}
                onSelectDraconicAncestry={(choice) => updateCharacter({ raceDraconicAncestry: choice })}
              />
            )}
            {currentStep === 2 && (
              <Step2Class
                classes={classes}
                selectedClass={character.className}
                selectedLevel={character.level}
                selectedSubclass={character.subclass}
                selectedFeats={character.feats || []}
                classSkillChoices={character.classSkillChoices}
                onSelectClass={(className) =>
                  updateCharacter({ className, subclass: undefined, feats: [], classSkillChoices: [] })
                }
                onSelectLevel={(level) => updateCharacter({ level })}
                onSelectSubclass={(subclass) => updateCharacter({ subclass })}
                onSelectFeats={(feats) => updateCharacter({ feats })}
                onSelectSkillChoices={(choices) => updateCharacter({ classSkillChoices: choices })}
              />
            )}
            {currentStep === 3 && (
              <Step3AbilityScores
                abilityScores={character.abilityScores || {
                  str: 10,
                  dex: 10,
                  con: 10,
                  int: 10,
                  wis: 10,
                  cha: 10,
                }}
                race={character.race}
                onUpdateScores={(scores) => updateCharacter({ abilityScores: scores })}
              />
            )}
            {currentStep === 4 && (
              <Step4Description
                backgrounds={backgrounds}
                character={character}
                backgroundSkillChoices={character.backgroundSkillChoices}
                backgroundLanguageChoices={character.backgroundLanguageChoices}
                backgroundToolChoices={character.backgroundToolChoices}
                backgroundEquipmentChoices={character.backgroundEquipmentChoices}
                backgroundFeatureChoices={character.backgroundFeatureChoices}
                onUpdate={(updates) => {
                  updateCharacter(updates);
                  // Reset choices when background changes
                  if (updates.background && updates.background !== character.background) {
                    updateCharacter({
                      backgroundSkillChoices: [],
                      backgroundLanguageChoices: [],
                      backgroundToolChoices: [],
                      backgroundEquipmentChoices: {},
                      backgroundFeatureChoices: [],
                    });
                  }
                }}
                onSelectSkillChoices={(choices) => updateCharacter({ backgroundSkillChoices: choices })}
                onSelectLanguageChoices={(choices) => updateCharacter({ backgroundLanguageChoices: choices })}
                onSelectToolChoices={(choices) => updateCharacter({ backgroundToolChoices: choices })}
                onSelectEquipmentChoices={(choices) => updateCharacter({ backgroundEquipmentChoices: choices })}
                onSelectFeatureChoices={(choices) => updateCharacter({ backgroundFeatureChoices: choices })}
              />
            )}
            {currentStep === 5 && (
              <Step5Equipment
                character={character}
                onUpdate={(updates) => updateCharacter(updates)}
              />
            )}
            {currentStep === 6 && (
              <Step6Spells
                character={character}
                onUpdate={(updates) => updateCharacter(updates)}
              />
            )}
            {currentStep === 6.5 && (
              <Step6_5Calculations
                character={character}
                onUpdate={(updates) => updateCharacter(updates)}
              />
            )}
            {currentStep === 7 && (
              <Step7CharacterSheet
                character={character}
                onComplete={handleSubmit}
              />
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={currentStep === 1 ? onCancel : handlePrevious}
              className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-slate-700 transition-all hover:bg-slate-50"
            >
              {currentStep === 1 ? "Hủy" : "Quay lại"}
            </button>
            <div className="flex gap-4">
              {currentStep < 6 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNext(e);
                  }}
                  disabled={!canProceed()}
                  className="rounded-2xl bg-amber-600 px-6 py-3 text-white transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tiếp theo
                </button>
              ) : currentStep === 6 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNext(e);
                  }}
                  disabled={!canProceed()}
                  className="rounded-2xl bg-amber-600 px-6 py-3 text-white transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tiếp theo
                </button>
              ) : currentStep === 7 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSubmit(e as any);
                  }}
                  className="rounded-2xl bg-amber-600 px-6 py-3 text-white transition-all hover:bg-amber-700"
                >
                  Hoàn thành
                </button>
              ) : null}
            </div>
          </div>
        </form>
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

