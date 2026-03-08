import { NextResponse } from "next/server";

import { createDbaasInstance, listDbaasInstances } from "@/lib/dbaas/server-client";

export async function GET(request: Request) {
  try {
    const data = await listDbaasInstances(request);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to list DB instances";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const operation = await createDbaasInstance(request, payload);
    return NextResponse.json(operation, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to create DB instance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
