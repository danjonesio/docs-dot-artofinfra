# EVPN-VXLAN: Best Practices

Opinionated rules for VXLAN as the data plane under EVPN (modern DC overlay fabrics). For transport-agnostic EVPN concepts (route types, multihoming, MAC mobility, symmetric IRB, anycast gateway), see `https://docs.artofinfra.com/general/evpn.md`. This doc covers the VXLAN encapsulation layer only.

Pure VXLAN without EVPN (flood-and-learn) is acceptable only in a lab. In production, always pair VXLAN with BGP EVPN.

## Underlay Design

- Keep the underlay simple: OSPF or eBGP, nothing fancy
- eBGP underlay (RFC 7938 "spine-leaf BGP") is preferred for large fabrics:
  - Unique ASN per leaf (or per-rack)
  - Spine uses a shared ASN
  - Use `allowas-in` or `as-override` carefully
- OSPF underlay is fine for smaller fabrics (under ~50 leafs):
  - Single area, point-to-point links
  - Advertise only loopbacks and P2P link subnets
- **Underlay MTU must accommodate VXLAN overhead.** Set at least **9216** on all fabric links: VXLAN adds 50-54 bytes of encapsulation, and you need headroom for jumbo frames inside
- Verify with `ping <remote-vtep> size 9000 df-bit`: if it fails, your underlay can't carry jumbo frames and the fabric will black-hole large packets

## VTEP Design

- Use a Loopback as the VTEP source interface: never a physical interface
- For MLAG/vPC pairs, use a shared secondary loopback as the **anycast VTEP IP**: both switches advertise the same VTEP address. Hosts behind the LAG appear at one VTEP from the fabric's perspective
- Set `source-interface loopback1` (or vendor equivalent) on the NVE interface
- Always advertise the VTEP loopback in the underlay IGP: if the underlay can't reach the VTEP IP, the overlay can't form

## VNI Numbering

- Pick a consistent VNI numbering scheme and stick to it. Suggested:
  - **L2VNI**: `10000 + VLAN ID` (e.g. VLAN 100 to VNI 10100)
  - **L3VNI**: `90000 + VRF ID` (e.g. VRF 1 to VNI 90001)
- Never reuse VNIs across different tenants: VNI is the network identifier inside the fabric, it must be globally unique
- Map every VLAN that needs to stretch across leafs to a VNI: don't stretch VLANs that are local to a single leaf

## ARP Suppression

- Always enable ARP suppression: this is one of the key reasons to use EVPN over flood-and-learn (see `https://docs.artofinfra.com/general/evpn.md`)
- Vendor syntax differs: `suppress-arp` in NVE config (NX-OS), `proxy-macip-advertisement` in EVPN protocol config (Junos)
- See platform docs for syntax: `https://docs.artofinfra.com/cisco/nxos.md`

## Anycast Gateway (VXLAN Syntax)

See `https://docs.artofinfra.com/general/evpn.md` for the concept. VXLAN-specific syntax notes:

- The same gateway MAC must be set across all VTEPs: `fabric forwarding anycast-gateway-mac <mac>` (NX-OS), `default-gateway` under the bridge-domain (Junos QFX)
- Anycast gateway only works correctly when every leaf with hosts in a given subnet has the SVI configured: missing SVIs create black holes

## Dangerous Patterns to Avoid

- **Never** run VXLAN without jumbo frame support on the underlay: you'll get silent MTU black holes
- **Never** forget to advertise the VTEP loopback in the underlay IGP: the overlay won't form
- **Never** assign the same VNI to different VLANs in different parts of the fabric: VNI uniqueness is mandatory
- **Never** mix multicast underlay and ingress replication unpredictably: pick one BUM model per fabric
