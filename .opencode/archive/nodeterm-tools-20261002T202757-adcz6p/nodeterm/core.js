import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"

export const DEFAULT_CANVAS_CLI = "/Users/zach/Library/Application Support/node-terminal/canvas-control/nodeterm.sh"
export const DEFAULT_CONTEXT_CLI = "/Users/zach/Library/Application Support/node-terminal/context-links/context.sh"
export const DEFAULT_TIMEOUTS = { fast: 30000, open: 180000, context: 60000 }

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024

export function resolveCanvasCLI(env = process.env) {
  const fromEnv = env.NODETERM_CANVAS_CONTROL_CLI
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : DEFAULT_CANVAS_CLI
}

export function resolveContextCLI(env = process.env) {
  const fromEnv = env.NODETERM_CONTEXT_LINK_CLI
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : DEFAULT_CONTEXT_CLI
}

const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/

export function validateRequestId(id) {
  if (typeof id !== "string") {
    return { ok: false, reason: "request id must be a string" }
  }
  if (id.length < 1 || id.length > 64) {
    return { ok: false, reason: "request id must be 1-64 characters" }
  }
  if (!REQUEST_ID_RE.test(id)) {
    return { ok: false, reason: "request id must start with a letter or digit and contain only letters, digits, '.', '_', ':', '-'" }
  }
  return { ok: true }
}

export function generateRequestId(prefix = "nt") {
  return `${prefix}-${randomUUID()}`
}

export async function runCLI({ cli, args, timeoutMs = 30000, env = process.env, cwd }) {
  const argv = ["sh", cli, ...args]
  return await new Promise((resolve) => {
    let child
    try {
      child = spawn(argv[0], argv.slice(1), {
        env,
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      })
    } catch (err) {
      resolve({
        ok: false,
        code: null,
        stdout: "",
        stderr: String((err && err.message) || err),
        timedOut: false,
        spawnError: String((err && err.message) || err),
      })
      return
    }
    const out = { s: "" }
    const errAcc = { s: "" }
    let outTruncated = false
    let errTruncated = false
    let settled = false
    let timedOut = false
    const cap = (chunk, acc) => {
      if (acc.s.length + chunk.length > MAX_OUTPUT_BYTES) {
        acc.s = acc.s + chunk.slice(0, Math.max(0, MAX_OUTPUT_BYTES - acc.s.length))
        return true
      }
      acc.s += chunk
      return false
    }
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => {
      if (cap(chunk, out)) outTruncated = true
    })
    child.stderr.on("data", (chunk) => {
      if (cap(chunk, errAcc)) errTruncated = true
    })
    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill("SIGTERM")
      } catch {}
    }, timeoutMs)
    const finish = (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      let stderr = errAcc.s
      if (errTruncated || outTruncated) {
        stderr += (stderr ? "\n" : "") + "[output truncated at 10 MiB]"
      }
      resolve({
        ok: code === 0 && !timedOut,
        code,
        stdout: out.s,
        stderr,
        timedOut,
        spawnError: null,
      })
    }
    child.on("error", (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const message = String((err && err.message) || err)
      resolve({
        ok: false,
        code: null,
        stdout: out.s,
        stderr: errAcc.s + (errAcc.s ? "\n" : "") + message,
        timedOut: false,
        spawnError: message,
      })
    })
    child.on("close", (code) => finish(code))
  })
}

function flagValue(flag, value) {
  if (typeof value === "string" && value.startsWith("-")) {
    return [`${flag}=${value}`]
  }
  return [flag, value]
}

function collapseList(value) {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined && v !== null && v !== "").join(",")
  if (typeof value === "string") return value
  return null
}

function pushDefinedArgs(tail, opts, spec) {
  for (const entry of spec) {
    const [flag, key] = entry
    const value = opts[key]
    if (value === undefined || value === null || value === "") continue
    tail.push(...flagValue(flag, String(value)))
  }
}

export function listArgs() {
  return ["list"]
}

export function openAgentArgs({
  agent,
  cwd,
  promptFile,
  prompt,
  model,
  requestId,
  group,
  after,
  afterSuccess,
  runNow,
  dryRun,
  issue,
}) {
  const tail = ["open-agent"]
  const hasPromptFile = typeof promptFile === "string" && promptFile.length > 0
  const hasPrompt = typeof prompt === "string" && prompt.length > 0
  pushDefinedArgs(tail, { agent, cwd, model, requestId, group }, [
    ["--agent", "agent"],
    ["--cwd", "cwd"],
    ["--model", "model"],
    ["--request-id", "requestId"],
    ["--group", "group"],
  ])
  if (hasPromptFile || hasPrompt) {
    if (hasPromptFile) {
      tail.push(...flagValue("--prompt-file", promptFile))
    } else {
      tail.push(...flagValue("--prompt", prompt))
    }
  }
  const afterList = collapseList(after)
  if (afterList) tail.push(...flagValue("--after", afterList))
  const afterSuccessList = collapseList(afterSuccess)
  if (afterSuccessList) tail.push(...flagValue("--after-success", afterSuccessList))
  if (issue) tail.push(...flagValue("--issue", issue))
  if (dryRun === true) tail.push("--dry-run")
  if (runNow === true) tail.push("--run-now")
  return tail
}

export function renameArgs({ node, title }) {
  return ["rename", "--node", node, "--title", title]
}

export function linkArgs({ to, from }) {
  const tail = ["link", "--to", collapseList(to)]
  if (from) tail.push("--from", from)
  return tail
}

export function sendArgs({ node, text }) {
  return ["send", "--node", node, "--text", text]
}

export function replyArgs({ node, text }) {
  return ["reply", "--node", node, "--text", text]
}

export function reportOutcomeArgs({ outcome, note }) {
  if (outcome !== "succeeded" && outcome !== "failed") {
    throw new Error(`report-outcome outcome must be "succeeded" or "failed", got ${JSON.stringify(outcome)}`)
  }
  const tail = ["report-outcome", "--outcome", outcome]
  if (typeof note === "string" && note.length > 0) {
    tail.push("--note", note)
  }
  return tail
}

export function runArgs({ node }) {
  return ["run", "--node", node]
}

export function notifyArgs({ node }) {
  return ["notify", "--node", node]
}

export function contextArgs({ mode, node, lines }) {
  if (mode === "list") return ["list"]
  if (mode === "summary") {
    const tail = ["summary", "--node", node]
    if (typeof lines === "number" && Number.isFinite(lines)) {
      tail.push("-n", String(Math.trunc(lines)))
    }
    return tail
  }
  if (mode === "transcript") return ["transcript", "--node", node]
  if (mode === "terminal") return ["terminal", "--node", node]
  throw new Error(`unknown context mode ${JSON.stringify(mode)}`)
}

export const NODE_ID_RE = /term-[a-z0-9]+-[0-9a-f]+/gi

const REQUEST_ID_STATUSES = [
  "request-id-conflict",
  "request-id-invalid",
  "request-id-unsupported",
  "request-in-flight",
  "request-outcome-unknown",
]

const QUEUED_RE = /^queued:\s*(true|false)/im
const STARTED_RE = /^started:\s*(true|false)/im
const IDS_RE = /^(deliveredIds|startedIds|queuedIds):[ \t]*\[?(.*?)\]?$/im
const REPLAYED_RE = /^replayed:/im
const REQUEST_ID_RE_CAPTURE = /request id:\s*([A-Za-z0-9._:-]+)/i

function combinedText(res) {
  const out = typeof res.stdout === "string" ? res.stdout : ""
  const err = typeof res.stderr === "string" ? res.stderr : ""
  return `${out}\n${err}`
}

export function parseCreationReply(res) {
  const raw = res
  const failed = !!res.timedOut || !!res.spawnError || res.code !== 0
  const text = combinedText(res)
  const warnings = []
  const replayed = REPLAYED_RE.test(text)
  let recognized = false
  const queuedMatch = text.match(QUEUED_RE)
  const startedMatch = text.match(STARTED_RE)
  let queued = null
  let started = null
  if (queuedMatch) {
    queued = queuedMatch[1] === "true"
    recognized = true
  }
  if (startedMatch) {
    started = startedMatch[1] === "true"
    recognized = true
  }
  const deliveredIds = []
  const startedIds = []
  const queuedIds = []
  const idsMatch = text.match(IDS_RE)
  if (idsMatch) recognized = true
  const idsRe = new RegExp(IDS_RE.source, "gim")
  let idsMatchAll
  while ((idsMatchAll = idsRe.exec(text)) !== null) {
    const target =
      idsMatchAll[1] === "deliveredIds" ? deliveredIds : idsMatchAll[1] === "startedIds" ? startedIds : queuedIds
    for (const candidate of idsMatchAll[2].split(/[\s,]+/)) {
      if (candidate && !target.includes(candidate)) target.push(candidate)
    }
  }
  const requestIdMatch = text.match(REQUEST_ID_RE_CAPTURE)
  if (requestIdMatch) recognized = true
  let requestIdStatus = null
  for (const status of REQUEST_ID_STATUSES) {
    if (text.includes(status)) {
      requestIdStatus = status
      break
    }
  }
  if (requestIdStatus) recognized = true
  if (replayed) recognized = true
  const nodeMatches = text.match(NODE_ID_RE) || []
  const distinctNodes = Array.from(new Set(nodeMatches.map((m) => m.toLowerCase())))
  let nodeId = null
  let nodeIdAmbiguous = false
  if (distinctNodes.length === 1) {
    nodeId = distinctNodes[0]
  } else if (distinctNodes.length > 1) {
    nodeIdAmbiguous = true
    warnings.push(`multiple node ids in reply: ${distinctNodes.join(", ")}`)
  }
  const state = failed ? "failed" : replayed ? "replayed" : "succeeded"
  if (!recognized && !failed) {
    warnings.push("unrecognized reply format; raw output preserved")
  }
  return {
    state,
    replayed,
    queued,
    started,
    deliveredIds,
    startedIds,
    queuedIds,
    nodeId,
    nodeIdAmbiguous,
    requestId: requestIdMatch ? requestIdMatch[1] : null,
    requestIdStatus,
    recognized,
    warnings,
    raw,
  }
}

export const MESSAGE_OUTCOMES = {
  expired: "retryable",
  rateLimited: "retryable",
  queueFull: "retryable",
  targetBusy: "retryable",
  targetNotIdleUnknown: "retryable",
  targetStatusStale: "retryable",
  targetPaneUnreadable: "retryable",
  delivered: "final",
  queued: "final",
  stalled: "final",
  deliveredToReplacedTarget: "final",
  targetStatusUnverified: "final",
  targetHookScriptStale: "final",
  targetNotAgentPane: "final",
  targetNotPasteAware: "final",
  targetGone: "final",
  notPermitted: "final",
}

const KNOWN_OUTCOME_WORDS = Object.keys(MESSAGE_OUTCOMES)

function explicitOutcomeToken(text) {
  for (const line of text.split(/\r?\n/)) {
    if (!/outcome/i.test(line)) continue
    const match = line.match(/outcome[:\s`"']*([a-zA-Z]+)/i)
    if (match) return match[1]
  }
  return null
}

function standaloneOutcomeToken(text) {
  const re = /(?::\s+|- )([A-Za-z][A-Za-z0-9]*)/g
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const lineStart = trimmed.match(/^([A-Za-z][A-Za-z0-9]*)/)
    const candidates = []
    if (lineStart) candidates.push(lineStart[1])
    let match
    re.lastIndex = 0
    while ((match = re.exec(trimmed)) !== null) {
      candidates.push(match[1])
    }
    for (const candidate of candidates) {
      if (KNOWN_OUTCOME_WORDS.includes(candidate)) return candidate
    }
  }
  return null
}

export function parseMessageReply(res) {
  const raw = res
  const failed = !!res.timedOut || !!res.spawnError || res.code !== 0
  const text = combinedText(res)
  const matched = KNOWN_OUTCOME_WORDS.filter((word) =>
    new RegExp(`(^|[^A-Za-z])${word}([^A-Za-z]|$)`, "m").test(text),
  )
  const warnings = []
  let outcome = null
  const explicit = explicitOutcomeToken(text)
  if (explicit) {
    if (KNOWN_OUTCOME_WORDS.includes(explicit)) {
      outcome = explicit
    } else {
      warnings.push(`explicit outcome token ${JSON.stringify(explicit)} is not a known outcome`)
    }
  }
  if (!outcome) {
    outcome = standaloneOutcomeToken(text)
  }
  if (!outcome && matched.length > 1) {
    warnings.push(`multiple distinct outcome tokens in reply: ${matched.join(", ")}`)
  }
  if (!outcome && matched.length === 0 && !explicit) {
    warnings.push("no known messaging outcome found in reply; raw output preserved")
  }
  return {
    state: failed ? "failed" : "succeeded",
    outcome,
    retryable: outcome ? MESSAGE_OUTCOMES[outcome] : null,
    matched,
    warnings,
    raw,
  }
}
