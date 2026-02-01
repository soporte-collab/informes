import zipfile
import xml.etree.ElementTree as ET

def read_xlsx(file_path):
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            # Read shared strings
            shared_strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                with z.open('xl/sharedStrings.xml') as f:
                    tree = ET.parse(f)
                    for t in tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
                        shared_strings.append(t.text)
            
            # Read first sheet
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
                            # Check if it's a shared string
                            if cell.get('t') == 's':
                                val = shared_strings[int(val)]
                            vals.append(val)
                    if vals:
                        print(", ".join([str(v) for v in vals]))
                        
    except Exception as e:
        print(f"Error: {e}")

read_xlsx(r'e:\programacion\informes\ARCHIVOS\CODIGOS EXCEL.xlsx')
