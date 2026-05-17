# Diff

Use this workflow when the user wants to compare two configs and understand what changed and what risk that change carries. The output is an ordered list of changes, each tagged with a risk rating, the rule it touches (if any), and a one-line "what could go wrong" note. This is for pre-deployment review, drift detection, or change-window prep.

## When to use this

Trigger phrases:

- "Diff these two configs"
- "What changed"
- "Compare baseline vs running"
- "Compare A and B" (when A and B are concrete configs)
- "Review this proposed change against current"
- "What's different between these"
- "Is this safe to push"

Do not use this workflow when:

- The user wants to compare architectural approaches, not concrete configs (use `picker` instead)
- The user has one config and wants a review against rules (use `audit`)
- The user wants documentation generated from the config (use `document`)
- The user wants to verify a config matches a stated design intent (use `validate`)
- The user is moving config between vendors (use `migrate` when it exists)
- The user has already done the diff and wants opinions on a specific finding (engage directly with topical docs)

## Required companion docs

Always load:

- The vendor or platform doc(s) for the configs being diffed
- `https://docs.artofinfra.com/general/hardening.md` (security shifts hide in diffs)

Load conditionally based on what changes touch:

- Routing protocol stanzas: relevant `https://docs.artofinfra.com/general/{bgp,ospf,...}.md` docs
- ACLs: `https://docs.artofinfra.com/general/acl-design.md`
- QoS: `https://docs.artofinfra.com/general/qos.md`
- VXLAN/EVPN: `https://docs.artofinfra.com/general/vxlan.md`

If a section was not changed, skip its doc. Diff is about deltas, not the whole posture.

## Workflow

1. **Confirm direction.** Identify which config is "before" / "after" (or "A" / "B", or "running" / "proposed"). If ambiguous, ask. Do not guess from filenames or content order. Direction determines whether a change is "added" or "removed", which flips risk in many cases.

2. **Identify the platform.** Both configs should be the same vendor and OS. If they differ, this is not a diff; it is a migration. Stop and either route to the `migrate` workflow (when it exists) or ask the user to clarify.

3. **Compute the structural diff.** Walk both configs and group changes by config section (`interface X`, `router ospf 1`, `ip access-list extended FOO`, etc.). For each section, identify:

   - Lines added in B that are absent in A
   - Lines removed from A that are absent in B
   - Lines whose values changed (same key, different value)
   - Order-only changes (lines reorganized but content identical)

4. **Classify each change by risk:**

   - **Low:** comments, descriptions, banners, naming, formatting. Additive defaults that do not change behavior. Order-only changes in non-ordered contexts.
   - **Medium:** new features added, parameter tuning within safe ranges, new ACL entries that extend (rather than replace) existing rules, MTU changes within standard ranges.
   - **High:** authentication or crypto changes, ACL replacements, routing policy changes, redistribute or summarize changes, NAT changes, primary/secondary IP changes, anything affecting active routing adjacencies or sessions.
   - **Critical:** removes authentication, opens the management plane to a broader scope, removes an ACL applied to a transit or management interface, redistribute without route-map, anything that could black-hole traffic or expose a control plane to the data plane.

5. **Cross-reference each change against the rules.** If a change moves the config closer to an Art of Infra rule, say so explicitly (it is good news, surface it). If a change introduces a rule violation, flag it and cite the specific rule.

6. **Note what could go wrong** for every Medium-or-higher change in one sentence: blast radius, recovery path, or operational concern.

7. **Suggest a verification command** for every High-or-higher change: the `show` command that proves the change took effect (or did not). For example, an ACL change should pair with `show ip access-lists <name>` and ideally a packet-trace or `show ip cef <prefix>` to confirm forwarding behavior.

8. **Group order-only and cosmetic changes into a "No-op" section.** Keep them visible so the user can see they were considered, but do not elevate them to findings.

9. **End with a one-line `Net effect` summary** stating the overall direction (tightens, loosens, neutral) and overall risk.

## User-facing progress updates

Send a short, one-line status update before each major phase so longer runs do not look stuck.

- "Pulling reference docs."
- "Confirming direction and platform."
- "Computing structural diff."
- "Classifying changes by risk."
- "Cross-referencing against rules."
- "Suggesting verification commands."
- "Summarizing net effect."

## Output format

Output sections in this order:

- `## Diff: <A label> → <B label>` (default to "before → after" if labels not given)
- A one-line headline summary stating net direction and overall risk
- `### Critical`, then a numbered list of changes (omit if empty)
- `### High`, `### Medium`, `### Low` (omit any empty section)
- `### No-op`, with a bulleted list of cosmetic, reorder, or comment-only changes
- `### Net effect`, a short paragraph in plain English

Each change in the severity sections contains:

- A bold title naming the section or feature affected, e.g. "ACL `MGMT-IN` line 30 source widened"
- A `Lines:` reference if known (line range in A and/or B)
- A `Change:` block showing before and after. Inline code for short changes; a fenced before/after pair for multi-line changes (use the right language tag: `cisco`, `junos`, etc.)
- A `Rule:` line citing the relevant Art of Infra doc and rule, or "no rule cited" if the change is config-shape rather than rule-shape
- For Medium-or-higher changes: a `Risk:` line stating in one sentence what could go wrong
- For High-or-higher changes: a `Verify:` line with the `show` command that proves the change took effect

## Non-negotiable rules

- Always confirm direction (A vs B, before vs after) before classifying. Do not assume from filenames or paste order.
- Sort changes by risk severity, not by where they appear in the config.
- Cite a rule for any Medium-or-higher change that touches a rule. If no rule applies, write "no rule cited" rather than fabricating one.
- Show before and after explicitly. Do not paraphrase a config change.
- Include a `Net effect` paragraph at the end. Reviewers need the executive summary.
- No-op section is mandatory if any reorders, comments, or whitespace changes exist. They get listed but never elevated.
- Verification commands required for High-or-higher changes.

## Dangerous patterns to avoid

- **Treating line count as severity.** A 200-line description re-flow is No-op. A 1-line ACL source change can be Critical. Severity is about blast radius, not diff length.
- **Missing security-direction shifts.** "Tightened" vs "loosened" matters more than "added" vs "removed". Inserting `permit ip any any` at the bottom of a deny-by-default ACL is a Critical change even though only one line was added.
- **Auto-recommending the change.** This workflow assesses the diff; it does not decide whether to apply it. "Looks good, ship it" is not the workflow's job. Present findings; let the user decide.
- **Calling reorders no-op without checking semantics.** ACL line order, route-map sequence, prefix-list sequence are semantically significant. Always check whether the ordering matters for that construct before classifying as No-op.
- **Hand-waving auth or crypto changes.** Any change that touches authentication, encryption, or key material defaults to High at minimum, even if it is "just" a key rotation.
- **Diffing across platforms.** A Cisco IOS-XE config and a Juniper Junos config are not diffable; they are migratable. Refuse and route to the right workflow.
