import React, { useMemo, useState, useEffect } from 'react';
import { Employee, PayrollRecord, PayrollConcept } from '../types';
import { getAllEmployeesFromDB, saveEmployeesToDB, getAllPayrollFromDB, savePayrollToDB, getAllAttendanceFromDB, saveAttendanceToDB } from '../utils/db';
import { formatMoney } from '../utils/dataHelpers';
import {
    Users, Wallet, Plus, Trash2, Edit2, Search,
    Calendar, Building2, Briefcase, FileText, ChevronRight,
    Save, X, CreditCard, TrendingUp, AlertCircle, Clock
} from 'lucide-react';
import { format, isWithinInterval, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { fuzzyMatch, parseExcelTime } from '../utils/hrUtils';
import { getAllHolidaysFromDB, saveHolidaysToDB, getAllLicensesFromDB, saveLicensesToDB, getAllSpecialPermitsFromDB, saveSpecialPermitsToDB, getAllSalesFromDB } from '../utils/db';
import { AttendanceCalendar } from './AttendanceCalendar';
import { TimeAttendanceRecord, EmployeeLicense, SpecialPermit, HolidayRecord, SaleRecord } from '../types';

interface Props {
    startDate: string;
    endDate: string;
    selectedBranch: string;
    onPayrollUpdate?: () => void;
    salesData?: SaleRecord[];
}

export const PayrollDashboard: React.FC<Props> = ({
    startDate,
    endDate,
    selectedBranch,
    onPayrollUpdate
}) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
    const [activeTab, setActiveTab] = useState<'payroll' | 'hr'>('payroll');
    const [hrSubTab, setHrSubTab] = useState<'employees' | 'attendance' | 'efficiency'>('employees');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [selectedEmployeeForAttendance, setSelectedEmployeeForAttendance] = useState<string>('all');

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

    const [licenses, setLicenses] = useState<EmployeeLicense[]>([]);
    const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
    const [permits, setPermits] = useState<SpecialPermit[]>([]);
    const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState<Employee | null>(null);
    const [fetchedSales, setFetchedSales] = useState<SaleRecord[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const [empData, payData, attData, licData, holData, perData, salesDataRaw] = await Promise.all([
            getAllEmployeesFromDB(),
            getAllPayrollFromDB(),
            getAllAttendanceFromDB(),
            getAllLicensesFromDB(),
            getAllHolidaysFromDB(),
            getAllSpecialPermitsFromDB(),
            getAllSalesFromDB()
        ]);
        setEmployees(empData);
        setPayroll(payData);
        setAttendance(attData);
        setLicenses(licData);
        setHolidays(holData);
        setPermits(perData);
        setFetchedSales(salesDataRaw);
        setIsLoading(false);
    };

    const handleAttendanceImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (employees.length === 0) {
            alert("⚠️ No hay empleados registrados en 'Legajos'. Primero debes crear los empleados para poder vincular sus horarios.");
            return;
        }

        const XLSX = await import('xlsx');
        setIsLoading(true);
        const allNewRecords: any[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();

            await new Promise<void>((resolve) => {
                reader.onload = async (evt) => {
                    const bstr = evt.target?.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                    // Smart detection: Multiple employees in one file
                    let currentEmployee: Employee | null = null;

                    for (let r = 0; r < rows.length; r++) {
                        const row = rows[r];
                        if (!row || row.length === 0) continue;
                        const lineStr = row.map(c => String(c)).join(' ').toUpperCase();

                        // 1. Detection of Employee Header (Name or CUIL)
                        const cuilMatch = lineStr.match(/\d{1,2}-\d{8}-\d{1}/);
                        if (cuilMatch) {
                            const cuilStr = cuilMatch[0].replace(/[^0-9]/g, '');
                            currentEmployee = employees.find(e => e.cuil.replace(/[^0-9]/g, '').includes(cuilStr)) || null;
                        }

                        // Fallback: If no current employee or New CUIL detected, try to find employee name/alias in ANY cell
                        const potentialEmp = employees.find(emp =>
                            row.some(cell => {
                                const cStr = String(cell).toUpperCase();
                                return (emp.name.toUpperCase().includes(cStr) && cStr.length > 5) ||
                                    (cStr.includes(emp.name.toUpperCase()) && emp.name.length > 5) ||
                                    (emp.zettiSellerName && cStr === emp.zettiSellerName.toUpperCase());
                            })
                        );
                        if (potentialEmp) currentEmployee = potentialEmp;

                        // 2. Detection of Data Row (Check if ANY cell in the row looks like a date)
                        // We search for a cell that matches the date pattern, not just the first one
                        const dateCellIdx = row.findIndex(c => String(c).match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/));

                        if (dateCellIdx !== -1 && currentEmployee) {
                            const dateStr = String(row[dateCellIdx]);

                            const attendanceRecord: TimeAttendanceRecord = {
                                id: `${currentEmployee.id}-${dateStr}`,
                                employeeId: currentEmployee.id,
                                employeeName: currentEmployee.name,
                                date: dateStr,
                                // We take the 4 cells following the date cell as the 4 clock-ins
                                entrance1: parseExcelTime(row[dateCellIdx + 1]),
                                exit1: parseExcelTime(row[dateCellIdx + 2]),
                                entrance2: parseExcelTime(row[dateCellIdx + 3]),
                                exit2: parseExcelTime(row[dateCellIdx + 4]),
                                totalMinutes: 0,
                                overtimeMinutes: 0,
                                status: row[dateCellIdx + 1] ? 'present' : 'absent',
                            };
                            allNewRecords.push(attendanceRecord);
                        }
                    }
                    resolve();
                };
                reader.readAsBinaryString(file);
            });
        }

        const updatedAttendance = [...attendance];
        allNewRecords.forEach(nr => {
            const idx = updatedAttendance.findIndex(a => a.id === nr.id);
            if (idx !== -1) updatedAttendance[idx] = nr;
            else updatedAttendance.push(nr);
        });

        setAttendance(updatedAttendance);
        await saveAttendanceToDB(updatedAttendance);
        setIsLoading(false);
        alert(`✅ Sincronizados ${allNewRecords.length} registros de asistencia.`);
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
            zettiSellerName: formData.get('zettiSellerName') as string,
            scheduleTemplate: {
                entrance: formData.get('entrance') as string,
                exit: formData.get('exit') as string,
            }
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

            {/* Tabs, Search & Actions Container */}
            <div className="bg-white/40 backdrop-blur-xl p-4 rounded-[30px] border border-white shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('payroll')}
                        className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'payroll' ? 'bg-white text-teal-600 shadow-sm outline outline-1 outline-teal-100' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        SUELDOS
                    </button>
                    <button
                        onClick={() => setActiveTab('hr')}
                        className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'hr' ? 'bg-white text-teal-600 shadow-sm outline outline-1 outline-teal-100' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        RRHH
                    </button>
                </div>

                {activeTab === 'hr' && (
                    <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50">
                        <button onClick={() => setHrSubTab('employees')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${hrSubTab === 'employees' ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400'}`}>Legajos</button>
                    </div>
                )}

                <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={`Buscar en ${activeTab === 'payroll' ? 'movimientos' : 'personal'}...`}
                        className="w-full bg-white border border-slate-100 rounded-2xl py-2 pl-11 pr-4 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {activeTab === 'hr' && hrSubTab === 'employees' && (
                    <button
                        onClick={() => setShowEmployeeForm(true)}
                        className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-xs font-black hover:bg-slate-800 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        AGREGAR EMPLEADO
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            {activeTab === 'payroll' ? (
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
            ) : (
                <div className="animate-in fade-in duration-500">
                    {hrSubTab === 'employees' && (
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

                                    <div className="space-y-3 pt-4 border-t border-slate-50 font-mono">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                            <span>Entrada/Salida</span>
                                            <span className="text-slate-600">{emp.scheduleTemplate?.entrance || '--:--'} a {emp.scheduleTemplate?.exit || '--:--'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                            <span>Zetti Alias</span>
                                            <span className="text-teal-600">{emp.zettiSellerName || 'SIN VINCULAR'}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setSelectedEmployeeDetail(emp)}
                                        className="w-full mt-6 py-3 bg-slate-50 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 hover:text-white transition-all border border-slate-100"
                                    >
                                        VER FICHA Y CALENDARIO
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )
            }

            {/* Modals/Forms */}
            {
                showEmployeeForm && (
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
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nombre en Zetti (Vendedor)</label>
                                        <input name="zettiSellerName" defaultValue={editingEmployee?.zettiSellerName} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-teal-500/20" placeholder="Ej: ALEXIS" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Puesto/Cargo</label>
                                        <input name="position" defaultValue={editingEmployee?.position} required className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-teal-500/50" />
                                    </div>
                                    <div className="col-span-2 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Entrada Teórica</label>
                                            <input name="entrance" type="time" defaultValue={editingEmployee?.scheduleTemplate?.entrance} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-teal-500/20" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Salida Teórica</label>
                                            <input name="exit" type="time" defaultValue={editingEmployee?.scheduleTemplate?.exit} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-teal-500/20" />
                                        </div>
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
                )
            }

            {
                showPayrollForm && (
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
                )
            }

            {selectedEmployeeDetail && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-300">
                    <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto no-scrollbar relative">
                        <AttendanceCalendar
                            employeeId={selectedEmployeeDetail.id}
                            employeeName={selectedEmployeeDetail.name}
                            attendance={attendance.filter(a => a.employeeId === selectedEmployeeDetail.id)}
                            licenses={licenses.filter(l => l.employeeId === selectedEmployeeDetail.id)}
                            holidays={holidays}
                            permits={permits.filter(p => p.employeeId === selectedEmployeeDetail.id)}
                            sales={fetchedSales.filter(s => fuzzyMatch(s.sellerName, selectedEmployeeDetail.zettiSellerName || ''))}
                            startDate={startDate}
                            endDate={endDate}
                            onAddLicense={async (date) => {
                                const type = window.prompt("Tipo de licencia (vacation, medical, permit):") as any;
                                if (!type) return;
                                const newLic: EmployeeLicense = {
                                    id: Date.now().toString(),
                                    employeeId: selectedEmployeeDetail.id,
                                    type,
                                    startDate: format(date, 'yyyy-MM-dd'),
                                    endDate: format(date, 'yyyy-MM-dd'),
                                    days: 1,
                                    status: 'approved'
                                };
                                const updated = [...licenses, newLic];
                                setLicenses(updated);
                                await saveLicensesToDB(updated);
                            }}
                            onAddPermit={async (date) => {
                                const reason = window.prompt("Motivo del permiso (ej: Trámite):");
                                if (!reason) return;
                                const fromTime = window.prompt("Desde (HH:mm):") || '00:00';
                                const toTime = window.prompt("Hasta (HH:mm):") || '00:00';
                                const newPermit: SpecialPermit = {
                                    id: Date.now().toString(),
                                    employeeId: selectedEmployeeDetail.id,
                                    date: format(date, 'yyyy-MM-dd'),
                                    fromTime,
                                    toTime,
                                    reason
                                };
                                const updated = [...permits, newPermit];
                                setPermits(updated);
                                await saveSpecialPermitsToDB(updated);
                            }}
                        />
                        <button
                            onClick={() => setSelectedEmployeeDetail(null)}
                            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-rose-500 text-white rounded-full transition-all backdrop-blur-xl"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
};
