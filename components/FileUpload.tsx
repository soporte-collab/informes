import React, { useCallback } from 'react';
import Papa from 'papaparse';
import { Upload, Plus, FileSpreadsheet } from 'lucide-react';
import { RawCsvRow, SaleRecord } from '../types';
import { processRawData } from '../utils/dataHelpers';

interface FileUploadProps {
  onDataLoaded: (data: SaleRecord[]) => void;
  variant?: 'primary' | 'compact';
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, variant = 'primary' }) => {
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Feedback visual simple
    if (variant === 'primary') {
       // Optional: Add a loading state here if desired in future
    }

    let allRows: RawCsvRow[] = [];
    let filesProcessed = 0;
    const totalFiles = files.length;

    alert(`Procesando ${totalFiles} archivo(s)...`);

    Array.from(files).forEach((file: File) => {
      Papa.parse<RawCsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        // encoding removed to let browser detect (usually UTF-8 or Windows-1252 auto-detection works best now)
        transformHeader: (h) => h.trim(), // Remove whitespace from headers
        delimitersToGuess: [',', ';', '\t'], // Guess common delimiters
        complete: (results) => {
          
          console.log(`Leído archivo: ${file.name}`);
          console.log("Columnas detectadas:", results.meta.fields);

          // Simple validation
          if (results.meta.fields && !results.meta.fields.some(f => f.toLowerCase().includes("producto") || f.toLowerCase().includes("descri"))) {
             console.warn(`Advertencia: El archivo ${file.name} podría no tener las columnas correctas.`);
          }

          // Filter empty rows
          const validRows = results.data.filter(r => Object.values(r).some(val => val));
          allRows = [...allRows, ...validRows];
          filesProcessed++;
          
          if (filesProcessed === totalFiles) {
            if (allRows.length === 0) {
              alert("No se encontraron datos legibles. Verifique que el archivo no esté vacío y sea un CSV válido.");
              return;
            }

            try {
                const processedData = processRawData(allRows);
                
                if (processedData.length === 0) {
                  alert(`Se encontraron ${allRows.length} filas pero ninguna pudo ser procesada correctamente.\n\nVerifique:\n1. El formato de fecha (DD/MM/AAAA).\n2. Los nombres de las columnas (Producto, Cantidad, $, etc).`);
                } else {
                  console.log(`Procesados ${processedData.length} registros válidos.`);
                  alert(`¡Éxito! Se cargaron ${processedData.length} registros.`);
                  onDataLoaded(processedData);
                }
            } catch (e: any) {
                console.error(e);
                alert("Ocurrió un error al procesar los datos internos: " + e.message);
            }
          }
        },
        error: (error) => {
          console.error("Error parsing file:", error);
          alert(`Error al leer el archivo ${file.name}: ${error.message}`);
        }
      });
    });
    
    // Reset input value to allow re-uploading same file if needed
    event.target.value = '';
  }, [onDataLoaded, variant]);

  const isPrimary = variant === 'primary';

  return (
    <div className="relative group inline-block">
      <label 
        className={`
          cursor-pointer inline-flex items-center justify-center gap-3 rounded-xl transition-all duration-200 font-semibold select-none
          ${isPrimary 
            ? 'bg-biosalud-600 hover:bg-biosalud-700 active:bg-biosalud-800 text-white py-4 px-10 text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm w-full sm:w-auto min-w-[280px]' 
            : 'bg-white border border-biosalud-200 text-biosalud-700 hover:bg-biosalud-50 active:bg-biosalud-100 py-2.5 px-5 text-sm shadow-sm hover:shadow'
          }
        `}
      >
        {isPrimary ? <FileSpreadsheet className="w-6 h-6" /> : <Plus className="w-4 h-4" />}
        <span>{isPrimary ? 'Seleccionar Archivos CSV' : 'Agregar archivos'}</span>
        <input 
          type="file" 
          multiple 
          accept=".csv,.txt"
          className="hidden" 
          onChange={handleFileUpload} 
        />
      </label>
      
      {isPrimary && (
        <p className="mt-3 text-xs text-gray-400">
          Formatos soportados: CSV (con ',' o ';')
        </p>
      )}
    </div>
  );
};