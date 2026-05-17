# Cisco ASA: Best Practices

Opinionated rules for Cisco ASA firewalls. Applies to ASA 5500-X and ASAv. For Firepower Threat Defence (FTD) managed via FMC, many principles apply but the syntax differs.

## Access Control

- Use named ACLs, never numbered: readability matters when you're troubleshooting at 3am
- Group related rules with remarks: `access-list OUTSIDE_IN remark --- Web Servers ---`
- Order ACL entries from most specific to least specific: ASA evaluates top-down, first match wins
- Never use `permit ip any any` on any interface: if you think you need it, you don't understand the traffic flow yet
- Use object-groups for hosts, networks, and services: never repeat the same IP in multiple ACL entries
- Clean up unused ACLs and object-groups regularly: `show access-list <name> brief` shows hit counts: zero-hit rules are candidates for removal

## NAT

- Use Auto NAT (object NAT) for simple 1:1 and PAT: it's cleaner and easier to read
- Use Manual NAT (twice NAT) only when you need source+destination NAT or policy NAT
- Always set `dns` keyword when NATing servers that need DNS doctoring
- Never use `nat (inside,outside) dynamic interface` as a catch-all without understanding the implications: it PATs everything through the ASA's outside IP
- Use NAT section ordering: Section 1 (manual) → Section 2 (auto) → Section 3 (manual after-auto). Put specific overrides in Section 1, defaults in Section 3

## Interfaces & Security Levels

- Security levels are legacy thinking: don't rely on them for policy. Use explicit ACLs on every interface
- Set `same-security-traffic permit inter-interface` if you have interfaces at the same security level that need to talk
- Always name interfaces descriptively: `nameif OUTSIDE`, `nameif DMZ-WEB`, `nameif INSIDE-USERS`
- Set MTU correctly: `mtu OUTSIDE 1500` minimum, adjust for tunnels

## VPN

- Use IKEv2 over IKEv1 for all new site-to-site VPNs
- Use AES-256-GCM for encryption where both sides support it
- Use PFS Group 14 (2048-bit) minimum for DH key exchange: never Group 1 or 2
- Set `crypto ikev2 dpd 10 2 on-demand` for dead peer detection
- For remote access VPN, use AnyConnect: never use the legacy IPsec client
- Use `tunnel-group` with `group-url` for AnyConnect, not group dropdown (exposes tunnel group names)
- Always set `vpn-idle-timeout` and `vpn-session-timeout` on group policies

## Failover

- Use Active/Standby failover for simplicity: Active/Active is rarely worth the complexity
- Set failover link and state link on dedicated interfaces, not shared with data traffic
- Use `failover polltime unit 1 holdtime 5` for fast detection
- Always test failover before going live: `failover active` / `no failover active`
- Monitor failover state: `show failover state`

## Logging

- Log to a remote syslog server: `logging host INSIDE <ip>`
- Set `logging trap informational` (level 6)
- Enable `logging asdm informational` for ASDM monitoring
- Use `logging enable`: it's off by default
- Log denied traffic: `logging list DENIED message 106023` (ACL deny)
- Set `logging permit-hostdown` to keep logging even if the syslog server goes down temporarily

## Management

- Use ASDM for initial setup, SSH for day-to-day: never leave HTTP/ASDM open to the outside interface
- Restrict SSH access: `ssh <mgmt-subnet> <mask> INSIDE`
- Set `ssh timeout 5` and `ssh version 2`
- Use `aaa authentication ssh console LOCAL` with local user database or RADIUS
- Always `write memory` after changes: ASA doesn't auto-save

## Dangerous Patterns to Avoid

- **Never** use `same-security-traffic permit intra-interface` (hairpin) without understanding it allows traffic to U-turn on the same interface: this is a security risk if misconfigured
- **Never** disable the `threat-detection` feature in production
- **Never** use `management-only` on a data interface accidentally: it blocks all transit traffic
- **Never** clear xlate or connections during business hours unless you're prepared for all sessions to drop: `clear xlate` kills every NAT translation
