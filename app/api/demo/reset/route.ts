import { NextResponse } from "next/server";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await execPromise("npx tsx prisma/seed.ts");
    return NextResponse.json({ success: true, message: "Database reset to initial demo state." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

