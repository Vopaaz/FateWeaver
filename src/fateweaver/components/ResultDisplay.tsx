// src/components/ResultDisplay.tsx

import React, { Component, ReactNode } from 'react';
import { connect } from 'react-redux';
import { RootState } from '../store/store';
import {
  selectFinalMastermindStats,
  selectFinalProtagonistStats,
} from '../store/computeSlice';
import {
  MastermindStatEntry,
  ProtagonistStatEntry,
  MasterPlacementMap,
  ProtagPlacementMap,
} from '../store/computeSlice';
import {
  MASTERMIND_ACTIONS_I18N,
  PROTAGONIST_ACTIONS_I18N,
} from '../constants/actions';
import { LOCATIONS_I18N, CHARACTERS_I18N } from '../constants/board';

interface Props {
  mastermindStats: Record<string, MastermindStatEntry> | null;
  protagonistStats: Record<string, ProtagonistStatEntry> | null;
}

interface State {
  masterOpen: boolean;
  protagOpen: boolean;
}

class ResultDisplay extends Component<Props, State> {
  state: State = {
    masterOpen: true,   // 默认折叠区域打开
    protagOpen: true,   // 默认折叠区域打开
  };

  /**
   * 将一侧的 placementMap 渲染为中文列表
   */
  private renderPlacement<EPlacement extends Record<string, Array<string>>>(
    placement: EPlacement,
    isMaster: boolean
  ): ReactNode {
    const actionMap = isMaster ? MASTERMIND_ACTIONS_I18N : PROTAGONIST_ACTIONS_I18N;
    return (
      <ul className="mb-2">
        {Object.entries(placement).map(([action, targets]) => {
          if (!targets || targets.length === 0) return null;
          return (
            <li key={action}>
              <strong>{actionMap[action as keyof typeof actionMap]}</strong>：{' '}
              {targets.map((t, idx) => {
                const chinese =
                  LOCATIONS_I18N[t as keyof typeof LOCATIONS_I18N] ||
                  CHARACTERS_I18N[t as keyof typeof CHARACTERS_I18N];
                return <span key={t}>{chinese}{idx < targets.length - 1 ? '、' : ''}</span>;
              })}
            </li>
          );
        })}
      </ul>
    );
  }

  /**
   * 根据 (worstValue, secondWorstValue, thirdWorstValue) 分组后筛选出最多 4 条记录：
   * 对每个 (v1,v2,v3) 组合，选出 countTriple 最小一条和最大一条；再从这些组合取前两组。
   */
  private filterEntries<T extends {
    worstValue: number;
    secondWorstValue: number;
    thirdWorstValue: number;
    worstCount: number;
    secondWorstCount: number;
    thirdWorstCount: number;
  }>(
    entries: Record<string, T>
  ): Array<{ combKey: string; stats: T }> {
    type ValueTriple = `${number},${number},${number}`;
    const groupMap: Map<ValueTriple, Array<{ combKey: string; stats: T }>> = new Map();

    // 按 (worstValue, secondWorstValue, thirdWorstValue) 分组
    Object.entries(entries).forEach(([combKey, stats]) => {
      const vt = `${stats.worstValue},${stats.secondWorstValue},${stats.thirdWorstValue}` as ValueTriple;
      if (!groupMap.has(vt)) {
        groupMap.set(vt, []);
      }
      groupMap.get(vt)!.push({ combKey, stats });
    });

    type CountTriple = [number, number, number];
    const collapseGroups: Array<{
      vtNums: [number, number, number];
      minItem: { combKey: string; stats: T; countTriple: CountTriple };
      maxItem: { combKey: string; stats: T; countTriple: CountTriple };
    }> = [];

    // 对每组内，通过 (worstCount, secondWorstCount, thirdWorstCount) 排序，找出最小/最大
    groupMap.forEach((items, vt) => {
      const parsed = vt.split(',').map(n => Number(n)) as [number, number, number];
      const annotated = items.map(item => ({
        ...item,
        countTriple: [
          item.stats.worstCount,
          item.stats.secondWorstCount,
          item.stats.thirdWorstCount,
        ] as CountTriple,
      }));

      const cmpCounts = (a: CountTriple, b: CountTriple): number => {
        if (a[0] !== b[0]) return a[0] - b[0];
        if (a[1] !== b[1]) return a[1] - b[1];
        return a[2] - b[2];
      };

      let minItem = annotated[0];
      let maxItem = annotated[0];
      annotated.forEach(it => {
        if (cmpCounts(it.countTriple, minItem.countTriple) < 0) {
          minItem = it;
        }
        if (cmpCounts(it.countTriple, maxItem.countTriple) > 0) {
          maxItem = it;
        }
      });

      collapseGroups.push({
        vtNums: parsed,
        minItem,
        maxItem,
      });
    });

    // 按 (worstValue, secondWorstValue, thirdWorstValue) 从大到小排序，取前两组
    collapseGroups.sort((a, b) => {
      if (a.vtNums[0] !== b.vtNums[0]) return b.vtNums[0] - a.vtNums[0];
      if (a.vtNums[1] !== b.vtNums[1]) return b.vtNums[1] - a.vtNums[1];
      return b.vtNums[2] - a.vtNums[2];
    });
    const topGroups = collapseGroups.slice(0, 2);

    // 从每组中提取 minItem 和 maxItem
    const result: Array<{ combKey: string; stats: T }> = [];
    topGroups.forEach(grp => {
      result.push({ combKey: grp.minItem.combKey, stats: grp.minItem.stats });
      result.push({ combKey: grp.maxItem.combKey, stats: grp.maxItem.stats });
    });
    return result;
  }

  /**
   * 渲染筛选后的剧作家侧结果
   */
  private renderFilteredMaster(): ReactNode {
    const { mastermindStats } = this.props;
    if (!mastermindStats) return null;

    const filtered = this.filterEntries(mastermindStats);
    return (
      <div className="card mb-3">
        <div className="card-header p-2 d-flex align-items-center">
          <button
            className="btn btn-sm btn-outline-secondary me-2"
            onClick={() => this.setState(({ masterOpen }) => ({ masterOpen: !masterOpen }))}
          >
            {this.state.masterOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="bi bi-chevron-down"
                viewBox="0 0 16 16"
              >
                <polyline
                  points="1 4 8 11 15 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="bi bi-chevron-right"
                viewBox="0 0 16 16"
              >
                <polyline
                  points="4 1 11 8 4 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <span className="fw-semibold">剧作家行动推荐</span>
        </div>
        {this.state.masterOpen && (
          <div className="card-body">
            {filtered.map(({ combKey, stats }, ix) => (
              <div key={`mastermind-comb-${ix}`} className="d-flex flex-wrap mb-4">
                {/* 剧作家三张牌组合 */}
                <div className="card flex-fill me-2 mb-2">
                  <div className="card-header bg-light">
                    <strong>剧作家行动</strong>
                  </div>
                  <div className="card-body">
                    {this.renderPlacement<MasterPlacementMap>(stats.placement, true)}
                  </div>
                </div>

                {/* 最劣值板块 */}
                <div className="card flex-fill me-2 mb-2">
                  <div className="card-header bg-light">
                    <strong>最劣效用：{stats.worstValue}</strong>
                  </div>
                  <div className="card-body">
                    <p className="mb-1">
                      <strong>出现次数：</strong> {stats.worstCount}
                    </p>
                    <p className="mb-1">
                      <strong>示例对手行动：</strong>
                    </p>
                    {this.renderPlacement<ProtagPlacementMap>(stats.worstExample, false)}
                  </div>
                </div>

                {/* 次劣值板块 */}
                <div className="card flex-fill me-2 mb-2">
                  <div className="card-header bg-light">
                    <strong>次劣效用：{stats.secondWorstValue}</strong>
                  </div>
                  <div className="card-body">
                    <p className="mb-1">
                      <strong>出现次数：</strong> {stats.secondWorstCount}
                    </p>
                    <p className="mb-1">
                      <strong>示例对手行动：</strong>
                    </p>
                    {this.renderPlacement<ProtagPlacementMap>(stats.secondWorstExample, false)}
                  </div>
                </div>

                {/* 第三劣值板块 */}
                <div className="card flex-fill mb-2">
                  <div className="card-header bg-light">
                    <strong>第三劣效用：{stats.thirdWorstValue}</strong>
                  </div>
                  <div className="card-body">
                    <p className="mb-1">
                      <strong>出现次数：</strong> {stats.thirdWorstCount}
                    </p>
                    <p className="mb-1">
                      <strong>示例对手行动：</strong>
                    </p>
                    {this.renderPlacement<ProtagPlacementMap>(stats.thirdWorstExample, false)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /**
   * 渲染筛选后的主人公侧结果
   */
  private renderFilteredProtag(): ReactNode {
    const { protagonistStats } = this.props;
    if (!protagonistStats) return null;

    const filtered = this.filterEntries(protagonistStats);
    return (
      <div className="card mb-3">
        <div className="card-header p-2 d-flex align-items-center">
          <button
            className="btn btn-sm btn-outline-secondary me-2"
            onClick={() => this.setState(({ protagOpen }) => ({ protagOpen: !protagOpen }))}
          >
            {this.state.protagOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="bi bi-chevron-down"
                viewBox="0 0 16 16"
              >
                <polyline
                  points="1 4 8 11 15 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="bi bi-chevron-right"
                viewBox="0 0 16 16"
              >
                <polyline
                  points="4 1 11 8 4 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <span className="fw-semibold">主人公行动推荐</span>
        </div>
        {this.state.protagOpen && (
          <div className="card-body">
            {filtered.map(({ combKey, stats }, ix) => (
              <div key={`protag-comb-${ix}`} className="d-flex flex-wrap mb-4">
                {/* 主人公三张牌组合 */}
                <div className="card flex-fill me-2 mb-2">
                  <div className="card-header bg-light">
                    <strong>主人公行动</strong>
                  </div>
                  <div className="card-body">
                    {this.renderPlacement<ProtagPlacementMap>(stats.placement, false)}
                  </div>
                </div>

                {/* 最劣值板块 */}
                <div className="card flex-fill me-2 mb-2">
                  <div className="card-header bg-light">
                    <strong>最劣效用：{stats.worstValue}</strong>
                  </div>
                  <div className="card-body">
                    <p className="mb-1">
                      <strong>出现次数：</strong> {stats.worstCount}
                    </p>
                    <p className="mb-1">
                      <strong>示例对手行动：</strong>
                    </p>
                    {this.renderPlacement<MasterPlacementMap>(stats.worstExample, true)}
                  </div>
                </div>

                {/* 次劣值板块 */}
                <div className="card flex-fill me-2 mb-2">
                  <div className="card-header bg-light">
                    <strong>次劣效用：{stats.secondWorstValue}</strong>
                  </div>
                  <div className="card-body">
                    <p className="mb-1">
                      <strong>出现次数：</strong> {stats.secondWorstCount}
                    </p>
                    <p className="mb-1">
                      <strong>示例对手行动：</strong>
                    </p>
                    {this.renderPlacement<MasterPlacementMap>(stats.secondWorstExample, true)}
                  </div>
                </div>

                {/* 第三劣值板块 */}
                <div className="card flex-fill mb-2">
                  <div className="card-header bg-light">
                    <strong>第三劣效用：{stats.thirdWorstValue}</strong>
                  </div>
                  <div className="card-body">
                    <p className="mb-1">
                      <strong>出现次数：</strong> {stats.thirdWorstCount}
                    </p>
                    <p className="mb-1">
                      <strong>示例对手行动：</strong>
                    </p>
                    {this.renderPlacement<MasterPlacementMap>(stats.thirdWorstExample, true)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  render() {
    const { mastermindStats, protagonistStats } = this.props;

    if (!mastermindStats || !protagonistStats) {
      return <p className="mt-4 text-center">暂无计算结果，请先运行一次计算。</p>;
    }

    return (
      <div className="container mt-4">
        <h2 className="text-center mb-4">行动推荐</h2>
        {this.renderFilteredMaster()}
        {this.renderFilteredProtag()}
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  mastermindStats: selectFinalMastermindStats(state),
  protagonistStats: selectFinalProtagonistStats(state),
});

export default connect(mapStateToProps)(ResultDisplay);
