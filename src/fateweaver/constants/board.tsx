export type LocationId = "Hospital" | "Shrine" | "City" | "School";
export const LOCATIONS_I18N: Record<LocationId, string> = {
  Hospital: "医院",
  Shrine: "神社",
  City: "都市",
  School: "学校",
};
export const ALL_LOCATIONS = Object.keys(LOCATIONS_I18N) as LocationId[];

export type CharacterId =
  | "BoyStudent"
  | "GirlStudent"
  | "RichMansDaughter"
  | "ClassRep"
  | "MysteryBoy"
  | "ShrineMaiden"
  | "Alien"
  | "GodlyBeing"
  | "PoliceOfficer"
  | "OfficeWorker"
  | "Informer"
  | "PopIdol"
  | "Journalist"
  | "Boss"
  | "Doctor"
  | "Patient"
  | "Nurse"
  | "Henchman"
  | "IdentificationOfficer"
  | "ArmyMan"
  | "UnlockedPatient";

export const CHARACTERS_I18N: Record<CharacterId, string> = {
  BoyStudent: "男学生",
  GirlStudent: "女学生",
  RichMansDaughter: "大小姐",
  ClassRep: "班长",
  MysteryBoy: "局外人",
  ShrineMaiden: "巫女",
  Alien: "异界人",
  GodlyBeing: "神灵",
  PoliceOfficer: "刑警",
  OfficeWorker: "职员",
  Informer: "情报商",
  PopIdol: "偶像",
  Journalist: "媒体人",
  Boss: "大人物",
  Doctor: "医生",
  Patient: "住院患者",
  Nurse: "护士",
  Henchman: "手下",
  IdentificationOfficer: "鉴别员",
  ArmyMan: "军人",
  UnlockedPatient: "已康复患者"
};
export const ALL_CHARACTERS = Object.keys(CHARACTERS_I18N) as CharacterId[];
