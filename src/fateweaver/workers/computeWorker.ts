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

// 导入用于生成稳定 key 的函数
import { canonicalizePlacementMap } from "../utils/placementKey";

export type Target = LocationId | CharacterId;

interface LocalStats {
  mastermindStats: Record<string, MastermindStatEntry>;
  protagonistStats: Record<string, ProtagonistStatEntry>;
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
  localMastermindStats: Record<string, MastermindStatEntry>;
  localProtagonistStats: Record<string, ProtagonistStatEntry>;
}

let canceledFlag = false;
let localStats: LocalStats;

/** 初始化空的 Mastermind 统计（按“组合 key”） */
function makeEmptyMastermindStats(): Record<string, MastermindStatEntry> {
  return {};
}

/** 初始化空的 Protagonist 统计（按“组合 key”） */
function makeEmptyProtagonistStats(): Record<string, ProtagonistStatEntry> {
  return {};
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
 * 通用：更新一个 “StatEntry”（可能是 MastermindStatEntry 也可能是 ProtagonistStatEntry），
 * 保留最劣、次劣、第三劣三个不同 value，合并相同 value 的 count，并保存相应示例。
 *
 * entry: 目标 StatEntry（具有 worstValue, worstCount, worstExample 等字段）
 * value: 本次算出的效用值
 * examplePlacement: 导致该 value 的示例放置
 */
function updateThreeWorst<E>(
  entry: {
    worstValue: number;
    worstCount: number;
    worstExample: E;
    secondWorstValue: number;
    secondWorstCount: number;
    secondWorstExample: E;
    thirdWorstValue: number;
    thirdWorstCount: number;
    thirdWorstExample: E;
  },
  value: number,
  examplePlacement: E
) {
  type Candidate = {
    value: number;
    count: number;
    example: E;
  };
  const candidates: Candidate[] = [];

  // 先把 entry 中已有的、值不为 Infinity 的那几条“候选”都添加进来
  if (entry.worstValue !== Infinity) {
    candidates.push({
      value: entry.worstValue,
      count: entry.worstCount,
      example: entry.worstExample,
    });
  }
  if (entry.secondWorstValue !== Infinity) {
    candidates.push({
      value: entry.secondWorstValue,
      count: entry.secondWorstCount,
      example: entry.secondWorstExample,
    });
  }
  if (entry.thirdWorstValue !== Infinity) {
    candidates.push({
      value: entry.thirdWorstValue,
      count: entry.thirdWorstCount,
      example: entry.thirdWorstExample,
    });
  }

  // 然后把“本次”的 (value, 示例) 加进来
  if (value !== undefined) {
    candidates.push({ value, count: 1, example: examplePlacement });
  }

  // 按 value 聚合 count，并保留对应的示例
  const mapVal = new Map<
    number,
    { count: number; example: E }
  >();
  for (const c of candidates) {
    if (!mapVal.has(c.value)) {
      mapVal.set(c.value, { count: c.count, example: c.example });
    } else {
      const prev = mapVal.get(c.value)!;
      prev.count += c.count;
    }
  }

  // 取最小的三条
  const sorted = Array.from(mapVal.entries())
    .map(([value, { count, example }]) => ({ value, count, example }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 3);

  // “写回” entry
  if (sorted[0]) {
    entry.worstValue = sorted[0].value;
    entry.worstCount = sorted[0].count;
    entry.worstExample = sorted[0].example;
  } else {
    entry.worstValue = Infinity;
    entry.worstCount = 0;
    // 保留原来的 worstExample
  }

  if (sorted[1]) {
    entry.secondWorstValue = sorted[1].value;
    entry.secondWorstCount = sorted[1].count;
    entry.secondWorstExample = sorted[1].example;
  } else {
    entry.secondWorstValue = Infinity;
    entry.secondWorstCount = 0;
    // 保留原来的 secondWorstExample
  }

  if (sorted[2]) {
    entry.thirdWorstValue = sorted[2].value;
    entry.thirdWorstCount = sorted[2].count;
    entry.thirdWorstExample = sorted[2].example;
  } else {
    entry.thirdWorstValue = Infinity;
    entry.thirdWorstCount = 0;
    // 保留原来的 thirdWorstExample
  }
}

/**
 * 处理单个 Mastermind 三张牌分布 dist：
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
      // 所有 Mastermind 动作均已分配 targets

      // 1) 收集所有被 Mastermind 放置到的 targets
      const coveredTargets = new Set<Target>();
      actions.forEach((a) => {
        (placementMap[a] || []).forEach((t) => {
          coveredTargets.add(t);
        });
      });

      // 2) 构造临时的 Protagonist 作用域：过滤 ForbidIntrigue / ForbidMove
      const tempProtoScope: Record<ProtagonistActionId, Target[]> = {
        ...protagonistScope,
      };
      if (protagonistScope.ForbidIntrigue) {
        const filteredIntrigue = protagonistScope.ForbidIntrigue.filter((t) => {
          return coveredTargets.has(t);
        });
        tempProtoScope.ForbidIntrigue = filteredIntrigue;
      }
      if (protagonistScope.ForbidMove) {
        const filteredMove = protagonistScope.ForbidMove.filter((t) =>
          coveredTargets.has(t)
        );
        tempProtoScope.ForbidMove = filteredMove;
      }

      // 3) 生成当前 Mastermind 三张牌放置组合的“规范化 key”
      const masterKey = canonicalizePlacementMap(placementMap);

      // 4) 枚举所有可能的 Protagonist 三张牌分布
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

        // eslint-disable-next-line no-loop-func
        const recurseProto = async (jdx: number) => {
          if (canceledFlag) return;
          if (jdx === pActions.length) {
            // 得到一个完整的 (placementMap, pPlacementMap) 实例
            const utilValue = await engine.compute({
              mastermindPlacement: placementMap,
              protagonistPlacement: pPlacementMap,
              boardState,
              utilities,
              values,
            });

            // 5) 生成当前 Protagonist 三张牌放置组合的“规范化 key”
            const protagKey = canonicalizePlacementMap(pPlacementMap);

            // 6) 在线更新 localStats.mastermindStats[masterKey]
            if (!localStats.mastermindStats[masterKey]) {
              // 构造空的 ProtagonistPlacement 示例对象
              const emptyProtagExample = {} as Record<
                ProtagonistActionId,
                Target[]
              >;
              ALL_PROTAGONIST_ACTIONS.forEach((aid) => {
                emptyProtagExample[aid] = [];
              });
              // 构造空的 MastermindPlacement 结构
              const initialMasterPlacement = {} as Record<
                MastermindActionId,
                Target[]
              >;
              ALL_MASTERMIND_ACTIONS.forEach((aid) => {
                initialMasterPlacement[aid] = [];
              });

              localStats.mastermindStats[masterKey] = {
                placement: JSON.parse(
                  JSON.stringify(placementMap)
                ) as Record<MastermindActionId, Target[]>,
                worstValue: Infinity,
                worstCount: 0,
                worstExample: { ...emptyProtagExample },
                secondWorstValue: Infinity,
                secondWorstCount: 0,
                secondWorstExample: { ...emptyProtagExample },
                thirdWorstValue: Infinity,
                thirdWorstCount: 0,
                thirdWorstExample: { ...emptyProtagExample },
              };
            }
            const mEntry = localStats.mastermindStats[masterKey];
            updateThreeWorst(
              mEntry,
              utilValue,
              JSON.parse(
                JSON.stringify(pPlacementMap)
              ) as Record<ProtagonistActionId, Target[]>
            );

            // 7) 在线更新 localStats.protagonistStats[protagKey]
            if (!localStats.protagonistStats[protagKey]) {
              const emptyMasterExample = {} as Record<
                MastermindActionId,
                Target[]
              >;
              ALL_MASTERMIND_ACTIONS.forEach((aid) => {
                emptyMasterExample[aid] = [];
              });
              // 构造空的 ProtagonistPlacement 结构
              const initialProtagPlacement = {} as Record<
                ProtagonistActionId,
                Target[]
              >;
              ALL_PROTAGONIST_ACTIONS.forEach((aid) => {
                initialProtagPlacement[aid] = [];
              });

              localStats.protagonistStats[protagKey] = {
                placement: JSON.parse(
                  JSON.stringify(pPlacementMap)
                ) as Record<ProtagonistActionId, Target[]>,
                worstValue: Infinity,
                worstCount: 0,
                worstExample: { ...emptyMasterExample },
                secondWorstValue: Infinity,
                secondWorstCount: 0,
                secondWorstExample: { ...emptyMasterExample },
                thirdWorstValue: Infinity,
                thirdWorstCount: 0,
                thirdWorstExample: { ...emptyMasterExample },
              };
            }
            const pEntry = localStats.protagonistStats[protagKey];
            updateThreeWorst(
              pEntry,
              utilValue,
              JSON.parse(
                JSON.stringify(placementMap)
              ) as Record<MastermindActionId, Target[]>
            );

            // 8) 更新已处理计数，并在必要时发 progress
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
