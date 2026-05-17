# Terraform for Network Infrastructure: Best Practices

Opinionated rules for using Terraform to manage network infrastructure. Covers provider patterns, state management, and network-specific gotchas.

## Project Structure

- One repo per infrastructure domain (e.g., `terraform-wan`, `terraform-dc-fabric`, `terraform-f5xc`)
- Use a flat module structure: don't over-nest. `modules/` for reusable components, `environments/` for deployment targets
- Keep environment differentiation in `.tfvars` files, not in separate directories with duplicated config
- Use `terraform.tfvars` for defaults, `<env>.tfvars` for overrides: `terraform apply -var-file=prod.tfvars`

```
terraform-wan/
├── main.tf
├── variables.tf
├── outputs.tf
├── providers.tf
├── versions.tf
├── terraform.tfvars
├── environments/
│   ├── prod.tfvars
│   ├── staging.tfvars
│   └── lab.tfvars
└── modules/
    ├── bgp-peer/
    └── wan-interface/
```

## State Management

- **Never** use local state in production: always remote backend (S3, GCS, Terraform Cloud, etc.)
- Use state locking: DynamoDB for S3 backend, built-in for Terraform Cloud
- One state file per blast radius: separate state for WAN, DC, security appliances
- Never manually edit state files: use `terraform state mv`, `terraform state rm`
- If a provider doesn't support `terraform import`, write a state injection script rather than recreating resources (see F5 XC pattern below)

## Providers: Network Specific

### General

- Pin provider versions exactly: `version = "= 3.2.1"` not `version = "~> 3.2"`
- Pin Terraform core version: `required_version = "= 1.7.0"`
- Never store credentials in `.tf` files or `.tfvars`: use environment variables, vault, or provider-specific auth mechanisms
- Use `provider` aliases when managing multiple devices/regions of the same type

### Cisco (iosxe, nxos providers)

- Use the `iosxe` provider for IOS-XE RESTCONF management, not the legacy `ios` provider
- Enable RESTCONF on devices first: `restconf` in device config
- Use `iosxe_rest` for arbitrary YANG paths the provider doesn't cover yet
- Be aware: the NX-OS Terraform provider is less mature: validate in lab before production

### F5 XC / Volterra

- Use the `volterra` provider
- Many resource types do not support `terraform import`: use state injection:
  1. Create the resource via GUI or API
  2. Write the matching `.tf` config
  3. Use a script to inject the resource into state via `terraform state push`
  4. Run `terraform plan` to verify zero diff
- Always use `terraform plan` before `apply` on XC: some resources have destructive update behaviour (replace instead of in-place update)
- Use `depends_on` explicitly for XC resources with implicit ordering requirements

### Palo Alto (panos provider)

- Use `panos_panorama_*` resources for Panorama-managed firewalls, `panos_*` for standalone
- Always commit changes after apply: the provider stages config but doesn't commit by default
- Use a `null_resource` with `panos_commit` or a separate commit step in CI

## Variables & Typing

- Always define variable types: never use untyped `variable "x" {}`
- Use `object({})` for complex config structures, not multiple flat variables
- Use `validation` blocks for network-specific constraints:

```hcl
variable "bgp_asn" {
  type = number
  validation {
    condition     = var.bgp_asn >= 1 && var.bgp_asn <= 4294967295
    error_message = "BGP ASN must be a valid 4-byte AS number."
  }
}
```

- Use `locals` for computed values, not `variable` with defaults that depend on other variables

## Modules

- Keep modules small and focused: one concern per module (e.g., `bgp-peer`, not `entire-router-config`)
- Always define `outputs` for values other modules or root config will need
- Never hardcode values in modules: parameterise everything
- Use `for_each` over `count` for resources that map to a named collection (e.g., interfaces, peers, VLANs)
- Use `for_each` with a map, not a list: the key becomes the resource address, making plans readable

```hcl
# Good: resource addresses are meaningful
resource "iosxe_interface" "this" {
  for_each = var.interfaces  # { "GigabitEthernet0/1" = {...}, ... }
}

# Bad: resource addresses are indices
resource "iosxe_interface" "this" {
  count = length(var.interfaces)
}
```

## CI/CD

- Always run `terraform fmt -check` and `terraform validate` in CI
- Run `terraform plan` on PRs: post the plan output as a PR comment
- Require manual approval for `terraform apply` in production
- Use branch protection: no direct pushes to main
- Store plan output as an artifact and apply from the saved plan, not re-planning at apply time

## Dangerous Patterns to Avoid

- **Never** use `terraform destroy` without triple-checking the target: there is no undo
- **Never** use `terraform taint` in production: use `terraform apply -replace=<resource>` instead (taint is deprecated)
- **Never** remove a resource from config and apply without first `terraform state rm` if you want to keep it alive
- **Never** use `-auto-approve` in interactive sessions
- Be extremely careful with `lifecycle { prevent_destroy = true }`: it only prevents `terraform destroy`, not config removal
