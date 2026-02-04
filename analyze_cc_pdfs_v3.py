import pdfplumber
import os
import json

def analyze_pdf(file_path, output_name):
    all_data = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if table:
                for row in table:
                    clean_row = [str(cell).replace('\n', ' ').strip() if cell else "" for cell in row]
                    if any(clean_row):
                        all_data.append(clean_row)
    
    with open(output_name, 'w', encoding='utf-8') as f:
        json.dump(all_data[:100], f, indent=2) # Save first 100 rows to inspect

if __name__ == "__main__":
    base_path = r"c:\programacion\informes\ARCHIVOS\CUENTAS CORRIENTES"
    analyze_pdf(os.path.join(base_path, "DOCUMENTOS PENDIENTES CUENTAS CORRIENTE PASEO.pdf"), "cc_paseo_sample.json")
    analyze_pdf(os.path.join(base_path, "DOCUMENTOS PENDIENTES CUENTAS CORRIENTES CHACRAS.pdf"), "cc_chacras_sample.json")
    print("Done. Files cc_paseo_sample.json and cc_chacras_sample.json created.")
