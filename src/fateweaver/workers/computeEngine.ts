// src/fateweaver/workers/computeEngine.ts

import { MastermindActionId, ProtagonistActionId } from "../constants/actions";
import { Target } from "./computeWorker";
import { LocationId, CharacterId, ALL_LOCATIONS } from "../constants/board";
import { UtilityItem, ValueDefinition } from "../store/utilitySlice";
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
    // console.log(
    //   JSON.stringify({
    //     mastermind: args.mastermindPlacement,
    //     protagonist: args.protagonistPlacement,
    //     oldBoard: args.boardState,
    //     newBoard: newBoard,
    //   })
    // );
    return await this.computeUtilityValue(
      newBoard,
      args.utilities,
      args.values
    );
  }

  /**
   * 根据 placement 计算出新的 board 状态
   */
  async computeNewBoardState(
    mastermindPlacement: Record<MastermindActionId, Target[]>,
    protagonistPlacement: Record<ProtagonistActionId, Target[]>,
    boardState: BoardState
  ): Promise<BoardState> {
    // 做一次深拷贝，避免修改原始 state
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

    // 深拷贝 locations
    for (const loc of ALL_LOCATIONS) {
      newBoard.locations[loc] = {
        characters: [...boardState.locations[loc].characters],
        intrigue: boardState.locations[loc].intrigue,
      };
    }
    // 深拷贝 characterStats
    for (const cid in boardState.characterStats) {
      const stats = boardState.characterStats[cid as CharacterId];
      newBoard.characterStats[cid as CharacterId] = {
        paranoia: stats.paranoia,
        goodwill: stats.goodwill,
        intrigue: stats.intrigue,
        alive: stats.alive,
      };
    }

    // 构造 target 到 action 列表的映射
    type ActionInfo = { actionId: string; isMaster: boolean };
    const targetMap: Record<string, ActionInfo[]> = {};

    // 收集 Mastermind 的 action -> targets
    for (const actionId in mastermindPlacement) {
      const arr = mastermindPlacement[actionId as MastermindActionId];
      for (const t of arr) {
        const key = String(t);
        if (!targetMap[key]) targetMap[key] = [];
        targetMap[key].push({ actionId, isMaster: true });
      }
    }
    // 收集 Protagonist 的 action -> targets
    for (const actionId in protagonistPlacement) {
      const arr = protagonistPlacement[actionId as ProtagonistActionId];
      for (const t of arr) {
        const key = String(t);
        if (!targetMap[key]) targetMap[key] = [];
        targetMap[key].push({ actionId, isMaster: false });
      }
    }

    // Helper：找到角色当前所在地点。如果找不到，返回 undefined
    const findCharacterLocation = (
      charId: CharacterId
    ): LocationId | undefined => {
      for (const loc of ALL_LOCATIONS) {
        if (newBoard.locations[loc].characters.includes(charId)) {
          return loc;
        }
      }
      return undefined;
    };

    // Helper：尝试移动角色到目标地点，如果该地点在禁行列表，则不移动
    const attemptMove = (
      charId: CharacterId,
      dest: LocationId,
      board: BoardState
    ) => {
      const forbidden = FORBIDDEN_AREAS[charId] || [];
      if (forbidden.includes(dest)) {
        return; // 禁行，留在原地
      }
      const src = findCharacterLocation(charId);
      if (src && src !== dest) {
        // 从 src 数组移除
        board.locations[src].characters = board.locations[
          src
        ].characters.filter((c) => c !== charId);
        // 加到 dest
        board.locations[dest].characters.push(charId);
      }
    };

    // 处理每个 target
    for (const targetKey in targetMap) {
      const actions = targetMap[targetKey]; // ActionInfo[]
      // 只有一张牌打在 target
      if (actions.length === 1) {
        const { actionId } = actions[0];
        const t = targetKey as LocationId | CharacterId;
        // 单张处理
        switch (actionId) {
          case "GainIntrigue2": {
            // 密谋 +2
            if (ALL_LOCATIONS.includes(t as LocationId)) {
              newBoard.locations[t as LocationId].intrigue += 2;
            } else {
              newBoard.characterStats[t as CharacterId].intrigue += 2;
            }
            break;
          }
          case "GainIntrigue": {
            // 密谋 +1
            if (ALL_LOCATIONS.includes(t as LocationId)) {
              newBoard.locations[t as LocationId].intrigue += 1;
            } else {
              newBoard.characterStats[t as CharacterId].intrigue += 1;
            }
            break;
          }
          case "UselessLocationCover": {
            // 地点伪装：无效果
            break;
          }
          case "DiagonalMove": {
            // 斜向移动
            if (!ALL_LOCATIONS.includes(t as LocationId)) break;
            // t 实际是角色 id
            const charId = t as CharacterId;
            const loc = findCharacterLocation(charId);
            if (!loc) break;
            let dest: LocationId | undefined;
            if (loc === "Hospital") dest = "School";
            else if (loc === "School") dest = "Hospital";
            else if (loc === "City") dest = "Shrine";
            else if (loc === "Shrine") dest = "City";
            if (dest) attemptMove(charId, dest, newBoard);
            break;
          }
          case "VerticalMove": {
            // 垂直移动
            if (!ALL_LOCATIONS.includes(t as LocationId)) break;
            const charId = t as CharacterId;
            const loc = findCharacterLocation(charId);
            if (!loc) break;
            let dest: LocationId | undefined;
            if (loc === "Hospital") dest = "City";
            else if (loc === "City") dest = "Hospital";
            else if (loc === "Shrine") dest = "School";
            else if (loc === "School") dest = "Shrine";
            if (dest) attemptMove(charId, dest, newBoard);
            break;
          }
          case "HorizontalMove": {
            // 水平移动
            if (!ALL_LOCATIONS.includes(t as LocationId)) break;
            const charId = t as CharacterId;
            const loc = findCharacterLocation(charId);
            if (!loc) break;
            let dest: LocationId | undefined;
            if (loc === "Hospital") dest = "Shrine";
            else if (loc === "Shrine") dest = "Hospital";
            else if (loc === "City") dest = "School";
            else if (loc === "School") dest = "City";
            if (dest) attemptMove(charId, dest, newBoard);
            break;
          }
          case "GainParanoia": {
            // 不安 +1（只对角色有效）
            if (ALL_LOCATIONS.includes(t as LocationId)) break;
            newBoard.characterStats[t as CharacterId].paranoia += 1;
            break;
          }
          case "LoseParanoia": {
            // 不安 -1
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
            // 单独打出无效果
            break;
          }
          case "GainGoodwill2": {
            // 友好 +2
            if (ALL_LOCATIONS.includes(t as LocationId)) break;
            newBoard.characterStats[t as CharacterId].goodwill += 2;
            break;
          }
          case "GainGoodwill": {
            // 友好 +1
            if (ALL_LOCATIONS.includes(t as LocationId)) break;
            newBoard.characterStats[t as CharacterId].goodwill += 1;
            break;
          }
          default: {
            // 其他 actionId 未在此列出，暂不处理
            break;
          }
        }
      } else if (actions.length === 2) {
        // 双牌交互
        const [a1, a2] = actions;
        const actSet = new Set([a1.actionId, a2.actionId]);
        const t = targetKey as LocationId | CharacterId;

        // 情形 1：禁止密谋 与 密谋+1/密谋+2 同时，跳过
        if (
          actSet.has("ForbidIntrigue") &&
          (actSet.has("GainIntrigue") || actSet.has("GainIntrigue2"))
        ) {
          continue;
        }
        // 情形 2：ForbidMove 与 任意移动 同时，跳过
        if (
          actSet.has("ForbidMove") &&
          (actSet.has("DiagonalMove") ||
            actSet.has("VerticalMove") ||
            actSet.has("HorizontalMove"))
        ) {
          continue;
        }
        // 情形 3：两张垂直移动打一起，等价一次 VerticalMove
        if (
          actSet.has("VerticalMove") &&
          actSet.has("VerticalMove") &&
          !actSet.has("ForbidMove")
        ) {
          // 把 t 当作角色 id 处理一次 VerticalMove
          if (!ALL_LOCATIONS.includes(t as LocationId)) {
            const charId = t as CharacterId;
            const loc = findCharacterLocation(charId);
            if (!loc) continue;
            let dest: LocationId | undefined;
            if (loc === "Hospital") dest = "City";
            else if (loc === "City") dest = "Hospital";
            else if (loc === "Shrine") dest = "School";
            else if (loc === "School") dest = "Shrine";
            if (dest) attemptMove(charId, dest, newBoard);
            continue;
          }
        }
        // 情形 4：两张水平移动打一起，等价一次 HorizontalMove
        if (
          actSet.has("HorizontalMove") &&
          actSet.has("HorizontalMove") &&
          !actSet.has("ForbidMove")
        ) {
          if (!ALL_LOCATIONS.includes(t as LocationId)) {
            const charId = t as CharacterId;
            const loc = findCharacterLocation(charId);
            if (!loc) continue;
            let dest: LocationId | undefined;
            if (loc === "Hospital") dest = "Shrine";
            else if (loc === "Shrine") dest = "Hospital";
            else if (loc === "City") dest = "School";
            else if (loc === "School") dest = "City";
            if (dest) attemptMove(charId, dest, newBoard);
            continue;
          }
        }
        // 情形 5：一张垂直 + 一张水平，等价一次 DiagonalMove
        if (
          actSet.has("VerticalMove") &&
          actSet.has("HorizontalMove") &&
          !actSet.has("ForbidMove")
        ) {
          if (!ALL_LOCATIONS.includes(t as LocationId)) {
            const charId = t as CharacterId;
            const loc = findCharacterLocation(charId);
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
        // 情形 6：不安 +1 与 不安 -1 打一起，跳过
        if (actSet.has("GainParanoia") && actSet.has("LoseParanoia")) {
          continue;
        }
        // 情形 7：ForbidParanoia 与 (GainParanoia | LoseParanoia) 打一起，跳过
        if (
          actSet.has("ForbidParanoia") &&
          (actSet.has("GainParanoia") || actSet.has("LoseParanoia"))
        ) {
          continue;
        }
        // 情形 8：ForbidGoodwill 与 (GainGoodwill | GainGoodwill2) 打一起，跳过
        if (
          actSet.has("ForbidGoodwill") &&
          (actSet.has("GainGoodwill") || actSet.has("GainGoodwill2"))
        ) {
          continue;
        }

        // 未在上述交互规则列出的双牌，就按任意顺序依次单张处理
        for (const info of actions) {
          const actionId = info.actionId;
          // 复用单张处理逻辑
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
                const loc = findCharacterLocation(charId);
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
                const loc = findCharacterLocation(charId);
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
                const loc = findCharacterLocation(charId);
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
              if (!ALL_LOCATIONS.includes(t as LocationId)) {
                newBoard.characterStats[t as CharacterId].paranoia += 1;
              }
              break;
            }
            case "LoseParanoia": {
              if (!ALL_LOCATIONS.includes(t as LocationId)) {
                const cur = newBoard.characterStats[t as CharacterId].paranoia;
                newBoard.characterStats[t as CharacterId].paranoia = Math.max(
                  0,
                  cur - 1
                );
              }
              break;
            }
            case "ForbidParanoia":
            case "ForbidGoodwill":
            case "ForbidMove": {
              break;
            }
            case "GainGoodwill2": {
              if (!ALL_LOCATIONS.includes(t as LocationId)) {
                newBoard.characterStats[t as CharacterId].goodwill += 2;
              }
              break;
            }
            case "GainGoodwill": {
              if (!ALL_LOCATIONS.includes(t as LocationId)) {
                newBoard.characterStats[t as CharacterId].goodwill += 1;
              }
              break;
            }
            default: {
              break;
            }
          }
        }
      }
      // 如果超过 2 张（正常不会），可忽略或逐条处理
      else {
        for (const info of actions) {
          const actionId = info.actionId;
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
                const loc = findCharacterLocation(charId);
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
                const loc = findCharacterLocation(charId);
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
                const loc = findCharacterLocation(charId);
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
              if (!ALL_LOCATIONS.includes(t as LocationId)) {
                newBoard.characterStats[t as CharacterId].paranoia += 1;
              }
              break;
            }
            case "LoseParanoia": {
              if (!ALL_LOCATIONS.includes(t as LocationId)) {
                const cur = newBoard.characterStats[t as CharacterId].paranoia;
                newBoard.characterStats[t as CharacterId].paranoia = Math.max(
                  0,
                  cur - 1
                );
              }
              break;
            }
            case "ForbidParanoia":
            case "ForbidGoodwill":
            case "ForbidMove": {
              break;
            }
            case "GainGoodwill2": {
              if (!ALL_LOCATIONS.includes(t as LocationId)) {
                newBoard.characterStats[t as CharacterId].goodwill += 2;
              }
              break;
            }
            case "GainGoodwill": {
              if (!ALL_LOCATIONS.includes(t as LocationId)) {
                newBoard.characterStats[t as CharacterId].goodwill += 1;
              }
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
    return 0;
  }
}
