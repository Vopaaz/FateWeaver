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

/** Protagonist 放置方案映射，用于统计时引用 */
export type ProtagPlacementMap = Record<ProtagonistActionId, Array<LocationId | CharacterId>>;

/** Mastermind 放置方案映射，用于统计时引用 */
export type MasterPlacementMap = Record<MastermindActionId, Array<LocationId | CharacterId>>;

/**
 * 每个剧作家行动（即三张牌组合 key）的全局在线聚合结构
 */
export interface MastermindStatEntry {
  /** 本次统计的“三张牌”完整结构化对象 */
  placement: MasterPlacementMap;

  /** 最劣值 */
  worstValue: number;
  /** 导致最劣值的组合数量 */
  worstCount: number;
  /** 其中一个最劣值对应的示例（Protagonist 三张牌放置结构） */
  worstExample: ProtagPlacementMap;
  /** 次劣值 */
  secondWorstValue: number;
  /** 导致次劣值的组合数量 */
  secondWorstCount: number;
  /** 其中一个次劣值对应的示例 */
  secondWorstExample: ProtagPlacementMap;
  /** 第三劣值 */
  thirdWorstValue: number;
  /** 导致第三劣值的组合数量 */
  thirdWorstCount: number;
  /** 其中一个第三劣值对应的示例 */
  thirdWorstExample: ProtagPlacementMap;
}

/**
 * 每个主人公行动（即三张牌组合 key）的全局在线聚合结构
 */
export interface ProtagonistStatEntry {
  /** 本次统计的“三张牌”完整结构化对象 */
  placement: ProtagPlacementMap;

  /** 最劣值 */
  worstValue: number;
  /** 导致最劣值的组合数量 */
  worstCount: number;
  /** 其中一个最劣值对应的示例（Mastermind 三张牌放置结构） */
  worstExample: MasterPlacementMap;
  /** 次劣值 */
  secondWorstValue: number;
  /** 导致次劣值的组合数量 */
  secondWorstCount: number;
  /** 其中一个次劣值对应的示例 */
  secondWorstExample: MasterPlacementMap;
  /** 第三劣值 */
  thirdWorstValue: number;
  /** 导致第三劣值的组合数量 */
  thirdWorstCount: number;
  /** 其中一个第三劣值对应的示例 */
  thirdWorstExample: MasterPlacementMap;
}

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
  /** 全局合并后的剧作家统计 */
  mastermindStats: Record<string, MastermindStatEntry>;
  /** 全局合并后的主人公统计 */
  protagonistStats: Record<string, ProtagonistStatEntry>;
}

const initialState: ComputeState = {
  totalEstimate: 0,
  progress: 0,
  status: 'idle',
  startTime: null,
  canceled: false,
  mastermindStats: {},   // 由 computeWorker 在线创建/合并
  protagonistStats: {},  // 由 computeWorker 在线创建/合并
};

/**
 * 通用：将 localEntry 中的“三劣 / 次劣 / 第三劣”信息合并到 globalEntry 中。
 * placement 字段保持不变（因为同一 key 对应的 placement 一定相同）。
 */
function mergeStatEntries<E>(
  globalEntry: {
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
  localEntry: {
    worstValue: number;
    worstCount: number;
    worstExample: E;
    secondWorstValue: number;
    secondWorstCount: number;
    secondWorstExample: E;
    thirdWorstValue: number;
    thirdWorstCount: number;
    thirdWorstExample: E;
  }
) {
  type Candidate = {
    value: number;
    count: number;
    example: E;
  };
  const candidates: Candidate[] = [];

  // 把 globalEntry 里已有的（值不为 Infinity）的三条候选塞进来
  if (globalEntry.worstValue !== Infinity) {
    candidates.push({
      value: globalEntry.worstValue,
      count: globalEntry.worstCount,
      example: globalEntry.worstExample,
    });
  }
  if (globalEntry.secondWorstValue !== Infinity) {
    candidates.push({
      value: globalEntry.secondWorstValue,
      count: globalEntry.secondWorstCount,
      example: globalEntry.secondWorstExample,
    });
  }
  if (globalEntry.thirdWorstValue !== Infinity) {
    candidates.push({
      value: globalEntry.thirdWorstValue,
      count: globalEntry.thirdWorstCount,
      example: globalEntry.thirdWorstExample,
    });
  }

  // 把 localEntry 里已有的（值不为 Infinity）的三条候选也塞进来
  if (localEntry.worstValue !== Infinity) {
    candidates.push({
      value: localEntry.worstValue,
      count: localEntry.worstCount,
      example: localEntry.worstExample,
    });
  }
  if (localEntry.secondWorstValue !== Infinity) {
    candidates.push({
      value: localEntry.secondWorstValue,
      count: localEntry.secondWorstCount,
      example: localEntry.secondWorstExample,
    });
  }
  if (localEntry.thirdWorstValue !== Infinity) {
    candidates.push({
      value: localEntry.thirdWorstValue,
      count: localEntry.thirdWorstCount,
      example: localEntry.thirdWorstExample,
    });
  }

  // 按 value 聚合 count 并保留一个示例
  const mapVal = new Map<number, { count: number; example: E }>();
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

  // 写回 globalEntry
  if (sorted[0]) {
    globalEntry.worstValue = sorted[0].value;
    globalEntry.worstCount = sorted[0].count;
    globalEntry.worstExample = sorted[0].example;
  } else {
    globalEntry.worstValue = Infinity;
    globalEntry.worstCount = 0;
    // 保留原来的 worstExample
  }

  if (sorted[1]) {
    globalEntry.secondWorstValue = sorted[1].value;
    globalEntry.secondWorstCount = sorted[1].count;
    globalEntry.secondWorstExample = sorted[1].example;
  } else {
    globalEntry.secondWorstValue = Infinity;
    globalEntry.secondWorstCount = 0;
    // 保留原来的 secondWorstExample
  }

  if (sorted[2]) {
    globalEntry.thirdWorstValue = sorted[2].value;
    globalEntry.thirdWorstCount = sorted[2].count;
    globalEntry.thirdWorstExample = sorted[2].example;
  } else {
    globalEntry.thirdWorstValue = Infinity;
    globalEntry.thirdWorstCount = 0;
    // 保留原来的 thirdWorstExample
  }
}

const computeSlice = createSlice({
  name: 'compute',
  initialState,
  reducers: {
    /**
     * 开始计算：
     *  - 把 totalEstimate 设为 payload.total
     *  - progress 置 0，status 置 'running'，startTime 设为当前
     *  - 清空 canceled / mastermindStats / protagonistStats
     */
    startCompute(state, action: PayloadAction<{ total: number }>) {
      state.totalEstimate = action.payload.total;
      state.progress = 0;
      state.status = 'running';
      state.startTime = Date.now();
      state.canceled = false;
      state.mastermindStats = {};
      state.protagonistStats = {};
    },
    /**
     * 单独设置 totalEstimate
     */
    setTotalEstimate(state, action: PayloadAction<number>) {
      state.totalEstimate = action.payload;
    },
    /**
     * 取消计算：若正在 running，则将 canceled 置 true，并把 status 置 'idle'
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
     * 合并某个 Worker 返回的“剧作家本地统计”到全局
     */
    mergeMastermindStats(
      state,
      action: PayloadAction<Record<string, MastermindStatEntry>>
    ) {
      const local = action.payload;
      Object.entries(local).forEach(([key, localEntry]) => {
        if (!state.mastermindStats[key]) {
          // 如果全局还没这一 key，直接复制过去
          state.mastermindStats[key] = localEntry;
        } else {
          // 否则进行“三劣 / 次劣 / 第三劣”合并
          const globalEntry = state.mastermindStats[key];
          mergeStatEntries(globalEntry, localEntry);
          // placement 字段保持不变
        }
      });
    },
    /**
     * 合并某个 Worker 返回的“主人公本地统计”到全局
     */
    mergeProtagonistStats(
      state,
      action: PayloadAction<Record<string, ProtagonistStatEntry>>
    ) {
      const local = action.payload;
      Object.entries(local).forEach(([key, localEntry]) => {
        if (!state.protagonistStats[key]) {
          state.protagonistStats[key] = localEntry;
        } else {
          const globalEntry = state.protagonistStats[key];
          mergeStatEntries(globalEntry, localEntry);
          // placement 字段保持不变
        }
      });
    },
    /**
     * 所有 Worker 完成后，前端调用此 action 把 status 置回 'idle'
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

/** 在 ResultDisplay 中会用到，以读取最终聚合结果 */
export const selectFinalMastermindStats = (state: RootState) => state.compute.mastermindStats;
export const selectFinalProtagonistStats = (state: RootState) => state.compute.protagonistStats;

export default computeSlice.reducer;
