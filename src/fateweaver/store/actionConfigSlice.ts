import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  MastermindActionId,
  ALL_MASTERMIND_ACTIONS,
  ProtagonistActionId,
  ALL_PROTAGONIST_ACTIONS,
} from '../constants/actions';
import type { RootState } from './store';

interface ActionConfigState {
  mastermindConfig: Record<MastermindActionId, number>;
  protagonistConfig: Record<ProtagonistActionId, number>;
}

const initialMastermind: Record<MastermindActionId, number> = ALL_MASTERMIND_ACTIONS.reduce(
  (acc, id) => {
    acc[id] = id === 'GainParanoia' ? 2 : 1;
    return acc;
  },
  {} as Record<MastermindActionId, number>
);

const initialProtagonist: Record<ProtagonistActionId, number> = ALL_PROTAGONIST_ACTIONS.reduce(
  (acc, id) => {
    acc[id] = id === 'ForbidIntrigue' ? 1 : 3;
    return acc;
  },
  {} as Record<ProtagonistActionId, number>
);

const initialState: ActionConfigState = {
  mastermindConfig: initialMastermind,
  protagonistConfig: initialProtagonist,
};

const actionConfigSlice = createSlice({
  name: 'actionConfig',
  initialState,
  reducers: {
    toggleMastermindAction(state, action: PayloadAction<MastermindActionId>) {
      const id = action.payload;
      if (id === 'GainParanoia') return;
      state.mastermindConfig[id] = state.mastermindConfig[id] === 1 ? 0 : 1;
    },
    setGainParanoiaCount(state, action: PayloadAction<number>) {
      const count = action.payload;
      state.mastermindConfig['GainParanoia'] = Math.max(0, Math.min(2, count));
    },
    setProtagonistActionCount(
      state,
      action: PayloadAction<{ actionId: ProtagonistActionId; count: number }>
    ) {
      const { actionId, count } = action.payload;
      const max = actionId === 'ForbidIntrigue' ? 1 : 3;
      state.protagonistConfig[actionId] = Math.max(0, Math.min(max, count));
    },
  },
});

export const {
  toggleMastermindAction,
  setGainParanoiaCount,
  setProtagonistActionCount,
} = actionConfigSlice.actions;

export const selectMastermindConfig = (state: RootState) => state.actionConfig.mastermindConfig;
export const selectProtagonistConfig = (state: RootState) => state.actionConfig.protagonistConfig;

export default actionConfigSlice.reducer;
