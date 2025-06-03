// src/components/ResultDisplay.tsx

import React from 'react';
import { connect } from 'react-redux';
import { RootState } from '../store/store';
import {
  selectFinalMastermindStats,
  selectFinalProtagonistStats,
} from '../store/resultSlice';
import { MastermindActionId, ProtagonistActionId } from '../constants/actions';

interface Props {
  mastermindStats: Record<string, any> | null;
  protagonistStats: Record<string, any> | null;
}

const ResultDisplay: React.FC<Props> = ({ mastermindStats, protagonistStats }) => {
  if (!mastermindStats || !protagonistStats) {
    return <p className="mt-4 text-center">暂无计算结果，请先运行一次计算。</p>;
  }

  // 辅助：把 JSON 字符串解析成对象并格式化
  const parseAndFormat = (combKey: string) => {
    try {
      const obj = JSON.parse(combKey);
      return JSON.stringify(obj);
    } catch {
      return combKey;
    }
  };

  return (
    <div className="container mt-4">
      <h5 className="text-center mb-3">最终聚合结果</h5>

      {/* 剧作家视角 */}
      <div className="mb-4">
        <h6>剧作家 三张牌放置组合统计（最劣/次劣/第三劣）</h6>
        <pre style={{ whiteSpace: 'pre-wrap' }}>
          {Object.entries(mastermindStats).map(([combKey, stats]) => {
            return (
              <div key={combKey} style={{ marginBottom: '1rem' }}>
                <strong>组合：{parseAndFormat(combKey)}</strong>
                <br />
                &nbsp;&nbsp;最劣值：{stats.worstValue} （出现次数：{stats.worstCount}）；示例 Protagonist 放置：{JSON.stringify(stats.worstExample)}
                <br />
                &nbsp;&nbsp;次劣值：{stats.secondWorstValue} （出现次数：{stats.secondWorstCount}）；示例：{JSON.stringify(stats.secondWorstExample)}
                <br />
                &nbsp;&nbsp;第三劣值：{stats.thirdWorstValue} （出现次数：{stats.thirdWorstCount}）；示例：{JSON.stringify(stats.thirdWorstExample)}
                <br />
              </div>
            );
          })}
        </pre>
      </div>

      {/* 主人公视角 */}
      <div className="mb-4">
        <h6>主人公 三张牌放置组合统计（最劣/次劣/第三劣）</h6>
        <pre style={{ whiteSpace: 'pre-wrap' }}>
          {Object.entries(protagonistStats).map(([combKey, stats]) => {
            return (
              <div key={combKey} style={{ marginBottom: '1rem' }}>
                <strong>组合：{parseAndFormat(combKey)}</strong>
                <br />
                &nbsp;&nbsp;最劣值：{stats.worstValue} （出现次数：{stats.worstCount}）；示例 Mastermind 放置：{JSON.stringify(stats.worstExample)}
                <br />
                &nbsp;&nbsp;次劣值：{stats.secondWorstValue} （出现次数：{stats.secondWorstCount}）；示例：{JSON.stringify(stats.secondWorstExample)}
                <br />
                &nbsp;&nbsp;第三劣值：{stats.thirdWorstValue} （出现次数：{stats.thirdWorstCount}）；示例：{JSON.stringify(stats.thirdWorstExample)}
                <br />
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};

const mapStateToProps = (state: RootState) => ({
  mastermindStats: selectFinalMastermindStats(state),
  protagonistStats: selectFinalProtagonistStats(state),
});

export default connect(mapStateToProps)(ResultDisplay);
