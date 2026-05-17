# Picker

Use this workflow when the user asks for a comparison, alternatives, or "what's the best way to do X" where X has real architectural choices. The output is 3-4 fully-fleshed alternatives with tradeoffs, a comparison table, and a single question asking the user to pick one.

## When to use this

Trigger phrases:

- "What's the best way to [X]?"
- "Show me a few approaches for [X]"
- "Compare [A] and [B] for [X]"
- "Should I do [A] or [B]?"
- "I'm not sure which approach to use for [X]"
- "Give me some options for [X]"

Do not use this workflow when:

- The user asks for one specific implementation (use the topical docs directly)
- The user has already decided on an approach and wants to implement it (use the topical docs directly)
- The user wants a config reviewed against rules (use `audit`)
- The user wants two concrete configs compared (use `diff`)
- The user wants documentation generated from a config (use `document`)
- The user wants to verify the config matches a stated design intent (use `validate`)
- The question has a single canonical answer (e.g. "what's the SSH config for IOS-XE?")
- The "alternatives" would all be trivial syntactic differences, not meaningful architectural choices

## Required companion docs

Always load:

- The vendor or platform doc(s) relevant to the discussed platforms
- The protocol or topic doc from `https://docs.artofinfra.com/general/` if applicable
- `https://docs.artofinfra.com/general/hardening.md` if the choice has security implications

## Workflow

1. **Identify the real decision.** What is the user actually choosing between? Strip the question down to the architectural choice. "What's the best way to do site-to-site VPN" is really "what topology and tunnel type?" not "what crypto suite."

2. **Generate 3-4 realistic alternatives.** Not 2 (false binary), not 5 or more (overload). Every alternative must be one a real engineer would consider. No strawmen.

3. **Define each alternative before writing any config.** Structured and specific. Each variant covers:

   - **Topology:** where each component lives, what talks to what
   - **Failure mode:** what happens if X fails (link, device, path)
   - **Scale ceiling:** how many sites, sessions, or prefixes before this approach breaks
   - **Complexity:** operational burden, how many people on the team can actually run it
   - **Blast radius:** misconfig hits one device, one site, or everything
   - **Hardware or licensing requirements:** anything platform-specific
   - **Cost shape:** rough order-of-magnitude comparison (BOM, licensing, ops time)
   - **Rule citations:** which Art of Infra docs and rules informed the choice

   Bad: "IPsec point-to-point with strong crypto."

   Good: "Static IPsec point-to-point tunnel between two sites' edge routers. AES-256-GCM with SHA-384 PRF, PFS group 19, IKEv2 PSK rotated quarterly. Single tunnel, no redundancy. Failure mode: any single edge device or path failure drops the tunnel; recovery requires manual cutover or BFD-driven failover to a backup. Scale ceiling: roughly 2 sites; mesh complexity explodes past 4. Complexity: low; one config per side, no protocol overlay. Blast radius: site-wide on misconfig (PSK rotation desync). Hardware: any IPsec-capable router or firewall, no special licensing. Cost: minimal beyond what you already own."

4. **Present a comparison table first**, before any individual config. Columns must be the dimensions that actually differ between alternatives. Avoid vague labels like "more secure" or "simpler". Pick concrete dimensions (sessions per second, sites scaled to, time to converge, ops headcount required).

5. **Then show each alternative in detail.** For each:

   - The structured design definition from step 3
   - "Best for / watch out for / don't pick this if" tradeoff notes
   - Full config block (vendor-specific syntax, language tag set)
   - Verification commands

6. **Ask the user to pick.** One focused question. If there are sub-decisions (e.g. "first pick topology, then pick crypto"), sequence them across separate rounds.

7. **Do not pre-select for the user.** Even if one option is obviously stronger, present the choice. The user has context you don't (existing platform constraints, audit requirements, vendor relationships, team skills).

8. **After selection, finalize:**

   - Restate the chosen design definition
   - If any config values are environment-specific (interface names, IPs, AS numbers, keys, hostnames), include a substitution table mapping each placeholder to its meaning
   - Show the chosen config with context-specific values filled in or clearly marked as placeholders
   - Rollback steps to undo the change
   - Post-deploy verification checklist
   - A "Known limitations" section listing what this approach does not solve

9. **Validate the final output:**

   - Config implements the stated design definition
   - Cited rules are real and relevant
   - Verification commands match the protocol or feature
   - Rollback is reversible

## User-facing progress updates

Send a short, one-line status update before each major phase so longer runs do not look stuck.

- "Identifying the real decision and pulling reference docs."
- "Drafting N alternatives."
- "Comparing tradeoffs."
- "Writing config for each variant."
- (After selection) "Finalizing chosen variant with rollback and verification."

## Output format

The output has two phases.

**Phase 1: comparison.**

Sections in this order:

- A heading restating the user's question
- A short framing sentence (e.g. "Three realistic approaches; tradeoffs are X, Y, Z.")
- A comparison table with columns matching the dimensions that actually differ
- For each alternative, a `### N. <Name>` section containing:
  - A bold **Design definition** paragraph
  - A bold **Tradeoffs** block with "Best for", "Watch out for", and "Don't pick this if" lines
  - A **Config (<Vendor>)** code block with the full config (use the right language tag: `cisco`, `junos`, etc.)
  - A **Verify** code block with `show` commands
- A horizontal rule
- A single question: "Which approach do you want to use? Or tell me what's missing if none of these fit."

**Phase 2: finalization** (after the user picks, in a follow-up message):

- A heading naming the chosen approach
- The chosen design definition restated
- A **Substitution table** mapping environment-specific placeholders to their meaning (skip only if the config has no placeholders)
- The final config with context-specific values filled in or clearly marked as placeholders
- A **Rollback** section with commands
- A **Verify after deploy** checklist
- A **Known limitations** section

## Non-negotiable rules

- Generate 3-4 alternatives. Never 2 (false binary), never 5 or more (overload).
- Every alternative must be one a real engineer would seriously consider. No strawmen, no "do nothing" filler.
- Cite Art of Infra rules in each design definition. "Best practice" is not a citation.
- The comparison table comes before any deep dive. Readers scan the table first.
- Show vendor-specific config in fenced blocks with the right language tag.
- Verification commands for every alternative, not just the chosen one.
- Rollback steps in the finalization phase.
- A "Known limitations" section in the finalization phase, listing what this approach does not solve.
- A substitution table in the finalization phase if any config values are environment-specific (interface names, IPs, AS numbers, keys, hostnames).
- Do not auto-select. Always present the choice and ask, even if one option is clearly stronger.

## Dangerous patterns to avoid

- **False alternatives.** Generating 4 options when only 2 are real is dishonest. If only 2 fit, show 2 and explain why the others don't apply.
- **Strawman options.** Including a deliberately weak option so others look good.
- **Vague tradeoffs.** "More secure" or "simpler" without saying compared to what, on what dimension.
- **Skipping the comparison table.** Three full config dumps with no overview are unscannable.
- **Pre-selecting.** "I picked option 2 because it's better" defeats the purpose of the workflow.
- **Mixing decision dimensions.** If the user is choosing topology, don't also throw crypto suite variations into the same set. Sequence the decisions.
