import Link from "next/link";

const routes = [
  {
    name: "No routes yet",
    description: "Your created routes will appear here.",
  },
];

export default function Routes() {
  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Routes</h1>
          <p className="mt-2 text-gray-600">
            Create and manage your Mivtzoim routes.
          </p>
        </div>

        <Link
          href="/routes/new"
          className="rounded-lg bg-black px-5 py-2 text-white"
        >
          + Add New Route
        </Link>
      </div>

      <div className="mt-8 grid gap-4">
        {routes.map((route) => (
          <div
            key={route.name}
            className="rounded-xl border bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold">{route.name}</h2>

            <p className="mt-2 text-gray-500">
              {route.description}
            </p>

            <div className="mt-5 flex gap-3">
              <Link
                href="/routes/new"
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Create Route
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
