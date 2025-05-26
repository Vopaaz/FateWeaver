import { configureStore } from '@reduxjs/toolkit';
import boardReducer from './boardSlice';
import actionConfigReducer from './actionConfigSlice';

export const store = configureStore({
  reducer: {
    board: boardReducer,
    actionConfig: actionConfigReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;