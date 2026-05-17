# NetBox Config Contexts: Best Practices

Opinionated rules for using config contexts and config templates to generate device configurations from NetBox data. This is where NetBox transitions from "inventory database" to "configuration source of truth".

## Config Contexts

Config contexts are hierarchical JSON data blocks that NetBox merges and attaches to devices based on matching rules (site, role, platform, tag, etc.). They feed structured data into config templates or external automation tools.

### Design Principles

- Config contexts represent **data**, not config syntax: store values like NTP servers, SNMP communities, syslog targets, not CLI commands:

```json
// Good: structured data
{
  "ntp": {
    "servers": ["10.0.0.1", "10.0.0.2"],
    "timezone": "UTC"
  },
  "snmp": {
    "location": "us-iad-dc1",
    "contact": "noc@example.com",
    "communities": {
      "read": "public-ro",
      "write": "private-rw"
    }
  },
  "syslog": {
    "servers": ["10.0.0.10"],
    "facility": "local7"
  }
}

// Bad: CLI commands in JSON
{
  "ntp_config": "ntp server 10.0.0.1\nntp server 10.0.0.2"
}
```

- Use the merge hierarchy to layer context from general to specific:

```
Weight 100: Global defaults       (NTP, SNMP, syslog; applies to all devices)
Weight 200: Per-site overrides    (site-specific NTP, DNS servers)
Weight 300: Per-role overrides    (core-router gets iBGP config data, access-switch gets STP data)
Weight 400: Per-platform overrides (IOS-XE gets different SNMP OID mappings than NX-OS)
Weight 500: Per-device overrides  (specific device quirks; use sparingly)
```

- Higher weight wins when keys conflict. Set weights deliberately: don't leave everything at the default
- Assign contexts to the broadest scope that applies: a context that applies to all devices in a site should match on site, not be duplicated per-device

### Scoping Rules

- Use **tags** for cross-cutting contexts that don't map to site/role/platform: `pci-scope` devices get a PCI-specific SNMP context, `out-of-band` devices get an OOB management context
- Every context must have a `name` and `description` that explains what it provides and why: `Global NTP and Syslog` not `context-1`
- Test your merge order: use the NetBox UI or API to view a device's rendered config context and verify the merge is correct:

```python
# Check merged config context for a specific device
import pynetbox

nb = pynetbox.api(os.environ["NETBOX_URL"], token=os.environ["NETBOX_TOKEN"])
device = nb.dcim.devices.get(name="us-iad-dc1-cr01")
print(device.config_context)
```

### Data Schema

- Define a consistent JSON schema for your config contexts and document it: every integration consuming config contexts expects a specific structure:

```json
{
  "dns": {
    "servers": ["<ip>", "..."],
    "domain": "<string>",
    "search": ["<domain>", "..."]
  },
  "ntp": {
    "servers": ["<ip>", "..."],
    "timezone": "<tz string>"
  },
  "aaa": {
    "tacacs_servers": ["<ip>", "..."],
    "tacacs_key_ref": "<secrets-manager-id>",
    "local_users": [
      {"username": "<string>", "privilege": 15, "role": "admin"}
    ]
  }
}
```

- Don't put secrets in config contexts: store a reference (secret ID, vault path) and resolve it at render time
- Use consistent key naming: `snake_case`, no abbreviations. For example, `tacacs_servers` not `tac_svrs`

## Config Templates

Config templates are Jinja2 templates stored in NetBox that render device-specific configurations using the device's data and config context.

### Template Structure

- One template per platform per config section: don't try to build one universal template that handles every vendor:

```
Template: ios-xe-base
  Platform: ios-xe-17.9
  Renders: hostname, NTP, SNMP, syslog, AAA, banner

Template: nxos-base
  Platform: nxos-10.3
  Renders: hostname, NTP, SNMP, syslog, AAA, banner

Template: ios-xe-bgp
  Platform: ios-xe-17.9
  Renders: BGP config for devices with role core-router
```

- Use template inheritance or includes for shared logic: don't duplicate the NTP block across every template

### Writing Templates

- Always include a generation header so engineers know the config is managed:

```jinja2
!
! ==========================================
! MANAGED BY NETBOX: DO NOT EDIT MANUALLY
! Device: {{ device.name }}
! Site:   {{ device.site.name }}
! Generated: {{ now }}
! ==========================================
!
```

- Use strict undefined handling: fail loudly on missing variables rather than rendering empty config:

```jinja2
{# Good: explicit check #}
{% if config_context.ntp is defined and config_context.ntp.servers %}
{% for server in config_context.ntp.servers %}
ntp server {{ server }}
{% endfor %}
{% else %}
! ERROR: No NTP servers defined in config context
{% endif %}
```

- Use Jinja2 filters for formatting: `ipaddr` for IP manipulation, `default` for fallbacks:

```jinja2
hostname {{ device.name }}
!
{% for ip in config_context.dns.servers %}
ip name-server {{ ip }}
{% endfor %}
ip domain name {{ config_context.dns.domain | default("infra.example.com") }}
!
{% for server in config_context.ntp.servers %}
ntp server {{ server }}
{% endfor %}
clock timezone {{ config_context.ntp.timezone | default("UTC") }}
!
snmp-server location {{ device.site.name }}
snmp-server contact {{ config_context.snmp.contact }}
{% for server in config_context.syslog.servers %}
logging host {{ server }}
{% endfor %}
logging facility {{ config_context.syslog.facility | default("local7") }}
```

### Rendering and Deployment

- Render configs in CI/CD and diff against running config before deploying: never push rendered config blindly:

```bash
# Pipeline step: render, diff, then deploy with approval
python render_configs.py --site us-iad-dc1 --output rendered/
python diff_configs.py --rendered rendered/ --running backup/
# Human reviews diff → approves → automation pushes
```

- Store rendered configs in git for audit trail: commit the output of each render run
- Version your templates alongside your automation code: template changes should go through code review

## Combining Contexts and Templates with Automation

The full workflow:

1. Engineer updates data in NetBox (new device, IP change, site addition)
2. Config contexts merge automatically based on the device's attributes
3. CI/CD pipeline triggers (via webhook or schedule)
4. Pipeline renders config templates using device data + merged config context
5. Pipeline diffs rendered config against running config
6. Engineer reviews and approves the diff
7. Automation pushes approved changes to devices

```python
# Simplified render loop
for device in nb.dcim.devices.filter(site="us-iad-dc1", status="active"):
    context = device.config_context
    template = env.get_template(f"{device.platform.slug}-base.j2")
    rendered = template.render(device=device, config_context=context)

    with open(f"rendered/{device.name}.conf", "w") as f:
        f.write(rendered)
```

## Dangerous Patterns to Avoid

- **Never** put CLI commands in config context JSON: contexts are data, templates are syntax
- **Never** store secrets (passwords, SNMP community strings, TACACS keys) directly in config contexts: store vault references and resolve at render time
- **Never** leave config context weights at default: ambiguous merge order causes unpredictable rendering
- **Never** build one mega-template for all platforms: vendor syntax differences make this unmaintainable past two vendors
- **Never** push rendered configs to devices without a diff and review step: a bad template renders bad config on every device it touches
- **Never** edit rendered config files by hand: if the output is wrong, fix the template or the context data, not the output
