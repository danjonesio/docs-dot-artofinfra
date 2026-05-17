# Validate

Use this workflow when the user provides a config plus a stated design intent and wants you to verify the config actually implements that intent. The output is a list of intent claims, each rated PASS / FAIL / PARTIAL / NOT APPLICABLE, with the specific config lines that prove or fail each claim. Pairs naturally with the picker workflow's design definition: pick an approach, deploy it, then validate against the same definition.

## When to use this

Trigger phrases:

- "Does this config match the design"
- "Verify this implements X"
- "Check that this is a [stub area / hardened baseline / single-area OSPF / dual-ABR]"
- "Validate this against the intent"
- "Confirm this matches the picker output"
- "Does this config do what I asked for"

Do not use this workflow when:

- The user wants the config reviewed against general best practices (use `audit`)
- The user wants alternative approaches compared (use `picker`)
- The user wants two concrete configs compared (use `diff`)
- The user wants documentation generated from the config (use `document`)
- The user gives no design intent at all. Ask for one (or for a picker design definition) before proceeding.

## Required companion docs

Always load:

- The vendor or platform doc(s) for parsing the config syntax
- Any topical doc named in the stated intent (for example, if the intent says "OSPF area 0 with MD5 auth", load `https://docs.artofinfra.com/general/ospf.md`)

If the user pastes a picker design definition as the intent, no extra topical docs are required. The design definition itself names what to check.

## Workflow

1. **Confirm the intent is concrete.** If the user says "make sure this is hardened" with no specifics, ask. Vague intent produces vague validation. Get them to either name testable claims ("management plane restricted to bastion subnet", "no plaintext passwords", "OSPF authentication SHA-256") or paste a picker design definition.

2. **Restate the intent as a numbered list of testable claims** before doing any validation. This is the contract. Show it as the first output and use it as the structure for everything that follows. If the user disagrees with any claim, they can correct it before you spend effort validating.

3. **For each claim, walk the config and find evidence.** Each claim resolves to one of:

   - **PASS:** config explicitly implements the claim. Cite the specific line(s).
   - **FAIL:** config explicitly contradicts the claim. Cite the contradicting line(s).
   - **PARTIAL:** claim has multiple parts, some implemented and some not. Cite both.
   - **NOT APPLICABLE:** the claim references a feature the platform does not support, or the section needed to check it is absent from the snippet. Say so explicitly.

4. **Never claim PASS without citing a line.** A presence claim ("OSPF authentication is SHA-256") passes only if you can quote the relevant line. An absence claim ("no plaintext passwords") passes only when there is positive enforcement (for example, `service password-encryption` plus every credential uses an encrypted form). "I do not see any" alone is NOT APPLICABLE, not PASS.

5. **Note absent context separately.** If the snippet is partial and a claim depends on something outside it (the claim refers to ACL `MGMT-IN` but the snippet does not include the ACL definition), mark NOT APPLICABLE with a "needs <X> to verify" note. Do not guess.

6. **For picker design definitions specifically, walk every field as a claim:**

   - **Topology:** does the config implement the stated topology?
   - **Authentication and crypto:** does it use the stated suite (algorithms, key lengths, PSK rotation discipline)?
   - **Failure mode:** is the redundancy or failover behavior the design described actually configured?
   - **Scale ceiling:** does the config use features compatible with the stated scale (timer values, summarization, area structure)?
   - **Rule citations:** are the rules cited in the design definition actually honored in this config?

7. **End with an overall verdict.** PASS, FAIL, or PARTIAL across the whole intent. If PARTIAL, list the highest-priority failures first so the user knows where to focus.

## User-facing progress updates

Send a short, one-line status update before each major phase so longer runs do not look stuck.

- "Pulling reference docs."
- "Restating intent as testable claims."
- "Walking the config for evidence."
- "Classifying each claim."
- "Summarizing overall verdict."

## Output format

Sections in this order:

- `## Validation: <short intent name>`
- `### Stated intent (as I understood it)`: a numbered list of testable claims restating the user's intent as discrete checks. This is the contract.
- `### Results`: for each numbered claim, in the same order as the intent list:
  - The claim restated as a heading or bold line
  - The verdict on its own line: **PASS**, **FAIL**, **PARTIAL**, or **NOT APPLICABLE**
  - The supporting evidence: cited config line(s), shown as inline code for short references or in a fenced block for multi-line evidence (use the right language tag: `cisco`, `junos`, etc.)
  - For FAIL or PARTIAL, a one-sentence note on what would need to change
- `### Overall verdict`: a single line stating PASS, FAIL, or PARTIAL with the claim count (for example, "PARTIAL: 7 of 10 claims passing")
- `### Items requiring user input` (only if any claim was ambiguous): a short list of clarifying questions the user needs to answer before validation can be definitive

## Non-negotiable rules

- Restate the intent as a numbered list before validating. Without the contract the user cannot calibrate whether your checks were the right ones.
- Never claim PASS without citing the config line(s) that prove it. Quotation, not inference.
- For absence claims, require positive enforcement (explicit settings, or every relevant line using the safe form). "I do not see any" alone is NOT APPLICABLE, not PASS.
- If an intent claim is ambiguous, list it under "Items requiring user input" instead of guessing.
- Do not extend the intent. Do not add claims the user did not state, even if they seem like obvious additions. Validate against what was asked, not what should have been asked. Refer the user to `audit` for general best-practice review.
- Cite the exact line, not paraphrased config. The user must be able to grep their running-config and find the cited evidence.

## Dangerous patterns to avoid

- **Validating against unstated rules.** "This is not using SHA-256 for SNMPv3" may be true, but if the user's intent did not mention SNMPv3, do not downgrade them to FAIL on it. That is `audit`'s job. Validate strictly against stated intent.
- **PASS on absence without enforcement.** "No SSH version 1 detected" sounds like PASS but is just "I did not see it." The config might not configure SSH at all. Use NOT APPLICABLE or ask the user to clarify the intent.
- **Inferring intent.** If the user says "this should be hardened", do not invent your own hardening checklist and validate against it. Ask them to specify, or refer them to `audit`.
- **Conflating PARTIAL with PASS.** A claim with three parts where two pass and one fails is PARTIAL, not PASS. The overall verdict must respect this.
- **Treating picker design definitions as suggestions.** Every line in a picker design definition is a claim. Every dimension (Topology, Failure mode, Scale ceiling, etc.) is checkable. Do not skip dimensions because they seem fine; check each one and cite evidence.
- **Validating in narrative form.** A prose paragraph saying "looks good" is not a validation. Each claim gets its own line, its own verdict, and its own cited evidence.
