import pdfplumber
import os
import json

def analyze_pdf(file_path):
    results = []
    print(f"Opening {file_path}")
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if table:
                for row in table:
                    # Clean row from None and newlines
                    clean_row = [str(cell).replace('\n', ' ').strip() if cell else "" for cell in row]
                    if any(clean_row): # Skip empty rows
                        results.append(clean_row)
    
    # Print first 20 processed rows
    print(f"Found {len(results)} rows in {os.path.basename(file_path)}")
    for row in results[:20]:
        print(row)

if __name__ == "__main__":
    base_path = r"c:\programacion\informes\ARCHIVOS\CUENTAS CORRIENTES"
    analyze_pdf(os.path.join(base_path, "DOCUMENTOS PENDIENTES CUENTAS CORRIENTE PASEO.pdf"))
    print("\n" + "-"*50 + "\n")
    analyze_pdf(os.path.join(base_path, "DOCUMENTOS PENDIENTES CUENTAS CORRIENTES CHACRAS.pdf"))
