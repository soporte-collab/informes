
import re
import json
import os

def extract_employees_from_xls(file_path, branch):
    employees = []
    # Pattern 1: SURNAME, NAME formats
    name_pattern_1 = re.compile(r'([A-Z\s]{2,},[\sA-Z]{2,})')
    # Pattern 2: NAME SURNAME formats (like ENRIQUE FERRER)
    # Looking for two or more uppercase words of at least 3 chars
    name_pattern_2 = re.compile(r'\b([A-Z]{3,}\s+[A-Z]{3,}(?:\s+[A-Z]{3,})?)\b')
    
    cuil_pattern = re.compile(r'(\d{1,2}-\d{8}-\d{1})')
    
    # Words to ignore that might look like names
    ignore_list = ["TOTAL", "FECHA", "ENTRADA", "SALIDA", "BIOSALUD", "PHARMACY", "REPORT", "PAGINA", "CHACRAS"]

    try:
        with open(file_path, 'rb') as f:
            content = f.read().decode('latin-1', errors='ignore')
            
            # Extract names from both patterns
            potential_names = name_pattern_1.findall(content) + name_pattern_2.findall(content)
            
            for name in potential_names:
                name = name.strip()
                
                # Filter out garbage
                if len(name) < 8 or any(word in name for word in ignore_list) or name.count(' ') > 3:
                    continue
                
                # Check for CUIL nearby
                pos = content.find(name)
                near_content = content[max(0, pos-100):pos+200]
                cuil_match = cuil_pattern.search(near_content)
                cuil = cuil_match.group(0) if cuil_match else "00-00000000-0"
                
                # Deduce Zetti alias
                zetti_alias = ""
                if ',' in name:
                    parts = name.split(',')
                    zetti_alias = parts[1].strip().split(' ' )[0] if len(parts) > 1 else name
                else:
                    zetti_alias = name.split(' ')[0]

                employees.append({
                    "id": cuil if cuil != "00-00000000-0" else f"GEN-{name.replace(' ', '')}",
                    "name": name,
                    "cuil": cuil,
                    "branch": branch,
                    "position": "Vendedor",
                    "status": "active",
                    "startDate": "2025-01-01",
                    "baseSalary": 0,
                    "zettiSellerName": zetti_alias
                })
                        
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        
    return employees

if __name__ == "__main__":
    paseo_file = r"c:\programacion\informes\ARCHIVOS\horarios\todos horarios paseo.xls"
    chacras_file = r"c:\programacion\informes\ARCHIVOS\horarios\todos informe reloj chacras.xls"
    
    all_emp = []
    if os.path.exists(paseo_file):
        all_emp.extend(extract_employees_from_xls(paseo_file, "FCIA BIOSALUD"))
    if os.path.exists(chacras_file):
        all_emp.extend(extract_employees_from_xls(chacras_file, "CHACRAS PARK"))
        
    unique = {}
    for e in all_emp:
        norm_name = e["name"].replace(" ", "").upper().replace(",", "")
        if norm_name not in unique:
            unique[norm_name] = e
        elif e["cuil"] != "00-00000000-0" and unique[norm_name]["cuil"] == "00-00000000-0":
            unique[norm_name] = e
            
    final_list = list(unique.values())
    final_list.sort(key=lambda x: x["name"])
    
    with open("employees_import_initial.json", 'w', encoding='utf-8') as f:
        json.dump(final_list, f, indent=2)
        
    print(f"Extracted {len(final_list)} employees.")
    for e in final_list:
        print(f"- {e['name']} ({e['branch']})")
