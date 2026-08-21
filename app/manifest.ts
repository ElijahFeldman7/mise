import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "mise",
    short_name: "mise",
    description: "Plan the week, write the list, cross it off at the store.",
    start_url: "/week",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f5f0",
    theme_color: "#f8f5f0",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
