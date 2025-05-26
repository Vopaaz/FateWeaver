import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AppState {
  count: number;
}

const initialState: AppState = {
  count: 0,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    increment(state) {
      state.count += 1;
    },
    decrement(state) {
      state.count -= 1;
    },
    reset(state) {
      state.count = 0;
    },
    setCount(state, action: PayloadAction<number>) {
      state.count = action.payload;
    },
  },
});

export const { increment, decrement, reset, setCount } = appSlice.actions;
export default appSlice.reducer;