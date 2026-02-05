export const normalizeName = (str: string): string => {
    if (!str) return "";
    return str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ") // Keep numbers but replace others with space
        .replace(/\s+/g, " ")
        .trim();
};

export const fuzzyMatch = (str1: string, str2: string): boolean => {
    if (!str1 || !str2) return false;

    const n1 = normalizeName(str1).replace(/\d+/g, "").trim();
    const n2 = normalizeName(str2).replace(/\d+/g, "").trim();

    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;

    const tokens1 = n1.split(" ").filter(t => t.length >= 3);
    const tokens2 = n2.split(" ").filter(t => t.length >= 3);

    if (tokens1.length === 0 || tokens2.length === 0) return false;

    // Check for shared tokens (e.g. Surname)
    const set2 = new Set(tokens2);
    const common = tokens1.filter(t => set2.has(t));

    // Rule: Match if they share at least one long word (>=4 chars, likely a surname)
    return common.some(c => c.length >= 4);

    return false;
};

export const parseExcelDate = (val: any): string | null => {
    if (!val) return null;

    // If it's an Excel serial date number
    if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        // Correct for timezone offset if needed, but 12:00:00 is safer
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    }

    const str = String(val).trim();
    // Match DD/MM/YYYY or DD-MM-YYYY
    const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (match) {
        const d = match[1].padStart(2, '0');
        const m = match[2].padStart(2, '0');
        let y = match[3];
        if (y.length === 2) y = `20${y}`;
        return `${d}/${m}/${y}`;
    }
    return null;
};

export const parseExcelTime = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'number') {
        const totalSeconds = Math.round(val * 24 * 3600);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    const str = String(val).trim();
    if (str.match(/^\d{1,2}:\d{1,2}/)) return str;
    return null;
};
export const formatMinutesToHM = (totalMinutes: number): string => {
    const hours = Math.floor(Math.abs(totalMinutes) / 60);
    const minutes = Math.round(Math.abs(totalMinutes) % 60);
    const sign = totalMinutes < 0 ? '-' : '';
    return `${sign}${hours}h ${minutes.toString().padStart(2, '0')}m`;
};
