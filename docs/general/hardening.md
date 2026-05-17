# Device Hardening: Baseline

Vendor-agnostic device hardening checklist. For platform-specific commands, see the relevant vendor doc.

## Management Plane

- **SSH only**: disable Telnet on all devices. No exceptions.
- **Strong credentials**: use scrypt/bcrypt hashed passwords, never type-7 or plaintext
- **Centralised AAA**: TACACS+ or RADIUS with local fallback
- **Restrict management access**: ACL on VTY lines limiting source IPs to your management network
- **Console access**: set exec-timeout, require authentication, use `transport preferred none` (no auto-connect to telnet on console)
- **Session limits**: limit concurrent VTY sessions to a reasonable number
- **Banner**: legal notice on login banner. Never reveal device type, hostname, or IOS version in the banner.

## Control Plane

- **NTP authentication**: always authenticate NTP sources
- **Logging**: remote syslog with source interface set to loopback
- **SNMP**: SNMPv3 with auth+priv. If SNMPv2c is unavoidable, use a complex community string and restrict access with an ACL. Never use `public` or `private` as community strings.
- **Disable unnecessary services**: turn off every service you're not using:
  - `no ip http server` (unless managing via web UI: and you shouldn't be)
  - `no ip http secure-server` (unless required for RESTCONF)
  - `no cdp run` on external-facing interfaces (keep it on internal)
  - `no lldp run` on external-facing interfaces
  - `no ip source-route`
  - `no service pad`
  - `no ip bootp server`
  - `no ip finger`
  - `no service tcp-small-servers`
  - `no service udp-small-servers`
- **Control Plane Policing (CoPP)**: rate-limit traffic destined to the device's CPU: ICMP, TTL-expired, ARP, BGP, OSPF, SSH. Prioritise routing protocol traffic; aggressively police everything else.

## Data Plane

- **uRPF**: enable Unicast Reverse Path Forwarding on edge interfaces (`ip verify unicast source reachable-via rx` for strict, `any` for feasible/loose)
- **No IP redirects**: `no ip redirects` on all L3 interfaces
- **No IP unreachables**: `no ip unreachables` on external-facing interfaces (rate-limit if you must keep them)
- **No proxy ARP**: `no ip proxy-arp` unless explicitly required
- **Disable IP directed broadcast**: `no ip directed-broadcast`
- **Disable IP source routing**: `no ip source-route` globally
- **Unused ports**: shut down, assign to a black-hole VLAN, set `switchport mode access`

## AAA Minimum

- Enable AAA: `aaa new-model`
- Authentication: local database as fallback, TACACS+/RADIUS as primary
- Authorization: `aaa authorization exec default` to control shell access
- Accounting: `aaa accounting commands 15 default start-stop` to log all privileged commands
- Source AAA traffic from loopback or management interface

## Layer 2 Hardening (Switches)

- **Port security**: enable on all access ports, limit MAC addresses
- **DHCP snooping**: enable globally and per-VLAN, mark uplinks as trusted
- **Dynamic ARP Inspection**: enable on VLANs with DHCP snooping
- **IP Source Guard**: enable on access ports to prevent IP spoofing
- **BPDU Guard**: on all access ports (pairs with portfast)
- **Root Guard**: on ports that should never become root port
- **Storm control**: rate-limit broadcast/multicast/unicast flooding on access ports
- **Native VLAN**: change native VLAN to something other than VLAN 1, and don't use it for user traffic
- **Trunk pruning**: only allow necessary VLANs on trunk links (`switchport trunk allowed vlan`)
- **DTP**: disable on all ports: `switchport nonegotiate`

## Verification

After hardening, verify:

- [ ] Can only SSH to device (Telnet rejected)
- [ ] VTY access restricted to management network
- [ ] SNMP access restricted and using v3
- [ ] NTP synchronised and authenticated
- [ ] Logging to remote syslog confirmed
- [ ] Unused ports shut down and in black-hole VLAN
- [ ] AAA accounting logging all privileged commands
- [ ] CoPP applied and verified with traffic counters
- [ ] uRPF enabled on edge interfaces
- [ ] L2 protections (DHCP snooping, DAI, port security) active on access ports
