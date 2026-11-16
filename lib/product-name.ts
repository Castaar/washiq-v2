// Product names are typed per carwash, so the same product can be spelled with a
// different capital or extra spaces ("Lotus Intensiv" vs "Lotus intensiv"). Compare
// names with this when matching a product across carwashes.
export function sameProductName(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('nl-BE');
  return norm(a) !== '' && norm(a) === norm(b);
}
