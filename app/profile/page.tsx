"use client";

import { useState } from "react";

export default function Profile() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("Your Name");
  const [email, setEmail] = useState("your@email.com");

  return (
    <main className="p-8">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="mt-2 text-gray-600">
          Manage your account information.
        </p>
      </div>

      <div className="mt-8 max-w-2xl rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Information</h2>

          <button
            onClick={() => setEditing(!editing)}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            {editing ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className="text-sm text-gray-500">Name</label>

            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-lg border p-3"
              />
            ) : (
              <p className="mt-1 text-lg">{name}</p>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-500">Email</label>

            {editing ? (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border p-3"
              />
            ) : (
              <p className="mt-1 text-lg">{email}</p>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-500">Shiur</p>
            <p className="mt-1 text-lg">Shiur Daled</p>
          </div>
        </div>

        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="mt-6 rounded-lg bg-black px-5 py-2 text-white"
          >
            Save Changes
          </button>
        )}
      </div>
    </main>
  );
}
