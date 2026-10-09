/**
 * Tasks and their run history in one JSON file (atomic writes, one FIFO for every mutation).
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const MAX_RUNS = 50;

/** `message` is Chinese (what the agent sees); `en` is shown on an English task page. */
export class TaskError extends Error {
  constructor(message, status = 400, en) { super(message); this.status = status; this.en = en ?? message; }
}

export const defaultDataDir = () => process.env.DSH_SCHEDULER_DIR ?? join(homedir(), '.dsh', 'plugin-data', 'scheduler');
export const newId = (prefix) => `${prefix}-${randomBytes(5).toString('hex')}`;

export function createStore({ dir = defaultDataDir() } = {}) {
  const file = join(dir, 'tasks.json');
  let cache;
  let queue = Promise.resolve();

  async function load() {
    if (cache !== undefined) return cache;
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8'));
      cache = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    } catch (error) {
      if (error?.code !== 'ENOENT') throw new TaskError(`无法读取 ${file}：${error.message}`, 500, `Cannot read ${file}: ${error.message}`);
      cache = [];
    }
    return cache;
  }

  async function persist(list) {
    await mkdir(dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`;
    await writeFile(temp, JSON.stringify({ version: 1, tasks: list }, null, 2));
    await rename(temp, file);
    cache = list;
  }

  const exclusive = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };

  return {
    file,
    list: async () => structuredClone(await load()),
    get: async (id) => structuredClone((await load()).find((t) => t.id === id)),
    insert: (task) => exclusive(async () => {
      const list = await load();
      await persist([...list, task]);
      return structuredClone(task);
    }),
    /** Read-modify-write one task; `mutate` returns the replacement (or undefined to leave it). */
    update: (id, mutate) => exclusive(async () => {
      const list = await load();
      const current = list.find((t) => t.id === id);
      if (current === undefined) throw new TaskError('任务不存在', 404, 'Task not found');
      const next = await mutate(structuredClone(current));
      if (next === undefined) return structuredClone(current);
      if (next.runs?.length > MAX_RUNS) next.runs = next.runs.slice(-MAX_RUNS);
      await persist(list.map((t) => (t.id === id ? next : t)));
      return structuredClone(next);
    }),
    remove: (id) => exclusive(async () => {
      const list = await load();
      if (!list.some((t) => t.id === id)) return false;
      await persist(list.filter((t) => t.id !== id));
      return true;
    }),
  };
}
