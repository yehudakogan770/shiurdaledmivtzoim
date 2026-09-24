"use client";

import { useState } from "react";
import Link from "next/link";

export default function NewRoute() {
  const [routeName, setRouteName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <main className="p-8">
      <div className="mb-8">
        <Link
          href="/routes"
          className="text-sm text-gray-500 hover:text-black"
        >
          ← Back to Routes
        </Link>

        <h1 className="mt-4 text-3xl font-bold">Add New Route</h1>

        <p className="mt-2 text-gray-600">
          Create a route and add locations that you want to visit.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium">
            Route Name
          </label>

          <input
            type="text"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            placeholder="Example: Main Street Route"
            className="mt-2 w-full rounded-lg border p-3 outline-none focus:ring-2"
          />
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium">
            Description
          </label>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this route..."
            rows={4}
            className="mt-2 w-full rounded-lg border p-3 outline-none focus:ring-2"
          />
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold">Locations</h2>

          <p className="mt-1 text-sm text-gray-500">
            You can add locations to this route after creating it.
          </p>

          <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
            <p className="text-gray-500">No locations added yet.</p>

            <button
              type="button"
              className="mt-4 rounded-lg border px-4 py-2 text-sm"
            >
              + Add Location
            </button>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href="/routes"
            className="rounded-lg border px-5 py-2"
          >
            Cancel
          </Link>

          <button
            type="button"
            className="rounded-lg bg-black px-5 py-2 text-white"
            onClick={() => alert(`Route "${routeName}" is ready to be saved.`)}
          >
            Create Route
          </button>
        </div>
      </div>
    </main>
  );
}
