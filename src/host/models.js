/**
 * Which models a task may run on: every model of every registered LLM provider, with its
 * reasoning efforts, plus DSH's current default (what a task without its own model uses).
 */
import { TaskError } from './store.js';

const key = (m) => `${m.provider}/${m.id ?? m.model}`;

export function createModelCatalog(ctx, { ttlMs = 30_000 } = {}) {
  let cache;
  let at = 0;
  /** Provider ids with a registered adapter at the last load, even if their model list failed. */
  let providers = new Set();
  /** Providers whose model list could not be read: their models cannot be ruled out. */
  let unlisted = new Set();

  async function load() {
    const llm = ctx.get?.('llm');
    providers = new Set();
    unlisted = new Set();
    if (!llm) return [];
    const models = [];
    for (const provider of llm.listProviders?.() ?? []) {
      providers.add(provider.id);
      let list = [];
      try { list = await llm.listModels(provider.id); } catch { unlisted.add(provider.id); continue; }
      if (list.length === 0) unlisted.add(provider.id);
      for (const m of list) models.push({ provider: m.provider ?? provider.id, providerName: provider.name, id: m.id, name: m.name || m.id });
    }
    // Efforts come from the adapter's exact-model metadata; a slow or failing lookup just leaves them out.
    await Promise.allSettled(models.map(async (m) => {
      const info = await Promise.race([llm.resolveModelInfo(m.provider, m.id), new Promise((_, reject) => setTimeout(reject, 3000))]);
      m.efforts = (info?.reasoning?.efforts ?? []).map((e) => ({ id: String(e.id), name: e.name || String(e.id) }));
      if (info?.reasoning?.defaultEffort) m.defaultEffort = String(info.reasoning.defaultEffort);
    }));
    return models;
  }

  const catalog = {
    async list() {
      if (!cache || Date.now() - at > ttlMs) { cache = await load(); at = Date.now(); }
      return cache;
    },
    defaultSelection() {
      try { return { ...ctx.agentDefaultModel.currentSelection() }; } catch { return undefined; }
    },
    /** What the task page needs: the choices and what "follow the default" currently means. */
    async describe() {
      const models = await catalog.list();
      const def = catalog.defaultSelection();
      return { models, defaultModel: def ? { ...def, name: models.find((m) => key(m) === key(def))?.name ?? def.model } : undefined };
    },
    /**
     * Turn tool/page input into a stored `{ provider, model, reasoningEffort? }`, or null for
     * "follow DSH's default". Accepts "provider/model", a bare model id, or a display name.
     */
    async resolve(input, effort) {
      if (input === undefined) return undefined;
      if (input === null || input === '' || input === 'default') return null;
      const models = await catalog.list();
      const wanted = typeof input === 'object' ? `${input.provider}/${input.model}` : String(input).trim();
      const lower = wanted.toLowerCase();
      const match = models.find((m) => key(m) === wanted)
        ?? models.find((m) => m.id === wanted)
        ?? models.find((m) => m.name.toLowerCase() === lower)
        ?? models.find((m) => m.id.toLowerCase().endsWith(lower) || m.name.toLowerCase().includes(lower));
      if (!match) {
        const names = models.map((m) => `${m.name}（${m.id}）`).join('、');
        throw new TaskError(`找不到模型 ${wanted}。可用：${names || '（没有已注册的模型）'}`, 400, `Unknown model ${wanted}`);
      }
      const selection = { provider: match.provider, model: match.id };
      const reasoning = effort ?? (typeof input === 'object' ? input.reasoningEffort ?? input.reasoning_effort : undefined);
      if (reasoning) {
        const efforts = match.efforts ?? [];
        if (efforts.length && !efforts.some((e) => e.id === reasoning)) {
          throw new TaskError(`${match.name} 不支持思考强度 ${reasoning}，可选：${efforts.map((e) => e.id).join(' / ')}`, 400, `${match.name} does not support effort ${reasoning}`);
        }
        selection.reasoningEffort = String(reasoning);
      }
      return selection;
    },
    /**
     * The model a run should start on, checked against what is registered right now:
     * the task's own model, else DSH's default, else the first model any provider offers.
     * `fallback` says what was wanted and why it was not used. Without an llm service
     * (nothing to check against) the choice passes through unchanged.
     */
    async pickRunnable(pinned) {
      if (!ctx.get?.('llm')) return { selection: pinned };
      cache = await load(); at = Date.now();
      const usable = (sel) => Boolean(sel?.provider && sel?.model) && providers.has(sel.provider)
        && (unlisted.has(sel.provider) || cache.some((m) => key(m) === key(sel)));
      const def = catalog.defaultSelection();
      if (pinned && usable(pinned)) return { selection: pinned };
      if (usable(def)) return { selection: def, ...(pinned ? { fallback: { from: pinned, to: def, reason: 'pinned_missing' } } : {}) };
      const first = cache[0];
      if (!first) {
        const wanted = await catalog.label(pinned ?? def);
        throw new TaskError(`没有可用的模型${wanted ? `（${wanted} 不可用）` : ''}：请在 DSH 设置里配置一个模型`, 500, `No model is available${wanted ? ` (${wanted} is not)` : ''}; configure one in DSH settings`);
      }
      const to = { provider: first.provider, model: first.id };
      return { selection: to, fallback: { from: pinned ?? def, to, reason: pinned ? 'pinned_missing' : 'default_missing' } };
    },
    /** "Claude Opus 5.5 · high", for the agent and the page. */
    async label(selection) {
      if (!selection) return undefined;
      const m = (await catalog.list()).find((x) => key(x) === key(selection));
      return `${m?.name ?? selection.model}${selection.reasoningEffort ? ` · ${selection.reasoningEffort}` : ''}`;
    },
  };
  return catalog;
}
