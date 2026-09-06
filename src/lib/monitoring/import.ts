import { Decimal } from '../methodology/decimal';
import { compileMethodology } from '../methodology/expression';
import { isISODate, validateValues, type MetricField, type MetricValues } from '../methodology/schema';
export interface ImportError {
    row: number;
    column: number;
    field?: string;
    message: string;
}
export interface ParsedTable {
    headers: string[];
    rows: {
        row: number;
        cells: Cell[];
    }[];
    errors: ImportError[];
    dateSystem?: '1900' | '1904';
}
export type Cell = string | number | boolean | null | {
    kind: 'formula';
    formula: string;
} | {
    kind: 'excel-date';
    serial: number;
} | {
    kind: 'error';
    message: string;
};
export interface SpreadsheetParser {
    /** Adapter MUST reject macros/encrypted workbooks/external links, preserve formulas as tagged cells,
     * enforce ZIP decompression/row/cell limits and select a sheet explicitly. Never evaluate formulas. */
    parse(bytes: Uint8Array, options: {
        sheet: string;
        maxRows: number;
        maxColumns: number;
        maxUncompressedBytes: number;
    }): Promise<ParsedTable>;
}
export interface ImportOptions {
    delimiter?: ',' | ';' | '\t';
    decimalSeparator?: '.' | ',';
    thousandsSeparator?: '.' | ',' | ' ';
    scope?: 'baseline' | 'observation';
    columns?: Record<string, {
        field: string;
        unit?: string;
    }>;
}
export interface PreviewRecord {
    record_key: string;
    observed_on: string;
    metric_values: MetricValues;
    raw_input: Record<string, Cell>;
    source_row: number;
}
/** Shape consumed by save_monitoring_records(p_records), whose JSON key is values. */
export interface SaveMonitoringRecord {
    record_key: string;
    observed_on: string;
    values: MetricValues;
    raw_input: Record<string, Cell>;
    source_row: number;
}
export interface ImportPreview {
    valid: boolean;
    errors: ImportError[];
    records: PreviewRecord[];
    baselineRows: {
        row: number;
        values: MetricValues;
    }[];
    mapping: {
        column: number;
        header: string;
        field: string;
        unit: string;
    }[];
}
const MAX_ROWS = 10000, MAX_COLS = 202, MAX_CHARS = 10 * 1024 * 1024;
/** Strict CSV state machine: quoted delimiters/newlines, escaped quotes, UTF-8 BOM, CRLF/LF/CR. */
export function parseCSV(text: string, delimiter: ',' | ';' | '\t' = ','): ParsedTable {
    if (![',', ';', '\t'].includes(delimiter))
        throw new Error('Unsupported delimiter');
    if (text.length > MAX_CHARS)
        throw new Error('CSV size limit');
    text = text.replace(/^\uFEFF/, '');
    const output: ParsedTable = { headers: [], rows: [], errors: [] };
    const rows: {
        row: number;
        cells: string[];
    }[] = [];
    let cells: string[] = [], value = '', state: 'start' | 'bare' | 'quoted' | 'closed' = 'start', line = 1, startLine = 1;
    const error = (message: string) => { throw new Error(`${message} at row ${line}, column ${cells.length + 1}`); };
    const finishCell = () => { cells.push(value); if (cells.length > MAX_COLS)
        error('Column limit'); value = ''; state = 'start'; };
    const finishRow = () => { finishCell(); rows.push({ row: startLine, cells }); if (rows.length > MAX_ROWS + 1)
        error('Row limit'); cells = []; };
    try {
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (state === 'quoted') {
                if (c === '"') {
                    if (text[i + 1] === '"') {
                        value += '"';
                        i++;
                    }
                    else
                        state = 'closed';
                }
                else {
                    value += c;
                    if (c === '\n' || (c === '\r' && text[i + 1] !== '\n'))
                        line++;
                }
                continue;
            }
            if (c === delimiter) {
                finishCell();
                continue;
            }
            if (c === '\r' || c === '\n') {
                finishRow();
                if (c === '\r' && text[i + 1] === '\n')
                    i++;
                line++;
                startLine = line;
                continue;
            }
            if (state === 'closed')
                error('Unexpected character after closing quote');
            if (c === '"') {
                if (state !== 'start')
                    error('Quote inside unquoted cell');
                state = 'quoted';
            }
            else {
                value += c;
                state = 'bare';
            }
        }
        if (state === 'quoted')
            error('Unclosed quoted field');
        if (cells.length || value.length || state === 'closed' || state === 'bare')
            finishRow();
    }
    catch (e) {
        output.errors.push({ row: line, column: cells.length + 1, message: (e as Error).message });
        return output;
    }
    if (!rows.length) {
        output.errors.push({ row: 1, column: 1, message: 'Empty CSV' });
        return output;
    }
    output.headers = rows[0].cells;
    output.rows = rows.slice(1);
    for (const row of output.rows)
        if (row.cells.length !== output.headers.length)
            output.errors.push({ row: row.row, column: Math.min(row.cells.length, output.headers.length) + 1, message: `Expected ${output.headers.length} columns, got ${row.cells.length}` });
    return output;
}
export function excelDate(serial: number, system: '1900' | '1904' = '1900'): string {
    if (!Number.isSafeInteger(serial) || serial < 0 || serial > 2958465)
        throw new Error('Invalid Excel date-only serial');
    if (system !== '1900' && system !== '1904')
        throw new Error('Unknown Excel date system');
    if (system === '1900' && serial === 60)
        throw new Error('Excel fictitious 1900-02-29');
    const epoch = Date.UTC(system === '1904' ? 1904 : 1899, system === '1904' ? 0 : 11, system === '1904' ? 1 : 31);
    const date = new Date(epoch + (serial - (system === '1900' && serial > 60 ? 1 : 0)) * 86400000).toISOString().slice(0, 10);
    if (!isISODate(date))
        throw new Error('Excel date outside ISO range');
    return date;
}
/** Explicit decimal/thousands settings; no locale inference, no silent rounding. */
export function canonicalNumber(raw: string, options: ImportOptions = {}): string {
    let value = raw.trim();
    const decimal = options.decimalSeparator ?? '.', thousands = options.thousandsSeparator;
    if (thousands === decimal)
        throw new Error('Decimal and thousands separators must differ');
    if (value.length > 150)
        throw new Error('Number length limit');
    let sign = '';
    if (value.startsWith('-')) {
        sign = '-';
        value = value.slice(1);
    }
    const parts = value.split(decimal);
    if (parts.length > 2 || parts.some(p => !p))
        throw new Error('Invalid decimal syntax');
    let whole = parts[0];
    if (thousands && whole.includes(thousands)) {
        const groups = whole.split(thousands);
        if (!/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some(g => !/^\d{3}$/.test(g)))
            throw new Error('Invalid thousands grouping');
        whole = groups.join('');
    }
    if (!/^\d+$/.test(whole) || (parts[1] !== undefined && !/^\d+$/.test(parts[1])))
        throw new Error('Invalid numeric characters');
    const result = sign + whole + (parts[1] !== undefined ? '.' + parts[1] : '');
    Decimal.parse(result);
    return result;
}
/** Only listed directional conversions; source must ALSO be accepted by this field. */
export const UNIT_CONVERSIONS: Readonly<Record<string, string>> = Object.freeze({ 'm2->ha': '0.0001', 'ha->m2': '10000', 'kWh->MWh': '0.001', 'MWh->kWh': '1000', 'kg->t': '0.001', 't->kg': '1000' });
function convert(raw: string, from: string, to: string): string {
    if (from === to)
        return raw;
    const factor = UNIT_CONVERSIONS[`${from}->${to}`];
    if (!factor)
        throw new Error(`Conversion not allowed: ${from} -> ${to}`);
    // Conversions are powers of ten: shift decimal point exactly; don't round to engine context.
    const shift = Number(factor) < 1 ? -(factor.split('.')[1].length) : factor.length - 1;
    const neg = raw.startsWith('-'), parts = (neg ? raw.slice(1) : raw).split('.');
    let digits = parts.join(''), point = parts[0].length + shift;
    if (point <= 0) {
        digits = '0'.repeat(1 - point) + digits;
        point = 1;
    }
    if (point >= digits.length)
        digits = digits.padEnd(point, '0');
    const value = (neg ? '-' : '') + digits.slice(0, point) + (point < digits.length ? '.' + digits.slice(point) : '');
    return Decimal.parse(value).toString();
}
function decode(cell: Cell, field: MetricField, unit: string, options: ImportOptions, dateSystem: '1900' | '1904'): MetricValues[string] {
    if (cell === null || cell === '')
        return null;
    if (typeof cell === 'object') {
        if (cell.kind === 'formula')
            throw new Error('Formula cells are rejected, including cached results');
        if (cell.kind === 'error')
            throw new Error(cell.message);
        if (field.type !== 'date')
            throw new Error('Excel date in non-date field');
        return excelDate(cell.serial, dateSystem);
    }
    const raw = String(cell).trim();
    if (raw === '')
        return null;
    if (raw.startsWith('=') || /^[+@]/.test(raw) || /^-[^\d.]/.test(raw))
        throw new Error('Formula-like input rejected');
    if (field.type === 'date') {
        if (typeof cell === 'number')
            return excelDate(cell, dateSystem);
        if (!isISODate(raw))
            throw new Error('Expected ISO date or typed Excel serial');
        return raw;
    }
    if (field.type === 'decimal' || field.type === 'integer') {
        const canonical = typeof cell === 'number' ? Decimal.parse(cell).toString() : canonicalNumber(raw, options);
        const result = convert(canonical, unit, field.unit);
        if (field.type === 'integer') {
            if (!/^-?\d+$/.test(result) || !Number.isSafeInteger(Number(result)))
                throw new Error('Expected safe integer');
            return Number(result);
        }
        return result;
    }
    if (unit !== field.unit)
        throw new Error('Non-numeric unit conversion is not supported');
    if (field.type === 'boolean') {
        if (typeof cell === 'boolean')
            return cell;
        if (raw === 'true' || raw === '1')
            return true;
        if (raw === 'false' || raw === '0')
            return false;
        throw new Error('Expected true/false/1/0');
    }
    return String(cell);
}
export function previewTable(input: unknown, table: ParsedTable, options: ImportOptions = {}): ImportPreview {
    const { schema } = compileMethodology(input), scope = options.scope ?? 'observation';
    const result: ImportPreview = { valid: false, errors: [...table.errors], records: [], baselineRows: [], mapping: [] };
    const error = (row: number, column: number, message: string, field?: string) => result.errors.push({ row, column, field, message });
    if (table.rows.length > MAX_ROWS || table.headers.length > MAX_COLS)
        throw new Error('Table size limit');
    if (!table.headers.length)
        error(1, 1, 'Missing header');
    const fields = schema.fields.filter(f => f.scope === scope);
    const mapped = new Set<string>(), headers = new Set<string>();
    const aliases = new Map<string, string[]>();
    for (const f of fields)
        for (const name of new Set([f.id, ...f.import?.aliases ?? []]))
            aliases.set(name, [...aliases.get(name) ?? [], f.id]);
    for (const key of Object.keys(options.columns ?? {}))
        if (!table.headers.includes(key))
            error(1, 1, `Mapping header does not exist: ${key}`);
    table.headers.forEach((header, i) => {
        const name = header.trim();
        if (headers.has(name))
            error(1, i + 1, 'Duplicate header');
        headers.add(name);
        const config = options.columns?.[header];
        const candidates = config ? [config.field] : ['record_key', 'observed_on'].includes(name) && scope === 'observation' ? [name] : aliases.get(name) ?? [];
        if (candidates.length !== 1) {
            error(1, i + 1, candidates.length ? 'Ambiguous alias' : 'Unknown column');
            return;
        }
        const key = candidates[0], field = fields.find(f => f.id === key), metadata = scope === 'observation' && ['record_key', 'observed_on'].includes(key);
        if (!field && !metadata) {
            error(1, i + 1, 'Unknown mapping target', key);
            return;
        }
        if (mapped.has(key))
            error(1, i + 1, 'Duplicate mapped field', key);
        mapped.add(key);
        const unit = config?.unit ?? field?.unit ?? '1';
        if (field && (!(field.import?.accepted_units ?? [field.unit]).includes(unit) || (unit !== field.unit && !UNIT_CONVERSIONS[`${unit}->${field.unit}`])))
            error(1, i + 1, 'Unit conversion not allowed', key);
        if (metadata && unit !== '1')
            error(1, i + 1, 'Metadata unit must be 1', key);
        result.mapping.push({ column: i + 1, header, field: key, unit });
    });
    for (const field of fields)
        if (field.required && !mapped.has(field.id))
            error(1, 0, 'Missing required column', field.id);
    if (scope === 'observation')
        for (const key of ['record_key', 'observed_on'])
            if (!mapped.has(key))
                error(1, 0, 'Missing required column', key);
    const keys = new Set<string>();
    for (const row of table.rows) {
        if (row.cells.length !== table.headers.length && !result.errors.some(e => e.row === row.row && e.message.startsWith('Expected ')))
            error(row.row, Math.min(row.cells.length, table.headers.length) + 1, `Expected ${table.headers.length} columns, got ${row.cells.length}`);
        const values: MetricValues = Object.create(null), raw: Record<string, Cell> = Object.create(null);
        let key = '', date = '';
        for (const map of result.mapping) {
            const cell = row.cells[map.column - 1] ?? null;
            raw[map.header] = structuredClone(cell);
            try {
                const field = fields.find(f => f.id === map.field);
                if (field)
                    values[field.id] = decode(cell, field, map.unit, options, table.dateSystem ?? '1900');
                else if (map.field === 'record_key') {
                    if (typeof cell !== 'string' || !cell.trim() || cell.length > 200 || /^[=+@]/.test(cell.trim()))
                        throw new Error('Invalid record_key');
                    key = cell.trim();
                }
                else {
                    date = decode(cell, { id: 'observed_on', label: { vi: 'Ngày' }, type: 'date', unit: '1', scope: 'observation', required: true }, '1', options, table.dateSystem ?? '1900') as string;
                    if (!date)
                        throw new Error('Required date');
                }
            }
            catch (e) {
                error(row.row, map.column, (e as Error).message, map.field);
            }
        }
        for (const e of validateValues(schema, values, scope))
            if (!result.errors.some(x => x.row === row.row && x.field === e.field))
                error(row.row, result.mapping.find(m => m.field === e.field)?.column ?? 0, e.message, e.field);
        if (scope === 'observation') {
            if (key && keys.has(key))
                error(row.row, result.mapping.find(m => m.field === 'record_key')?.column ?? 0, 'Duplicate record_key', 'record_key');
            keys.add(key);
            result.records.push({ record_key: key, observed_on: date, metric_values: values, raw_input: raw, source_row: row.row });
        }
        else
            result.baselineRows.push({ row: row.row, values });
    }
    if (!table.rows.length)
        error(2, 1, 'No data rows');
    result.valid = result.errors.length === 0;
    return result;
}
export function previewCSV(schema: unknown, text: string, options: ImportOptions = {}): ImportPreview { return previewTable(schema, parseCSV(text, options.delimiter), options); }
export async function previewExcel(schema: unknown, bytes: Uint8Array, sheet: string, parser: SpreadsheetParser | undefined, options: ImportOptions = {}): Promise<ImportPreview> {
    if (!parser)
        throw new Error('XLSX parser not installed; supply an approved adapter');
    if (bytes.byteLength > MAX_CHARS)
        throw new Error('XLSX size limit');
    if (!sheet.trim())
        throw new Error('Select a worksheet');
    return previewTable(schema, await parser.parse(bytes, { sheet, maxRows: MAX_ROWS, maxColumns: MAX_COLS, maxUncompressedBytes: 50 * 1024 * 1024 }), options);
}
/** Pure payload preparation. UI must preview, then server must reparse/revalidate and call guarded RPC. */
export function prepareImportRecords(schema: unknown, table: ParsedTable, options: ImportOptions = {}): SaveMonitoringRecord[] { const preview = previewTable(schema, table, options); if (!preview.valid)
    throw new Error(`Import invalid: ${JSON.stringify(preview.errors)}`); if (options.scope === 'baseline')
    throw new Error('Baseline uses project baseline update, not monitoring RPC'); return preview.records.map(({ metric_values, ...record }) => structuredClone({ ...record, values: metric_values })); }
