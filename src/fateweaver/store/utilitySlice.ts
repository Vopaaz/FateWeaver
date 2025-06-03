// src/store/utilitySlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import {
  UtilityRuleType,
  UTILITY_RULES,
} from '../constants/utilityRules';

/**
 * UtilityParamValue 可以是字符串（角色/地点/规则 ID）或数字
 */
export type UtilityParamValue = string | number;

/**
 * 存储在 Redux 中的单条效用规则结构
 * 新增 isValid 字段，用于标注本条规则是否完整且无循环
 */
export interface UtilityItem {
  id: string;
  alias: string;
  type: UtilityRuleType | '';
  params: UtilityParamValue[];
  isValid: boolean;
}

/**
 * 存储在 Redux 中的“效用值”定义
 * 新增 isValid 字段，用于标注 ruleId 是否有效且引用的规则有效
 */
export interface ValueDefinition {
  id: string;
  ruleId: string;
  value: number;
  isValid: boolean;
}

interface UtilityState {
  items: UtilityItem[];
  values: ValueDefinition[];
}

const initialState: UtilityState = {
  items: [],
  values: [],
};

/** Helper: 检查单条效用规则是否完整且无循环 */
function checkRuleValidity(
  items: UtilityItem[],
  targetId: string,
  visiting: Set<string> = new Set()
): boolean {
  const item = items.find((u) => u.id === targetId);
  if (!item || !item.type) return false;
  // 如果已经在访问栈里，则说明循环
  if (visiting.has(targetId)) return false;
  visiting.add(targetId);

  const def = UTILITY_RULES[item.type];
  // 检查每个参数
  for (let idx = 0; idx < def.params.length; idx++) {
    const ptype = def.params[idx];
    const val = item.params[idx];
    if (
      ptype === 'Character' ||
      ptype === 'Location' ||
      ptype === 'Target'
    ) {
      if (!val || String(val).trim() === '') return false;
    }
    if (ptype === 'Rule') {
      const rid = String(val || '');
      if (!rid) return false;
      // 引用的规则必须存在且本身有效
      if (!checkRuleValidity(items, rid, visiting)) return false;
    }
    // Number 类型不需要额外检查
  }
  visiting.delete(targetId);
  return true;
}

/** Helper: 更新所有 items 和 values 的 isValid 字段 */
function recalcValidity(state: UtilityState) {
  // 先把所有 items 标为 false
  state.items.forEach((u) => {
    u.isValid = false;
  });
  // 计算 items 的有效性
  state.items.forEach((u) => {
    u.isValid = checkRuleValidity(state.items, u.id, new Set());
  });
  // 收集所有合法的 ruleId
  const validRuleIds = new Set(
    state.items.filter((u) => u.isValid).map((u) => u.id)
  );
  // 依次修正 values
  state.values.forEach((v) => {
    v.isValid = !!(v.ruleId && validRuleIds.has(v.ruleId));
  });
}

const utilitySlice = createSlice({
  name: 'utility',
  initialState,
  reducers: {
    /** 添加一条新规则，默认 isValid=false */
    addUtility(state) {
      const newItem: UtilityItem = {
        id: uuidv4(),
        alias: '',
        type: '',
        params: [],
        isValid: false,
      };
      state.items.push(newItem);
      recalcValidity(state);
    },
    /**
     * 删除一条规则
     *
     * 修复逻辑：
     *  1) 先遍历所有剩余 rules，把所有 params 中等于 removedId 的位置置空 ""。
     *  2) 再遍历所有的 values，把引用 removedId 的 ruleId 置空 ""。
     *  3) 最后把该规则真正从 items 中删掉，并调用 recalcValidity。
     */
    removeUtility(state, action: PayloadAction<string>) {
      const removedId = action.payload;

      // 步骤1：清理其他规则对 removedId 的引用
      state.items.forEach((item) => {
        if (!item.type) return;
        const def = UTILITY_RULES[item.type];
        def.params.forEach((ptype, idx) => {
          if (ptype === 'Rule' && item.params[idx] === removedId) {
            item.params[idx] = '';
          }
        });
      });

      // 步骤2：清理所有 “效用值” 对 removedId 的引用
      state.values.forEach((v) => {
        if (v.ruleId === removedId) {
          v.ruleId = '';
        }
      });

      // 步骤3：从 items 中移除本条规则
      state.items = state.items.filter((u) => u.id !== removedId);

      recalcValidity(state);
    },
    /**
     * 设置别名，不影响 isValid 本身
     */
    setUtilityAlias(
      state,
      action: PayloadAction<{ id: string; alias: string }>
    ) {
      const { id, alias } = action.payload;
      const item = state.items.find((u) => u.id === id);
      if (item) {
        item.alias = alias;
      }
      // 别名改变不直接影响有效性，不需 recalcValidity
    },
    /**
     * 设置规则类型后，需要重置 params 数组，并重新计算 isValid
     */
    setUtilityType(
      state,
      action: PayloadAction<{ id: string; type: UtilityRuleType }>
    ) {
      const { id, type } = action.payload;
      const item = state.items.find((u) => u.id === id);
      if (!item) return;
      item.type = type;
      const def = UTILITY_RULES[type];
      item.params = def.params.map((ptype) =>
        ptype === 'Number' ? 0 : ''
      );
      recalcValidity(state);
    },
    /**
     * 设置某条规则的参数
     * 如果参数类型是 Number 且小于 0，则强制置 0
     */
    setUtilityParam(
      state,
      action: PayloadAction<{
        id: string;
        index: number;
        value: UtilityParamValue;
      }>
    ) {
      const { id, index, value } = action.payload;
      const item = state.items.find((u) => u.id === id);
      if (!item) return;
      if (index < 0 || index >= item.params.length) return;
      if (typeof value === 'number' && value < 0) {
        item.params[index] = 0;
      } else {
        item.params[index] = value;
      }
      recalcValidity(state);
    },
    /** 添加一条新效用值，初始 isValid=false */
    addValue(state) {
      const newVal: ValueDefinition = {
        id: uuidv4(),
        ruleId: '',
        value: 0,
        isValid: false,
      };
      state.values.push(newVal);
      recalcValidity(state);
    },
    /** 删除一条效用值 */
    removeValue(state, action: PayloadAction<string>) {
      state.values = state.values.filter((v) => v.id !== action.payload);
      recalcValidity(state);
    },
    /**
     * 设置某条效用值引用的 ruleId
     */
    setValueRule(
      state,
      action: PayloadAction<{ id: string; ruleId: string }>
    ) {
      const { id, ruleId } = action.payload;
      const valDef = state.values.find((v) => v.id === id);
      if (valDef) {
        valDef.ruleId = ruleId;
      }
      recalcValidity(state);
    },
    /**
     * 设置某条效用值的数字，可为正负整数
     */
    setValueNumber(
      state,
      action: PayloadAction<{ id: string; value: number }>
    ) {
      const { id, value } = action.payload;
      const valDef = state.values.find((v) => v.id === id);
      if (valDef) {
        valDef.value = value;
      }
      // 数值改动本身不影响 isValid，但仍然 recalcValidity 保持一致
      recalcValidity(state);
    },
  },
});

export const {
  addUtility,
  removeUtility,
  setUtilityAlias,
  setUtilityType,
  setUtilityParam,
  addValue,
  removeValue,
  setValueRule,
  setValueNumber,
} = utilitySlice.actions;

export const selectUtilities = (state: { utility: UtilityState }) =>
  state.utility.items;
export const selectValues = (state: { utility: UtilityState }) =>
  state.utility.values;

export default utilitySlice.reducer;
