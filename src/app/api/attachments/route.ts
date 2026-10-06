import { context } from "@/modules/auth/session";
import { respondError, sameOrigin } from "@/modules/shared/http";
import { NextResponse } from "next/server";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { service } = await context();
    if (Number(request.headers.get("content-length") || 0) > 11 * 1024 * 1024)
      return NextResponse.json(
        { error: "Maximum file size is 10 MB." },
        { status: 413 },
      );
    const form = await request.formData();
    const taskId = z.uuid().parse(form.get("taskId"));
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 10 * 1024 * 1024)
      return NextResponse.json(
        { error: "Choose a file up to 10 MB." },
        { status: 400 },
      );
    return NextResponse.json(
      await service.addAttachment(
        taskId,
        file.name,
        Buffer.from(await file.arrayBuffer()),
      ),
    );
  } catch (error) {
    return respondError(error);
  }
}
export async function GET(request: Request) {
  try {
    const { service } = await context();
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    const file = await service.getAttachment(id);
    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return respondError(error);
  }
}
