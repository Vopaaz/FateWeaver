// src/components/ComputeControl.tsx

import React, { Component } from "react";
import { connect } from "react-redux";
import { RootState, AppDispatch } from "../store/store";
import {
  startCompute,
  cancelCompute,
  incrementProgressBy,
  mergeMastermindStats,
  mergeProtagonistStats,
  finishCompute,
  selectComputeTotal,
  selectComputeProgress,
  selectComputeStatus,
  selectComputeStartTime,
  selectComputeCanceled,
  selectFinalMastermindStats,
  selectFinalProtagonistStats,
} from "../store/computeSlice";
import { MastermindActionId, ProtagonistActionId } from "../constants/actions";
import { LocationId, CharacterId } from "../constants/board";

// 从 computeSlice 中导入对应的接口类型
import {
  MastermindStatEntry,
  ProtagonistStatEntry,
} from "../store/computeSlice";

// 新增：从 utilitySlice 导入类型
import { UtilityItem, ValueDefinition } from "../store/utilitySlice";
// 新增：从 resultSlice 导入 action
import { setFinalResult, clearFinalResult } from "../store/resultSlice";


const ComputeWorker = new Worker(
  new URL("../workers/computeWorker.ts", import.meta.url),
  { type: "module" }
);

type Target = LocationId | CharacterId;

interface Props {
  mastermindConfig: Record<MastermindActionId, number>;
  protagonistConfig: Record<ProtagonistActionId, number>;
  mastermindScope: Record<MastermindActionId, Target[]>;
  protagonistScope: Record<ProtagonistActionId, Target[]>;

  totalEstimate: number;
  progress: number;
  status: "idle" | "running";
  startTime: number | null;
  canceled: boolean;

  utilities: UtilityItem[];
  values: ValueDefinition[];

  boardState: {
    locations: Record<LocationId, { characters: CharacterId[]; intrigue: number }>;
    characterStats: Record<CharacterId, { paranoia: number; goodwill: number; intrigue: number; alive: boolean }>;
  };

  dispatchStart: (total: number) => void;
  dispatchCancel: () => void;
  dispatchIncrementProgress: (n: number) => void;
  dispatchMergeMastermind: (
    stats: Record<string, MastermindStatEntry>
  ) => void;
  dispatchMergeProtagonist: (
    stats: Record<string, ProtagonistStatEntry>
  ) => void;
  dispatchFinish: () => void;

  computeMastermindStats: Record<string, MastermindStatEntry>;
  computeProtagonistStats: Record<string, ProtagonistStatEntry>;

  dispatchSetFinalResult: (payload: {
    mastermindStats: Record<string, MastermindStatEntry>;
    protagonistStats: Record<string, ProtagonistStatEntry>;
  }) => void;
  dispatchClearFinalResult: () => void;
}

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

class ComputeControl extends Component<Props> {
  private workers: Worker[] = [];
  private remainingWorkers: number = 0;

  constructor(props: Props) {
    super(props);
    this.handleStart = this.handleStart.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.onWorkerMessage = this.onWorkerMessage.bind(this);
  }

  componentDidMount() {
    ComputeWorker.addEventListener("message", this.onWorkerMessage);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.status === "running" && this.props.status === "idle") {
      const { computeMastermindStats, computeProtagonistStats, dispatchSetFinalResult } = this.props;
      // 深拷贝
      const clonedMaster = JSON.parse(JSON.stringify(computeMastermindStats)) as Record<
        string,
        MastermindStatEntry
      >;
      const clonedProtag = JSON.parse(JSON.stringify(computeProtagonistStats)) as Record<
        string,
        ProtagonistStatEntry
      >;
      dispatchSetFinalResult({
        mastermindStats: clonedMaster,
        protagonistStats: clonedProtag,
      });
    }
  }

  componentWillUnmount() {
    ComputeWorker.removeEventListener("message", this.onWorkerMessage);
    if (this.props.status === "running") {
      this.handleCancel();
    }
  }

  onWorkerMessage(ev: MessageEvent) {
    const data = ev.data as
      | { type: "progress"; processed: number }
      | {
          type: "done";
          localMastermindStats: Record<string, MastermindStatEntry>;
          localProtagonistStats: Record<string, ProtagonistStatEntry>;
        }
      | { type: "aborted" };

    if (data.type === "progress") {
      this.props.dispatchIncrementProgress(data.processed);
    } else if (data.type === "done") {
      // 注意：现在接收并合并的是 Record<string, StatEntry>
      this.props.dispatchMergeMastermind(data.localMastermindStats);
      this.props.dispatchMergeProtagonist(data.localProtagonistStats);

      this.remainingWorkers -= 1;
      if (this.remainingWorkers <= 0) {
        this.props.dispatchFinish();
      }
    } else if (data.type === "aborted") {
      this.remainingWorkers -= 1;
      if (this.remainingWorkers <= 0) {
        this.props.dispatchFinish();
      }
    }
  }

  async handleStart() {
    const {
      totalEstimate,
      mastermindConfig,
      protagonistConfig,
      mastermindScope,
      protagonistScope,
      boardState,
      utilities,
      values,
      dispatchStart,
      dispatchClearFinalResult,
    } = this.props;

    if (this.props.status === "running") return;

    dispatchClearFinalResult();

    const allDistributions = generateDistributions(
      Object.keys(mastermindConfig) as MastermindActionId[],
      mastermindConfig,
      3
    );
    dispatchStart(totalEstimate);

    const cpuCount = navigator.hardwareConcurrency || 4;
    const N = Math.min(cpuCount, allDistributions.length);
    this.remainingWorkers = N;
    this.workers = [];

    const chunkSize = Math.ceil(allDistributions.length / N);
    for (let i = 0; i < N; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, allDistributions.length);
      const sliceDist = allDistributions.slice(start, end);

      const w = new Worker(
        new URL("../workers/computeWorker.ts", import.meta.url),
        { type: "module" }
      );
      w.addEventListener("message", this.onWorkerMessage);
      this.workers.push(w);

      w.postMessage({
        type: "start",
        sliceDistributions: sliceDist,
        protagonistConfig,
        mastermindScope,
        protagonistScope,
        boardState,
        utilities,
        values,
      } as any);
    }
  }

  handleCancel() {
    this.props.dispatchCancel();
    this.workers.forEach((w) => {
      w.postMessage({ type: "cancel" });
    });
    this.workers.forEach((w) => {
      w.terminate();
      w.removeEventListener("message", this.onWorkerMessage);
    });
    this.workers = [];
    this.remainingWorkers = 0;
  }

  private canStartCompute(): boolean {
    const { utilities, values } = this.props;
    if (values.length === 0) return false;
    for (const u of utilities) {
      if (!u.isValid) return false;
    }
    for (const v of values) {
      if (!v.isValid) return false;
    }
    return true;
  }

  render() {
    const { totalEstimate, progress, status, startTime } = this.props;
    const elapsedSec =
      startTime && status === "running"
        ? Math.floor((Date.now() - startTime) / 1000)
        : 0;
    let etaSec = 0;
    if (status === "running" && progress > 0) {
      const rate = (Date.now() - (startTime || 0)) / progress; // ms/instance
      etaSec = Math.max(
        0,
        Math.ceil(((totalEstimate - progress) * rate) / 1000)
      );
    }
    const percent =
      totalEstimate > 0 ? Math.min((progress / totalEstimate) * 100, 100) : 0;

    const startDisabled =
      totalEstimate === 0 ||
      !this.canStartCompute() ||
      status === "running";

    return (
      <div className="container py-4">
        <h2 className="mb-4 text-center">计算控制台</h2>
        <div className="progress mb-2" style={{ height: "1.5rem" }}>
          <div
            className="progress-bar"
            role="progressbar"
            style={{ width: `${percent}%` }}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {percent.toFixed(1)}%
          </div>
        </div>
        <p>
          已处理: {progress.toLocaleString()} / {totalEstimate.toLocaleString()}
          <br />
          已耗时: {elapsedSec}s ，预计剩余:{" "}
          {status === "running" ? `${etaSec}s` : "--"}
        </p>
        <p className="small">
          基于“如果剧作家没有在某个对象放任何牌，主人公就不会在这个对象放禁止密谋或禁止移动”的提前剪枝，
          实际进行的枚举数量可能远少于估计值，为正常现象
        </p>

        {status === "idle" ? (
          <button
            className="btn btn-primary"
            onClick={this.handleStart}
            disabled={startDisabled}
          >
            开始计算
          </button>
        ) : (
          <button className="btn btn-danger" onClick={this.handleCancel}>
            取消计算
          </button>
        )}
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  mastermindConfig: state.actionConfig.mastermindConfig,
  protagonistConfig: state.actionConfig.protagonistConfig,
  mastermindScope: state.actionConfig.mastermindScope,
  protagonistScope: state.actionConfig.protagonistScope,
  totalEstimate: selectComputeTotal(state),
  progress: selectComputeProgress(state),
  status: selectComputeStatus(state),
  startTime: selectComputeStartTime(state),
  canceled: selectComputeCanceled(state),

  utilities: state.utility.items,
  values: state.utility.values,

  boardState: {
    locations: state.board.locations,
    characterStats: state.board.characterStats,
  },

  computeMastermindStats: selectFinalMastermindStats(state),
  computeProtagonistStats: selectFinalProtagonistStats(state),
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  dispatchStart: (total: number) => dispatch(startCompute({ total })),
  dispatchCancel: () => dispatch(cancelCompute()),
  dispatchIncrementProgress: (n: number) => dispatch(incrementProgressBy(n)),
  dispatchMergeMastermind: (
    stats: Record<string, MastermindStatEntry>
  ) => dispatch(mergeMastermindStats(stats)),
  dispatchMergeProtagonist: (
    stats: Record<string, ProtagonistStatEntry>
  ) => dispatch(mergeProtagonistStats(stats)),
  dispatchFinish: () => dispatch(finishCompute()),

  dispatchSetFinalResult: (payload: {
    mastermindStats: Record<string, MastermindStatEntry>;
    protagonistStats: Record<string, ProtagonistStatEntry>;
  }) => dispatch(setFinalResult(payload)),
  dispatchClearFinalResult: () => dispatch(clearFinalResult()),
});

export default connect(mapStateToProps, mapDispatchToProps)(ComputeControl);
