type Identity = { id: string; email: string; emailVerified: boolean; role: string };
type StoredUser = { id: string; email: string | null; role: string; passwordHash?: string | null };
type Environment = Readonly<Record<string, string | undefined>>;
type Link = { subject: string; email: string; userId: string };
/** Operator-approved stable subject links only; never auto-link matching emails. */
export async function resolveOidcAccount<T extends Identity, U extends StoredUser>(identity: T, sessionIssuer: string, env: Environment, findUser: (id: string) => Promise<U | null>): Promise<T | Omit<U, 'passwordHash'> | null> {
  if (!env.OIDC_ACCOUNT_LINKS?.trim()) return identity;
  let links: Link[];
  try {
    const raw = JSON.parse(env.OIDC_ACCOUNT_LINKS);
    if (!Array.isArray(raw) || raw.length > 20) throw new Error();
    const subjects = new Set<string>(), targets = new Set<string>();
    for (const link of raw) {
      if (!link || typeof link !== 'object' || Object.keys(link).length !== 3 || !['subject','email','userId'].every(k => typeof link[k] === 'string' && link[k].length > 0 && link[k].length <= 254 && !/[\s\x00-\x1f\x7f]/.test(link[k])) || !/^[^@]+@[^@]+\.[^@]+$/.test(link.email) || subjects.has(link.subject) || targets.has(link.userId)) throw new Error();
      subjects.add(link.subject); targets.add(link.userId);
    }
    links = raw;
  } catch { return null; } // Invalid operator configuration fails closed.
  if (!env.OIDC_ISSUER || sessionIssuer !== env.OIDC_ISSUER || !identity.emailVerified || identity.role !== 'user' || !identity.id.startsWith('farm-auth:')) return null;
  const link = links.find(l => identity.id === `farm-auth:${l.subject}`);
  if (!link) return identity;
  if (identity.email.toLowerCase() !== link.email.toLowerCase()) return null;
  const user = await findUser(link.userId);
  if (!user || !user.email || user.email.toLowerCase() !== link.email.toLowerCase()) return null;
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe; // Live Neon role, including demotions, rather than cached/token role.
}
