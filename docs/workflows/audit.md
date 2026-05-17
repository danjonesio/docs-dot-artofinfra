# Audit

Use this workflow when the user asks you to review an existing network device config against Art of Infra best practices. The output is a prioritized list of issues with proposed fixes, not a rewrite.

## When to use this

Trigger phrases:

- "Review this config"
- "Audit this config"
- "Check this for issues"
- "Is this config OK"
- "Lint this"
- "What's wrong with this"

Do not use this workflow when:

- The user wants you to write a new config (use the topical docs directly)
- The user wants you to implement a specific change (use the topical docs directly)
- The user wants alternatives compared rather than rules checked (use `picker`)
- The user wants two concrete configs compared (use `diff`)
- The user wants documentation extracted rather than issues flagged (use `document`)
- The user wants to verify the config matches a stated design intent (use `validate`)
- The config is for a non-supported platform (say so and ask which platform)

## Required companion docs

Always load:

- The vendor / platform doc, e.g. `https://docs.artofinfra.com/cisco/ios-xe.md`, `https://docs.artofinfra.com/juniper/junos.md`
- `https://docs.artofinfra.com/general/hardening.md` (the security baseline applies to almost every audit)

Load conditionally based on what the config contains:

- If routing protocols are configured: `https://docs.artofinfra.com/general/bgp.md`, `https://docs.artofinfra.com/general/ospf.md` as relevant
- If ACLs are present: `https://docs.artofinfra.com/general/acl-design.md`
- If QoS is present: `https://docs.artofinfra.com/general/qos.md`
- If VXLAN/EVPN is present: `https://docs.artofinfra.com/general/vxlan.md`

If the config spans multiple roles (edge router with firewall ACLs, etc.), load all relevant general docs. Do not skip a doc because you "already know" the rules. Explicit grounding produces more accurate findings.

## Workflow

1. **Confirm scope.** If the user pasted a config without saying which platform, ask. Do not guess from the syntax. Running-config snippets across vendors can look superficially similar.

2. **Read the config end-to-end before starting.** Note what is there: management plane (AAA, SNMP, NTP, SSH), control plane (routing protocols, FHRP), data plane (interfaces, ACLs, QoS), and platform features (logging, monitoring, hardening). A first-pass mental map prevents you from flagging something on line 30 that is correctly set elsewhere on line 200.

3. **Walk the config in five passes, one concern per pass:**

   1. **Security baseline:** auth, default credentials, exposed services, weak crypto, missing ACLs on management interfaces. Source: `https://docs.artofinfra.com/general/hardening.md` plus vendor doc.
   2. **Control plane:** routing protocol config: timers, authentication, redistribution, summarization, route filtering. Source: relevant `https://docs.artofinfra.com/general/{protocol}.md` doc.
   3. **Data plane:** interface config: descriptions, MTU, speed/duplex, storm control, port-security, ACL placement. Source: vendor doc plus `https://docs.artofinfra.com/general/acl-design.md` if ACLs are present.
   4. **Operational hygiene:** logging destinations, NTP sources, SNMP communities, banner, time zone, archive config. Source: vendor doc plus `https://docs.artofinfra.com/general/hardening.md`.
   5. **Convention drift:** naming, indentation patterns, comment density, obvious copy-paste artifacts. Source: vendor doc.

4. **For each issue found, capture:**

   - **Severity:** critical (security exposure or production-breaking), high (best-practice violation with operational risk), medium (style or convention), low (cosmetic).
   - **Location:** interface name, line context, or section.
   - **Rule violated:** cite the doc and rule it came from, not just "best practice."
   - **Proposed fix:** exact config to apply, not a description.

5. **Present findings as a single ordered list, sorted by severity.** Do not break into per-pass sections. The user wants to see what to fix first, not how you organized your review.

6. **End with a "Passed cleanly" section** for any major area that met all rules. This builds trust that you actually looked at it, and protects against the impression that audit always finds twenty things.

## User-facing progress updates

Send a short, one-line status update before each major phase so longer runs do not look stuck.

- "Pulling reference docs."
- "Reading the config end-to-end."
- "Pass 1 of 5: security baseline."
- "Pass 2 of 5: control plane."
- "Pass 3 of 5: data plane."
- "Pass 4 of 5: operational hygiene."
- "Pass 5 of 5: convention drift."
- "Sorting findings by severity."

If a pass produces no findings, still announce the pass before moving on so the user knows you covered it.

## Output format

Output sections in this order:

- `## Audit findings: <hostname or context>`
- `### Critical`, then a numbered list of findings
- `### High`, `### Medium`, `### Low` (omit any empty section)
- `## Passed cleanly`, with a bulleted list of areas that met rules

Each finding contains:

- A bold title line including the section or interface
- A `Rule:` line citing the source doc and rule name
- A `Why:` line explaining the issue in one sentence
- A `Fix:` block with the exact config in a fenced code block (use the right language tag: `cisco`, `junos`, etc.)

## Non-negotiable rules

- Cite the rule for every finding. "Best practice" is not a citation; quote the doc and rule by URL.
- Show the exact fix in a fenced config block, not a prose description of the fix.
- Sort by severity, not by where the issue appears in the config.
- Include a "Passed cleanly" section even if it is short.
- If the user pastes a config snippet that is clearly partial, say what context is missing (for example, "I cannot tell whether this interface ACL is permissive without seeing the named ACL definition") rather than guessing.
- Do not rewrite the whole config. The user asked to audit, not refactor.

## Dangerous patterns to avoid

- **Auto-generating a "fixed" config to paste in.** Configs depend on context not visible in a snippet. Propose changes; do not apply them blindly.
- **Flagging style issues as critical.** Severity calibration matters. Loose convention is not a security issue.
- **Skipping verification commands.** When proposing a routing or ACL change, include the `show` command that proves it took effect.
