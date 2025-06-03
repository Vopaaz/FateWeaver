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
  /**
   * key = JSON.stringify(mastermindPlacementMap)，
   * value = 该 Mastermind 三张牌放置组合下的“三条最劣/次劣/第三劣”统计
   */
  mastermindStats: Record<string, MastermindStatEntry>;
  /**
   * key = JSON.stringify(protagonistPlacementMap)，
   * value = 该 Protagonist 三张牌放置组合下的“三条最劣/次劣/第三劣”统计
   */
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

/** 初始化空的 Mastermind 统计 */
function makeEmptyMastermindStats(): Record<string, MastermindStatEntry> {
  return {};
}

/** 初始化空的 Protagonist 统计 */
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

/**
 * 递归生成所有“exactly sum 张牌的分布”。
 * Mastermind 和 Protagonist 都用这个函数。
 */
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
 * 创建一个空的 MastermindStatEntry
 */
function createEmptyMastermindEntry(): MastermindStatEntry {
  return {
    worstValue: Infinity,
    worstCount: 0,
    worstExample: {} as Record<ProtagonistActionId, Target[]>,

    secondWorstValue: Infinity,
    secondWorstCount: 0,
    secondWorstExample: {} as Record<ProtagonistActionId, Target[]>,

    thirdWorstValue: Infinity,
    thirdWorstCount: 0,
    thirdWorstExample: {} as Record<ProtagonistActionId, Target[]>,
  };
}

/**
 * 创建一个空的 ProtagonistStatEntry
 */
function createEmptyProtagonistEntry(): ProtagonistStatEntry {
  return {
    worstValue: Infinity,
    worstCount: 0,
    worstExample: {} as Record<MastermindActionId, Target[]>,

    secondWorstValue: Infinity,
    secondWorstCount: 0,
    secondWorstExample: {} as Record<MastermindActionId, Target[]>,

    thirdWorstValue: Infinity,
    thirdWorstCount: 0,
    thirdWorstExample: {} as Record<MastermindActionId, Target[]>,
  };
}

/**
 * 合并 localEntry（MastermindStatEntry）到全局的 globalEntry
 */
function mergeMastermindEntry(
  global: MastermindStatEntry,
  local: MastermindStatEntry
) {
  type Candidate = {
    value: number;
    count: number;
    example: Record<ProtagonistActionId, Target[]>;
  };
  const candidates: Candidate[] = [];

  // 收集 global 中已有的不等于 Infinity 的条目
  if (global.worstValue !== Infinity) {
    candidates.push({
      value: global.worstValue,
      count: global.worstCount,
      example: global.worstExample,
    });
  }
  if (global.secondWorstValue !== Infinity) {
    candidates.push({
      value: global.secondWorstValue,
      count: global.secondWorstCount,
      example: global.secondWorstExample,
    });
  }
  if (global.thirdWorstValue !== Infinity) {
    candidates.push({
      value: global.thirdWorstValue,
      count: global.thirdWorstCount,
      example: global.thirdWorstExample,
    });
  }

  // 收集 local 中的不等于 Infinity 的条目
  if (local.worstValue !== Infinity) {
    candidates.push({
      value: local.worstValue,
      count: local.worstCount,
      example: local.worstExample,
    });
  }
  if (local.secondWorstValue !== Infinity) {
    candidates.push({
      value: local.secondWorstValue,
      count: local.secondWorstCount,
      example: local.secondWorstExample,
    });
  }
  if (local.thirdWorstValue !== Infinity) {
    candidates.push({
      value: local.thirdWorstValue,
      count: local.thirdWorstCount,
      example: local.thirdWorstExample,
    });
  }

  // 按 value 合并相同值的 count，保留一个示例
  const map = new Map<number, { count: number; example: Record<ProtagonistActionId, Target[]> }>();
  for (const c of candidates) {
    if (!map.has(c.value)) {
      map.set(c.value, { count: c.count, example: c.example });
    } else {
      const prev = map.get(c.value)!;
      prev.count += c.count;
    }
  }

  // 取最小的三条
  const sorted = Array.from(map.entries())
    .map(([value, { count, example }]) => ({ value, count, example }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 3);

  if (sorted[0]) {
    global.worstValue = sorted[0].value;
    global.worstCount = sorted[0].count;
    global.worstExample = sorted[0].example;
  } else {
    global.worstValue = Infinity;
    global.worstCount = 0;
    global.worstExample = {} as Record<ProtagonistActionId, Target[]>;
  }

  if (sorted[1]) {
    global.secondWorstValue = sorted[1].value;
    global.secondWorstCount = sorted[1].count;
    global.secondWorstExample = sorted[1].example;
  } else {
    global.secondWorstValue = Infinity;
    global.secondWorstCount = 0;
    global.secondWorstExample = {} as Record<ProtagonistActionId, Target[]>;
  }

  if (sorted[2]) {
    global.thirdWorstValue = sorted[2].value;
    global.thirdWorstCount = sorted[2].count;
    global.thirdWorstExample = sorted[2].example;
  } else {
    global.thirdWorstValue = Infinity;
    global.thirdWorstCount = 0;
    global.thirdWorstExample = {} as Record<ProtagonistActionId, Target[]>;
  }
}

/**
 * 合并 localEntry（ProtagonistStatEntry）到全局的 globalEntry
 */
function mergeProtagonistEntry(
  global: ProtagonistStatEntry,
  local: ProtagonistStatEntry
) {
  type Candidate = {
    value: number;
    count: number;
    example: Record<MastermindActionId, Target[]>;
  };
  const candidates: Candidate[] = [];

  if (global.worstValue !== Infinity) {
    candidates.push({
      value: global.worstValue,
      count: global.worstCount,
      example: global.worstExample,
    });
  }
  if (global.secondWorstValue !== Infinity) {
    candidates.push({
      value: global.secondWorstValue,
      count: global.secondWorstCount,
      example: global.secondWorstExample,
    });
  }
  if (global.thirdWorstValue !== Infinity) {
    candidates.push({
      value: global.thirdWorstValue,
      count: global.thirdWorstCount,
      example: global.thirdWorstExample,
    });
  }

  if (local.worstValue !== Infinity) {
    candidates.push({
      value: local.worstValue,
      count: local.worstCount,
      example: local.worstExample,
    });
  }
  if (local.secondWorstValue !== Infinity) {
    candidates.push({
      value: local.secondWorstValue,
      count: local.secondWorstCount,
      example: local.secondWorstExample,
    });
  }
  if (local.thirdWorstValue !== Infinity) {
    candidates.push({
      value: local.thirdWorstValue,
      count: local.thirdWorstCount,
      example: local.thirdWorstExample,
    });
  }

  const map = new Map<number, { count: number; example: Record<MastermindActionId, Target[]> }>();
  for (const c of candidates) {
    if (!map.has(c.value)) {
      map.set(c.value, { count: c.count, example: c.example });
    } else {
      const prev = map.get(c.value)!;
      prev.count += c.count;
    }
  }

  const sorted = Array.from(map.entries())
    .map(([value, { count, example }]) => ({ value, count, example }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 3);

  if (sorted[0]) {
    global.worstValue = sorted[0].value;
    global.worstCount = sorted[0].count;
    global.worstExample = sorted[0].example;
  } else {
    global.worstValue = Infinity;
    global.worstCount = 0;
    global.worstExample = {} as Record<MastermindActionId, Target[]>;
  }

  if (sorted[1]) {
    global.secondWorstValue = sorted[1].value;
    global.secondWorstCount = sorted[1].count;
    global.secondWorstExample = sorted[1].example;
  } else {
    global.secondWorstValue = Infinity;
    global.secondWorstCount = 0;
    global.secondWorstExample = {} as Record<MastermindActionId, Target[]>;
  }

  if (sorted[2]) {
    global.thirdWorstValue = sorted[2].value;
    global.thirdWorstCount = sorted[2].count;
    global.thirdWorstExample = sorted[2].example;
  } else {
    global.thirdWorstValue = Infinity;
    global.thirdWorstCount = 0;
    global.thirdWorstExample = {} as Record<MastermindActionId, Target[]>;
  }
}

/**
 * 处理单个 Mastermind 分布 dist：
 *   - 先生成该 dist 下所有可能的“三张牌放置方案”，
 *   - 然后遍历每种 Mastermind 放置，生成其“组合 key”，
 *   - 进一步遍历所有 Protagonist 可能的三张牌放置方案，
 *     调用 engine.compute(...) 得到 utilValue，
 *     再更新 localStats.mastermindStats[combKey]。
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

  // 1. 找出这一次分布 dist 里哪些 ActionId 的 count > 0
  const actions = (Object.keys(dist) as MastermindActionId[]).filter(
    (a) => dist[a] > 0
  );

  // 2. 用递归枚举，将 dist 分配到具体的“三张放置方案”上
  const used = new Set<Target>();
  const placementMap = {} as Record<MastermindActionId, Target[]>;

  const recurseMaster = async (idx: number) => {
    if (canceledFlag) return;
    if (idx === actions.length) {
      // 已完成三张牌具体放置：placementMap 是一个 Record<MastermindActionId, Target[]>，其 value 数组长度之和 = 3
      //  a. 生成一个唯一的组合 key
      const combKey = JSON.stringify(placementMap);

      //  b. 如果 localStats.mastermindStats 里还没有这条 key，就初始化一个空 Entry
      if (!localStats.mastermindStats[combKey]) {
        localStats.mastermindStats[combKey] = createEmptyMastermindEntry();
      }

      //  c. 生成临时 Protagonist 作用域（针对 ForbidIntrigue & ForbidMove 的剪枝）
      const coveredTargets = new Set<Target>();
      Object.values(placementMap).forEach((arr) => {
        arr.forEach((t) => coveredTargets.add(t));
      });

      const tempProtoScope: Record<ProtagonistActionId, Target[]> = {
        ...protagonistScope,
      };

      if (protagonistScope.ForbidIntrigue) {
        const filteredIntrigue = protagonistScope.ForbidIntrigue.filter((t) => {
          const isLoc = ALL_LOCATIONS.includes(t as LocationId);
          return isLoc && coveredTargets.has(t);
        });
        tempProtoScope.ForbidIntrigue = filteredIntrigue;
      }
      if (protagonistScope.ForbidMove) {
        const filteredMove = protagonistScope.ForbidMove.filter((t) =>
          coveredTargets.has(t)
        );
        tempProtoScope.ForbidMove = filteredMove;
      }

      //  d. 枚举 Protagonist 所有三张牌放置方案
      const protComps = generateDistributions(
        ALL_PROTAGONIST_ACTIONS,
        protagonistConfig,
        3
      );
      for (const pDist of protComps) {
        if (canceledFlag) return;

        // 筛出 count>0 的 Protagonist ActionId
        const pActions = (Object.keys(pDist) as ProtagonistActionId[]).filter(
          (a) => pDist[a] > 0
        );
        const pUsed = new Set<Target>();
        const pPlacementMap = {} as Record<ProtagonistActionId, Target[]>;

        // eslint-disable-next-line no-loop-func
        const recurseProto = async (jdx: number) => {
          if (canceledFlag) return;
          if (jdx === pActions.length) {
            // 得到一个完整的 Protagonist 三张牌放置：pPlacementMap

            // 计算总效用值
            const utilValue = await engine.compute({
              mastermindPlacement: placementMap,
              protagonistPlacement: pPlacementMap,
              boardState,
              utilities,
              values,
            });

            // 更新 localStats.mastermindStats[combKey]
            const entry = localStats.mastermindStats[combKey];
            // entry 中存储了这一 Mastermind 三张牌放置组合 下，
            // 在所有 Protagonist 放置方案的 utilValue 分布中要保留最劣/次劣/第三劣

            // 把当前这一次 utilValue+示例也封装成“单个Local”形式，调用 mergeMastermindEntry：
            const singleLocal: MastermindStatEntry = {
              worstValue: utilValue,
              worstCount: 1,
              worstExample: JSON.parse(JSON.stringify(pPlacementMap)), // 深拷贝

              secondWorstValue: Infinity,
              secondWorstCount: 0,
              secondWorstExample: {} as Record<ProtagonistActionId, Target[]>,

              thirdWorstValue: Infinity,
              thirdWorstCount: 0,
              thirdWorstExample: {} as Record<ProtagonistActionId, Target[]>,
            };

            mergeMastermindEntry(entry, singleLocal);

            // 同时更新 Protagonist 的本地统计：在 Protagonist 那一侧，
            // 以 pPlacementMap 作为组合 key，把 utilValue 统计到 localStats.protagonistStats
            const pCombKey = JSON.stringify(pPlacementMap);
            if (!localStats.protagonistStats[pCombKey]) {
              localStats.protagonistStats[pCombKey] = createEmptyProtagonistEntry();
            }
            // 生成一个“Local 统计”给 mergeProtagonistEntry
            const singleLocalPro: ProtagonistStatEntry = {
              worstValue: utilValue,
              worstCount: 1,
              worstExample: JSON.parse(JSON.stringify(placementMap)),

              secondWorstValue: Infinity,
              secondWorstCount: 0,
              secondWorstExample: {} as Record<MastermindActionId, Target[]>,

              thirdWorstValue: Infinity,
              thirdWorstCount: 0,
              thirdWorstExample: {} as Record<MastermindActionId, Target[]>,
            };
            mergeProtagonistEntry(localStats.protagonistStats[pCombKey], singleLocalPro);

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

          // 继续枚举 Protagonist 第 jdx 张牌怎么放
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
      /* eslint-enable no-loop-func */

      return;
    }

    // 递归枚举 Mastermind 第 idx 张牌怎么放
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

/**
 * 整个 Worker 的主流程：它只负责合并自己分片的“本地统计”到 localStats，
 * 最后发一次 DoneMessage，done message 里包含 localStats.mastermindStats & protagonistStats
 */
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
