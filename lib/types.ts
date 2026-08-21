export type Aisle =
  | "produce" | "meat" | "seafood" | "dairy" | "bakery"
  | "pantry" | "spices" | "frozen" | "drinks" | "household" | "other";

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  active_household_id: string | null;
  diet_tags: string[];
  avoid_ingredients: string[];
  liked_cuisines: string[];
  weeknight_max_minutes: number;
  created_at: string;
  last_seen_at: string | null;
};

export type HouseholdMember = {
  household_id: string;
  user_id: string;
  role: "owner" | "member";
  nickname: string | null;
  joined_at: string;
};

export type Recipe = {
  id: string;
  title: string;
  description: string | null;
  source: "themealdb" | "curated" | "user";
  source_id: string | null;
  source_url: string | null;
  image_url: string | null;
  image_path: string | null;
  instructions: string[];
  total_minutes: number | null;
  active_minutes: number | null;
  servings: number;
  oven_temp_f: number | null;
  cuisine: string | null;
  category: string | null;
  tags: string[];
  diet_flags: string[];
  effort: number;
  is_public: boolean;
  owner_id: string | null;
  household_id: string | null;
  forked_from: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  position: number;
  raw_text: string | null;
  quantity: number | null;
  unit: string | null;
  item: string;
  item_key: string;
  note: string | null;
  aisle: Aisle;
  optional: boolean;
};

export type RecipePhoto = {
  id: string;
  recipe_id: string;
  household_id: string | null;
  taken_by: string | null;
  storage_path: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  caption: string | null;
  taken_at: string;
};

export type SlotTemplate = {
  id: string;
  household_id: string;
  name: string;
  at_time: string | null;
  position: number;
};

export type PlanEntry = {
  id: string;
  household_id: string;
  on_date: string;
  slot_label: string;
  slot_time: string | null;
  position: number;
  recipe_id: string | null;
  free_text: string | null;
  servings: number;
  note: string | null;
  cooked_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type GroceryList = {
  id: string;
  household_id: string;
  week_start: string;
  created_at: string;
};

export type GroceryItem = {
  id: string;
  list_id: string;
  household_id: string;
  item: string;
  item_key: string;
  quantity: number | null;
  unit: string | null;
  display_qty: string | null;
  aisle: Aisle;
  checked: boolean;
  checked_at: string | null;
  checked_by: string | null;
  checked_via: "tap" | "receipt" | null;
  source: "plan" | "manual" | "receipt";
  from_recipes: string[];
  added_by: string | null;
  position: number;
  created_at: string;
};

export type PantryItem = {
  household_id: string;
  item_key: string;
  item: string;
};

export type Receipt = {
  id: string;
  household_id: string;
  uploaded_by: string | null;
  image_path: string | null;
  store: string | null;
  purchased_on: string | null;
  raw_text: string | null;
  line_count: number;
  matched_count: number;
  created_at: string;
};

export type ReceiptLine = {
  id: string;
  receipt_id: string;
  raw_line: string;
  parsed_name: string | null;
  price: number | null;
  matched_item_id: string | null;
  confidence: number | null;
  status: "auto" | "suggested" | "confirmed" | "rejected" | "unmatched";
};

export type RecipeEvent = {
  id: string;
  household_id: string;
  user_id: string | null;
  recipe_id: string;
  kind: "planned" | "cooked" | "rated" | "skipped" | "saved" | "unsaved";
  rating: number | null;
  happened_at: string;
};

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row> & Record<string, unknown>;
  Update: Partial<Row> & Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      households: Table<Household>;
      profiles: Table<Profile>;
      household_members: Table<HouseholdMember>;
      recipes: Table<Recipe>;
      recipe_ingredients: Table<RecipeIngredient>;
      recipe_photos: Table<RecipePhoto>;
      slot_templates: Table<SlotTemplate>;
      plan_entries: Table<PlanEntry>;
      grocery_lists: Table<GroceryList>;
      grocery_items: Table<GroceryItem>;
      pantry_items: Table<PantryItem>;
      receipts: Table<Receipt>;
      receipt_lines: Table<ReceiptLine>;
      recipe_events: Table<RecipeEvent>;
    };
    Views: Record<string, never>;
    Functions: {
      join_household: { Args: { code: string }; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PlanEntryWithRecipe = PlanEntry & {
  recipe: Pick<Recipe, "id" | "title" | "image_url" | "image_path" | "total_minutes" | "oven_temp_f" | "servings"> | null;
};

export type RecipeWithIngredients = Recipe & {
  recipe_ingredients: RecipeIngredient[];
  recipe_photos?: RecipePhoto[];
};
