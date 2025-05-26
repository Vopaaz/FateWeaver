import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CharacterId, LocationId } from '../constants';

export interface BoardState {
  locations: Record<LocationId, CharacterId[]>;
}

const initialState: BoardState = {
  locations: {
    Hospital: [],
    Shrine: [],
    City: [],
    School: [],
  },
};

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    addCharacter(
      state,
      action: PayloadAction<{ locationId: LocationId; characterId: CharacterId }>
    ) {
      const { locationId, characterId } = action.payload;
      if (!state.locations[locationId].includes(characterId)) {
        state.locations[locationId].push(characterId);
      }
    },
    removeCharacter(
      state,
      action: PayloadAction<{ locationId: LocationId; characterId: CharacterId }>
    ) {
      const { locationId, characterId } = action.payload;
      state.locations[locationId] = state.locations[locationId].filter(
        (id) => id !== characterId
      );
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
      const [moved] = state.locations[sourceLocationId].splice(sourceIndex, 1);
      state.locations[destinationLocationId].splice(destinationIndex, 0, moved);
    },
  },
});

export const { addCharacter, removeCharacter, moveCharacter } = boardSlice.actions;
export default boardSlice.reducer;