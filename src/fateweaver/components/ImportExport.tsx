// src/components/ImportExportSection.tsx

import React, { Component, ChangeEvent } from 'react';
import { connect } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { BoardState, setBoardState } from '../store/boardSlice';
import { ActionConfigState, setActionConfig } from '../store/actionConfigSlice';
import {
  UtilityItem,
  ValueDefinition,
  importUtilities,
  importValues,
  clearUtilities,
  clearValues,
} from '../store/utilitySlice';

interface Props {
  boardState: BoardState;
  actionConfig: ActionConfigState;
  utilities: UtilityItem[];
  values: ValueDefinition[];

  setBoardState: (bs: BoardState) => void;
  setActionConfig: (ac: ActionConfigState) => void;
  importUtilities: (items: UtilityItem[]) => void;
  importValues: (vals: ValueDefinition[]) => void;
  clearUtilities: () => void;
  clearValues: () => void;
}

class ImportExport extends Component<Props> {
  private fileInputRef = React.createRef<HTMLInputElement>();

  handleExport = () => {
    const { boardState, actionConfig, utilities, values } = this.props;
    const payload = JSON.stringify(
      { boardState, actionConfig, utilities, values },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fateweaver_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  handleImportClick = () => {
    this.fileInputRef.current?.click();
  };

  handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        // 清空现有
        this.props.setBoardState(data.boardState);
        this.props.setActionConfig(data.actionConfig);

        this.props.clearUtilities();
        this.props.clearValues();
        this.props.importUtilities(data.utilities);
        this.props.importValues(data.values);

        alert('导入成功！');
      } catch {
        alert('无效的配置文件');
      }
    };
    reader.readAsText(file);
    // 重置输入，以便用户可以重复选同一个文件
    e.target.value = '';
  };

  render() {
    return (
      <div className="container py-4">
        <h5 className="mb-3 text-center">导入/导出</h5>
        <div className="d-flex justify-content-center gap-3">
          <button className="btn btn-outline-secondary" onClick={this.handleExport}>
            导出当前配置
          </button>
          <button className="btn btn-outline-secondary" onClick={this.handleImportClick}>
            导入配置 (JSON)
          </button>
        </div>
        {/* 隐藏的文件输入 */}
        <input
          ref={this.fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={this.handleFileChange}
        />
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  boardState: state.board,
  actionConfig: state.actionConfig,
  utilities: state.utility.items,
  values: state.utility.values,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  setBoardState: (bs: BoardState) => dispatch(setBoardState(bs)),
  setActionConfig: (ac: ActionConfigState) => dispatch(setActionConfig(ac)),
  importUtilities: (items: UtilityItem[]) => dispatch(importUtilities(items)),
  importValues: (vals: ValueDefinition[]) => dispatch(importValues(vals)),
  clearUtilities: () => dispatch(clearUtilities()),
  clearValues: () => dispatch(clearValues()),
});

export default connect(mapStateToProps, mapDispatchToProps)(ImportExport);
