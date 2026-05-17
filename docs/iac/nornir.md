# Nornir: Best Practices

Opinionated rules for using Nornir for network automation. Nornir is a Python automation framework: think of it as "Ansible but in pure Python, with real code instead of YAML."

## When to Use Nornir

- When you need the control of Python but the scale of Ansible
- When Ansible's YAML-based approach feels limiting (complex conditionals, custom logic, API integrations)
- When you want inventory management + concurrent task execution without writing the scaffolding yourself
- When you want to integrate network automation into a larger Python application (e.g., a Django/FastAPI API, a CI pipeline)

## Inventory

- Use the `SimpleInventory` plugin for small environments, `NetBox` plugin for anything with more than ~50 devices
- Structure your inventory with YAML files:

```
inventory/
├── hosts.yaml        # Per-device: hostname, platform, groups
├── groups.yaml       # Shared settings by group (credentials, connection params)
└── defaults.yaml     # Fallback values
```

- Group by platform and role, same as you would in Ansible:

```yaml
# hosts.yaml
rtr-core-01:
  hostname: 10.0.0.1
  groups:
    - cisco_ios
    - core_routers

# groups.yaml
cisco_ios:
  platform: ios
  connection_options:
    netmiko:
      extras:
        device_type: cisco_ios
    scrapli:
      extras:
        auth_strict_key: false
```

- **Never** put credentials in inventory files: use environment variables, `nornir_utils` `load_credentials`, or a secrets manager

## Task Design

- Keep tasks small and focused: one task per operation
- Use `Result` objects properly: always check `result.failed`:

```python
from nornir import InitNornir
from nornir_scrapli.tasks import send_command

nr = InitNornir(config_file="config.yaml")

result = nr.run(task=send_command, command="show ip route")

for host, r in result.items():
    if r.failed:
        print(f"FAILED: {host}: {r.exception}")
    else:
        print(f"{host}: {r.result}")
```

- Use grouped tasks for multi-step operations:

```python
from nornir.core.task import Task, Result

def deploy_bgp(task: Task) -> Result:
    """Grouped task: render template, push config, verify."""
    # Step 1: Render
    config = task.run(task=template_file, template="bgp.j2", path="templates/")
    
    # Step 2: Push
    task.run(task=send_config, config=config.result)
    
    # Step 3: Verify
    result = task.run(task=send_command, command="show ip bgp summary")
    
    return Result(host=task.host, result="BGP deployed and verified")
```

## Plugins

- **Connection**: Use `nornir_scrapli` over `nornir_netmiko` for new projects: async support, better performance
- **Tasks**: Use `nornir_scrapli.tasks` or `nornir_netmiko.tasks` for device interaction
- **Templates**: Use `nornir_jinja2` for config rendering: follows the same Jinja2 rules in `https://docs.artofinfra.com/python/jinja-templates.md`
- **Inventory**: `nornir_netbox` for NetBox-backed inventory, `SimpleInventory` for file-based
- Write custom tasks as plain Python functions: Nornir's strength is that tasks are just code

## Filtering

- Use Nornir's filter system to target specific devices:

```python
# By group
core = nr.filter(groups__contains="core_routers")

# By platform
ios = nr.filter(platform="ios")

# By custom attribute
dc1 = nr.filter(site="dc1")

# Combine filters
dc1_ios = nr.filter(platform="ios", site="dc1")
```

- **Never** run tasks against the full inventory in production without filtering first: always target a specific group

## Concurrency

- Nornir runs tasks concurrently by default using threading
- Set `num_workers` in config to control parallelism:

```yaml
# config.yaml
runner:
  plugin: threaded
  options:
    num_workers: 20
```

- Cap workers at a reasonable number: 20-30 is usually safe. More than that risks overloading devices with limited VTY lines

## Error Handling

- Use `raise_on_error=False` (default) and check results per-host
- Use `failed_hosts` to track which hosts failed and retry:

```python
result = nr.run(task=send_command, command="show version")

# Get only failed hosts
failed = nr.filter(filter_func=lambda h: h.name in result.failed_hosts)

# Retry
retry_result = failed.run(task=send_command, command="show version")
```

## Dangerous Patterns to Avoid

- **Never** use `nr.run()` without inspecting results: silent failures are the worst kind
- **Never** commit config changes without a verification step in the grouped task
- **Never** use `num_workers=100`: you'll exhaust device VTY lines and get connection refused errors everywhere
- **Never** skip inventory validation: a typo in `hostname` means Nornir connects to the wrong device or fails silently
