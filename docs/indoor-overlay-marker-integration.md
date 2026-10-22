# Indoor Overlay Marker Integration

The public 3D explorer already uses a selected campus zone, publishes only active approved floor-plan overlays, and launches routes through the existing `startRoute` helper. Verified indoor records expose an optional `routeNodeExternalId`, which is the only route step that may be used for a public marker handoff.

The priority-office extension therefore renders marker data only within an approved active overlay, preserves the existing public data boundary, and starts route guidance only when the marker resolves to a verified room with a configured route anchor. Public search must match the location name, building, floor, room, type, and administrator-verified aliases and common terms.
