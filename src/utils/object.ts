export function getValidatedObject<T>(source: any, compare: T, sanitizeList: string[] = []): Partial<T> {
    const result: any = {};
    if (source == null || typeof source !== 'object' || Array.isArray(source)) {
        return null as any;
    }
    Object.keys(source).forEach((key) => {
        const value = source[key];
        if (sanitizeList.includes(value)) {
            return;
        }
        const compareValue = (compare as any)[key];
        if (value == null || compareValue == null) {
            return;
        }
        const array1 = Array.isArray(value);
        const array2 = Array.isArray(compareValue);
        if (array1 || array2) {
            if (array1 && array2) {
                result[key] = value;
            }
        } else if (typeof value === 'object' && typeof compareValue === 'object') {
            result[key] = getValidatedObject(value, compareValue, sanitizeList);
        } else if (typeof value === typeof compareValue) {
            result[key] = value;
        }
    });
    return result as Partial<T>;
}

export function getPreviousObject<T>(copy: Partial<T>, newSettings: Partial<T>, oldSettings: Partial<T>): Partial<T> {
    const result: any = {};
    const keys = Object.keys(newSettings) as (keyof T)[];
    
    for (const key of keys) {
        const copyValue = copy[key];
        const newValue = newSettings[key];
        const oldValue = oldSettings[key];
        
        if (copyValue === undefined) {
            continue;
        }
        
        if (typeof copyValue === 'object' && copyValue !== null && !Array.isArray(copyValue)) {
            const nestedResult = getPreviousObject(
                copyValue as Partial<T>,
                (newValue as any) || {},
                (oldValue as any) || {}
            );
            if (Object.keys(nestedResult).length > 0) {
                result[key] = nestedResult;
            }
        } else if (copyValue === newValue && oldValue !== undefined) {
            result[key] = oldValue;
        }
    }
    
    return result;
}
