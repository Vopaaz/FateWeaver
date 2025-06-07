// src/store/boardSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CharacterId, LocationId, ALL_CHARACTERS } from '../constants/board';

export interface CharacterStats {
  paranoia: number;
  goodwill: number;
  intrigue: number;
  alive: boolean;
}
export interface LocationStats {
  characters: CharacterId[];
  intrigue: number;
}
export interface BoardState {
  locations: Record<LocationId, LocationStats>;
  characterStats: Record<CharacterId, CharacterStats>;
}

const initialCharacterStats: Record<CharacterId, CharacterStats> =
  ALL_CHARACTERS.reduce(
    (acc, id) => ({
      ...acc,
      [id]: { paranoia: 0, goodwill: 0, intrigue: 0, alive: true },
    }),
    {} as Record<CharacterId, CharacterStats>
  );

const initialState: BoardState = {
  locations: {
    Hospital: { characters: [], intrigue: 0 },
    Shrine: { characters: [], intrigue: 0 },
    City: { characters: [], intrigue: 0 },
    School: { characters: [], intrigue: 0 },
  },
  characterStats: initialCharacterStats,
};

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    addCharacter(
      state,
      action: PayloadAction<{
        locationId: LocationId;
        characterId: CharacterId;
      }>
    ) {
      const { locationId, characterId } = action.payload;
      if (!state.locations[locationId].characters.includes(characterId)) {
        state.locations[locationId].characters.push(characterId);
      }
    },
    removeCharacter(
      state,
      action: PayloadAction<{
        locationId: LocationId;
        characterId: CharacterId;
      }>
    ) {
      const { locationId, characterId } = action.payload;
      state.locations[locationId].characters = state.locations[
        locationId
      ].characters.filter((id) => id !== characterId);
    },
    moveCharacter(
      state,
      action: PayloadAction<{
        sourceLocationId: LocationId;
        destinationLocationId: LocationId;
        sourceIndex: number;
        destinationIndex: number;
      }>
    ) {
      const {
        sourceLocationId,
        destinationLocationId,
        sourceIndex,
        destinationIndex,
      } = action.payload;
      const [moved] = state.locations[sourceLocationId].characters.splice(
        sourceIndex,
        1
      );
      state.locations[destinationLocationId].characters.splice(
        destinationIndex,
        0,
        moved
      );
    },
    setCharacterStat(
      state,
      action: PayloadAction<{
        characterId: CharacterId;
        stat: keyof Omit<CharacterStats, 'alive'>;
        value: number;
      }>
    ) {
      const { characterId, stat, value } = action.payload;
      state.characterStats[characterId][stat] = Math.max(0, value);
    },
    setCharacterAlive(
      state,
      action: PayloadAction<{ characterId: CharacterId; alive: boolean }>
    ) {
      const { characterId, alive } = action.payload;
      state.characterStats[characterId].alive = alive;
    },
    setLocationIntrigue(
      state,
      action: PayloadAction<{ locationId: LocationId; value: number }>
    ) {
      const { locationId, value } = action.payload;
      state.locations[locationId].intrigue = Math.max(0, value);
    },
    incrementLocationIntrigue(
      state,
      action: PayloadAction<{ locationId: LocationId }>
    ) {
      const { locationId } = action.payload;
      state.locations[locationId].intrigue++;
    },
    decrementLocationIntrigue(
      state,
      action: PayloadAction<{ locationId: LocationId }>
    ) {
      const { locationId } = action.payload;
      state.locations[locationId].intrigue = Math.max(
        0,
        state.locations[locationId].intrigue - 1
      );
    },
    setBoardState(state, action: PayloadAction<BoardState>) {
      return action.payload;
    },
  },
});

export const {
  addCharacter,
  removeCharacter,
  moveCharacter,
  setCharacterStat,
  setCharacterAlive,
  setLocationIntrigue,
  incrementLocationIntrigue,
  decrementLocationIntrigue,
  setBoardState,
} = boardSlice.actions;
export default boardSlice.reducer;
