export default function DashboardSetupError({ message }: { message: string }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        ASB dashboard
      </h1>
      <p className="mb-4 text-zinc-600 dark:text-zinc-400">
        Add Supabase credentials to{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.env.local</code>{" "}
        and run the SQL migration in{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          supabase/migrations/001_initial.sql
        </code>
        .
      </p>
      <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-red-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-red-400">
        {message}
      </pre>
    </main>
  );
}
