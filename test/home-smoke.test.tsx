import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("home", () => {
  it("renderiza el checkout principal", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /confirma tu participación/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /solicitar lugar como médico/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /solicitar valoración como paciente/i })).toBeInTheDocument();
    expect(screen.getByText(/paciente seleccionado/i)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "PILULA MedPlanner" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("PI")).not.toBeInTheDocument();
  });
});
