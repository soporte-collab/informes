import csv

total_chacras = 0
total_paseo = 0
count_chacras = 0
count_paseo = 0

with open('ARCHIVOS/diferencias/comprobantes de caja enero 26.CSV', 'r', encoding='latin1') as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            # Convertir el valor de "Imp. Neto" de formato argentino a float
            imp_neto_str = row['Imp. Neto'].replace('.', '').replace(',', '.')
            imp_neto = float(imp_neto_str)
            
            # Clasificar por nodo
            if 'CHACRAS' in row['Nodo'].upper():
                total_chacras += imp_neto
                count_chacras += 1
            else:
                total_paseo += imp_neto
                count_paseo += 1
        except Exception as e:
            print(f"Error procesando fila: {e}")
            continue

print(f"\n=== ANÁLISIS DE COMPROBANTES ENERO 26 ===")
print(f"\nBIOSALUD CHACRAS:")
print(f"  Registros: {count_chacras:,}")
print(f"  Total: ${total_chacras:,.2f}")
print(f"\nFCIA BIOSALUD (Paseo):")
print(f"  Registros: {count_paseo:,}")
print(f"  Total: ${total_paseo:,.2f}")
print(f"\nTOTAL GENERAL:")
print(f"  Registros: {count_chacras + count_paseo:,}")
print(f"  Total: ${total_chacras + total_paseo:,.2f}")
print(f"\nDIFERENCIA:")
print(f"  ${abs(total_chacras - total_paseo):,.2f}")
