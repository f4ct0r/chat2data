import { create } from 'zustand';
import {
  ConnectionConfig,
  TabData,
} from '../../shared/types';

export type { TabData, TabType } from '../../shared/types';

export const getDefaultSchemaForDbType = (
  dbType: ConnectionConfig['dbType'],
  database?: string
): string | undefined => {
  switch (dbType) {
    case 'postgres':
      return 'public';
    case 'mssql':
      return 'dbo';
    case 'mysql':
    case 'clickhouse':
      return database;
    case 'sqlite':
      return undefined;
    default:
      return undefined;
  }
};


interface TabState {
  tabs: TabData[];
  activeTabId: string | null;
  addTab: (tab: Omit<TabData, 'id'>) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<TabData>) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useTabStore = create<TabState>((set) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tabData) => {
    const id = generateId();
    const newTab: TabData = { ...tabData, id };
    
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));
    
    return id;
  },

  closeTab: (id) => {
    set((state) => {
      const newTabs = state.tabs.filter(tab => tab.id !== id);
      let newActiveId = state.activeTabId;

      // If we are closing the active tab, we need to pick a new one
      if (state.activeTabId === id) {
        if (newTabs.length > 0) {
          // Select the last tab as the new active tab
          newActiveId = newTabs[newTabs.length - 1].id;
        } else {
          newActiveId = null;
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  updateTab: (id, updates) => {
    set((state) => ({
      tabs: state.tabs.map(tab => 
        tab.id === id ? { ...tab, ...updates } : tab
      )
    }));
  }
}));
