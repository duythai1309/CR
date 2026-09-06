import { z } from 'zod';
import { Decimal } from './decimal';
const id = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/).refine(x => !['constructor', 'prototype', '__proto__'].includes(x));
const label = z.record(z.string().min(1)).refine(x => Object.keys(x).length > 0, 'Empty label');
const unit = z.string().min(1).max(100).regex(/^(1|[A-Za-z][A-Za-z0-9_]*(\^-?\d+)?)([*/][A-Za-z][A-Za-z0-9_]*(\^-?\d+)?)*$/);
export type Expression = {
    constant: number;
} | {
    field: string;
} | {
    baseline: string;
} | {
    factor: string;
} | {
    calculation: string;
} | {
    op: 'add' | 'subtract' | 'multiply' | 'divide' | 'min' | 'max' | 'pow';
    args: Expression[];
};
const ast: z.ZodType<Expression> = z.lazy(() => z.union([
    z.object({ constant: z.number().finite() }).strict(), z.object({ field: id }).strict(), z.object({ baseline: id }).strict(), z.object({ factor: id }).strict(), z.object({ calculation: id }).strict(),
    z.object({ op: z.enum(['add', 'subtract', 'multiply', 'divide', 'min', 'max', 'pow']), args: z.array(ast).min(2).max(16) }).strict().refine(x => !['subtract', 'divide', 'pow'].includes(x.op) || x.args.length === 2, 'Binary operator requires 2 arguments'),
]));
// Bound traversal before recursive Zod parsing, including malicious cyclic JavaScript objects.
export function guardTree(value: unknown): void {
    let count = 0;
    const active = new Set<object>();
    function walk(v: unknown, depth: number) { if (++count > 20000 || depth > 64)
        throw new Error('Schema resource limit'); if (v && typeof v === 'object') {
        if (active.has(v))
            throw new Error('Cyclic object');
        active.add(v);
        for (const child of Object.values(v))
            walk(child, depth + 1);
        active.delete(v);
    } }
    walk(value, 0);
}
const fieldSchema = z.object({ id, label, type: z.enum(['decimal', 'integer', 'text', 'boolean', 'date', 'enum']), unit, scope: z.enum(['observation', 'baseline']), required: z.boolean(),
    required_if: z.object({ field: id, equals: z.union([z.string(), z.number().finite(), z.boolean()]) }).strict().optional(),
    options: z.array(z.object({ value: z.string().min(1), label }).strict()).min(1).optional(),
    validation: z.object({ minimum: z.number().finite().optional(), maximum: z.number().finite().optional(), exclusive_minimum: z.number().finite().optional(), scale: z.number().int().min(0).max(28).optional() }).strict().optional(),
    ui: z.object({ group: z.string(), order: z.number().finite() }).strict().optional(),
    import: z.object({ aliases: z.array(z.string().min(1)).max(100), accepted_units: z.array(unit).min(1) }).strict().optional(),
}).strict();
const envelope = z.object({ schema_version: z.literal(1), disclaimer: z.string().optional(), record_grain: z.string().optional(), decimal_encoding: z.string().optional(),
    fields: z.array(fieldSchema).min(1).max(200),
    factor_requirements: z.array(z.object({ key: id, unit, scope_selectors: z.array(id).max(200) }).strict()).max(200),
    calculations: z.array(z.object({ id, unit, aggregation: z.enum(['sum', 'mean', 'min', 'max']), expression: ast }).strict()).min(1).max(100),
    runtime: z.object({ dsl_version: z.literal(1), precision_digits: z.literal(28), rounding: z.literal('half_even'), output_scale: z.number().int().min(0).max(28), on_missing: z.literal('error'), on_division_by_zero: z.literal('error') }).strict().default({ dsl_version: 1, precision_digits: 28, rounding: 'half_even', output_scale: 4, on_missing: 'error', on_division_by_zero: 'error' }),
}).strict().superRefine((s, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const unique = (values: string[]) => new Set(values).size === values.length;
    if (!unique([...s.fields.map(f => f.id), ...s.calculations.map(c => c.id)]))
        fail('Duplicate field/calculation id');
    if (!unique(s.factor_requirements.map(f => f.key)))
        fail('Duplicate factor key');
    for (const f of s.fields) {
        if (f.type === 'enum' && (!f.options || !unique(f.options.map(o => o.value))))
            fail(`Invalid enum options: ${f.id}`);
        if (f.type !== 'enum' && f.options)
            fail(`Options on non-enum: ${f.id}`);
        const v = f.validation;
        if (v && !['decimal', 'integer'].includes(f.type))
            fail(`Numeric bounds on ${f.id}`);
        if (v?.minimum !== undefined && v.maximum !== undefined && v.minimum > v.maximum)
            fail(`Inverted bounds: ${f.id}`);
        if (v?.exclusive_minimum !== undefined && v.maximum !== undefined && v.exclusive_minimum >= v.maximum)
            fail(`Empty bounds: ${f.id}`);
        if (f.type === 'integer' && v?.scale !== undefined && v.scale !== 0)
            fail(`Integer scale: ${f.id}`);
        if (f.import && !f.import.accepted_units.includes(f.unit))
            fail(`Missing canonical import unit: ${f.id}`);
        if (f.required_if) {
            const dep = s.fields.find(d => d.id === f.required_if!.field);
            if (!dep || dep.scope !== f.scope || dep.id === f.id)
                fail(`Invalid condition reference: ${f.id}`);
            else if (validateField(dep, f.required_if.equals))
                fail(`Invalid condition value: ${f.id}`);
        }
    }
    for (const r of s.factor_requirements)
        if (!unique(r.scope_selectors) || r.scope_selectors.some(k => !s.fields.some(f => f.id === k)))
            fail(`Invalid factor selectors: ${r.key}`);
    // Conditional requirement dependencies must also be acyclic.
    const visiting = new Set<string>(), done = new Set<string>();
    const visit = (key: string): void => { if (visiting.has(key)) {
        fail('Conditional dependency cycle');
        return;
    } if (done.has(key))
        return; visiting.add(key); const next = s.fields.find(f => f.id === key)?.required_if?.field; if (next)
        visit(next); visiting.delete(key); done.add(key); };
    s.fields.forEach(f => visit(f.id));
});
export type MetricSchema = z.infer<typeof envelope>;
export type MetricField = z.infer<typeof fieldSchema>;
export type MetricValues = Record<string, string | number | boolean | null>;
export function parseMetricSchema(value: unknown): MetricSchema { guardTree(value); return envelope.parse(value); }
export function isISODate(value: string): boolean { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01')
    return false; const d = new Date(value + 'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value; }
export function validateField(f: MetricField, v: unknown): string | null {
    if (v === null || v === undefined)
        return null;
    if (f.type === 'decimal' || f.type === 'integer') {
        if (f.type === 'decimal' && (typeof v !== 'string' || v.length > 100 || !/^-?\d+(\.\d+)?$/.test(v)))
            return 'Expected canonical decimal string';
        if (f.type === 'integer' && (typeof v !== 'number' || !Number.isSafeInteger(v)))
            return 'Expected safe integer';
        try {
            const n = Decimal.parse(v as string | number), b = f.validation;
            if (b?.minimum !== undefined && n.compare(Decimal.parse(b.minimum)) < 0)
                return 'Below minimum';
            if (b?.maximum !== undefined && n.compare(Decimal.parse(b.maximum)) > 0)
                return 'Above maximum';
            if (b?.exclusive_minimum !== undefined && n.compare(Decimal.parse(b.exclusive_minimum)) <= 0)
                return 'Below exclusive minimum';
            if (b?.scale !== undefined && (String(v).split('.')[1]?.length ?? 0) > b.scale)
                return 'Exceeds precision scale';
        }
        catch (e) {
            return (e as Error).message;
        }
    }
    else if (f.type === 'boolean') {
        if (typeof v !== 'boolean')
            return 'Expected boolean';
    }
    else {
        if (typeof v !== 'string' || v.length > 20000)
            return 'Expected text <= 20000 characters';
        if (f.type === 'date' && !isISODate(v))
            return 'Invalid ISO date';
        if (f.type === 'enum' && !f.options?.some(o => o.value === v))
            return 'Unknown enum code';
    }
    return null;
}
export function validateValues(schema: MetricSchema, values: unknown, scope: MetricField['scope']): {
    field: string;
    message: string;
}[] {
    if (!values || typeof values !== 'object' || Array.isArray(values))
        return [{ field: '', message: 'Expected values object' }];
    const data = values as Record<string, unknown>, fields = schema.fields.filter(f => f.scope === scope), errors: {
        field: string;
        message: string;
    }[] = [];
    for (const key of Object.keys(data))
        if (!fields.some(f => f.id === key))
            errors.push({ field: key, message: 'Unknown field or wrong scope' });
    for (const f of fields) {
        const value = Object.hasOwn(data, f.id) ? data[f.id] : undefined;
        const required = f.required || !!(f.required_if && Object.hasOwn(data, f.required_if.field) && data[f.required_if.field] === f.required_if.equals);
        const message = value === null || value === undefined ? (required ? 'Required field' : null) : validateField(f, value);
        if (message)
            errors.push({ field: f.id, message });
    }
    return errors;
}
