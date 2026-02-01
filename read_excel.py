import pandas as pd
import sys

try:
    df = pd.read_excel(r'e:\programacion\informes\ARCHIVOS\CODIGOS EXCEL.xlsx')
    print(df.to_csv(index=False))
except Exception as e:
    print(f"Error: {e}")
