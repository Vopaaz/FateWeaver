// src/fateweaver/store/actionConfigSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  MastermindActionId,
  ALL_MASTERMIND_ACTIONS,
  ProtagonistActionId,
  ALL_PROTAGONIST_ACTIONS,
} from '../constants/actions';
import {
  LocationId,
  CharacterId,
  ALL_LOCATIONS,
} from '../constants/board';
import { addCharacter, removeCharacter } from './boardSlice';
import type { RootState } from './store';

interface ActionConfigState {
  mastermindConfig: Record<MastermindActionId, number>;
  protagonistConfig: Record<ProtagonistActionId, number>;
  mastermindScope: Record<MastermindActionId, Array<LocationId | CharacterId>>;
  protagonistScope: Record<ProtagonistActionId, Array<LocationId | CharacterId>>;
}

// Initial counts for 剧作家
const initialMastermindConfig: Record<MastermindActionId, number> =
  ALL_MASTERMIND_ACTIONS.reduce((acc, id) => {
    acc[id] = id === 'GainParanoia' ? 2 : 1;
    return acc;
  }, {} as Record<MastermindActionId, number>);

// Initial counts for 主人公
const initialProtagonistConfig: Record<ProtagonistActionId, number> =
  ALL_PROTAGONIST_ACTIONS.reduce((acc, id) => {
    acc[id] = id === 'ForbidIntrigue' ? 1 : 3;
    return acc;
  }, {} as Record<ProtagonistActionId, number>);

// Initial scopes: 剧作家 全部地点
const initialScopeMastermind: Record<
  MastermindActionId,
  Array<LocationId | CharacterId>
> = ALL_MASTERMIND_ACTIONS.reduce((acc, id) => {
  acc[id] = [...ALL_LOCATIONS];
  return acc;
}, {} as Record<MastermindActionId, Array<LocationId | CharacterId>>);

// Initial scopes: 主人公 只有 “禁止密谋” 选中全部地点，其它行动地点列为空
const initialScopeProtagonist: Record<
  ProtagonistActionId,
  Array<LocationId | CharacterId>
> = ALL_PROTAGONIST_ACTIONS.reduce((acc, id) => {
  acc[id] = id === 'ForbidIntrigue' ? [...ALL_LOCATIONS] : [];
  return acc;
}, {} as Record<ProtagonistActionId, Array<LocationId | CharacterId>>);

const initialState: ActionConfigState = {
  mastermindConfig: initialMastermindConfig,
  protagonistConfig: initialProtagonistConfig,
  mastermindScope: initialScopeMastermind,
  protagonistScope: initialScopeProtagonist,
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
    setMastermindScope(
      state,
      action: PayloadAction<{
        actionId: MastermindActionId;
        targets: Array<LocationId | CharacterId>;
      }>
    ) {
      const { actionId, targets } = action.payload;
      state.mastermindScope[actionId] = targets;
    },
    setProtagonistScope(
      state,
      action: PayloadAction<{
        actionId: ProtagonistActionId;
        targets: Array<LocationId | CharacterId>;
      }>
    ) {
      const { actionId, targets } = action.payload;
      state.protagonistScope[actionId] = targets;
    },
  },
  extraReducers: builder => {
    // When a character is added, include it in all scopes by default
    builder.addCase(addCharacter, (state, action) => {
      const charId = action.payload.characterId;
      ALL_MASTERMIND_ACTIONS.forEach(id => {
        if (!state.mastermindScope[id].includes(charId)) {
          state.mastermindScope[id].push(charId);
        }
      });
      ALL_PROTAGONIST_ACTIONS.forEach(id => {
        if (!state.protagonistScope[id].includes(charId)) {
          state.protagonistScope[id].push(charId);
        }
      });
    });
    // When a character is removed, remove it from all scopes
    builder.addCase(removeCharacter, (state, action) => {
      const removed = action.payload.characterId;
      ALL_MASTERMIND_ACTIONS.forEach(id => {
        state.mastermindScope[id] = state.mastermindScope[id].filter(
          t => t !== removed
        );
      });
      ALL_PROTAGONIST_ACTIONS.forEach(id => {
        state.protagonistScope[id] = state.protagonistScope[id].filter(
          t => t !== removed
        );
      });
    });
  },
});

export const {
  toggleMastermindAction,
  setGainParanoiaCount,
  setProtagonistActionCount,
  setMastermindScope,
  setProtagonistScope,
} = actionConfigSlice.actions;

export const selectMastermindConfig = (state: RootState) =>
  state.actionConfig.mastermindConfig;
export const selectProtagonistConfig = (state: RootState) =>
  state.actionConfig.protagonistConfig;
export const selectMastermindScope = (state: RootState) =>
  state.actionConfig.mastermindScope;
export const selectProtagonistScope = (state: RootState) =>
  state.actionConfig.protagonistScope;

export default actionConfigSlice.reducer;
