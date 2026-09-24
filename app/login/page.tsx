"use client";

import { useState } from "react";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Shiur Daled</h1>

          <p className="mt-1 text-xl font-semibold">Mivtzoim</p>

          <p className="mt-3 text-gray-600">
            {isSignUp
              ? "Create your account to start tracking your Mivtzoim."
              : "Sign in to continue tracking your Mivtzoim."}
          </p>
        </div>

        {isSignUp && (
          <div className="mt-8">
            <label className="text-sm font-medium">Name</label>

            <input
              type="text"
              placeholder="Your name"
              className="mt-2 w-full rounded-lg border p-3 outline-none focus:ring-2"
            />
          </div>
        )}

        <div className={isSignUp ? "mt-4" : "mt-8"}>
          <label className="text-sm font-medium">Email</label>

          <input
            type="email"
            placeholder="you@example.com"
            className="mt-2 w-full rounded-lg border p-3 outline-none focus:ring-2"
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium">Password</label>

          <input
            type="password"
            placeholder="Password"
            className="mt-2 w-full rounded-lg border p-3 outline-none focus:ring-2"
          />
        </div>

        <button
          type="button"
          onClick={() =>
            alert(
              isSignUp
                ? "Account creation will be connected next."
                : "Sign in will be connected next."
            )
          }
          className="mt-6 w-full rounded-lg bg-black px-5 py-3 font-medium text-white"
        >
          {isSignUp ? "Create Account" : "Sign In"}
        </button>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-gray-600 underline"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </main>
  );
}
