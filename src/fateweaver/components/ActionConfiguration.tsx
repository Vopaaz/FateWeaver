// src/fateweaver/components/ActionConfiguration.tsx
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
  LocationId,
  ALL_LOCATIONS,
  CharacterId,
  LOCATIONS_I18N,
  CHARACTERS_I18N,
} from '../constants/board';
import {
  toggleMastermindAction,
  setGainParanoiaCount,
  setProtagonistActionCount,
  setMastermindScope,
  setProtagonistScope,
  selectMastermindConfig,
  selectProtagonistConfig,
  selectMastermindScope,
  selectProtagonistScope,
} from '../store/actionConfigSlice';

interface Props {
  locationsState: Record<LocationId, { characters: CharacterId[] }>;
  mastermindConfig: Record<MastermindActionId, number>;
  protagonistConfig: Record<ProtagonistActionId, number>;
  mastermindScope: Record<MastermindActionId, Array<LocationId | CharacterId>>;
  protagonistScope: Record<ProtagonistActionId, Array<LocationId | CharacterId>>;
  toggleMastermindAction: (id: MastermindActionId) => void;
  setGainParanoiaCount: (count: number) => void;
  setProtagonistActionCount: (payload: { actionId: ProtagonistActionId; count: number }) => void;
  setMastermindScope: (payload: { actionId: MastermindActionId; targets: Array<LocationId | CharacterId> }) => void;
  setProtagonistScope: (payload: { actionId: ProtagonistActionId; targets: Array<LocationId | CharacterId> }) => void;
}

class ActionConfiguration extends Component<Props> {
  // Combine all locations + placed characters
  computeTargets(): Array<LocationId | CharacterId> {
    const chars = Array.from(
      new Set(
        Object.values(this.props.locationsState).flatMap(loc => loc.characters)
      )
    );
    return [...ALL_LOCATIONS, ...chars];
  }

  /**
   * Renders a scope table for either 剧作家 or 主人公.
   * options.allowLocation controls whether a given actionId can apply to locations.
   */
  renderScopeTable<T extends string>(
    title: string,
    allActions: T[],
    config: Record<T, number>,
    i18n: Record<T, string>,
    scope: Record<T, Array<LocationId | CharacterId>>,
    setScope: (args: { actionId: T; targets: Array<LocationId | CharacterId> }) => void,
    options?: { allowLocation?: (actionId: T) => boolean }
  ): ReactNode {
    const allowLocation = options?.allowLocation ?? (() => true);
    const targets = this.computeTargets();

    return (
      <section className="mb-4">
        <h5>{title}</h5>
        <table className="table table-bordered table-sm table-striped">
          <thead>
            <tr>
              {/* Row-toggle header */}
              <th className="text-center" title="点击可切换整行">行动</th>
              {/* Column headers */}
              {targets.map(t => {
                const isLoc = ALL_LOCATIONS.includes(t as LocationId);
                return (
                  <th
                    key={t}
                    className="text-center p-1"
                    title="点击可切换整列"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      // For this column, only include actions that are enabled (config>0)
                      // and that are allowed for locations if t is a location
                      const applicable = allActions.filter(a => 
                        config[a] > 0 && (!isLoc || allowLocation(a))
                      );
                      const columnAll = applicable.every(a =>
                        (scope[a] || []).includes(t)
                      );
                      applicable.forEach(a => {
                        const prev = scope[a] || [];
                        const next = columnAll
                          ? prev.filter(x => x !== t)
                          : [...prev, t];
                        setScope({ actionId: a, targets: next });
                      });
                    }}
                  >
                    {isLoc
                      ? LOCATIONS_I18N[t as LocationId]
                      : CHARACTERS_I18N[t as CharacterId]}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allActions
              .filter(a => config[a] > 0)
              .map((a, idx) => {
                const selected = scope[a] || [];
                // For row-toggle, we only toggle allowed targets
                const rowTargets = targets.filter(t =>
                  !ALL_LOCATIONS.includes(t as LocationId) || allowLocation(a)
                );
                const rowAll = rowTargets.every(t => selected.includes(t));

                return (
                  <tr key={a} className={idx % 2 === 1 ? 'table-active' : ''}>
                    {/* Action-toggle cell */}
                    <td
                      className="text-center"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const next = rowAll ? [] : rowTargets;
                        setScope({ actionId: a, targets: next });
                      }}
                    >
                      {i18n[a]}
                    </td>

                    {/* Individual cells */}
                    {targets.map(t => {
                      const isLoc = ALL_LOCATIONS.includes(t as LocationId);
                      const allowed = !isLoc || allowLocation(a);
                      const checked = selected.includes(t);
                      return (
                        <td
                          key={t}
                          className="text-center"
                          style={{
                            fontSize: '1.2rem',
                            cursor: allowed ? 'pointer' : 'not-allowed',
                            opacity: allowed ? 1 : 0.4,
                          }}
                          onClick={() => {
                            if (!allowed) return;
                            const prev = scope[a] || [];
                            const next = prev.includes(t)
                              ? prev.filter(x => x !== t)
                              : [...prev, t];
                            setScope({ actionId: a, targets: next });
                          }}
                        >
                          {checked ? '✔️' : '❌'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </section>
    );
  }

  render() {
    const {
      locationsState,
      mastermindConfig,
      protagonistConfig,
      mastermindScope,
      protagonistScope,
      toggleMastermindAction,
      setGainParanoiaCount,
      setProtagonistActionCount,
      setMastermindScope,
      setProtagonistScope,
    } = this.props;

    return (
      <div className="container py-4">
        <h2 className="mb-4 text-center">行动配置</h2>

        {/* 剧作家 基本配置 */}
        <h5>剧作家 基本配置</h5>
        <div className="d-flex flex-wrap mb-3">
          {ALL_MASTERMIND_ACTIONS.map(id => (
            <div
              key={id}
              className="border rounded p-2 me-3 mb-2 d-flex align-items-center"
            >
              <span className="me-1">{MASTERMIND_ACTIONS_I18N[id]}</span>
              {id === 'GainParanoia' ? (
                <input
                  type="number"
                  min={0}
                  max={2}
                  className="form-control form-control-sm text-center"
                  style={{ width: '3rem' }}
                  value={mastermindConfig[id]}
                  onChange={e => setGainParanoiaCount(Number(e.target.value))}
                />
              ) : (
                <input
                  type="checkbox"
                  className="form-check-input ms-1"
                  checked={mastermindConfig[id] === 1}
                  onChange={() => toggleMastermindAction(id)}
                />
              )}
            </div>
          ))}
        </div>
        {this.renderScopeTable<MastermindActionId>(
          '剧作家 作用范围',
          ALL_MASTERMIND_ACTIONS,
          mastermindConfig,
          MASTERMIND_ACTIONS_I18N,
          mastermindScope,
          setMastermindScope
        )}

        {/* 主人公 基本配置 */}
        <h5>主人公 基本配置</h5>
        <div className="d-flex flex-wrap mb-3">
          {ALL_PROTAGONIST_ACTIONS.map(id => (
            <div
              key={id}
              className="border rounded p-2 me-3 mb-2 d-flex align-items-center"
            >
              <span className="me-1">{PROTAGONIST_ACTIONS_I18N[id]}</span>
              {id === 'ForbidIntrigue' ? (
                <input
                  type="checkbox"
                  className="form-check-input ms-1"
                  checked={protagonistConfig[id] === 1}
                  onChange={() =>
                    setProtagonistActionCount({
                      actionId: id,
                      count: protagonistConfig[id] === 1 ? 0 : 1,
                    })
                  }
                />
              ) : (
                <input
                  type="number"
                  min={0}
                  max={3}
                  className="form-control form-control-sm text-center"
                  style={{ width: '3rem' }}
                  value={protagonistConfig[id]}
                  onChange={e =>
                    setProtagonistActionCount({
                      actionId: id,
                      count: Number(e.target.value),
                    })
                  }
                />
              )}
            </div>
          ))}
        </div>
        {this.renderScopeTable<ProtagonistActionId>(
          '主人公 作用范围',
          ALL_PROTAGONIST_ACTIONS,
          protagonistConfig,
          PROTAGONIST_ACTIONS_I18N,
          protagonistScope,
          setProtagonistScope,
          // Only allow locations for ForbidIntrigue
          { allowLocation: actionId => actionId === 'ForbidIntrigue' }
        )}
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  locationsState: state.board.locations,
  mastermindConfig: selectMastermindConfig(state),
  protagonistConfig: selectProtagonistConfig(state),
  mastermindScope: selectMastermindScope(state),
  protagonistScope: selectProtagonistScope(state),
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  toggleMastermindAction: (id: MastermindActionId) => dispatch(toggleMastermindAction(id)),
  setGainParanoiaCount: (count: number) => dispatch(setGainParanoiaCount(count)),
  setProtagonistActionCount: (payload: { actionId: ProtagonistActionId; count: number }) =>
    dispatch(setProtagonistActionCount(payload)),
  setMastermindScope: (payload: { actionId: MastermindActionId; targets: Array<LocationId | CharacterId> }) =>
    dispatch(setMastermindScope(payload)),
  setProtagonistScope: (payload: { actionId: ProtagonistActionId; targets: Array<LocationId | CharacterId> }) =>
    dispatch(setProtagonistScope(payload)),
});

export default connect(mapStateToProps, mapDispatchToProps)(ActionConfiguration);
