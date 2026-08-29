import JarvisScreen from "./JarvisScreen";

// Access control for this page is handled by middleware.ts (the private-link
// gate covers all of /admin/:path*), matching the rest of the admin area.
export default function JarvisPage() {
  return <JarvisScreen />;
}
