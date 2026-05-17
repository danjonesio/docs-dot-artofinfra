# NetBox: Index

Opinionated best practices for using NetBox as your network source of truth.

## When to Use NetBox

- Network source of truth for IPAM, DCIM, and circuit/provider tracking
- Single authoritative record of what your network **should** look like: automation tools read from NetBox and push to devices
- NetBox describes **intended state**, not live state: don't treat it as a monitoring tool

## Available docs

- [Data modeling](https://docs.artofinfra.com/netbox/data-modeling.md): Site hierarchy, device types, roles, tenancy, custom fields
- [IPAM](https://docs.artofinfra.com/netbox/ipam.md): Prefix hierarchy, VLAN groups, IP assignment, VRFs
- [Automation](https://docs.artofinfra.com/netbox/automation.md): REST/GraphQL API, Ansible/Nornir inventory, webhooks
- [Custom scripts](https://docs.artofinfra.com/netbox/custom-scripts.md): Custom scripts, reports, validators, plugin patterns
- [Config contexts](https://docs.artofinfra.com/netbox/config-contexts.md): Config contexts and config templates for rendering device configs
