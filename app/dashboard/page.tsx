const stats = [
  { title: "Total Mivtzoim", value: "0" },
  { title: "This Week", value: "0" },
  { title: "Routes", value: "0" },
  { title: "Completed", value: "0" },
];

export default function Dashboard() {
  return (
    <main className="p-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome to Shiur Daled Mivtzoim.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="rounded-xl border bg-white p-6 shadow-sm"
          >
            <p className="text-sm text-gray-500">{stat.title}</p>
            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Recent Activity</h2>

        <div className="mt-6 text-center text-gray-500">
          No Mivtzoim activity yet.
        </div>
      </div>
    </main>
  );
}
