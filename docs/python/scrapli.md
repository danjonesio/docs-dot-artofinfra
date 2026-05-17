# Scrapli: Best Practices

Opinionated rules for using Scrapli for network device interaction. Scrapli is the modern alternative to Netmiko: prefer it for new projects.

## Why Scrapli Over Netmiko

- Native async support (`asyncssh` transport): no threading hacks
- Faster connection and command execution
- Better type hints and modern Python patterns
- `scrapli-community` for extended vendor support
- Plugin architecture (transports, channel operations)
- Use Netmiko when: you need maximum vendor breadth, or the team already knows it

## Connection Setup

- Always use context managers:

```python
from scrapli import Scrapli

device = {
    "host": "10.0.0.1",
    "auth_username": "admin",
    "auth_password": os.environ["DEVICE_PASSWORD"],
    "auth_strict_key": False,
    "platform": "cisco_iosxe",
    "transport": "asyncssh",  # or "system" for sync
}

# Sync
with Scrapli(**device) as conn:
    response = conn.send_command("show ip route")

# Async
async with AsyncScrapli(**device) as conn:
    response = await conn.send_command("show ip route")
```

- Set `auth_strict_key: False` in lab, but use `True` with proper known_hosts in production
- Use `transport: "system"` for sync scripts, `transport: "asyncssh"` for async
- **Never** hardcode credentials: environment variables or secrets manager

## Platform Strings

- Use the full platform string, not abbreviations:
  - `cisco_iosxe` (not `cisco_ios`: that's a different platform)
  - `cisco_nxos`
  - `cisco_iosxr`
  - `arista_eos`
  - `juniper_junos`
- For community-supported platforms: `pip install scrapli-community`, then use `scrapli_community.<vendor>.<platform>`

## Sending Commands

- Use `send_command()` for a single command, `send_commands()` for multiple:

```python
# Single command
response = conn.send_command("show ip bgp summary")
print(response.result)  # parsed/raw output

# Multiple commands: returns list of Response objects
responses = conn.send_commands(["show version", "show ip route", "show interfaces"])
for r in responses:
    print(r.result)
```

- Use `send_config()` for a single config line, `send_configs()` for multiple:

```python
conn.send_configs([
    "interface GigabitEthernet0/1",
    "description Uplink to Core",
    "no shutdown",
])
```

- Check `response.failed` before using the result:

```python
response = conn.send_command("show ip bgp summary")
if response.failed:
    print(f"Command failed: {response.channel_input}")
else:
    print(response.result)
```

## Parsing Output

- Use `send_command()` with `textfsm` or `genie` parsing:

```python
# TextFSM
response = conn.send_command("show ip interface brief")
structured = response.textfsm_parse_output()

# Genie
response = conn.send_command("show ip bgp summary")
structured = response.genie_parse_output()
```

- Same rule as Netmiko: **never** parse with regex when a parser exists

## Async Patterns

- Use `asyncio.gather()` for concurrent device interaction: this is Scrapli's strength:

```python
import asyncio
from scrapli import AsyncScrapli

async def collect_config(device: dict) -> str:
    async with AsyncScrapli(**device) as conn:
        response = await conn.send_command("show running-config")
        return response.result

async def main():
    tasks = [collect_config(d) for d in devices]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for device, result in zip(devices, results):
        if isinstance(result, Exception):
            print(f"Failed: {device['host']}: {result}")
        else:
            print(f"Collected: {device['host']}")

asyncio.run(main())
```

- Use `asyncio.Semaphore` to limit concurrency:

```python
sem = asyncio.Semaphore(20)

async def collect_config(device: dict) -> str:
    async with sem:
        async with AsyncScrapli(**device) as conn:
            response = await conn.send_command("show running-config")
            return response.result
```

## Scrapli Cfg

- Use `scrapli_cfg` for config management operations (replace, merge, diff):

```python
from scrapli_cfg import ScrapliCfg

with Scrapli(**device) as conn:
    cfg = ScrapliCfg(conn=conn)
    cfg.prepare()
    
    diff = cfg.diff_config(source="running", candidate=new_config)
    print(diff.side_by_side_diff)
    
    if confirm:
        cfg.load_config(config=new_config, replace=True)
        cfg.commit_config()
    
    cfg.cleanup()
```

## Dangerous Patterns to Avoid

- **Never** use `send_command()` for config changes or `send_config()` for show commands
- **Never** set `timeout_ops` too low: network devices can be slow. Default of 30s is usually fine; increase for long-running commands
- **Never** ignore `response.failed`: always check before using output
- **Never** use sync Scrapli with threading: use async Scrapli instead
