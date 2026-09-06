import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { estimateMrvReport } from '@/lib/mrv/report';
import type { MonitoringPeriod, MonitoringData, Json } from '@/types/project-platform';
const sql = readFileSync('supabase/migrations/0014_project_platform_samples.sql', 'utf8');
const seeds = [...sql.matchAll(/\$metric\$(.*?)\$metric\$/gs)].map(m => JSON.parse(m[1]));
const factors = [...sql.matchAll(/\('(20000000-[^']+)','([^']+)',([\d.]+),'([^']+)','([^']+)'\)/g)].map(m => ({ methodology_id: m[1], key: m[2], value: m[3], unit: m[4], source: m[5], scope: {} }));
function fixture(index = 0) {
    const methodology_id = `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    const baseline = index === 1 ? { baseline_intensity: '0.5' } : index === 3 ? { baseline_capture_fraction: '0.1' } : { baseline_stock_tc_ha: '10' };
    const values = index === 1 ? { meter_code: 'M1', electricity_mwh: '100', meter_checked: true } : index === 3 ? { digester_code: 'D1', biogas_m3: '100', methane_fraction: '0.5', equipment_type: 'flare' } : { plot_code: 'P1', area_ha: '2', stock_tc_ha: '12' };
    const row: MonitoringData = { id: 'd1', project_id: 'p1', period_id: 'period1', record_key: 'a', observed_on: '2026-01-01', metric_values: values, raw_input: {}, import_id: null, source_row: null, entered_by: 'u1', revision: 1, updated_at: '2026-01-01T00:00:00Z' };
    const period: MonitoringPeriod = { id: 'period1', project_id: 'p1', methodology_id, standard_id: index < 2 ? 'vcs' : 'gs', name: 'Jan', start_date: '2026-01-01', end_date: '2026-01-31', version: 1, status: 'locked', schema_snapshot: structuredClone(seeds[index]), schema_hash: 'a'.repeat(64), baseline_snapshot: baseline, baseline_revision: 1, factors_snapshot: factors.filter(f => f.methodology_id === methodology_id).map(({ methodology_id: _, ...f }) => f), data_revision: 1, data_snapshot: [structuredClone(row)] as unknown as Json, locked_at: '2026-02-01T00:00:00Z', created_by: 'u1', created_at: '2026-01-01T00:00:00Z' };
    return { period, data: [row], output: seeds[index].calculations.at(-1).id as string };
}
describe('MRV estimates from actual SQL seed contracts and factors', () => {
    // Independent hand calculations: forest (12-10)*2*(44/12 approx seed) =14.6667;
    // electricity 100*(0.5-0.02)=48; biogas 100*.5*.00067*(1-.1)*27=.81405 -> .8140 half-even.
    it.each([[0, '14.6667'], [1, '48.0000'], [2, '14.6667'], [3, '0.8140']] as const)('calculates seed %s = %s tCO2e', (index, expected) => { const f = fixture(index); expect(f.period.factors_snapshot).not.toEqual([]); const r = estimateMrvReport(f.period, f.data, f.output); expect(r.results.estimated_credit.value).toBe(expected); expect(r.status).toBe('preview'); expect(r.kind).toBe('mrv_estimate'); expect(r.label).toContain('không phải tín chỉ đã phát hành'); expect(r.calculation_trace.records[0].factors[0].source).toContain('MẪU'); });
    it('aggregates multiple observations once, with stable ordering and detached snapshots', () => { const f = fixture(); f.data.push({ ...f.data[0], id: 'd2', record_key: 'b', metric_values: { plot_code: 'P2', area_ha: '1', stock_tc_ha: '13' } }); f.period.data_snapshot = structuredClone(f.data) as unknown as Json; const r = estimateMrvReport(f.period, [...f.data].reverse(), f.output); expect(r.results.estimated_credit.value).toBe('25.6667'); expect(r.calculation_trace.records.map(r => r.record_key)).toEqual(['a', 'b']); (f.data[0].metric_values as Record<string, Json>).area_ha = '999'; expect((r.input_snapshot[0].metric_values as Record<string, Json>).area_ha).toBe('2'); });
    it('trace is JSON serializable and reproducible from returned snapshots', () => { const f = fixture(3), r = estimateMrvReport(f.period, f.data, f.output); const restored = JSON.parse(JSON.stringify(r)); const replay = estimateMrvReport({ ...f.period, schema_snapshot: restored.schema_snapshot, baseline_snapshot: restored.baseline_snapshot, factors_snapshot: restored.factors_snapshot, data_snapshot: restored.input_snapshot }, restored.input_snapshot, f.output); expect(replay.calculation_trace).toEqual(r.calculation_trace); expect(replay.results).toEqual(r.results); });
    it('keeps negative estimates rather than falsely claiming issued credits', () => { const f = fixture(1); f.period.baseline_snapshot = { baseline_intensity: '0.01' }; expect(estimateMrvReport(f.period, f.data, f.output).results.estimated_credit.value).toBe('-1.0000'); });
    it('rejects open/empty period and mismatch with locked snapshot', () => { const f = fixture(); expect(() => estimateMrvReport({ ...f.period, status: 'open' }, f.data, f.output)).toThrow(/Locked/); expect(() => estimateMrvReport(f.period, [], f.output)).toThrow(/differs/); expect(() => estimateMrvReport({ ...f.period, data_snapshot: [] }, [], f.output)).toThrow(/count/); });
    it('rejects cross-project and cross-period rows even if both snapshots altered', () => { for (const field of ['project_id', 'period_id'] as const) {
        const f = fixture();
        f.data[0][field] = 'other';
        f.period.data_snapshot = structuredClone(f.data) as unknown as Json;
        expect(() => estimateMrvReport(f.period, f.data, f.output)).toThrow(/Cross/);
    } });
    it('rejects observations outside dates and unsafe revision', () => { const f = fixture(); f.data[0].observed_on = '2025-12-31'; f.period.data_snapshot = structuredClone(f.data) as unknown as Json; expect(() => estimateMrvReport(f.period, f.data, f.output)).toThrow(/outside/); expect(() => estimateMrvReport({ ...f.period, data_revision: 1e20 }, f.data, f.output)).toThrow(/revision/); });
    it('rejects missing factors and tampered factor units', () => { const f = fixture(); expect(() => estimateMrvReport({ ...f.period, factors_snapshot: [] }, f.data, f.output)).toThrow(/factor/); const fs = structuredClone(f.period.factors_snapshot) as {
        unit: string;
    }[]; fs[0].unit = 'ha'; expect(() => estimateMrvReport({ ...f.period, factors_snapshot: fs }, f.data, f.output)).toThrow(/factor/); });
    it('requires explicit output id and tCO2e sum instead of assuming last calc is credit', () => { const f = fixture(); expect(() => estimateMrvReport(f.period, f.data, 'missing')).toThrow(/Select/); expect(() => estimateMrvReport(f.period, f.data, 'stock_change_tc')).toThrow(/Select/); });
});
