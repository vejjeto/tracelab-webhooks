import { create } from "zustand";

export type InspectorTab = "body" | "hmac" | "snippets" | "replay" | "mcp";
export type SnippetLang = "curl" | "typescript" | "python";

interface TraceLabState {
  activeBinId: string;
  selectedRequestId: string | null;
  activeTab: InspectorTab;
  snippetLang: SnippetLang;
  prettyBody: boolean;
  setActiveBinId: (binId: string) => void;
  setSelectedRequestId: (requestId: string | null) => void;
  setActiveTab: (tab: InspectorTab) => void;
  setSnippetLang: (lang: SnippetLang) => void;
  togglePrettyBody: () => void;
}

export const useTraceLabStore = create<TraceLabState>((set) => ({
  activeBinId: "demo-bin",
  selectedRequestId: null,
  activeTab: "body",
  snippetLang: "curl",
  prettyBody: true,
  setActiveBinId: (activeBinId) =>
    set({ activeBinId, selectedRequestId: null }),
  setSelectedRequestId: (selectedRequestId) => set({ selectedRequestId }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSnippetLang: (snippetLang) => set({ snippetLang }),
  togglePrettyBody: () => set((s) => ({ prettyBody: !s.prettyBody })),
}));
