import ViewAsBanner from "@/components/ViewAsBanner";

export default async function WeeklyReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewAsBanner />
      {children}
    </>
  );
}
