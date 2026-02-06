import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Building2, Calendar, Banknote, FileText } from 'lucide-react';
import { InsuranceRecord } from '../types';
import { format } from 'date-fns';

interface ManualDebtEntryProps {
    onClose: () => void;
    onSave: (records: InsuranceRecord[]) => void;
}

export const ManualDebtEntry: React.FC<ManualDebtEntryProps> = ({ onClose, onSave }) => {
    const [entity, setEntity] = useState('');
    const [branch, setBranch] = useState<'FCIA BIOSALUD' | 'CHACRAS'>('FCIA BIOSALUD');
    const [rows, setRows] = useState([{
        id: Math.random().toString(36).substr(2, 9),
        issueDate: format(new Date(), 'yyyy-MM-dd'),
        dueDate: format(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        amount: '',
        plan: ''
    }]);

    const addRow = () => {
        setRows([...rows, {
            id: Math.random().toString(36).substr(2, 9),
            issueDate: format(new Date(), 'yyyy-MM-dd'),
            dueDate: format(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
            amount: '',
            plan: ''
        }]);
    };

    const removeRow = (id: string) => {
        if (rows.length === 1) return;
        setRows(rows.filter(r => r.id !== id));
    };

    const updateRow = (id: string, field: string, value: string) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSave = () => {
        if (!entity) {
            alert("Debe ingresar el nombre de la Obra Social");
            return;
        }

        const newRecords: InsuranceRecord[] = rows.map(row => ({
            id: `MANUAL-${Date.now()}-${row.id}`,
            entity: entity.toUpperCase(),
            code: 'MANUAL',
            type: 'DEUDA_HISTORICA',
            amount: parseFloat(row.amount) || 0,
            totalVoucher: parseFloat(row.amount) || 0,
            discountEntity: parseFloat(row.amount) || 0,
            patientAmount: 0,
            affiliate: '',
            plan: row.plan || 'CARGA MANUAL',
            issueDate: new Date(row.issueDate + 'T12:00:00'),
            dueDate: new Date(row.dueDate + 'T12:00:00'),
            branch: branch,
            status: 'PENDIENTE DE COBRO',
            operationType: 'MANUAL_ENTRY',
            monthYear: format(new Date(row.issueDate + 'T12:00:00'), 'yyyy-MM'),
            items: []
        })).filter(r => r.amount > 0);

        if (newRecords.length === 0) {
            alert("No hay registros válidos para guardar");
            return;
        }

        onSave(newRecords);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-slate-900 p-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-white font-black text-xl flex items-center gap-2">
                            <Plus className="text-rose-500 w-6 h-6" />
                            Carga Manual de Deuda
                        </h3>
                        <p className="text-slate-400 text-xs mt-1">Ingresa deudas reales por Obra Social</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {/* Header Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Obra Social / Entidad</label>
                            <div className="relative">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    value={entity}
                                    onChange={(e) => setEntity(e.target.value)}
                                    placeholder="Ej: PAMI, OSEP, MEDIFE..."
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-500 outline-none transition-all placeholder:text-slate-300"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sucursal</label>
                            <div className="flex p-1 bg-slate-100 rounded-2xl">
                                <button
                                    onClick={() => setBranch('FCIA BIOSALUD')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all ${branch === 'FCIA BIOSALUD' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                                >
                                    BIOSALUD
                                </button>
                                <button
                                    onClick={() => setBranch('CHACRAS')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all ${branch === 'CHACRAS' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                                >
                                    CHACRAS
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Debt List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Registros de Deuda</label>
                            <button onClick={addRow} className="text-rose-600 hover:text-rose-700 font-black text-[10px] uppercase flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Agregar Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {rows.map((row, index) => (
                                <div key={row.id} className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-left-2 transition-all">
                                    <div className="col-span-4 space-y-1">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><FileText className="w-3 h-3" /> Periodo / Plan</p>
                                        <input
                                            type="text"
                                            value={row.plan}
                                            onChange={(e) => updateRow(row.id, 'plan', e.target.value)}
                                            placeholder="Enero / 26"
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Calendar className="w-3 h-3" /> Emisión</p>
                                        <input
                                            type="date"
                                            value={row.issueDate}
                                            onChange={(e) => updateRow(row.id, 'issueDate', e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold"
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Banknote className="w-3 h-3" /> Importe</p>
                                        <input
                                            type="number"
                                            value={row.amount}
                                            onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-rose-600"
                                        />
                                    </div>
                                    <div className="col-span-2 pb-1">
                                        <button
                                            onClick={() => removeRow(row.id)}
                                            className="w-full py-2 flex justify-center text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex gap-3">
                        <div className="bg-rose-100 p-2 rounded-xl h-fit">
                            <Plus className="w-4 h-4 text-rose-600" />
                        </div>
                        <p className="text-[10px] text-rose-800 font-bold leading-relaxed">
                            Los registros agregados manualmente se sumarán a la base de datos de deudas reales.
                            Puedes editarlos o borrarlos individualmente después.
                        </p>
                    </div>

                    <button
                        onClick={handleSave}
                        className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex justify-center items-center gap-2 shadow-xl shadow-slate-200"
                    >
                        <Save className="w-5 h-5" /> Guardar Todos los Registros
                    </button>
                </div>
            </div>
        </div>
    );
};
