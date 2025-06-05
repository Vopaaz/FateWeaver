// src/constants/forbiddenAreas.ts

import { CharacterId, LocationId } from './board';

/**
 * 禁行区域定义：key 为 CharacterId，value 为该角色不可进入的 LocationId 列表。
 * 如果角色尝试移入该列表中的地点，则移动无效，角色留在原地。
 */
export const FORBIDDEN_AREAS: Record<CharacterId, LocationId[]> = {
  BoyStudent: [],
  GirlStudent: [],
  RichMansDaughter: [],
  ClassRep: [],
  MysteryBoy: [],
  ShrineMaiden: ["City"],
  Alien: ["Hospital"],
  GodlyBeing: [],
  PoliceOfficer: [],
  OfficeWorker: ["School"],
  Informer: [],
  PopIdol: [],
  Journalist: [],
  Boss: [],
  Doctor: [],
  Patient: ["City", "School", "Shrine"],
  Nurse: [],
  Henchman: [],
  IdentificationOfficer: [],
  ArmyMan: [],
};
