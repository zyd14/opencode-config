import fs from "node:fs"
import path from "node:path"
import * as core from "./core.js"
import { getRole, roleKey, rolePrompt } from "./roles.js"

export const MODEL_SELECTION_NOTE =
  "nodeterm --model is passed through; the opencode launcher's honoring of it is not verified — do not assume the session runs this model"

export function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

export function roleTitleExcerpt(task) {
  return collapseWhitespace(task).slice(0, 48).trim()
}

export function modelSelection(requested) {
  if (!requested) return null
  return { requested, forwarded: true, verified: false, note: MODEL_SELECTION_NOTE }
}

function failResult({ role = null, model = null, requestId = null, assignmentPath = null, errors = [], warnings = [] }) {
  return {
    ok: false,
    role,
    model,
    modelSelection: modelSelection(model),
    requestId,
    assignmentPath,
    nodeId: null,
    launch: null,
    steps: [],
    errors,
    warnings,
  }
}

async function callCanvas(args, env, timeoutMs) {
  return core.runCLI({ cli: core.resolveCanvasCLI(env), args, timeoutMs, env })
}

export async function postOpenSetup({
  parsed,
  dryRun = false,
  title = null,
  skipRename = false,
  skipLink = false,
  linkFrom = undefined,
  env = process.env,
  timeoutMs = core.DEFAULT_TIMEOUTS.fast,
}) {
  const steps = []
  const errors = []
  const nodeId = parsed && !parsed.nodeIdAmbiguous ? parsed.nodeId : null
  if (dryRun || !nodeId) {
    return { steps, errors, nodeId }
  }
  if (title && !skipRename) {
    const res = await callCanvas(core.renameArgs({ node: nodeId, title }), env, timeoutMs)
    steps.push({ name: "rename", ok: res.ok, code: res.code, stdout: res.stdout, stderr: res.stderr })
    if (!res.ok) {
      const why = res.timedOut ? "timed out" : res.spawnError ? `could not spawn: ${res.spawnError}` : `exit code ${res.code}`
      errors.push(`rename failed for node ${nodeId} (${why}); the node EXISTS and was not re-opened — recover with the same requestId only`)
    }
  }
  if (!skipLink) {
    const res = await callCanvas(core.linkArgs({ to: [nodeId], from: linkFrom }), env, timeoutMs)
    steps.push({ name: "link", ok: res.ok, code: res.code, stdout: res.stdout, stderr: res.stderr })
    if (!res.ok) {
      const why = res.timedOut ? "timed out" : res.spawnError ? `could not spawn: ${res.spawnError}` : `exit code ${res.code}`
      errors.push(`link failed for node ${nodeId} (${why}); the node EXISTS and was not re-opened — recover with the same requestId only`)
    }
  }
  return { steps, errors, nodeId }
}

export async function launchRole(opts = {}) {
  const o = opts
  if (o.mode !== undefined && o.mode !== null && o.mode !== "") {
    return failResult({
      errors: [
        "unknown option mode; managed open-agent launch only (never open-terminal) — the terminal launch mode was removed; re-invoke without mode",
      ],
    })
  }
  const role = getRole(o.role)
  if (!role) {
    return failResult({
      errors: [
        `unknown role ${JSON.stringify(o.role ?? "")}; known roles: coordinator, planner, implementation owner, reviewer (display names and slugs such as implementation-owner are accepted, case-insensitive)`,
      ],
    })
  }
  const key = roleKey(o.role)
  if (typeof o.task !== "string" || o.task.trim() === "") {
    return failResult({ role: key, model: role.model, errors: ["task is required and must be a non-empty string"] })
  }
  let requestId
  if (o.requestId === undefined || o.requestId === null || o.requestId === "") {
    requestId = core.generateRequestId(`nt-${role.slug}`)
  } else {
    const check = core.validateRequestId(o.requestId)
    if (!check.ok) {
      return failResult({
        role: key,
        model: role.model,
        errors: [`invalid requestId ${JSON.stringify(o.requestId)}: ${check.reason || "expected 1-64 chars of [A-Za-z0-9._:-] starting with a letter or digit"}`],
      })
    }
    requestId = o.requestId
  }
  const env = o.env || process.env
  const baseDir = path.resolve(o.cwd || process.cwd())
  const assignmentRoot = o.assignmentRoot || ".agents/nodeterm/assignments"
  const assignmentPath = path.join(baseDir, assignmentRoot, `${role.slug}-${requestId}.md`)
  const body = `${rolePrompt(key)}\n\n## Current task\n\n${o.task}`
  try {
    fs.mkdirSync(path.dirname(assignmentPath), { recursive: true })
    fs.writeFileSync(assignmentPath, body, "utf8")
  } catch (error) {
    return failResult({
      role: key,
      model: role.model,
      requestId,
      assignmentPath,
      errors: [`failed to write assignment file ${assignmentPath}: ${error.message}`],
    })
  }
  const agent = o.agent || "opencode"
  const openArgs = core.openAgentArgs({
    agent,
    cwd: baseDir,
    promptFile: assignmentPath,
    model: role.model,
    requestId,
    group: o.group,
    after: o.after,
    afterSuccess: o.afterSuccess,
    runNow: o.runNow,
    dryRun: o.dryRun,
  })
  const res = await callCanvas(openArgs, env, o.timeoutMs ?? core.DEFAULT_TIMEOUTS.open)
  const parsed = core.parseCreationReply(res)
  const openOk = parsed.state === "succeeded" || parsed.state === "replayed"
  const steps = [{ name: "open", ok: openOk, code: res.code, stdout: res.stdout, stderr: res.stderr, parsed }]
  const errors = []
  if (!openOk) {
    const why = res.timedOut ? "timed out" : res.spawnError ? `could not spawn: ${res.spawnError}` : `exit code ${res.code}`
    const suffix = parsed.requestIdStatus ? `; request-id status: ${parsed.requestIdStatus}` : ""
    errors.push(`open call failed (${why}, state ${parsed.state})${suffix}; never retried automatically — re-invoke with the SAME requestId only to recover a lost reply`)
  }
  let setup = { steps: [], errors: [], nodeId: null }
  if (openOk) {
    setup = await postOpenSetup({
      parsed,
      dryRun: !!o.dryRun,
      title: `${role.title} — ${roleTitleExcerpt(o.task)}`,
      skipRename: o.skipRename,
      skipLink: o.skipLink,
      linkFrom: o.linkFrom,
      env,
      timeoutMs: o.timeoutMs ?? core.DEFAULT_TIMEOUTS.fast,
    })
  }
  return {
    ok: openOk,
    role: key,
    model: role.model,
    modelSelection: modelSelection(role.model),
    requestId,
    assignmentPath,
    nodeId: setup.nodeId,
    launch: parsed,
    steps: [...steps, ...setup.steps],
    errors: [...errors, ...setup.errors],
    warnings: [],
  }
}
