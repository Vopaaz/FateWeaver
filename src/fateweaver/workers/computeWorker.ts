// src/fateweaver/workers/computeWorker.ts

import {
  MastermindActionId,
  ALL_MASTERMIND_ACTIONS,
  ProtagonistActionId,
  ALL_PROTAGONIST_ACTIONS,
} from "../constants/actions";
import { LocationId, CharacterId, ALL_LOCATIONS } from "../constants/board";
import {
  MastermindStatEntry,
  ProtagonistStatEntry,
} from "../store/computeSlice";
import { ComputeEngine, BoardState } from "./computeEngine";
import { UtilityItem, ValueDefinition } from "../store/utilitySlice";

export type Target = LocationId | CharacterId;

interface LocalStats {
  mastermindStats: Record<MastermindActionId, MastermindStatEntry>;
  protagonistStats: Record<ProtagonistActionId, ProtagonistStatEntry>;
  processedCount: number;
}

interface StartMessage {
  type: "start";
  sliceDistributions: Array<Record<MastermindActionId, number>>;
  protagonistConfig: Record<ProtagonistActionId, number>;
  mastermindScope: Record<MastermindActionId, Target[]>;
  protagonistScope: Record<ProtagonistActionId, Target[]>;
  boardState: BoardState;
  utilities: UtilityItem[];
  values: ValueDefinition[];
}

interface ProgressMessage {
  type: "progress";
  processed: number;
}

interface DoneMessage {
  type: "done";
  localMastermindStats: Record<MastermindActionId, MastermindStatEntry>;
  localProtagonistStats: Record<ProtagonistActionId, ProtagonistStatEntry>;
}

let canceledFlag = false;
let localStats: LocalStats;

/** 初始化空的 Mastermind 统计 */
function makeEmptyMastermindStats(): Record<MastermindActionId, MastermindStatEntry> {
  const o = {} as Record<MastermindActionId, MastermindStatEntry>;
  ALL_MASTERMIND_ACTIONS.forEach((aid) => {
    o[aid] = {
      count: 0,
      sum: 0,
      bestValue: -Infinity,
      bestProtagPlacement: {} as Record<ProtagonistActionId, Target[]>,
      worstValue: Infinity,
      worstProtagPlacement: {} as Record<ProtagonistActionId, Target[]>,
    };
  });
  return o;
}

/** 初始化空的 Protagonist 统计 */
function makeEmptyProtagonistStats(): Record<ProtagonistActionId, ProtagonistStatEntry> {
  const o = {} as Record<ProtagonistActionId, ProtagonistStatEntry>;
  ALL_PROTAGONIST_ACTIONS.forEach((aid) => {
    o[aid] = {
      count: 0,
      sum: 0,
      bestValue: -Infinity,
      bestMasterPlacement: {} as Record<MastermindActionId, Target[]>,
      worstValue: Infinity,
      worstMasterPlacement: {} as Record<MastermindActionId, Target[]>,
    };
  });
  return o;
}

/** 从数组里选 k 个元素的所有组合 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/** 生成恰好 sum 张卡在 actions 各自上限内的所有分布 */
function generateDistributions<T extends string>(
  actions: T[],
  config: Record<T, number>,
  sum: number
): Record<T, number>[] {
  const results: Record<T, number>[] = [];
  const current = {} as Record<T, number>;

  function backtrack(idx: number, rem: number) {
    if (idx === actions.length) {
      if (rem === 0) results.push({ ...current });
      return;
    }
    const action = actions[idx];
    const maxCount = Math.min(config[action], rem);
    for (let count = 0; count <= maxCount; count++) {
      current[action] = count;
      backtrack(idx + 1, rem - count);
    }
  }

  backtrack(0, sum);
  return results;
}

/**
 * 处理单个 Mastermind 分布 dist：
 *   - 递归枚举具体放置，并更新 localStats
 */
async function handleOneMasterDist(
  dist: Record<MastermindActionId, number>,
  protagonistConfig: Record<ProtagonistActionId, number>,
  mastermindScope: Record<MastermindActionId, Target[]>,
  protagonistScope: Record<ProtagonistActionId, Target[]>,
  boardState: BoardState,
  utilities: UtilityItem[],
  values: ValueDefinition[],
  engine: ComputeEngine
) {
  if (canceledFlag) return;

  const actions = (Object.keys(dist) as MastermindActionId[]).filter(
    (a) => dist[a] > 0
  );
  const used = new Set<Target>();
  const placementMap = {} as Record<MastermindActionId, Target[]>;

  const recurseMaster = async (idx: number) => {
    if (canceledFlag) return;
    if (idx === actions.length) {
      // ======= 关键修改开始 =======
      // 1) 先收集所有被 Mastermind 打到的 target（既包括地点，也包括角色）
      const coveredTargets = new Set<Target>();
      actions.forEach((a) => {
        (placementMap[a] || []).forEach((t) => {
          coveredTargets.add(t);
        });
      });

      // 2) 构造临时的 Protagonist 作用域，分别过滤 ForbidIntrigue 和 ForbidMove：
      const tempProtoScope: Record<ProtagonistActionId, Target[]> = {
        ...protagonistScope,
      };

      // —— ForbidIntrigue：只保留那些被 Mastermind 打到过且是地点的 target
      if (protagonistScope.ForbidIntrigue) {
        const filteredIntrigue = protagonistScope.ForbidIntrigue.filter((t) => {
          const isLoc = ALL_LOCATIONS.includes(t as LocationId);
          return isLoc && coveredTargets.has(t);
        });
        tempProtoScope.ForbidIntrigue = filteredIntrigue;
      }

      // —— ForbidMove：只保留那些被 Mastermind 打到过（角色或地点）的 target
      if (protagonistScope.ForbidMove) {
        const filteredMove = protagonistScope.ForbidMove.filter((t) =>
          coveredTargets.has(t)
        );
        tempProtoScope.ForbidMove = filteredMove;
      }
      // ======= 关键修改结束 =======

      /* eslint-disable no-loop-func */
      // 枚举所有可能的 Protagonist 分布
      const protComps = generateDistributions(
        ALL_PROTAGONIST_ACTIONS,
        protagonistConfig,
        3
      );
      for (const pDist of protComps) {
        if (canceledFlag) return;

        const pActions = (Object.keys(pDist) as ProtagonistActionId[]).filter(
          (a) => pDist[a] > 0
        );
        const pUsed = new Set<Target>();
        const pPlacementMap = {} as Record<ProtagonistActionId, Target[]>;

        const recurseProto = async (jdx: number) => {
          if (canceledFlag) return;
          if (jdx === pActions.length) {
            // 生成一个完整的 (placementMap, pPlacementMap) 实例
            const utilValue = await engine.compute({
              mastermindPlacement: placementMap,
              protagonistPlacement: pPlacementMap,
              boardState,
              utilities,
              values,
            });

            // 在线更新 localStats.mastermindStats
            actions.forEach((ma) => {
              const stat = localStats.mastermindStats[ma];
              stat.count += 1;
              stat.sum += utilValue;
              if (utilValue > stat.bestValue) {
                stat.bestValue = utilValue;
                stat.bestProtagPlacement = JSON.parse(
                  JSON.stringify(pPlacementMap)
                );
              }
              if (utilValue < stat.worstValue) {
                stat.worstValue = utilValue;
                stat.worstProtagPlacement = JSON.parse(
                  JSON.stringify(pPlacementMap)
                );
              }
            });

            // 在线更新 localStats.protagonistStats
            pActions.forEach((pa) => {
              const stat2 = localStats.protagonistStats[pa];
              stat2.count += 1;
              stat2.sum += utilValue;
              if (utilValue > stat2.bestValue) {
                stat2.bestValue = utilValue;
                stat2.bestMasterPlacement = JSON.parse(
                  JSON.stringify(placementMap)
                );
              }
              if (utilValue < stat2.worstValue) {
                stat2.worstValue = utilValue;
                stat2.worstMasterPlacement = JSON.parse(
                  JSON.stringify(placementMap)
                );
              }
            });

            localStats.processedCount += 1;
            if (localStats.processedCount % 5000 === 0) {
              const msg: ProgressMessage = {
                type: "progress",
                processed: 5000,
              };
              globalThis.postMessage(msg);
            }
            return;
          }

          const pa = pActions[jdx];
          const need = pDist[pa];
          // 注意：后续从 tempProtoScope 中读取允许的 targets
          const avail = (tempProtoScope[pa] || []).filter((t) => !pUsed.has(t));
          const combos = combinations(avail, need);
          for (const combo of combos) {
            if (canceledFlag) return;
            combo.forEach((t) => pUsed.add(t));
            pPlacementMap[pa] = combo;
            await Promise.resolve();
            await recurseProto(jdx + 1);
            combo.forEach((t) => pUsed.delete(t));
          }
        };

        await recurseProto(0);
      }
      /* eslint-enable no-loop-func */

      return;
    }

    const a = actions[idx];
    const need = dist[a];
    const avail = (mastermindScope[a] || []).filter((t) => !used.has(t));
    const combos = combinations(avail, need);
    for (const combo of combos) {
      if (canceledFlag) return;
      combo.forEach((t) => used.add(t));
      placementMap[a] = combo;
      await Promise.resolve();
      await recurseMaster(idx + 1);
      combo.forEach((t) => used.delete(t));
    }
  };

  await recurseMaster(0);
}

async function runWorker(
  sliceDistributions: Array<Record<MastermindActionId, number>>,
  protagonistConfig: Record<ProtagonistActionId, number>,
  mastermindScope: Record<MastermindActionId, Target[]>,
  protagonistScope: Record<ProtagonistActionId, Target[]>,
  boardState: BoardState,
  utilities: UtilityItem[],
  values: ValueDefinition[]
) {
  localStats = {
    mastermindStats: makeEmptyMastermindStats(),
    protagonistStats: makeEmptyProtagonistStats(),
    processedCount: 0,
  };

  const engine = new ComputeEngine();

  for (const dist of sliceDistributions) {
    if (canceledFlag) break;

    await handleOneMasterDist(
      dist,
      protagonistConfig,
      mastermindScope,
      protagonistScope,
      boardState,
      utilities,
      values,
      engine
    );
  }

  const remainder = localStats.processedCount % 5000;
  if (remainder > 0) {
    const msg: ProgressMessage = {
      type: "progress",
      processed: remainder,
    };
    globalThis.postMessage(msg);
  }

  const doneMsg: DoneMessage = {
    type: "done",
    localMastermindStats: localStats.mastermindStats,
    localProtagonistStats: localStats.protagonistStats,
  };
  globalThis.postMessage(doneMsg);
  globalThis.close();
}

globalThis.addEventListener("message", (ev: MessageEvent) => {
  const data = ev.data as StartMessage | { type: "cancel" };
  if (data.type === "start") {
    canceledFlag = false;
    runWorker(
      data.sliceDistributions,
      data.protagonistConfig,
      data.mastermindScope,
      data.protagonistScope,
      data.boardState,
      data.utilities,
      data.values
    );
  } else if (data.type === "cancel") {
    canceledFlag = true;
  }
});
