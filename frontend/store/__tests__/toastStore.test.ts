import { describe, it, expect } from "vitest";
import { useToastStore, toast } from "../toastStore";

describe("toastStore", () => {
  it("pushes toasts and dismisses them", () => {
    toast.success("Success message");
    let toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].message).toBe("Success message");
    expect(toasts[0].variant).toBe("success");

    const id = toasts[0].id;
    useToastStore.getState().dismiss(id);
    toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(0);
  });

  it("supports error and info toasts", () => {
    toast.error("Error occurred");
    toast.info("Info note");

    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(2);
    expect(toasts[0].variant).toBe("error");
    expect(toasts[1].variant).toBe("info");
  });
});
