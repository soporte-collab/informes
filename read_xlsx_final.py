import zipfile
import xml.etree.ElementTree as ET

def get_xlsx_data(file_path):
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
                    # Keep track of columns to handle empty ones
                    row_cells = {}
                    for cell in row.findall('ns:c', ns):
                        # Cell names are like A1, B1...
                        r = cell.get('r')
                        col = "".join([c for c in r if not c.isdigit()])
                        v_node = cell.find('ns:v', ns)
                        if v_node is not None:
                            val = v_node.text
                            if cell.get('t') == 's':
                                val = shared_strings[int(val)]
                            row_cells[col] = val
                    if row_cells:
                        # Order columns A, B, C...
                        cols = sorted(row_cells.keys())
                        vals = [row_cells.get(c, "") for c in cols]
                        data.append(vals)
        return data
    except Exception as e:
        return [str(e)]

data = get_xlsx_data(r'e:\programacion\informes\ARCHIVOS\CODIGOS EXCEL.xlsx')
for row in data:
    print(" | ".join([str(x) for x in row]))
