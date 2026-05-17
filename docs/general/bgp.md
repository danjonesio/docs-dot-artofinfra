# BGP Design: Best Practices

Vendor-agnostic BGP design rules. For platform-specific syntax, see `https://docs.artofinfra.com/cisco/ios-xe.md` or `https://docs.artofinfra.com/cisco/nxos.md`.

## Fundamentals

- Always set `router-id` explicitly: never rely on auto-selection from highest loopback or interface IP
- Use 4-byte ASNs (`asplain` notation) for all new designs: 2-byte ASNs are running out in some registries
- Always use `maximum-prefix` on eBGP peers: with both a warning threshold and a teardown limit
- Always authenticate eBGP sessions with at least MD5 (`neighbor password`): TCP MD5 prevents session reset attacks
- Use TTL Security (`ttl-security hops 1`) on eBGP peers where supported: cheaper than MD5 and blocks spoofed packets

## iBGP

- Use route reflectors for iBGP scalability: never build a full mesh beyond 4-5 routers
- Place route reflectors on dedicated devices or the most stable devices in the network: not on edge routers
- Use `next-hop-self` on route reflectors for reflected routes: but understand when this breaks (e.g., MPLS environments)
- Use `update-source Loopback0` for all iBGP peerings: never peer on physical interfaces
- Use `passive` on iBGP peers that shouldn't initiate the connection (e.g., route reflector clients shouldn't initiate to reflector)

## eBGP

- Always filter inbound and outbound on eBGP sessions: never accept or send the full table unfiltered
- Use `prefix-list` for route filtering, not `access-list`: prefix-lists are purpose-built for route filtering and more readable
- Deny RFC 1918, default route (0.0.0.0/0), and your own prefixes inbound from every eBGP peer
- Deny overly specific prefixes inbound (e.g., anything longer than /24 for IPv4 public space)
- Always tag routes with BGP communities at ingress: filter and manipulate based on communities, not prefix-lists, in downstream policy
- Use `route-map` on every eBGP session: even if it's just a permit-all to start. It's easier to add rules to an existing route-map than to attach one later

## Communities

- Define a community schema for your network and document it:

```
65001:100  = learned from transit provider
65001:200  = learned from peering partner
65001:300  = learned from customer
65001:1000 = blackhole this prefix
65001:2000 = do not advertise to transit
```

- Tag all routes at ingress with the appropriate community
- Use communities for traffic engineering decisions: don't rely on AS-path manipulation as your primary tool
- Use large communities (RFC 8092) if you're on 4-byte ASNs

## Route Filtering Hierarchy

Apply filters in this order:

1. **Bogon filtering**: deny RFC 1918, RFC 5737, RFC 6598, default route, and your own space inbound
2. **Prefix length filtering**: deny anything longer than /24 (IPv4) or /48 (IPv6) from eBGP
3. **IRR/RPKI validation**: if available, validate against RPKI ROAs and IRR route objects
4. **Community tagging**: tag accepted routes with origin community
5. **Local preference / MED**: apply traffic engineering policy

## Convergence

- Tune BGP timers based on the environment:
  - eBGP over direct links: `timers 3 9` (keepalive 3s, hold 9s) with BFD
  - eBGP over internet/transit: default timers (60/180) unless BFD is available
  - iBGP: default timers are usually fine with BFD
- Use BFD (Bidirectional Forwarding Detection) wherever possible for sub-second failure detection
- Set `bgp graceful-restart` on eBGP peers for planned maintenance: but understand that it delays convergence during unplanned failures

## IPv6

- Always deploy BGP with both IPv4 and IPv6 address families in new designs
- Use separate `address-family ipv6 unicast` configuration: don't try to carry IPv6 NLRI over IPv4 sessions unless you have a specific reason
- Apply the same filtering rules to IPv6: bogon filtering, prefix length limits (/48 max), RPKI

## Documentation

- Document every eBGP peer: who it is, what circuit, what ASN, what prefixes are expected
- Document your community schema
- Document your route-map and prefix-list naming convention
- Keep an up-to-date topology diagram showing all BGP peerings, ASNs, and link types
- Use comments in config to reference change tickets: `! CR-12345: Added transit peer Cogent`

## Dangerous Patterns to Avoid

- **Never** redistribute into BGP without a route-map: a single mistake can leak your IGP into the internet
- **Never** accept a default route from a peer without explicit intent: one misconfigured peer can blackhole your traffic
- **Never** set `no bgp enforce-first-as` unless you fully understand the security implications
- **Never** use `as-override` in production without understanding that it breaks loop prevention
- **Never** announce prefixes you don't own: this is route hijacking and will get your ASN flagged
