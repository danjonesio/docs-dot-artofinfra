# OSPF Design: Best Practices

Vendor-agnostic OSPF design rules. For platform-specific syntax, see `https://docs.artofinfra.com/cisco/ios-xe.md`, `https://docs.artofinfra.com/cisco/nxos.md`, or `https://docs.artofinfra.com/juniper/junos.md`.

## Fundamentals

- Always set `router-id` explicitly: never rely on auto-selection
- Use Loopback0 address as router-id by convention
- Set reference bandwidth to at least 1 Gbps (`auto-cost reference-bandwidth 1000` on IOS-XE, `reference-bandwidth 1g` on Junos): the default 100 Mbps makes all gigabit+ links equal cost
- Use `passive-interface default` globally, then selectively enable OSPF on peering interfaces: this prevents accidental adjacency formation

## Area Design

- Keep Area 0 (backbone) small and stable: core routers and ABRs only
- Use stub areas for branches that don't need full external route visibility
- Use totally stubby areas where branches only need a default route from the ABR
- Never create a non-contiguous Area 0: use virtual links only as a temporary fix, never as permanent design
- Summarise at ABR boundaries to reduce LSDB size: `area X range` (IOS-XE) / `area X area-range` (Junos)
- Don't over-segment into too many areas: the overhead of inter-area routing is worse than a slightly large LSDB in modern routers

## Network Types

- Use **point-to-point** on all P2P links (routed links between two routers): avoids DR/BDR election overhead and speeds convergence
- Use **broadcast** on multi-access segments (if you still have any): set DR/BDR priority explicitly, never rely on router-id for election
- Never use NBMA network type unless you're running Frame Relay (you're not)
- Set DR priority to 0 on devices that should never be DR

## Authentication

- Always authenticate OSPF on all interfaces: MD5 minimum, SHA-256 where supported
- Use keychain-based authentication for key rotation without disruption
- Never run unauthenticated OSPF in production: even on internal links. A rogue device can inject routes

## Redistribution

- **Never** redistribute into OSPF without a route-map/policy
- Always set a metric and metric-type when redistributing: `redistribute bgp <asn> metric 100 metric-type 1 route-map REDIST-BGP`
- Use metric-type 1 (E1) for external routes that should be preferred based on internal cost
- Use metric-type 2 (E2, default) for external routes where internal cost shouldn't matter
- Tag redistributed routes to prevent redistribution loops in multi-point redistribution

## Timers & Convergence

- Default timers (hello 10, dead 40) are fine for most LAN environments
- Use BFD for sub-second failure detection instead of tuning OSPF timers aggressively
- If you must tune: `hello 1, dead 4` is the aggressive floor: don't go lower
- Use SPF throttle timers to prevent CPU spikes during topology storms: initial delay 50ms, hold 200ms, max 5000ms
- Use LSA throttle timers similarly

## Dangerous Patterns to Avoid

- **Never** redistribute connected interfaces without filtering: you'll advertise management networks, loopbacks, and out-of-band links
- **Never** use virtual links as a permanent design element: they're a hack for broken topologies
- **Never** run OSPF on interfaces facing untrusted networks (internet, customer-facing) without authentication and filtering
- **Never** set `max-lsa` too low on a router that's an ABR: it can shut down OSPF if it receives too many LSAs during convergence
