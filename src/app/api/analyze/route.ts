import { NextResponse } from "next/server";
import { analyzeUnderstanding } from "@/server/ai/analyze";
import { analyzeRequestSchema } from "@/server/ai/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식을 확인해 주세요." },
      { status: 400 },
    );
  }

  const parsed = analyzeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "입력한 내용을 다시 확인해 주세요.",
      },
      { status: 422 },
    );
  }

  const result = await analyzeUnderstanding(parsed.data.text);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
