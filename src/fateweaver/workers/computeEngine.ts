// src/fateweaver/workers/computeEngine.ts

import { MastermindActionId, ProtagonistActionId } from "../constants/actions";
import { Target } from "./computeWorker";
import { LocationId, CharacterId, ALL_LOCATIONS } from "../constants/board";
import { UtilityItem, ValueDefinition } from "../store/utilitySlice";
import { EVALUATORS } from "../utils/utilityEvaluator";
import { FORBIDDEN_AREAS } from "../constants/characters";

/**
 * ComputeEngine 现在接收：
 * - mastermindPlacement, protagonistPlacement：行为枚举实例
 * - boardState：当前 board 全量状态，包括 location 上的角色列表与 intrigue 值，和每个角色的 stats（paranoia, goodwill, intrigue, alive）
 * - utilities, values：完整的效用定义列表
 */
export interface BoardState {
  locations: Record<
    LocationId,
    { characters: CharacterId[]; intrigue: number }
  >;
  characterStats: Record<
    CharacterId,
    { paranoia: number; goodwill: number; intrigue: number; alive: boolean }
  >;
}

export class ComputeEngine {
  async compute(args: {
    mastermindPlacement: Record<MastermindActionId, Target[]>;
    protagonistPlacement: Record<ProtagonistActionId, Target[]>;
    boardState: BoardState;
    utilities: UtilityItem[];
    values: ValueDefinition[];
  }): Promise<number> {
    const newBoard = await this.computeNewBoardState(
      args.mastermindPlacement,
      args.protagonistPlacement,
      args.boardState
    );
    const utility = await this.computeUtilityValue(
      newBoard,
      args.utilities,
      args.values
    );
    return utility;
  }

  async computeNewBoardState(
    mastermindPlacement: Record<MastermindActionId, Target[]>,
    protagonistPlacement: Record<ProtagonistActionId, Target[]>,
    boardState: BoardState
  ): Promise<BoardState> {
    const newBoard: BoardState = {
      locations: {} as Record<
        LocationId,
        { characters: CharacterId[]; intrigue: number }
      >,
      characterStats: {} as Record<
        CharacterId,
        { paranoia: number; goodwill: number; intrigue: number; alive: boolean }
      >,
    };
    for (const loc of ALL_LOCATIONS) {
      newBoard.locations[loc] = {
        characters: [...boardState.locations[loc].characters],
        intrigue: boardState.locations[loc].intrigue,
      };
    }
    for (const cid in boardState.characterStats) {
      const stats = boardState.characterStats[cid as CharacterId];
      newBoard.characterStats[cid as CharacterId] = {
        paranoia: stats.paranoia,
        goodwill: stats.goodwill,
        intrigue: stats.intrigue,
        alive: stats.alive,
      };
    }

    type ActionInfo = { actionId: string; isMaster: boolean };
    const targetMap: Record<string, ActionInfo[]> = {};

    for (const actionId in mastermindPlacement) {
      const arr = mastermindPlacement[actionId as MastermindActionId];
      for (const t of arr) {
        const key = String(t);
        if (!targetMap[key]) targetMap[key] = [];
        targetMap[key].push({ actionId, isMaster: true });
      }
    }
    for (const actionId in protagonistPlacement) {
      const arr = protagonistPlacement[actionId as ProtagonistActionId];
      for (const t of arr) {
        const key = String(t);
        if (!targetMap[key]) targetMap[key] = [];
        targetMap[key].push({ actionId, isMaster: false });
      }
    }

    const findLocation = (charId: CharacterId): LocationId | undefined => {
      for (const loc of ALL_LOCATIONS) {
        if (newBoard.locations[loc].characters.includes(charId)) {
          return loc;
        }
      }
      return undefined;
    };

    const attemptMove = (
      charId: CharacterId,
      dest: LocationId,
      board: BoardState
    ) => {
      const forbidden = FORBIDDEN_AREAS[charId] || [];
      if (forbidden.includes(dest)) {
        return;
      }
      const src = findLocation(charId);
      if (src && src !== dest) {
        board.locations[src].characters = board.locations[
          src
        ].characters.filter((c) => c !== charId);
        board.locations[dest].characters.push(charId);
      }
    };

    for (const targetKey in targetMap) {
      const actions = targetMap[targetKey];
      if (actions.length === 1) {
        const { actionId } = actions[0];
        const t = targetKey as LocationId | CharacterId;
        switch (actionId) {
          case "GainIntrigue2": {
            if (ALL_LOCATIONS.includes(t as LocationId)) {
              newBoard.locations[t as LocationId].intrigue += 2;
            } else {
              newBoard.characterStats[t as CharacterId].intrigue += 2;
            }
            break;
          }
          case "GainIntrigue": {
            if (ALL_LOCATIONS.includes(t as LocationId)) {
              newBoard.locations[t as LocationId].intrigue += 1;
            } else {
              newBoard.characterStats[t as CharacterId].intrigue += 1;
            }
            break;
          }
          case "UselessLocationCover": {
            break;
          }
          case "DiagonalMove": {
            if (!ALL_LOCATIONS.includes(t as LocationId)) {
              const charId = t as CharacterId;
              const loc = findLocation(charId);
              if (!loc) break;
              let dest: LocationId | undefined;
              if (loc === "Hospital") dest = "School";
              else if (loc === "School") dest = "Hospital";
              else if (loc === "City") dest = "Shrine";
              else if (loc === "Shrine") dest = "City";
              if (dest) attemptMove(charId, dest, newBoard);
            }
            break;
          }
          case "VerticalMove": {
            if (!ALL_LOCATIONS.includes(t as LocationId)) {
              const charId = t as CharacterId;
              const loc = findLocation(charId);
              if (!loc) break;
              let dest: LocationId | undefined;
              if (loc === "Hospital") dest = "City";
              else if (loc === "City") dest = "Hospital";
              else if (loc === "Shrine") dest = "School";
              else if (loc === "School") dest = "Shrine";
              if (dest) attemptMove(charId, dest, newBoard);
            }
            break;
          }
          case "HorizontalMove": {
            if (!ALL_LOCATIONS.includes(t as LocationId)) {
              const charId = t as CharacterId;
              const loc = findLocation(charId);
              if (!loc) break;
              let dest: LocationId | undefined;
              if (loc === "Hospital") dest = "Shrine";
              else if (loc === "Shrine") dest = "Hospital";
              else if (loc === "City") dest = "School";
              else if (loc === "School") dest = "City";
              if (dest) attemptMove(charId, dest, newBoard);
            }
            break;
          }
          case "GainParanoia": {
            if (ALL_LOCATIONS.includes(t as LocationId)) break;
            newBoard.characterStats[t as CharacterId].paranoia += 1;
            break;
          }
          case "LoseParanoia": {
            if (ALL_LOCATIONS.includes(t as LocationId)) break;
            const cur = newBoard.characterStats[t as CharacterId].paranoia;
            newBoard.characterStats[t as CharacterId].paranoia = Math.max(
              0,
              cur - 1
            );
            break;
          }
          case "ForbidParanoia":
          case "ForbidGoodwill":
          case "ForbidMove": {
            break;
          }
          case "GainGoodwill2": {
            if (ALL_LOCATIONS.includes(t as LocationId)) break;
            newBoard.characterStats[t as CharacterId].goodwill += 2;
            break;
          }
          case "GainGoodwill": {
            if (ALL_LOCATIONS.includes(t as LocationId)) break;
            newBoard.characterStats[t as CharacterId].goodwill += 1;
            break;
          }
          default: {
            break;
          }
        }
      } else if (actions.length === 2) {
        const [a1, a2] = actions;
        const actSet = new Set([a1.actionId, a2.actionId]);
        const t = targetKey as LocationId | CharacterId;

        if (
          actSet.has("ForbidIntrigue") &&
          (actSet.has("GainIntrigue") || actSet.has("GainIntrigue2"))
        ) {
          continue;
        }
        if (
          actSet.has("ForbidMove") &&
          (actSet.has("DiagonalMove") ||
            actSet.has("VerticalMove") ||
            actSet.has("HorizontalMove"))
        ) {
          continue;
        }
        if (
          actSet.has("VerticalMove") &&
          actSet.has("HorizontalMove")
        ) {
          if (!ALL_LOCATIONS.includes(t as LocationId)) {
            const charId = t as CharacterId;
            const loc = findLocation(charId);
            if (!loc) continue;
            let dest: LocationId | undefined;
            if (loc === "Hospital") dest = "School";
            else if (loc === "School") dest = "Hospital";
            else if (loc === "City") dest = "Shrine";
            else if (loc === "Shrine") dest = "City";
            if (dest) attemptMove(charId, dest, newBoard);
            continue;
          }
        }
        if (actSet.has("GainParanoia") && actSet.has("LoseParanoia")) {
          continue;
        }
        if (
          actSet.has("ForbidParanoia") &&
          (actSet.has("GainParanoia") || actSet.has("LoseParanoia"))
        ) {
          continue;
        }
        if (
          actSet.has("ForbidGoodwill") &&
          (actSet.has("GainGoodwill") || actSet.has("GainGoodwill2"))
        ) {
          continue;
        }
        for (const info of actions) {
          const actionId = info.actionId;
          const tval = targetKey as LocationId | CharacterId;
          switch (actionId) {
            case "GainIntrigue2": {
              if (ALL_LOCATIONS.includes(tval as LocationId)) {
                newBoard.locations[tval as LocationId].intrigue += 2;
              } else {
                newBoard.characterStats[tval as CharacterId].intrigue += 2;
              }
              break;
            }
            case "GainIntrigue": {
              if (ALL_LOCATIONS.includes(tval as LocationId)) {
                newBoard.locations[tval as LocationId].intrigue += 1;
              } else {
                newBoard.characterStats[tval as CharacterId].intrigue += 1;
              }
              break;
            }
            case "UselessLocationCover": {
              break;
            }
            case "DiagonalMove": {
              if (!ALL_LOCATIONS.includes(tval as LocationId)) {
                const charId = tval as CharacterId;
                const loc = findLocation(charId);
                if (!loc) break;
                let dest: LocationId | undefined;
                if (loc === "Hospital") dest = "School";
                else if (loc === "School") dest = "Hospital";
                else if (loc === "City") dest = "Shrine";
                else if (loc === "Shrine") dest = "City";
                if (dest) attemptMove(charId, dest, newBoard);
              }
              break;
            }
            case "VerticalMove": {
              if (!ALL_LOCATIONS.includes(tval as LocationId)) {
                const charId = tval as CharacterId;
                const loc = findLocation(charId);
                if (!loc) break;
                let dest: LocationId | undefined;
                if (loc === "Hospital") dest = "City";
                else if (loc === "City") dest = "Hospital";
                else if (loc === "Shrine") dest = "School";
                else if (loc === "School") dest = "Shrine";
                if (dest) attemptMove(charId, dest, newBoard);
              }
              break;
            }
            case "HorizontalMove": {
              if (!ALL_LOCATIONS.includes(tval as LocationId)) {
                const charId = tval as CharacterId;
                const loc = findLocation(charId);
                if (!loc) break;
                let dest: LocationId | undefined;
                if (loc === "Hospital") dest = "Shrine";
                else if (loc === "Shrine") dest = "Hospital";
                else if (loc === "City") dest = "School";
                else if (loc === "School") dest = "City";
                if (dest) attemptMove(charId, dest, newBoard);
              }
              break;
            }
            case "GainParanoia": {
              if (ALL_LOCATIONS.includes(tval as LocationId)) break;
              newBoard.characterStats[tval as CharacterId].paranoia += 1;
              break;
            }
            case "LoseParanoia": {
              if (ALL_LOCATIONS.includes(tval as LocationId)) break;
              const cur = newBoard.characterStats[tval as CharacterId].paranoia;
              newBoard.characterStats[tval as CharacterId].paranoia = Math.max(
                0,
                cur - 1
              );
              break;
            }
            case "ForbidParanoia":
            case "ForbidGoodwill":
            case "ForbidMove": {
              break;
            }
            case "GainGoodwill2": {
              if (ALL_LOCATIONS.includes(tval as LocationId)) break;
              newBoard.characterStats[tval as CharacterId].goodwill += 2;
              break;
            }
            case "GainGoodwill": {
              if (ALL_LOCATIONS.includes(tval as LocationId)) break;
              newBoard.characterStats[tval as CharacterId].goodwill += 1;
              break;
            }
            default: {
              break;
            }
          }
        }
      } 
    }

    return newBoard;
  }

  async computeUtilityValue(
    boardState: BoardState,
    utilities: UtilityItem[],
    values: ValueDefinition[]
  ): Promise<number> {
    // 构造 ruleMap: id -> UtilityItem
    const ruleMap = new Map<string, UtilityItem>();
    for (const u of utilities) {
      ruleMap.set(u.id, u);
    }
    // 缓存计算结果: ruleId -> boolean
    const cache = new Map<string, boolean>();

    // 递归计算某条规则的布尔结果
    const evalRule = (ruleId: string): boolean => {
      if (cache.has(ruleId)) {
        return cache.get(ruleId)!;
      }
      const rule = ruleMap.get(ruleId)!;
      const evaluator = EVALUATORS[rule.type];
      const result = evaluator(rule.params, boardState, evalRule);
      cache.set(ruleId, result);
      return result;
    };

    // 计算最终的效用值总和
    let totalUtility = 0;
    for (const vd of values) {
      if (evalRule(vd.ruleId)) {
        totalUtility += vd.value;
      }
    }
    return totalUtility;
  }
}
