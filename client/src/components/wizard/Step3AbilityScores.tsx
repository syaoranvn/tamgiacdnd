import { useState } from "react";
import type { AbilityScores, AbilityKey } from "../../types";

interface Step3AbilityScoresProps {
  abilityScores: AbilityScores;
  race?: string;
  onUpdateScores: (scores: AbilityScores) => void;
}

const abilityLabels: Record<AbilityKey, { label: string; description: string }> = {
  str: { label: "STR", description: "Sức mạnh" },
  dex: { label: "DEX", description: "Nhanh nhẹn" },
  con: { label: "CON", description: "Thể chất" },
  int: { label: "INT", description: "Thông minh" },
  wis: { label: "WIS", description: "Khôn ngoan" },
  cha: { label: "CHA", description: "Cuốn hút" },
};

const abilityKeys: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

const abilityModifier = (score: number) => Math.floor((score - 10) / 2);
const formatModifier = (mod: number) => (mod >= 0 ? `+${mod}` : `${mod}`);

const roll4d6 = () => {
  const rolls = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6));
  rolls.sort((a, b) => b - a);
  return rolls.slice(0, 3).reduce((sum, val) => sum + val, 0);
};

// Point Buy cost table
const getPointBuyCost = (score: number): number => {
  if (score < 8) return 0;
  if (score === 8) return 0;
  if (score === 9) return 1;
  if (score === 10) return 2;
  if (score === 11) return 3;
  if (score === 12) return 4;
  if (score === 13) return 5;
  if (score === 14) return 7;
  if (score === 15) return 9;
  return 0; // Scores above 15 not allowed in standard point buy
};

const getTotalPointBuyCost = (scores: AbilityScores): number => {
  return abilityKeys.reduce((total, key) => {
    return total + getPointBuyCost(scores[key] || 8);
  }, 0);
};

export default function Step3AbilityScores({
  abilityScores,
  race,
  onUpdateScores,
}: Step3AbilityScoresProps) {
  const [method, setMethod] = useState<"standard" | "roll" | "point">("standard");
  const [rolledScores, setRolledScores] = useState<number[]>([]);
  const [standardArrayAssignments, setStandardArrayAssignments] = useState<Record<AbilityKey, number>>(() => {
    const assignments: Record<AbilityKey, number> = {} as Record<AbilityKey, number>;
    abilityKeys.forEach((key) => {
      assignments[key] = 0; // 0 means unassigned
    });
    return assignments;
  });

  const handleMethodChange = (newMethod: "standard" | "roll" | "point") => {
    setMethod(newMethod);
    if (newMethod === "standard") {
      // Don't auto-fill, let user choose manually
      // Reset assignments if switching to standard
      const newAssignments: Record<AbilityKey, number> = {} as Record<AbilityKey, number>;
      abilityKeys.forEach((key) => {
        newAssignments[key] = 0; // 0 means unassigned
      });
      setStandardArrayAssignments(newAssignments);
      // Reset scores to 0 or keep current if already set
    } else if (newMethod === "roll") {
      const rolls = Array.from({ length: 6 }, () => roll4d6());
      setRolledScores(rolls);
      const newScores = { ...abilityScores };
      abilityKeys.forEach((key, idx) => {
        newScores[key] = rolls[idx];
      });
      onUpdateScores(newScores);
    } else if (newMethod === "point") {
      // Initialize point buy with all 8s
      const newScores = { ...abilityScores };
      abilityKeys.forEach((key) => {
        newScores[key] = 8;
      });
      onUpdateScores(newScores);
    }
  };

  const handleScoreChange = (key: AbilityKey, value: number) => {
    let clamped = Math.max(1, Math.min(20, value));
    
    // For point buy, limit to 8-15
    if (method === "point") {
      clamped = Math.max(8, Math.min(15, clamped));
    }
    
    const newScores = { ...abilityScores, [key]: clamped };
    
    // For point buy, check if total cost exceeds 27
    if (method === "point") {
      const totalCost = getTotalPointBuyCost(newScores);
      if (totalCost > 27) {
        // Don't allow the change if it exceeds 27 points
        return;
      }
    }
    
    onUpdateScores(newScores);
  };

  const handleStandardArrayChange = (key: AbilityKey, value: number) => {
    const newAssignments = { ...standardArrayAssignments };
    
    // If selecting a value (not 0), check if it's already used by another ability
    if (value !== 0) {
      // Find if this value is already assigned to another ability
      const alreadyAssignedKey = Object.keys(newAssignments).find(
        (k) => k !== key && newAssignments[k as AbilityKey] === value
      ) as AbilityKey | undefined;
      
      if (alreadyAssignedKey) {
        // Unassign the old ability
        newAssignments[alreadyAssignedKey] = 0;
      }
    }
    
    newAssignments[key] = value;
    setStandardArrayAssignments(newAssignments);
    
    // Update scores: 0 means unassigned
    const newScores = { ...abilityScores };
    if (value === 0) {
      newScores[key] = 0; // Unassigned
    } else {
      newScores[key] = value;
    }
    onUpdateScores(newScores);
  };

  // Get available values for a specific ability in standard array mode
  const getAvailableStandardValues = (key: AbilityKey): number[] => {
    // Get all values that are currently assigned to other abilities (not 0 and not this key)
    const usedValues = Object.entries(standardArrayAssignments)
      .filter(([k, v]) => k !== key && v !== 0 && v !== undefined)
      .map(([_, v]) => v);
    
    // Return only values that are not used by other abilities
    return STANDARD_ARRAY.filter((val) => !usedValues.includes(val));
  };

  const handleAssignRolled = (key: AbilityKey, rollIndex: number) => {
    if (rolledScores.length === 0) return;
    handleScoreChange(key, rolledScores[rollIndex]);
  };

  return (
    <div>
      <h2 className="mb-4 font-display text-2xl text-ink">
        Bước 3: Xác định chỉ số khả năng
      </h2>
      <p className="mb-6 text-slate-600">
        Sáu chỉ số khả năng (Strength, Dexterity, Constitution, Intelligence, Wisdom,
        Charisma) xác định khả năng cơ bản của nhân vật.
      </p>

      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Phương pháp
        </label>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => handleMethodChange("standard")}
            className={`rounded-xl px-4 py-2 text-sm transition-all ${
              method === "standard"
                ? "bg-amber-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Standard Array (15, 14, 13, 12, 10, 8)
          </button>
          <button
            type="button"
            onClick={() => handleMethodChange("roll")}
            className={`rounded-xl px-4 py-2 text-sm transition-all ${
              method === "roll"
                ? "bg-amber-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            4d6 Drop Lowest (Cuộn xúc xắc)
          </button>
          <button
            type="button"
            onClick={() => handleMethodChange("point")}
            className={`rounded-xl px-4 py-2 text-sm transition-all ${
              method === "point"
                ? "bg-amber-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Point Buy (27 điểm)
          </button>
        </div>
      </div>

      {method === "point" && (
        <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
          <div className="mb-2 text-sm font-medium text-slate-700">
            Điểm còn lại: <span className={`font-bold ${getTotalPointBuyCost(abilityScores) > 27 ? "text-red-600" : getTotalPointBuyCost(abilityScores) === 27 ? "text-green-600" : "text-slate-700"}`}>
              {27 - getTotalPointBuyCost(abilityScores)}
            </span> / 27
          </div>
          <div className="text-xs text-slate-600">
            Chi phí: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9 điểm
          </div>
        </div>
      )}

      {method === "roll" && rolledScores.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
          <div className="mb-2 text-sm font-medium text-slate-700">
            Kết quả xúc xắc:
          </div>
          <div className="flex flex-wrap gap-2">
            {rolledScores.map((score, idx) => (
              <div
                key={idx}
                className="rounded-lg bg-white px-3 py-1 text-sm font-medium text-ink"
              >
                {score}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {abilityKeys.map((key) => {
          const score = abilityScores[key] || 10;
          const mod = abilityModifier(score);
          const pointBuyCost = method === "point" ? getPointBuyCost(score) : null;
          
          return (
            <div
              key={key}
              className="rounded-2xl border border-amber-100 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-display text-lg font-medium text-ink">
                      {abilityLabels[key].label}
                    </span>
                    <span className="text-sm text-slate-600">
                      ({abilityLabels[key].description})
                    </span>
                    {method === "point" && pointBuyCost !== null && (
                      <span className="text-xs text-slate-500">
                        ({pointBuyCost} điểm)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {method === "standard" ? (
                      <select
                        value={standardArrayAssignments[key] || 0}
                        onChange={(e) =>
                          handleStandardArrayChange(key, parseInt(e.target.value) || 0)
                        }
                        className="w-24 rounded-lg border border-amber-100 bg-white px-3 py-2 text-center font-medium text-ink focus:border-amber-400 focus:outline-none"
                      >
                        <option value={0}>-- Chọn --</option>
                        {getAvailableStandardValues(key).map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                        {/* Show current value if it exists but is not in available list (shouldn't happen, but for safety) */}
                        {standardArrayAssignments[key] !== 0 && 
                         standardArrayAssignments[key] !== undefined &&
                         !getAvailableStandardValues(key).includes(standardArrayAssignments[key]) && (
                          <option value={standardArrayAssignments[key]} disabled>
                            {standardArrayAssignments[key]} (đã chọn)
                          </option>
                        )}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={method === "point" ? 8 : 1}
                        max={method === "point" ? 15 : 20}
                        value={score}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value) || (method === "point" ? 8 : 10);
                          handleScoreChange(key, newValue);
                        }}
                        className={`w-20 rounded-lg border px-3 py-2 text-center font-medium text-ink focus:border-amber-400 focus:outline-none ${
                          method === "point" && getTotalPointBuyCost(abilityScores) > 27
                            ? "border-red-300 bg-red-50"
                            : "border-amber-100 bg-white"
                        }`}
                      />
                    )}
                    {score > 0 && (
                      <div className="text-lg font-medium text-slate-700">
                        Modifier: {formatModifier(mod)}
                      </div>
                    )}
                  </div>
                </div>
                {method === "roll" && rolledScores.length > 0 && (
                  <div className="flex gap-2">
                    {rolledScores.map((roll, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAssignRolled(key, idx)}
                        className={`rounded-lg px-3 py-1 text-sm transition-all ${
                          score === roll
                            ? "bg-amber-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {roll}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {race && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-slate-700">
          <strong>Lưu ý:</strong> Nhớ áp dụng tăng chỉ số từ chủng tộc {race} sau khi
          phân bổ chỉ số!
        </div>
      )}
    </div>
  );
}

