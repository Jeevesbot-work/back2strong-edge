import ViewAsBanner from "@/components/ViewAsBanner";

export default async function SleepLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewAsBanner />
      {children}
    </>
  );
}
