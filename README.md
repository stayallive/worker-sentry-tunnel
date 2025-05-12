# Sentry tunnel Cloudflare Worker

This is a Sentry tunnel packaged as a Cloudflare Worker allowing you to deploy it very easily if you are already using Cloudflare.

> A tunnel is an HTTP endpoint that acts as a proxy between Sentry and your application. Because you control this server, there is no risk of any requests sent to it being blocked. When the endpoint lives under the same origin (although it does not have to in order for the tunnel to work), the browser will not treat any requests to the endpoint as a third-party request. As a result, these requests will have different security measures applied which, by default, don't trigger ad-blockers.

The above excerpt is from: https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fstayallive%2Fworker-sentry-tunnel)

## Usage

1. Deploy the worker using the button above or by running `wrangler publish` in the root of the project
2. Configure the following variables in the `wrangler.jsonc` file or in the Cloudflare dashboard, only one of the whitelists is required but you can use both (if you leave both empty, all requests will be blocked):
   - `SENTRY_DSN_WHITELIST` (optional): A comma seperated list of Sentry DSNs. You can find your DSN in your Sentry project settings. This is used to validate the incoming requests to the worker.
   - `SENTRY_HOST_WHITELIST` (optional): A comma seperated list of Sentry hostnames. This is used to validate the incoming requests to the worker. You can find your Sentry hostname in your Sentry project settings as part of the DSN.
   - `ENABLE_CORS`: If your worker is not deployed to the same domain as your application, you need to enable CORS. Otherwise you can leave this turned off. Set it to `true` to enable and `false` to disable.
3. Configure a route for the worker in the Cloudflare dashboard. For example, if your application is hosted at `https://example.com`, you could set the route to `https://example.com/ingest-tunnel`. Don't use "sentry" in the path name to prevent ad-blockers from blocking the requests.
4. Configure the Sentry SDK to use the tunnel. See: https://docs.sentry.io/platforms/javascript/configuration/options/#tunnel
5. Send a test event to Sentry to verify that the tunnel is working.
