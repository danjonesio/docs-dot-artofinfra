# Jinja2 for Network Config Generation: Best Practices

Opinionated rules for using Jinja2 templates to generate network device configurations.

## Template Organisation

- One template per config section, not one per device:
  - `templates/interfaces.j2`
  - `templates/routing/bgp.j2`
  - `templates/routing/ospf.j2`
  - `templates/acl.j2`
  - `templates/ntp.j2`
- Separate templates by platform when syntax differs: `templates/ios-xe/bgp.j2`, `templates/nxos/bgp.j2`
- Never put an entire device config in one template: it becomes unmaintainable
- Compose full configs by rendering multiple templates in sequence

## Data Model

- Define your data model in YAML: never embed data in templates:

```yaml
# host_vars/rtr-core-01.yml
hostname: rtr-core-01
interfaces:
  - name: GigabitEthernet0/0
    description: Uplink to ISP-A
    ip_address: 203.0.113.1
    mask: 255.255.255.252
    shutdown: false
  - name: Loopback0
    description: Router ID
    ip_address: 10.255.0.1
    mask: 255.255.255.255
bgp:
  asn: 65001
  router_id: 10.255.0.1
  neighbors:
    - ip: 203.0.113.2
      remote_as: 64999
      description: ISP-A
      max_prefix: 1000
```

- Use descriptive key names: `ip_address` not `ip`, `remote_as` not `ras`
- Use lists of dicts for repeating structures (interfaces, neighbors, ACL entries)
- Use booleans for feature toggles: `shutdown: true`, not `state: "shutdown"`

## Template Syntax

- Use `{% set %}` for computed values: keep logic minimal but don't force it into the data model:

```jinja
{% set wildcard = mask | ipaddr('hostmask') %}
```

- Use `{% if %}` for optional config blocks: don't render empty sections:

```jinja
{% if bgp is defined %}
router bgp {{ bgp.asn }}
 bgp router-id {{ bgp.router_id }}
{% for neighbor in bgp.neighbors %}
 neighbor {{ neighbor.ip }} remote-as {{ neighbor.remote_as }}
 neighbor {{ neighbor.ip }} description {{ neighbor.description }}
{% if neighbor.max_prefix is defined %}
 neighbor {{ neighbor.ip }} maximum-prefix {{ neighbor.max_prefix }}
{% endif %}
{% endfor %}
{% endif %}
```

- Always use `is defined` checks for optional variables: never let templates crash on missing data
- Use `| default('value')` for sensible defaults, but prefer explicit data over hidden defaults

## Whitespace Control

- Use `{%-` and `-%}` to control whitespace around block tags:

```jinja
{%- for iface in interfaces %}
interface {{ iface.name }}
 description {{ iface.description }}
{%- if iface.ip_address is defined %}
 ip address {{ iface.ip_address }} {{ iface.mask }}
{%- endif %}
{%- if not iface.shutdown | default(true) %}
 no shutdown
{%- endif %}
!
{%- endfor %}
```

- Never leave blank lines in rendered config caused by Jinja control structures: it confuses diff tools and config replace operations
- Use `| indent(n)` for hierarchical config (especially Junos):

```jinja
protocols {
    bgp {
{{ bgp_config | indent(8, first=True) }}
    }
}
```

## Filters

- Use `| ipaddr` (from `netaddr` / Ansible `ipaddr` filter) for IP manipulation: never parse IPs with string operations
- Use `| int` when a numeric value might arrive as a string from YAML
- Write custom filters for vendor-specific transformations (e.g., subnet mask ↔ wildcard mask)
- Never use `| replace()` to fix template output: fix the template structure instead

## Testing Templates

- Render templates locally before pushing to devices:

```python
from jinja2 import Environment, FileSystemLoader

env = Environment(
    loader=FileSystemLoader("templates"),
    undefined=StrictUndefined,  # Fail on missing vars
    trim_blocks=True,
    lstrip_blocks=True,
)

template = env.get_template("bgp.j2")
output = template.render(bgp=data["bgp"])
print(output)
```

- Always use `StrictUndefined` during development: catch missing variables before they reach a device
- Use `trim_blocks=True` and `lstrip_blocks=True` in your environment to clean up whitespace automatically

## Dangerous Patterns to Avoid

- **Never** use Jinja2 `{% for %}` to build ACL sequence numbers manually: let the device assign them or use a counter variable
- **Never** nest more than 3 levels of Jinja logic: if your template is that complex, restructure your data model
- **Never** use `| safe` on user-supplied data
- **Never** generate passwords or secrets in templates: pass them in from a vault
- **Never** mix tabs and spaces in templates: use spaces only, matching the device's config style (typically 1 space for IOS, 4 spaces for Junos)
