import { ProvablePure } from '../snarky.js';
import { Field } from './core.js';
import { Field as Fp } from '../provable/field-bigint.js';
import { test, Random } from './testing/property.js';
import { deepEqual, throws } from 'node:assert/strict';
import { Provable } from './provable.js';
import { Binable } from '../bindings/lib/binable.js';
import { ProvableExtended } from './circuit_value.js';
import { FieldType } from './field.js';

// types
Field satisfies Provable<Field>;
Field satisfies ProvablePure<Field>;
Field satisfies ProvableExtended<Field>;
Field satisfies Binable<Field>;

// constructor
test(Random.field, Random.json.field, (x, y, assert) => {
  let z = Field(x);
  assert(z instanceof Field);
  assert(z.toBigInt() === x);
  assert(z.toString() === x.toString());
  assert(z.isConstant());
  deepEqual(z.toConstant(), z);

  assert((z = new Field(x)) instanceof Field && z.toBigInt() === x);
  assert((z = Field(z)) instanceof Field && z.toBigInt() === x);
  assert((z = Field(z.value)) instanceof Field && z.toBigInt() === x);

  z = Field(y);
  assert(z instanceof Field);
  assert(z.toString() === y);
  deepEqual(Field.fromJSON(y), z);
  assert(z.toJSON() === y);
});

// handles small numbers
test(Random.nat(1000), (n, assert) => {
  assert(Field(n).toString() === String(n));
});
// handles large numbers 2^31 <= x < 2^53
test(Random.int(2 ** 31, Number.MAX_SAFE_INTEGER), (n, assert) => {
  assert(Field(n).toString() === String(n));
});
// handles negative numbers
test(Random.uint32, (n) => {
  deepEqual(Field(-n), Field(n).neg());
});
// throws on fractional numbers
test.negative(Random.int(-10, 10), Random.fraction(1), (x, f) => {
  Field(x + f);
});
// correctly overflows the field
test(Random.field, Random.int(-5, 5), (x, k) => {
  deepEqual(Field(x + BigInt(k) * Field.ORDER), Field(x));
});

// special generator
let SmallField = Random.reject(
  Random.field,
  (x) => x.toString(2).length > Fp.sizeInBits - 2
);

// arithmetic, both in- and outside provable code
equivalent2((x, y) => x.add(y), Fp.add);
equivalent1((x) => x.neg(), Fp.negate);
equivalent2((x, y) => x.sub(y), Fp.sub);
equivalent2((x, y) => x.mul(y), Fp.mul);
equivalent1(
  (x) => x.inv(),
  (x) => Fp.inverse(x) ?? throwError('division by 0')
);
equivalent2(
  (x, y) => x.div(y),
  (x, y) => Fp.div(x, y) ?? throwError('division by 0')
);
equivalent1((x) => x.square(), Fp.square);
equivalent1(
  (x) => x.sqrt(),
  (x) => Fp.sqrt(x) ?? throwError('no sqrt')
);
equivalent2(
  (x, y) => x.equals(y).toField(),
  (x, y) => BigInt(x === y)
);
equivalent2(
  (x, y) => x.lessThan(y).toField(),
  (x, y) => BigInt(x < y),
  SmallField
);
equivalent2(
  (x, y) => x.lessThanOrEqual(y).toField(),
  (x, y) => BigInt(x <= y),
  SmallField
);
equivalentVoid2(
  (x, y) => x.assertEquals(y),
  (x, y) => x === y || throwError('not equal')
);
equivalentVoid2(
  (x, y) => x.assertNotEquals(y),
  (x, y) => x !== y || throwError('equal')
);
equivalentVoid2(
  (x, y) => x.assertLessThan(y),
  (x, y) => x < y || throwError('not less than'),
  SmallField
);
equivalentVoid2(
  (x, y) => x.assertLessThanOrEqual(y),
  (x, y) => x <= y || throwError('not less than or equal'),
  SmallField
);
equivalentVoid1(
  (x) => x.assertBool(),
  (x) => x === 0n || x === 1n || throwError('not boolean')
);
equivalent1(
  (x) => x.isEven().toField(),
  (x) => BigInt((x & 1n) === 0n),
  SmallField
);

// non-constant field vars
test(Random.field, (x0, assert) => {
  Provable.runAndCheck(() => {
    // Var
    let x = Provable.witness(Field, () => Field(x0));
    assert(x.value[0] === FieldType.Var);
    assert(typeof x.value[1] === 'number');
    throws(() => x.toConstant());
    throws(() => x.toBigInt());
    Provable.asProver(() => assert(x.toBigInt() === x0));

    // Scale
    let z = x.mul(2);
    assert(z.value[0] === FieldType.Scale);
    throws(() => x.toConstant());

    // Add
    let u = z.add(x);
    assert(u.value[0] === FieldType.Add);
    throws(() => x.toConstant());
    Provable.asProver(() => assert(u.toBigInt() === Fp.mul(x0, 3n)));

    // seal
    let v = u.seal();
    assert(v.value[0] === FieldType.Var);
    Provable.asProver(() => assert(v.toBigInt() === Fp.mul(x0, 3n)));

    // Provable.witness / assertEquals / assertNotEquals
    let w0 = Provable.witness(Field, () => v.mul(5).add(1));
    let w1 = x.mul(15).add(1);
    w0.assertEquals(w1);
    throws(() => w0.assertNotEquals(w1));

    let w2 = Provable.witness(Field, () => w0.add(1));
    w0.assertNotEquals(w2);
    throws(() => w0.assertEquals(w2));
  });
});

// some provable operations
test(Random.field, Random.field, (x0, y0, assert) => {
  Provable.runAndCheck(() => {
    // equals
    let x = Provable.witness(Field, () => Field(x0));
    let y = Provable.witness(Field, () => Field(y0));

    let b = x.equals(y);
    b.assertEquals(x0 === y0);
    Provable.asProver(() => assert(b.toBoolean() === (x0 === y0)));

    let c = x.equals(x0);
    c.assertEquals(true);
    Provable.asProver(() => assert(c.toBoolean()));

    // mul
    let z = x.mul(y);
    Provable.asProver(() => assert(z.toBigInt() === Fp.mul(x0, y0)));

    // toBits / fromBits
    let bits = Fp.toBits(x0);
    let x1 = Provable.witness(Field, () => Field.fromBits(bits));
    let bitsVars = x1.toBits();
    Provable.asProver(() =>
      assert(bitsVars.every((b, i) => b.toBoolean() === bits[i]))
    );
  });
});

// helpers

function equivalent1(
  op1: (x: Field) => Field,
  op2: (x: bigint) => bigint,
  rng: Random<bigint> = Random.field
) {
  test(rng, (x0, assert) => {
    let x = Field(x0);
    // outside provable code
    handleErrors(
      () => op1(x),
      () => op2(x0),
      (a, b) => assert(a.toBigInt() === b, 'equal results')
    );
    // inside provable code
    Provable.runAndCheck(() => {
      x = Provable.witness(Field, () => x);
      handleErrors(
        () => op1(x),
        () => op2(x0),
        (a, b) =>
          Provable.asProver(() => assert(a.toBigInt() === b, 'equal results'))
      );
    });
  });
}
function equivalent2(
  op1: (x: Field, y: Field | bigint) => Field,
  op2: (x: bigint, y: bigint) => bigint,
  rng: Random<bigint> = Random.field
) {
  test(rng, rng, (x0, y0, assert) => {
    let x = Field(x0);
    let y = Field(y0);
    // outside provable code
    handleErrors(
      () => op1(x, y),
      () => op2(x0, y0),
      (a, b) => assert(a.toBigInt() === b, 'equal results')
    );
    handleErrors(
      () => op1(x, y0),
      () => op2(x0, y0),
      (a, b) => assert(a.toBigInt() === b, 'equal results')
    );
    // inside provable code
    Provable.runAndCheck(() => {
      x = Provable.witness(Field, () => x);
      y = Provable.witness(Field, () => y);
      handleErrors(
        () => op1(x, y),
        () => op2(x0, y0),
        (a, b) =>
          Provable.asProver(() => assert(a.toBigInt() === b, 'equal results'))
      );
      handleErrors(
        () => op1(x, y0),
        () => op2(x0, y0),
        (a, b) =>
          Provable.asProver(() => assert(a.toBigInt() === b, 'equal results'))
      );
    });
  });
}
function equivalentVoid1(
  op1: (x: Field) => void,
  op2: (x: bigint) => void,
  rng: Random<bigint> = Random.field
) {
  test(rng, (x0) => {
    let x = Field(x0);
    // outside provable code
    handleErrors(
      () => op1(x),
      () => op2(x0)
    );
    // inside provable code
    Provable.runAndCheck(() => {
      x = Provable.witness(Field, () => x);
      handleErrors(
        () => op1(x),
        () => op2(x0)
      );
    });
  });
}
function equivalentVoid2(
  op1: (x: Field, y: Field | bigint) => void,
  op2: (x: bigint, y: bigint) => void,
  rng: Random<bigint> = Random.field
) {
  test(rng, rng, (x0, y0) => {
    let x = Field(x0);
    let y = Field(y0);
    // outside provable code
    handleErrors(
      () => op1(x, y),
      () => op2(x0, y0)
    );
    handleErrors(
      () => op1(x, y0),
      () => op2(x0, y0)
    );
    // inside provable code
    Provable.runAndCheck(() => {
      x = Provable.witness(Field, () => x);
      y = Provable.witness(Field, () => y);
      handleErrors(
        () => op1(x, y),
        () => op2(x0, y0)
      );
      handleErrors(
        () => op1(x, y0),
        () => op2(x0, y0)
      );
    });
  });
}

function handleErrors<T, S, R>(
  op1: () => T,
  op2: () => S,
  useResults?: (a: T, b: S) => R
): R | undefined {
  let result1: T, result2: S;
  let error1: Error | undefined;
  let error2: Error | undefined;
  try {
    result1 = op1();
  } catch (err) {
    error1 = err as Error;
  }
  try {
    result2 = op2();
  } catch (err) {
    error2 = err as Error;
  }
  if (!!error1 !== !!error2) {
    error1 && console.log(error1);
    error2 && console.log(error2);
  }
  deepEqual(!!error1, !!error2, 'equivalent errors');
  if (!(error1 || error2) && useResults !== undefined) {
    return useResults(result1!, result2!);
  }
}

function throwError(message?: string): any {
  throw Error(message);
}
