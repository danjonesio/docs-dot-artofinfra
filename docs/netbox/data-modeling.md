# NetBox Data Modeling: Best Practices

Opinionated rules for modeling your network in NetBox. Getting the data model right is the single most consequential decision you'll make: everything downstream (IPAM, automation, reporting) depends on it.

## Site Hierarchy

- Use the full hierarchy: **Region → Site Group → Site → Location → Rack**
- Regions model geography (Americas, EMEA, APAC). Site groups model function (Production DCs, Office sites, Colo)
- Every device lives in a site. No exceptions. If a device doesn't have a clear site, your hierarchy is wrong
- Use locations within sites for rooms, floors, cages, or halls: don't overload site names like `DC1-Floor3-CageA`

```
Region: North America
  └── Site Group: Production Data Centers
        └── Site: us-east-dc1
              ├── Location: Network Room A
              │     └── Rack: US-EAST-DC1-NRA-R01
              └── Location: Network Room B
                    └── Rack: US-EAST-DC1-NRB-R01
```

- Name sites with a consistent, parseable slug: `{country}-{city}-{function}{number}`. Examples: `us-iad-dc1`, `gb-lon-ofc2`
- Set the physical address, GPS coordinates, and time zone on every site: automation tools use time zone for maintenance windows

## Device Types

- Always create device types from manufacturer library data: use the [NetBox Device Type Library](https://github.com/netbox-community/devicetype-library) as your starting point
- Define every interface, power port, console port, and module bay on the device type: not ad-hoc on individual devices
- Never create a generic "Router" or "Switch" device type. Model the exact hardware: `ISR4451-X`, `QFX5120-48Y`, `ASR9901`
- Set `u_height`, `is_full_depth`, and `weight` accurately: these drive rack elevation drawings and capacity planning
- Use module types for line cards, supervisor engines, and optics: model the physical hierarchy

## Device Roles

- Device roles describe **function**, not vendor or model: `core-router`, `access-switch`, `firewall`, `oob-console`, not `cisco-router` or `nexus-switch`
- Keep the list short (8–15 roles). If you have 30+ roles, you're encoding too much into the role: use tags or custom fields for the extra detail
- Assign a colour to each role: rack elevations become immediately readable when roles have distinct colours
- Every device must have exactly one role. If a device genuinely serves two functions (e.g., router + firewall), pick the primary one and tag the secondary

## Platforms

- Create a platform for every distinct NOS + version combination you manage: `ios-xe-17.9`, `junos-23.2`, `nxos-10.3`
- Set the NAPALM driver on the platform if you use NAPALM: this is how NetBox integrations know how to connect
- Set the manufacturer on every platform: this enforces that you can't accidentally assign a Junos platform to a Cisco device
- Don't create platforms like "Linux" or "Other": every device should map to a specific, automatable platform

## Tenancy

- Use tenants for **billing or organisational ownership**: "this device belongs to Customer X" or "this prefix is allocated to Team Y"
- Don't use tenants for environment (prod/staging/dev) or function: use tags or custom fields for those
- Use tenant groups to model your customer or org hierarchy: `Internal → Engineering`, `Customers → Acme Corp`
- Assign tenancy at the most specific level: if a prefix has a different owner than its parent, set it on the prefix, not just the VRF

## Custom Fields

- Use custom fields sparingly: if NetBox has a native field for it, use the native field
- Every custom field must have a `description` that explains what it's for and what values are valid
- Set validation rules (regex, min/max) on every custom field: unvalidated free-text fields become a garbage dump
- Use choice fields instead of free-text whenever the value set is bounded: `environment: [prod, staging, dev]` not a text field
- Group related custom fields with a common prefix: `contract_id`, `contract_expires`, `contract_vendor`
- Never store secrets (passwords, API keys, SNMP communities) in custom fields: use a secrets manager and reference the secret ID

```yaml
# Good: bounded choice field with validation
name: lifecycle_status
type: selection
choices:
  - active
  - end-of-sale
  - end-of-support
  - decommissioning
required: true
description: "Hardware lifecycle status per vendor EOL notices"

# Bad: unvalidated free text
name: status
type: text
required: false
description: ""
```

## Tags

- Tags are for **cross-cutting concerns** that don't fit into the object hierarchy: `needs-upgrade`, `monitored`, `out-of-band`, `pci-scope`
- Don't duplicate what roles or tenants already express: `role:firewall` is a role, not a tag
- Use a consistent naming convention: lowercase and hyphenated. For example, `pci-scope`, not `PCI Scope` or `pci_scope`
- Set a colour on every tag: dashboards and lists become scannable
- Tags are free-form by default: if you need controlled values, use a custom field instead

## Naming Conventions

- Device names must be globally unique, parseable, and match what's configured on the device (hostname):

```
{site}-{role}{number}.{domain}
us-iad-dc1-cr01.infra.example.com
us-iad-dc1-asw03.infra.example.com
gb-lon-ofc1-fw01.infra.example.com
```

- Interface descriptions in NetBox should match what's configured on the device: automation should enforce this
- Use the same slug format across sites, racks, and devices: consistency beats creativity
- Document your naming standard in NetBox's custom links or in a dedicated wiki page linked from the NetBox home

## Cables and Connections

- Cable every connection: even if it's just copper patch cables. Incomplete cabling data is worse than no cabling data because it looks authoritative but lies
- Set cable type (CAT6, SMF, MMF, DAC) and length on every cable: these feed capacity planning and troubleshooting
- Use cable labels that match the physical label on the cable: `A:us-iad-dc1-cr01:Eth1/1 ↔ B:us-iad-dc1-cr02:Eth1/1`
- Model both front and rear ports on patch panels: NetBox traces paths end-to-end only when both sides are cabled

## Dangerous Patterns to Avoid

- **Never** use NetBox as a monitoring tool: it describes intended state, not live state. Use it alongside your monitoring stack, not instead of it
- **Never** create devices without a site, role, and platform: incomplete records cascade into broken automation
- **Never** let users free-type values that should be controlled: use choice fields, validation regex, or custom validators
- **Never** model logical constructs (VRFs, VLAN groups) as physical sites or locations
- **Never** skip cable modelling "because we'll do it later": later never comes and you lose the source-of-truth value
- **Never** store sensitive data (credentials, SNMP communities, API keys) in custom fields or the comments field
