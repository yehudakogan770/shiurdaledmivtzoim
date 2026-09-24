import Link from "next/link";

export default function Mivtzoim() {
  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Mivtzoim</h1>
          <p className="mt-2 text-gray-600">
            Keep track of your Mivtzoim and routes.
          </p>
        </div>

        <Link
          href="/routes/new"
          className="rounded-lg bg-black px-5 py-2 text-white"
        >
          + Add New Route
        </Link>
      </div>

      <div className="mt-8 rounded-xl border bg-white p-8 text-center">
        <h2 className="text-xl font-semibold">No Routes yet</h2>

        <p className="mt-2 text-gray-500">
          Add your first route to start keeping track of your Mivtzoim.
        </p>

        <Link
          href="/routes/new"
          className="mt-5 inline-block rounded-lg border px-5 py-2"
        >
          Create Your First Route
        </Link>
      </div>
    </main>
  );
}
