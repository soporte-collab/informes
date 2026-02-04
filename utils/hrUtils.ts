
export const fuzzyMatch = (str1: string, str2: string, threshold = 0.7): boolean => {
    const s1 = str1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const s2 = str2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    if (s1.includes(s2) || s2.includes(s1)) return true;

    // Simple Jaccard similarity or equality for short strings
    if (s1 === s2) return true;

    return false; // For now basic inclusion, could be expanded to Levenshtein
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
