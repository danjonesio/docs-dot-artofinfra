# QoS Design: Best Practices

Vendor-agnostic Quality of Service design rules. QoS doesn't create bandwidth: it manages scarcity. Only implement QoS where links are congested or latency-sensitive traffic exists.

## When You Need QoS

- WAN links where bandwidth is limited and shared between voice, video, and data
- Data centre uplinks during microbursts
- Campus access ports carrying voice + data
- **You don't need QoS** on uncongested links: adding QoS to a 10G link running at 2% utilisation adds complexity for zero benefit

## Classification

- Classify and mark as close to the source as possible: ideally at the access layer
- Trust DSCP markings from trusted endpoints (IP phones, known servers)
- Don't trust DSCP from untrusted sources (user PCs, guest networks): reclassify at ingress
- Use DSCP for marking, not IP Precedence: DSCP gives 64 values vs 8, and it's the modern standard
- Common DSCP values to use:
  - **EF (46)**: Voice bearer (RTP)
  - **AF41 (34)**: Video conferencing
  - **AF31 (26)**: Call signalling (SIP/H.323)
  - **CS6 (48)**: Network control (routing protocols)
  - **AF21 (18)**: Transactional data (database, ERP)
  - **AF11 (10)**: Bulk data (backups, FTP)
  - **CS0 (0)**: Best effort (everything else)

## Queuing

- Use a strict priority queue for voice (EF): but cap it at 30% of link bandwidth max to prevent starvation
- Use CBWFQ (class-based weighted fair queuing) for everything else
- Allocate bandwidth by class, not by application: it's more maintainable:
  - Voice: 10-20% (strict priority)
  - Video: 15-25% (low-latency queue or CBWFQ)
  - Signalling/Control: 5%
  - Business-critical data: 25%
  - Best effort: remaining
- Always have a default/best-effort class: never classify 100% of traffic into explicit classes

## Shaping & Policing

- **Shape** outbound traffic on WAN egress to match the circuit speed: not the interface speed
- **Police** inbound traffic on untrusted interfaces to enforce rate limits
- Shaping buffers excess traffic and delays it. Policing drops it. Know the difference:
  - Shape when you want smooth traffic flow (WAN links)
  - Police when you want to enforce a hard limit (rate limiting per customer)
- Use hierarchical shaping for sub-line-rate circuits: shape to the contract rate, then apply per-class queuing within the shaped rate

## WRED (Weighted Random Early Detection)

- Enable WRED on data classes (AF) to avoid tail drops: tail drops cause TCP global synchronisation
- Never enable WRED on the voice (EF) queue: voice is UDP, it can't respond to drops
- Set WRED thresholds per DSCP class within an AF group: higher drop precedence (AF13) should have lower thresholds than lower drop precedence (AF11)

## Platform Notes

- On IOS-XE: use MQC (Modular QoS CLI): `class-map`, `policy-map`, `service-policy`
- On NX-OS: use `system qos` for global policies, `policy-map type queuing` for egress queuing
- On Junos: use `class-of-service` with classifiers, schedulers, and rewrite rules
- The concepts are the same across platforms: the syntax is different

## Monitoring

- Monitor queue drops: `show policy-map interface <x>` (IOS-XE), `show queuing interface <x>` (NX-OS)
- If a class is regularly dropping, either increase its bandwidth allocation or investigate why that traffic is exceeding its share
- Use SNMP or streaming telemetry to track queue depths and drop counters over time

## Dangerous Patterns to Avoid

- **Never** implement QoS without understanding the traffic profile first: you need baseline data
- **Never** put more than 33% of link bandwidth in strict priority: you'll starve everything else
- **Never** trust DSCP markings from untrusted sources without re-marking at the boundary
- **Never** deploy QoS on one end of a link without matching it on the other: mismatched policies cause unpredictable behaviour
- **Never** use QoS to fix a capacity problem: if the link is consistently saturated, you need more bandwidth, not more queuing
