import TextWithTooltips from "./TextWithTooltips";
import { useTranslation } from "../hooks/useTranslation";
import { useTranslationContext } from "../contexts/TranslationContext";

interface TooltipContentProps {
  type: string;
  name: string;
  data: any;
  loading: boolean;
}

// Component để hiển thị text đã dịch
const TranslatedText = ({
  text,
  skipTooltipProcessing = false,
}: {
  text: string;
  skipTooltipProcessing?: boolean;
}) => {
  const { translationEnabled } = useTranslationContext();
  const { translated, loading } = useTranslation(text, {
    enabled: translationEnabled,
    immediate: true,
    skipTooltipProcessing,
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

export default function TooltipContent({ type, name, data, loading }: TooltipContentProps) {
  if (loading) {
    return (
      <div className="text-xs p-3">
        <div className="text-slate-300">Đang tải...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-xs p-3">
        <div className="font-medium mb-1 text-white">{name}</div>
        <div className="text-slate-300">({type})</div>
      </div>
    );
  }

  // Format based on type
  switch (type) {
    case "spell":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.level !== undefined && (
            <div className="text-slate-300 mb-1 flex items-center gap-2">
              <span>
                {data.level === 0 ? "Cantrip" : `Level ${data.level}`} {data.school && `(${data.school})`}
              </span>
              {data.meta?.ritual && (
                <span className="rounded bg-purple-600 px-2 py-0.5 text-xs font-medium text-white">
                  Ritual
                </span>
              )}
            </div>
          )}
          {data.time && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Casting Time:</span>{" "}
              <span className="text-slate-300">
                {Array.isArray(data.time) ? data.time.map((t: any) => `${t.number} ${t.unit}`).join(", ") : data.time}
                {data.meta?.ritual && (
                  <span className="ml-2 text-purple-300 italic">
                    (có thể cast as ritual, thêm 10 phút)
                  </span>
                )}
              </span>
            </div>
          )}
          {data.meta?.ritual && (
            <div className="mb-2 rounded bg-purple-900/30 border border-purple-600/50 p-2 text-xs text-purple-200">
              <div className="font-medium mb-1">Ritual Casting:</div>
              <div>
                Bạn có thể cast spell này như một ritual. Ritual casting không tiêu tốn spell slot nhưng cần thêm 10 phút casting time.
              </div>
            </div>
          )}
          {data.range && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Range:</span>{" "}
              <span className="text-slate-300">
                {typeof data.range === "object" && data.range.distance
                  ? `${data.range.distance.amount} ${data.range.distance.type}`
                  : data.range}
              </span>
            </div>
          )}
          {data.components && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Components:</span>{" "}
              <span className="text-slate-300">
                {[
                  data.components.v && "V",
                  data.components.s && "S",
                  data.components.m && `M (${typeof data.components.m === "string" ? data.components.m : "material"})`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
          {data.duration && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Duration:</span>{" "}
              <span className="text-slate-300">
                {Array.isArray(data.duration)
                  ? data.duration.map((d: any) => {
                      if (d.type === "timed") {
                        return `${d.duration.amount} ${d.duration.type}${d.concentration ? " (Concentration)" : ""}`;
                      }
                      return d.type;
                    }).join(", ")
                  : data.duration}
              </span>
            </div>
          )}
          {data.ritual !== undefined && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Ritual:</span>{" "}
              <span className="text-slate-300">{data.ritual ? "Yes" : "No"}</span>
            </div>
          )}
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return (
                    <TranslatedText key={idx} text={entry} />
                  );
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1 mt-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TranslatedText text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                } else if (entry.type === "entries" && entry.name) {
                  return (
                    <div key={idx} className="mt-2">
                      <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
                      {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
                        if (typeof e === "string") {
                          return <TranslatedText key={i} text={e} />;
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
          {data.classes && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <span className="font-medium text-slate-200">Classes:</span>{" "}
              <span className="text-slate-300">
                {Array.isArray(data.classes) ? data.classes.map((c: any) => c.name || c).join(", ") : data.classes}
              </span>
            </div>
          )}
        </div>
      );

    case "condition":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          {data.entries && (
            <div className="text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return <TranslatedText key={idx} text={entry} />;
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TranslatedText text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                } else if (entry.type === "entries" && entry.name) {
                  return (
                    <div key={idx} className="mt-2">
                      <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
                      {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
                        if (typeof e === "string") {
                          return (
                            <div key={i} className="mb-1">
                              <TextWithTooltips text={e} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      );

    case "item":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          
          {/* Basic Properties */}
          {data.type && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Type:</span>{" "}
              <span className="text-slate-300">{data.type}</span>
            </div>
          )}
          {data.rarity && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Rarity:</span>{" "}
              <span className="text-slate-300">{data.rarity}</span>
            </div>
          )}
          {data.weight !== undefined && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Weight:</span>{" "}
              <span className="text-slate-300">{data.weight} lbs</span>
            </div>
          )}
          {data.value !== undefined && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Value:</span>{" "}
              <span className="text-slate-300">{data.value / 100} gp</span>
            </div>
          )}
          
          {/* Weapon Properties */}
          {data.weapon && (
            <>
              {data.weaponCategory && (
                <div className="mb-1">
                  <span className="font-medium text-slate-200">Weapon Category:</span>{" "}
                  <span className="text-slate-300">{data.weaponCategory}</span>
                </div>
              )}
              {data.property && Array.isArray(data.property) && data.property.length > 0 && (
                <div className="mb-1">
                  <span className="font-medium text-slate-200">Properties:</span>{" "}
                  <span className="text-slate-300">{data.property.join(", ")}</span>
                </div>
              )}
              {data.range && (
                <div className="mb-1">
                  <span className="font-medium text-slate-200">Range:</span>{" "}
                  <span className="text-slate-300">{data.range}</span>
                </div>
              )}
              {data.dmg1 && (
                <div className="mb-1">
                  <span className="font-medium text-slate-200">Damage:</span>{" "}
                  <span className="text-slate-300">
                    {data.dmg1}
                    {data.dmgType && ` ${data.dmgType}`}
                    {data.dmg2 && ` or ${data.dmg2}`}
                  </span>
                </div>
              )}
              {data.ammoType && (
                <div className="mb-1">
                  <span className="font-medium text-slate-200">Ammunition:</span>{" "}
                  <span className="text-slate-300">
                    <TextWithTooltips text={data.ammoType.split("|")[0]} />
                  </span>
                </div>
              )}
            </>
          )}
          
          {/* Armor Properties */}
          {data.armor && (
            <>
              {data.ac && (
                <div className="mb-1">
                  <span className="font-medium text-slate-200">Armor Class:</span>{" "}
                  <span className="text-slate-300">
                    {typeof data.ac === "number" ? data.ac : JSON.stringify(data.ac)}
                  </span>
                </div>
              )}
              {data.stealth !== undefined && (
                <div className="mb-1">
                  <span className="font-medium text-slate-200">Stealth:</span>{" "}
                  <span className="text-slate-300">{data.stealth ? "Disadvantage" : "Normal"}</span>
                </div>
              )}
            </>
          )}
          
          {/* Source and Page */}
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          
          {/* Entries */}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return <TranslatedText key={idx} text={entry} />;
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1 mt-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TextWithTooltips text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                }
                return null;
              })}
            </div>
          )}
          
          {/* Pack Contents */}
          {data.packContents && Array.isArray(data.packContents) && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="font-medium mb-1 text-slate-200">Pack Contents:</div>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                {data.packContents.map((content: any, idx: number) => {
                  if (typeof content === "string") {
                    const [itemName] = content.split("|");
                    return (
                      <li key={idx}>
                        <TextWithTooltips text={itemName} />
                      </li>
                    );
                  } else if (content.item) {
                    const [itemName] = content.item.split("|");
                    const quantity = content.quantity ? ` (${content.quantity})` : "";
                    return (
                      <li key={idx}>
                        <TextWithTooltips text={`${itemName}${quantity}`} />
                      </li>
                    );
                  }
                  return null;
                })}
              </ul>
            </div>
          )}
        </div>
      );

    case "feat":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.prerequisite && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Prerequisite:</span>{" "}
              <span className="text-slate-300">
                {typeof data.prerequisite === "string" ? (
                  <TextWithTooltips text={data.prerequisite} />
                ) : (
                  JSON.stringify(data.prerequisite)
                )}
              </span>
            </div>
          )}
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return <TranslatedText key={idx} text={entry} />;
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1 mt-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TextWithTooltips text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                } else if (entry.type === "entries" && entry.name) {
                  return (
                    <div key={idx} className="mt-2">
                      <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
                      {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
                        if (typeof e === "string") {
                          return (
                            <div key={i} className="mb-1">
                              <TextWithTooltips text={e} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      );

    case "class":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.hd && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Hit Die:</span>{" "}
              <span className="text-slate-300">d{data.hd.faces || 8}</span>
            </div>
          )}
          {data.proficiency && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Saving Throw Proficiencies:</span>{" "}
              <span className="text-slate-300">
                {Array.isArray(data.proficiency) ? data.proficiency.join(", ") : data.proficiency}
              </span>
            </div>
          )}
          {data.startingProficiencies && (
            <>
              {data.startingProficiencies.armor && Array.isArray(data.startingProficiencies.armor) && (
                <div className="mb-1">
                  <span className="font-medium text-slate-200">Armor:</span>{" "}
                  <span className="text-slate-300">{data.startingProficiencies.armor.join(", ")}</span>
                </div>
              )}
              {data.startingProficiencies.weapons && Array.isArray(data.startingProficiencies.weapons) && (
                <div className="mb-1">
                  <span className="font-medium text-slate-200">Weapons:</span>{" "}
                  <span className="text-slate-300">{data.startingProficiencies.weapons.join(", ")}</span>
                </div>
              )}
            </>
          )}
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return <TranslatedText key={idx} text={entry} />;
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1 mt-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TextWithTooltips text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                } else if (entry.type === "entries" && entry.name) {
                  return (
                    <div key={idx} className="mt-2">
                      <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
                      {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
                        if (typeof e === "string") {
                          return (
                            <div key={i} className="mb-1">
                              <TextWithTooltips text={e} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      );

    case "race":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.size && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Size:</span>{" "}
              <span className="text-slate-300">{Array.isArray(data.size) ? data.size[0] : data.size}</span>
            </div>
          )}
          {data.speed && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Speed:</span>{" "}
              <span className="text-slate-300">
                {typeof data.speed === "number" ? `${data.speed} feet` : `${data.speed.walk} feet`}
              </span>
            </div>
          )}
          {data.ability && Array.isArray(data.ability) && data.ability.length > 0 && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Ability Score Increase:</span>{" "}
              <span className="text-slate-300">
                {data.ability.map((a: any) => {
                  const parts: string[] = [];
                  if (a.str) parts.push(`STR +${a.str}`);
                  if (a.dex) parts.push(`DEX +${a.dex}`);
                  if (a.con) parts.push(`CON +${a.con}`);
                  if (a.int) parts.push(`INT +${a.int}`);
                  if (a.wis) parts.push(`WIS +${a.wis}`);
                  if (a.cha) parts.push(`CHA +${a.cha}`);
                  if (a.choose) parts.push("Choose");
                  return parts.join(", ");
                }).join("; ")}
              </span>
            </div>
          )}
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return (
                    <div key={idx} className="mb-1">
                      <TextWithTooltips text={entry} />
                    </div>
                  );
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1 mt-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TextWithTooltips text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                } else if (entry.type === "entries" && entry.name) {
                  return (
                    <div key={idx} className="mt-2">
                      <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
                      {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
                        if (typeof e === "string") {
                          return (
                            <div key={i} className="mb-1">
                              <TextWithTooltips text={e} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      );

    case "optionalfeature":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.level && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Level:</span>{" "}
              <span className="text-slate-300">{data.level}</span>
            </div>
          )}
          {data.className && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Class:</span>{" "}
              <span className="text-slate-300">{data.className}</span>
            </div>
          )}
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return <TranslatedText key={idx} text={entry} />;
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1 mt-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TextWithTooltips text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                } else if (entry.type === "entries" && entry.name) {
                  return (
                    <div key={idx} className="mt-2">
                      <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
                      {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
                        if (typeof e === "string") {
                          return (
                            <div key={i} className="mb-1">
                              <TextWithTooltips text={e} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      );

    case "skill":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.ability && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Ability:</span>{" "}
              <span className="text-slate-300">
                {Array.isArray(data.ability) ? data.ability.join(", ") : data.ability}
              </span>
            </div>
          )}
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return (
                    <div key={idx} className="mb-1">
                      <TranslatedText text={entry} />
                    </div>
                  );
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1 mt-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TranslatedText text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                } else if (entry.type === "entries" && entry.name) {
                  return (
                    <div key={idx} className="mt-2">
                      <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
                      {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
                        if (typeof e === "string") {
                          return (
                            <div key={i} className="mb-1">
                              <TranslatedText text={e} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
          {!data.entries && data.description && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              <TranslatedText text={data.description} />
            </div>
          )}
        </div>
      );

    case "background":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.skillProficiencies && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Skill Proficiencies:</span>{" "}
              <span className="text-slate-300">
                {Array.isArray(data.skillProficiencies) && data.skillProficiencies[0]
                  ? Object.keys(data.skillProficiencies[0])
                      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                      .join(", ")
                  : "Various"}
              </span>
            </div>
          )}
          {data.languageProficiencies && Array.isArray(data.languageProficiencies) && data.languageProficiencies.length > 0 && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Languages:</span>{" "}
              <span className="text-slate-300">
                {data.languageProficiencies.map((lang: any) => {
                  if (typeof lang === "string") return lang;
                  if (lang.anyStandard) return `${lang.anyStandard} of your choice`;
                  return JSON.stringify(lang);
                }).join(", ")}
              </span>
            </div>
          )}
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return <TranslatedText key={idx} text={entry} />;
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1 mt-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TextWithTooltips text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                } else if (entry.type === "entries" && entry.name) {
                  return (
                    <div key={idx} className="mt-2">
                      <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
                      {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
                        if (typeof e === "string") {
                          return (
                            <div key={i} className="mb-1">
                              <TextWithTooltips text={e} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      );

    case "creature":
    case "monster":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.size && data.type && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Type:</span>{" "}
              <span className="text-slate-300">
                {Array.isArray(data.size) ? data.size[0] : data.size} {data.type}
              </span>
            </div>
          )}
          {data.ac && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">AC:</span>{" "}
              <span className="text-slate-300">
                {typeof data.ac === "number" ? data.ac : JSON.stringify(data.ac)}
              </span>
            </div>
          )}
          {data.hp && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">HP:</span>{" "}
              <span className="text-slate-300">
                {typeof data.hp === "number" ? data.hp : data.hp.average || data.hp}
              </span>
            </div>
          )}
          {data.speed && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Speed:</span>{" "}
              <span className="text-slate-300">
                {typeof data.speed === "number"
                  ? `${data.speed} ft.`
                  : typeof data.speed === "object"
                  ? Object.entries(data.speed)
                      .map(([k, v]) => `${k} ${v} ft.`)
                      .join(", ")
                  : data.speed}
              </span>
            </div>
          )}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries
                .filter((e: any) => typeof e === "string")
                .slice(0, 2)
                .map((e: string, i: number) => (
                  <TranslatedText key={i} text={e} />
                ))}
            </div>
          )}
        </div>
      );

    case "atk":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">
            {data.description || data.name || name}
          </div>
          <div className="text-slate-300">
            {data.description || "Attack type: " + name}
          </div>
        </div>
      );

    case "hit":
    case "h":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">Hit</div>
          <div className="text-slate-300">
            {data.description || "The attack hits the target"}
          </div>
          {data.name && data.name !== "Hit" && (
            <div className="mt-1 text-slate-300">
              <span className="font-medium text-slate-200">Modifier:</span> +{data.name}
            </div>
          )}
        </div>
      );

    case "miss":
    case "m":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">Miss</div>
          <div className="text-slate-300">
            {data.description || "The attack misses the target"}
          </div>
        </div>
      );

    case "damage":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{name} Damage</div>
          <div className="text-slate-300">
            {data.description || `${name} is a type of damage in D&D 5e`}
          </div>
        </div>
      );

    case "dice":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">Dice Roll: {name}</div>
          <div className="text-slate-300">
            {data.description || `Roll ${name} to determine the result`}
          </div>
        </div>
      );

    case "dc":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">Difficulty Class: {name}</div>
          <div className="text-slate-300">
            {data.description || `A creature must make a saving throw or ability check with a DC of ${name} to succeed`}
          </div>
        </div>
      );

    case "language":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{name} Language</div>
          <div className="text-slate-300">
            {data.description || `${name} is a language spoken in the D&D world`}
          </div>
        </div>
      );

    case "variantrule":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return <TranslatedText key={idx} text={entry} />;
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1 mt-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TextWithTooltips text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                } else if (entry.type === "entries" && entry.name) {
                  return (
                    <div key={idx} className="mt-2">
                      <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
                      {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
                        if (typeof e === "string") {
                          return (
                            <div key={i} className="mb-1">
                              <TextWithTooltips text={e} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
          {!data.entries && data.description && (
            <div className="text-slate-300 leading-relaxed">
              <TranslatedText text={data.description} />
            </div>
          )}
        </div>
      );

    case "action":
      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {data.time && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Time:</span>{" "}
              <span className="text-slate-300">
                {Array.isArray(data.time) 
                  ? data.time.map((t: any) => `${t.number} ${t.unit}`).join(", ")
                  : data.time}
              </span>
            </div>
          )}
          {data.source && (
            <div className="mb-1">
              <span className="font-medium text-slate-200">Source:</span>{" "}
              <span className="text-slate-300">{data.source}</span>
              {data.page && <span className="text-slate-300">, page {data.page}</span>}
            </div>
          )}
          {data.entries && (
            <div className="mt-2 text-slate-300 leading-relaxed">
              {data.entries.map((entry: any, idx: number) => {
                if (typeof entry === "string") {
                  return <TranslatedText key={idx} text={entry} />;
                } else if (entry.type === "list" && Array.isArray(entry.items)) {
                  return (
                    <ul key={idx} className="list-disc list-inside mb-1 space-y-1 mt-1">
                      {entry.items.map((item: string, i: number) => (
                        <li key={i}>
                          <TextWithTooltips text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                } else if (entry.type === "entries" && entry.name) {
                  return (
                    <div key={idx} className="mt-2">
                      <div className="font-medium text-slate-200 mb-1">{entry.name}</div>
                      {entry.entries && Array.isArray(entry.entries) && entry.entries.map((e: any, i: number) => {
                        if (typeof e === "string") {
                          return (
                            <div key={i} className="mb-1">
                              <TextWithTooltips text={e} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      );

    default:
      // Generic format for other types
      let description = "";
      if (data.entries) {
        const textEntries = data.entries.filter((e: any) => typeof e === "string").slice(0, 2);
        description = textEntries.join(" ");
      } else if (data.description) {
        description = data.description;
      } else if (data.content) {
        description = data.content;
      }

      return (
        <div className="text-xs p-3 max-w-sm">
          <div className="font-bold mb-2 text-amber-400 text-sm">{data.name || name}</div>
          {description && (
            <div className="text-slate-300 leading-relaxed">
              <TranslatedText text={description} />
            </div>
          )}
          {!description && (
            <div className="text-slate-300">({type})</div>
          )}
        </div>
      );
  }
}

