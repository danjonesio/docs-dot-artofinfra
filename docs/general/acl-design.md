# ACL Design: Best Practices

Vendor-agnostic access control list design rules. For platform-specific syntax, see vendor docs.

## Structure & Naming

- Use descriptive names that indicate purpose and direction: `OUTSIDE-INBOUND`, `WAN-TO-DC-PERMIT`, `MGMT-ACCESS`
- Never use numbered ACLs on any platform that supports named ACLs: readability is not optional
- Group related entries with remarks/comments: treat ACLs as documentation
- Order entries: most specific first, most frequently matched near the top (for platforms with first-match semantics)
- Always end with an explicit deny: even if the platform has an implicit deny. The explicit entry generates log hits and counters

## Design Patterns

- **Interface ACLs**: filter transit traffic on ingress. Apply as close to the source as possible to avoid wasting bandwidth
- **Control plane ACLs**: protect the device itself. Restrict SSH, SNMP, NTP, and routing protocols to known sources
- **VTY/Management ACLs**: restrict management access by source IP. Every device should have this
- Separate transit ACLs from management ACLs: don't mix "who can reach the device" with "what traffic can pass through it"

## Use Prefix-Lists for Routing

- For BGP/OSPF route filtering, always use `ip prefix-list` (IOS-XE) or `prefix-list-filter` (Junos): not ACLs
- ACLs match packets. Prefix-lists match routes. Don't conflate them
- Prefix-lists support `le`/`ge` modifiers for prefix length matching: ACLs don't

## Object Groups

- Use object-groups (IOS-XE, ASA) or address-sets (Junos) to group related hosts/networks
- Update the group, not individual ACL entries: this is how you keep ACLs maintainable at scale
- Name object groups by function: `OG-WEB-SERVERS`, `OG-MGMT-SOURCES`, `OG-DNS-SERVERS`

## IPv6

- Apply the same ACL discipline to IPv6: don't leave IPv6 unfiltered because "we don't use it yet"
- Filter ICMPv6 carefully: blocking it entirely breaks neighbour discovery, PMTUD, and SLAAC
- At minimum, permit: ND Solicitation (type 135), ND Advertisement (type 136), Router Solicitation (133), Router Advertisement (134)
- Deny everything else from untrusted sources

## Maintenance

- Review ACL hit counters quarterly: zero-hit entries are dead rules. Remove them
- Use change tickets in ACL remarks: `remark CR-4521: Allow monitoring from NOC`
- Version control ACLs alongside your IaC: never treat ACLs as ad-hoc config
- Test ACL changes in lab or with `commit confirmed` (Junos) / `archive config` (IOS-XE) rollback capability

## Dangerous Patterns to Avoid

- **Never** use `permit ip any any` as a troubleshooting step and forget to remove it: set a calendar reminder
- **Never** apply an ACL in the wrong direction: `in` vs `out` changes everything. Verify with `show` before and after
- **Never** filter routing protocol traffic (BGP, OSPF, EIGRP) with a transit ACL unless you explicitly intend to: you'll kill adjacencies
- **Never** write ACLs that depend on DNS names: use IPs. DNS resolution in ACLs is unreliable and a security risk
