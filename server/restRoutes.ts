import type { Express, Request, Response } from "express";
import { z } from "zod";
import { campusEdges, campusNodes } from "../shared/pathfinder";
import { calculateRoute, createRouteInstructions } from "../shared/routing";

const calculateSchema = z.object({
  startNodeId: z.string().min(1),
  destinationNodeId: z.string().min(1),
  algorithm: z.enum(["auto", "dijkstra", "astar"]).default("auto"),
  accessibleOnly: z.boolean().optional().default(false),
});

/**
 * REST compatibility layer retained for engineering-review interoperability.
 * The application UI uses typed tRPC procedures; this endpoint fulfils the published API contract.
 */
export function registerPathfinderRestRoutes(app: Express) {
  app.post("/api/routes/calculate", (req: Request, res: Response) => {
    const parsed = calculateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid route request", details: parsed.error.flatten() });
    try {
      const route = calculateRoute(campusNodes, campusEdges, parsed.data.startNodeId, parsed.data.destinationNodeId, parsed.data.algorithm, parsed.data.accessibleOnly);
      const waypoints = route.nodeIds.map(id => campusNodes.find(node => node.id === id)).filter(Boolean);
      return res.status(200).json({
        routeId: `demo-${Date.now()}`,
        algorithm: route.algorithm === "astar" ? "A*" : "Dijkstra",
        waypoints,
        totalDistance: route.totalDistance,
        estimatedTime: route.estimatedTime,
        instructions: createRouteInstructions(campusNodes, route.nodeIds),
        processing: { visitedNodeCount: route.visitedNodeCount, executionTimeMs: route.executionTimeMs },
        source: "PathFinder Smart Campus demo graph",
      });
    } catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : "No route is available." });
    }
  });
}
