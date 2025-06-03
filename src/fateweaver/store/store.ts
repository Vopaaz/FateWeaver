// src/store/store.ts

import { configureStore } from '@reduxjs/toolkit';
import boardReducer from './boardSlice';
import actionConfigReducer from './actionConfigSlice';
import computeReducer from './computeSlice';
import utilityReducer from './utilitySlice';
// 新增：引入 resultSlice
import resultReducer from './resultSlice';

export const store = configureStore({
  reducer: {
    board: boardReducer,
    actionConfig: actionConfigReducer,
    compute: computeReducer,
    utility: utilityReducer,
    result: resultReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
