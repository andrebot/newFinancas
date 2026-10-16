import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import backendApi from './api/backendApi';
import { sessionEnded } from './api/baseQuery';
import {
  initialShellState, shellReducer, type ThunkExtra,
} from './shell/shellState';

// The page's one Redux store (S1, OQ-124, OQ-156): the API client's cache and
// the App Shell's state. The page's surroundings — the API environment and
// the shell's storage — reach thunks and the base query as the thunk extra
// argument, so tests build the same store over fakes.

/**
 * Builds the store.
 *
 * @param extra - The API client's and the shell's surroundings.
 * @returns The store; signed in when a refresh token survives from before.
 */
export const createAppStore = (extra: ThunkExtra) => {
  // A session that ends — the API gave up on it, the user signed out, another
  // tab did — forgets this tab's tokens and drops every cached answer: the
  // next user must not see them.
  const sessionCleanup = createListenerMiddleware({ extra });
  sessionCleanup.startListening({
    actionCreator: sessionEnded,
    effect: (_, listenerApi) => {
      listenerApi.extra.api.tokens.clear();
      listenerApi.dispatch(backendApi.util.resetApiState());
    },
  });

  return configureStore({
    reducer: {
      [backendApi.reducerPath]: backendApi.reducer,
      shell: shellReducer,
    },
    preloadedState: {
      shell: initialShellState(extra.api.tokens.refreshToken() !== undefined),
    },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: extra } })
      .prepend(sessionCleanup.middleware)
      .concat(backendApi.middleware),
  });
};

/** The page's store. */
export type AppStore = ReturnType<typeof createAppStore>;

/** The store's state. */
export type RootState = ReturnType<AppStore['getState']>;

/** The store's dispatch, thunks included. */
export type AppDispatch = AppStore['dispatch'];

/** `useDispatch`, typed for this store. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/** `useSelector`, typed for this store. */
export const useAppSelector = useSelector.withTypes<RootState>();
