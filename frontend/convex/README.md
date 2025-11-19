# Smart Transcribe - Convex Backend

This directory contains all Convex backend functions, schema, and authentication configuration.

## Environment Variables

The following environment variables must be set in Convex (use `npx convex env set KEY value`):

### Required for Authentication
- `SITE_URL` - Your frontend URL for auth redirects
  - Local dev: `http://localhost:5173`
  - Production: Your deployed frontend URL (e.g., `https://yourdomain.com`)
- `JWT_PRIVATE_KEY` - Secret key for signing JWT tokens (generate with `openssl rand -base64 32`)
- `AUTH_SENDGRID_KEY` - SendGrid API key for OTP emails
- `AUTH_EMAIL_FROM` - From address for auth emails (e.g., `Your App <noreply@yourdomain.com>`)

### Required for Transcription
- `SONIOX_API_KEY` - Soniox API key for audio transcription
- `GEMINI_API_KEY` - Google Gemini API key for AI processing

### Setting Environment Variables
```bash
# Local development - one-time setup
npx convex env set SITE_URL http://localhost:5173
npx convex env set JWT_PRIVATE_KEY "$(openssl rand -base64 32)"
npx convex env set AUTH_SENDGRID_KEY "your-sendgrid-api-key"
npx convex env set AUTH_EMAIL_FROM "Your App <noreply@yourdomain.com>"

# Production (run with --prod flag)
npx convex env set SITE_URL https://yourdomain.com --prod
npx convex env set JWT_PRIVATE_KEY "$(openssl rand -base64 32)" --prod
npx convex env set AUTH_SENDGRID_KEY "your-sendgrid-api-key" --prod
npx convex env set AUTH_EMAIL_FROM "Your App <noreply@yourdomain.com>" --prod
```

## Convex Functions

Write your Convex functions here.
See https://docs.convex.dev/functions for more.

A query function that takes two arguments looks like:

```ts
// convex/myFunctions.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const myQueryFunction = query({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const documents = await ctx.db.query("tablename").collect();

    // Arguments passed from the client are properties of the args object.
    console.log(args.first, args.second);

    // Write arbitrary JavaScript here: filter, aggregate, build derived data,
    // remove non-public properties, or create new objects.
    return documents;
  },
});
```

Using this query function in a React component looks like:

```ts
const data = useQuery(api.myFunctions.myQueryFunction, {
  first: 10,
  second: "hello",
});
```

A mutation function looks like:

```ts
// convex/myFunctions.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const myMutationFunction = mutation({
  // Validators for arguments.
  args: {
    first: v.string(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.
    const message = { body: args.first, author: args.second };
    const id = await ctx.db.insert("messages", message);

    // Optionally, return a value from your mutation.
    return await ctx.db.get(id);
  },
});
```

Using this mutation function in a React component looks like:

```ts
const mutation = useMutation(api.myFunctions.myMutationFunction);
function handleButtonPress() {
  // fire and forget, the most common way to use mutations
  mutation({ first: "Hello!", second: "me" });
  // OR
  // use the result once the mutation has completed
  mutation({ first: "Hello!", second: "me" }).then((result) =>
    console.log(result),
  );
}
```

Use the Convex CLI to push your functions to a deployment. See everything
the Convex CLI can do by running `npx convex -h` in your project root
directory. To learn more, launch the docs with `npx convex docs`.
