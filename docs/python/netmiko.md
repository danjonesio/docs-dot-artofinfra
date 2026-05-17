# Netmiko: Best Practices

Opinionated rules for using Netmiko for network device interaction.

## When to Use Netmiko

- Quick scripts for one-off tasks (config pushes, show commands, backups)
- When you need broad vendor support with minimal setup
- Legacy device interaction where REST APIs aren't available
- Consider Scrapli (see `https://docs.artofinfra.com/python/scrapli.md`) for better performance and async support

## Connection Setup

- Always use context managers: never call `disconnect()` manually:

```python
# Good
from netmiko import ConnectHandler

with ConnectHandler(**device) as conn:
    output = conn.send_command("show ip route")

# Bad: fragile, leaks connections on exception
conn = ConnectHandler(**device)
output = conn.send_command("show ip route")
conn.disconnect()
```

- Define device dictionaries in config files or inventory, not inline:

```python
# Good: device definitions in a separate file
import yaml

with open("inventory.yml") as f:
    inventory = yaml.safe_load(f)

for device in inventory["routers"]:
    with ConnectHandler(**device) as conn:
        ...

# Bad: hardcoded everywhere
device = {
    "device_type": "cisco_ios",
    "host": "192.168.1.1",
    "username": "admin",
    "password": "hunter2",  # Never hardcode credentials
}
```

- **Never** hardcode credentials: use environment variables, `.env` files (excluded from git), or a secrets manager

## Sending Commands

- Use `send_command()` for show commands, `send_config_set()` for config changes: never mix them
- Always set `read_timeout` for slow commands:

```python
output = conn.send_command("show tech-support", read_timeout=120)
```

- Use `expect_string` when the default prompt detection fails (e.g., confirmation prompts):

```python
output = conn.send_command(
    "delete flash:old-config.bak",
    expect_string=r"confirm",
)
conn.send_command("y", expect_string=r"#")
```

- Use `send_config_set()` with a list, not a multi-line string:

```python
# Good
commands = [
    "interface GigabitEthernet0/1",
    "description Uplink to Core",
    "no shutdown",
]
conn.send_config_set(commands)

# Bad
conn.send_config_set("interface Gi0/1\ndescription Uplink\nno shut")
```

## Parsing Output

- **Never** parse show command output with regex: use TextFSM or Genie:

```python
# Good: structured data
output = conn.send_command("show ip interface brief", use_textfsm=True)
# Returns list of dicts: [{"interface": "Gi0/1", "ip_address": "10.0.0.1", ...}]

# Bad: fragile regex
import re
output = conn.send_command("show ip interface brief")
interfaces = re.findall(r"(\S+)\s+(\d+\.\d+\.\d+\.\d+)", output)
```

- Use `use_genie=True` for Cisco devices: Genie parsers are generally more comprehensive than TextFSM
- If no parser exists, use `send_command()` with raw output and parse with `netutils` or write a TextFSM template: don't inline regex

## Error Handling

- Catch `NetmikoTimeoutException` and `NetmikoAuthenticationException` separately:

```python
from netmiko import ConnectHandler
from netmiko.exceptions import (
    NetmikoTimeoutException,
    NetmikoAuthenticationException,
)

try:
    with ConnectHandler(**device) as conn:
        output = conn.send_command("show version")
except NetmikoTimeoutException:
    print(f"Timeout connecting to {device['host']}")
except NetmikoAuthenticationException:
    print(f"Auth failed for {device['host']}")
```

- Always verify config changes by running a show command after `send_config_set()`
- Use `conn.save_config()` only after verification: never auto-save

## Concurrency

- Netmiko is synchronous: for multi-device scripts, use `concurrent.futures`:

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def collect_config(device):
    with ConnectHandler(**device) as conn:
        return conn.send_command("show running-config")

with ThreadPoolExecutor(max_workers=10) as pool:
    futures = {pool.submit(collect_config, d): d for d in devices}
    for future in as_completed(futures):
        device = futures[future]
        try:
            config = future.result()
        except Exception as e:
            print(f"Failed: {device['host']}: {e}")
```

- Cap `max_workers`: network devices have limited VTY lines. 10-20 is usually safe.
- For async, use Scrapli instead (see `https://docs.artofinfra.com/python/scrapli.md`)

## Dangerous Patterns to Avoid

- **Never** use `send_command_timing()` as your default: it uses sleep-based timing instead of prompt detection. Only use it when `send_command()` genuinely can't detect the prompt.
- **Never** use `send_config_set()` with `exit_config_mode=False` unless you have a very specific reason
- **Never** call `save_config()` without verifying the change first
- **Never** use `enable()` then forget to handle the case where enable fails
