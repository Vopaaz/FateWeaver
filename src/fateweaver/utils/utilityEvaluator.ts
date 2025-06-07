// src/fateweaver/utils/utilityEvaluators.ts

import { BoardState } from "../workers/computeEngine";
import { CharacterId, LocationId, ALL_LOCATIONS } from "../constants/board";

/**
 * 返回角色当前所在地点；如果不在任何地点则返回 undefined
 */
export function findCharacterLocation(
  charId: CharacterId,
  boardState: BoardState
): LocationId | undefined {
  for (const loc of ALL_LOCATIONS) {
    if (boardState.locations[loc].characters.includes(charId)) {
      return loc;
    }
  }
  return undefined;
}

/**
 * 基本规则：? 的不安大于 ?
 * params[0]: CharacterId
 * params[1]: number
 */
export function evalParanoiaGreaterThan(
  params: any[],
  boardState: BoardState
): boolean {
  const charId = params[0] as CharacterId;
  const threshold = params[1] as number;
  return boardState.characterStats[charId].paranoia > threshold;
}

/**
 * 基本规则：? 的密谋大于 ?
 * params[0]: Target (CharacterId 或 LocationId)
 * params[1]: number
 */
export function evalIntrigueGreaterThan(
  params: any[],
  boardState: BoardState
): boolean {
  const target = params[0] as CharacterId | LocationId;
  const threshold = params[1] as number;
  if (ALL_LOCATIONS.includes(target as LocationId)) {
    return boardState.locations[target as LocationId].intrigue > threshold;
  } else {
    return (
      boardState.characterStats[target as CharacterId].intrigue > threshold
    );
  }
}

/**
 * 基本规则：? 的友好大于 ?
 * params[0]: CharacterId
 * params[1]: number
 */
export function evalGoodwillGreaterThan(
  params: any[],
  boardState: BoardState
): boolean {
  const charId = params[0] as CharacterId;
  const threshold = params[1] as number;
  return boardState.characterStats[charId].goodwill > threshold;
}

/**
 * 基本规则：? 位于 ?
 * params[0]: CharacterId
 * params[1]: LocationId
 */
export function evalSomeoneInSomewhere(
  params: any[],
  boardState: BoardState
): boolean {
  const charId = params[0] as CharacterId;
  const location = params[1] as LocationId;
  const loc = findCharacterLocation(charId, boardState);
  return loc === location;
}

/**
 * 基本规则：? 与 ? 处于同一地点
 * params[0]: CharacterId
 * params[1]: CharacterId
 */
export function evalSomeoneInSameLocationAs(
  params: any[],
  boardState: BoardState
): boolean {
  const charA = params[0] as CharacterId;
  const charB = params[1] as CharacterId;
  const locA = findCharacterLocation(charA, boardState);
  if (!locA) return false;
  const locB = findCharacterLocation(charB, boardState);
  return locA === locB;
}

/**
 * 基本规则：与 ? 处于同一地点的人数大于 ?
 * params[0]: CharacterId
 * params[1]: number
 *
 * 注：计算同地点的人数时，不包括自身，且只统计存活角色
 */
export function evalNumberShareLocationGreaterThan(
  params: any[],
  boardState: BoardState
): boolean {
  const charId = params[0] as CharacterId;
  const threshold = params[1] as number;
  const loc = findCharacterLocation(charId, boardState);
  if (!loc) return false;
  // 只统计存活的角色
  const aliveChars = boardState.locations[loc].characters.filter(
    (id) => boardState.characterStats[id].alive
  );
  // 排除自身
  const countAtLoc = aliveChars.filter((id) => id !== charId).length;
  return countAtLoc > threshold;
}

/**
 * 基本规则：与 ? 处于同一地点的人数等于 ?
 * params[0]: CharacterId
 * params[1]: number
 *
 * 注：计算同地点的人数时，不包括自身，且只统计存活角色
 */
export function evalNumberShareLocationEquals(
  params: any[],
  boardState: BoardState
): boolean {
  const charId = params[0] as CharacterId;
  const targetNumber = params[1] as number;
  const loc = findCharacterLocation(charId, boardState);
  if (!loc) return false;
  // 只统计存活的角色
  const aliveChars = boardState.locations[loc].characters.filter(
    (id) => boardState.characterStats[id].alive
  );
  // 排除自身
  const countAtLoc = aliveChars.filter((id) => id !== charId).length;
  return countAtLoc === targetNumber;
}

/**
 * 逻辑组合规则：and, or, not
 * params: 包含子规则的 id 字符串，暂由 computeEngine 内部处理
 */
export const EVALUATORS: Record<
  string,
  (
    params: any[],
    boardState: BoardState,
    evalRule: (id: string) => boolean
  ) => boolean
> = {
  paranoiaGreaterThan: (params, boardState) =>
    evalParanoiaGreaterThan(params, boardState),
  intrigueGreaterThan: (params, boardState) =>
    evalIntrigueGreaterThan(params, boardState),
  goodwillGreaterThan: (params, boardState) =>
    evalGoodwillGreaterThan(params, boardState),
  someoneInSomewhere: (params, boardState) =>
    evalSomeoneInSomewhere(params, boardState),
  someoneInSameLocationAs: (params, boardState) =>
    evalSomeoneInSameLocationAs(params, boardState),
  numberShareLocationGreaterThan: (params, boardState) =>
    evalNumberShareLocationGreaterThan(params, boardState),
  numberShareLocationEquals: (params, boardState) =>
    evalNumberShareLocationEquals(params, boardState),
  and: (params, boardState, evalRule) => {
    const sub1 = params[0] as string;
    const sub2 = params[1] as string;
    return evalRule(sub1) && evalRule(sub2);
  },
  or: (params, boardState, evalRule) => {
    const sub1 = params[0] as string;
    const sub2 = params[1] as string;
    return evalRule(sub1) || evalRule(sub2);
  },
  not: (params, boardState, evalRule) => {
    const sub = params[0] as string;
    return !evalRule(sub);
  },
};
