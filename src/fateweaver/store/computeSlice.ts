// src/store/computeSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';
import {
  MastermindActionId,
  ALL_MASTERMIND_ACTIONS,
  ProtagonistActionId,
  ALL_PROTAGONIST_ACTIONS,
} from '../constants/actions';
import { LocationId, CharacterId } from '../constants/board';

/**
 * Mastermind 三张牌放置方案的映射，用于 Protagonist 统计时引用
 */
export type MasterCombinationKey = string; // JSON.stringify(placementMap)

/**
 * Protagonist 三张牌放置方案的映射，用于 Mastermind 统计时引用
 */
export type ProtagCombinationKey = string; // JSON.stringify(placementMap)

/**
 * 枚举一次之后，某个 Mastermind 三张牌放置组合下：
 *   - 统计所有可能的 Protagonist 三张牌方案的 utilValue 分布
 *   - 保留最劣/次劣/第三劣的 value、出现次数、及一个示例 ProtagonistPlacementMap
 */
export interface MastermindStatEntry {
  // 三种最劣值
  worstValue: number;
  worstCount: number;
  worstExample: Record<ProtagonistActionId, Target[]>;

  secondWorstValue: number;
  secondWorstCount: number;
  secondWorstExample: Record<ProtagonistActionId, Target[]>;

  thirdWorstValue: number;
  thirdWorstCount: number;
  thirdWorstExample: Record<ProtagonistActionId, Target[]>;
}

/**
 * 枚举一次之后，某个 Protagonist 三张牌放置组合下：
 *   - 统计所有可能的 Mastermind 三张牌方案的 utilValue 分布
 *   - 保留最劣/次劣/第三劣的 value、出现次数、及一个示例 MastermindPlacementMap
 */
export interface ProtagonistStatEntry {
  worstValue: number;
  worstCount: number;
  worstExample: Record<MastermindActionId, Target[]>;

  secondWorstValue: number;
  secondWorstCount: number;
  secondWorstExample: Record<MastermindActionId, Target[]>;

  thirdWorstValue: number;
  thirdWorstCount: number;
  thirdWorstExample: Record<MastermindActionId, Target[]>;
}

export type Target = LocationId | CharacterId;

interface ComputeState {
  /** 枚举的总实例数 */
  totalEstimate: number;
  /** 已处理的实例数 */
  progress: number;
  /** 当前是否在跑 */
  status: 'idle' | 'running';
  /** 开始时间戳 */
  startTime: number | null;
  /** 是否被取消 */
  canceled: boolean;
  /** 全局合并后的 Mastermind 统计，key = JSON.stringify(mastermindPlacementMap) */
  mastermindStats: Record<MasterCombinationKey, MastermindStatEntry>;
  /** 全局合并后的 Protagonist 统计，key = JSON.stringify(protagonistPlacementMap) */
  protagonistStats: Record<ProtagCombinationKey, ProtagonistStatEntry>;
}

function makeEmptyMastermindStats(): Record<MasterCombinationKey, MastermindStatEntry> {
  return {}; // 初始空对象，按需要动态添加 key
}

function makeEmptyProtagonistStats(): Record<ProtagCombinationKey, ProtagonistStatEntry> {
  return {};
}

/**
 * 合并单个 MastermindStatEntry（local）到全局（global）。
 * global 中的 key 已经和 local 的 key 一一对应。
 * 我们假设：local 里的 entry 只包含该组合 key 下的 3 条最劣/次劣/第三劣信息。
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

  // 收集 global 中已有的最多 3 条（如果值 != Infinity）
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

  // 收集 local 中的最多 3 条
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

  // 合并相同 value 的 count，并保留任意一个 example
  const map = new Map<number, { count: number; example: Record<ProtagonistActionId, Target[]> }>();
  for (const c of candidates) {
    if (!map.has(c.value)) {
      map.set(c.value, { count: c.count, example: c.example });
    } else {
      const prev = map.get(c.value)!;
      prev.count += c.count;
    }
  }

  // 按 value 升序排序，取前三个
  const sorted = Array.from(map.entries())
    .map(([value, { count, example }]) => ({ value, count, example }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 3);

  // 重置 global
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
 * 合并单个 ProtagonistStatEntry（local）到全局（global）。
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

const initialState: ComputeState = {
  totalEstimate: 0,
  progress: 0,
  status: 'idle',
  startTime: null,
  canceled: false,
  mastermindStats: makeEmptyMastermindStats(),
  protagonistStats: makeEmptyProtagonistStats(),
};

const computeSlice = createSlice({
  name: 'compute',
  initialState,
  reducers: {
    /** 
     * 开始计算：  
     *  - 接收一个 { total }，表示“总实例数”  
     *  - 把 progress 置 0、canceled 置 false、status 置 'running'  
     *  - 记录 startTime  
     *  - 清空之前的统计  
     */
    startCompute(state, action: PayloadAction<{ total: number }>) {
      state.totalEstimate = action.payload.total;
      state.progress = 0;
      state.status = 'running';
      state.startTime = Date.now();
      state.canceled = false;
      state.mastermindStats = makeEmptyMastermindStats();
      state.protagonistStats = makeEmptyProtagonistStats();
    },
    /**
     * 单独设置 totalEstimate（如果你想只更新总数但不切换状态，也可用这个）
     */
    setTotalEstimate(state, action: PayloadAction<number>) {
      state.totalEstimate = action.payload;
    },
    /**
     * 用户或前端调用“取消计算”，把 canceled 置为 true，并把 status 置为 'idle'
     */
    cancelCompute(state) {
      if (state.status === 'running') {
        state.canceled = true;
        state.status = 'idle';
      }
    },
    /**
     * Worker 批量汇报已处理实例数时调用：state.progress += payload
     */
    incrementProgressBy(state, action: PayloadAction<number>) {
      state.progress += action.payload;
    },
    /**
     * 合并某个 Worker 砍回来的“Mastermind 本地统计”到全局
     * payload 的结构： Record<MasterCombinationKey, MastermindStatEntry>
     */
    mergeMastermindStats(
      state,
      action: PayloadAction<Record<MasterCombinationKey, MastermindStatEntry>>
    ) {
      const local = action.payload;
      for (const [combKey, localEntry] of Object.entries(local)) {
        if (!state.mastermindStats[combKey]) {
          // 还没见过该组合，直接存一个深拷贝
          state.mastermindStats[combKey] = {
            worstValue: localEntry.worstValue,
            worstCount: localEntry.worstCount,
            worstExample: { ...localEntry.worstExample },
            secondWorstValue: localEntry.secondWorstValue,
            secondWorstCount: localEntry.secondWorstCount,
            secondWorstExample: { ...localEntry.secondWorstExample },
            thirdWorstValue: localEntry.thirdWorstValue,
            thirdWorstCount: localEntry.thirdWorstCount,
            thirdWorstExample: { ...localEntry.thirdWorstExample },
          };
        } else {
          // 已存在该组合，合并 localEntry 到 global
          mergeMastermindEntry(
            state.mastermindStats[combKey],
            localEntry
          );
        }
      }
    },
    /**
     * 合并某个 Worker 砍回来的“Protagonist 本地统计”到全局
     * payload 的结构： Record<ProtagCombinationKey, ProtagonistStatEntry>
     */
    mergeProtagonistStats(
      state,
      action: PayloadAction<Record<ProtagCombinationKey, ProtagonistStatEntry>>
    ) {
      const local = action.payload;
      for (const [combKey, localEntry] of Object.entries(local)) {
        if (!state.protagonistStats[combKey]) {
          state.protagonistStats[combKey] = {
            worstValue: localEntry.worstValue,
            worstCount: localEntry.worstCount,
            worstExample: { ...localEntry.worstExample },
            secondWorstValue: localEntry.secondWorstValue,
            secondWorstCount: localEntry.secondWorstCount,
            secondWorstExample: { ...localEntry.secondWorstExample },
            thirdWorstValue: localEntry.thirdWorstValue,
            thirdWorstCount: localEntry.thirdWorstCount,
            thirdWorstExample: { ...localEntry.thirdWorstExample },
          };
        } else {
          mergeProtagonistEntry(
            state.protagonistStats[combKey],
            localEntry
          );
        }
      }
    },
    /**
     * 当所有 Worker 全部完成／中止后，前端调用此 action 把 status 置回 'idle'
     */
    finishCompute(state) {
      if (state.status === 'running') {
        state.status = 'idle';
      }
    },
  },
});

export const {
  startCompute,
  setTotalEstimate,
  cancelCompute,
  incrementProgressBy,
  mergeMastermindStats,
  mergeProtagonistStats,
  finishCompute,
} = computeSlice.actions;

export const selectComputeTotal = (state: RootState) => state.compute.totalEstimate;
export const selectComputeProgress = (state: RootState) => state.compute.progress;
export const selectComputeStatus = (state: RootState) => state.compute.status;
export const selectComputeStartTime = (state: RootState) => state.compute.startTime;
export const selectComputeCanceled = (state: RootState) => state.compute.canceled;

/**
 * 直接返回已在线合并的 Mastermind 统计结果（按三张牌组合 key 分组）
 */
export const selectMastermindStats = (
  state: RootState
): Record<MasterCombinationKey, MastermindStatEntry> =>
  state.compute.mastermindStats;

/**
 * 直接返回已在线合并的 Protagonist 统计结果（按三张牌组合 key 分组）
 */
export const selectProtagonistStats = (
  state: RootState
): Record<ProtagCombinationKey, ProtagonistStatEntry> =>
  state.compute.protagonistStats;

export default computeSlice.reducer;
