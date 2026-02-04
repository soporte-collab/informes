
import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';

interface ManualImportProps {
    onImported: (data: any) => void;
}

export const ManualImport: React.FC<ManualImportProps> = ({ onImported }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
        }
    };

    const processFile = async () => {
        if (!file) return;
        setIsProcessing(true);
        setResult(null);

        try {
            const content = await file.text();
            const data = JSON.parse(content);
            let message = "";
            let count = 0;

            let combinedRecords: any[] = [];

            // Check for multiple possible keys (GLOBAL, PASEO, CHACRAS)
            const keysToProcess = ['GLOBAL', 'PASEO', 'CHACRAS'];
            keysToProcess.forEach(key => {
                if (data[key] && Array.isArray(data[key])) {
                    // Tag records with their source key to handle missing branch info
                    const tagged = data[key].map((r: any) => ({
                        ...r,
                        _sourceKey: key
                    }));
                    combinedRecords = [...combinedRecords, ...tagged];
                }
            });

            if (combinedRecords.length > 0) {
                // Map to records usable by the dashboard (Current Accounts)
                const mapped = combinedRecords.map((r: any, idx: number) => {
                    const isNC = String(r.type || '').toUpperCase().includes('NC') ||
                        String(r.reference || '').toUpperCase().includes('NC');

                    let d = Number(r.debit) || 0;
                    let c = Number(r.credit) || 0;

                    // If it's an NC but it's in the debt column, move it to credit
                    if (isNC && d > 0 && c === 0) {
                        c = d;
                        d = 0;
                    }

                    // Handle date parsing (DD/MM/YYYY)
                    let parsedDate = new Date();
                    if (r.date && typeof r.date === 'string' && r.date.includes('/')) {
                        const parts = r.date.split('/');
                        if (parts.length === 3) {
                            parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        }
                    } else if (r.date) {
                        parsedDate = new Date(r.date);
                    }

                    return {
                        id: r.id || `MANUAL-${r._sourceKey || 'G'}-${idx}`,
                        entity: r.entity,
                        date: parsedDate,
                        type: r.type,
                        debit: d,
                        credit: c,
                        balance: d - c,
                        reference: r.reference,
                        // Determine branch, prioritize existing field then source key
                        branch: r.branch || (r._sourceKey === 'PASEO' ? 'FCIA BIOSALUD' : r._sourceKey === 'CHACRAS' ? 'CHACRAS PARK' : 'GLOBAL'),
                        description: `Sincronizado vía PDF (${r.status || 'S/E'})`
                    };
                });

                onImported({ currentAccounts: mapped });
                message = "Cuentas Corrientes importadas con éxito";
                count = mapped.length;
            } else if (Array.isArray(data) && data[0]?.cuil) {
                // It's an array of employees
                onImported({ employees: data });
                message = "Legajos de empleados creados con éxito";
                count = data.length;
            } else {
                throw new Error("Formato no reconocido. Debe ser un reporte de Cuentas Corrientes o una lista de Legajos.");
            }

            setResult({ success: true, message, count });
        } catch (e: any) {
            setResult({ success: false, message: `Error: ${e.message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100">
                    <Download className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Importador Manual</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Carga de archivos procesados</p>
                </div>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center justify-center text-center space-y-4">
                <FileText className="w-12 h-12 text-slate-300" />
                <div>
                    <p className="text-sm font-black text-slate-700 uppercase">Seleccionar archivo .JSON</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">Debe ser el archivo generado por el script de análisis</p>
                </div>
                <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="manual-json-upload"
                />
                <label
                    htmlFor="manual-json-upload"
                    className="px-6 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-all shadow-sm"
                >
                    Explorar Archivos
                </label>
                {file && <p className="text-xs font-bold text-indigo-600">{file.name}</p>}
            </div>

            <button
                disabled={!file || isProcessing}
                onClick={processFile}
                className="w-full py-4 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Procesar e Importar Ahora"}
            </button>

            {result && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in-95 duration-200 ${result.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                    {result.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <div className="flex-1">
                        <p className="text-xs font-black uppercase leading-none mb-1">{result.success ? 'Éxito' : 'Error en Carga'}</p>
                        <p className="text-[11px] font-medium opacity-80">{result.message} {result.count && `(${result.count} registros)`}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
