import { MainDashboard } from "@/components/layout/MainDashboard";

export default function DemoReplayPage() {
  return (
    <MainDashboard
      race={{
        year: 0,
        event: "Demo Grand Prix",
        sessionType: "R",
      }}
    />
  );
}
