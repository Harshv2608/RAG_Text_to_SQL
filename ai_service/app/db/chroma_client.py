import os
import json
from typing import List, Dict, Any

try:
    import chromadb
    from chromadb.utils import embedding_functions
except ImportError:
    chromadb = None
    embedding_functions = None

class ChromaClient:
    def __init__(self, db_path: str = "./chroma_db", collection_name: str = "train_bank", embedding_function: Any = None):
        if chromadb is None:
            raise ImportError("chromadb is not installed")
            
        self.db_path = db_path
        self.client = chromadb.PersistentClient(path=db_path)
        
        if embedding_function is None:
            self.embedding_fn = embedding_functions.ONNXMiniLM_L6_V2()
        else:
            self.embedding_fn = embedding_function
            
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedding_fn
        )
        
    def populate(self, train_bank_path: str = "benchmark/train_bank.json", authoritative_train_path: str = "benchmark/train_bank.json", authoritative_test_path: str = "benchmark/test_benchmark.json"):
        """Populates strictly with the training bank (Bank A), guaranteeing isolation."""
        if self.collection.count() > 0:
            return  # Already populated
            
        if not os.path.exists(train_bank_path) or not os.path.exists(authoritative_train_path) or not os.path.exists(authoritative_test_path):
            raise FileNotFoundError("Required benchmark files missing.")
            
        with open(authoritative_train_path, 'r') as f:
            auth_train = json.load(f)
        with open(authoritative_test_path, 'r') as f:
            auth_test = json.load(f)
            
        if len(auth_train) != 30 or len(auth_test) != 30:
            raise ValueError("Authoritative banks must have exactly 30 records each.")
            
        train_ids = {x.get('example_id') for x in auth_train}
        test_ids = {x.get('question_id') for x in auth_test}
        train_qs = {x.get('question', '').strip().lower() for x in auth_train}
        test_qs = {x.get('question', '').strip().lower() for x in auth_test}
        train_sqls = {x.get('gold_sql', '').strip().lower() for x in auth_train}
        test_sqls = {x.get('gold_sql', '').strip().lower() for x in auth_test}
        
        if train_ids.intersection(test_ids):
            raise ValueError("Isolation Error: Train and Test IDs intersect!")
        if train_qs.intersection(test_qs):
            raise ValueError("Isolation Error: Train and Test questions intersect!")
        if train_sqls.intersection(test_sqls):
            raise ValueError("Isolation Error: Train and Test SQLs intersect!")
            
        with open(train_bank_path, 'r') as f:
            train_data = json.load(f)
            
        if len(train_data) != 30:
            raise ValueError(f"Input training bank must have exactly 30 records, found {len(train_data)}.")
            
        input_ids = {x.get('example_id') for x in train_data}
        if input_ids != train_ids:
            raise ValueError("Isolation Error: Input data contains unauthorized records (possibly test data or duplicates).")
            
        documents = []
        metadatas = []
        ids = []
        
        for record in train_data:
            documents.append(record['question'])
            metadatas.append({
                "tier": record['tier'],
                "gold_sql": record['gold_sql']
            })
            ids.append(record['example_id'])
            
        if documents:
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
        
    def retrieve(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Retrieves top_k nearest neighbors."""
        if self.collection.count() == 0:
            return []
            
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k
        )
        
        retrieved_examples = []
        if results and results.get('metadatas') and results.get('documents'):
            docs = results['documents'][0]
            metas = results['metadatas'][0]
            for doc, meta in zip(docs, metas):
                retrieved_examples.append({
                    "question": doc,
                    "gold_sql": meta['gold_sql']
                })
                
        return retrieved_examples
