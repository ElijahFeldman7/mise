import { requireSession } from "@/lib/session";
import RecipeForm from "../RecipeForm";

export default async function NewRecipePage() {
  await requireSession();

  return (
    <RecipeForm
      initial={{
        title: "",
        totalMinutes: "",
        servings: "4",
        ovenTempF: "",
        cuisine: "",
        category: "dinner",
        tags: [],
        imagePath: null,
        imageUrl: null,
        ingredients: [{ quantityText: "", item: "" }],
        instructions: [""],
      }}
    />
  );
}
