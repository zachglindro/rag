/** @type {import('next').NextConfig} */
const backendBaseUrl = "http://backend:8000"

const backendRoutes = [
	"/upload",
	"/suggest-mappings",
	"/records/check-existence",
	"/ingest",
	"/records/:path*",
	"/column-metadata",
	"/semantic-search/:path*",
	"/keyword-search/:path*",
	"/reset-database",
	"/compare/setup",
	"/compare/status",
	"/compare/rebuild",
	"/history",
	"/history/reset",
	"/settings/model",
	"/settings/model/cancel-download-qwen",
	"/settings/model/download-qwen",
	"/settings/backup",
	"/settings/backup/now",
	"/records/bulk-delete",
	"/export-data",
	"/generate",
	"/model-status",
]

const nextConfig = {
	experimental: {
		proxyClientMaxBodySize: "40mb",
	},

	async rewrites() {
		if (process.env.NEXT_PUBLIC_BACKEND_URL !== "/api") {
			return []
		}

		return [
			...backendRoutes.map((source) => ({
				source: `/api${source}`,
				destination: `${backendBaseUrl}${source}`,
			})),
		]
	},
}

export default nextConfig
