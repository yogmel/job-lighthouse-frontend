import { redirect } from "next/navigation";
import { AFTER_AUTH_PATH } from "@/lib/routes";

/** Signed-out visitors never get here: the proxy sends them to login first. */
export default function Home() {
  redirect(AFTER_AUTH_PATH);
}
