
import fitz
import json
import re
import os

def parse_zetti_pdf(file_path, branch):
    doc = fitz.open(file_path)
    records = []
    
    date_pattern = re.compile(r'(\d{2}/\d{2}/\d{4})')
    # Match strings like "$ 1.234,56" or "$ 0,00"
    money_pattern = re.compile(r'\$\s*(-?\d+(?:\.\d{3})*(?:,\d{2}))')
    
    current_entity = "Desconocido"
    current_cuit = ""
    
    for page in doc:
        text = page.get_text("text")
        lines = text.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # 1. Detection of Entity and CUIT
            # Usually format:
            # NAME, SURNAME
            # 20-XXXXXXXX-X
            if "," in line and line.isupper() and i + 1 < len(lines):
                next_line = lines[i+1].strip()
                if re.match(r'\d{2}-\d{8}-\d{1}', next_line):
                    current_entity = line
                    current_cuit = next_line
                    i += 2
                    continue

            # 2. Detection of Document block
            # In Zetti detailed report, info is spread over several lines:
            # Line 1: CUENTA CORRIENTE (Type)
            # Line 2: INGRESADO / COBRADO (Status)
            # Line 3: $ X.XXX,XX (Amount 1 - usually Total or Pending)
            # Line 4: $ X.XXX,XX (Amount 2)
            # Line 5: $ X.XXX,XX (Amount 3)
            # Line 6: FV XXXX-XXXXXXXX / NAME (Reference)
            # Line 7: DD/MM/YYYY (Issue Date)
            # Line 8: DD/MM/YYYY (Due Date)
            # Line 9: BRANCH
            
            if "CUENTA CORRIENTE" in line:
                try:
                    status_line = lines[i+1].strip()
                    # Collect up to 3 money values
                    amounts = []
                    k = i + 2
                    while len(amounts) < 3 and k < len(lines):
                        m = money_pattern.search(lines[k])
                        if m:
                            val = m.group(1).replace('.', '').replace(',', '.')
                            amounts.append(float(val))
                        k += 1
                    
                    # Look for reference (contains / or FV/NC)
                    ref = "S/N"
                    while k < len(lines) and "/" not in lines[k]:
                        k += 1
                    if k < len(lines):
                        ref = lines[k].split('/')[0].strip()
                    
                    # Look for dates
                    dates = []
                    while len(dates) < 2 and k < len(lines):
                        d = date_pattern.search(lines[k])
                        if d:
                            dates.append(d.group(0))
                        k += 1
                    
                    issue_date = dates[0] if len(dates) > 0 else "01/01/2026"
                    
                    # Zetti logic: 
                    # If status is COBRADO -> Credit
                    # If status is INGRESADO -> Debit
                    # BUT if Reference has NC -> Credit
                    
                    debit = 0.0
                    credit = 0.0
                    is_nc = "NC" in ref or "CREDITO" in status_line.upper()
                    
                    # The "Importe Pend." is usually the 3rd amount or the highest non-zero
                    # For simplicty, Zetti detailed layout usually shows Total in one of them.
                    # We take the max non-zero value as the primary transaction value
                    amount = max(amounts) if amounts else 0.0
                    
                    if is_nc or "COBRADO" in status_line.upper():
                        credit = amount
                    else:
                        debit = amount

                    records.append({
                        "id": f"{ref}-{issue_date}-{amount}-{len(records)}",
                        "entity": current_entity,
                        "cuit": current_cuit,
                        "date": issue_date,
                        "type": "NC" if is_nc else status_line,
                        "reference": ref,
                        "branch": branch,
                        "debit": debit,
                        "credit": credit,
                        "status": status_line,
                        "raw_line": f"{ref} | {status_line} | {amount}"
                    })
                    i = k # jump to where we left
                    continue
                except Exception as e:
                    pass
            
            i += 1
            
    doc.close()
    return records

if __name__ == "__main__":
    paseo_pdf = r"c:\programacion\informes\ARCHIVOS\CUENTAS CORRIENTES\documentos paseo actualizado.pdf"
    chacras_pdf = r"c:\programacion\informes\ARCHIVOS\CUENTAS CORRIENTES\documentos chacras actualizado.pdf"
    
    all_data = {}
    if os.path.exists(paseo_pdf):
        all_data["PASEO"] = parse_zetti_pdf(paseo_pdf, "FCIA BIOSALUD")
    if os.path.exists(chacras_pdf):
        all_data["CHACRAS"] = parse_zetti_pdf(chacras_pdf, "CHACRAS PARK")
        
    # Standard format the UI expects (either separate keys or GLOBAL)
    # The previous good file had PASEO/CHACRAS keys, let's keep that.
    # But for ManualImport compatibility, let's also add the GLOBAL key if needed.
    
    # Flatten for GLOBAL
    flat = []
    for k in all_data:
        flat.extend(all_data[k])
    
    output = {
        "PASEO": all_data.get("PASEO", []),
        "CHACRAS": all_data.get("CHACRAS", []),
        "GLOBAL": flat
    }
    
    with open("current_accounts_updated.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        
    print(f"Extraction complete. Total records: {len(flat)}")
