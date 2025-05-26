import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface BoardState {
  boxes: Record<string, string[]>;
}

const initialState: BoardState = {
  boxes: {
    hospital: [],
    shrine: [],
    city: [],
    school: [],
  },
};

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<{ boxId: string; itemId: string }>) {
      const { boxId, itemId } = action.payload;
      if (!state.boxes[boxId].includes(itemId)) {
        state.boxes[boxId].push(itemId);
      }
    },
    removeItem(state, action: PayloadAction<{ boxId: string; itemId: string }>) {
      const { boxId, itemId } = action.payload;
      state.boxes[boxId] = state.boxes[boxId].filter((id) => id !== itemId);
    },
    moveItem(
      state,
      action: PayloadAction<{
        sourceBoxId: string;
        destinationBoxId: string;
        sourceIndex: number;
        destinationIndex: number;
      }>
    ) {
      const { sourceBoxId, destinationBoxId, sourceIndex, destinationIndex } = action.payload;
      const [moved] = state.boxes[sourceBoxId].splice(sourceIndex, 1);
      state.boxes[destinationBoxId].splice(destinationIndex, 0, moved);
    },
  },
});

export const { addItem, removeItem, moveItem } = boardSlice.actions;
export default boardSlice.reducer;