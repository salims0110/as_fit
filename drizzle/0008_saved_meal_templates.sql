CREATE TABLE "meal_template_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"food_item_id" integer NOT NULL,
	"quantity" numeric(7, 2) NOT NULL,
	CONSTRAINT "meal_template_items_quantity_ck" CHECK ("meal_template_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "meal_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name_ar" varchar(120) NOT NULL,
	"default_meal_type" "meal_type_t",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_templates_user_name_uq" UNIQUE("user_id","name_ar")
);
--> statement-breakpoint
ALTER TABLE "meal_template_items" ADD CONSTRAINT "meal_template_items_template_id_meal_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."meal_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_template_items" ADD CONSTRAINT "meal_template_items_food_item_id_food_dictionary_id_fk" FOREIGN KEY ("food_item_id") REFERENCES "public"."food_dictionary"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_meal_template_items_tpl" ON "meal_template_items" USING btree ("template_id");