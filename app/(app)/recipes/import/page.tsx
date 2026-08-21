import { requireSession } from "@/lib/session";
import ImportRecipe from "./ImportRecipe";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  await requireSession();
  const { url } = await searchParams;

  return (
    <>
      <header className="flex h-[58px] items-center px-5">
        <h1 className="text-[18px] font-semibold -tracking-[0.02em]">Import a recipe</h1>
      </header>
      <ImportRecipe initialUrl={url ?? ""} />
    </>
  );
}
