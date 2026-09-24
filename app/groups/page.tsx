"use client";

import { useState } from "react";

export default function Groups() {
  const [showForm, setShowForm] = useState(false);
  const [groupName, setGroupName] = useState("");

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Groups</h1>
          <p className="mt-2 text-gray-600">
            Create and manage the groups you are part of.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-black px-5 py-2 text-white"
        >
          + Create Group
        </button>
      </div>

      {showForm && (
        <div className="mt-6 max-w-xl rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Create a Group</h2>

          <label className="mt-5 block text-sm font-medium">
            Group Name
          </label>

          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Example: Shiur Daled"
            className="mt-2 w-full rounded-lg border p-3 outline-none focus:ring-2"
          />

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-5 py-2"
            >
              Cancel
            </button>

            <button
              onClick={() => alert(`Group "${groupName}" is ready to be saved.`)}
              className="rounded-lg bg-black px-5 py-2 text-white"
            >
              Create Group
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-xl border bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold">No Groups Yet</h2>

        <p className="mt-2 text-gray-500">
          Create a group to start organizing your Mivtzoim routes.
        </p>
      </div>
    </main>
  );
}
