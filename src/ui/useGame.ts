import { useSyncExternalStore } from 'react';
import { getState, subscribe, type UIState } from './store';

export function useGame(): UIState {
  return useSyncExternalStore(subscribe, getState);
}
