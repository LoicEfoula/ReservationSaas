"use client";

import { useActionState } from "react";
import { saveStaffHours } from "@/app/actions/staff";

export function HoursForm({
  staffId,
  children,
}: {
  staffId: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(saveStaffHours, null);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="staffId" value={staffId} />
      {children}
      <button
        disabled={pending}
        className="rounded bg-black p-3 text-white disabled:opacity-60"
      >
        {pending ? "Enregistrement..." : "Enregistrer les horaires"}
      </button>
      {state && (
        <p
          role="status"
          className={`rounded p-3 text-sm ${
            state.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}