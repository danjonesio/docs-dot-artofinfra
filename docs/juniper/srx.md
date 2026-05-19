# Juniper SRX: Best Practices

Security-specific rules for SRX Series firewalls. For general Junos patterns, see `https://docs.artofinfra.com/juniper/junos.md`.

## Zones & Policies

- Define zones by trust level and function: `trust`, `untrust`, `dmz`, `management`: not by interface name
- Assign interfaces to zones, never leave an interface unzoned
- Write security policies in order: most specific first, deny-all last
- Always include a `deny-all` policy at the bottom of each from-zone/to-zone pair
- Use `application-sets` for common service groups: don't repeat port definitions across policies
- Name policies descriptively: `ALLOW-WEB-TO-DMZ`, not `policy-1`
- Log policy hits on deny rules at minimum: `then { deny; log { session-close; } }`

## NAT

- Use source NAT with interface-based PAT for outbound traffic:

```junos
security nat source {
    rule-set OUTBOUND {
        from zone trust;
        to zone untrust;
        rule PAT-ALL {
            match { source-address 0.0.0.0/0; }
            then { source-nat { interface; } }
        }
    }
}
```

- Use destination NAT for inbound services: pair with a security policy that permits the NATted traffic
- Always use `proxy-arp` on the external interface for destination NAT public IPs
- Use static NAT for 1:1 mappings where bidirectional initiation is needed

## Screens (IDS/IPS)

- Enable screens on the `untrust` zone:

```junos
security screen ids-option UNTRUST-SCREEN {
    icmp { ping-death; }
    ip { source-route-option; tear-drop; }
    tcp { syn-flood { alarm-threshold 1024; attack-threshold 200; timeout 20; }; land; }
}
```

- Apply to the zone: `security zones security-zone untrust screen UNTRUST-SCREEN`
- Don't over-tune screens without data: start with defaults, monitor alerts, adjust thresholds based on actual traffic patterns

## VPN (IPsec)

- Use IKEv2 for all new tunnels: IKEv1 only for legacy peer compatibility
- Use `st0` (secure tunnel) interfaces in route-based VPN: avoid policy-based VPN
- Bind `st0` units to a zone (typically a dedicated `vpn` zone)
- Set DPD: `dead-peer-detection interval 10 threshold 3`
- Use AES-256-GCM and DH Group 14+ for Phase 1 and Phase 2
- Always set `establish-tunnels immediately` for critical tunnels: don't wait for interesting traffic

## Clustering (Chassis Cluster)

- Use chassis cluster for HA: Active/Passive is simpler and recommended unless you need Active/Active
- Set control link and fabric link on dedicated interfaces
- Use redundancy groups: RG0 for control plane, RG1+ for data plane
- Set `preempt` only if you want the primary to reclaim after recovery: usually leave it off
- Monitor with `show chassis cluster status` and `show chassis cluster interfaces`

## Flow vs Packet Mode

- Default is flow mode (stateful): use this for firewall/NAT/VPN functions
- Packet mode (stateless) is for pure routing/switching: only use if you're not doing security functions
- Don't mix modes without understanding the implications: `set security forwarding-options family inet6 mode packet-based` changes how the entire address family is handled

## Dangerous Patterns to Avoid

- **Never** put management interfaces in the `untrust` zone
- **Never** create a policy with `then permit` and `application any` from `untrust` to `trust`: this is "permit all inbound"
- **Never** disable flow mode on a production firewall without a maintenance window
- **Never** skip `commit confirmed` when changing security policies remotely: a bad policy can lock you out instantly
