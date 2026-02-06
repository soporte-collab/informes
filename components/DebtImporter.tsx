import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { Upload, X, Check, FileSpreadsheet, Building2, AlertCircle } from 'lucide-react';
import { InsuranceRecord } from '../types';
import { parseCurrency, parseDate } from '../utils/dataHelpers';
import { format, addDays } from 'date-fns';

interface DebtImporterProps {
    onClose: () => void;
    onImport: (records: InsuranceRecord[]) => void;
}

export const DebtImporter: React.FC<DebtImporterProps> = ({ onClose, onImport }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const processFile = () => {
        if (!selectedFile || !selectedBranch) {
            setError('Debes seleccionar un archivo y una sucursal');
            return;
        }

        setIsProcessing(true);
        setError(null);

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            encoding: 'ISO-8859-1',
            complete: (results: Papa.ParseResult<any>) => {
                try {
                    const records: InsuranceRecord[] = results.data.map((row: any, index: number) => {
                        // "Cód.","Proveedor","Fecha","Fecha Venc.","Nro.Fac.","Concepto","Imp.Pres.","Imp.Bonif.","Imp.Ajuste","Imp.NC","Imp.Pago","Saldo"

                        const issueDate = parseDate(row['Fecha']);
                        const amount = parseCurrency(row['Saldo']);
                        const totalVoucher = parseCurrency(row['Imp.Pres.']);
                        const discountEntity = parseCurrency(row['Imp.Bonif.']);

                        // Status Logic
                        let status = 'PENDIENTE DE COBRO';
                        if (amount <= 0) status = 'LIQUIDADO';
                        else if (amount < totalVoucher) status = 'PAGO PARCIAL';

                        // Unique ID generation for snapshot
                        const id = `HISTORIC-${selectedBranch.replace(/\s+/g, '')}-${row['Nro.Fac.'] || index}-${index}`;

                        return {
                            id,
                            entity: row['Proveedor']?.trim() || 'DESCONOCIDO',
                            code: row['Cód.'] || '0',
                            type: 'DEUDA_HISTORICA',
                            amount: amount,
                            totalVoucher: totalVoucher,
                            discountEntity: discountEntity,
                            patientAmount: 0,
                            affiliate: '',
                            plan: row['Concepto'],
                            issueDate,
                            dueDate: addDays(issueDate, 60),
                            branch: selectedBranch,
                            status: status,
                            operationType: 'MANUAL_IMPORT',
                            monthYear: format(issueDate, 'yyyy-MM'),
                            items: []
                        };
                    });

                    // Filter out invalid records
                    const validRecords = records.filter(r => r.amount > 0 || r.status === 'LIQUIDADO');

                    if (validRecords.length === 0) {
                        setError('No se encontraron registros válidos de deuda en el archivo.');
                        setIsProcessing(false);
                        return;
                    }

                    onImport(validRecords);
                } catch (err) {
                    console.error(err);
                    setError('Error procesando el archivo. Verifica el formato CSV.');
                } finally {
                    setIsProcessing(false);
                }
            },
            error: (err) => {
                setError(`Error de lectura: ${err.message}`);
                setIsProcessing(false);
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-slate-900 p-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-white font-black text-xl flex items-center gap-2">
                            <FileSpreadsheet className="text-rose-500" />
                            Importar Deuda Real
                        </h3>
                        <p className="text-slate-400 text-xs mt-1">Sube el CSV de deuda informada</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-2">
                            1. Selecciona la Sucursal
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setSelectedBranch('FCIA BIOSALUD')}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selectedBranch === 'FCIA BIOSALUD'
                                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                                    }`}
                            >
                                <Building2 className="w-6 h-6" />
                                <span className="font-bold text-xs uppercase text-center">Fcia Biosalud</span>
                            </button>
                            <button
                                onClick={() => setSelectedBranch('CHACRAS')}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selectedBranch === 'CHACRAS'
                                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                                    }`}
                            >
                                <Building2 className="w-6 h-6" />
                                <span className="font-bold text-xs uppercase text-center">Chacras Park</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-2">
                            2. Sube el archivo CSV
                        </label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${selectedFile ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 hover:border-rose-300 hover:bg-slate-50'
                                }`}
                        >
                            {selectedFile ? (
                                <>
                                    <div className="bg-emerald-100 p-3 rounded-full">
                                        <Check className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-slate-700 text-sm truncate max-w-[200px]">{selectedFile.name}</p>
                                        <p className="text-xs text-emerald-600 font-bold mt-1">Listo para procesar</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-slate-100 p-3 rounded-full">
                                        <Upload className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-slate-600 text-sm">Haz clic para buscar</p>
                                        <p className="text-xs text-slate-400 mt-1">Formato CSV requerido</p>
                                    </div>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-[10px] text-amber-700 font-bold">
                        <p>NOTA: Importar un nuevo archivo reemplazará la deuda histórica anterior de esta sucursal.</p>
                    </div>

                    <button
                        onClick={processFile}
                        disabled={!selectedFile || !selectedBranch || isProcessing}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2"
                    >
                        {isProcessing ? 'PROCESANDO...' : 'REEMPLAZAR DEUDA'}
                    </button>
                </div>
            </div>
        </div>
    );
};
