# NetBox IPAM: Best Practices

Opinionated rules for managing IP addresses, prefixes, VLANs, and VRFs in NetBox. IPAM is the most used module in NetBox: getting it right eliminates the spreadsheet chaos that plagues most network teams.

## Prefix Hierarchy

- Model the full allocation chain: **RIR → Aggregate → Container prefix → Active prefix → IP address**
- Create aggregates for every block you own or have been delegated: these are your top-level allocations from ARIN, RIPE, APNIC, or your enterprise allocation
- Use container prefixes for logical groupings that aren't routed themselves:

```
Aggregate:  10.0.0.0/8          (RFC 1918 allocation)
  └── Container: 10.100.0.0/16  (Data centre supernet)
        ├── Active: 10.100.1.0/24   (us-iad-dc1 management)
        ├── Active: 10.100.2.0/24   (us-iad-dc1 loopbacks)
        └── Container: 10.100.10.0/21  (us-iad-dc1 server VLANs)
              ├── Active: 10.100.10.0/24  (VLAN 10: web tier)
              └── Active: 10.100.11.0/24  (VLAN 11: app tier)
```

- Every active prefix must have a **site** and a **VLAN** assigned (if it maps to a layer-2 domain)
- Every active prefix must have a **role**: use roles like `management`, `loopback`, `server`, `point-to-point`, `guest-wifi`, `dmz`
- Set the prefix status accurately to `Active`, `Reserved`, or `Deprecated`. Never leave it as `Active` if it's planned but not yet routed

## IP Address Assignment

- Every IP address must be assigned to an interface on a device or virtual machine: orphan IPs (no assignment) rot quickly
- Set the DNS name on the IP address object: NetBox is often more up-to-date than DNS, and this feeds into automation that generates DNS records
- Use `primary_ip4` and `primary_ip6` on every device: this is what Ansible, Nornir, and monitoring tools use to reach the device
- Mark one IP per device as primary. If a device has no primary IP, every inventory plugin will skip it
- Assign IPs to the correct interface: management IPs on `Management0`, loopbacks on `Loopback0`, not just thrown onto the first interface

```python
# Good: assign IP to the right interface
import pynetbox

nb = pynetbox.api("https://netbox.example.com", token="...")

device = nb.dcim.devices.get(name="us-iad-dc1-cr01")
mgmt_intf = nb.dcim.interfaces.get(device_id=device.id, name="Management0")

ip = nb.ipam.ip_addresses.create(
    address="10.100.1.1/24",
    assigned_object_type="dcim.interface",
    assigned_object_id=mgmt_intf.id,
    dns_name="us-iad-dc1-cr01.mgmt.example.com",
    status="active",
)

# Set as primary IP for the device
device.primary_ip4 = ip.id
device.save()
```

- Use IP ranges for DHCP pools, not individual IP address objects: creating 200 individual IPs for a DHCP scope is noise

## VRF Modeling

- Create a VRF object for every routing table in your network: including the global table if you use VRFs at all
- Set `enforce_unique` to `True` on every VRF: this prevents duplicate IP assignments within the same VRF and catches data entry errors
- Assign prefixes and IP addresses to the correct VRF: an IP without a VRF is assumed to be in the global table
- Use route distinguishers in the format `{ASN}:{site-id}` or `{loopback}:{vrf-id}`: be consistent
- Import/export targets belong in device config, not in NetBox: NetBox models the VRF identity and its prefix space, not the full routing policy

```
VRF: MGMT (RD: 65001:100, enforce_unique: true)
  ├── 10.100.1.0/24 (us-iad-dc1 management)
  └── 10.200.1.0/24 (gb-lon-dc1 management)

VRF: PROD (RD: 65001:200, enforce_unique: true)
  ├── 10.100.10.0/24 (us-iad-dc1 web tier)
  └── 10.200.10.0/24 (gb-lon-dc1 web tier)
```

## VLAN Management

- Always use VLAN groups: never create VLANs in the "global" ungrouped space
- Scope VLAN groups to a site, location, or rack group: this reflects reality where VLAN IDs are reused across sites:

```
VLAN Group: us-iad-dc1 (scope: Site us-iad-dc1)
  ├── VLAN 10: web-tier        (prefix: 10.100.10.0/24)
  ├── VLAN 11: app-tier        (prefix: 10.100.11.0/24)
  └── VLAN 100: management     (prefix: 10.100.1.0/24)

VLAN Group: gb-lon-dc1 (scope: Site gb-lon-dc1)
  ├── VLAN 10: web-tier        (prefix: 10.200.10.0/24)
  ├── VLAN 11: app-tier        (prefix: 10.200.11.0/24)
  └── VLAN 100: management     (prefix: 10.200.1.0/24)
```

- Link every VLAN to its corresponding prefix: this is the join point between L2 and L3 in NetBox
- Use consistent VLAN names across sites: `web-tier` everywhere, not `web` in one site and `WEB_VLAN` in another
- Set VLAN status to `Active`, `Reserved`, or `Deprecated`. Deprecated VLANs should still exist in NetBox (for historical reference) but be clearly marked

## ASN Management

- Create ASN objects for every AS number your network uses or peers with
- Assign ASNs to sites: this documents which ASN is originated from which location
- For eBGP peer ASNs, create the ASN object and assign it to a provider or circuit: this links your BGP design to your physical connectivity

## Service Mapping

- Use service objects to document what's listening on each device: `SSH/22`, `SNMP/161`, `BGP/179`, `HTTPS/443`
- Tie services to specific IP addresses, not just devices: a device with multiple IPs may expose different services on each
- This feeds into firewall rule automation and security auditing: keep it accurate

## Dangerous Patterns to Avoid

- **Never** create prefixes without assigning a site, role, and status: orphan prefixes become unknowable within weeks
- **Never** leave `enforce_unique` disabled on a VRF: duplicate IPs are the number one source of IPAM data rot
- **Never** use the global VLAN space for site-specific VLANs: VLAN 10 at site A and VLAN 10 at site B are different VLANs
- **Never** create individual IP address objects for DHCP pools: use IP ranges
- **Never** skip the `primary_ip` assignment on devices: every inventory and monitoring integration depends on it
- **Never** treat NetBox IPAM as a secondary record: if your IPAM data lives in a spreadsheet and NetBox is "for later", you have two sources of truth and neither is right
