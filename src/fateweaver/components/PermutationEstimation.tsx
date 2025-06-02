// src/fateweaver/components/PermutationEstimation.tsx
import React, { Component } from "react";
import { connect } from "react-redux";
import { AppDispatch, RootState } from "../store/store";
import {
  MastermindActionId,
  ALL_MASTERMIND_ACTIONS,
  ProtagonistActionId,
  ALL_PROTAGONIST_ACTIONS,
} from "../constants/actions";
import { LocationId, CharacterId } from "../constants/board";
import {
  selectMastermindConfig,
  selectMastermindScope,
  selectProtagonistConfig,
  selectProtagonistScope,
} from "../store/actionConfigSlice";
import { setTotalEstimate } from "../store/computeSlice";

type Target = LocationId | CharacterId;

interface Props {
  // board state for dynamic characters
  locations: Record<LocationId, { characters: CharacterId[] }>;
  // user‐configured counts
  mastermindConfig: Record<MastermindActionId, number>;
  protagonistConfig: Record<ProtagonistActionId, number>;
  // scope rules per action
  mastermindScope: Record<MastermindActionId, Target[]>;
  protagonistScope: Record<ProtagonistActionId, Target[]>;
  dispatch: AppDispatch;
}

class PermutationEstimation extends Component<Props> {
  // generate all combinations of k items from arr
  combinations<T>(arr: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    const withFirst = this.combinations(rest, k - 1).map((c) => [first, ...c]);
    const withoutFirst = this.combinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  // generate all ways to pick exactly `sum` cards given per-action limits
  generateDistributions<T extends string>(
    actions: T[],
    config: Record<T, number>,
    sum: number
  ): Record<T, number>[] {
    const results: Record<T, number>[] = [];
    const current = {} as Record<T, number>;

    const backtrack = (idx: number, rem: number) => {
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
    };

    backtrack(0, sum);
    return results;
  }

  // count placements for one specific distribution of counts
  countWaysForDistribution<T extends string>(
    distribution: Record<T, number>,
    scope: Record<T, Target[]>
  ): number {
    const actions = (Object.keys(distribution) as T[]).filter(
      (a) => distribution[a] > 0
    );

    const backtrack = (idx: number, used: Set<Target>): number => {
      if (idx === actions.length) return 1;
      const action = actions[idx];
      const need = distribution[action];
      const available = (scope[action] || []).filter((t) => !used.has(t));
      const combos = this.combinations(available, need);

      let total = 0;
      for (const combo of combos) {
        combo.forEach((t) => used.add(t));
        total += backtrack(idx + 1, used);
        combo.forEach((t) => used.delete(t));
      }
      return total;
    };

    return backtrack(0, new Set());
  }

  // compute total permutations given action list, user‐limits, and scope
  computeTotal<T extends string>(
    actions: T[],
    config: Record<T, number>,
    scope: Record<T, Target[]>
  ): number {
    const distributions = this.generateDistributions(actions, config, 3);
    return distributions.reduce(
      (sum, dist) => sum + this.countWaysForDistribution(dist, scope),
      0
    );
  }

  componentDidMount() {
    // 在组件挂载后，立刻算一次 “总估算数量” 并写入 Redux
    const {
      mastermindConfig,
      mastermindScope,
      protagonistConfig,
      protagonistScope,
      dispatch,
    } = this.props;

    const mastermindTotal = this.computeTotal(
      ALL_MASTERMIND_ACTIONS,
      mastermindConfig,
      mastermindScope
    );
    const protagonistTotal = this.computeTotal(
      ALL_PROTAGONIST_ACTIONS,
      protagonistConfig,
      protagonistScope
    );
    const overall = mastermindTotal * protagonistTotal;

    dispatch(setTotalEstimate(overall));
  }

  componentDidUpdate(prevProps: Props) {
    // 如果用户修改了配置（trigger 重新估算）
    if (
      JSON.stringify(prevProps.mastermindConfig) !==
        JSON.stringify(this.props.mastermindConfig) ||
      JSON.stringify(prevProps.protagonistConfig) !==
        JSON.stringify(this.props.protagonistConfig) ||
      JSON.stringify(prevProps.mastermindScope) !==
        JSON.stringify(this.props.mastermindScope) ||
      JSON.stringify(prevProps.protagonistScope) !==
        JSON.stringify(this.props.protagonistScope)
    ) {
      const {
        mastermindConfig,
        mastermindScope,
        protagonistConfig,
        protagonistScope,
        dispatch,
      } = this.props;

      const mastermindTotal = this.computeTotal(
        ALL_MASTERMIND_ACTIONS,
        mastermindConfig,
        mastermindScope
      );
      const protagonistTotal = this.computeTotal(
        ALL_PROTAGONIST_ACTIONS,
        protagonistConfig,
        protagonistScope
      );
      const overall = mastermindTotal * protagonistTotal;

      dispatch(setTotalEstimate(overall));
    }
  }

  render() {
    const {
      mastermindConfig,
      mastermindScope,
      protagonistConfig,
      protagonistScope,
    } = this.props;

    // calculate
    const mastermindTotal = this.computeTotal(
      ALL_MASTERMIND_ACTIONS,
      mastermindConfig,
      mastermindScope
    );
    const protagonistTotal = this.computeTotal(
      ALL_PROTAGONIST_ACTIONS,
      protagonistConfig,
      protagonistScope
    );
    const overall = mastermindTotal * protagonistTotal;

    // …inside your render()/function body, before the return:
    const exponent = overall > 0 ? Math.log10(overall) : 0;
    const exponentFixed = exponent.toFixed(3);
    const exponentClass =
      exponent <= 8
        ? "text-success"
        : exponent >= 9
        ? "text-danger"
        : "text-warning";

    return (
      <div className="container py-4 text-center">
        <h5>排列组合估算</h5>
        <p>剧作家总可能性：{mastermindTotal.toLocaleString()}</p>
        <p>主人公总可能性：{protagonistTotal.toLocaleString()}</p>
        <h5>全部可能性：{overall.toLocaleString()}</h5>
        <p>
          数量级：{" "}
          <span className={exponentClass}>{`10^${exponentFixed}`}</span>
        </p>
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  locations: state.board.locations,
  mastermindConfig: selectMastermindConfig(state),
  mastermindScope: selectMastermindScope(state),
  protagonistConfig: selectProtagonistConfig(state),
  protagonistScope: selectProtagonistScope(state),
});

export default connect(mapStateToProps)(PermutationEstimation);
