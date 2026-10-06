"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Invia il modulo all'azione senza il reset automatico di React: i campi restano
 * come li ha lasciati l'admin (utile quando l'azione risponde con errori o conflitti).
 * Include il pulsante premuto (es. name="confirm" value="1").
 */
export function useSubmit(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
}
