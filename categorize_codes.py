import zipfile
import xml.etree.ElementTree as ET

def read_xlsx(file_path):
    shared_strings = []
    data = []
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            if 'xl/sharedStrings.xml' in z.namelist():
                with z.open('xl/sharedStrings.xml') as f:
                    tree = ET.parse(f)
                    for t in tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
                        shared_strings.append(t.text)
            
            with z.open('xl/worksheets/sheet1.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for row in root.findall('.//ns:row', ns):
                    vals = []
                    for cell in row.findall('ns:c', ns):
                        v = cell.find('ns:v', ns)
                        if v is not None:
                            val = v.text
                            if cell.get('t') == 's':
                                val = shared_strings[int(val)]
                            vals.append(val)
                    if vals:
                        data.append(vals)
        return data
    except Exception as e:
        print(f"Error: {e}")
        return []

data = read_xlsx(r'e:\programacion\informes\ARCHIVOS\CODIGOS EXCEL.xlsx')

keywords = {
    "Proveedores": ["PROVEEDOR", "COMPRA"],
    "Gastos": ["GASTOS", "SERVICIOS"],
    "Cuentas Corrientes": ["CLIENTE", "RECIBO", "COBRO", "PAGO", "CUENTA CORRIENTE", "LIQUIDACION"],
    "Auditoria": ["RECETA", "MANDATARIA", "AFIP", "VALIDA"]
}

results = {k: [] for k in keywords}

for row in data:
    txt = " ".join([str(x) for x in row]).upper()
    for cat, kws in keywords.items():
        if any(kw in txt for kw in kws):
            results[cat].append(row)

for cat, rows in results.items():
    print(f"\n--- {cat} ---")
    for r in rows:
        print(", ".join([str(x) for x in r]))
