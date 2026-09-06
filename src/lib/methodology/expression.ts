import { Decimal } from './decimal';
import { parseMetricSchema, validateValues, type Expression, type MetricSchema, type MetricValues } from './schema';
export const ENGINE_VERSION = 'project-mrv/1.0.0';
export const LIMITS = { depth: 24, nodes: 10000, operations: 100000, observations: 10000 } as const;
type Dimensions = Map<string, number>;
/** Unit algebra is exact, case-sensitive. m3_CH4 denotes the same volume dimension as m3;
 * methane_fraction supplies the composition. No scale conversion is implicit here. */
function dimensions(unit: string): Dimensions {
    const result = new Map<string, number>();
    let sign = 1;
    for (const token of unit.split(/([*/])/)) {
        if (token === '*') {
            sign = 1;
            continue;
        }
        if (token === '/') {
            sign = -1;
            continue;
        }
        if (token === '1')
            continue;
        const [raw, power] = token.split('^');
        const name = raw === 'm3_CH4' ? 'm3' : raw;
        const n = power === undefined ? 1 : Number(power);
        if (!Number.isSafeInteger(n) || Math.abs(n) > 32)
            throw new Error('Unit exponent limit');
        result.set(name, (result.get(name) ?? 0) + sign * n);
    }
    return clean(result);
}
function clean(a: Dimensions): Dimensions { for (const [key, value] of a)
    if (!value)
        a.delete(key); return a; }
function equal(a: Dimensions, b: Dimensions): boolean { return a.size === b.size && [...a].every(([k, v]) => b.get(k) === v); }
function combine(a: Dimensions, b: Dimensions, sign: number): Dimensions { const r = new Map(a); for (const [k, v] of b)
    r.set(k, (r.get(k) ?? 0) + sign * v); return clean(r); }
function unitText(a: Dimensions): string { return [...a].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => v === 1 ? k : `${k}^${v}`).join('*') || '1'; }
export interface FactorInput {
    key: string;
    value: string | number;
    unit: string;
    scope: Record<string, string | number | boolean>;
    source: string;
    id?: string;
    methodology_id?: string;
}
export interface TraceNode {
    path: string;
    operation: string;
    inputs: string[];
    value: string;
    unit: string;
}
export interface Evaluation {
    engine_version: string;
    order: string[];
    results: Record<string, {
        value: string;
        unit: string;
        aggregation: string;
    }>;
    trace: {
        records: {
            record_key: string;
            factors: FactorInput[];
            calculations: Record<string, {
                value: string;
                nodes: TraceNode[];
            }>;
        }[];
        aggregation: {
            id: string;
            inputs: string[];
            value: string;
        }[];
        operations: number;
        precision_digits: 28;
        rounding: 'half_even';
        output_scale: number;
    };
}
export interface Observation {
    record_key: string;
    values: MetricValues;
}
export function compileMethodology(input: unknown): {
    schema: MetricSchema;
    order: string[];
} {
    const schema = parseMetricSchema(input), byId = new Map(schema.calculations.map(c => [c.id, c])), visiting = new Set<string>(), done = new Set<string>(), order: string[] = [];
    let nodes = 0;
    function infer(node: Expression, depth: number): Dimensions {
        if (depth > LIMITS.depth || ++nodes > LIMITS.nodes)
            throw new Error('AST depth/node limit');
        if ('constant' in node)
            return new Map();
        if ('field' in node || 'baseline' in node) {
            const scope = 'field' in node ? 'observation' : 'baseline', key = 'field' in node ? node.field : (node as {
                baseline: string;
            }).baseline;
            const f = schema.fields.find(f => f.id === key && f.scope === scope);
            if (!f || !['decimal', 'integer'].includes(f.type))
                throw new Error(`Unknown/non-numeric ${scope} reference: ${key}`);
            return dimensions(f.unit);
        }
        if ('factor' in node) {
            const f = schema.factor_requirements.find(f => f.key === node.factor);
            if (!f)
                throw new Error(`Unknown factor: ${node.factor}`);
            return dimensions(f.unit);
        }
        if ('calculation' in node) {
            visit(node.calculation);
            return dimensions(byId.get(node.calculation)!.unit);
        }
        const units = node.args.map(a => infer(a, depth + 1));
        if (['add', 'subtract', 'min', 'max'].includes(node.op)) {
            if (units.some(u => !equal(u, units[0])))
                throw new Error(`Incompatible units in ${node.op}`);
            return units[0];
        }
        if (node.op === 'pow') {
            const exponent = node.args[1];
            if (!('constant' in exponent) || !Number.isInteger(exponent.constant) || Math.abs(exponent.constant) > 32)
                throw new Error('pow requires literal integer exponent between -32 and 32');
            return clean(new Map([...units[0]].map(([k, v]) => [k, v * exponent.constant])));
        }
        return units.slice(1).reduce((a, b) => combine(a, b, node.op === 'divide' ? -1 : 1), units[0]);
    }
    function visit(id: string): void { if (visiting.has(id))
        throw new Error(`Calculation dependency cycle: ${id}`); if (done.has(id))
        return; const c = byId.get(id); if (!c)
        throw new Error(`Unknown calculation: ${id}`); visiting.add(id); const actual = infer(c.expression, 0); if (!equal(actual, dimensions(c.unit)))
        throw new Error(`Calculation unit mismatch: ${id} (${unitText(actual)} != ${c.unit})`); visiting.delete(id); done.add(id); order.push(id); }
    schema.calculations.forEach(c => visit(c.id));
    return { schema, order };
}
export function evaluateMethodology(input: unknown, baseline: MetricValues, observations: Observation[], factors: FactorInput[]): Evaluation {
    const { schema, order } = compileMethodology(input);
    if (!observations.length || observations.length > LIMITS.observations)
        throw new Error('Observation count limit');
    if (factors.length > 10000)
        throw new Error('Factor count limit');
    const be = validateValues(schema, baseline, 'baseline');
    if (be.length)
        throw new Error(`Baseline: ${JSON.stringify(be)}`);
    const seen = new Set<string>();
    let operations = 0;
    const spend = () => { if (++operations > LIMITS.operations)
        throw new Error('Operation limit'); };
    const buckets = new Map(order.map(id => [id, [] as Decimal[]]));
    const trace: Evaluation['trace'] = { records: [], aggregation: [], operations: 0, precision_digits: 28, rounding: 'half_even', output_scale: schema.runtime.output_scale };
    for (const obs of [...observations].sort((a, b) => a.record_key < b.record_key ? -1 : a.record_key > b.record_key ? 1 : 0)) {
        if (!obs.record_key.trim() || obs.record_key.length > 200 || seen.has(obs.record_key))
            throw new Error('Empty/duplicate record_key');
        seen.add(obs.record_key);
        const errors = validateValues(schema, obs.values, 'observation');
        if (errors.length)
            throw new Error(`Record ${obs.record_key}: ${JSON.stringify(errors)}`);
        const selected = new Map<string, FactorInput>();
        for (const req of schema.factor_requirements) {
            const matches = factors.filter(f => f.key === req.key && f.unit === req.unit && f.scope && Object.keys(f.scope).length === req.scope_selectors.length && req.scope_selectors.every(k => Object.hasOwn(f.scope, k) && f.scope[k] === (schema.fields.find(f => f.id === k)!.scope === 'baseline' ? baseline[k] : obs.values[k])));
            if (matches.length !== 1)
                throw new Error(`Missing/ambiguous factor: ${req.key}`);
            Decimal.parse(matches[0].value);
            selected.set(req.key, matches[0]);
        }
        const computed = new Map<string, Decimal>();
        const record: Evaluation['trace']['records'][number] = { record_key: obs.record_key, factors: structuredClone([...selected.values()]), calculations: Object.create(null) };
        for (const id of order) {
            const calc = schema.calculations.find(c => c.id === id)!, nodes: TraceNode[] = [];
            function walk(node: Expression, path: string): {
                value: Decimal;
                unit: Dimensions;
            } {
                spend();
                let value: Decimal, u: Dimensions, operation: string, inputs: string[] = [];
                if ('constant' in node) {
                    value = Decimal.parse(node.constant);
                    u = new Map();
                    operation = 'constant';
                }
                else if ('field' in node || 'baseline' in node) {
                    const key = 'field' in node ? node.field : (node as {
                        baseline: string;
                    }).baseline;
                    const raw = 'field' in node ? obs.values[key] : baseline[key];
                    if (typeof raw !== 'string' && typeof raw !== 'number')
                        throw new Error(`Missing numeric input: ${key}`);
                    value = Decimal.parse(raw);
                    u = dimensions(schema.fields.find(f => f.id === key)!.unit);
                    operation = ('field' in node ? 'field:' : 'baseline:') + key;
                }
                else if ('factor' in node) {
                    const f = selected.get(node.factor)!;
                    value = Decimal.parse(f.value);
                    u = dimensions(f.unit);
                    operation = 'factor:' + node.factor;
                }
                else if ('calculation' in node) {
                    value = computed.get(node.calculation)!;
                    u = dimensions(schema.calculations.find(c => c.id === node.calculation)!.unit);
                    operation = 'calculation:' + node.calculation;
                }
                else {
                    const args = node.args.map((n, i) => walk(n, `${path}.${i}`));
                    inputs = args.map(a => a.value.toString());
                    operation = node.op;
                    u = args[0].unit;
                    value = args[0].value;
                    if (node.op === 'pow') {
                        const power = (node.args[1] as {
                            constant: number;
                        }).constant;
                        for (let i = 0; i < Math.abs(power) + (power < 0 ? 1 : 0); i++)
                            spend();
                        value = value.pow(power);
                        u = clean(new Map([...u].map(([k, v]) => [k, v * power])));
                    }
                    else
                        for (const b of args.slice(1)) {
                            spend();
                            switch (node.op) {
                                case 'add':
                                    value = value.add(b.value);
                                    break;
                                case 'subtract':
                                    value = value.sub(b.value);
                                    break;
                                case 'multiply':
                                    value = value.mul(b.value);
                                    u = combine(u, b.unit, 1);
                                    break;
                                case 'divide':
                                    value = value.div(b.value);
                                    u = combine(u, b.unit, -1);
                                    break;
                                case 'min':
                                    if (value.compare(b.value) > 0)
                                        value = b.value;
                                    break;
                                case 'max':
                                    if (value.compare(b.value) < 0)
                                        value = b.value;
                                    break;
                            }
                        }
                }
                nodes.push({ path, operation, inputs, value: value.toString(), unit: unitText(u) });
                return { value, unit: u };
            }
            const value = walk(calc.expression, id).value;
            computed.set(id, value);
            buckets.get(id)!.push(value);
            record.calculations[id] = { value: value.toString(), nodes };
        }
        trace.records.push(record);
    }
    const results: Evaluation['results'] = Object.create(null);
    for (const id of order) {
        const c = schema.calculations.find(c => c.id === id)!, values = buckets.get(id)!;
        let total = values[0];
        for (const v of values.slice(1)) {
            spend();
            if (c.aggregation === 'min') {
                if (v.compare(total) < 0)
                    total = v;
            }
            else if (c.aggregation === 'max') {
                if (v.compare(total) > 0)
                    total = v;
            }
            else
                total = total.add(v);
        }
        if (c.aggregation === 'mean') {
            spend();
            total = total.div(Decimal.parse(values.length));
        }
        results[id] = { value: total.fixed(schema.runtime.output_scale), unit: c.unit, aggregation: c.aggregation };
        trace.aggregation.push({ id, inputs: values.map(v => v.toString()), value: total.toString() });
    }
    trace.operations = operations;
    return { engine_version: ENGINE_VERSION, order, results, trace };
}
