# EVPN: Best Practices

Vendor- and transport-agnostic rules for Ethernet VPN. EVPN is a BGP control plane (RFC 7432 and extensions) that can be carried over MPLS, VXLAN, or SR-MPLS. The rules here apply across transports. For transport specifics:

- EVPN over VXLAN: `https://docs.artofinfra.com/general/evpn-vxlan.md`
- EVPN over MPLS: see vendor docs (`https://docs.artofinfra.com/juniper/mx.md`)

## Control Plane

- Always use BGP EVPN: never run flood-and-learn in production. Flood-and-learn (multicast underlay or head-end replication without a BGP control plane) is acceptable in a lab only
- BGP EVPN gives you ARP suppression, optimal routing, multihoming, and multi-tenancy: flood-and-learn gives you none of these
- Use iBGP route reflectors for the `l2vpn evpn` address family: don't build a full mesh beyond a handful of PEs
- Run redundant RRs in a cluster: a single RR is a single point of failure for the entire fabric

## Route Types

EVPN uses several BGP NLRI types under the `l2vpn evpn` family. You don't usually configure them directly, but you need to recognise them when reading route tables.

- **Type 1** (Ethernet Auto-Discovery): per-ES and per-EVI. Used for fast multihoming withdrawal, aliasing, and split-horizon labels
- **Type 2** (MAC/IP advertisement): per-host MAC, optionally with IP. The workhorse for L2 reachability and ARP/ND suppression
- **Type 3** (Inclusive Multicast Ethernet Tag): per-bridge-domain multicast tree info, used to flood BUM traffic
- **Type 4** (Ethernet Segment): used for Designated Forwarder (DF) election among PEs sharing an ESI
- **Type 5** (IP Prefix): IP prefix advertisement without MAC binding. Used for symmetric IRB inter-subnet routing and for external prefixes into the fabric

## Service Models

Pick one service model per fabric and stick to it. Mixing service models in the same fabric is operationally painful and gains you nothing.

- **VLAN-based**: one EVI per VLAN, one bridge domain per EVI. Simple, rigid, RT/RD bookkeeping grows linearly with VLAN count
- **VLAN-aware bundle**: one EVI carries multiple VLANs as separate bridge domains. Reduces RT/RD bookkeeping at scale. Most common for new DC fabrics
- **Port-based**: all traffic on the port goes into one EVI without bridge domain separation. Niche, mostly transit / E-Line replacement

## Multihoming

- Configure an Ethernet Segment Identifier (ESI) on every multi-homed CE link: without an ESI, the PE treats the CE as single-homed and you lose all multihoming benefits silently
- Prefer **all-active** multihoming when the CE supports LAG across PEs (LACP / MC-LAG / ESI-LAG). Use **single-active** only when the CE genuinely cannot
- DF election is automatic per (ESI, VLAN): one PE forwards BUM traffic toward the CE. You usually don't need to tune the algorithm
- Aliasing (Type-1 per-EVI) lets ingress PEs load-balance unicast across all members of an all-active ES: this is one of EVPN's biggest wins over VPLS
- Split-horizon (Type-1 per-ES with ESI label) prevents loops on the ES side. It's automatic but requires the per-ES Type-1 routes to propagate: if your fabric drops Type-1, multihoming will form loops
- Use a uniqueness convention for manually-assigned ESIs (e.g. embed PE pair + CE identifier): clashing ESIs cause silent multihoming corruption

## MAC Mobility & Duplicate-MAC Dampening

- Type-2 routes carry a sequence number in the MAC Mobility extended community. When a MAC moves, the new PE bumps the sequence and the old PE withdraws: this is built in, no config required
- Keep duplicate-MAC dampening enabled (default in most modern implementations). A flapping host (NIC reset loop, vMotion oscillation, misconfigured bond) can otherwise generate thousands of MAC moves per second and melt the control plane
- Common defaults: 5 moves within 180 seconds triggers dampening; MAC is held in a dampened state until cleared or a hold-down timer expires
- Investigate dampened MACs before clearing them: the host is doing something wrong, and clearing without fixing the root cause just buys you another flap

## Symmetric vs Asymmetric IRB

EVPN supports two models for routing between subnets. **Always use symmetric.**

- **Symmetric IRB**: ingress PE looks up the destination L3 context (tenant VRF / L3 EVI), encapsulates with that context's label or L3VNI, and the egress PE routes again at egress. Each tenant VRF gets its own L3 context
- **Asymmetric IRB**: every PE must have every L2 subnet configured locally so it can resolve ARP for any destination. Doesn't scale, defeats the point of an EVPN fabric
- Symmetric IRB uses **both** route types: Type-2 (MAC+IP, carrying the Router's MAC extended community) for host reachability inside the fabric, and Type-5 (IP prefix only) for external or summarised prefixes. Both ride a per-tenant L3 transit VNI/VRF

## Anycast Gateway

- Use the same gateway MAC and gateway IP on every PE for each subnet: this is a distributed anycast gateway. The host's ARP entry for its default gateway is valid regardless of which PE it ends up on
- No FHRP (HSRP, VRRP) needed inside an EVPN fabric: anycast gateway replaces it
- The gateway MAC must be identical across all PEs: each platform has its own knob (see platform docs for syntax)

## Dangerous Patterns to Avoid

- **Never** run flood-and-learn in a multi-tenant environment: there is no tenant isolation without EVPN's route targets
- **Never** mix symmetric and asymmetric IRB in the same fabric: pick one, be consistent
- **Never** disable duplicate-MAC dampening to "fix" a flapping host: fix the host
- **Never** rely on a single route reflector: a dead RR is a dead fabric
- **Never** assign ESIs without a uniqueness convention: collisions cause silent multihoming corruption
