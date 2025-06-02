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
} from "../store/computeSlice";
import {
  MastermindActionId,
  ALL_MASTERMIND_ACTIONS,
  ProtagonistActionId,
} from "../constants/actions";
import { LocationId, CharacterId } from "../constants/board";

// 使用 TypeScript 的 Worker 导入写法（CRA/webpack 支持）：
const ComputeWorker = new Worker(
  new URL("../workers/computeWorker.ts", import.meta.url),
  { type: "module" } // 用模块化方式加载
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

  dispatchStart: (total: number) => void;
  dispatchCancel: () => void;
  dispatchIncrementProgress: (n: number) => void;
  dispatchMergeMastermind: (stats: Record<MastermindActionId, any>) => void;
  dispatchMergeProtagonist: (stats: Record<ProtagonistActionId, any>) => void;
  dispatchFinish: () => void;
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
    // 组件挂载时，先绑定 Worker 消息
    ComputeWorker.addEventListener("message", this.onWorkerMessage);
  }

  componentWillUnmount() {
    // 组件卸载时，解绑
    ComputeWorker.removeEventListener("message", this.onWorkerMessage);
    // 如果还在运行，广播取消
    if (this.props.status === "running") {
      this.handleCancel();
    }
  }

  /** Worker 发来的消息处理函数 */
  onWorkerMessage(ev: MessageEvent) {
    const data = ev.data as
      | { type: "progress"; processed: number }
      | { type: "done"; localMastermindStats: any; localProtagonistStats: any }
      | { type: "aborted" };

    if (data.type === "progress") {
      // 增量报告
      this.props.dispatchIncrementProgress(data.processed);
    } else if (data.type === "done") {
      // 合并该 Worker 的局部统计到 Redux
      this.props.dispatchMergeMastermind(data.localMastermindStats);
      this.props.dispatchMergeProtagonist(data.localProtagonistStats);

      this.remainingWorkers -= 1;
      if (this.remainingWorkers <= 0) {
        // 所有 Worker 均已完成
        this.props.dispatchFinish();
      }
    } else if (data.type === "aborted") {
      // 此 Worker 被取消，不发送局部统计也算完成
      this.remainingWorkers -= 1;
      if (this.remainingWorkers <= 0) {
        this.props.dispatchFinish();
      }
    }
  }

  /** 点击“开始计算”按钮后的逻辑 */
  async handleStart() {
    const {
      totalEstimate,
      mastermindConfig,
      protagonistConfig,
      mastermindScope,
      protagonistScope,
      dispatchStart,
    } = this.props;

    if (this.props.status === "running") return;

    // 1) 先算出所有 “剧作家分布” 列表，共计 M 条
    const allDistributions = generateDistributions(
      ALL_MASTERMIND_ACTIONS,
      mastermindConfig,
      3
    );
    // dispatchStart 里会把 status->'running', progress->0, totalEstimate->total, startTime->now
    dispatchStart(totalEstimate);

    // 2) 根据 CPU 核心数（或固定 N）创建 N 个 Worker
    const cpuCount = navigator.hardwareConcurrency || 4;
    const N = Math.min(cpuCount, allDistributions.length);
    this.remainingWorkers = N;
    this.workers = [];

    // 均匀切分分布列表
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

      // 3) 给 Worker 发送“start”消息，传入它要负责的 slice 及所有配置
      w.postMessage({
        type: "start",
        sliceDistributions: sliceDist,
        protagonistConfig,
        mastermindScope,
        protagonistScope,
      } as any);
    }
  }

  /** 点击“取消计算”按钮后的逻辑 */
  handleCancel() {
    this.props.dispatchCancel();
    // 广播给所有正在运行的 Worker
    this.workers.forEach((w) => {
      w.postMessage({ type: "cancel" });
    });
    // 解绑 Worker，并结束这些 Worker
    this.workers.forEach((w) => {
      w.terminate();
      w.removeEventListener("message", this.onWorkerMessage);
    });
    this.workers = [];
    this.remainingWorkers = 0;
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

    return (
      <div className="container py-4">
        <h5 className="mb-3 text-center">计算控制台</h5>
        {/* 进度条 */}

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
          基于“如果剧作家没有在某个地点放任何牌，主人公就不会在这个地点放禁止密谋”的提前剪枝，
          实际进行的枚举数量可能会比估计的少，为正常现象
        </p>

        {status === "idle" ? (
          <button
            className="btn btn-primary"
            onClick={this.handleStart}
            disabled={totalEstimate === 0}
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
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  dispatchStart: (total: number) => dispatch(startCompute({ total })),
  dispatchCancel: () => dispatch(cancelCompute()),
  dispatchIncrementProgress: (n: number) => dispatch(incrementProgressBy(n)),
  dispatchMergeMastermind: (stats: Record<MastermindActionId, any>) =>
    dispatch(mergeMastermindStats(stats)),
  dispatchMergeProtagonist: (stats: Record<ProtagonistActionId, any>) =>
    dispatch(mergeProtagonistStats(stats)),
  dispatchFinish: () => dispatch(finishCompute()),
});

export default connect(mapStateToProps, mapDispatchToProps)(ComputeControl);
