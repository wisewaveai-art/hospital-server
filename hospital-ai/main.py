import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from dotenv import load_dotenv
import google.generativeai as genai
from services.ai_engine import AIEngine
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="WiseHospital AI Intelligence System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_engine = AIEngine()

# --- Models ---
class TranscriptionInput(BaseModel):
    text: str
    doctor_id: str
    patient_id: str

class CDSSInput(BaseModel):
    patient_history: str
    current_meds: List[str]
    new_prescription: Optional[str] = None
    vitals: Optional[Dict[str, float]] = None

class DiagnosisInput(BaseModel):
    symptoms: List[str]
    patient_age: int
    patient_gender: str

class ImagingInput(BaseModel):
    image_url: str
    modality: str  # X-ray, MRI, CT

class SchedulingInput(BaseModel):
    patient_id: str
    historical_no_shows: int
    distance_from_hospital: float
    appointment_type: str

class GenomicsInput(BaseModel):
    patient_id: str
    genetic_markers: List[str]
    condition: str

# --- Endpoints ---

@app.post("/scribe/soap-notes")
async def generate_soap_notes(data: TranscriptionInput):
    """Ambient Clinical Intelligence: Generates structured SOAP notes from transcript."""
    return await ai_engine.generate_soap_notes(data.text)

@app.post("/cdss/analyze")
async def analyze_clinical_data(data: CDSSInput):
    """Clinical Decision Support System: Flags interactions and sepsis risks."""
    return await ai_engine.analyze_cdss(data)

@app.post("/diagnosis/differential")
async def suggest_diagnosis(data: DiagnosisInput):
    """AI-Powered Differential Diagnosis and Disease Suggestion based on symptoms."""
    return await ai_engine.suggest_diagnosis(data)

@app.post("/imaging/triage")
async def triage_imaging(data: ImagingInput):
    """AI-Enhanced Diagnostic Imaging Triage."""
    return await ai_engine.triage_imaging(data)

@app.post("/scheduling/predict-flow")
async def predict_scheduling(data: SchedulingInput):
    """Smart Scheduling: Predicts no-shows and suggests double-booking."""
    prediction = ai_engine.predict_no_show(data)
    return prediction

@app.post("/personalized-care/genomics")
async def recommend_precision_medicine(data: GenomicsInput):
    """Precision Medicine: Recommends treatment based on genetic profile."""
    return await ai_engine.analyze_genomics(data)

@app.post("/chat")
async def hospital_chat_agent(data: Dict):
    """Qdrant-backed RAG Chat Agent for hospital information."""
    query = data.get("query", "")
    org_id = data.get("organization_id", "default")
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    response = await ai_engine.chat_with_agent(query, organization_id=org_id)
    return {"response": response}

@app.post("/diagnosis/track-flow")
async def track_disease_flow(data: List[Dict]):
    """Analyzes patient longitudinal history to track disease trajectory."""
    return await ai_engine.track_disease_flow(data)

@app.post("/appointments/smart-fix")
async def smart_fix_appointment(data: Dict):
    """Appointment Fixing based on AI triage insights and doctor availability."""
    return await ai_engine.smart_fix_appointment(data)

@app.get("/health")
async def health_check():
    return {"status": "AI Logic Running", "engine": "HuggingFace-Medical-Optimized"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
