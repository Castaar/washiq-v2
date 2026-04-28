import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { PriceConfig, User } from '@/lib/models';
import bcrypt from 'bcryptjs';
import { sendPasswordChangedEmail } from '@/lib/email';

export async function PATCH(req: NextRequest) {
  await dbConnect();

  const body = await req.json() as {
    siteId?: string;
    priceConfigId?: string;
    energyPerKw?: number;
    waterPerLiter?: number;
    saltPerKg?: number;
    flockPerKg?: number;
    clothPerUnit?: number;
    chemicalPrices?: { name: string; price: number }[];
    currentUserId?: string;
    email?: string;
    newPassword?: string;
  };

  const {
    priceConfigId, siteId,
    energyPerKw, waterPerLiter, saltPerKg, flockPerKg, clothPerUnit,
    chemicalPrices, currentUserId, email, newPassword,
  } = body;

  // Update price config
  if (priceConfigId) {
    await PriceConfig.findByIdAndUpdate(priceConfigId, {
      $set: {
        energy_per_kw: energyPerKw,
        water_per_liter: waterPerLiter,
        salt_per_kg: saltPerKg,
        flock_per_kg: flockPerKg,
        cloth_per_unit: clothPerUnit,
        chemicals: (chemicalPrices ?? []).map((cp) => ({
          name: cp.name,
          price_per_unit: cp.price,
        })),
      },
    });
  } else if (siteId) {
    await PriceConfig.create({
      site_id: siteId,
      energy_per_kw: energyPerKw,
      water_per_liter: waterPerLiter,
      salt_per_kg: saltPerKg,
      flock_per_kg: flockPerKg,
      cloth_per_unit: clothPerUnit,
      chemicals: (chemicalPrices ?? []).map((cp) => ({
        name: cp.name,
        price_per_unit: cp.price,
      })),
      valid_from: new Date(),
    });
  }

  // Update current user
  if (currentUserId) {
    const updates: Record<string, string> = {};
    if (email) updates.email = email.trim().toLowerCase();
    if (newPassword) updates.password_hash = await bcrypt.hash(newPassword, 12);
    if (Object.keys(updates).length > 0) {
      const updatedUser = await User.findByIdAndUpdate(currentUserId, { $set: updates }, { new: true });
      if (newPassword && updatedUser) {
        const notifyEmail = updates.email ?? updatedUser.email;
        sendPasswordChangedEmail(notifyEmail, updatedUser.name as string).catch(() => null);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
