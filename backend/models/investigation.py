from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class InvestigationSummary(BaseModel):
    id: str
    region: str
    observed_at: str
    oil_confidence: float
    area_km2: float
    status: str
    priority: str
    coordinates: List[float]
    detection_risk: str


class OilDetectionDetails(BaseModel):
    id: str
    model_name: str = "SegFormer-B0-MarineOil"
    backbone: str = "MiT-B0"
    resolution_meters: float = 10.0
    oil_confidence: float
    area_km2: float
    detection_risk: str
    satellite: str = "Sentinel-1B C-SAR"
    swath_mode: str = "Interferometric Wide (IW)"
    polarization: str = "VV + VH"
    coordinates: List[float]
    slick_polygon: List[List[float]]


class VesselIntelligenceDetails(BaseModel):
    investigation_id: str
    candidate_vessels: List[Dict[str, Any]]
    ais_data_points_analyzed: int
    temporal_window: str


class SourceReconstructionDetails(BaseModel):
    investigation_id: str
    source_zones: List[Dict[str, Any]]
    hypotheses: List[Dict[str, Any]]
    observed_slick_coords: List[List[float]]
    predicted_slick_coords: List[List[float]]
    environmental_inputs: Dict[str, str]


class InvestigationReport(BaseModel):
    investigation_id: str
    title: str
    generated_at: str
    lead_investigator: str
    executive_summary: str
    confidence_assessment: Dict[str, Any]
    suspect_vessel: Dict[str, Any]
    legal_dossier_status: str
