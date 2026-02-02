import React, { useMemo, useState, useEffect } from 'react';
import { Employee, PayrollRecord, PayrollConcept } from '../types';
import { getAllEmployeesFromDB, saveEmployeesToDB, getAllPayrollFromDB, savePayrollToDB } from '../utils/db';
import { formatMoney } from '../utils/dataHelpers';
import {
    Users, Wallet, Plus, Trash2, Edit2, Search,
    Calendar, Building2, Briefcase, FileText, ChevronRight,
    Save, X, CreditCard, TrendingUp, AlertCircle
} from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
    startDate: string;
    endDate: string;
    selectedBranch: string;
    onPayrollUpdate?: () => void;
}

export const PayrollDashboard: React.FC<Props> = ({
    startDate,
    endDate,
    selectedBranch,
    onPayrollUpdate
}) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
    const [activeTab, setActiveTab] = useState<'payroll' | 'employees'>('payroll');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Form States
    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [showPayrollForm, setShowPayrollForm] = useState(false);
    const [newPayroll, setNewPayroll] = useState<Partial<PayrollRecord>>({
        concepts: [],
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        periodStart: format(new Date(), 'yyyy-MM-dd'),
        periodEnd: format(new Date(), 'yyyy-MM-dd'),
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const [empData, payData] = await Promise.all([
            getAllEmployeesFromDB(),
            getAllPayrollFromDB()
        ]);
        setEmployees(empData);
        setPayroll(payData);
        setIsLoading(false);
    };

    const handleSaveEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newEmployee: Employee = {
            id: editingEmployee?.id || Date.now().toString(),
            name: formData.get('name') as string,
            cuil: formData.get('cuil') as string,
            position: formData.get('position') as string,
            branch: formData.get('branch') as string,
            startDate: formData.get('startDate') as string,
            status: formData.get('status') as 'active' | 'inactive',
            baseSalary: Number(formData.get('baseSalary')),
            bankInfo: formData.get('bankInfo') as string,
        };

        const updated = editingEmployee
            ? employees.map(emp => emp.id === editingEmployee.id ? newEmployee : emp)
            : [...employees, newEmployee];

        setEmployees(updated);
        await saveEmployeesToDB(updated);
        setShowEmployeeForm(false);
        setEditingEmployee(null);
    };

    const handleDeleteEmployee = async (id: string) => {
        if (!window.confirm('¿Eliminar empleado?')) return;
        const updated = employees.filter(e => e.id !== id);
        setEmployees(updated);
        await saveEmployeesToDB(updated);
    };

    const handleSavePayroll = async () => {
        if (!newPayroll.employeeId || !newPayroll.netAmount) {
            alert('Faltan datos obligatorios');
            return;
        }

        const employee = employees.find(e => e.id === newPayroll.employeeId);
        const record: PayrollRecord = {
            id: Date.now().toString(),
            employeeId: newPayroll.employeeId,
            employeeName: employee?.name || 'Unknown',
            branch: employee?.branch || selectedBranch,
            periodStart: newPayroll.periodStart!,
            periodEnd: newPayroll.periodEnd!,
            paymentDate: newPayroll.paymentDate!,
            netAmount: Number(newPayroll.netAmount),
            concepts: newPayroll.concepts || [],
            observations: newPayroll.observations,
            monthYear: format(new Date(newPayroll.paymentDate!), 'yyyy-MM')
        };

        const updated = [...payroll, record];
        setPayroll(updated);
        await savePayrollToDB(updated);
        setShowPayrollForm(false);
        setNewPayroll({ concepts: [], paymentDate: format(new Date(), 'yyyy-MM-dd') });
        if (onPayrollUpdate) onPayrollUpdate();
    };

    const handleDeletePayroll = async (id: string) => {
        if (!window.confirm('¿Eliminar liquidación?')) return;
        const updated = payroll.filter(p => p.id !== id);
        setPayroll(updated);
        await savePayrollToDB(updated);
        if (onPayrollUpdate) onPayrollUpdate();
    };

    const filteredEmployees = useMemo(() => {
        return employees.filter(e =>
            (e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.cuil.includes(searchTerm)) &&
            (selectedBranch === 'all' || e.branch === selectedBranch)
        );
    }, [employees, searchTerm, selectedBranch]);

    const filteredPayroll = useMemo(() => {
        return payroll.filter(p => {
            const matchBranch = selectedBranch === 'all' || p.branch === selectedBranch;
            const matchSearch = p.employeeName.toLowerCase().includes(searchTerm.toLowerCase());

            let matchDate = true;
            if (startDate && endDate) {
                const date = new Date(p.paymentDate);
                matchDate = isWithinInterval(date, {
                    start: new Date(startDate + 'T00:00:00'),
                    end: new Date(endDate + 'T23:59:59')
                });
            }
            return matchBranch && matchSearch && matchDate;
        });
    }, [payroll, searchTerm, selectedBranch, startDate, endDate]);

    const payrollStats = useMemo(() => {
        const total = filteredPayroll.reduce((acc, curr) => acc + curr.netAmount, 0);
        return { total, count: filteredPayroll.length };
    }, [filteredPayroll]);

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-teal-600 to-emerald-700 p-6 rounded-[32px] text-white shadow-xl shadow-teal-500/20 group hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-xl"><Wallet className="w-5 h-5" /></div>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded-full">Payroll</span>
                    </div>
                    <p className="text-teal-100 text-xs font-bold uppercase tracking-wider mb-1">Total Liquidaciones</p>
                    <h3 className="text-3xl font-black">{formatMoney(payrollStats.total)}</h3>
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-teal-200">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-bold">{payrollStats.count} Pagos realizados</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl group hover:shadow-2xl transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-teal-50 rounded-xl"><Users className="w-5 h-5 text-teal-600" /></div>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-teal-50 text-teal-600 px-2 py-1 rounded-full">Personal</span>
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Empleados Activos</p>
                    <h3 className="text-3xl font-black text-slate-800">{employees.filter(e => e.status === 'active').length}</h3>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-slate-400">Plantilla total: {employees.length}</span>
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl group hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/10 rounded-xl"><CreditCard className="w-5 h-5 text-teal-400" /></div>
                        <button
                            onClick={() => setShowPayrollForm(true)}
                            className="text-[10px] font-black uppercase tracking-widest bg-teal-500 text-white px-4 py-2 rounded-xl hover:bg-teal-400 transition-colors"
                        >
                            + Nueva Liquidación
                        </button>
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Acción Rápida</p>
                    <h3 className="text-xl font-black">Cargar Sueldos</h3>
                    <p className="text-slate-500 text-[10px] mt-2 italic font-medium">Impacta en el egreso operativo automáticamente</p>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="bg-white/40 backdrop-blur-xl p-4 rounded-[30px] border border-white shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('payroll')}
                        className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'payroll' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        LIQUIDACIONES
                    </button>
                    <button
                        onClick={() => setActiveTab('employees')}
                        className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'employees' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        EMPLEADOS
                    </button>
                </div>

                <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={`Buscar ${activeTab === 'payroll' ? 'liquidaciones' : 'empleados'}...`}
                        className="w-full bg-white border border-slate-100 rounded-2xl py-2 pl-11 pr-4 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {activeTab === 'employees' && (
                    <button
                        onClick={() => setShowEmployeeForm(true)}
                        className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-xs font-black hover:bg-slate-800 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        GREGAR EMPLEADO
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            {activeTab === 'employees' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEmployees.map(emp => (
                        <div key={emp.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-lg hover:shadow-xl transition-all group border-b-4 border-b-transparent hover:border-b-teal-500">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-teal-50 rounded-2xl group-hover:bg-teal-100 transition-colors">
                                    <Users className="w-6 h-6 text-teal-600" />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => { setEditingEmployee(emp); setShowEmployeeForm(true); }}
                                        className="p-2 text-slate-400 hover:text-teal-600 transition-colors"
                                    ><Edit2 className="w-4 h-4" /></button>
                                    <button
                                        onClick={() => handleDeleteEmployee(emp.id)}
                                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                                    ><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">{emp.name}</h4>
                            <p className="text-xs font-bold text-slate-400 mb-4">{emp.position} • {emp.branch}</p>

                            <div className="space-y-3 pt-4 border-t border-slate-50">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                    <span>CUIL</span>
                                    <span className="text-slate-600">{emp.cuil}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                    <span>Ingreso</span>
                                    <span className="text-slate-600">{emp.startDate}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                    <span>Estado</span>
                                    <span className={`px-2 py-0.5 rounded-full ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {emp.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredEmployees.length === 0 && (
                        <div className="col-span-full bg-white p-12 rounded-[40px] border border-dashed border-slate-200 text-center">
                            <p className="text-slate-400 font-bold italic">No se encontraron empleados.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-8 py-4 text-left text-xs font-black text-slate-400 uppercase">Período / Fecha</th>
                                    <th className="px-8 py-4 text-left text-xs font-black text-slate-400 uppercase">Empleado</th>
                                    <th className="px-8 py-4 text-left text-xs font-black text-slate-400 uppercase">Sucursal</th>
                                    <th className="px-8 py-4 text-right text-xs font-black text-slate-400 uppercase">Monto Neto</th>
                                    <th className="px-8 py-4 text-center text-xs font-black text-slate-400 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredPayroll.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)).map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
                                                    <Calendar className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-700">{format(new Date(p.periodStart), 'dd/MM')} al {format(new Date(p.periodEnd), 'dd/MM')}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Pagado: {p.paymentDate}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-slate-700 uppercase">{p.employeeName}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-xs font-bold text-slate-400 uppercase">{p.branch}</p>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <p className="text-sm font-black text-teal-600">{formatMoney(p.netAmount)}</p>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <button
                                                onClick={() => handleDeletePayroll(p.id)}
                                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                            ><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredPayroll.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-12 text-center">
                                            <p className="text-slate-400 font-bold italic">No hay registros de liquidaciones en este período.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals/Forms */}
            {showEmployeeForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter">{editingEmployee ? 'Editar' : 'Nuevo'} Empleado</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase">Datos de gestión de personal</p>
                            </div>
                            <button onClick={() => { setShowEmployeeForm(false); setEditingEmployee(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSaveEmployee} className="p-8 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Nombre Completo</label>
                                    <input name="name" defaultValue={editingEmployee?.name} required className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-teal-500/50" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">CUIL</label>
                                    <input name="cuil" defaultValue={editingEmployee?.cuil} required placeholder="00-00000000-0" className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-teal-500/50" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Puesto/Cargo</label>
                                    <input name="position" defaultValue={editingEmployee?.position} required className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-teal-500/50" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Sucursal</label>
                                    <select name="branch" defaultValue={editingEmployee?.branch || (selectedBranch !== 'all' ? selectedBranch : '')} required className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-teal-500/50">
                                        <option value="FCIA BIOSALUD">FCIA BIOSALUD</option>
                                        <option value="CHACRAS">CHACRAS PARK</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Estado</label>
                                    <select name="status" defaultValue={editingEmployee?.status || 'active'} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-teal-500/50">
                                        <option value="active">ACTIVO</option>
                                        <option value="inactive">INACTIVO</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Fecha de Ingreso</label>
                                    <input type="date" name="startDate" defaultValue={editingEmployee?.startDate} required className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-teal-500/50" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Sueldo Base ($)</label>
                                    <input type="number" name="baseSalary" defaultValue={editingEmployee?.baseSalary} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-teal-500/50" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">CBU / Datos Bancarios</label>
                                    <textarea name="bankInfo" defaultValue={editingEmployee?.bankInfo} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-teal-500/50 h-20 resize-none" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-teal-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg shadow-teal-500/20 hover:bg-teal-700 transition-all flex items-center justify-center gap-2">
                                <Save className="w-5 h-5" />
                                {editingEmployee ? 'Guardar Cambios' : 'Crear Empleado'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showPayrollForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-teal-600 p-8 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter">Nueva Liquidación</h3>
                                <p className="text-teal-100 text-xs font-bold uppercase">Registro de pago a personal</p>
                            </div>
                            <button onClick={() => setShowPayrollForm(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-8 space-y-6 overflow-y-auto">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Empleado</label>
                                <select
                                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-teal-500/50"
                                    value={newPayroll.employeeId}
                                    onChange={(e) => {
                                        const emp = employees.find(emp => emp.id === e.target.value);
                                        setNewPayroll({ ...newPayroll, employeeId: e.target.value, netAmount: emp?.baseSalary });
                                    }}
                                >
                                    <option value="">Seleccionar Empleado...</option>
                                    {employees.filter(e => e.status === 'active').map(e => (
                                        <option key={e.id} value={e.id}>{e.name} ({e.branch})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Desde</label>
                                    <input type="date" value={newPayroll.periodStart} onChange={e => setNewPayroll({ ...newPayroll, periodStart: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Hasta</label>
                                    <input type="date" value={newPayroll.periodEnd} onChange={e => setNewPayroll({ ...newPayroll, periodEnd: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Fecha de Pago</label>
                                    <input type="date" value={newPayroll.paymentDate} onChange={e => setNewPayroll({ ...newPayroll, paymentDate: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block font-bold text-teal-600">Monto Neto Pagado ($)</label>
                                    <input type="number" value={newPayroll.netAmount} onChange={e => setNewPayroll({ ...newPayroll, netAmount: Number(e.target.value) })} className="w-full bg-teal-50 border-none rounded-2xl py-3 px-4 text-sm font-black text-teal-600 outline-none ring-2 ring-teal-500/20" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Notas / Observaciones</label>
                                <textarea value={newPayroll.observations} onChange={e => setNewPayroll({ ...newPayroll, observations: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none h-20 resize-none" />
                            </div>

                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase">
                                    Este pago se verá reflejado en el MIX MAESTRO como egreso operativo de la sucursal asignada al empleado.
                                </p>
                            </div>

                            <button onClick={handleSavePayroll} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase hover:bg-slate-800 transition-all shadow-xl">
                                Confirmar Liquidación
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
