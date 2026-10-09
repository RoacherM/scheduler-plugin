/**
 * Start one ordinary root Session in a Workspace and hand it the task prompt — the same
 * sequence DSH's webhook runtime uses (preset scope → workspace → agent → attach → permission
 * → title → followup), done with `ctx` services only.
 */
import { randomUUID } from 'node:crypto';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * A user-role message. Runs use the `schedule` source, which the chat renders as a "定时任务"
 * trigger card; a chat opened from the task page uses `user`, so it reads like the user typed it.
 */
export function scheduleMessage(text, kind = 'schedule') {
  return deepFreeze({ role: 'user', id: randomUUID(), content: [{ type: 'text', text }], source: { kind } });
}

/** Keep the creation-time reasoning effort for the first request, like a Session started from the UI. */
function installInitialModelSelection(agentCtx, selection) {
  if (selection.reasoningEffort === undefined) return;
  agentCtx.on('agent/request', async ({ agent }, next) => {
    const resolved = await next();
    if (agent.session.requestHeader() !== undefined || resolved.provider !== selection.provider || resolved.model !== selection.model) return resolved;
    return { ...resolved, reasoningEffort: selection.reasoningEffort };
  });
}

/**
 * @returns startSession({ workspace, title, text, kind?, model?, agentPreset?, permissionPreset?, signal? }) → { sessionId }
 */
export function createSessionRunner(ctx) {
  return async function startSession({ workspace, title, text, kind, model, agentPreset, permissionPreset, signal }) {
    const permission = permissionPreset || ctx.permissionPresets.catalog().defaultPreset;
    ctx.permissionPresets.resolve(permission);
    const preset = await ctx.agentPresets.resolve(agentPreset || undefined);
    const scope = await ctx.agentPresets.acquireScope(preset.id);
    try {
      const space = await ctx.workspaceRegistry.create(workspace);
      // A task's own model wins; otherwise the run follows DSH's default at the moment it starts.
      const selection = model?.provider && model?.model
        ? { provider: model.provider, model: model.model, ...(model.reasoningEffort ? { reasoningEffort: model.reasoningEffort } : {}) }
        : { ...ctx.agentDefaultModel.currentSelection() };
      const sessionId = randomUUID();
      const handle = await ctx.agents.create({
        sessionId, signal,
        meta: { cwd: space.path, agentPreset: preset.id },
        agentOptions: { provider: selection.provider, model: selection.model },
        setup: async (agentCtx) => {
          await ctx.agentPresets.mount(agentCtx, preset.id);
          installInitialModelSelection(agentCtx, selection);
        },
      });
      let attached = false;
      try {
        await space.attachSession(sessionId);
        attached = true;
        ctx.permissionPresets.set(handle.agent.session, permission);
        ctx.get('sessionTitle')?.rename(handle.agent.session, title);
        handle.agent.followup(scheduleMessage(text, kind));
      } catch (error) {
        if (attached) await space.detachSession(sessionId).catch(() => {});
        await handle.dispose().catch(() => {});
        throw error;
      }
      return { sessionId };
    } finally {
      await scope[Symbol.asyncDispose]?.();
    }
  };
}
