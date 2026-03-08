import { NextResponse } from "next/server";

import { deleteDbaasInstance, getDbaasInstance } from "@/lib/dbaas/server-client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  try {
    const { instanceId } = await params;
    const instance = await getDbaasInstance(request, instanceId);
    return NextResponse.json(instance, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch DB instance";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  try {
    const { instanceId } = await params;
    const operation = await deleteDbaasInstance(request, instanceId);
    return NextResponse.json(operation, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to delete DB instance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
