export const mockIncidents = [
  {
    id: "INC-204",
    region: "Bay of Bengal",
    observedAt: "2026-08-18T04:32:00Z",
    oilConfidence: 0.942,
    areaKm2: 14.2,
    status: "Reconstruction Running",
    priority: "High",
    coordinates: [12.86, 80.35],
    detectionRisk: "Low", // Look-Alike Risk
  },
  {
    id: "INC-2026-039",
    region: "Arabian Sea",
    observedAt: "2026-08-23T14:15:00Z",
    oilConfidence: 0.74,
    areaKm2: 5.6,
    status: "New Detection",
    priority: "Medium",
    coordinates: [15.22, 69.45],
    detectionRisk: "Medium",
  },
  {
    id: "INC-2026-037",
    region: "Andaman Region",
    observedAt: "2026-08-22T08:45:00Z",
    oilConfidence: 0.91,
    areaKm2: 22.4,
    status: "AIS Correlation",
    priority: "High",
    coordinates: [10.55, 92.12],
    detectionRisk: "Low",
  },
];

export const mockVessels = [
  {
    id: "VSL-001",
    name: "MV OCEAN STAR",
    mmsi: "636019843",
    type: "Oil Tanker",
    flag: "Panama",
    priorityScore: 91,
    priorityLevel: "Top Ranked Candidate",
    spatialScore: 92,
    temporalScore: 88,
    trajectoryScore: 91,
    anomalyScore: 67, // Behavior
    simulationScore: 86, // Forward Simulation Match
    lastKnownPosition: [12.84, 80.32],
    evidence: [
      "Present during candidate release window",
      "Trajectory intersects probable source region",
      "AIS gap aligned with critical window",
      "Speed anomaly detected",
      "Route deviation observed"
    ],
    hypothesisMatchScores: {
      spatial: 88,
      shape: 81,
      temporal: 86,
      environmental: 91,
      overall: 86
    }
  },
  {
    id: "VSL-002",
    name: "MV SEA FALCON",
    mmsi: "412563829",
    type: "Bulk Carrier",
    flag: "Liberia",
    priorityScore: 68,
    priorityLevel: "Consistent Hypothesis",
    spatialScore: 71,
    temporalScore: 82,
    trajectoryScore: 65,
    anomalyScore: 42,
    simulationScore: 61,
    lastKnownPosition: [12.79, 80.41],
    evidence: [
      "Present near release window",
      "Trajectory passes near source region",
      "Normal speed profile",
      "Continuous AIS transmission"
    ],
    hypothesisMatchScores: {
      spatial: 65,
      shape: 55,
      temporal: 72,
      environmental: 68,
      overall: 65
    }
  },
  {
    id: "VSL-003",
    name: "MV BLUE HORIZON",
    mmsi: "538007412",
    type: "Container Ship",
    flag: "Marshall Islands",
    priorityScore: 41,
    priorityLevel: "Low Consistency",
    spatialScore: 54,
    temporalScore: 48,
    trajectoryScore: 42,
    anomalyScore: 21,
    simulationScore: 35,
    lastKnownPosition: [12.91, 80.27],
    evidence: [
      "Passed outside critical time window",
      "Trajectory distinct from source clusters",
      "No anomalies detected"
    ],
    hypothesisMatchScores: {
      spatial: 30,
      shape: 40,
      temporal: 35,
      environmental: 45,
      overall: 38
    }
  },
];

export const mockSourceZones = [
  {
    id: "ZONE A",
    probability: 71,
    estimatedWindow: "18–27 hours before detection",
    coordinates: [12.84, 80.32],
  },
  {
    id: "ZONE B",
    probability: 18,
    estimatedWindow: "24–30 hours before detection",
    coordinates: [12.79, 80.41],
  },
  {
    id: "ZONE C",
    probability: 7,
    estimatedWindow: "15–20 hours before detection",
    coordinates: [12.91, 80.27],
  }
];

export const mockHypotheses = [
  {
    id: "H1",
    coordinates: [12.84, 80.32],
    estimatedRelease: "T-24h",
    consistency: 86,
  },
  {
    id: "H2",
    coordinates: [12.79, 80.41],
    estimatedRelease: "T-21h",
    consistency: 65,
  },
  {
    id: "H3",
    coordinates: [12.91, 80.27],
    estimatedRelease: "T-18h",
    consistency: 38,
  },
];

// Coordinates for the polygon of the observed slick
export const mockObservedSlickCoords = [
  [12.85, 80.33],
  [12.87, 80.35],
  [12.865, 80.37],
  [12.855, 80.36],
  [12.845, 80.34],
];

export const mockPredictedSlickCoords = [
  [12.848, 80.332],
  [12.868, 80.355],
  [12.862, 80.375],
  [12.852, 80.365],
  [12.842, 80.342],
];

export const mockEnvironmentalInputs = {
  wind: "18 km/h SW",
  surfaceCurrent: "1.2 m/s NE",
  simulationParticles: "10,000",
  timeStep: "30 min"
};
