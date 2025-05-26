import React, { Component, ReactNode } from 'react';
import { connect } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import {
  MastermindActionId,
  MASTERMIND_ACTIONS_I18N,
  ALL_MASTERMIND_ACTIONS,
  ProtagonistActionId,
  PROTAGONIST_ACTIONS_I18N,
  ALL_PROTAGONIST_ACTIONS,
} from '../constants/actions';
import {
  toggleMastermindAction,
  setGainParanoiaCount,
  setProtagonistActionCount,
  selectMastermindConfig,
  selectProtagonistConfig,
} from '../store/actionConfigSlice';

interface Props {
  mastermindConfig: Record<MastermindActionId, number>;
  protagonistConfig: Record<ProtagonistActionId, number>;
  toggleMastermindAction: (id: MastermindActionId) => void;
  setGainParanoiaCount: (count: number) => void;
  setProtagonistActionCount: (payload: { actionId: ProtagonistActionId; count: number }) => void;
}

class ActionConfiguration extends Component<Props> {
  renderMastermindSection(): ReactNode {
    const { mastermindConfig, toggleMastermindAction, setGainParanoiaCount } = this.props;
    return (
      <section className="mb-3">
        <h5>剧作家行动配置</h5>
        <div className="d-flex flex-wrap">
          {ALL_MASTERMIND_ACTIONS.map(id => {
            if (id === 'GainParanoia') {
              const count = mastermindConfig[id];
              return (
                <div key={id} className="border rounded p-2 me-3 mb-2 d-flex align-items-center text-nowrap">
                  <span className="me-2">{MASTERMIND_ACTIONS_I18N[id]}</span>
                  <input
                    type="number"
                    className="form-control form-control-sm text-center"
                    style={{ width: '3rem' }}
                    min={0}
                    max={2}
                    value={count}
                    onChange={e => setGainParanoiaCount(Number(e.target.value))}
                  />
                </div>
              );
            } else {
              const enabled = mastermindConfig[id] === 1;
              return (
                <div key={id} className="border rounded p-2 me-3 mb-2 d-flex align-items-center text-nowrap">
                  <span className="me-2">{MASTERMIND_ACTIONS_I18N[id]}</span>
                  <input
                    type="checkbox"
                    className="form-check-input ms-1"
                    checked={enabled}
                    onChange={() => toggleMastermindAction(id)}
                  />
                </div>
              );
            }
          })}
        </div>
      </section>
    );
  }

  renderProtagonistSection(): ReactNode {
    const { protagonistConfig, setProtagonistActionCount } = this.props;
    return (
      <section>
        <h5>主人公行动配置</h5>
        <div className="d-flex flex-wrap">
          {ALL_PROTAGONIST_ACTIONS.map(id => {
            const count = protagonistConfig[id];
            const max = id === 'ForbidIntrigue' ? 1 : 3;
            return (
              <div key={id} className="border rounded p-2 me-3 mb-2 d-flex align-items-center text-nowrap">
                <span className="me-2">{PROTAGONIST_ACTIONS_I18N[id]}</span>
                <input
                  type="number"
                  className="form-control form-control-sm text-center"
                  style={{ width: '3rem' }}
                  min={0}
                  max={max}
                  value={count}
                  onChange={e => setProtagonistActionCount({ actionId: id, count: Number(e.target.value) })}
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  render() {
    return (
      <div className="container py-2">
        {this.renderMastermindSection()}
        {this.renderProtagonistSection()}
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  mastermindConfig: selectMastermindConfig(state),
  protagonistConfig: selectProtagonistConfig(state),
});
const mapDispatchToProps = (dispatch: AppDispatch) => ({
  toggleMastermindAction: (id: MastermindActionId) => dispatch(toggleMastermindAction(id)),
  setGainParanoiaCount: (count: number) => dispatch(setGainParanoiaCount(count)),
  setProtagonistActionCount: (payload: { actionId: ProtagonistActionId; count: number }) =>
    dispatch(setProtagonistActionCount(payload)),
});

export default connect(mapStateToProps, mapDispatchToProps)(ActionConfiguration);