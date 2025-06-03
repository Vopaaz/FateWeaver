// src/store/resultSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';
import {
  MastermindStatEntry,
  ProtagonistStatEntry,
} from './computeSlice';

export interface ComputeResultState {
  mastermindStats: Record<string, MastermindStatEntry> | null;
  protagonistStats: Record<string, ProtagonistStatEntry> | null;
}

const initialState: ComputeResultState = {
  mastermindStats: null,
  protagonistStats: null,
};

const resultSlice = createSlice({
  name: 'result',
  initialState,
  reducers: {
    setFinalResult(
      state,
      action: PayloadAction<{
        mastermindStats: Record<string, MastermindStatEntry>;
        protagonistStats: Record<string, ProtagonistStatEntry>;
      }>
    ) {
      state.mastermindStats = action.payload.mastermindStats;
      state.protagonistStats = action.payload.protagonistStats;
    },
    clearFinalResult(state) {
      state.mastermindStats = null;
      state.protagonistStats = null;
    },
  },
});

export const { setFinalResult, clearFinalResult } = resultSlice.actions;

export const selectFinalMastermindStats = (state: RootState) =>
  state.result.mastermindStats;
export const selectFinalProtagonistStats = (state: RootState) =>
  state.result.protagonistStats;

export default resultSlice.reducer;
