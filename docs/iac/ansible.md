# Ansible for Network Automation: Best Practices

Opinionated rules for using Ansible to automate network devices. Covers module selection, inventory patterns, and network-specific gotchas.

## Connection & Transport

- Use `ansible.netcommon.network_cli` connection plugin for SSH-based devices
- Use `ansible.netcommon.httpapi` for REST/API-based devices (NX-OS NX-API, IOS-XE RESTCONF)
- Never use `paramiko`: use `libssh` or `ssh` as the underlying transport
- Set `persistent_connect_timeout` and `persistent_command_timeout` in `ansible.cfg`: network devices are slow

```ini
[persistent_connection]
connect_timeout = 30
command_timeout = 60
```

## Credentials

- **Never** store credentials in playbooks, inventory, or group_vars in plain text
- Use `ansible-vault` for encrypted vars at minimum
- Better: use environment variables or a secrets manager (HashiCorp Vault, 1Password CLI, etc.)
- Use `ansible_become` and `ansible_become_method: enable` for IOS/NX-OS enable mode: don't hardcode `enable` commands in tasks

## Inventory

- Use YAML inventory, not INI: it handles nested groups and variables better
- Group by platform, then by role:

```yaml
all:
  children:
    cisco_ios:
      children:
        core_routers:
          hosts:
            rtr-core-01:
            rtr-core-02:
        access_switches:
          hosts:
            sw-acc-01:
    cisco_nxos:
      children:
        dc_spines:
          hosts:
            nx-spine-01:
```

- Set platform variables in `group_vars/<platform>.yml`:

```yaml
# group_vars/cisco_ios.yml
ansible_network_os: cisco.ios.ios
ansible_connection: ansible.netcommon.network_cli
```

- Never set connection details per-host unless genuinely unique

## Module Selection

- Use `cli_config` (from `ansible.netcommon`) for multi-vendor consistency when pushing raw config lines
- Use platform-specific modules (`cisco.ios.ios_bgp_global`, `cisco.nxos.nxos_interfaces`) when you need idempotent, structured config management
- Use `cli_command` for read-only operations (show commands, verification)
- **Never** use `raw` or `shell` for network devices: they don't understand network connection plugins

### When to use which

| Scenario | Module |
|---|---|
| Push a block of config lines | `cli_config` |
| Manage a specific feature idempotently | Platform resource module (`ios_interfaces`, `nxos_bgp_global`) |
| Run show commands | `cli_command` |
| Template and push full config sections | `cli_config` with `template` source |
| Backup running config | Platform `_config` module with `backup: yes` |

## Playbook Structure

- One playbook per operation type: `deploy-bgp.yml`, `backup-configs.yml`, `harden-devices.yml`
- Use roles for reusable config bundles, playbooks for orchestration
- Always set `gather_facts: no` for network devices: the default fact gathering doesn't work over network_cli
- Use `ansible.netcommon.cli_parse` to parse show command output into structured data (with NTC Templates or TextFSM)

## Templates (Jinja2)

- See `https://docs.artofinfra.com/python/jinja-templates.md` for Jinja2 rules: they apply here too
- Use `ansible.builtin.template` to render config, then push with `cli_config`
- Keep templates in `templates/<platform>/`: never mix IOS and NX-OS templates in one directory
- Always use `| indent(n)` for Junos hierarchical config rendering
- Never use `| replace` in templates to fix formatting: fix the template itself

## Idempotency

- Always test idempotency: run the playbook twice and verify zero changes on the second run
- Use `--check` mode (dry run) before every production run
- Use `--diff` to see what would change
- Be aware: `cli_config` with `lines` is idempotent by default (compares against running-config), but `cli_config` with `src` (template source) may not be: it compares the full rendered block
- Some platform modules have known idempotency bugs: always verify in lab

## Error Handling

- Use `ignore_errors: false` (the default): never silently swallow errors
- Use `block/rescue` for multi-step changes that need rollback:

```yaml
- block:
    - name: Apply new BGP config
      cli_config:
        config: "{{ lookup('template', 'bgp.j2') }}"
    - name: Verify BGP neighbours
      cli_command:
        command: show ip bgp summary
      register: bgp_result
    - name: Fail if no neighbours up
      assert:
        that: "'Established' in bgp_result.stdout"
  rescue:
    - name: Rollback to saved config
      cli_command:
        command: configure replace flash:rollback-config force
```

- Always verify after apply: never assume config push = config working

## CI/CD

- Run `ansible-lint` in CI: catch bad patterns before they reach production
- Use `--syntax-check` as a CI gate
- Use `ansible-navigator` for consistent execution environments
- Tag tasks for selective execution: `--tags bgp`, `--skip-tags dangerous`
- Use `serial: 1` (or a small batch) for production changes: never push to all devices at once

## Dangerous Patterns to Avoid

- **Never** use `commands` lists that include `write memory` / `copy run start` in the middle of a playbook: save config as the final step only, after verification
- **Never** use `cli_config` with `replace: config` unless you have tested the full replacement config in lab
- **Never** run playbooks against `all` in production: always target a specific group
- **Never** use `ansible-pull` for network devices: it makes no sense in the network context
