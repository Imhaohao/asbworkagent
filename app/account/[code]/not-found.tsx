import Link from "next/link";

export default function AccountNotFound() {
  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-20 text-center">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Account not found
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        That account code is not in your imported data.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
      >
        ← Back to overview
      </Link>
    </main>
  );
}
