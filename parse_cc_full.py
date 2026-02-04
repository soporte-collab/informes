import pdfplumber
import os
import json
import re

def parse_cc_pdf(file_path, branch_default):
    records = []
    current_entity = {"name": "DESCONOCIDO", "cuit": ""}
    cuit_pattern = re.compile(r'\d{2}-\d{8}-\d{1}')
    
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            if not words: continue
            
            # Reconstruct lines
            words.sort(key=lambda w: (w['top'], w['x0']))
            lines = []
            if words:
                current_line = [words[0]]
                for w in words[1:]:
                    if abs(w['top'] - current_line[-1]['top']) < 3:
                        current_line.append(w)
                    else:
                        lines.append(current_line)
                        current_line = [w]
                lines.append(current_line)
            
            for line_words in lines:
                line_str = " ".join([w['text'] for w in line_words]).strip()
                if not line_str: continue

                # Entity Detection
                cuit_match = cuit_pattern.search(line_str)
                if cuit_match:
                    cuit_val = cuit_match.group()
                    name_part = line_str.split(cuit_val)[0].strip()
                    if name_part:
                        current_entity = {"name": name_part, "cuit": cuit_val}
                    continue
                
                # Check for Name header without CUIT
                if (len(line_str) > 3 and line_str.isupper() and "," in line_str and not re.search(r'\d{2}/\d{2}', line_str)):
                    current_entity = {"name": line_str, "cuit": ""}
                    continue

                # Transaction Row Detection
                date_match = re.match(r'^(\d{2}/\d{2}/\d{4})', line_str)
                if date_match:
                    # Amounts Pattern
                    money_matches = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2})', line_str)
                    
                    amounts = []
                    for am in money_matches:
                        try:
                            amounts.append(float(am.replace('.', '').replace(',', '.')))
                        except: pass
                    
                    # Status logic
                    status = "PENDIENTE"
                    line_upper = line_str.upper()
                    if "COBRADO PMENTE" in line_upper: status = "COBRADO PMENTE"
                    elif "COBRADO" in line_upper: status = "COBRADO"
                    elif "INGRESADO" in line_upper: status = "INGRESADO"
                    
                    final_amt = amounts[-1] if amounts else 0.0
                    
                    # Reference
                    ref = ""
                    if "FV" in line_upper: 
                        try: ref = "FV " + line_str.split("FV ")[1].split(" ")[0]
                        except: ref = "FV"
                    elif "TX" in line_upper:
                        try: ref = "TX " + line_str.split("TX ")[1].split(" ")[0]
                        except: ref = "TX"
                    elif "NC" in line_upper:
                        try: ref = "NC " + line_str.split("NC ")[1].split(" ")[0]
                        except: ref = "NC"
                    
                    # RULE: TX (Transferencias) do NOT sum or subtract from totals
                    is_transfer = ref.startswith("TX")
                    
                    debit = 0.0
                    credit = 0.0
                    
                    if not is_transfer:
                        if "INGRESADO" in status:
                            debit = final_amt
                        elif "COBRADO" in status:
                            credit = final_amt
                        else:
                            debit = final_amt
                    
                    records.append({
                        "id": f"{ref}-{date_match.group()}-{final_amt}-{status}-{len(records)}",
                        "entity": current_entity["name"],
                        "cuit": current_entity["cuit"],
                        "date": date_match.group(),
                        "type": "TRANSFERENCIA" if is_transfer else status,
                        "reference": ref or line_str[11:30].strip(),
                        "branch": branch_default,
                        "debit": debit,
                        "credit": credit,
                        "status": status,
                        "is_transfer": is_transfer,
                        "raw_line": line_str # For debugging
                    })
    
    return records

if __name__ == "__main__":
    base_path = r"c:\programacion\informes\ARCHIVOS\CUENTAS CORRIENTES"
    paseo_data = parse_cc_pdf(os.path.join(base_path, "DOCUMENTOS PENDIENTES CUENTAS CORRIENTE PASEO.pdf"), "FCIA BIOSALUD")
    chacras_data = parse_cc_pdf(os.path.join(base_path, "DOCUMENTOS PENDIENTES CUENTAS CORRIENTES CHACRAS.pdf"), "BIOSALUD CHACRAS PARK")
    
    all_combined = paseo_data + chacras_data
    
    # Validation against User Example: Rabino, Sol
    rabino_recs = [r for r in all_combined if "RABINO" in r["entity"]]
    print(f"\n--- VALIDACIÓN: RABINO, SOL ---")
    total_debit = 0
    for r in rabino_recs:
        print(f"Fec: {r['date']} | Ref: {r['reference']} | Status: {r['status']} | Debit: {r['debit']} | Credit: {r['credit']}")
        total_debit += r['debit']
    print(f"TOTAL DEUDA RABINO (MATH): {total_debit} (Debe dar 142.505,76)")
    
    # Check TX logic
    tx_samples = [r for r in all_combined if r["is_transfer"]][:2]
    if tx_samples:
        print(f"\n--- VALIDACIÓN: TRANSFERENCIAS (TX) ---")
        for t in tx_samples:
            print(f"Ref: {t['reference']} | Debit: {t['debit']} | Credit: {t['credit']} (Deben ser 0)")
    
    with open("current_accounts_import.json", 'w', encoding='utf-8') as f:
        json.dump({
            "PASEO": paseo_data,
            "CHACRAS": chacras_data,
            "GLOBAL": all_combined
        }, f, indent=2)
    
    print(f"\nDone. Saved JSON for imports.")
