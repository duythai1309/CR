import { compileMethodology } from './expression';
import { type MetricField, type MetricValues } from './schema';
export interface FormField {
    id: string;
    label: string;
    scope: MetricField['scope'];
    control: 'decimal' | 'integer' | 'text' | 'checkbox' | 'date' | 'select';
    unit: string;
    required: boolean;
    required_if?: MetricField['required_if'];
    constraints: MetricField['validation'];
    options: {
        value: string;
        label: string;
    }[];
    group: string;
    order: number;
    aliases: string[];
    accepted_units: string[];
}
/** Conditions affect requiredness, not visibility or data retention. */
export function buildMethodologyForm(input: unknown, locale = 'vi', values: MetricValues = {}): {
    baseline: FormField[];
    observation: FormField[];
} {
    const { schema } = compileMethodology(input);
    const result: {
        baseline: FormField[];
        observation: FormField[];
    } = { baseline: [], observation: [] };
    const text = (labels: Record<string, string>) => labels[locale] ?? labels.vi ?? Object.values(labels)[0];
    for (const f of schema.fields) {
        result[f.scope].push({ id: f.id, label: text(f.label), scope: f.scope, control: f.type === 'enum' ? 'select' : f.type === 'boolean' ? 'checkbox' : f.type, unit: f.unit, required: f.required || !!(f.required_if && Object.hasOwn(values, f.required_if.field) && values[f.required_if.field] === f.required_if.equals), required_if: f.required_if ? structuredClone(f.required_if) : undefined, constraints: structuredClone(f.validation), options: f.options?.map(o => ({ value: o.value, label: text(o.label) })) ?? [], group: f.ui?.group ?? f.scope, order: f.ui?.order ?? 0, aliases: [...(f.import?.aliases ?? [])], accepted_units: [...(f.import?.accepted_units ?? [f.unit])] });
    }
    for (const rows of Object.values(result))
        rows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    return result;
}
