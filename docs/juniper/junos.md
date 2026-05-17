# Junos OS: Best Practices

Opinionated rules for Junos OS platforms (MX, QFX, EX, SRX). These cover the OS-level patterns: see `https://docs.artofinfra.com/juniper/srx.md` for security-specific config.

## Commit Model

- Always use `commit confirmed <minutes>` for remote changes: if you lock yourself out, the config rolls back automatically
- Use `commit comment "<ticket-id>: <description>"` on every commit: `show system commit` becomes your change log
- Use `commit check` before `commit` to validate syntax without applying
- Use `rollback 1` to undo the last change, `rollback <n>` for earlier configs: Junos keeps 50 rollbacks by default
- Use `show | compare rollback <n>` to diff against a previous config before committing
- Never `commit` a config you haven't reviewed with `show | compare`

## Configuration Style

- Use `set` commands for scriptable/automatable config: use `edit` mode for interactive work
- Use `groups` and `apply-groups` for config inheritance across interfaces/protocols:

```
groups {
    EDGE-INTERFACES {
        interfaces {
            <ge-*> {
                mtu 9192;
                unit 0 {
                    family inet {
                        filter {
                            input EDGE-PROTECT;
                        }
                    }
                }
            }
        }
    }
}
apply-groups EDGE-INTERFACES;
```

- Use `apply-path` in prefix-lists to auto-populate from config:

```
policy-options {
    prefix-list BGP-NEIGHBORS {
        apply-path "protocols bgp group <*> neighbor <*>";
    }
}
```

- Use `deactivate` instead of deleting config you might need again: it stays in the config but isn't applied
- Always use hierarchical config in templates: never generate flat `set` commands in Jinja2 unless you're building a one-off script

## Interfaces

- Always set `description` on every interface
- Set `mtu 9192` on all fabric/core links for jumbo frame support
- Use `family inet` and `family inet6` explicitly: never leave an interface without an address family
- Disable unused interfaces: `disable`
- Use `unit 0` explicitly even when there's only one logical unit: it's clearer
- Set `ether-options 802.3ad <ae>` for LAG member links

## Routing: General

- Always set `router-id` explicitly under `routing-options`
- Use `autonomous-system` under `routing-options`, not per-protocol
- Use routing policies (`policy-options policy-statement`) for all route filtering: never rely on default behaviour
- Always include a `then reject` term at the end of import/export policies
- Use `prefix-list-filter` in policies, not inline prefix matches
- Use `community` members with regex sparingly: prefer exact matches

## Routing: OSPF

- Use `interface <x> passive` for interfaces that should advertise but not form adjacencies
- Set `reference-bandwidth 1t` (1 Tbps) so cost calculations make sense on modern link speeds
- Use `authentication-key` or `md5` on all OSPF interfaces: never run unauthenticated
- Use BFD on all OSPF point-to-point links: `bfd-liveness-detection minimum-interval 300`

## Routing: BGP

- See also: `https://docs.artofinfra.com/general/bgp.md` for vendor-agnostic BGP design rules
- Use `group` to organise peers by function (transit, peering, customer, iBGP)
- Set `local-address` to Loopback for iBGP, link address for eBGP
- Use `import` and `export` policies on every group: never rely on Junos defaults
- Set `hold-time 90` and use BFD for fast failover
- Use `prefix-limit` with `teardown <percent> idle-timeout <minutes>` on eBGP peers
- Use `advertise-peer-as` only if you explicitly need it: it disables AS-path loop prevention

## Firewall Filters (ACLs)

- Apply filters with `filter input/output` on the interface, not globally
- Use `policer` within filters for rate limiting: don't build separate policer configs
- Always include an explicit `term DEFAULT-DENY { then discard; }` as the last term
- Use `term` names that describe intent: `term ALLOW-SSH`, `term RATE-LIMIT-ICMP`, not `term 10`
- Log denied traffic: `then { count DENIED; log; discard; }`

## System Basics

- Set `system host-name` and `system domain-name`
- Use `system login class` to define RBAC: never give everyone `super-user`
- Set `system services ssh protocol-version v2`: disable Telnet
- Set `system syslog host <ip> any info` for remote logging
- Use `system ntp server <ip>` with `authentication-key`
- Set `system name-server` for DNS resolution
- Enable `system commit synchronize` on dual-RE systems

## Dangerous Patterns to Avoid

- **Never** `delete` at the top of the hierarchy without understanding you're wiping the entire config section
- **Never** use `load override` with a partial config: it replaces the entire config. Use `load merge` or `load replace` (with `replace:` tags)
- **Never** commit on a dual-RE system without `commit synchronize`: the backup RE will have stale config
- **Never** forget `commit confirmed` when working remotely: the only time you skip it is when you're on console
