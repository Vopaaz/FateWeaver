// src/constants/forbiddenAreas.ts

import { CharacterId, LocationId } from './board';

/**
 * 禁行区域定义：key 为 CharacterId，value 为该角色不可进入的 LocationId 列表。
 * 如果角色尝试移入该列表中的地点，则移动无效，角色留在原地。
 */
export const FORBIDDEN_AREAS: Record<CharacterId, LocationId[]> = {
  // 示例：所有角色默认都没有禁行区域
  BoyStudent: [],
  GirlStudent: [],
  RichMansDaughter: [],
  ClassRep: [],
  MysteryBoy: [],
  ShrineMaiden: [],
  Alien: [],
  GodlyBeing: [],
  PoliceOfficer: [],
  OfficeWorker: [],
  Informer: [],
  PopIdol: [],
  Journalist: [],
  Boss: [],
  Doctor: [],
  Patient: [],
  Nurse: [],
  Henchman: [],
  IdentificationOfficer: [],
  ArmyMan: [],
};
