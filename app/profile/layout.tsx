import ViewAsBanner from "@/components/ViewAsBanner";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewAsBanner />
      {children}
    </>
  );
}
