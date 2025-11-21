export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type AbilityScores = Record<AbilityKey, number>;

export interface Character {
  id: string;
  name: string;
  race: string;
  subrace?: string;
  className: string;
  subclass?: string;
  background: string;
  alignment: string;
  level: number;
  abilityScores: AbilityScores;
  proficiencies: string[];
  equipment: string[];
  feats?: string[];
  raceAbilityChoices?: AbilityKey[]; // Chosen ability scores from race/subrace
  raceSkillChoices?: string[]; // Chosen skills from race/subrace
  raceFeatChoices?: string[]; // Chosen feats from race/subrace
  raceLanguageChoices?: string[]; // Chosen languages from race/subrace
  raceResistanceChoice?: string; // Chosen damage resistance type (e.g., "fire", "cold")
  raceToolChoice?: string; // Chosen tool proficiency
  raceDraconicAncestry?: string; // Chosen draconic ancestry (e.g., "Red", "Blue")
  classSkillChoices?: string[]; // Chosen skills from class
  backgroundSkillChoices?: string[]; // Chosen skills from background
  backgroundLanguageChoices?: string[]; // Chosen languages from background
  backgroundToolChoices?: string[]; // Chosen tools from background
  backgroundEquipmentChoices?: Record<number, string>; // Chosen equipment options (index -> "a" | "b" | "_")
  backgroundFeatureChoices?: string[]; // Chosen feature options if feature has choices
  spells?: {
    cantrips?: string[]; // Known cantrips
    level1?: string[]; // Known/prepared 1st level spells
    level2?: string[]; // Known/prepared 2nd level spells
    level3?: string[]; // Known/prepared 3rd level spells
    level4?: string[]; // Known/prepared 4th level spells
    level5?: string[]; // Known/prepared 5th level spells
    level6?: string[]; // Known/prepared 6th level spells
    level7?: string[]; // Known/prepared 7th level spells
    level8?: string[]; // Known/prepared 8th level spells
    level9?: string[]; // Known/prepared 9th level spells
  };
  ideals?: string;
  bonds?: string;
  flaws?: string;
  notes?: string;
  calculatedStats?: CalculatedStats;
  createdAt: string;
  updatedAt?: string;
}

export interface Race {
  name: string;
  source: string;
  page?: number;
  size: string[];
  speed: number | { walk: number; [key: string]: number };
  ability: Array<Partial<AbilityScores>>;
  languageProficiencies?: any[];
  entries?: any[];
  [key: string]: any;
}

export interface Subrace {
  name: string;
  source: string;
  raceName: string;
  raceSource: string;
  page?: number;
  ability?: Array<Partial<AbilityScores>>;
  entries?: any[];
  [key: string]: any;
}

export interface Class {
  name: string;
  source: string;
  page?: number;
  hd: { number: number; faces: number };
  proficiency: AbilityKey[];
  startingProficiencies: {
    armor?: string[];
    weapons?: string[];
    skills?: Array<{ choose?: { from: string[]; count: number } }>;
  };
  startingEquipment?: {
    default?: string[];
    defaultData?: any[];
    goldAlternative?: string;
  };
  classFeatures?: any[];
  subclassTitle?: string;
  [key: string]: any;
}

export interface Subclass {
  name: string;
  shortName?: string;
  source: string;
  className: string;
  classSource: string;
  page?: number;
  entries?: any[];
  subclassFeatures?: string[];
  [key: string]: any;
}

export interface Feat {
  name: string;
  source: string;
  page?: number;
  ability?: Array<Partial<AbilityScores>>;
  entries?: any[];
  prerequisite?: any[];
  [key: string]: any;
}

export interface Background {
  name: string;
  source: string;
  page?: number;
  skillProficiencies?: Array<Record<string, boolean>>;
  languageProficiencies?: any[];
  startingEquipment?: any[];
  [key: string]: any;
}

export type CreationStep = 1 | 2 | 3 | 4 | 5 | 6 | 6.5 | 7;

export interface CalculatedStats {
  ac: number; // Armor Class
  initiative: number;
  speed: number;
  passivePerception: number;
  proficiencyBonus: number;
  savingThrows: Record<AbilityKey, { proficient: boolean; modifier: number }>;
  hp: number;
  maxHp: number;
  hitDie: string;
  skills: Record<string, { proficient: boolean; modifier: number }>;
  expandedEquipment: string[]; // Equipment với pack contents đã mở
}

