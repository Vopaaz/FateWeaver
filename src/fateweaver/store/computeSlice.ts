// src/fateweaver/store/computeSlice.ts
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
 * Protagonist 放置方案映射，用于统计时引用
 */
export type ProtagPlacementMap = Record<ProtagonistActionId, Array<LocationId | CharacterId>>;

/**
 * 每个剧作家行动的全局在线聚合结构
 */
export interface MastermindStatEntry {
  count: number;
  sum: number;
  bestValue: number;
  bestProtagPlacement: ProtagPlacementMap;
  worstValue: number;
  worstProtagPlacement: ProtagPlacementMap;
}

/** 
 * Mastermind 的放置映射，用于 Protagonist 统计时引用
 */
export type MasterPlacementMap = Record<MastermindActionId, Array<LocationId | CharacterId>>;

/**
 * 每个主人公行动的全局在线聚合结构
 */
export interface ProtagonistStatEntry {
  count: number;
  sum: number;
  bestValue: number;
  bestMasterPlacement: MasterPlacementMap;
  worstValue: number;
  worstMasterPlacement: MasterPlacementMap;
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
  mastermindStats: Record<MastermindActionId, MastermindStatEntry>;
  /** 全局合并后的主人公统计 */
  protagonistStats: Record<ProtagonistActionId, ProtagonistStatEntry>;
}

function makeEmptyMastermindStats(): Record<MastermindActionId, MastermindStatEntry> {
  const o = {} as Record<MastermindActionId, MastermindStatEntry>;
  ALL_MASTERMIND_ACTIONS.forEach((aid) => {
    o[aid] = {
      count: 0,
      sum: 0,
      bestValue: -Infinity,
      bestProtagPlacement: {} as ProtagPlacementMap,
      worstValue: Infinity,
      worstProtagPlacement: {} as ProtagPlacementMap,
    };
  });
  return o;
}

function makeEmptyProtagonistStats(): Record<ProtagonistActionId, ProtagonistStatEntry> {
  const o = {} as Record<ProtagonistActionId, ProtagonistStatEntry>;
  ALL_PROTAGONIST_ACTIONS.forEach((aid) => {
    o[aid] = {
      count: 0,
      sum: 0,
      bestValue: -Infinity,
      bestMasterPlacement: {} as MasterPlacementMap,
      worstValue: Infinity,
      worstMasterPlacement: {} as MasterPlacementMap,
    };
  });
  return o;
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
      if (state.progress > state.totalEstimate) {
        state.progress = state.totalEstimate;
      }
    },
    /**
     * 合并某个 Worker 砍回来的“剧作家本地统计”到全局
     */
    mergeMastermindStats(
      state,
      action: PayloadAction<Record<MastermindActionId, MastermindStatEntry>>
    ) {
      const local = action.payload;
      ALL_MASTERMIND_ACTIONS.forEach((aid) => {
        const globalStat = state.mastermindStats[aid];
        const localStat = local[aid];
        // 合并 count、sum
        globalStat.count += localStat.count;
        globalStat.sum += localStat.sum;
        // 如果 local.bestValue 更大，就更新全局 best
        if (localStat.bestValue > globalStat.bestValue) {
          globalStat.bestValue = localStat.bestValue;
          globalStat.bestProtagPlacement = { ...localStat.bestProtagPlacement };
        }
        // 如果 local.worstValue 更小，就更新全局 worst
        if (localStat.worstValue < globalStat.worstValue) {
          globalStat.worstValue = localStat.worstValue;
          globalStat.worstProtagPlacement = { ...localStat.worstProtagPlacement };
        }
      });
    },
    /**
     * 合并某个 Worker 砍回来的“主人公本地统计”到全局
     */
    mergeProtagonistStats(
      state,
      action: PayloadAction<Record<ProtagonistActionId, ProtagonistStatEntry>>
    ) {
      const local = action.payload;
      ALL_PROTAGONIST_ACTIONS.forEach((aid) => {
        const globalStat = state.protagonistStats[aid];
        const localStat = local[aid];
        globalStat.count += localStat.count;
        globalStat.sum += localStat.sum;
        if (localStat.bestValue > globalStat.bestValue) {
          globalStat.bestValue = localStat.bestValue;
          globalStat.bestMasterPlacement = { ...localStat.bestMasterPlacement };
        }
        if (localStat.worstValue < globalStat.worstValue) {
          globalStat.worstValue = localStat.worstValue;
          globalStat.worstMasterPlacement = { ...localStat.worstMasterPlacement };
        }
      });
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
export const selectMastermindStats = (state: RootState) => state.compute.mastermindStats;
export const selectProtagonistStats = (state: RootState) => state.compute.protagonistStats;

export default computeSlice.reducer;
