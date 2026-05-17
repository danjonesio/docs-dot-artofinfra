# NetBox Custom Scripts: Best Practices

Opinionated rules for writing custom scripts, reports, and validators in NetBox. Custom scripts extend NetBox's data management without needing a full plugin.

## When to Use What

- **Custom scripts**: automated workflows that create, update, or delete objects: provisioning a new site, bulk-assigning IPs, decommissioning a device
- **Reports**: read-only checks that validate data quality: "every device has a primary IP", "no orphan prefixes". Reports don't modify data
- **Custom validators**: enforce rules at save time: "devices in the `production` tag must have a platform set", "prefixes must have a role"
- **Plugins**: use when you need new models, views, API endpoints, or nav items. Scripts and validators are for logic on existing models

## Custom Scripts

- Always inherit from `extras.scripts.Script` and define clear `Meta`:

```python
from extras.scripts import Script, ObjectVar, ChoiceVar, StringVar
from dcim.models import Site, DeviceRole, Device

class ProvisionAccessSwitch(Script):
    class Meta:
        name = "Provision Access Switch"
        description = "Creates a new access switch with standard interfaces and management IP"
        commit_default = False  # Always default to dry-run

    site = ObjectVar(model=Site, query_params={"status": "active"})
    switch_number = StringVar(
        description="Switch number (e.g., 03)",
        regex=r"^\d{2}$",
    )
```

- Always set `commit_default = False`: scripts should dry-run by default and require explicit opt-in to commit
- Use typed variables (`ObjectVar`, `ChoiceVar`, `IPAddressVar`) instead of raw `StringVar`: they validate input and provide dropdown selectors in the UI
- Log every action with `self.log_success()`, `self.log_info()`, `self.log_warning()`, or `self.log_failure()`: scripts without logging are impossible to debug:

```python
def run(self, data, commit):
    site = data["site"]
    switch_num = data["switch_number"]
    hostname = f"{site.slug}-asw{switch_num}"

    self.log_info(f"Provisioning {hostname} at {site.name}")

    # Check for conflicts
    if Device.objects.filter(name=hostname).exists():
        self.log_failure(f"Device {hostname} already exists")
        return

    device = Device(
        name=hostname,
        site=site,
        device_type=DeviceType.objects.get(slug="c9200l-48p-4g"),
        role=DeviceRole.objects.get(slug="access-switch"),
        status="planned",
    )
    device.save()
    self.log_success(f"Created device: {hostname}")
```

- Break complex scripts into small methods: a 300-line `run()` method is unmaintainable
- Validate all preconditions before making changes: check that sites exist, IPs are available, names don't conflict

## Reports

- Reports validate data integrity: they answer "is our NetBox data correct?":

```python
from extras.reports import Report
from dcim.models import Device

class DeviceDataQuality(Report):
    description = "Checks that all active devices meet minimum data requirements"

    def test_primary_ip(self):
        """Every active device must have a primary IPv4 address."""
        for device in Device.objects.filter(status="active"):
            if device.primary_ip4:
                self.log_success(device)
            else:
                self.log_failure(device, "Missing primary IPv4")

    def test_platform_set(self):
        """Every active device must have a platform assigned."""
        for device in Device.objects.filter(status="active"):
            if device.platform:
                self.log_success(device)
            else:
                self.log_failure(device, "No platform set")

    def test_device_naming(self):
        """Device names must follow the standard naming convention."""
        import re
        pattern = r"^[a-z]{2}-[a-z]{3}-\w+-\w+$"
        for device in Device.objects.filter(status="active"):
            if re.match(pattern, device.name):
                self.log_success(device)
            else:
                self.log_warning(device, f"Name '{device.name}' doesn't match convention")
```

- Run reports on a schedule (cron or CI): not just when someone remembers to click the button
- Reports should be fast: use `select_related()` and `prefetch_related()` to avoid N+1 queries:

```python
# Good: one query with joins
devices = Device.objects.filter(status="active").select_related(
    "site", "platform", "device_role", "primary_ip4"
)

# Bad (N+1): one query per device to fetch site
devices = Device.objects.filter(status="active")
for d in devices:
    print(d.site.name)  # Triggers a new query each iteration
```

## Custom Validators

- Use validators to enforce data quality rules at write time: they run on every save:

```python
# custom_validators.py (referenced in NetBox config)
from extras.validators import CustomValidator

class DeviceValidator(CustomValidator):
    def validate(self, instance, request):
        # Active devices must have a platform
        if instance.status == "active" and not instance.platform:
            self.fail("Active devices must have a platform assigned")

        # Device names must be lowercase
        if instance.name != instance.name.lower():
            self.fail("Device names must be lowercase")
```

- Register validators in `configuration.py`:

```python
CUSTOM_VALIDATORS = {
    "dcim.device": ["validators.DeviceValidator"],
    "ipam.prefix": ["validators.PrefixValidator"],
}
```

- Keep validators fast: they run on every save and slow validators degrade the UI
- Validators enforce **invariants** (things that must always be true), not workflows (things that are true at certain stages). Use scripts for workflows
- Write clear error messages: users see them directly in the UI. "Active devices must have a platform assigned" is good. "Validation failed" is useless

## Plugin Development

- Only build a plugin when scripts, reports, and validators aren't enough: plugins are more powerful but require maintenance across NetBox upgrades
- Follow the official plugin structure: `setup.py`, `__init__.py` with `PluginConfig`, separate files for models, views, API, tables, forms
- Pin your plugin to a NetBox version range: breaking changes between NetBox minor versions are common
- Use NetBox's built-in model features (change logging, custom fields, tags, export templates) on your custom models: don't reinvent them

## Dangerous Patterns to Avoid

- **Never** set `commit_default = True` on a script: accidental commits on production data are the most common custom script disaster
- **Never** write a script without logging: silent scripts are undebuggable and un-auditable
- **Never** use raw SQL in scripts or validators: use the Django ORM. Raw SQL bypasses permission checks, change logging, and validators
- **Never** make external API calls (to devices, cloud providers) inside validators: validators must be fast and side-effect-free
- **Never** suppress exceptions in scripts: let them bubble up so NetBox logs the failure
- **Never** skip `select_related()` in reports that iterate over large querysets: N+1 queries will timeout on any non-trivial instance
