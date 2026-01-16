import { run, Rel } from './ramo.js';
import { succeedo, failo, eq, conde, exist } from './goals.js';
import { cons, first, rest } from './sugar.js';
import { Var, type Subst } from './common.js';

// Re-export types for external use
export { Var };
export type Substitution = Subst;

// We provide these relations on pairs in order to reduce the
// dependency on the (somewhat) awkward pair operators (cons, first,
// rest). If a user only uses proper lists, they can use these
// relations without ever concerning themselves with the operators.
const nilo = Rel((x: Var) => eq(x, []));
const conso = Rel((a: Var, d: Var, p: Var) => eq(p, cons(a, d)));
const firsto = Rel((p: Var, a: Var) => exist((d: Var) => conso(a, d, p)));
const resto = Rel((p: Var, d: Var) => exist((a: Var) => conso(a, d, p)));

export {
  run,
  Rel,
  succeedo,
  failo,
  eq,
  conde,
  exist,
  cons,
  first,
  rest,
  nilo,
  conso,
  firsto,
  resto,
};
