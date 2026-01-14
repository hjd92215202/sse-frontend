import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    sessions: [] as any[],
    currentQuery: '',
    loading: false,
  }),
});