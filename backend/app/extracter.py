from uuid import uuid4
import os
import base64
import time

from typing import Tuple
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from google.genai.errors import ServerError
import pycountry
import psycopg2

from backend.app.schemas import Invoice, PurchaseOrder, GoodsReceipt
from backend.app.system_prompt import INVOICE_EXTRACTION_PROMPT, PO_EXTRACTION_PROMPT, GR_EXTRACTION_PROMPT
load_dotenv()

llm = ChatGoogleGenerativeAI(
    model=os.getenv("MODEL_NAME", "gemini-2.5-flash"),
    api_key=os.getenv("API_KEY", ""))


invoice_llm = llm.with_structured_output(schema=Invoice)
po_llm = llm.with_structured_output(schema=PurchaseOrder)
gr_llm = llm.with_structured_output(schema=GoodsReceipt)


def extract_document(file_path: str, prompt: str, structured_model, max_retries: int = 3):
    """Generic extractor — works for Invoice, PurchaseOrder, or GoodsReceipt."""
    for attempt in range(1, max_retries + 1):
        try:
            with open(file_path, "rb") as f:
                pdf_data = base64.b64encode(f.read()).decode()

            message = [
                {
                    "role": "user",
                    "content": [
                        {"type": "media", "data": pdf_data, "mime_type": "application/pdf"},
                        {"type": "text", "text": prompt}
                    ]
                }
            ]
            return structured_model.invoke(message)

        except ServerError:
            if attempt == max_retries:
                raise
            wait = 2 ** attempt  # exponential backoff: 2s, 4s, 8s
            print(f"Gemini overloaded (attempt {attempt}/{max_retries}). Retrying in {wait}s...")
            time.sleep(wait)


def extract_invoice(file_path: str) -> Invoice:
    return extract_document(file_path, INVOICE_EXTRACTION_PROMPT, invoice_llm)

def extract_po(file_path: str) -> PurchaseOrder:
    return extract_document(file_path, PO_EXTRACTION_PROMPT, po_llm)

def extract_gr(file_path: str) -> GoodsReceipt:
    return extract_document(file_path, GR_EXTRACTION_PROMPT, gr_llm)

def extract(invoice_, gr_, po_) -> Tuple[Invoice, PurchaseOrder, GoodsReceipt]:
    if invoice_ != None: invoice = extract_invoice(invoice_)
    if gr_ != None: gr = extract_gr(gr_)
    if po_ != None: po = extract_po(po_)

    return invoice, po, gr