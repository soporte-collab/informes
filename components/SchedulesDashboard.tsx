
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    Clock, Users, AlertCircle, CheckCircle, TrendingUp,
    ArrowRight, Calendar, Search, Filter, RefreshCw,
    UserCheck, UserX, Star, Zap, DollarSign, Briefcase,
    Upload, Download, Printer, ChevronRight, LayoutGrid,
    Activity, MousePointer2, AlertTriangle, FileSpreadsheet,
    X, Coffee, HeartPulse, Plane, Info, List, Grid3X3,
    FileDown, ChevronLeft, Settings as SettingsIcon, Plus, Trash2,
    CalendarDays, Layers
} from 'lucide-react';
import {
    format, isPast, addMinutes, parse, isWithinInterval,
    subDays, startOfDay, endOfDay, eachHourOfInterval,
    isSameDay, parseISO, eachDayOfInterval, differenceInMinutes,
    getDay, isWeekend, startOfWeek, endOfWeek, isSameMonth
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Employee, TimeAttendanceRecord, SaleRecord, HolidayRecord, EmployeeLicense, SpecialPermit, TimeBankRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import { fuzzyMatch, parseExcelTime, parseExcelDate, normalizeName, formatMinutesToHM } from '../utils/hrUtils';
import {
    getAllEmployeesFromDB, getAllAttendanceFromDB, saveAttendanceToDB,
    getAllHolidaysFromDB, getAllLicensesFromDB, getAllSalesFromDB,
    saveLicensesToDB, saveSpecialPermitsToDB, getAllSpecialPermitsFromDB,
    saveHolidaysToDB, getAllEmployeeMappingsFromDB, saveEmployeeMappingsToDB,
    clearAttendanceDB, saveTimeBankToDB, getAllTimeBankFromDB
} from '../utils/db';
import { AttendanceCalendar } from './AttendanceCalendar';
import { AttendancePrintReport } from './AttendancePrintReport';

interface Props {
    startDate: string;
    endDate: string;
    selectedBranch: string;
    onSelectBranch: (branch: string) => void;
}

export const SchedulesDashboard: React.FC<Props> = ({
    startDate: globalStartDate,
    endDate: globalEndDate,
    selectedBranch,
    onSelectBranch
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendance, setAttendance] = useState<TimeAttendanceRecord[]>([]);
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
    const [licenses, setLicenses] = useState<EmployeeLicense[]>([]);
    const [permits, setPermits] = useState<SpecialPermit[]>([]);
    const [timeBank, setTimeBank] = useState<TimeBankRecord[]>([]);
    const [employeeMappings, setEmployeeMappings] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [emp, att, sal, hol, lic, per, maps, bank] = await Promise.all([
                getAllEmployeesFromDB(),
                getAllAttendanceFromDB(),
                getAllSalesFromDB(),
                getAllHolidaysFromDB(),
                getAllLicensesFromDB(),
                getAllSpecialPermitsFromDB(),
                getAllEmployeeMappingsFromDB(),
                getAllTimeBankFromDB()
            ]);
            setEmployees(emp);
            setAttendance(att);
            setSales(sal);
            setHolidays(hol || []);
            setLicenses(lic);
            setPermits(per || []);
            setEmployeeMappings(maps || {});
            setTimeBank(bank || []);
        } catch (e) {
            console.error("Error loading schedule data:", e);
        }
        setIsLoading(false);
    };

    const handleResetAttendance = async () => {
        if (!confirm("⚠️ ¿Estás seguro de que quieres BORRAR TODA la asistencia? Esta acción no se puede deshacer.")) return;
        setIsLoading(true);
        try {
            await clearAttendanceDB();
            setAttendance([]);
            alert("✅ Todos los registros de asistencia han sido eliminados.");
        } catch (e) {
            console.error("Error resetting attendance:", e);
        }
        setIsLoading(false);
    };

    const handleAttendanceImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const XLSX = await import('xlsx');
        setIsLoading(true);
        const allNewRecords: any[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = file.name.toUpperCase();

            // Auto-detect branch from filename
            let fileBranch = selectedBranch === 'all' ? 'desconocido' : selectedBranch;
            if (fileName.includes('CHACRAS')) fileBranch = 'chacras';
            else if (fileName.includes('PASEO') || fileName.includes('BIO') || fileName.includes('SARMIENTO')) fileBranch = 'paseo';

            await new Promise<void>((resolve) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const content = evt.target?.result as string;
                    if (!content) { resolve(); return; }

                    let rows: any[][] = [];

                    if (file.name.toLowerCase().endsWith('.csv')) {
                        // Manual CSV parsing for ';' or ','
                        const lines = content.split(/\r?\n/);
                        rows = lines.map(line => {
                            if (line.includes(';')) return line.split(';');
                            return line.split(',');
                        });
                    } else {
                        const wb = XLSX.read(content, { type: 'binary' });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                    }

                    let currentEmployee: Employee | null = null;

                    for (let r = 0; r < rows.length; r++) {
                        const row = rows[r];
                        if (!row || row.length < 2) continue;

                        const rowStr = row.map(c => String(c)).join(' ').toUpperCase();

                        // 🔍 RULE: Detection via CUIL (Always priority #1)
                        const cuilMatch = rowStr.match(/\d{1,2}-\d{8}-\d{1}/);
                        if (cuilMatch) {
                            const cuilStr = cuilMatch[0].replace(/[^0-9]/g, '');
                            const found = employees.find(e => e.cuil.replace(/[^0-9]/g, '').includes(cuilStr));
                            if (found) currentEmployee = found;
                        }

                        // 📅 DATA EXTRACTION
                        let dateIdx = -1;
                        let dateStr: string | null = null;
                        for (let j = 0; j < row.length; j++) {
                            const d = parseExcelDate(row[j]);
                            if (d) { dateIdx = j; dateStr = d; break; }
                        }

                        if (dateStr) {
                            const rawNameCell = String(row[dateIdx - 1] || "").trim();

                            // 🔍 RULE: Check for pre-existing manual mapping
                            if (!currentEmployee && rawNameCell) {
                                const mappedId = employeeMappings[rawNameCell];
                                if (mappedId) {
                                    currentEmployee = employees.find(e => e.id === mappedId) || null;
                                }
                            }

                            // DETERMINE IDENTITY
                            const empId = currentEmployee ? currentEmployee.id : `virtual-${normalizeName(rawNameCell || 'unknown')}`;
                            const empName = currentEmployee ? currentEmployee.name : (rawNameCell || 'DESCONOCIDO');

                            // Unique ID includes branch to allow same person in multiple branches but overwrite if same branch/day
                            const recordId = `${empId}-${dateStr}-${fileBranch}`;

                            allNewRecords.push({
                                id: recordId,
                                employeeId: empId,
                                employeeName: empName,
                                date: dateStr,
                                branch: fileBranch,
                                entrance1: parseExcelTime(row[dateIdx + 1]),
                                exit1: parseExcelTime(row[dateIdx + 2]),
                                entrance2: parseExcelTime(row[dateIdx + 3]),
                                exit2: parseExcelTime(row[dateIdx + 4]),
                                status: row[dateIdx + 1] ? 'present' : 'absent',
                            } as TimeAttendanceRecord);
                        }
                    }
                    resolve();
                };

                if (file.name.toLowerCase().endsWith('.csv')) {
                    reader.readAsText(file);
                } else {
                    reader.readAsBinaryString(file);
                }
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
        alert(`✅ Importados ${allNewRecords.length} registros con éxito.`);
    };

    const handleAddHoliday = async () => {
        if (!newHoliday.date || !newHoliday.name) return;
        const updated = [...holidays, { id: Date.now().toString(), date: newHoliday.date, name: newHoliday.name }];
        setHolidays(updated);
        await saveHolidaysToDB(updated);
        setNewHoliday({ date: '', name: '' });
    };

    const handleDeleteHoliday = async (id: string) => {
        const updated = holidays.filter(h => h.id !== id);
        setHolidays(updated);
        await saveHolidaysToDB(updated);
    };

    const [isLinking, setIsLinking] = useState<{ excelName: string, virtualId?: string } | null>(null);

    const handleManualLink = async (realEmployeeId: string) => {
        if (!isLinking) return;

        // 1. Save mapping: Excel Name -> Real ID
        const updatedMappings = { ...employeeMappings, [isLinking.excelName]: realEmployeeId };
        setEmployeeMappings(updatedMappings);
        await saveEmployeeMappingsToDB(updatedMappings);

        // 2. Update ALL existing attendance records that had this virtual name
        if (isLinking.virtualId) {
            const updatedAttendance = attendance.map(a => {
                if (a.employeeId === isLinking.virtualId) {
                    // Determine new ID and unique primary key (including branch as per new rule)
                    const newId = `${realEmployeeId}-${a.date}-${a.branch}`;
                    return { ...a, employeeId: realEmployeeId, id: newId };
                }
                return a;
            });

            setAttendance(updatedAttendance);
            await saveAttendanceToDB(updatedAttendance);
        }

        setIsLinking(null);
        alert("✅ Vinculación completada.");
    };

    const handleAddManualHours = async (date: Date) => {
        if (!selectedEmployeeId) return;
        const emp = employees.find(e => e.id === selectedEmployeeId);
        if (!emp) return;

        const dateStr = format(date, 'dd/MM/yyyy');
        const entrance = prompt(`Entrada para ${dateStr} (HH:mm):`, "09:00");
        const exit = prompt(`Salida para ${dateStr} (HH:mm):`, "18:00");

        if (!entrance || !exit) return;

        const recordId = `${selectedEmployeeId}-${dateStr}-manual`;
        const newRecord: TimeAttendanceRecord = {
            id: recordId,
            employeeId: selectedEmployeeId,
            employeeName: emp.name,
            date: dateStr,
            branch: 'MANUAL',
            entrance1: entrance,
            exit1: exit,
            totalMinutes: 0, // Calculated on analysis
            overtimeMinutes: 0,
            status: 'present'
        };

        const updated = [...attendance, newRecord];
        setAttendance(updated);
        await saveAttendanceToDB(updated);
    };

    const handleEditAttendance = async (record: TimeAttendanceRecord) => {
        const entrance = prompt(`Editar Entrada (HH:mm):`, record.entrance1 || "09:00");
        const exit = prompt(`Editar Salida (HH:mm):`, record.exit1 || "18:00");

        if (!entrance || !exit) return;

        const updatedAttendance = attendance.map(a =>
            a.id === record.id ? { ...a, entrance1: entrance, exit1: exit, branch: 'MANUAL' } : a
        );

        setAttendance(updatedAttendance);
        await saveAttendanceToDB(updatedAttendance);
        alert("✅ Registro actualizado.");
    };

    const handleDeleteAttendance = async (recordId: string) => {
        if (!confirm("¿Estás seguro de que quieres borrar este registro de asistencia?")) return;

        const updatedAttendance = attendance.filter(a => a.id !== recordId);
        setAttendance(updatedAttendance);
        await saveAttendanceToDB(updatedAttendance);
    };

    const handleTimeBankAction = async (date: Date) => {
        if (!selectedEmployeeId) return;
        const dateISO = format(date, 'yyyy-MM-dd');

        const type = prompt("Tipo de acción: 'deuda' (debe horas) o 'credito' (devuelve horas)?", "deuda");
        if (type !== 'deuda' && type !== 'credito') return;

        const hoursStr = prompt(`¿Cuántas horas? (Ej: 8):`, "8");
        const hours = parseFloat(hoursStr || "0");
        if (isNaN(hours) || hours <= 0) return;

        const reason = prompt("Motivo:", type === 'deuda' ? "Día personal" : "Devolución de horas");

        const newEntry: TimeBankRecord = {
            id: Date.now().toString(),
            employeeId: selectedEmployeeId,
            date: dateISO,
            hours: type === 'deuda' ? -hours : hours,
            reason: reason || "",
            type: type as 'debt' | 'credit'
        };

        const updated = [...timeBank, newEntry];
        setTimeBank(updated);
        await saveTimeBankToDB(updated);
    };

    const handleAddLicense = async (date: Date) => {
        if (!selectedEmployeeId) return;
        const type = prompt("Tipo de licencia (vacation, medical, suspension, permit):", "vacation") as any;
        if (!['vacation', 'medical', 'suspension', 'permit'].includes(type)) return;

        const days = prompt("¿Cuántos días?", "1");
        const numDays = parseInt(days || "1");

        const endDate = format(addMinutes(date, (numDays - 1) * 24 * 60), 'yyyy-MM-dd');

        const newLicense: EmployeeLicense = {
            id: Date.now().toString(),
            employeeId: selectedEmployeeId,
            type,
            startDate: format(date, 'yyyy-MM-dd'),
            endDate,
            days: numDays,
            status: 'approved'
        };

        const updated = [...licenses, newLicense];
        setLicenses(updated);
        await saveLicensesToDB(updated);
    };

    const handleAddPermit = async (date: Date) => {
        if (!selectedEmployeeId) return;
        const fromTime = prompt("Hora inicio (HH:mm):", "09:00");
        const toTime = prompt("Hora fin (HH:mm):", "11:00");
        const reason = prompt("Motivo:", "Trámite personal");

        if (!fromTime || !toTime) return;

        const newPermit: SpecialPermit = {
            id: Date.now().toString(),
            employeeId: selectedEmployeeId,
            date: format(date, 'yyyy-MM-dd'),
            fromTime,
            toTime,
            reason: reason || ''
        };

        const updated = [...permits, newPermit];
        setPermits(updated);
        await saveSpecialPermitsToDB(updated);
    };

    const employeeAnalysis = useMemo(() => {
        const start = globalStartDate + 'T00:00:00';
        const end = globalEndDate + 'T23:59:59';

        const getExpectedHours = (date: Date) => {
            const day = getDay(date);
            if (day === 0) return 0; // Sun
            if (day === 6) return 4; // Sat
            return 8;
        };

        const allDaysInRange = eachDayOfInterval({
            start: parseISO(globalStartDate),
            end: parseISO(globalEndDate)
        });

        // --- DETERMINISTIC BASE IDENTITIES ---
        // Rule: NO AUTOMATIC FUZZY MERGE.
        const analysisData = employees.map(emp => {
            // Match attendance STRICTLY by ID. No more guessing.
            const groupAttendance = attendance.filter(a => a.employeeId === emp.id);

            // Consolidate branches: Initial branch + any branch where attendance was recorded
            const attendanceBranches = Array.from(new Set(groupAttendance.map(a => a.branch).filter(Boolean)));
            const consolidatedBranchesList = Array.from(new Set([emp.branch, ...attendanceBranches]));
            const consolidatedBranches = consolidatedBranchesList.join(' + ');

            // FILTER: If not 'all', check if the person has records or belongs to the selected branch
            let matchBranch = true;
            if (selectedBranch === 'paseo') matchBranch = consolidatedBranches.toUpperCase().includes('PASEO') || consolidatedBranches.toUpperCase().includes('BIO') || consolidatedBranches.toUpperCase().includes('SARMIENTO');
            else if (selectedBranch === 'chacras') matchBranch = consolidatedBranches.toUpperCase().includes('CHACRAS');
            else if (selectedBranch !== 'all' && selectedBranch) matchBranch = consolidatedBranches.toUpperCase().includes(selectedBranch.toUpperCase());

            const filteredAttendance = groupAttendance.filter(a => {
                const parts = a.date.split('/');
                if (parts.length !== 3) return false;
                const aDate = `${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`;
                const inRange = aDate >= start && aDate <= end;

                // If filtering by branch, only include records from that branch
                if (selectedBranch !== 'all' && selectedBranch) {
                    let recordMatches = false;
                    // Check attendance record's branch, or fall back to employee's primary branch if attendance record has no branch
                    const recordBranch = a.branch || emp.branch;
                    if (selectedBranch === 'paseo') recordMatches = recordBranch?.toUpperCase().includes('PASEO') || recordBranch?.toUpperCase().includes('BIO') || recordBranch?.toUpperCase().includes('SARMIENTO');
                    else if (selectedBranch === 'chacras') recordMatches = recordBranch?.toUpperCase().includes('CHACRAS');
                    else recordMatches = recordBranch?.toUpperCase().includes(selectedBranch.toUpperCase());
                    return inRange && recordMatches;
                }
                return inRange;
            });

            // Sales (Informational: Match by name/alias)
            const identities = [emp.name, ...(emp.zettiSellerName ? [emp.zettiSellerName] : [])];
            const groupSales = sales.filter(s => {
                const sDateStr = format(s.date, 'yyyy-MM-ddTHH:mm:ss');
                const inRange = sDateStr >= start && sDateStr <= end;
                const isMatch = identities.some(id => s.sellerName === id || fuzzyMatch(s.sellerName, id));
                return isMatch && inRange;
            });

            const groupLicenses = licenses.filter(l => l.employeeId === emp.id);

            // Calculation Logic (Independent per person)
            const processedDates = new Map<string, number>();
            filteredAttendance.forEach(a => {
                let mins = 0;
                if (a.entrance1 && a.exit1) {
                    const [h1, m1] = a.entrance1.split(':').map(Number);
                    const [h2, m2] = a.exit1.split(':').map(Number);
                    if (!isNaN(h1) && !isNaN(h2)) mins += (h2 * 60 + m2) - (h1 * 60 + m1);
                }
                if (a.entrance2 && a.exit2) {
                    const [h1, m1] = a.entrance2.split(':').map(Number);
                    const [h2, m2] = a.exit2.split(':').map(Number);
                    if (!isNaN(h1) && !isNaN(h2)) mins += (h2 * 60 + m2) - (h1 * 60 + m1);
                }
                // RULE: If multiple records for the same day (e.g. from different files or merged virtuals), SUM them
                processedDates.set(a.date, (processedDates.get(a.date) || 0) + Math.max(0, mins));
            });

            // 🏛️ HOLIDAY RULE: Holidays are NOT expected hours. Working them is overtime.
            const dailyStats = allDaysInRange.map(d => {
                const dStr = format(d, 'dd/MM/yyyy');
                const dIso = format(d, 'yyyy-MM-dd');
                const mins = processedDates.get(dStr) || 0;
                const isHoliday = holidays.some(h => h.date === dIso);
                const hasSale = groupSales.some(s => isSameDay(s.date, d));
                const lic = groupLicenses.find(l => isWithinInterval(d, { start: parseISO(l.startDate), end: parseISO(l.endDate) }));

                let effectiveHours = mins / 60;
                let status: 'off' | 'present' | 'absent' | 'holiday' | 'license' | 'anomaly' | 'weekend' =
                    mins > 0 ? 'present' : (hasSale ? 'anomaly' : (isWeekend(d) ? 'weekend' : 'off'));

                if (lic) status = 'license';
                else if (isHoliday) status = 'holiday'; // Keep holiday status for coloring, even if worked

                return {
                    status,
                    hours: effectiveHours,
                    date: dStr,
                    isHoliday
                };
            });

            const totalHours = dailyStats.reduce((sum, ds) => sum + ds.hours, 0);

            // 🏛️ BASE RULE: 45 hours per week is the standard.
            const WEEKLY_BASE = 45;

            // Calculate number of weeks in the range (rounded to 1 decimal)
            const daysInRange = allDaysInRange.length;
            const weeksInRange = daysInRange / 7;
            const expectedHoursRange = weeksInRange * WEEKLY_BASE;

            return {
                id: emp.id,
                name: emp.name,
                branch: consolidatedBranches,
                position: emp.position,
                totalHours,
                expectedHours: expectedHoursRange,
                overtime: Math.max(0, totalHours - expectedHoursRange),
                progressPerc: expectedHoursRange > 0 ? Math.min(100, (totalHours / expectedHoursRange) * 100) : 0,
                totalRevenue: groupSales.reduce((sum, s) => sum + s.totalAmount, 0),
                effectiveness: totalHours > 0 ? groupSales.reduce((sum, s) => sum + s.totalAmount, 0) / totalHours : 0,
                anomalyCount: dailyStats.filter(ds => ds.status === 'anomaly').length,
                dayDetails: dailyStats,
                dayDates: allDaysInRange.map(d => format(d, 'dd/MM')),
                isVirtual: false,
                matchBranch // Helper for filtering
            };
        });

        // Virtual Identities (Those that don't have a database profile yet)
        const virtualAttendance = attendance.filter(a => a.employeeId.startsWith('virtual-'));
        const virtualIds = Array.from(new Set(virtualAttendance.map(a => a.employeeId)));

        const virtualAnalysis = virtualIds.map(vId => {
            const records = virtualAttendance.filter(a => a.employeeId === vId);
            const filtered = records.filter(a => {
                const parts = a.date.split('/');
                if (parts.length !== 3) return false;
                const aDate = `${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`;
                const inRange = aDate >= start && aDate <= end;

                if (selectedBranch !== 'all' && selectedBranch) {
                    let recordMatches = false;
                    if (selectedBranch === 'paseo') recordMatches = a.branch?.toUpperCase().includes('PASEO') || a.branch?.toUpperCase().includes('BIO') || a.branch?.toUpperCase().includes('SARMIENTO');
                    else if (selectedBranch === 'chacras') recordMatches = a.branch?.toUpperCase().includes('CHACRAS');
                    else recordMatches = a.branch?.toUpperCase().includes(selectedBranch.toUpperCase());
                    return inRange && recordMatches;
                }
                return inRange;
            });

            const processedDates = new Map<string, number>();
            filtered.forEach(a => {
                let mins = 0;
                if (a.entrance1 && a.exit1) {
                    const [h1, m1] = a.entrance1.split(':').map(Number);
                    const [h2, m2] = a.exit1.split(':').map(Number);
                    if (!isNaN(h1) && !isNaN(h2)) mins += (h2 * 60 + m2) - (h1 * 60 + m1);
                }
                if (a.entrance2 && a.exit2) {
                    const [h1, m1] = a.entrance2.split(':').map(Number);
                    const [h2, m2] = a.exit2.split(':').map(Number);
                    if (!isNaN(h1) && !isNaN(h2)) mins += (h2 * 60 + m2) - (h1 * 60 + m1);
                }
                processedDates.set(a.date, (processedDates.get(a.date) || 0) + Math.max(0, mins));
            });

            const totalWorkedMinutes = Array.from(processedDates.values()).reduce((sum, m) => sum + m, 0);
            const totalHours = totalWorkedMinutes / 60;

            const dailyStats = allDaysInRange.map(d => {
                const dStr = format(d, 'dd/MM/yyyy');
                const dayMins = processedDates.get(dStr) || 0;
                return {
                    status: dayMins > 0 ? 'present' : 'off',
                    hours: dayMins / 60,
                    date: dStr,
                    isHoliday: false
                };
            });

            const vBranch = Array.from(new Set(records.map(r => r.branch))).join(' + ') || 'SIN ASIGNAR';
            let matchBranch = true;
            if (selectedBranch === 'paseo') matchBranch = vBranch.toUpperCase().includes('PASEO') || vBranch.toUpperCase().includes('BIO') || vBranch.toUpperCase().includes('SARMIENTO');
            else if (selectedBranch === 'chacras') matchBranch = vBranch.toUpperCase().includes('CHACRAS');
            else if (selectedBranch !== 'all' && selectedBranch) matchBranch = vBranch.toUpperCase().includes(selectedBranch.toUpperCase());

            return {
                id: vId,
                name: records[0].employeeName,
                branch: vBranch,
                position: 'EXTERNO',
                totalHours: totalHours,
                expectedHours: 0,
                overtime: 0,
                progressPerc: 0,
                totalRevenue: 0,
                effectiveness: 0,
                anomalyCount: 0,
                dayDetails: dailyStats,
                dayDates: allDaysInRange.map(d => format(d, 'dd/MM')),
                isMerged: false,
                isVirtual: true,
                matchBranch
            };
        });

        return [...analysisData, ...virtualAnalysis].filter(emp => {
            const matchSearch = String(emp.name).toLowerCase().includes(searchTerm.toLowerCase());
            // Filter out if branch doesn't match and it's not 'all'
            // and don't show persons with 0 hours in specific branch filters unless they belong to that branch
            const matchBranch = emp.matchBranch && (selectedBranch === 'all' || emp.totalHours > 0 || (emp.branch.toUpperCase().includes(selectedBranch.toUpperCase())));

            return matchSearch && matchBranch;
        }).sort((a, b) => b.overtime - a.overtime);
    }, [employees, attendance, sales, searchTerm, selectedBranch, globalStartDate, globalEndDate, licenses, holidays]);

    const exportToCSV = () => {
        const headers = ["Empleado", "Sucursal(es)", "Horas Trabajadas", "Horas Esperadas", "Horas Extras", "Ventas", "Eficiencia $/h"];
        const rows = employeeAnalysis.map(e => [
            e.name, e.branch, e.totalHours.toFixed(1), e.expectedHours.toFixed(1), e.overtime.toFixed(1), e.totalRevenue.toFixed(0), e.effectiveness.toFixed(0)
        ]);
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `reporte_horas_extras_${globalStartDate}.csv`);
        link.click();
    };

    const activeEmployee = employees.find(e => e.id === selectedEmployeeId) || null;

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Extended Header */}
            <div className="bg-slate-900 rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl border border-slate-800">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-indigo-500/10 to-transparent"></div>
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-emerald-500 p-2.5 rounded-2xl shadow-lg ring-4 ring-emerald-500/20">
                                <Layers className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em]">Smart Consolidation Active</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 leading-none">Cálculo de <span className="text-indigo-500">Extras</span></h1>
                        <p className="text-slate-400 text-xs font-bold leading-relaxed mb-8 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500" /> Consolidación de Sucursales y Horas
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-900 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-95">
                                <Upload className="w-4 h-4" /> Cargar Excel Reloj
                            </button>
                            <button onClick={exportToCSV} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-500/20 active:scale-95">
                                <FileDown className="w-4 h-4" /> Bajar Reporte CSV
                            </button>
                            <button onClick={() => setShowPrintModal(true)} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20 active:scale-95">
                                <Printer className="w-4 h-4" /> Vista de Impresión
                            </button>
                            <button onClick={() => setShowSettings(true)} className="bg-slate-800 text-slate-300 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-700 transition-all active:scale-95">
                                <SettingsIcon className="w-4 h-4" /> Configuración
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
                        <div className="bg-slate-800/40 backdrop-blur-xl p-8 rounded-[40px] border border-white/5 shadow-2xl min-w-[200px]">
                            <p className="text-slate-500 text-[9px] font-black uppercase mb-2 tracking-widest">Total Empresa</p>
                            <p className="text-4xl font-black text-white">{formatMinutesToHM(employeeAnalysis.reduce((sum, e) => sum + e.totalHours, 0) * 60)}</p>
                        </div>
                        <div className="bg-indigo-500/10 backdrop-blur-xl p-8 rounded-[40px] border border-indigo-500/20 shadow-2xl min-w-[200px]">
                            <p className="text-indigo-400 text-[9px] font-black uppercase mb-2 tracking-widest">Total Extras</p>
                            <p className="text-4xl font-black text-indigo-400">{formatMinutesToHM(employeeAnalysis.reduce((sum, e) => sum + e.overtime, 0) * 60)}</p>
                        </div>
                    </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleAttendanceImport} className="hidden" accept=".xlsx,.xls" />
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-4 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/20">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
                    <button onClick={() => setViewMode('list')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                        <List className="w-4 h-4" /> Detalle Diario
                    </button>
                    <button onClick={() => setViewMode('grid')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                        <Grid3X3 className="w-4 h-4" /> Tarjetas
                    </button>
                </div>

                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input type="text" placeholder="BUSCAR POR APELLIDO O NOMBRE..." className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
                    <button onClick={() => onSelectBranch('all')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedBranch === 'all' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400'}`}>Global</button>
                    <button onClick={() => onSelectBranch('paseo')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedBranch === 'paseo' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400'}`}>Paseo</button>
                    <button onClick={() => onSelectBranch('chacras')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedBranch === 'chacras' ? 'bg-white text-orange-600 shadow-lg' : 'text-slate-400'}`}>Chacras</button>
                </div>
            </div>

            {/* List View */}
            {viewMode === 'list' ? (
                <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
                    <div className="overflow-x-auto custom-scrollbar-h">
                        <table className="w-full text-left border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                    <td className="p-8 sticky left-0 bg-slate-50 z-10 w-[350px]">Colaborador Consolidado</td>
                                    {employeeAnalysis[0]?.dayDates.map((d, idx) => (
                                        <td key={idx} className="p-4 text-center min-w-[70px]">{d}</td>
                                    ))}
                                    <td className="p-8 text-right bg-slate-50 sticky right-0 z-10 w-[180px]">TOTAL / EXTRAS</td>
                                </tr>
                            </thead>
                            <tbody>
                                {employeeAnalysis.map(emp => (
                                    <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors group">
                                        <td className="p-8 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[5px_0_15px_-5px_rgba(0,0,0,0.05)]" onClick={() => setSelectedEmployeeId(emp.id)}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs relative ${emp.isVirtual ? 'bg-amber-100 text-amber-600 border-2 border-amber-200' : 'bg-indigo-50 text-indigo-600'}`}>
                                                    {emp.name.charAt(0)}
                                                    {emp.isVirtual && <AlertTriangle className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full p-0.5 border-2 border-white" />}
                                                </div>
                                                <div className="truncate flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-sm font-black uppercase group-hover:text-indigo-600 truncate ${emp.isVirtual ? 'text-amber-600' : 'text-slate-900'}`}>{emp.name}</p>
                                                        {emp.isVirtual && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setIsLinking({ excelName: emp.name, virtualId: emp.id }); }}
                                                                className="px-2 py-1 bg-amber-500 text-white text-[8px] font-black rounded-lg hover:bg-amber-600 transition-colors uppercase"
                                                            >
                                                                Vincular
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{emp.branch}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {emp.dayDetails.map((day, i) => (
                                            <td key={i} className="p-2" onClick={() => setSelectedEmployeeId(emp.id)}>
                                                <div className={`w-14 min-h-[44px] rounded-xl flex items-center justify-center transition-all ${day.status === 'present' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 font-black text-[10px]' :
                                                    day.status === 'anomaly' ? 'bg-rose-500 text-white shadow-lg font-black text-[10px]' :
                                                        day.status === 'license' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                            day.status === 'holiday' ? 'bg-amber-100 text-amber-700 font-black text-[10px] shadow-sm' :
                                                                'bg-slate-50 opacity-20'
                                                    }`}>
                                                    {day.hours > 0 ? formatMinutesToHM(day.hours * 60) : (day.status === 'license' ? 'LIC' : (day.status === 'holiday' ? 'FER' : ''))}
                                                </div>
                                            </td>
                                        ))}
                                        <td className="p-8 text-right bg-white group-hover:bg-slate-50 sticky right-0 z-10 shadow-[-5px_0_15px_-5px_rgba(0,0,0,0.05)]" onClick={() => setSelectedEmployeeId(emp.id)}>
                                            <div className="flex flex-col items-end">
                                                <p className="text-lg font-black text-slate-900">{formatMinutesToHM(emp.totalHours * 60)}</p>
                                                {emp.overtime > 0 && <p className="text-[10px] font-black text-emerald-500">+{formatMinutesToHM(emp.overtime * 60)} EXTRAS</p>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {employeeAnalysis.map(emp => (
                        <div key={emp.id} onClick={() => setSelectedEmployeeId(emp.id)} className={`group bg-white rounded-[44px] cursor-pointer border-2 transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl p-10 flex flex-col ${emp.anomalyCount > 0 ? 'border-rose-500 shadow-rose-100' : 'border-slate-50 hover:border-indigo-100'}`}>
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-none uppercase group-hover:text-indigo-600 transition-colors truncate max-w-[200px]">{emp.name.split(',')[0]}</h3>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">{emp.branch}</p>
                                </div>
                                {emp.isVirtual && <div className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-[8px] font-black uppercase flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Virtual</div>}
                            </div>
                            <div className="mt-auto space-y-4">
                                <div className="bg-slate-50 p-4 rounded-3xl">
                                    <p className="text-[9px] font-black text-slate-400 uppercase">Horas Extras del Mes</p>
                                    <p className="text-2xl font-black text-indigo-500">+{formatMinutesToHM(emp.overtime * 60)}</p>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${emp.progressPerc >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${emp.progressPerc}%` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {selectedEmployeeId && (
                <AttendanceCalendar
                    employeeId={selectedEmployeeId}
                    employeeName={employees.find(e => e.id === selectedEmployeeId)?.name || 'Desconocido'}
                    attendance={attendance.filter(a => a.employeeId === selectedEmployeeId)}
                    licenses={licenses.filter(l => l.employeeId === selectedEmployeeId)}
                    sales={sales.filter(s => s.sellerName === employees.find(e => e.id === selectedEmployeeId)?.zettiSellerName || s.sellerName === employees.find(e => e.id === selectedEmployeeId)?.name)}
                    holidays={holidays}
                    permits={permits.filter(p => p.employeeId === selectedEmployeeId)}
                    timeBank={timeBank.filter(b => b.employeeId === selectedEmployeeId)}
                    startDate={globalStartDate}
                    endDate={globalEndDate}
                    onAddLicense={handleAddLicense}
                    onAddPermit={handleAddPermit}
                    onAddManualHours={handleAddManualHours}
                    onTimeBankAction={handleTimeBankAction}
                    onEditAttendance={handleEditAttendance}
                    onDeleteAttendance={handleDeleteAttendance}
                    onClose={() => setSelectedEmployeeId(null)}
                />
            )}

            {/* Print Report Modal */}
            {showPrintModal && (
                <div id="print-report-modal-wrapper" className="fixed inset-0 z-[150] bg-white overflow-y-auto">
                    <AttendancePrintReport
                        data={employeeAnalysis}
                        startDate={globalStartDate}
                        endDate={globalEndDate}
                        user="ADMIN"
                        onClose={() => setShowPrintModal(false)}
                    />
                </div>
            )}

            {/* Manual Link Modal */}
            {isLinking && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden p-10">
                        <div className="text-center mb-8">
                            <div className="bg-amber-100 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Users className="w-8 h-8 text-amber-600" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase">Vincular Identidad</h2>
                            <p className="text-slate-500 text-[10px] font-bold uppercase mt-2 tracking-widest">
                                Mapear: <span className="text-amber-600 px-2 py-0.5 bg-amber-50 rounded-lg">{isLinking.excelName}</span>
                            </p>
                        </div>

                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-4">Seleccionar Empleado Real:</p>
                            {employees.sort((a, b) => a.name.localeCompare(b.name)).map(realEmp => (
                                <button
                                    key={realEmp.id}
                                    onClick={() => handleManualLink(realEmp.id)}
                                    className="w-full p-5 bg-slate-50 hover:bg-emerald-500 hover:text-white rounded-2xl border border-slate-100 text-left transition-all flex items-center justify-between group"
                                >
                                    <div>
                                        <p className="text-[11px] font-black uppercase">{realEmp.name}</p>
                                        <p className="text-[9px] font-bold opacity-60 uppercase">{realEmp.branch}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all" />
                                </button>
                            ))}
                        </div>

                        <button onClick={() => setIsLinking(null)} className="w-full mt-8 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors tracking-widest">Cancelar vinculación</button>
                    </div>
                </div>
            )}

            {/* settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[48px] shadow-2xl overflow-hidden">
                        <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase italic">Configuración Operativa</h2>
                                <p className="text-slate-500 text-xs font-bold uppercase mt-1">Gestión de Feriados y Mapeos</p>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="p-3 bg-white text-slate-400 hover:text-rose-500 rounded-2xl shadow-sm border border-slate-100"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto">
                            {/* Holidays Seciton */}
                            <section>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Feriados del Periodo</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <input type="date" value={newHoliday.date} onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold" />
                                    <div className="flex gap-4">
                                        <input type="text" placeholder="MOTIVO..." value={newHoliday.name} onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })} className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase" />
                                        <button onClick={handleAddHoliday} className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95"><Plus className="w-5 h-5" /></button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {holidays.sort((a, b) => a.date.localeCompare(b.date)).map(h => (
                                        <div key={h.id} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                            <div>
                                                <p className="text-[11px] font-black text-slate-900 uppercase">{h.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400">{format(parseISO(h.date), 'dd MMMM yyyy', { locale: es })}</p>
                                            </div>
                                            <button onClick={() => handleDeleteHoliday(h.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Mappings Section */}
                            <section className="pt-6 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mapeos Manuales (Alias de Excel)</h3>
                                    <button
                                        onClick={() => {
                                            const name = prompt("Introduce el NOMBRE EXACTO como aparece en el Excel (ej: GUERRERO, FLAVIA):");
                                            if (name) setIsLinking({ excelName: name.trim() });
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                    >
                                        <Plus className="w-4 h-4" /> Vincular Nuevo Alias
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {Object.entries(employeeMappings).length === 0 ? (
                                        <p className="text-slate-300 text-xs text-center py-10 font-bold uppercase tracking-widest italic">No hay alias vinculados</p>
                                    ) : Object.entries(employeeMappings).map(([excelName, realId]) => {
                                        const realEmp = employees.find(e => e.id === realId);
                                        return (
                                            <div key={excelName} className="flex items-center justify-between p-5 bg-emerald-50/50 border border-emerald-100 rounded-3xl">
                                                <div className="flex items-center gap-4">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase">Excel:<br /><span className="text-slate-900 text-[10px]">{excelName}</span></div>
                                                    <ArrowRight className="w-4 h-4 text-emerald-400" />
                                                    <div className="text-[9px] font-black text-slate-400 uppercase">Perfil:<br /><span className="text-emerald-700 text-[10px]">{realEmp?.name || realId}</span></div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        const { [excelName]: removed, ...rest } = employeeMappings;
                                                        setEmployeeMappings(rest);
                                                        await saveEmployeeMappingsToDB(rest);
                                                    }}
                                                    className="p-2 text-emerald-300 hover:text-rose-500 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Danger Zone */}
                            <section className="pt-10 border-t-4 border-rose-100 mt-10">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-6 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> Zona de Peligro
                                </h3>
                                <div className="bg-rose-50 p-8 rounded-[32px] border border-rose-100">
                                    <p className="text-rose-900 text-[11px] font-bold mb-4 uppercase">¿Todo duplicado o datos corruptos? Limpia la base de datos de asistencia para empezar de cero.</p>
                                    <button
                                        onClick={handleResetAttendance}
                                        className="w-full py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        <Trash2 className="w-5 h-5" /> Borrar Toda la Asistencia
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar-h::-webkit-scrollbar { height: 8px; }
                .custom-scrollbar-h::-webkit-scrollbar-track { background: #f8fafc; border-bottom-left-radius: 40px; border-bottom-right-radius: 40px; }
                .custom-scrollbar-h::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; border: 2px solid #f8fafc; }
                .custom-scrollbar-h::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
};
