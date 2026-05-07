/**
 * Order nav: General, Dance, Spirit (by name/code substring), then others A–Z.
 */
export function sortAccountsForNav<
  T extends { account_code: string; account_name: string },
>(accounts: T[]): T[] {
  const tier = (a: T): number => {
    const h = `${a.account_name} ${a.account_code}`.toLowerCase();
    if (h.includes("general")) return 0;
    if (h.includes("dance")) return 1;
    if (h.includes("spirit")) return 2;
    return 99;
  };
  return [...accounts].sort((a, b) => {
    const d = tier(a) - tier(b);
    if (d !== 0) return d;
    return a.account_code.localeCompare(b.account_code);
  });
}
