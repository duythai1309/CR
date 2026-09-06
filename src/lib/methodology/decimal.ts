/** Bounded base-10 arithmetic, 28 significant digits, round-half-even. No binary floating arithmetic. */
const abs = (n: bigint) => n < 0n ? -n : n;
function ten(n: number): bigint { if (!Number.isInteger(n) || n < 0 || n > 1200)
    throw new Error('Decimal magnitude limit'); return 10n ** BigInt(n); }
function rounded(n: bigint, d: bigint): bigint {
    if (!d)
        throw new Error('Division by zero');
    const negative = (n < 0n) !== (d < 0n);
    n = abs(n);
    d = abs(d);
    let q = n / d;
    const r = n % d;
    if (r * 2n > d || (r * 2n === d && q % 2n !== 0n))
        q++;
    return negative ? -q : q;
}
export class Decimal {
    private constructor(readonly coefficient: bigint, readonly scale: number) { }
    static parse(value: string | number): Decimal {
        if (typeof value === 'number' && !Number.isFinite(value))
            throw new Error('Non-finite number');
        let s = String(value);
        // Number-valued AST constants / SQL JSON factors may be serialized with exponent.
        if (typeof value === 'number' && /e/i.test(s)) {
            const [mantissa, exponent] = s.toLowerCase().split('e');
            const parts = mantissa.split('.');
            const shift = Number(exponent) - (parts[1]?.length ?? 0);
            return Decimal.make(BigInt(parts.join('')) * ten(Math.max(0, shift)), Math.max(0, -shift));
        }
        if (s.length > 100 || !/^-?\d+(\.\d+)?$/.test(s))
            throw new Error('Invalid canonical decimal');
        const scale = s.split('.')[1]?.length ?? 0;
        s = s.replace('.', '');
        return Decimal.make(BigInt(s), scale);
    }
    private static make(c: bigint, s: number): Decimal {
        if (abs(c).toString().length > 600 || Math.abs(s) > 600)
            throw new Error('Decimal magnitude limit');
        while (s > 0 && c % 10n === 0n && c !== 0n) {
            c /= 10n;
            s--;
        }
        return new Decimal(c, c === 0n ? 0 : s);
    }
    private context(): Decimal {
        const excess = abs(this.coefficient).toString().length - 28;
        if (excess <= 0)
            return this;
        const c = rounded(this.coefficient, ten(excess));
        const s = this.scale - excess;
        return Decimal.make(s < 0 ? c * ten(-s) : c, Math.max(0, s));
    }
    add(b: Decimal): Decimal { const s = Math.max(this.scale, b.scale); return Decimal.make(this.coefficient * ten(s - this.scale) + b.coefficient * ten(s - b.scale), s).context(); }
    sub(b: Decimal): Decimal { return this.add(Decimal.make(-b.coefficient, b.scale)); }
    mul(b: Decimal): Decimal { return Decimal.make(this.coefficient * b.coefficient, this.scale + b.scale).context(); }
    div(b: Decimal): Decimal {
        if (!b.coefficient)
            throw new Error('Division by zero');
        // Sufficient guard digits relative to the quotient, then one half-even rounding.
        let n = this.coefficient * ten(b.scale), d = b.coefficient * ten(this.scale);
        let exponent = abs(n).toString().length - abs(d).toString().length;
        if (exponent >= 0 ? abs(n) < abs(d) * ten(exponent) : abs(n) * ten(-exponent) < abs(d))
            exponent--;
        const s = 27 - exponent;
        if (s >= 0)
            return Decimal.make(rounded(n * ten(s), d), s);
        return Decimal.make(rounded(n, d * ten(-s)) * ten(-s), 0);
    }
    pow(exponent: number): Decimal {
        if (!Number.isInteger(exponent) || Math.abs(exponent) > 32)
            throw new Error('pow requires integer exponent between -32 and 32');
        let result = Decimal.parse(1);
        for (let i = 0; i < Math.abs(exponent); i++)
            result = result.mul(this);
        return exponent < 0 ? Decimal.parse(1).div(result) : result;
    }
    compare(b: Decimal): number { const s = Math.max(this.scale, b.scale); const d = this.coefficient * ten(s - this.scale) - b.coefficient * ten(s - b.scale); return d < 0n ? -1 : d > 0n ? 1 : 0; }
    fixed(scale: number): string {
        if (!Number.isInteger(scale) || scale < 0 || scale > 28)
            throw new Error('Invalid output scale');
        const c = this.scale > scale ? rounded(this.coefficient, ten(this.scale - scale)) : this.coefficient * ten(scale - this.scale);
        const digits = abs(c).toString().padStart(scale + 1, '0');
        return (c < 0n ? '-' : '') + (scale ? digits.slice(0, -scale) + '.' + digits.slice(-scale) : digits);
    }
    toString(): string { const s = this.scale; const digits = abs(this.coefficient).toString().padStart(s + 1, '0'); return (this.coefficient < 0n ? '-' : '') + (s ? digits.slice(0, -s) + '.' + digits.slice(-s) : digits); }
}
