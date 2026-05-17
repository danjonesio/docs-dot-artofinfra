# Cisco IOS-XE: Best Practices

Opinionated rules for IOS-XE platforms (ISR, ASR, Catalyst 9000). These are "do this, not that": not a reference manual.

## Authentication & Access

- **Never** use `enable password`: always `enable algorithm-type scrypt secret`
- **Never** use `username ... password`: always `username ... algorithm-type scrypt secret`
- Use `login local` on vty lines, never `login` with shared passwords
- Always set `transport input ssh` on vty lines: never allow telnet
- Set `exec-timeout 5 0` on vty and console: never leave infinite timeout
- Use `access-class` on vty lines to restrict management access by source IP
- Always configure `service password-encryption` as a baseline (but don't rely on it: type 7 is trivially reversible)

## SSH

- Use `ip ssh version 2`: never allow SSHv1
- Set `ip ssh time-out 60` and `ip ssh authentication-retries 3`
- Generate keys with at least 4096 bits: `crypto key generate rsa modulus 4096`
- Use `ip ssh server algorithm mac hmac-sha2-256 hmac-sha2-512`: disable weak MACs

## NTP

- Always use `ntp server <ip> key <id>` with authentication
- Always source from Loopback: `ntp source Loopback0`
- Use `ntp authenticate` and define `ntp authentication-key` + `ntp trusted-key`
- Never use `ntp master` in production: it makes the device a stratum source

## Logging

- Always log to a remote syslog server: `logging host <ip>`
- Source from Loopback: `logging source-interface Loopback0`
- Set `logging trap informational` (level 6) minimum
- Use `logging buffered 64000 informational` for local buffer
- Always include timestamps: `service timestamps log datetime msec localtime show-timezone`
- Set `logging console critical`: don't spam the console

## Interfaces

- Always add `description` to every interface: no exceptions
- Use `shutdown` as default state on unused ports
- Assign unused ports to a black-hole VLAN: `switchport access vlan 999`
- Never leave an interface in VLAN 1
- Use `no ip proxy-arp` on L3 interfaces unless explicitly required
- Use `no ip redirects` and `no ip unreachables` on external-facing interfaces
- Always set `bandwidth` and `delay` correctly on WAN links if using EIGRP/OSPF cost calculations

## Routing: General

- Use `ip prefix-list` over `access-list` for route filtering: always
- Always use `route-map` with explicit `deny` at the end for clarity, even though implicit deny exists
- Never redistribute without a route-map: ever
- Tag redistributed routes with `set tag` to prevent routing loops
- Use Loopback0 as router-id source for OSPF and BGP

## Routing: OSPF

- Always set `router-id` explicitly: never rely on auto-selection
- Use `ip ospf network point-to-point` on P2P links (avoid DR/BDR election overhead)
- Use `passive-interface default` then selectively `no passive-interface` on peering interfaces
- Summarise at ABR boundaries with `area X range`
- Use `ip ospf authentication message-digest` on all OSPF interfaces

## Routing: BGP

- See also: `https://docs.artofinfra.com/general/bgp.md` for vendor-agnostic BGP design rules
- Always set `neighbor X update-source Loopback0` for iBGP
- Use `neighbor X password` for MD5 authentication on all eBGP sessions
- Always set `maximum-prefix` on eBGP peers with a warning threshold
- Use `soft-reconfiguration inbound` or `route-refresh` capability
- Never use `neighbor X next-hop-self` without understanding the topology: but do use it on iBGP route reflectors

## Spanning Tree

- Use Rapid-PVST+ (`spanning-tree mode rapid-pvst`) or MST: never classic STP
- Always configure `spanning-tree portfast` on access ports
- Always pair portfast with `spanning-tree bpduguard enable` on access ports
- Set root bridge explicitly: `spanning-tree vlan X priority 4096`: never rely on default election
- Use `spanning-tree guard root` on ports that should never become root
- Enable `spanning-tree loopguard default` globally

## DHCP Snooping & ARP Inspection

- Enable `ip dhcp snooping` globally and per-VLAN
- Mark uplinks as `ip dhcp snooping trust`
- Enable `ip arp inspection vlan <id>` where DHCP snooping is active
- Use `ip arp inspection validate src-mac dst-mac ip`

## AAA

- Use `aaa new-model`: always
- Define method lists: `aaa authentication login default local` at minimum
- For RADIUS/TACACS+, always have `local` as fallback method
- Source RADIUS/TACACS+ from Loopback: `ip radius source-interface Loopback0`

## Control Plane

- Use CoPP (Control Plane Policing) on all production routers
- Rate-limit ICMP, TTL-expired, and other punt-path traffic
- Configure `ip cef` (should be on by default, but verify)

## Banners

- Always set `banner login` with legal notice: never include hostname or device info in the banner
- Use `banner motd` for maintenance notices only

## Save & Verify

- Never modify running-config without a rollback plan
- Use `archive` with automatic config backup before changes
- Use `show archive config differences` to verify changes
- Set `configuration mode exclusive` when making changes in production
