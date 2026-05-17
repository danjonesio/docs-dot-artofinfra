# Cisco NX-OS: Best Practices

Opinionated rules for NX-OS platforms (Nexus 3000/5000/7000/9000). Data centre focus.

## Features & Licensing

- Always enable only the features you need: `feature <name>`
- Don't leave unused features enabled: they consume memory and expand attack surface
- Core features to enable on most deployments: `feature interface-vlan`, `feature hsrp`, `feature lacp`, `feature vpc`, `feature lldp`
- Enable `feature nxapi` only if you're using it for automation: otherwise leave it off

## vPC

- Always use vPC keepalive over a dedicated management link, not the peer-link
- Use `peer-switch` to present both vPC switches as a single STP root
- Set `auto-recovery` and `auto-recovery reload-delay` for split-brain recovery
- Use `peer-gateway` to handle HSRP traffic arriving on the wrong switch
- Always use `vpc orphan-port suspend` to prevent traffic blackholing on orphan ports during failures
- Set `delay restore <seconds>` to allow routing convergence before vPC comes up after reload

## Port Channels

- Always use LACP (`channel-group X mode active`): never static
- Set `lacp rate fast` on host-facing port-channels where supported
- Use `lacp min-links` to define minimum viable bundle
- Always match speed, duplex, MTU, and VLAN config across all member ports

## Interfaces

- Always add `description` to every interface
- Use `shutdown` as default on unused ports
- Set `switchport access vlan 999` on unused ports (black-hole VLAN)
- Never leave anything in VLAN 1
- Use `no ip redirects` on all SVIs

## Routing

- Same principles as IOS-XE: see `https://docs.artofinfra.com/cisco/ios-xe.md` routing section
- Use `ip prefix-list` not `ip access-list` for route filtering
- Always use `route-map` for redistribution: no exceptions
- Set `router-id` explicitly for OSPF and BGP

## VXLAN / EVPN (Nexus 9000)

- Use BGP EVPN control plane: never flood-and-learn in production
- Set `nv overlay evpn` and `feature nv overlay`
- Use `suppress-arp` in NVE interface config to reduce BUM traffic
- Always configure anycast gateway: `fabric forwarding anycast-gateway-mac`
- Use route-type 5 for external routing with `advertise l2vpn evpn` in BGP

## AAA & Management

- Use `feature tacacs+` or `feature radius`
- Always have local fallback: `aaa authentication login default group <server-group> local`
- Source management traffic from `mgmt0` or a Loopback
- Restrict VTY access with `access-class`

## NTP & Logging

- Use VRF management for NTP if mgmt0 is in a VRF: `ntp server <ip> use-vrf management`
- Always log to remote syslog: `logging server <ip> use-vrf management`
- Set `logging level <facility> 6` for informational logging
- Use `logging timestamp milliseconds`

## Checkpoints & Rollback

- Always create a checkpoint before changes: `checkpoint <name>`
- Use `rollback running-config checkpoint <name>` to undo
- Use `show diff rollback-patch checkpoint <name> running-config` to preview changes
