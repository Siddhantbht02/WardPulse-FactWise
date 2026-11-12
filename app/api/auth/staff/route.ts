import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const staff = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        pin: true,
        avatar: true,
        isDemo: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ staff });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

