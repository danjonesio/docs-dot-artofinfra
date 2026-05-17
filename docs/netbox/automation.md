# NetBox Automation: Best Practices

Opinionated rules for using NetBox as your automation source of truth. NetBox's value multiplies when automation tools read from it: without automation consumers, NetBox is just a pretty spreadsheet.

## Core Principle

NetBox describes **intended state**. Automation tools read intended state from NetBox and push it to devices. Monitoring tools read **operational state** from devices. The workflow is:

```
Engineer updates NetBox → Automation reads NetBox → Automation configures devices → Monitoring validates state
```

Never reverse this flow. Devices don't write back to NetBox (with narrow exceptions like discovery/reconciliation jobs).

## API Authentication

- Create a **separate API token per integration**: one for Ansible, one for your CI/CD pipeline, one for the monitoring sync. Never share tokens across tools
- Set the minimum required permissions on each token: the Ansible read-only inventory plugin doesn't need write access
- Use token expiry and rotation: set an expiry date and rotate before it hits
- Never embed tokens in code: use environment variables or a secrets manager:

```python
# Good
import os
import pynetbox

nb = pynetbox.api(
    os.environ["NETBOX_URL"],
    token=os.environ["NETBOX_TOKEN"],
)

# Bad
nb = pynetbox.api("https://netbox.example.com", token="abc123deadbeef")
```

## REST API

- Use filtering, not client-side loops: the API supports rich filtering on almost every field:

```python
# Good: server-side filter
devices = nb.dcim.devices.filter(site="us-iad-dc1", role="core-router", status="active")

# Bad: fetch all, filter locally
all_devices = nb.dcim.devices.all()
devices = [d for d in all_devices if d.site.slug == "us-iad-dc1"]
```

- Use `brief` mode when you only need names and IDs: cuts response size significantly:

```python
# Returns minimal objects: fast for inventory building
devices = nb.dcim.devices.filter(site="us-iad-dc1", brief=True)
```

- Paginate large queries: the default limit is 50 objects. `pynetbox` handles this automatically, but raw HTTP callers must follow `next` links
- Use `limit=0` with caution: it returns everything in one response and can overwhelm both NetBox and your client on large instances
- Batch writes with bulk endpoints when creating/updating many objects: don't loop single-object POSTs

## GraphQL API

- Use GraphQL for complex read queries that span multiple object types: fewer round trips than chaining REST calls:

```graphql
# Get devices with their primary IPs and site info in one query
{
  device_list(filters: {site: "us-iad-dc1", role: "core-router"}) {
    name
    primary_ip4 { address dns_name }
    site { name region { name } }
    platform { name napalm_driver }
    config_context
  }
}
```

- GraphQL is **read-only** in NetBox: all mutations go through REST
- Use GraphQL for reporting and dashboards, REST for automation that reads and writes

## Ansible Inventory Plugin

- Use `netbox.netbox.nb_inventory`: it reads devices, IPs, and metadata directly from NetBox:

```yaml
# inventory/netbox.yml
plugin: netbox.netbox.nb_inventory
api_endpoint: "https://netbox.example.com"
token: "{{ lookup('env', 'NETBOX_TOKEN') }}"
validate_certs: true

group_by:
  - site
  - device_role
  - platform

query_filters:
  - status: active
  - has_primary_ip: true

compose:
  ansible_host: primary_ip4.address | ansible.utils.ipaddr('address')
  ansible_network_os: platform.napalm_driver
```

- Always filter with `has_primary_ip: true`. Devices without a primary IP are unreachable and will break your playbook
- Group by `site`, `device_role`, and `platform`: these are the three axes you'll target most plays against
- Use `compose` to map NetBox fields to Ansible variables: `ansible_host`, `ansible_network_os`, `ansible_user`
- Never duplicate inventory data: if it's in NetBox, read it from NetBox. The moment you hardcode a host in your Ansible inventory alongside the NetBox plugin, you have two sources of truth

## Nornir Inventory Plugin

- Use `nornir_netbox` to pull inventory directly:

```python
from nornir import InitNornir

nr = InitNornir(
    inventory={
        "plugin": "NBInventory",
        "options": {
            "nb_url": os.environ["NETBOX_URL"],
            "nb_token": os.environ["NETBOX_TOKEN"],
            "filter_parameters": {
                "status": "active",
                "has_primary_ip": True,
                "site": "us-iad-dc1",
            },
        },
    },
)
```

- Apply the same rules as Ansible: filter active devices with primary IPs, never duplicate inventory data

## Webhooks

- Use webhooks to trigger automation on NetBox data changes: device created, IP assigned, cable connected
- Send webhooks to a message queue or workflow engine (AWX, StackStorm, n8n), not directly to device config tools: NetBox changes need validation and approval before hitting production
- Filter webhook events tightly: a webhook that fires on every object change will overwhelm your receiver:

```
Object type: dcim.device
Event: Updated
Conditions: {"status": "active", "site__name": "us-iad-dc1"}
```

- Set a webhook secret and validate it on the receiver side: unauthenticated webhooks are a security hole
- Use idempotent receivers: webhooks can fire more than once (retries on failure)

## CI/CD Integration

- Validate NetBox data in CI before it reaches automation: run checks like:
  - Every active device has a primary IP
  - Every prefix has a site and role
  - No duplicate IPs within a VRF
  - Custom field validation (lifecycle status, contract data)
- Use NetBox's REST API in your pipeline to pull data, render configs (with config templates or Jinja2), and diff against running config
- Gate deployments on NetBox data quality: if the data is wrong, the automation will push wrong config

## Dangerous Patterns to Avoid

- **Never** let automation write to NetBox without human review: the flow is human → NetBox → automation → device, not device → NetBox
- **Never** share a single API token across all integrations: one compromised tool exposes everything
- **Never** fetch all objects without filtering: `nb.dcim.devices.all()` on a 10,000-device instance will timeout or OOM
- **Never** hardcode inventory alongside a dynamic NetBox source: you'll forget which source is authoritative
- **Never** use webhooks to directly push config to devices without a validation step: a typo in NetBox shouldn't instant-crash production
- **Never** skip `validate_certs: true` in production. MITM attacks on your source of truth are catastrophic
