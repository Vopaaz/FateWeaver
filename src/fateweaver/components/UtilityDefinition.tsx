// src/components/UtilityDefinition.tsx

import React, { Component, ReactNode } from 'react';
import { connect } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';

import {
  UtilityItem,
  addUtility,
  removeUtility,
  setUtilityAlias,
  setUtilityType,
  setUtilityParam,
  ValueDefinition,
  addValue,
  removeValue,
  setValueRule,
  setValueNumber,
} from '../store/utilitySlice';
import {
  UtilityRuleType,
  UTILITY_RULES,
} from '../constants/utilityRules';

import {
  CharacterId,
  ALL_LOCATIONS,
  LOCATIONS_I18N,
} from '../constants/board';
import { CHARACTERS_I18N } from '../constants/board';

interface Props {
  utilities: UtilityItem[];
  values: ValueDefinition[];
  locationsState: Record<string, { characters: CharacterId[]; intrigue: number }>;

  addUtility: () => void;
  removeUtility: (id: string) => void;
  setUtilityAlias: (payload: { id: string; alias: string }) => void;
  setUtilityType: (payload: { id: string; type: UtilityRuleType }) => void;
  setUtilityParam: (payload: {
    id: string;
    index: number;
    value: string | number;
  }) => void;

  addValue: () => void;
  removeValue: (id: string) => void;
  setValueRule: (payload: { id: string; ruleId: string }) => void;
  setValueNumber: (payload: { id: string; value: number }) => void;
}

interface State {
  /** 本地暂存每个 value 输入框的字符串 */
  valueInputs: Record<string, string>;
}

class UtilityDefinition extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      valueInputs: {},
    };
    this.handleAddRule = this.handleAddRule.bind(this);
    this.handleAddValue = this.handleAddValue.bind(this);
  }

  componentDidMount() {
    this.syncValueInputsFromProps();
  }

  componentDidUpdate(prevProps: Props) {
    // 如果 values 改变，重新同步本地输入值
    if (prevProps.values !== this.props.values) {
      this.syncValueInputsFromProps();
    }

    // 如果 utilities 被删除后导致引用失效，参数已在 Slice 中统一复位，
    // 这里无需额外修改
    // 同理，效用值的 ruleId 在 Slice 中也已复位
  }

  /** 将 Redux 中数值 value 初始化到本地字符串 state */
  private syncValueInputsFromProps() {
    const newInputs: Record<string, string> = {};
    this.props.values.forEach((v) => {
      newInputs[v.id] = String(v.value);
    });
    this.setState({ valueInputs: newInputs });
  }

  handleAddRule() {
    this.props.addUtility();
  }

  handleAddValue() {
    this.props.addValue();
  }

  private renderRuleText(item: UtilityItem): string {
    if (!item.type) return '';
    const def = UTILITY_RULES[item.type];
    const segments = def.text.split('?');
    let result = '';
    for (let idx = 0; idx < segments.length; idx++) {
      result += segments[idx];
      if (idx < def.params.length) {
        const ptype = def.params[idx];
        const val = item.params[idx];
        if (ptype === 'Number') {
          result += String(val);
        } else if (ptype === 'Character') {
          result += CHARACTERS_I18N[val as CharacterId] || '';
        } else if (ptype === 'Location') {
          result += LOCATIONS_I18N[val as keyof typeof LOCATIONS_I18N] || '';
        } else if (ptype === 'Target') {
          const s = val as string;
          if (ALL_LOCATIONS.includes(s as any)) {
            result += LOCATIONS_I18N[s as keyof typeof LOCATIONS_I18N] || '';
          } else {
            result += CHARACTERS_I18N[s as CharacterId] || '';
          }
        } else if (ptype === 'Rule') {
          const ref = this.props.utilities.find((u) => u.id === val);
          if (ref) result += ref.alias || this.renderRuleText(ref);
        }
      }
    }
    return result;
  }

  private renderParamInput(
    item: UtilityItem,
    paramType: 'Character' | 'Location' | 'Target' | 'Number' | 'Rule',
    paramIndex: number,
    charactersOnBoard: CharacterId[]
  ): ReactNode {
    const { id, params } = item;
    const currentValue = params[paramIndex];

    const selectStyle = { width: '100%' };
    const inputStyle = { width: '100%' };

    switch (paramType) {
      case 'Character': {
        return (
          <select
            className="form-select form-select-sm"
            value={(currentValue as string) || ''}
            onChange={(e) =>
              this.props.setUtilityParam({
                id,
                index: paramIndex,
                value: e.target.value,
              })
            }
            style={selectStyle}
          >
            <option value="" disabled>
              选择角色
            </option>
            {charactersOnBoard.map((c) => (
              <option key={c} value={c}>
                {CHARACTERS_I18N[c]}
              </option>
            ))}
          </select>
        );
      }
      case 'Location': {
        return (
          <select
            className="form-select form-select-sm"
            value={(currentValue as string) || ''}
            onChange={(e) =>
              this.props.setUtilityParam({
                id,
                index: paramIndex,
                value: e.target.value,
              })
            }
            style={selectStyle}
          >
            <option value="" disabled>
              选择地点
            </option>
            {ALL_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {LOCATIONS_I18N[loc]}
              </option>
            ))}
          </select>
        );
      }
      case 'Target': {
        return (
          <select
            className="form-select form-select-sm"
            value={(currentValue as string) || ''}
            onChange={(e) =>
              this.props.setUtilityParam({
                id,
                index: paramIndex,
                value: e.target.value,
              })
            }
            style={selectStyle}
          >
            <option value="" disabled>
              选择目标
            </option>
            {ALL_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {LOCATIONS_I18N[loc]}
              </option>
            ))}
            {charactersOnBoard.map((c) => (
              <option key={c} value={c}>
                {CHARACTERS_I18N[c]}
              </option>
            ))}
          </select>
        );
      }
      case 'Number': {
        return (
          <input
            type="number"
            className="form-control form-control-sm"
            min={0}
            value={Number(currentValue) >= 0 ? String(currentValue) : '0'}
            onChange={(e) => {
              const num = Number(e.target.value);
              this.props.setUtilityParam({
                id,
                index: paramIndex,
                value: num >= 0 ? num : 0,
              });
            }}
            style={inputStyle}
          />
        );
      }
      case 'Rule': {
        const candidates = this.props.utilities.filter((u) => {
          if (u.id === id) return false;
          return u.isValid;
        });
        return (
          <select
            className="form-select form-select-sm"
            value={(currentValue as string) || ''}
            onChange={(e) =>
              this.props.setUtilityParam({
                id,
                index: paramIndex,
                value: e.target.value,
              })
            }
            style={selectStyle}
          >
            <option value="" disabled>
              选择规则
            </option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.alias || this.renderRuleText(u)}
              </option>
            ))}
          </select>
        );
      }
      default:
        return null;
    }
  }

  private handleValueInputChange = (id: string, raw: string) => {
    if (/^-?\d*$/.test(raw)) {
      this.setState((prev) => ({
        valueInputs: { ...prev.valueInputs, [id]: raw },
      }));
    }
  };

  private handleValueInputBlur = (id: string) => {
    const raw = this.state.valueInputs[id] || '';
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      this.props.setValueNumber({ id, value: num });
    } else {
      this.props.setValueNumber({ id, value: 0 });
      this.setState((prev) => ({
        valueInputs: { ...prev.valueInputs, [id]: '0' },
      }));
    }
  };

  private renderRuleCard(item: UtilityItem, charactersOnBoard: CharacterId[]): ReactNode {
    const def = item.type ? UTILITY_RULES[item.type] : null;
    const cardClass = item.isValid
      ? 'card mb-3'
      : 'card mb-3 border border-danger';

    return (
      <div key={item.id} className={cardClass}>
        <div className="card-body">
          <div className="row align-items-center gx-2 gy-2">
            <div className="col-auto">
              <label className="col-form-label">Alias：</label>
            </div>
            <div className="col">
              <input
                type="text"
                className="form-control form-control-sm"
                value={item.alias}
                onChange={(e) =>
                  this.props.setUtilityAlias({ id: item.id, alias: e.target.value })
                }
              />
            </div>
            <div className="col-auto">
              <label className="col-form-label">规则类型：</label>
            </div>
            <div className="col">
              <select
                className="form-select form-select-sm"
                value={item.type}
                onChange={(e) =>
                  this.props.setUtilityType({
                    id: item.id,
                    type: e.target.value as UtilityRuleType,
                  })
                }
              >
                <option value="" disabled>
                  请选择规则
                </option>
                {Object.entries(UTILITY_RULES).map(([key, rd]) => (
                  <option key={key} value={key}>
                    {rd.text}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => this.props.removeUtility(item.id)}
              >
                删除
              </button>
            </div>
          </div>

          {def && (
            <div className="row align-items-center mt-3 gx-2 gy-2">
              {def.text.split('?').map((segment, idx) => (
                <React.Fragment key={idx}>
                  <div className="col-auto">
                    <span>{segment}</span>
                  </div>
                  {idx < def.params.length && (
                    <div className="col">
                      {this.renderParamInput(
                        item,
                        def.params[idx],
                        idx,
                        charactersOnBoard
                      )}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  private renderValueCard(valDef: ValueDefinition, ruleCandidates: UtilityItem[]): ReactNode {
    const rawValue = this.state.valueInputs[valDef.id] ?? '';
    const cardClass = valDef.isValid
      ? 'card mb-3'
      : 'card mb-3 border border-danger';

    return (
      <div key={valDef.id} className={cardClass}>
        <div className="card-body">
          <div className="row align-items-center gx-2 gy-2">
            <div className="col-auto">
              <label className="col-form-label">规则：</label>
            </div>
            <div className="col">
              <select
                className="form-select form-select-sm"
                value={valDef.ruleId}
                onChange={(e) =>
                  this.props.setValueRule({ id: valDef.id, ruleId: e.target.value })
                }
                style={{ width: '100%' }}
              >
                <option value="" disabled>
                  选择规则
                </option>
                {ruleCandidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.alias || this.renderRuleText(u)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="col-form-label">效用值：</label>
            </div>
            <div className="col">
              <input
                type="number"
                className="form-control form-control-sm"
                value={rawValue}
                onChange={(e) => this.handleValueInputChange(valDef.id, e.target.value)}
                onBlur={() => this.handleValueInputBlur(valDef.id)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="col-auto">
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => this.props.removeValue(valDef.id)}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { utilities, values, locationsState } = this.props;

    const charactersOnBoard: CharacterId[] = Array.from(
      new Set(
        Object.values(locationsState).flatMap((loc) => loc.characters)
      )
    );

    const ruleCandidates = utilities.filter((u) => u.isValid);

    return (
      <div className="container py-4">
        <h2 className="mb-4 text-center">效用定义</h2>

        {/* 效用规则 部分 */}
        <h5 className="mb-3">效用规则</h5>
        {utilities.map((item) =>
          this.renderRuleCard(item, charactersOnBoard)
        )}
        <button className="btn btn-primary mb-4" onClick={this.handleAddRule}>
          添加规则
        </button>

        {/* 效用值 部分 */}
        <h5 className="mb-3">效用值</h5>
        {values.map((valDef) =>
          this.renderValueCard(valDef, ruleCandidates)
        )}
        <button className="btn btn-primary" onClick={this.handleAddValue}>
          添加效用值
        </button>
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  utilities: state.utility.items,
  values: state.utility.values,
  locationsState: state.board.locations,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  addUtility: () => dispatch(addUtility()),
  removeUtility: (id: string) => dispatch(removeUtility(id)),
  setUtilityAlias: (payload: { id: string; alias: string }) =>
    dispatch(setUtilityAlias(payload)),
  setUtilityType: (payload: { id: string; type: UtilityRuleType }) =>
    dispatch(setUtilityType(payload)),
  setUtilityParam: (payload: {
    id: string;
    index: number;
    value: string | number;
  }) => dispatch(setUtilityParam(payload)),

  addValue: () => dispatch(addValue()),
  removeValue: (id: string) => dispatch(removeValue(id)),
  setValueRule: (payload: { id: string; ruleId: string }) =>
    dispatch(setValueRule(payload)),
  setValueNumber: (payload: { id: string; value: number }) =>
    dispatch(setValueNumber(payload)),
});

export default connect(mapStateToProps, mapDispatchToProps)(UtilityDefinition);
