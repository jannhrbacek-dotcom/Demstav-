import { record, DEMO_NOW } from "./fixtures";
const draft = { loaded: true, value: { record, baseRevision: 1 }, error: null, saving: false, savedAt: DEMO_NOW, clear: async () => {}, flush: async () => {} };
export const useRecordDraft = () => draft;
