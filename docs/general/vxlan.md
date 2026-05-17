# VXLAN Design: Best Practices

Vendor-agnostic VXLAN/EVPN design rules. For platform-specific syntax, see `https://docs.artofinfra.com/cisco/nxos.md` (NX-OS VXLAN/EVPN section).

## Control Plane

- Always use BGP EVPN as the control plane: never flood-and-learn in production
- Flood-and-learn (multicast underlay) is acceptable in lab only
- BGP EVPN provides ARP suppression, optimal routing, and multi-tenancy: flood-and-learn gives you none of these
- Use iBGP with route reflectors for the EVPN address family: don't build a full mesh

## Underlay Design

- Keep the underlay simple: OSPF or eBGP, nothing fancy
- eBGP underlay (RFC 7938 "spine-leaf BGP") is preferred for large fabrics:
  - Use unique ASN per leaf (or per-rack)
  - Spine uses a shared ASN
  - Set `allowas-in` or use `as-override` carefully
- OSPF underlay is fine for smaller fabrics (<50 leafs):
  - Single area, point-to-point links
  - Advertise only loopbacks and P2P link subnets
- Underlay MTU must support VXLAN overhead: set to at least **9216** on all fabric links (VXLAN adds 50 bytes)
- Verify with `ping <remote-vtep> size 9000 df-bit`: if it fails, your underlay can't carry jumbo frames

## VTEP Design

- Use Loopback as VTEP source interface: never a physical interface
- For MLAG/vPC pairs, use a shared secondary loopback as the anycast VTEP IP: both switches advertise the same VTEP address
- Set `source-interface loopback1` (or similar) for the NVE interface

## VNI & VLAN Mapping

- Use a consistent VNI numbering scheme:
  - L2VNI: `10000 + VLAN ID` (e.g., VLAN 100 → VNI 10100)
  - L3VNI: `90000 + VRF ID` (e.g., VRF 1 → VNI 90001)
- Never reuse VNIs across different tenants
- Map every VLAN that needs to stretch across leafs to a VNI: don't stretch VLANs that are local to a single leaf

## ARP Suppression

- Always enable ARP suppression to reduce BUM traffic
- `suppress-arp` in NVE config (NX-OS), `proxy-macip-advertisement` in EVPN (Junos)
- This is one of the key reasons to use EVPN over flood-and-learn

## Routing (Symmetric vs Asymmetric)

- Use **symmetric IRB** (Integrated Routing and Bridging) for inter-VXLAN routing:
  - Requires an L3VNI per tenant VRF
  - Traffic is routed at the ingress leaf, encapsulated with the L3VNI, and routed again at the egress leaf
  - Scales better: the egress leaf doesn't need to know every VLAN in the fabric
- Avoid asymmetric IRB in production: it requires every leaf to have every VLAN configured, which defeats the purpose of VXLAN
- Advertise EVPN Type-5 routes for external prefixes into the fabric

## Anycast Gateway

- Use the same gateway MAC and IP on every leaf for each SVI: this is the distributed anycast gateway
- `fabric forwarding anycast-gateway-mac <mac>` (NX-OS)
- All leafs respond to ARP for the gateway: no FHRP (HSRP/VRRP) needed inside the VXLAN fabric

## Dangerous Patterns to Avoid

- **Never** run VXLAN without jumbo frame support on the underlay: you'll get silent MTU black holes
- **Never** use flood-and-learn in a multi-tenant environment: there's no isolation without EVPN
- **Never** mix symmetric and asymmetric IRB in the same fabric: pick one and be consistent
- **Never** forget to advertise the VTEP loopback in the underlay IGP: if the underlay can't reach the VTEP IP, the overlay can't form
- **Never** assign the same VNI to different VLANs in different parts of the fabric: VNI is the network identifier, it must be globally unique within the fabric
