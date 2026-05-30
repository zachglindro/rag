import { NextRequest, NextResponse } from "next/server"

const DEFAULT_BACKEND_URL = "http://backend:8000"
const LONG_RUNNING_TIMEOUT_MS = 10 * 60 * 1000

function getBackendBaseUrl() {
  const envUrl =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND_URL

  return envUrl.replace(/\/$/, "")
}

async function proxyColumnsRequest(request: NextRequest) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, LONG_RUNNING_TIMEOUT_MS)

  try {
    const bodyText = await request.text()
    const contentType = request.headers.get("content-type")

    const response = await fetch(`${getBackendBaseUrl()}/columns`, {
      method: request.method,
      headers: contentType ? { "Content-Type": contentType } : undefined,
      body: bodyText.length > 0 ? bodyText : undefined,
      signal: controller.signal,
      cache: "no-store",
    })

    const responseText = await response.text()
    const responseContentType = response.headers.get("content-type")

    return new NextResponse(responseText, {
      status: response.status,
      headers: responseContentType
        ? { "Content-Type": responseContentType }
        : undefined,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        {
          detail:
            "Column operation timed out while waiting for backend completion",
        },
        { status: 504 }
      )
    }

    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Failed to proxy /columns request",
      },
      { status: 502 }
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: NextRequest) {
  return proxyColumnsRequest(request)
}

export async function PUT(request: NextRequest) {
  return proxyColumnsRequest(request)
}

export async function DELETE(request: NextRequest) {
  return proxyColumnsRequest(request)
}
