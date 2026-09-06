import { z } from 'zod';
import type { MonitoringData, MonitoringPeriod } from '../../types/project-platform';
import { evaluateMethodology, LIMITS, type FactorInput } from '../methodology/expression';
import { isISODate, type MetricValues } from '../methodology/schema';
const factorSchema = z.array(z.object({ key: z.string(), value: z.union([z.string(), z.number().finite()]), unit: z.string(), scope: z.record(z.union([z.string(), z.number().finite(), z.boolean()])), source: z.string().min(1), id: z.string().optional(), methodology_id: z.string().optional() }).strict());
function stable(value: unknown): string { if (Array.isArray(value))
    return '[' + value.map(stable).join(',') + ']'; if (value && typeof value === 'object')
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable((value as Record<string, unknown>)[k])).join(',') + '}'; return JSON.stringify(value); }
/** Pure estimate from an authoritative locked period and exactly its locked rows. No DB, issuance,
 * PDF rendering, hash authentication or permission decision. Trusted backend supplies the snapshots. */
export function estimateMrvReport(period: MonitoringPeriod, data: MonitoringData[], outputCalculation: string) {
    if (period.status !== 'locked' || !period.locked_at || !Array.isArray(period.data_snapshot))
        throw new Error('Locked period with input snapshot required');
    if (!isISODate(period.start_date) || !isISODate(period.end_date) || period.end_date < period.start_date)
        throw new Error('Invalid monitoring period dates');
    if (data.length > LIMITS.observations || period.data_snapshot.length > LIMITS.observations)
        throw new Error('Observation count limit');
    if (period.data_revision < 1 || period.baseline_revision < 0 || !Number.isSafeInteger(period.data_revision) || !Number.isSafeInteger(period.baseline_revision))
        throw new Error('Unsafe revision');
    const ordered = [...data].sort((a, b) => a.record_key < b.record_key ? -1 : a.record_key > b.record_key ? 1 : 0);
    const saved = period.data_snapshot as unknown as MonitoringData[];
    if (saved.some(r => !r || typeof r.record_key !== 'string'))
        throw new Error('Invalid locked input snapshot');
    if (stable(ordered) !== stable([...saved].sort((a, b) => a.record_key < b.record_key ? -1 : a.record_key > b.record_key ? 1 : 0)))
        throw new Error('Data differs from locked snapshot');
    for (const row of ordered) {
        if (row.period_id !== period.id || row.project_id !== period.project_id)
            throw new Error('Cross-period/project input');
        if (!isISODate(row.observed_on) || row.observed_on < period.start_date || row.observed_on > period.end_date)
            throw new Error('Observation outside period');
        if (!Number.isSafeInteger(row.revision) || row.revision < 1 || row.revision > period.data_revision)
            throw new Error('Invalid data revision');
    }
    const factors: FactorInput[] = factorSchema.parse(period.factors_snapshot);
    if (factors.some(f => f.methodology_id !== undefined && f.methodology_id !== period.methodology_id))
        throw new Error('Cross-methodology factor');
    const evaluation = evaluateMethodology(period.schema_snapshot, period.baseline_snapshot as MetricValues, ordered.map(r => ({ record_key: r.record_key, values: r.metric_values as MetricValues })), factors);
    const output = evaluation.results[outputCalculation];
    if (!output || output.unit !== 'tCO2e' || output.aggregation !== 'sum')
        throw new Error('Select a sum calculation in tCO2e for the period estimate');
    return structuredClone({ status: 'preview' as const, kind: 'mrv_estimate' as const, label: 'Ước tính MRV — không phải tín chỉ đã phát hành', project_id: period.project_id, period_id: period.id, methodology_id: period.methodology_id, standard_id: period.standard_id, schema_hash: period.schema_hash, schema_snapshot: period.schema_snapshot, baseline_snapshot: period.baseline_snapshot, baseline_revision: period.baseline_revision, factors_snapshot: period.factors_snapshot, data_revision: period.data_revision, input_snapshot: ordered, engine_version: evaluation.engine_version, results: { estimated_credit: { calculation_id: outputCalculation, value: output.value, unit: output.unit }, calculations: evaluation.results }, calculation_trace: { order: evaluation.order, ...evaluation.trace } });
}
