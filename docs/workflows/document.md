# Document

Use this workflow when the user wants to generate readable documentation from one or more configs. The output is a structured Markdown document with a role summary, an interface table, a routing summary, VLAN / ACL / service inventories, and a Gaps section listing things that are absent. For multi-device input it also produces a Mermaid topology graph and a network-wide IP allocation table. This is for handover, audit prep, change records, or filling out a runbook.

## When to use this

Trigger phrases:

- "Document this device" / "Document this network"
- "Generate docs from this config"
- "What does this config do"
- "I need a runbook for this"
- "Make a topology diagram from these configs"
- "Generate an IP allocation table"

Do not use this workflow when:

- The user wants the config reviewed for issues (use `audit`)
- The user wants alternative approaches compared (use `picker`)
- The user wants two configs compared (use `diff`)
- The user wants to verify the config matches a stated design intent (use `validate`)
- The user wants a config rewritten, refactored, or extended (engage with topical docs directly)

## Required companion docs

Always load:

- The vendor or platform doc(s) for parsing the config syntax

Load topical docs that match what the config contains. Consult `https://docs.artofinfra.com/general/index.md` and load every general doc whose topic appears in the config (used to recognise and summarise structure, not to judge it). If the user is asking about NetBox modeling, also consult `https://docs.artofinfra.com/netbox/index.md`.

Document does not judge. It extracts what is there. Topical docs provide vocabulary, not rules.

## Workflow

1. **Confirm scope.** Single device or multiple? If multiple, ask whether they represent all the interconnected devices or just a subset. Single-device docs and multi-device network docs differ enough that this affects the output.

2. **Identify the platform.** Vendor and OS per config, so parsing is correct.

3. **Extract structural data.** For each config:

   - Hostname and inferred role from interface count and protocol set
   - Interfaces: name, description, IP, mask, VRF, MTU, encapsulation, status (shut / no-shut), VLAN tagging or trunk membership
   - Routing protocols: OSPF (areas, networks, stub or NSSA flags), BGP (AS, neighbors, address families), EIGRP, IS-IS
   - VLANs (if L2 is configured)
   - ACLs: name, where applied, direction
   - Services: SSH, SNMP, NTP, AAA, syslog, logging targets
   - Management plane: line vty / console, archive, banner, transport

4. **Redact secrets.** Replace each of the following in the output with `<redacted>` or a typed placeholder like `<encrypted>` for already-hashed material:

   - `password 0 ...` (plaintext) and `password 7 ...` and `secret 5|8|9 ...`
   - `key-string ...`
   - `snmp-server community ...`
   - `tacacs-server key ...` and `radius-server key ...`
   - `pre-shared-key ...`
   - Any IPSec, IKE, or VPN authentication material

   Even when secrets are already hashed in the source, treat them as redactable. The input is private; the output is for sharing.

5. **Note gaps.** If a section the user might expect is absent (no description on an interface, no NTP, no AAA, no logging server, no banner), note it under a Gaps section. Do not recommend fixes; that is `audit`'s job. Use neutral language: "no description set", "AAA not configured", "logging server absent".

6. **Render the artifacts.** For a single device, produce: role paragraph, interface table, routing summary, VLAN table (if any), ACL inventory (if any), services block, management block, gaps block. For multiple devices, also produce: a Mermaid topology graph showing inter-device links inferred from interface descriptions and matching p2p subnets, plus a network-wide IP allocation table.

7. **Validate before ending:**

   - Every secret in the source is masked in the output
   - Every interface in the source either appears in the table or is explicitly noted as collapsed (e.g., "Fa0/1-24 unused, omitted")
   - The Mermaid graph is syntactically valid (`graph LR` or `graph TD` with proper node and edge syntax)
   - Routing summaries match the actual routing config; no neighbors or networks are hallucinated
   - The Gaps section makes neutral observations only; no recommendations

## User-facing progress updates

Send a short, one-line status update before each major phase so longer runs do not look stuck.

- "Pulling reference docs for syntax."
- "Identifying scope and platform."
- "Extracting structural data."
- "Redacting secrets."
- "Rendering tables and topology."
- "Noting gaps."

## Output format

**Single-device document.** Sections in this order:

- `# <hostname>`
- `## Role`: one short paragraph describing inferred role and key facts
- `## Interfaces`: a table with columns Name, Description, IP, Mask, VRF, VLAN or Trunk, MTU, Status
- `## Routing`: a protocol-by-protocol summary. For OSPF list areas, networks, stub or NSSA flags. For BGP list AS, neighbors, address families. For static routes list each.
- `## VLANs` (if L2 is configured): a table with columns VLAN ID, Name, Tagged ports, Untagged ports
- `## ACLs` (if any): for each ACL its name, direction, where applied, and a one-line summary of intent inferred from the rules (do not re-list every rule)
- `## Services`: a bulleted list covering SSH, SNMP, NTP, AAA, syslog, logging targets, banner state
- `## Management`: line vty / console settings, archive, transport methods
- `## Gaps`: a bulleted list of expected-but-absent settings, in neutral language, with no recommendations

**Multi-device network document.** Prepend with:

- `# <network or site name>`
- `## Topology`: a Mermaid `graph LR` or `graph TD` block, wrapped in a ` ```mermaid ` fenced code block so GitHub, Notion, and other Mermaid-aware renderers display it as a diagram rather than plain text. Nodes are devices; edges are inter-device links labeled with the interface names and the p2p subnet, e.g. `CR1 -- Eth1/1 (10.255.0.0/30) --- CR2:Eth1/1`
- `## IP allocation`: a network-wide table with columns Subnet, Device:Interface, VLAN, VRF, Description

Then continue with one device-level section per device, with the device hostname as `## <hostname>` (h2) and the device subsections shifted to h3 (`### Role`, `### Interfaces`, etc.) so the heading hierarchy stays consistent.

Mermaid topology limit: useful for logical and L3 topology. Not useful for physical cabling, patch panels, transceiver types, or rack layout. If the user asks for physical, say so and recommend a real diagramming tool (Visio, Lucidchart, draw.io) rather than producing a misleading Mermaid graph.

## Non-negotiable rules

- Redact every secret in the output. Even hashed secrets. Even if the user pasted them.
- Do not invent. If a description is missing, write "(no description set)". If a connected device is unknown, do not name a guess.
- Do not recommend changes. This is documentation, not audit.
- Every interface in the source must either appear in the output or be explicitly noted as collapsed. Silent omissions break trust in the doc.
- Mermaid output must be syntactically valid. If you cannot produce valid Mermaid for the inferred topology, say so and provide an interface table only.
- Wrap the Mermaid graph in a ` ```mermaid ` fenced code block. Without the language tag, GitHub, Notion, and most renderers treat it as plain text and the diagram never appears.
- Use neutral language in the Gaps section. "AAA not configured", not "AAA is missing and should be added".

## Dangerous patterns to avoid

- **Echoing secrets.** Even hashed passwords get masked. The output goes to wikis, tickets, handover docs; treat it as public.
- **Inferring topology from coincidence.** Two interfaces in the same subnet do not always mean they are cabled together. Only assert a connection from explicit interface descriptions like `to-CR1-Eth1/1` or from matching p2p subnets where the interpretation is unambiguous.
- **Mermaid for physical layout.** Mermaid is for logical topology. Do not try to render physical rack or cable layouts.
- **Recommending fixes.** "Add NTP" is `audit`'s job. Document only notes the gap.
- **Fabricating device roles.** If the role is ambiguous (could be a core or a distribution), say "role unclear from this config alone; interface count and protocol set suggest X" rather than asserting one.
- **Skipping the redaction pass.** Pasting an unredacted SNMP community or BGP MD5 key into a wiki is a real security incident. Always redact, even when the user did not ask for redaction.
