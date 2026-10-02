import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Detection } from "@/lib/api/companies";
import { AddCompanyScreen } from "./add-company-screen";

const DETECTION: Detection = {
  name: "Acme",
  source: { kind: "board", board: "greenhouse", board_id: "acme" },
  jobs_found: 34,
  jobs_matched: 3,
  sample: [{ title: "Staff Frontend Engineer", url: "https://x.example/1", match_score: 88 }],
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("AddCompanyScreen", () => {
  it("disables the button until a URL is pasted", async () => {
    const user = userEvent.setup();
    render(<AddCompanyScreen />);
    const button = screen.getByRole("button", { name: "Find their jobs" });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText("Careers URL"), "acme.com/careers");
    expect(button).toBeEnabled();
  });

  it("shows the resolving state, then the detected result", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<AddCompanyScreen />);

    await user.type(screen.getByLabelText("Careers URL"), "acme.com/careers");
    await user.click(screen.getByRole("button", { name: "Find their jobs" }));

    expect(screen.getByText("Detecting the job board…")).toBeInTheDocument();
    expect(screen.getAllByText("acme.com")).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/companies\/detect$/);
    expect(JSON.parse(String(init?.body))).toEqual({ url: "https://acme.com/careers" });

    resolve(json(200, DETECTION));
    expect(await screen.findByText(/Detected greenhouse/)).toBeInTheDocument();
  });

  it("returns to the paste step with the error when detection fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(422, "Could not fetch that page"));
    const user = userEvent.setup();
    render(<AddCompanyScreen />);

    await user.type(screen.getByLabelText("Careers URL"), "acme.com/careers");
    await user.click(screen.getByRole("button", { name: "Find their jobs" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not fetch that page");
    expect(screen.getByLabelText("Careers URL")).toHaveValue("acme.com/careers");
  });

  it("cancel aborts the request and goes back", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError"))),
        ),
    );
    const user = userEvent.setup();
    render(<AddCompanyScreen />);

    await user.type(screen.getByLabelText("Careers URL"), "acme.com/careers");
    await user.click(screen.getByRole("button", { name: "Find their jobs" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Careers URL")).toHaveValue("acme.com/careers");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
