// src/store/utilitySlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import {
  UtilityRuleType,
  UTILITY_RULES,
} from '../constants/utilityRules';

export type UtilityParamValue = string | number;

export interface UtilityItem {
  id: string;
  alias: string;
  type: UtilityRuleType | '';
  params: UtilityParamValue[];
}

export interface ValueDefinition {
  id: string;
  ruleId: string;
  value: number;
}

interface UtilityState {
  items: UtilityItem[];
  values: ValueDefinition[];
}

const initialState: UtilityState = {
  items: [],
  values: [],
};

const utilitySlice = createSlice({
  name: 'utility',
  initialState,
  reducers: {
    addUtility(state) {
      const newItem: UtilityItem = {
        id: uuidv4(),
        alias: '',
        type: '',
        params: [],
      };
      state.items.push(newItem);
    },
    removeUtility(state, action: PayloadAction<string>) {
      const removedId = action.payload;
      state.items = state.items.filter((u) => u.id !== removedId);
    },
    setUtilityAlias(
      state,
      action: PayloadAction<{ id: string; alias: string }>
    ) {
      const { id, alias } = action.payload;
      const item = state.items.find((u) => u.id === id);
      if (item) {
        item.alias = alias;
      }
    },
    setUtilityType(
      state,
      action: PayloadAction<{ id: string; type: UtilityRuleType }>
    ) {
      const { id, type } = action.payload;
      const item = state.items.find((u) => u.id === id);
      if (!item) return;
      item.type = type;
      const def = UTILITY_RULES[type];
      const newParams: UtilityParamValue[] = def.params.map((ptype) =>
        ptype === 'Number' ? 0 : ''
      );
      item.params = newParams;
    },
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
    },
    addValue(state) {
      const newVal: ValueDefinition = {
        id: uuidv4(),
        ruleId: '',
        value: 0,
      };
      state.values.push(newVal);
    },
    removeValue(state, action: PayloadAction<string>) {
      state.values = state.values.filter((v) => v.id !== action.payload);
    },
    setValueRule(
      state,
      action: PayloadAction<{ id: string; ruleId: string }>
    ) {
      const { id, ruleId } = action.payload;
      const valDef = state.values.find((v) => v.id === id);
      if (valDef) {
        valDef.ruleId = ruleId;
      }
    },
    setValueNumber(
      state,
      action: PayloadAction<{ id: string; value: number }>
    ) {
      const { id, value } = action.payload;
      const valDef = state.values.find((v) => v.id === id);
      if (valDef) {
        valDef.value = value;
      }
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
