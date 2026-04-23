import os
import uuid
from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer
from typing import List, Dict

class RAGService:
    def __init__(self):
        # Initialize an in-memory Qdrant for development
        self.client = QdrantClient(":memory:")
        self.encoder = SentenceTransformer('all-MiniLM-L6-v2')
        self.collection_name = "hospital_info"
        
        # Create collection
        self.client.recreate_collection(
            collection_name=self.collection_name,
            vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
        )
        
        # Initial Knowledge Base (Hospital Info)
        self.seed_data([
            {"text": "Wise City Hospital is located at 123 Health Ave, opened in 1995.", "tag": "info"},
            {"text": "Visiting hours are from 9 AM to 8 PM daily.", "tag": "hours"},
            {"text": "Emergency services are available 24/7.", "tag": "emergency"},
            {"text": "Dr. Sarah Smith is the Head of Cardiology.", "tag": "staff"},
            {"text": "The hospital offers advanced oncology treatments and robotic surgery.", "tag": "services"},
            {"text": "Patients can book appointments via the online portal or by calling +91-6379489417.", "tag": "booking"}
        ])

    def seed_data(self, data_list: List[Dict], organization_id: str = "default"):
        for i, item in enumerate(data_list):
            item['organization_id'] = organization_id
            vector = self.encoder.encode(item['text']).tolist()
            
            # Create a deterministic UUID based on organization and index
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{organization_id}_{i}"))
            
            self.client.upsert(
                collection_name=self.collection_name,
                points=[
                    models.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=item
                    )
                ]
            )

    def search(self, query: str, organization_id: str = "default", limit: int = 3):
        query_vector = self.encoder.encode(query).tolist()
        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="organization_id",
                        match=models.MatchValue(value=organization_id),
                    )
                ]
            ),
            limit=limit
        )
        return [res.payload['text'] for res in results]
