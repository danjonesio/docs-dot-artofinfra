# Juniper MX: Best Practices

Opinionated rules for the Juniper MX Series service provider edge routers. These are MX-specific patterns: see `https://docs.artofinfra.com/juniper/junos.md` for OS-level rules that apply to all Junos platforms (commit model, interfaces, OSPF/BGP basics, system).

## Platform & Forwarding Mode

- Set `chassis network-services enhanced-ip` on any modern MX: this is required for modern features (EVPN, large FIB, MPC10+ optimisations) and is **not** the default on a fresh chassis
- This setting requires a reboot to take effect: change it during a maintenance window, never on a live router under load
- Use MPC line cards: DPC is EOL and should not appear in new designs
- Configure `chassis fpc <n> pic <m>` explicitly per slot: don't rely on auto-discovery for PIC modes (breakout, channelisation)

## MPLS Core

MPLS on Junos requires **two** things on every core interface and one of them is silent if you forget it.

- Enable `family mpls` on the interface unit AND `protocols mpls interface <name>`: without both, MPLS forwarding silently does not work
- Pick one label distribution protocol per network: LDP for simple cores, RSVP-TE only when you need explicit traffic engineering
- Don't run LDP and RSVP-TE on the same links unless you have a documented reason
- Enable BFD on the IGP and the label distribution protocol: relying on hello timers gives you 15-30s convergence

```junos
interfaces {
    ge-0/0/0 {
        unit 0 {
            family inet {
                address 10.0.0.1/31;
            }
            family mpls;
        }
    }
}
protocols {
    mpls {
        interface ge-0/0/0.0;
    }
    ldp {
        interface ge-0/0/0.0;
        interface lo0.0;
    }
}
```

## L3VPN (VRFs)

- Use `instance-type vrf` for IP VPNs: never use `virtual-router` to fake a VRF (it has no MPLS context)
- Format route-distinguishers as `<loopback-IP>:<vrf-id>`: makes RDs immediately traceable to the originating PE
- Use `vrf-target target:<asn>:<vrf-id>` communities for symmetric import/export: reserve explicit `vrf-import`/`vrf-export` policies for cases where the simple pattern doesn't fit
- Set `vrf-table-label` on every VRF: per-prefix labels burn label space at scale
- Keep customer routing inside the VRF: never leak between VRFs without an explicit `rib-groups` or policy

```junos
routing-instances {
    CUSTOMER-A {
        instance-type vrf;
        route-distinguisher 192.0.2.1:100;
        vrf-target target:65000:100;
        vrf-table-label;
        interface ge-0/0/1.100;
    }
}
```

## EVPN-MPLS

EVPN-MPLS is the modern replacement for VPLS on MX. For transport-agnostic EVPN concepts (route types, multihoming, MAC mobility, symmetric IRB), see `https://docs.artofinfra.com/general/evpn.md`. For EVPN over VXLAN (DC fabric), see `https://docs.artofinfra.com/general/evpn-vxlan.md`.

- Prefer EVPN-MPLS over VPLS for any new L2VPN: VPLS has weaker multihoming and no built-in MAC mobility
- Pick one service type per fabric and stick to it (see `https://docs.artofinfra.com/general/evpn.md` for the service-model trade-offs):
  - **VLAN-based**: `instance-type evpn`
  - **VLAN-aware bundle**: `instance-type virtual-switch` with `protocols evpn`
- `instance-type mac-vrf` (Junos OS 20.4R1+, Junos Evolved 21.2R1+) is **EVPN-VXLAN only** and does not support EVPN-MPLS on MX: use it for EVPN-VXLAN deployments (e.g. DCI gateway), not for the EVPN-MPLS patterns in this section
- Configure ESIs on multi-homed CE links using the `esi` knob under the aggregated Ethernet interface

> EVPN config syntax varies meaningfully across Junos releases (especially around `mac-vrf`). Verify against the release notes for your target Junos version before deploying.

## Class of Service

MX is usually the edge, which means it is where QoS gets marked, policed, and queued.

- Classify on **ingress** using a Behaviour Aggregate (BA) classifier on the customer-facing interface
- Schedule on **egress** with an 8-queue scheduler map
- Rewrite DSCP/EXP **only at trust boundaries**: never apply rewrite rules to core-facing interfaces
- Use hierarchical scheduling (H-CoS) on subscriber or CE-facing interfaces where you need per-customer shaping
- See `https://docs.artofinfra.com/general/qos.md` for vendor-agnostic QoS design

## Inline Services (si-)

Inline services let the MX do NAT, GRE, IPsec, and port mirroring without separate service cards.

- MS-MPC is EOL: do not design new deployments around it
- For new builds, use inline-services (`si-` interfaces) on MPC cards, or MX-SPC3 for high-scale stateful services
- Allocate bandwidth explicitly: `set chassis fpc <n> pic <m> inline-services bandwidth <Ng>`
- Steer traffic via a service-set, not by rewriting routing: keep the forwarding path predictable
- Don't use inline NAT for high-session-rate workloads: MX-SPC3 or a dedicated NAT platform is the right fit beyond a few hundred thousand sessions

## High Availability (Dual-RE)

- Enable graceful switchover: `set chassis redundancy graceful-switchover`
- Enable nonstop routing: `set routing-options nonstop-routing`
- Enable `set system commit synchronize`: without it, the backup RE diverges and a switchover loses config
- ISSU (`request system software in-service-upgrade`) is supported but **not** universal: read the release notes for both the running and target versions before relying on it. Don't assume ISSU works across major versions (e.g. 21 to 22)

## Edge Filtering & Control Plane

- Apply uRPF on customer-facing interfaces: strict mode for single-homed customers, loose mode for multi-homed
- Apply a BCP38 ingress filter on every customer edge: drop packets whose source is not in the customer's allocated space
- Protect the routing engine with an `lo0.0` filter and policers: this is the only thing standing between the internet and the RE
- See `https://docs.artofinfra.com/general/acl-design.md` for filter design rules

```junos
interfaces {
    lo0 {
        unit 0 {
            family inet {
                filter {
                    input PROTECT-RE;
                }
                address 192.0.2.1/32;
            }
        }
    }
}
```

## Dangerous Patterns to Avoid

- **Never** change `chassis network-services` mode without a reboot window: it requires a chassis reboot and partial states are unsupported
- **Never** enable MPLS by only setting `protocols mpls interface ...`: without `family mpls` on the interface unit, no labels are forwarded
- **Never** use logical systems as a production multi-tenancy mechanism: they are for lab/test isolation, use VRFs for real tenants
- **Never** rely on ISSU between major Junos versions without testing in a lab first: it is not a guarantee, it is a best-effort
