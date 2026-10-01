import { MainDashboard } from "@/components/layout/MainDashboard";

interface ReplayPageProps {
  params: Promise<{ year: string; event: string; session: string }>;
}

export default async function ReplayPage({ params }: ReplayPageProps) {
  const { year, event, session } = await params;

  return (
    <MainDashboard
      race={{
        year: Number(year),
        event: decodeURIComponent(event),
        sessionType: session,
      }}
    />
  );
}
