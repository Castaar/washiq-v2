import type { Types } from 'mongoose';
import { PriceConfig, StockReading, StockTransfer, Translation, WashProgram, WeeklyEntry } from '@/lib/models';

// Several records refer to a product by its name instead of its id (prices, wash
// programs, stock counts, older ingaven, transfers, the French display name).
// Renaming a product updates all of them for its site, so nothing gets detached.
export async function renameProductReferences(
  siteId: Types.ObjectId | string,
  chemicalId: Types.ObjectId | string,
  oldName: string,
  newName: string,
): Promise<void> {
  await Promise.all([
    PriceConfig.updateMany(
      { site_id: siteId, 'chemicals.name': oldName },
      { $set: { 'chemicals.$[c].name': newName } },
      { arrayFilters: [{ 'c.name': oldName }] },
    ),
    WashProgram.updateMany(
      { site_id: siteId, chemicals: oldName },
      { $set: { 'chemicals.$[c]': newName } },
      { arrayFilters: [{ c: oldName }] },
    ),
    StockReading.updateMany({ chemical_id: chemicalId }, { $set: { name: newName } }),
    WeeklyEntry.updateMany(
      { site_id: siteId, 'chemical_usages.name': oldName },
      { $set: { 'chemical_usages.$[c].name': newName } },
      { arrayFilters: [{ 'c.name': oldName }] },
    ),
    StockTransfer.updateMany(
      { $or: [{ from_chemical_id: chemicalId }, { to_chemical_id: chemicalId }] },
      { $set: { name: newName } },
    ),
  ]);

  // Content translations are keyed by name and shared across sites: copy the
  // translation to the new name (other sites may still use the old one).
  const translations = await Translation.find({ key: `product.${oldName}` }).lean();
  await Promise.all(
    translations.map((t) =>
      Translation.updateOne(
        { locale: t.locale, key: `product.${newName}` },
        { $setOnInsert: { value: t.value, updated_at: new Date() } },
        { upsert: true },
      ),
    ),
  );
}
