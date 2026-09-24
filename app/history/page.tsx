const history = [
  {
    date: "No activity yet",
    type: "Mivtzoim Activity",
    details: "Your completed Mivtzoim will appear here.",
    quantity: 0,
  },
];

export default function History() {
  return (
    <main className="p-8">
      <div>
        <h1 className="text-3xl font-bold">History</h1>
        <p className="mt-2 text-gray-600">
          View your previous Mivtzoim activity.
        </p>
      </div>

      <div className="mt-8 rounded-xl border bg-white shadow-sm">
        <div className="border-b p-6">
          <h2 className="text-xl font-semibold">Activity History</h2>
          <p className="mt-1 text-sm text-gray-500">
            Your completed activity will be listed here.
          </p>
        </div>

        <div className="divide-y">
          {history.map((item) => (
            <div
              key={item.date}
              className="flex items-center justify-between p-6"
            >
              <div>
                <p className="font-medium">{item.date}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {item.details}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">{item.type}</p>
                <p className="mt-1 font-semibold">
                  {item.quantity}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
