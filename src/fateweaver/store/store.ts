import { configureStore } from '@reduxjs/toolkit';
import boardReducer from './boardSlice';
import actionConfigReducer from './actionConfigSlice';
import computeReducer from './computeSlice';
import utilityReducer from './utilitySlice';

export const store = configureStore({
  reducer: {
    board: boardReducer,
    actionConfig: actionConfigReducer,
    compute: computeReducer,
    utility: utilityReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;