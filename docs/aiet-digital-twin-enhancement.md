# AIET Digital-Twin Enhancement

This implementation upgrades the existing PathFinder 3D explorer rather than replacing its data contracts or inventing a second campus layout.

| Layer | Current behavior | Evidence boundary |
|---|---|---|
| Campus zones | Four canonical PathFinder zones remain the single public 3D selector vocabulary. | Zone positions and dimensions remain staged/configurable until AIET-authorised geometry is supplied. |
| Models | Administrator-approved GLB assets render when registered for a canonical zone. | Unregistered zones continue to show a labelled guide massing, never an official architectural claim. |
| Guide massing | Natural plaster-like façades, terracotta-inspired roof caps, dark glass-like windows, daylight, soft shadows, landscaped ground, and a selected-zone footprint accent improve miniature readability. | These are presentation treatment for staged content, not a survey or a claim about exact building shape, orientation, floor count, road placement, or GPS location. |
| Camera | Overview, Focused view, and Street view provide safe presentation modes over the existing selection state. | Camera movement changes only the viewpoint; it does not imply a surveyed street network. |
| Source comparison | The selected zone can show a source-attributed campus photograph beside a “3D guide” panel. | The photograph supports recognition and context only; it is not used to derive coordinates, floor plans, or route edges. |
| Navigation | Existing configured destination IDs continue to hand off to the 2D map. Existing AR handoff remains available. | No new destination, distance, route geometry, or indoor step was created. |
| 2D/AR/VR boundary | Existing map and AR entry points are preserved. The current application has no separately registered VR route, so no fictional VR handoff was added. | Future synchronization requires one campus-authorised coordinate source shared by map, 3D, AR, VR, and routing. |

The supplied prompt requests exact relative placement, building orientation, terrain, roads, and architectural reconstruction. Those items remain explicitly awaiting campus survey or approved GLB/model metadata. The current release therefore improves the miniature presentation and inspection workflow while preserving the project’s existing honesty boundary.

## Immersive spatial-navigation layer

The latest 3D explorer pass adapts the interaction philosophy observed in Bruno Simon’s public portfolio without copying its vehicle, visual identity, assets, or portfolio concept:

- The campus canvas is now the primary spatial surface, with first-run drag/zoom/click/search onboarding.
- A compact command deck adds destination search, route-preview toggle, and High/Medium/Low rendering controls for responsive use.
- A cyan/gold staged route preview, start/destination nodes, directional waypoint, and orientation panel make spatial intent legible before the user continues to the verified 2D route engine.
- Overview, Focused view, and Street view remain smooth presentation modes; the existing map and AR handoffs remain the authoritative navigation continuation.
- All new 3D pathing and orientation graphics are explicitly illustrative. They do not create a new route edge, distance, coordinate, entrance, floor plan, or indoor claim.

## Live guidance and secure asset-ingestion layer

The 3D route preview now has a verified live-navigation handoff:

- Map Navigation persists only a short-lived, privacy-minimised route snapshot in session storage and opens `/campus-3d?...&live=1` from the active route.
- Campus3D hydrates that snapshot, watches the same browser GPS permission, derives progress from the existing verified campus graph, and presents the current instruction, accuracy, distance, and progress in a live guidance card.
- Camera orientation and the scene route cue respond to left/right/straight/arrival instructions. No new coordinates, edges, or building geometry are inferred from the staged scene.
- Only the selected approved GLB loads at a time; medium quality is the mobile default, with low quality falling back to lightweight massing. The route-level 3D bundle remains lazy-loaded.
- Administrator GLB uploads are validated by magic bytes, losslessly deduplicated/pruned/welded before storage, and forced into a private draft state. Floor-plan and campus-image uploads also validate their image signatures, and all publication still requires the existing review/approval workflow.

The release was validated with 139 automated tests, TypeScript checking, `git diff --check`, a production build, and responsive browser coverage. The authoritative-data boundary remains unchanged: official AIET source files are still required before publishing real indoor plans, markers, or reconstructed campus geometry.
