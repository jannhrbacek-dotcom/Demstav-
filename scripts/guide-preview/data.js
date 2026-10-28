import { fixtureFor, records } from "./fixtures";
const noop = () => {};
export const useCached = path => ({ data: fixtureFor(path), loading: false, fromCache: false, error: null, reload: noop, setData: noop });
export const mergedRecords = (items = records) => items.map(record => ({ record, state: record.status, server: record }));
export const currentLocal = () => ({ records: {}, queue: [] });
