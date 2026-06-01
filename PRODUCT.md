# Product

## Register

product

## Users

Production operations engineers and developers at JP Morgan CIB Technology. Managers monitor all incidents and coordinate team response; developers triage and resolve incidents assigned to their team. Context: operational workflow under pressure, potentially 24/7, on workstations in a trading-environment setting.

## Product Purpose

Real-time incident management dashboard for a trading application monitoring system. Incidents surface from Splunk alerts when the error rate exceeds thresholds; teams resolve them with documented notes. Success: zero ambiguity about what's open, what's assigned, and who resolved what.

## Brand Personality

Focused, precise, operational. The tool should feel like it belongs in a CIB environment — not a startup SaaS product. Quiet confidence, nothing decorative.

## Anti-references

- Retool, Grafana: metric hero sections, data viz overload, dark gradient theatrics.
- Notion, Linear: pastel rounded cards, consumer-app friendliness, playful micro-interactions.
- No `01 / 02 / 03` section numbering. No eyebrows above every heading. No gradient text.

## Design Principles

1. **Data first.** Every element exists to surface actionable information — IDs, error rates, timestamps, team assignments. Nothing decorative earns screen space.
2. **Status is always readable.** Open, resolved, priority levels must be legible at a glance without relying on color alone.
3. **Operational density.** The dashboard should fit meaningful context without scrolling when possible. Compact, not cramped.
4. **Role clarity.** Manager and developer views are distinct; the UI should make role context obvious without labeling everything twice.
5. **Zero visual debt.** Borders, backgrounds, and shadows used only when they carry information or separate discrete regions. Not for decoration.

## Accessibility & Inclusion

WCAG AA: 4.5:1 contrast for body text, 3:1 for large text. Reduced motion alternative for any transitions. Keyboard-navigable modals and forms.
