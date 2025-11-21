import { useState, useEffect } from "react";
import type { Character, Class, Background } from "../../types";
import TextWithTooltips from "../TextWithTooltips";
import { apiUrl } from "../../config/api";

interface Step5EquipmentProps {
  character: Partial<Character>;
  onUpdate: (updates: Partial<Character>) => void;
}

interface EquipmentChoice {
  key: string; // "a", "b", or "_"
  items: EquipmentItem[];
}

interface EquipmentItem {
  type: "item" | "equipmentType" | "special";
  value: string; // item name, equipmentType, or special text
  quantity?: number;
  displayName?: string;
  source?: string;
}

interface SelectedEquipment {
  [choiceIndex: number]: string; // Maps choice index to selected option ("a", "b", or "_")
}

export default function Step5Equipment({
  character,
  onUpdate,
}: Step5EquipmentProps) {
  const [classData, setClassData] = useState<Class | null>(null);
  const [backgroundData, setBackgroundData] = useState<Background | null>(null);
  const [equipmentChoices, setEquipmentChoices] = useState<EquipmentChoice[]>([]);
  const [selectedChoices, setSelectedChoices] = useState<SelectedEquipment>({});
  const [finalItems, setFinalItems] = useState<string[]>([]);
  const [equipmentTypeItems, setEquipmentTypeItems] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (character.className) {
      loadClassData(character.className);
    }
    if (character.background) {
      loadBackgroundData(character.background);
    }
  }, [character.className, character.background]);

  const loadClassData = async (className: string) => {
    try {
      const response = await fetch(
        apiUrl(`api/data/classes/${className.toLowerCase()}`)
      );
      if (response.ok) {
        const data = await response.json();
        setClassData(data);
        parseEquipmentChoices(data);
      }
    } catch (error) {
      console.error("Error loading class data:", error);
    }
  };

  const loadBackgroundData = async (backgroundName: string) => {
    try {
      // Try to get background from backgrounds list
      const response = await fetch(apiUrl("api/data/backgrounds/phb"));
      if (response.ok) {
        const backgrounds = await response.json();
        const background = backgrounds.find(
          (bg: any) => bg.name.toLowerCase() === backgroundName.toLowerCase()
        );
        if (background) {
          setBackgroundData(background);
        }
      }
    } catch (error) {
      console.error("Error loading background data:", error);
    }
  };

  const parseEquipmentChoices = (classData: Class) => {
    if (!classData.startingEquipment?.defaultData) return;

    const choices: EquipmentChoice[] = [];
    
    classData.startingEquipment.defaultData.forEach((choiceGroup: any) => {
      // Each choice group can have "a", "b", or "_" keys
      // We'll store the entire choice group, not just one key
      if (choiceGroup.a || choiceGroup.b || choiceGroup._) {
        choices.push({
          key: choiceGroup.a && choiceGroup.b ? "choice" : "_",
          items: [],
        });
      }
    });

    setEquipmentChoices(choices);
    
    // Initialize selections: default to "a" if available, otherwise "_"
    const initialSelections: SelectedEquipment = {};
    classData.startingEquipment.defaultData.forEach((choiceGroup: any, index: number) => {
      if (choiceGroup.a && choiceGroup.b) {
        initialSelections[index] = "a";
      } else if (choiceGroup._) {
        initialSelections[index] = "_";
      } else if (choiceGroup.a) {
        initialSelections[index] = "a";
      } else if (choiceGroup.b) {
        initialSelections[index] = "b";
      }
    });
    setSelectedChoices(initialSelections);
  };

  const parseEquipmentItems = (items: any[]): EquipmentItem[] => {
    return items.map((item) => {
      if (typeof item === "string") {
        // Format: "itemName|source"
        const [name, source] = item.split("|");
        return {
          type: "item",
          value: name,
          source: source || "phb",
        };
      } else if (item.equipmentType) {
        // Equipment type like "weaponMartial"
        return {
          type: "equipmentType",
          value: item.equipmentType,
          quantity: item.quantity,
        };
      } else if (item.item) {
        // Object with item name
        return {
          type: "item",
          value: item.item.split("|")[0],
          source: item.item.split("|")[1] || "phb",
          quantity: item.quantity,
          displayName: item.displayName,
        };
      } else if (item.special) {
        // Special item (not in items.json)
        return {
          type: "special",
          value: item.special,
          quantity: item.quantity,
        };
      }
      return { type: "item", value: "" };
    });
  };

  const loadEquipmentTypeItems = async (equipmentType: string) => {
    if (equipmentTypeItems[equipmentType]) return; // Already loaded

    try {
      const url = apiUrl(`api/data/items/type/${encodeURIComponent(equipmentType)}`);
      console.log(`Loading equipment type: ${equipmentType} from ${url}`);
      const response = await fetch(url);
      if (response.ok) {
        const items = await response.json();
        console.log(`Loaded ${items.length} items for ${equipmentType}:`, items.map((i: any) => i.name));
        setEquipmentTypeItems((prev) => ({ ...prev, [equipmentType]: items }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Error loading equipment type ${equipmentType}:`, response.status, errorData);
        // Set empty array to prevent retrying
        setEquipmentTypeItems((prev) => ({ ...prev, [equipmentType]: [] }));
      }
    } catch (error) {
      console.error(`Error loading equipment type ${equipmentType}:`, error);
      // Set empty array to prevent retrying
      setEquipmentTypeItems((prev) => ({ ...prev, [equipmentType]: [] }));
    }
  };

  const handleChoiceChange = (choiceIndex: number, option: string) => {
    setSelectedChoices((prev) => ({ ...prev, [choiceIndex]: option }));
  };

  const handleEquipmentTypeItemSelect = (choiceIndex: number, itemName: string) => {
    // This will be handled when building final equipment list
    setSelectedChoices((prev) => ({
      ...prev,
      [`${choiceIndex}_item`]: itemName,
    }));
  };

  // Build final equipment list from selections
  useEffect(() => {
    if (!classData?.startingEquipment?.defaultData) {
      // If no class data yet, don't update
      setFinalItems([]);
      onUpdate({ equipment: [] });
      return;
    }

    const items: string[] = [];

    // Process class equipment choices
    classData.startingEquipment.defaultData.forEach((choiceGroup: any, index: number) => {
      const selectedOption = selectedChoices[index];
      if (!selectedOption) return;

      let itemsToAdd: EquipmentItem[] = [];
      
      if (selectedOption === "a" && choiceGroup.a) {
        itemsToAdd = parseEquipmentItems(choiceGroup.a);
      } else if (selectedOption === "b" && choiceGroup.b) {
        itemsToAdd = parseEquipmentItems(choiceGroup.b);
      } else if (selectedOption === "_" && choiceGroup._) {
        itemsToAdd = parseEquipmentItems(choiceGroup._);
      }

      // Add items to final list
      itemsToAdd.forEach((item) => {
        if (item.type === "item" || item.type === "special") {
          const displayName = item.displayName || item.value;
          const quantity = item.quantity ? ` (${item.quantity})` : "";
          items.push(`${displayName}${quantity}`);
        } else if (item.type === "equipmentType") {
          // Handle equipment type selection - need to handle quantity
          const selectedItem = selectedChoices[`${index}_item` as any];
          if (selectedItem) {
            const quantity = item.quantity || 1;
            if (quantity > 1) {
              for (let i = 0; i < quantity; i++) {
                items.push(selectedItem);
              }
            } else {
              items.push(selectedItem);
            }
          }
        }
      });
    });

    // Add background equipment
    if (backgroundData?.startingEquipment) {
      backgroundData.startingEquipment.forEach((bgChoice: any) => {
        if (bgChoice._) {
          bgChoice._.forEach((item: any) => {
            if (typeof item === "string") {
              const [name] = item.split("|");
              items.push(name);
            } else if (item.item) {
              const [name] = item.item.split("|");
              const displayName = item.displayName || name;
              items.push(displayName);
            } else if (item.special) {
              const quantity = item.quantity ? ` (${item.quantity})` : "";
              items.push(`${item.special}${quantity}`);
            }
          });
        }
        // Handle background choices (a/b)
        if (bgChoice.a || bgChoice.b) {
          // Background choices are usually simple, just add the selected one
          // For now, we'll add all items from both options (user should choose)
        }
      });
    }

    // Only update state if items actually changed
    setFinalItems((prev) => {
      const itemsStr = JSON.stringify(items.sort());
      const prevStr = JSON.stringify(prev.sort());
      if (itemsStr !== prevStr) {
        return items;
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChoices, classData, backgroundData]);

  // Separate effect to update parent when finalItems changes
  useEffect(() => {
    onUpdate({ equipment: finalItems });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalItems]);

  return (
    <div>
      <h2 className="mb-4 font-display text-2xl text-ink">Bước 5: Chọn trang bị</h2>
      <p className="mb-6 text-slate-600">
        Chọn trang bị ban đầu cho nhân vật. Trang bị được xác định bởi lớp và xuất thân của bạn.
      </p>

      {classData?.startingEquipment?.default && (
        <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
          <h3 className="mb-3 font-display text-lg text-ink">
            Trang bị mặc định của {classData.name}
          </h3>
          <div className="space-y-2 text-sm text-slate-700">
            {classData.startingEquipment.default.map((option: string, idx: number) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-amber-600">•</span>
                <span>
                  <TextWithTooltips text={option} />
                </span>
              </div>
            ))}
          </div>
          {classData.startingEquipment.goldAlternative && (
            <div className="mt-3 text-sm text-slate-600">
              <strong>Hoặc:</strong>{" "}
              <TextWithTooltips text={classData.startingEquipment.goldAlternative} />
            </div>
          )}
        </div>
      )}

      {/* Equipment Choices */}
      {equipmentChoices.length > 0 && (
        <div className="mb-6 space-y-4">
          <h3 className="font-display text-lg text-ink">Lựa chọn trang bị</h3>
          {equipmentChoices.map((_choice, choiceIndex) => {
            const choiceGroup = classData?.startingEquipment?.defaultData?.[choiceIndex];
            const hasOptions = choiceGroup?.a && choiceGroup?.b;
            const selectedOption = selectedChoices[choiceIndex] || (hasOptions ? "a" : "_");

            return (
              <div
                key={choiceIndex}
                className="rounded-2xl border border-amber-100 bg-white p-4"
              >
                {hasOptions ? (
                  <div className="space-y-3">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`choice-${choiceIndex}`}
                          value="a"
                          checked={selectedOption === "a"}
                          onChange={() => handleChoiceChange(choiceIndex, "a")}
                          className="text-amber-600 focus:ring-amber-400"
                        />
                        <span className="font-medium text-slate-700">(a)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`choice-${choiceIndex}`}
                          value="b"
                          checked={selectedOption === "b"}
                          onChange={() => handleChoiceChange(choiceIndex, "b")}
                          className="text-amber-600 focus:ring-amber-400"
                        />
                        <span className="font-medium text-slate-700">(b)</span>
                      </label>
                    </div>

                    {/* Option A */}
                    {selectedOption === "a" && choiceGroup.a && (
                      <div className="ml-6 space-y-2">
                        {parseEquipmentItems(choiceGroup.a).map((item, itemIndex) => (
                          <EquipmentItemDisplay
                            key={itemIndex}
                            item={item}
                            choiceIndex={choiceIndex}
                            onEquipmentTypeLoad={loadEquipmentTypeItems}
                            equipmentTypeItems={equipmentTypeItems}
                            onItemSelect={handleEquipmentTypeItemSelect}
                            selectedItem={selectedChoices[`${choiceIndex}_item` as any]}
                          />
                        ))}
                      </div>
                    )}

                    {/* Option B */}
                    {selectedOption === "b" && choiceGroup.b && (
                      <div className="ml-6 space-y-2">
                        {parseEquipmentItems(choiceGroup.b).map((item, itemIndex) => (
                          <EquipmentItemDisplay
                            key={itemIndex}
                            item={item}
                            choiceIndex={choiceIndex}
                            onEquipmentTypeLoad={loadEquipmentTypeItems}
                            equipmentTypeItems={equipmentTypeItems}
                            onItemSelect={handleEquipmentTypeItemSelect}
                            selectedItem={selectedChoices[`${choiceIndex}_item` as any]}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Required items (no choice)
                  <div className="space-y-2">
                    {choiceGroup?._ && parseEquipmentItems(choiceGroup._).map((item, itemIndex) => (
                      <EquipmentItemDisplay
                        key={itemIndex}
                        item={item}
                        choiceIndex={choiceIndex}
                        onEquipmentTypeLoad={loadEquipmentTypeItems}
                        equipmentTypeItems={equipmentTypeItems}
                        onItemSelect={handleEquipmentTypeItemSelect}
                        selectedItem={selectedChoices[`${choiceIndex}_item` as any]}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Background Equipment Info */}
      {backgroundData?.startingEquipment && (
        <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
          <h3 className="mb-2 font-display text-lg text-ink">
            Trang bị từ xuất thân ({backgroundData.name})
          </h3>
          <p className="text-sm text-slate-600">
            Trang bị từ xuất thân sẽ được thêm tự động vào danh sách trang bị của bạn.
          </p>
        </div>
      )}

      {/* Selected Equipment Summary */}
      <div className="rounded-2xl border border-amber-100 bg-white p-4">
        <h3 className="mb-3 font-display text-lg text-ink">Trang bị đã chọn</h3>
        {finalItems.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa chọn trang bị</p>
        ) : (
          <div className="space-y-2">
            {finalItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg bg-amber-50/50 px-3 py-2"
              >
                <span className="text-sm text-slate-700">
                  <TextWithTooltips text={item} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EquipmentItemDisplayProps {
  item: EquipmentItem;
  choiceIndex: number;
  onEquipmentTypeLoad: (type: string) => void;
  equipmentTypeItems: Record<string, any[]>;
  onItemSelect: (choiceIndex: number, itemName: string) => void;
  selectedItem?: string;
}

function EquipmentItemDisplay({
  item,
  choiceIndex,
  onEquipmentTypeLoad,
  equipmentTypeItems,
  onItemSelect,
  selectedItem,
}: EquipmentItemDisplayProps) {
  useEffect(() => {
    if (item.type === "equipmentType") {
      onEquipmentTypeLoad(item.value);
    }
  }, [item.type, item.value, onEquipmentTypeLoad]);

  if (item.type === "equipmentType") {
    const items = equipmentTypeItems[item.value] || [];
    const quantity = item.quantity || 1;
    const isLoading = !equipmentTypeItems[item.value] && item.value;

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Chọn {quantity > 1 ? `${quantity} ` : ""}
          {item.value === "weaponMartial" && "vũ khí chiến đấu"}
          {item.value === "weaponMartialMelee" && "vũ khí chiến đấu cận chiến"}
          {item.value === "weaponMartialRanged" && "vũ khí chiến đấu tầm xa"}
          {item.value === "weaponSimple" && "vũ khí đơn giản"}
          {item.value === "weaponSimpleMelee" && "vũ khí đơn giản cận chiến"}
          {item.value === "weaponSimpleRanged" && "vũ khí đơn giản tầm xa"}
          {item.value === "focusSpellcastingArcane" && "arcane focus"}
          {item.value === "focusSpellcastingHoly" && "holy symbol"}
          {item.value === "focusSpellcastingDruidic" && "druidic focus"}
          :
        </label>
        {isLoading ? (
          <div className="text-sm text-slate-500">Đang tải...</div>
        ) : (
          <select
            value={selectedItem || ""}
            onChange={(e) => onItemSelect(choiceIndex, e.target.value)}
            className="w-full rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-ink focus:border-amber-400 focus:outline-none"
          >
            <option value="">-- Chọn --</option>
            {items.length === 0 ? (
              <option value="" disabled>Không có lựa chọn</option>
            ) : (
              items.map((itemOption) => (
                <option key={itemOption.name} value={itemOption.name}>
                  {itemOption.name}
                </option>
              ))
            )}
          </select>
        )}
      </div>
    );
  }

  if (item.type === "special") {
    const quantity = item.quantity ? ` (${item.quantity})` : "";
    return (
      <div className="text-sm text-slate-700">
        • {item.value}
        {quantity}
      </div>
    );
  }

  // Regular item
  const displayName = item.displayName || item.value;
  const quantity = item.quantity ? ` (${item.quantity})` : "";
  const itemText = `${displayName}${quantity}`;

  return (
    <div className="text-sm text-slate-700">
      • <TextWithTooltips text={itemText} />
    </div>
  );
}
