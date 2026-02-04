import pdfplumber
import os

def extract_pdf_sample(file_path):
    print(f"--- ANALYZING: {os.path.basename(file_path)} ---")
    try:
        with pdfplumber.open(file_path) as pdf:
            # Extract first 2 pages to understand structure
            for i in range(min(2, len(pdf.pages))):
                print(f"--- PAGE {i+1} ---")
                text = pdf.pages[i].extract_text()
                print(text)
                print("\n")
                
                # Also try to extract tables if any
                tables = pdf.pages[i].extract_tables()
                if tables:
                    print(f"Found {len(tables)} tables on page {i+1}")
                    for tidx, table in enumerate(tables):
                        print(f"Table {tidx+1} (first 5 rows):")
                        for row in table[:5]:
                            print(row)
    except Exception as e:
        print(f"Error reading PDF: {e}")

if __name__ == "__main__":
    base_path = r"c:\programacion\informes\ARCHIVOS\CUENTAS CORRIENTES"
    files = [
        "DOCUMENTOS PENDIENTES CUENTAS CORRIENTE PASEO.pdf",
        "DOCUMENTOS PENDIENTES CUENTAS CORRIENTES CHACRAS.pdf"
    ]
    
    for f in files:
        extract_pdf_sample(os.path.join(base_path, f))
        print("="*60 + "\n")
