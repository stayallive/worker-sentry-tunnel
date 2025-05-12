function isDsnAllowed(env: Env, dsn: string): boolean {
	const allowedDsns = env.SENTRY_DSN_WHITELIST.split(',').map((dsn) => dsn.trim());

	// Check if the full DSN is whitelisted
	if (allowedDsns.includes(dsn)) {
		return true;
	}

	const allowedHosts = env.SENTRY_HOST_WHITELIST.split(',').map((host) => host.trim());

	// Check if the DSN host is whitelisted
	return allowedHosts.includes(new URL(dsn).host);
}

const corsHeaders = {
	'Access-Control-Max-Age': '86400',
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function handleOptionsRequest(request: Request): Response {
	// Make sure the necessary headers are present
	// for this to be a valid pre-flight request
	let headers = request.headers;

	if (
		headers.get('Origin') !== null &&
		headers.get('Access-Control-Request-Method') !== null &&
		headers.get('Access-Control-Request-Headers') !== null
	) {
		// Handle CORS pre-flight request.
		// If you want to check or reject the requested method + headers you can do that here.
		let respHeaders = {
			...corsHeaders,
			// Allow all future content Request headers to go back to browser
			// such as Authorization (Bearer) or X-Client-Name-Version
			'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers')!,
		};

		return new Response(null, {
			headers: respHeaders,
		});
	}

	// Handle standard OPTIONS request.
	// If you want to allow other HTTP Methods, you can do that here.
	return new Response(null, {
		headers: {
			Allow: corsHeaders['Access-Control-Allow-Methods'],
		},
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// noinspection PointlessBooleanExpressionJS
		const isCorsEnabled = env.ENABLE_CORS === true || env.ENABLE_CORS === 'true';

		// Handle the OPTIONS request if CORS is enabled
		if (isCorsEnabled && request.method === 'OPTIONS') {
			return handleOptionsRequest(request);
		}

		// Only POST requests are expected and allowed
		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', {
				status: 405,
			});
		}

		// Get the payload from the request as plain text
		const payload = await request.clone().text();

		// The Sentry payload is split in a JSON header section and N items, to get the header we find the first line ending in a newline
		const parts = payload.split('\n');

		// We would expect to see at least 2 parts (the header + N items, each with their own header and data section)
		if (parts.length < 2) {
			return new Response('Bad Request', {
				status: 400,
			});
		}

		// The first part should always be the JSON header which contains the Sentry DSN the event is destined for
		const header: Record<string, string> = JSON.parse(parts[0]);

		// Make sure we have a DSN and it's one that is whitelisted
		if (header.dsn && !isDsnAllowed(env, header.dsn)) {
			return new Response('Forbidden', {
				status: 403,
			});
		}

		// Parse the Sentry DSN as an URL so we can extract the parts we need
		const dsn = new URL(header.dsn);

		// The project ID is the first part of the Sentry DSN pathname
		const projectId = dsn.pathname.substring(1).split('/')[0];

		// The API URL can be constructed from the Sentry DSN host and project ID
		const apiUrl = `https://${dsn.host}/api/${projectId}/envelope/`;

		// Build the Sentry API request
		const sentryRequest = new Request(apiUrl, {
			body: request.body,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-sentry-envelope',
			},
		});

		// Return with the response from the Sentry API
		const sentryResponse = await fetch(sentryRequest);

		if (isCorsEnabled) {
			// Recreate the response so the headers can be modified
			const response = new Response(sentryResponse.body, sentryResponse);

			// Set CORS headers
			response.headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);

			// Append the Vary header so browsers will cache the response correctly
			response.headers.append('Vary', 'Origin');

			return response;
		}

		return sentryResponse;
	},
} satisfies ExportedHandler<Env>;
