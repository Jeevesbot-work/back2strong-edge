import ViewAsBanner from "@/components/ViewAsBanner";

export default async function CheckInLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewAsBanner />
      {children}
    </>
  );
}
