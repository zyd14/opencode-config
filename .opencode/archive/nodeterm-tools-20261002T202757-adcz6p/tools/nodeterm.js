import path from "node:path"
import { tool } from "@opencode-ai/plugin"
import * as core from "../nodeterm/core.js"
import * as roles from "../nodeterm/roles.js"
import { launchRole, postOpenSetup, modelSelection, collapseWhitespace } from "../nodeterm/role-launch.js"

const OUTPUT_LIMIT = 16384

const CONTEXT_MODES = ["list", "summary", "transcript", "terminal"]

function truncate(text) {
  const s = String(text ?? "")
  if (s.length <= OUTPUT_LIMIT) return s
  return s.slice(0, OUTPUT_LIMIT) + "\n… [truncated]"
}

function baseMeta(res) {
  return {
    ok: res.ok,
    exitCode: res.code,
    stdout: res.stdout,
    stderr: res.stderr,
    timedOut: res.timedOut,
    spawnError: res.spawnError,
  }
}

function rawBlock(res) {
  const sections = []
  if (res.stdout && res.stdout.trim() !== "") sections.push(`--- stdout (raw) ---\n${truncate(res.stdout)}`)
  if (res.stderr && res.stderr.trim() !== "") sections.push(`--- stderr (raw) ---\n${truncate(res.stderr)}`)
  if (sections.length === 0) sections.push("(no CLI output)")
  return sections.join("\n")
}

function statusLine(verb, res) {
  const bits = []
  if (res.timedOut) bits.push("timed out")
  if (res.spawnError) bits.push(`spawn error: ${res.spawnError}`)
  return `nodeterm ${verb} — exit code ${res.code}${bits.length ? ` (${bits.join(", ")})` : ""}`
}

function failureWhy(res) {
  if (res.timedOut) return "the CLI call timed out"
  if (res.spawnError) return `the CLI could not be spawned: ${res.spawnError}`
  return `the CLI exited with code ${res.code}`
}

function argError(title, message) {
  return {
    title,
    output: `${message}\nNo CLI call was made.`,
    metadata: {
      ok: false,
      exitCode: null,
      stdout: "",
      stderr: "",
      timedOut: false,
      spawnError: null,
      error: message,
    },
  }
}

function creationLines({ parsed, dryRun = false, requestId = null }) {
  const lines = []
  if (requestId) {
    lines.push(
      `requestId: ${requestId} — to retry a lost reply, re-invoke with the SAME requestId; a new id may create a duplicate; this tool never retries on its own.`,
    )
  }
  if (parsed.requestIdStatus) {
    lines.push(`request-id status: ${parsed.requestIdStatus}.`)
  }
  if (parsed.state === "replayed") {
    lines.push("Reply REPLAYED from an earlier identical request (same requestId) — this call created no new node.")
  }
  if (parsed.recognized === false) {
    lines.push("Reply format NOT recognized — no queued/started state is claimed; the raw output below is authoritative.")
  }
  if (parsed.queued === true) {
    lines.push("queued: true — the node exists but its agent has NOT started; do not treat it as running and do not route work to it.")
  } else if (parsed.queued === false) {
    lines.push("queued: false — launch delivery is not pending, but this alone is not proof the agent is running.")
  }
  if (parsed.started === true) {
    lines.push("started: true — reported by the CLI for the launched node(s).")
  }
  if (parsed.nodeId) {
    lines.push(
      parsed.nodeIdAmbiguous
        ? `Reply contains several distinct node ids — ambiguous, none claimed.`
        : `Node id: ${parsed.nodeId}`,
    )
  } else if (dryRun) {
    lines.push("dry-run: no node was created, so no node id is expected.")
  } else {
    lines.push("No node id could be parsed from the reply.")
  }
  if (Array.isArray(parsed.warnings)) {
    for (const warning of parsed.warnings) lines.push(`parse warning: ${warning}`)
  }
  return lines
}

function stepsLine(steps) {
  if (!steps || steps.length === 0) return null
  return `steps: ${steps.map((s) => `${s.name}=${s.ok ? "ok" : "FAILED"}`).join(", ")}`
}

function partialSetupNote(result) {
  if (!result.ok || result.errors.length === 0 || !result.nodeId) return null
  return `PARTIAL SETUP — the node EXISTS (id ${result.nodeId}) and must not be re-opened: re-opening spawns a duplicate. Rename/link problems are described in errors; recover only a lost reply by re-invoking with the SAME requestId.`
}

export const list = tool({
  description:
    "Lists the nodes on the current nodeterm canvas together with the states the CLI actually reports (the `list` verb): ids, kinds, titles, and observed markers such as QUEUED, STARTING, DROPPED or LAST TURN ERRORED. Read-only: it creates nothing and changes nothing. Use it before sending, replying, linking or waiting, to find current node ids and to check whether a station is healthy. Only states printed by the CLI are shown — this tool never infers health or running state.",
  args: {},
  async execute(_args) {
    const res = await core.runCLI({
      cli: core.resolveCanvasCLI(),
      args: core.listArgs(),
      timeoutMs: core.DEFAULT_TIMEOUTS.fast,
    })
    const lines = [statusLine("list", res)]
    lines.push(
      res.ok
        ? "The canvas CLI succeeded; only the states printed below are confirmed."
        : `The canvas CLI failed: ${failureWhy(res)}.`,
    )
    lines.push(rawBlock(res))
    return {
      title: `nodeterm list (exit ${res.code})`,
      output: lines.join("\n"),
      metadata: baseMeta(res),
    }
  },
})

export const launch = tool({
  description:
    "Opens a new nodeterm node as a managed open-agent launch — the ONLY launch path: there is no terminal mode, no shell command construction and no fallback (plain terminal launches can lack the managed messaging identity, so open-terminal is never used for agents). agent defaults to opencode; a supported OpenCode agent profile id may be given. promptFile is required and must be an absolute path: it is the durable brief the new node is told to read first and execute exactly, forwarded as open-agent --prompt-file. model is the REQUESTED model: forwarded via nodeterm --model but its honoring by the opencode launcher is NOT verified — the result surfaces this model-selection uncertainty and never claims the session runs that model. prompt is an optional short instruction used only when promptFile is absent (prefer promptFile; the launch is refused when neither is given). Pass the same requestId to retry a lost reply; a new id may create a duplicate; the tool itself never retries. With dryRun true the open call is validated without creating anything. Optional title renames the node after a successful open and optional link links the new node to the caller — both are non-fatal partial steps: when they fail the node EXISTS and must not be re-opened.",
  args: {
    agent: tool.schema
      .string()
      .default("opencode")
      .describe("Agent id for the managed open-agent launch (default opencode; a supported OpenCode agent profile id may be given)"),
    cwd: tool.schema.string().optional().describe("Working directory for the new node; defaults to this project directory"),
    model: tool.schema
      .string()
      .optional()
      .describe(
        "Requested model as provider/model (e.g. openai/gpt-6.1-sol); forwarded via nodeterm --model but its honoring by the opencode launcher is NOT verified — do not assume the session runs it",
      ),
    promptFile: tool.schema
      .string()
      .describe("Absolute path of the structured brief the new node reads first and executes exactly; forwarded as open-agent --prompt-file (required)"),
    prompt: tool.schema
      .string()
      .optional()
      .describe("Optional short instruction used only when promptFile is absent; prefer promptFile — the launch is refused when neither is given"),
    requestId: tool.schema
      .string()
      .optional()
      .describe("Safe-retry id: re-invoke with the SAME requestId to recover a lost reply; a new id may create a duplicate; generated when omitted"),
    group: tool.schema.string().optional().describe("Group frame id to open the node into"),
    after: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Node ids the launch waits on (nodeterm --after): it starts when those stations finish a turn"),
    afterSuccess: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Node ids that must report success first (nodeterm --after-success)"),
    runNow: tool.schema.boolean().optional().describe("Start immediately even when the project is off screen (nodeterm --run-now)"),
    dryRun: tool.schema.boolean().optional().describe("Validate the open without creating a node (nodeterm --dry-run)"),
    title: tool.schema
      .string()
      .optional()
      .describe("After a successful open, rename the node (non-fatal partial step; failure leaves the node in place)"),
    link: tool.schema
      .boolean()
      .optional()
      .describe("After a successful open, link the new node to the caller (non-fatal partial step)"),
    timeoutMs: tool.schema.number().optional().describe("Timeout in milliseconds for the open call"),
  },
  async execute(args, context) {
    if (args.mode !== undefined && args.mode !== null && args.mode !== "") {
      return argError(
        "nodeterm launch: invalid arguments",
        "unknown option mode; managed open-agent launch only (never open-terminal) — the terminal launch mode was removed; re-invoke without mode",
      )
    }
    const cwd = args.cwd || context?.directory || process.cwd()
    if (!args.promptFile || typeof args.promptFile !== "string" || args.promptFile.trim() === "") {
      return argError(
        "nodeterm launch: invalid arguments",
        "promptFile is required: the absolute path of the structured brief the new node reads first; a short prompt alone is not a substitute",
      )
    }
    if (!path.isAbsolute(args.promptFile)) {
      return argError("nodeterm launch: invalid arguments", `promptFile must be an absolute path, got ${JSON.stringify(args.promptFile)}`)
    }
    let requestId
    if (args.requestId === undefined || args.requestId === null || args.requestId === "") {
      requestId = core.generateRequestId("nt-launch")
    } else {
      const check = core.validateRequestId(args.requestId)
      if (!check.ok) {
        return argError("nodeterm launch: invalid arguments", `invalid requestId ${JSON.stringify(args.requestId)}: ${check.reason || "expected 1-64 chars of [A-Za-z0-9._:-] starting with a letter or digit"}`)
      }
      requestId = args.requestId
    }
    const openArgs = core.openAgentArgs({
      agent: args.agent || "opencode",
      cwd,
      promptFile: args.promptFile,
      prompt: args.prompt,
      model: args.model,
      requestId,
      group: args.group,
      after: args.after,
      afterSuccess: args.afterSuccess,
      runNow: args.runNow,
      dryRun: args.dryRun,
    })
    const modelSel = modelSelection(args.model)
    const res = await core.runCLI({
      cli: core.resolveCanvasCLI(),
      args: openArgs,
      timeoutMs: args.timeoutMs ?? core.DEFAULT_TIMEOUTS.open,
    })
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
        dryRun: !!args.dryRun,
        title: args.title ? collapseWhitespace(args.title) : null,
        skipLink: !args.link,
        env: process.env,
        timeoutMs: args.timeoutMs ?? core.DEFAULT_TIMEOUTS.fast,
      })
    }
    const allSteps = [...steps, ...setup.steps]
    const lines = [statusLine("launch (managed open-agent)", res)]
    if (modelSel) {
      lines.push(`model selection: requested ${modelSel.requested}, forwarded via --model, not verified — ${modelSel.note}`)
    }
    lines.push(...creationLines({ parsed, dryRun: !!args.dryRun, requestId }))
    const stepsSummary = stepsLine(allSteps)
    if (stepsSummary) lines.push(stepsSummary)
    if (openOk && setup.errors.length > 0 && setup.nodeId) {
      lines.push(`PARTIAL SETUP — the node EXISTS (id ${setup.nodeId}) and must not be re-opened: re-opening spawns a duplicate. Only recover a lost reply with the SAME requestId.`)
    }
    for (const error of errors) lines.push(`error: ${error}`)
    for (const error of setup.errors) lines.push(`error: ${error}`)
    lines.push(rawBlock(res))
    return {
      title: `nodeterm launch open-agent (exit ${res.code})`,
      output: lines.join("\n"),
      metadata: {
        ...baseMeta(res),
        parsed,
        steps: allSteps,
        errors: [...errors, ...setup.errors],
        ok: openOk,
        requestId,
        modelSelection: modelSel,
        nodeId: setup.nodeId,
      },
    }
  },
})

export const link = tool({
  description:
    "Creates bidirectional context links between nodeterm nodes (the `link` verb) so each can READ the other's transcript on demand. Links push nothing and are not dependency gates — use them so peers can read each other's work; use --after/--afterSuccess flags on launches for gating. `to` lists the node ids to link; omit `from` to link from the caller's own node. Re-invoking re-attempts the link (linking has no request-id protection), but links push no data, so a repeated attempt changes nothing beyond the edges themselves.",
  args: {
    to: tool.schema
      .array(tool.schema.string())
      .describe("Node ids to link (nodeterm links them bidirectionally), e.g. term-mupz6vu9-fe703c55"),
    from: tool.schema.string().optional().describe("Source node id; defaults to the caller's own node"),
    timeoutMs: tool.schema.number().optional().describe("Timeout in milliseconds for the nodeterm CLI call"),
  },
  async execute(args) {
    const to = (Array.isArray(args.to) ? args.to : []).filter((id) => typeof id === "string" && id.trim() !== "")
    if (to.length === 0) {
      return argError("nodeterm link: invalid arguments", "to must contain at least one node id (e.g. term-mupz6vu9-fe703c55)")
    }
    const res = await core.runCLI({
      cli: core.resolveCanvasCLI(),
      args: core.linkArgs({ to, from: args.from }),
      timeoutMs: args.timeoutMs ?? core.DEFAULT_TIMEOUTS.fast,
    })
    const lines = [statusLine("link", res)]
    lines.push(
      res.ok
        ? "Links created as reported by the CLI; they push nothing — linked nodes read each other on demand, and links are not dependency gates."
        : `The CLI reported failure: ${failureWhy(res)}. Links push nothing; re-invoking re-attempts the link.`,
    )
    lines.push(rawBlock(res))
    return {
      title: `nodeterm link (exit ${res.code})`,
      output: lines.join("\n"),
      metadata: baseMeta(res),
    }
  },
})

function messageLines(verb, res, parsed) {
  const lines = [statusLine(verb, res)]
  if (parsed.outcome) {
    lines.push(
      core.MESSAGE_OUTCOMES[parsed.outcome] === "retryable"
        ? `Outcome: ${parsed.outcome} (retryable — retrying can help after the wait the outcome names; this tool never retries on its own).`
        : `Outcome: ${parsed.outcome} (final — the cause will not clear by re-sending; do NOT retry).`,
    )
  } else {
    lines.push("Outcome: not recognized — no known outcome token in the reply; treat the result as unknown and read the raw output below.")
  }
  if (Array.isArray(parsed.matched) && parsed.matched.length > 1) {
    lines.push(`Outcome tokens seen: ${parsed.matched.join(", ")}`)
  }
  if (!res.ok) lines.push(`The CLI reported failure: ${failureWhy(res)}.`)
  return lines
}

export const send = tool({
  description:
    "Sends a message into a running nodeterm agent node's session (the `send` verb). The reply's typed outcome is preserved verbatim: retryable outcomes (expired, rateLimited, queueFull, targetBusy, targetNotIdleUnknown, targetStatusStale, targetPaneUnreadable) mean retrying can help after the wait the outcome names; terminal outcomes (delivered, queued, stalled, deliveredToReplacedTarget, targetStatusUnverified, targetHookScriptStale, targetNotAgentPane, targetNotPasteAware, targetGone, notPermitted) mean the cause will not clear by re-sending — do NOT retry them. A busy target holds the message in a bounded queue until it next goes idle; a queued message is not yet delivered. The tool itself never retries, and sending has no request-id protection, so re-sending may duplicate the message.",
  args: {
    node: tool.schema.string().describe("Target nodeterm agent node id, e.g. term-mupz6vu9-fe703c55"),
    text: tool.schema.string().describe("Message text to deliver into the target session"),
    timeoutMs: tool.schema.number().optional().describe("Timeout in milliseconds for the nodeterm CLI call"),
  },
  async execute(args) {
    const res = await core.runCLI({
      cli: core.resolveCanvasCLI(),
      args: core.sendArgs({ node: args.node, text: args.text }),
      timeoutMs: args.timeoutMs ?? core.DEFAULT_TIMEOUTS.fast,
    })
    const parsed = core.parseMessageReply(res)
    const lines = messageLines("send", res, parsed)
    lines.push(rawBlock(res))
    return {
      title: `nodeterm send → ${args.node} (exit ${res.code})`,
      output: lines.join("\n"),
      metadata: { ...baseMeta(res), parsed },
    }
  },
})

export const reply = tool({
  description:
    "Replies into a nodeterm agent node's session (the `reply` verb), typically answering a framed NODETERM MESSAGE that arrived in this session. The reply's typed outcome is preserved verbatim: retryable outcomes (expired, rateLimited, queueFull, targetBusy, targetNotIdleUnknown, targetStatusStale, targetPaneUnreadable) may be retried after the wait the outcome names; terminal outcomes (delivered, queued, stalled, deliveredToReplacedTarget, targetStatusUnverified, targetHookScriptStale, targetNotAgentPane, targetNotPasteAware, targetGone, notPermitted) must NOT be retried. A queued reply is held until the target next goes idle and is delivered only into the same session it was queued for. The tool itself never retries; retry only when the outcome says retrying can help.",
  args: {
    node: tool.schema.string().describe("Target nodeterm agent node id (the reply-to node named by the incoming message)"),
    text: tool.schema.string().describe("Reply text to deliver into the target session"),
    timeoutMs: tool.schema.number().optional().describe("Timeout in milliseconds for the nodeterm CLI call"),
  },
  async execute(args) {
    const res = await core.runCLI({
      cli: core.resolveCanvasCLI(),
      args: core.replyArgs({ node: args.node, text: args.text }),
      timeoutMs: args.timeoutMs ?? core.DEFAULT_TIMEOUTS.fast,
    })
    const parsed = core.parseMessageReply(res)
    const lines = messageLines("reply", res, parsed)
    lines.push(rawBlock(res))
    return {
      title: `nodeterm reply → ${args.node} (exit ${res.code})`,
      output: lines.join("\n"),
      metadata: { ...baseMeta(res), parsed },
    }
  },
})

export const context = tool({
  description:
    'Reads linked context from other nodeterm nodes on demand (the context-links CLI); nothing is ever pushed to a linked node and links are not dependency gates. mode "list" shows the nodes this node is linked to; mode "summary" returns the last lines of a linked node\'s conversation (optionally -n lines); mode "transcript" returns its full conversation; mode "terminal" returns its recent terminal output. `node` is required unless mode is "list". Use it to read what a linked session produced before building on its work — a node you never read is one you cannot vouch for.',
  args: {
    mode: tool.schema
      .enum(CONTEXT_MODES)
      .describe("list = nodes this node is linked to; summary = last conversation lines; transcript = full conversation; terminal = recent terminal output"),
    node: tool.schema.string().optional().describe("Linked node id (required unless mode is list)"),
    lines: tool.schema.number().optional().describe('For mode "summary": how many trailing lines to return (nodeterm -n)'),
    timeoutMs: tool.schema.number().optional().describe("Timeout in milliseconds for the context-links CLI call"),
  },
  async execute(args) {
    if (!CONTEXT_MODES.includes(args.mode)) {
      return argError("nodeterm context: invalid arguments", `unknown mode ${JSON.stringify(args.mode)}; expected one of ${CONTEXT_MODES.join(", ")}`)
    }
    if (args.mode !== "list" && !args.node) {
      return argError("nodeterm context: invalid arguments", `mode "${args.mode}" requires node (a term-… id); call nodeterm_list or mode "list" first to find linked node ids`)
    }
    const res = await core.runCLI({
      cli: core.resolveContextCLI(),
      args: core.contextArgs({ mode: args.mode, node: args.node, lines: args.mode === "summary" ? args.lines : undefined }),
      timeoutMs: args.timeoutMs ?? core.DEFAULT_TIMEOUTS.context,
    })
    const lines = [statusLine(`context ${args.mode}`, res)]
    lines.push(
      res.ok
        ? "Context reads are one-directional and read-only: nothing is pushed to the linked node."
        : `The context CLI reported failure: ${failureWhy(res)}.`,
    )
    lines.push(rawBlock(res))
    return {
      title: `nodeterm context ${args.mode} (exit ${res.code})`,
      output: lines.join("\n"),
      metadata: baseMeta(res),
    }
  },
})

export const report_outcome = tool({
  description:
    "Reports the caller's own outcome for its current task through nodeterm (the `report-outcome` verb); every assigned task should end with this report. succeeded means the task is done AND checked the way the assignment required (tests pass, files exist, the PR is open) — not merely that work stopped; use failed with a note for give-ups, blockers, or unverified work. Nodes opened with --after-success on this session start only on succeeded, and a failed report blocks them. note is one line of at most 200 characters shown to waiting stations; longer notes are refused before the CLI is called. A later report replaces the earlier one.",
  args: {
    outcome: tool.schema
      .enum(["succeeded", "failed"])
      .describe("succeeded = done and checked as the assignment required; failed = gave up, hit a blocker, or could not verify"),
    note: tool.schema.string().optional().describe("One line, at most 200 characters, shown to stations waiting on this outcome"),
    timeoutMs: tool.schema.number().optional().describe("Timeout in milliseconds for the nodeterm CLI call"),
  },
  async execute(args) {
    if (args.outcome !== "succeeded" && args.outcome !== "failed") {
      return argError("nodeterm report_outcome: invalid arguments", `outcome must be "succeeded" or "failed", got ${JSON.stringify(args.outcome)}`)
    }
    let note = null
    if (args.note !== undefined && args.note !== null && String(args.note).trim() !== "") {
      note = collapseWhitespace(args.note)
      if (note.length > 200) {
        return argError(
          "nodeterm report_outcome: note too long",
          `note is ${note.length} characters; the limit is 200 in one line — shorten it to the essential reason. No CLI call was made.`,
        )
      }
    }
    const res = await core.runCLI({
      cli: core.resolveCanvasCLI(),
      args: core.reportOutcomeArgs({ outcome: args.outcome, note }),
      timeoutMs: args.timeoutMs ?? core.DEFAULT_TIMEOUTS.fast,
    })
    const lines = [statusLine("report-outcome", res)]
    lines.push(
      res.ok
        ? `Reported outcome: ${args.outcome}${note ? ` — ${note}` : ""} (as accepted by the CLI).`
        : `The CLI reported failure: ${failureWhy(res)}; the outcome was NOT confirmed reported.`,
    )
    lines.push(rawBlock(res))
    return {
      title: `nodeterm report-outcome ${args.outcome} (exit ${res.code})`,
      output: lines.join("\n"),
      metadata: baseMeta(res),
    }
  },
})

export const role_launch = tool({
  description:
    "Launches a predefined orchestration role as a new nodeterm node through a managed open-agent launch ONLY (agent opencode by default; never open-terminal — there is no terminal mode and no fallback). Shared role registry: coordinator (openai/gpt-6.1-sol), planner (anthropic/claude-opus-5-5), implementation owner (databricks-oss/system.ai.glm-5-3), reviewer (openai/gpt-6.1-sol); display names and slugs such as implementation-owner are accepted. The role's model is the REQUESTED model: forwarded via nodeterm --model but its honoring by the opencode launcher is NOT verified — every result carries modelSelection with that caveat and the running model must not be assumed. A durable assignment file (the full role prompt plus the task) is written under .agents/nodeterm/assignments and the node is told to read it first and execute it exactly, then finish with nodeterm_report_outcome. Run with dryRun true first to validate cheaply; pass the same requestId to retry a lost reply (a new id may create a duplicate); the tool never re-opens after a successful open — partial rename/link failures are reported with the node id, and the node must not be re-opened.",
  args: {
    role: tool.schema
      .string()
      .describe('One of: coordinator, planner, implementation owner, reviewer (slugs accepted, case-insensitive; role stays a free string so new registry entries keep working)'),
    task: tool.schema.string().describe("The current task for the role, appended to the durable assignment file under a '## Current task' heading"),
    cwd: tool.schema.string().optional().describe("Working directory for the new node and the assignment file; defaults to this project directory"),
    requestId: tool.schema
      .string()
      .optional()
      .describe("Safe-retry id: re-invoke with the SAME requestId to recover a lost reply; a new id may create a duplicate; generated when omitted"),
    dryRun: tool.schema.boolean().optional().describe("Strongly recommended first run: validate the open without creating a node (the assignment file is still written)"),
    agent: tool.schema.string().optional().describe("Agent id for the managed open-agent launch (default opencode; a supported OpenCode agent profile id may be given)"),
    group: tool.schema.string().optional().describe("Group frame id to open the node into"),
    after: tool.schema.array(tool.schema.string()).optional().describe("Node ids the launch waits on (nodeterm --after)"),
    afterSuccess: tool.schema.array(tool.schema.string()).optional().describe("Node ids that must report success first (nodeterm --after-success)"),
    runNow: tool.schema.boolean().optional().describe("Start immediately even when the project is off screen (nodeterm --run-now)"),
    skipLink: tool.schema.boolean().optional().describe("Skip the context link to the new node after a successful open"),
    skipRename: tool.schema.boolean().optional().describe("Skip the rename step after a successful open"),
    linkFrom: tool.schema.string().optional().describe("Source node id for the context link; defaults to the caller's own node"),
    timeoutMs: tool.schema.number().optional().describe("Timeout in milliseconds for the open call"),
  },
  async execute(args, context) {
    if (args.mode !== undefined && args.mode !== null && args.mode !== "") {
      return argError(
        "nodeterm role_launch: invalid arguments",
        "unknown option mode; managed open-agent launch only (never open-terminal) — the terminal launch mode was removed; re-invoke without mode",
      )
    }
    const result = await launchRole({
      role: args.role,
      task: args.task,
      cwd: args.cwd || context?.directory || process.cwd(),
      requestId: args.requestId,
      dryRun: args.dryRun,
      agent: args.agent,
      group: args.group,
      after: args.after,
      afterSuccess: args.afterSuccess,
      runNow: args.runNow,
      skipLink: args.skipLink,
      skipRename: args.skipRename,
      linkFrom: args.linkFrom,
      timeoutMs: args.timeoutMs,
    })
    const openStep = result.steps.find((s) => s.name === "open") || null
    const res = result.launch ? result.launch.raw : null
    const lines = []
    if (res) {
      lines.push(statusLine(`role_launch (${result.role}, managed open-agent)`, res))
    } else {
      lines.push("nodeterm role_launch — stopped before any CLI call")
    }
    if (result.role) {
      lines.push(`role: ${result.role} (requested model ${result.model})`)
    }
    if (result.modelSelection) {
      lines.push(`model selection: requested ${result.modelSelection.requested}, forwarded via --model, not verified — ${result.modelSelection.note}`)
    }
    if (result.requestId) {
      lines.push(
        `requestId: ${result.requestId} — to retry a lost reply, re-invoke with the SAME requestId; a new id may create a duplicate; this tool never retries on its own.`,
      )
    }
    if (result.assignmentPath) {
      lines.push(`assignment file: ${result.assignmentPath} (role prompt + current task; the node reads it first and executes it exactly)`)
    }
    if (args.dryRun) {
      lines.push("dry-run: the open call was validated only and created no node (the assignment file above IS real).")
    }
    if (result.launch) {
      lines.push(...creationLines({ parsed: result.launch, dryRun: !!args.dryRun, requestId: null }))
    }
    const stepsSummary = stepsLine(result.steps)
    if (stepsSummary) lines.push(stepsSummary)
    for (const warning of result.warnings) lines.push(`warning: ${warning}`)
    const partial = partialSetupNote(result)
    if (partial) lines.push(partial)
    for (const error of result.errors) lines.push(`error: ${error}`)
    if (res) lines.push(rawBlock(res))
    return {
      title: openStep ? `nodeterm role_launch ${result.role} (exit ${openStep.code})` : "nodeterm role_launch (no CLI call)",
      output: lines.join("\n"),
      metadata: {
        ok: result.ok,
        exitCode: openStep ? openStep.code : null,
        stdout: openStep ? openStep.stdout : "",
        stderr: openStep ? openStep.stderr : "",
        timedOut: res ? res.timedOut : false,
        spawnError: res ? res.spawnError : null,
        parsed: result.launch,
        steps: result.steps,
        errors: result.errors,
        warnings: result.warnings,
        role: result.role,
        model: result.model,
        modelSelection: result.modelSelection,
        requestId: result.requestId,
        assignmentPath: result.assignmentPath,
        nodeId: result.nodeId,
      },
    }
  },
})
