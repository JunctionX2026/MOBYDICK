import { badgeRecipe, type BadgeRecipeProps } from "./recipes/badge";
import { buttonRecipe } from "./recipes/button";
import { cardRecipe, type CardRecipeProps } from "./recipes/card";
import { variants } from "./variants";

/**
 * Replacing a variant library is only safe while the selection type stays as
 * narrow as the option table. These assertions fail to compile if inference
 * ever widens to `string`.
 */

// @ts-expect-error tone is limited to the declared option keys
badgeRecipe({ tone: "chartreuse" });

// @ts-expect-error size is limited to the declared option keys
buttonRecipe({ size: "huge" });

// @ts-expect-error a true/false option set accepts a boolean, not a string
cardRecipe({ selected: "yes" });

// @ts-expect-error unknown variant names are rejected
badgeRecipe({ unknownVariant: "x" });

const tone: BadgeRecipeProps["tone"] = "brand";
const selected: CardRecipeProps["selected"] = true;

const withoutDefaults = variants({
  variants: { tone: { neutral: "", brand: "" } },
});

// @ts-expect-error options stay narrow without a defaults block
withoutDefaults({ tone: "chartreuse" });

const result: string = badgeRecipe({ tone: "brand", emphasis: "solid" });

void tone;
void selected;
void result;
void withoutDefaults({ tone: "neutral" });
