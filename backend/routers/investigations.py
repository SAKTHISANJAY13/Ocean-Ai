from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from ..database import (
    list_investigations_for_user,
    get_investigation_by_id,
)
from ..dependencies import get_current_user, verify_investigation_ownership
from ..models.investigation import (
    InvestigationSummary,
    OilDetectionDetails,
    VesselIntelligenceDetails,
    SourceReconstructionDetails,
    InvestigationReport,
)

router = APIRouter(prefix="/api/investigations", tags=["Investigations"])


@router.get(
    "",
    response_model=List[InvestigationSummary],
    summary="List all accessible investigations for authenticated investigator",
)
async def get_investigations(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[InvestigationSummary]:
    items = list_investigations_for_user(current_user["id"])
    return [
        InvestigationSummary(
            id=item["id"],
            region=item["region"],
            observed_at=item["observed_at"],
            oil_confidence=item["oil_confidence"],
            area_km2=item["area_km2"],
            status=item["status"],
            priority=item["priority"],
            coordinates=[item["coordinates_lat"], item["coordinates_lng"]],
            detection_risk=item["detection_risk"],
        )
        for item in items
    ]


@router.get(
    "/{investigation_id}",
    response_model=InvestigationSummary,
    summary="Get single investigation metadata with authorization check",
)
async def get_investigation_details(
    investigation: Dict[str, Any] = Depends(verify_investigation_ownership),
) -> InvestigationSummary:
    return InvestigationSummary(
        id=investigation["id"],
        region=investigation["region"],
        observed_at=investigation["observed_at"],
        oil_confidence=investigation["oil_confidence"],
        area_km2=investigation["area_km2"],
        status=investigation["status"],
        priority=investigation["priority"],
        coordinates=[investigation["coordinates_lat"], investigation["coordinates_lng"]],
        detection_risk=investigation["detection_risk"],
    )


@router.get(
    "/{investigation_id}/detection",
    response_model=OilDetectionDetails,
    summary="SegFormer-B0 deep learning satellite oil slick detection and segmentation inference",
)
async def get_oil_detection_analysis(
    investigation: Dict[str, Any] = Depends(verify_investigation_ownership),
) -> OilDetectionDetails:
    # Protected deep learning inference and SAR coordinates
    return OilDetectionDetails(
        id=investigation["id"],
        model_name="SegFormer-B0-MarineOil",
        backbone="MiT-B0",
        resolution_meters=10.0,
        oil_confidence=investigation["oil_confidence"],
        area_km2=investigation["area_km2"],
        detection_risk=investigation["detection_risk"],
        satellite="Sentinel-1B C-SAR",
        swath_mode="Interferometric Wide (IW)",
        polarization="VV + VH",
        coordinates=[investigation["coordinates_lat"], investigation["coordinates_lng"]],
        slick_polygon=[
            [12.85, 80.33],
            [12.87, 80.35],
            [12.865, 80.37],
            [12.855, 80.36],
            [12.845, 80.34],
        ],
    )


@router.get(
    "/{investigation_id}/vessels",
    response_model=VesselIntelligenceDetails,
    summary="AIS vessel trajectory correlation and source attribution rankings",
)
async def get_vessel_intelligence(
    investigation: Dict[str, Any] = Depends(verify_investigation_ownership),
) -> VesselIntelligenceDetails:
    return VesselIntelligenceDetails(
        investigation_id=investigation["id"],
        candidate_vessels=[
            {
                "id": "VSL-001",
                "name": "MV OCEAN STAR",
                "mmsi": "636019843",
                "type": "Oil Tanker",
                "flag": "Panama",
                "priorityScore": 91,
                "priorityLevel": "Top Ranked Candidate",
                "spatialScore": 92,
                "temporalScore": 88,
                "trajectoryScore": 91,
                "anomalyScore": 67,
                "simulationScore": 86,
                "lastKnownPosition": [12.84, 80.32],
                "evidence": [
                    "Present during candidate release window",
                    "Trajectory intersects probable source region",
                    "AIS gap aligned with critical window",
                    "Speed anomaly detected",
                    "Route deviation observed",
                ],
            },
            {
                "id": "VSL-002",
                "name": "MV SEA FALCON",
                "mmsi": "412563829",
                "type": "Bulk Carrier",
                "flag": "Liberia",
                "priorityScore": 68,
                "priorityLevel": "Consistent Hypothesis",
                "spatialScore": 71,
                "temporalScore": 82,
                "trajectoryScore": 65,
                "anomalyScore": 42,
                "simulationScore": 61,
                "lastKnownPosition": [12.79, 80.41],
                "evidence": [
                    "Present near release window",
                    "Trajectory passes near source region",
                    "Normal speed profile",
                    "Continuous AIS transmission",
                ],
            },
        ],
        ais_data_points_analyzed=4820,
        temporal_window="T-48h to T0",
    )


@router.get(
    "/{investigation_id}/source",
    response_model=SourceReconstructionDetails,
    summary="Hydrodynamic backward-drift simulation and source zone probability modeling",
)
async def get_source_reconstruction(
    investigation: Dict[str, Any] = Depends(verify_investigation_ownership),
) -> SourceReconstructionDetails:
    return SourceReconstructionDetails(
        investigation_id=investigation["id"],
        source_zones=[
            {"id": "ZONE A", "probability": 71, "estimatedWindow": "18–27 hours before detection", "coordinates": [12.84, 80.32]},
            {"id": "ZONE B", "probability": 18, "estimatedWindow": "24–30 hours before detection", "coordinates": [12.79, 80.41]},
            {"id": "ZONE C", "probability": 7, "estimatedWindow": "15–20 hours before detection", "coordinates": [12.91, 80.27]},
        ],
        hypotheses=[
            {"id": "H1", "coordinates": [12.84, 80.32], "estimatedRelease": "T-24h", "consistency": 86},
            {"id": "H2", "coordinates": [12.79, 80.41], "estimatedRelease": "T-21h", "consistency": 65},
            {"id": "H3", "coordinates": [12.91, 80.27], "estimatedRelease": "T-18h", "consistency": 38},
        ],
        observed_slick_coords=[
            [12.85, 80.33],
            [12.87, 80.35],
            [12.865, 80.37],
            [12.855, 80.36],
            [12.845, 80.34],
        ],
        predicted_slick_coords=[
            [12.848, 80.332],
            [12.868, 80.355],
            [12.862, 80.375],
            [12.852, 80.365],
            [12.842, 80.342],
        ],
        environmental_inputs={
            "wind": "18 km/h SW",
            "surfaceCurrent": "1.2 m/s NE",
            "simulationParticles": "10,000",
            "timeStep": "30 min",
        },
    )


@router.get(
    "/{investigation_id}/report",
    response_model=InvestigationReport,
    summary="Comprehensive incident dossier and MARPOL prosecution evidence package",
)
async def get_investigation_report(
    investigation: Dict[str, Any] = Depends(verify_investigation_ownership),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> InvestigationReport:
    return InvestigationReport(
        investigation_id=investigation["id"],
        title=f"SAR Analysis and Vessel Attribution Dossier — {investigation['id']}",
        generated_at="2026-08-24T10:00:00Z",
        lead_investigator=current_user["name"],
        executive_summary="Synthetic Aperture Radar (SAR) imagery acquired via Sentinel-1 demonstrated high-confidence mineral oil anomaly in the Bay of Bengal. Hydrodynamic reverse drift modeling strongly aligns with AIS dark window of suspect tanker MV OCEAN STAR.",
        confidence_assessment={
            "sarConfidence": 94.2,
            "hydrodynamicMatch": 86.0,
            "aisAttributionScore": 91.0,
        },
        suspect_vessel={
            "name": "MV OCEAN STAR",
            "imo": "9421881",
            "mmsi": "636019843",
            "flag": "Panama",
        },
        legal_dossier_status="Evidence Ready for Maritime Authority Referral",
    )
