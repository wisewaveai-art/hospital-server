import os
from huggingface_hub import InferenceClient
from typing import Dict, List
import json

from services.rag_service import RAGService

class AIEngine:
    def __init__(self):
        self.api_key = os.getenv("HF_TOKEN")
        self.rag = RAGService()
        if self.api_key:
            # Using highly compatible Chat model via HF Inference API
            self.client = InferenceClient(api_key=self.api_key)
            self.model_name = "Qwen/Qwen2.5-72B-Instruct" 
            print(f"AI Engine initialized with Hugging Face: {self.model_name}")
        else:
            print("Warning: HF_TOKEN not found. AI features will use mock responses.")
            self.client = None

    async def _prompt_hf(self, prompt: str):
        if not self.client:
            return "Mock AI response: Please configure HF_TOKEN."
        
        try:
            # Non-streaming call to prevent chunking schema mismatches
            completion = self.client.chat_completion(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                stream=False,
            )
            return completion.choices[0].message.content or ""
        except Exception as e:
            return f"Error connecting to Hugging Face AI Engine: {str(e)}"

    async def chat_with_agent(self, user_query: str, organization_id: str = "default"):
        # Retrieve context from Qdrant, filtered by organization
        context_docs = self.rag.search(user_query, organization_id=organization_id)
        context_str = "\n".join(context_docs)
        
        prompt = f"""
        You are a helpful hospital assistant for Wise City Hospital.
        Use the following information to answer the user's query.
        If you don't know the answer, say you will connect them with a staff member.
        
        Hospital Information:
        {context_str}
        
        User Query: {user_query}
        
        Answer concisely and professionally.
        """
        return await self._prompt_hf(prompt)

    async def track_disease_flow(self, history: List[Dict]):
        # Analyze trajectory of symptoms/vitals over time
        history_str = json.dumps(history, indent=2)
        prompt = f"""
        Act as a Senior Diagnostic Specialist. Analyze the following patient history and track the disease flow/trajectory.
        
        Patient History:
        {history_str}
        
        1. Identify if the condition is Improving, Stabilizing, or Deteriorating.
        2. Identify the most likely disease progression path.
        3. Suggest next management steps clearly.
        4. Provide an 'AI Urgency Score' (0-100).
        """
        return await self._prompt_hf(prompt)

    async def _query_huggingface(self, payload: dict, model_id: str = "mistralai/Mistral-7B-Instruct-v0.2"):
        if not self.hf_token:
            return "Mock AI response: Please configure HF_TOKEN."
            
        headers = {"Authorization": f"Bearer {self.hf_token}"}
        API_URL = f"https://api-inference.huggingface.co/models/{model_id}"
        
        try:
            response = requests.post(API_URL, headers=headers, json=payload)
            if response.status_code == 200:
                return response.json()
            else:
                return f"Error from Hugging Face API: {response.text}"
        except Exception as e:
            return f"Error connecting to Hugging Face Engine: {str(e)}"

    async def generate_soap_notes(self, transcript: str):
        prompt = f"""
        Act as a professional medical scribe (Ambient Clinical Intelligence).
        Convert the following doctor-patient conversation transcript into a structured SOAP note.
        
        Transcript: {transcript}
        
        Format it strictly as follows:
        S (Subjective): Chief complaint, HPI, symptoms.
        O (Objective): Vital signs, physical exam findings discussed.
        A (Assessment): Diagnosis or differential diagnoses.
        P (Plan): Treatment, medications, follow-up, tests.
        """
        return {"soap_note": await self._prompt_hf(prompt)}

    async def analyze_cdss(self, data):
        prompt = f"""
        Act as a Clinical Decision Support System. Analyze the following data for:
        1. Drug-Drug interactions or allergies.
        2. Early warning signs for Sepsis or AKI.
        3. Contraindications.
        
        History: {getattr(data, 'patient_history', 'N/A')}
        Meds: {getattr(data, 'current_meds', [])}
        New Prescription: {getattr(data, 'new_prescription', 'N/A')}
        Vitals: {getattr(data, 'vitals', {})}
        
        Provide a structured response with 'alerts' and 'risk_level' (Low/Medium/High).
        """
        response = await self._prompt_hf(prompt)
        return {"analysis": response}

    async def suggest_diagnosis(self, data):
        prompt = f"""
        Act as a Specialist Physician.
        Given symptoms: {", ".join(getattr(data, 'symptoms', []))}
        Age: {getattr(data, 'patient_age', 'N/A')}, Gender: {getattr(data, 'patient_gender', 'N/A')}
        
        Provide a ranked list of differential diagnoses (top 5).
        For each diagnosis, provide:
        - Probability percentage
        - Recommended immediate test
        - Rationale
        """
        return {"differential_diagnosis": await self._prompt_hf(prompt)}

    async def triage_imaging(self, data):
        return {
            "triage_priority": "High" if "urgent" in str(data.image_url).lower() else "Routine",
            "findings_detected": ["Potential abnormality detected"] if "urgent" in str(data.image_url).lower() else ["No major findings"],
            "automated_measurements": {"Note": "CV analysis requires specific vision models."}
        }

    def predict_no_show(self, data):
        no_show_prob = (getattr(data, 'historical_no_shows', 0) * 0.3) + (getattr(data, 'distance_from_hospital', 0) * 0.05)
        is_risky = no_show_prob > 0.5
        
        return {
            "no_show_probability": min(no_show_prob, 1.0),
            "recommendation": "Double-book this slot" if is_risky else "Standard booking",
            "action": "Send extra SMS reminder" if is_risky else "Routine reminder"
        }

    async def analyze_genomics(self, data):
        prompt = f"""
        Act as a Precision Medicine Specialist.
        Patient Condition: {getattr(data, 'condition', 'N/A')}
        Genetic Markers: {", ".join(getattr(data, 'genetic_markers', []))}
        
        1. Predict the most effective medication dosage.
        2. Identify potential adverse reactions based on these biomarkers.
        3. Suggest a personalized monitoring plan.
        """
        return {"precision_plan": await self._prompt_hf(prompt)}

    async def smart_fix_appointment(self, data):
        triage_urgency = data.get("triage_urgency", "Routine")
        doctor_specialty = data.get("specialty", "General")
        
        prompt = f"""
        Given a patient with urgency: {triage_urgency} for specialty: {doctor_specialty}.
        Suggest the optimal appointment slot strategy (e.g., 'Emergency squeeze-in', 'Prioritize next available', 'Standard 1-week').
        Explain why based on medical triage standards.
        """
        return {"strategy": await self._prompt_hf(prompt), "status": "optimized"}
