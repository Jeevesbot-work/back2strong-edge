import type { SourcePost } from "./types";

/**
 * Synthetic posts for the dry-run. These are not scraped from the creators
 * and they are not copies of anyone's recipes — they only have to look like
 * the caption shape the importer expects (servings, gram lines, macros, method).
 * Handles here are placeholders, not the real creator list.
 */

function recipe(body: string): string {
  return body.replace(/\n[ ]+/g, "\n").trim();
}

export const FIXTURE_POSTS: SourcePost[] = [
  {
    platform: "instagram",
    sourceKey: "ig:lemon-tray",
    url: "https://example.invalid/p/lemon-tray",
    creditHandle: "examplecook",
    caption: recipe(`
      Lemon herb chicken tray
      Category: dinner
      Serves: 4
      Prep: 15 min
      Cook: 30 min
      Per serving: 520 kcal, 54g protein, 38g carbs, 11g fat
      Ingredients
      500g chicken breast
      300g baby potatoes
      200g broccoli
      1 tbsp olive oil
      1 lemon
      2 tsp dried oregano
      Salt and pepper
      Method
      1. Heat the oven to 200C.
      2. Toss the chicken and vegetables with the oil, lemon and oregano.
      3. Roast until the chicken is cooked through, then rest and divide into four.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:burrito-bowl",
    url: "https://example.invalid/p/burrito-bowl",
    creditHandle: "examplecook",
    caption: recipe(`
      Beef mince burrito bowl
      Category: lunch
      Serves: 4
      Prep: 10 min
      Cook: 20 min
      Per serving: 610 kcal, 46g protein, 58g carbs, 18g fat
      Ingredients
      500g extra lean beef mince
      240g rice
      1 tin black beans
      150g sweetcorn
      1 tbsp taco seasoning
      80g shredded lettuce
      Method
      1. Brown the mince with the seasoning.
      2. Heat the rice, beans and sweetcorn.
      3. Build four bowls and finish with the lettuce.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:skyr-oats",
    url: "https://example.invalid/p/skyr-oats",
    creditHandle: "examplecook",
    caption: recipe(`
      Skyr overnight oats
      Category: breakfast
      Serves: 2
      Prep: 10 min
      Cook: 0 min
      Per serving: 420 kcal, 32g protein, 48g carbs, 8g fat
      Ingredients
      80g oats
      300g 0% skyr
      200ml milk
      20g honey
      100g berries
      Method
      1. Stir the oats, skyr, milk and honey in a jar.
      2. Chill overnight and top with the berries before eating.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:egg-wrap",
    url: "https://example.invalid/p/egg-wrap",
    creditHandle: "examplecook",
    caption: recipe(`
      Egg white breakfast wrap
      Category: breakfast
      Serves: 1
      Prep: 5 min
      Cook: 8 min
      Per serving: 390 kcal, 34g protein, 36g carbs, 10g fat
      Ingredients
      150g egg whites
      1 large egg
      1 wholemeal wrap
      50g spinach
      40g low fat cottage cheese
      Method
      1. Scramble the egg whites and egg with the spinach.
      2. Spread the cottage cheese on the wrap, fill and roll.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:banana-muffins",
    url: "https://example.invalid/p/banana-muffins",
    creditHandle: "examplecook",
    caption: recipe(`
      Banana egg muffins
      Category: breakfast
      Serves: 2
      Prep: 8 min
      Cook: 10 min
      Per serving: 360 kcal, 28g protein, 40g carbs, 9g fat
      Ingredients
      3 eggs
      2 bananas
      60g oats
      80g 0% Greek yoghurt
      1 tsp baking powder
      Method
      1. Mash the bananas and mix with the eggs, oats, yoghurt and baking powder.
      2. Bake in a muffin tin until set.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:cottage-pot",
    url: "https://example.invalid/p/cottage-pot",
    creditHandle: "examplecook",
    caption: recipe(`
      Cottage cheese protein pot
      Category: snack
      Serves: 1
      Prep: 5 min
      Cook: 0 min
      Per serving: 180 kcal, 22g protein, 10g carbs, 5g fat
      Ingredients
      200g low fat cottage cheese
      50g pineapple
      1 tsp cinnamon
      Method
      1. Spoon the cottage cheese into a bowl.
      2. Top with the pineapple and cinnamon.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:yoghurt-pot",
    url: "https://example.invalid/p/yoghurt-pot",
    creditHandle: "examplecook",
    caption: recipe(`
      Yoghurt protein pot
      Category: snack
      Serves: 1
      Prep: 3 min
      Cook: 0 min
      Per serving: 210 kcal, 24g protein, 14g carbs, 6g fat
      Ingredients
      200g 0% Greek yoghurt
      15g honey
      10g dark chocolate
      Method
      1. Stir the honey through the yoghurt.
      2. Finish with the chopped chocolate.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:salmon-pasta",
    url: "https://example.invalid/p/salmon-pasta",
    creditHandle: "examplecook",
    caption: recipe(`
      Creamy salmon pasta
      Category: dinner
      Serves: 2
      Prep: 10 min
      Cook: 15 min
      Per serving: 700 kcal, 40g protein, 52g carbs, 32g fat
      Ingredients
      200g salmon
      160g pasta
      80ml double cream
      1 tbsp olive oil
      100g peas
      Method
      1. Cook the pasta and pan-fry the salmon.
      2. Stir in the cream and peas and toss with the pasta.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:app-promo",
    url: "https://example.invalid/p/app-promo",
    creditHandle: "examplecook",
    caption: "New week, new plan. Download my meal plan app and use code STRONG at checkout. Link in bio.",
  },
  {
    platform: "instagram",
    sourceKey: "ig:app-paywall",
    url: "https://example.invalid/p/app-paywall",
    creditHandle: "examplecook",
    caption: "This chicken tray looks unreal. The full recipe is in my app — unlock the recipe with the link in bio.",
  },
  {
    platform: "instagram",
    sourceKey: "ig:honey-garlic",
    url: "https://example.invalid/p/honey-garlic",
    creditHandle: "examplecook",
    caption: recipe(`
      High Protein Crispy Honey Garlic Chicken Fried Rice
      Category: dinner
      Serves: 4
      Prep: 20 min
      Cook: 25 min
      Per serving: 540 kcal, 48g protein, 55g carbs, 12g fat
      Ingredients
      600g chicken breast
      400g cooked rice
      200g mixed vegetables
      2 tbsp honey
      1 tbsp soy sauce
      Method
      1. Cook the chicken until browned.
      2. Fry the rice and vegetables, then glaze with honey and soy.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:turkey-cups",
    url: "https://example.invalid/p/turkey-cups",
    creditHandle: "examplecook",
    caption: recipe(`
      Turkey mince lettuce cups
      Category: dinner
      Serves: 4
      Prep: 10 min
      Cook: 15 min
      Per serving: 380 kcal, 42g protein, 12g carbs, 9g fat
      Ingredients
      400g turkey mince
      1 tbsp soy sauce
      200g lettuce
      100g cucumber
      80g 0% Greek yoghurt
      Method
      1. Brown the turkey mince with the soy sauce.
      2. Spoon it into lettuce leaves with cucumber and yoghurt.
    `),
  },
  {
    platform: "youtube",
    sourceKey: "yt:turkey-cups",
    url: "https://example.invalid/watch/turkey-cups",
    creditHandle: "Example Cook",
    titleHint: "Speedy turkey lettuce wraps",
    caption: recipe(`
      Speedy turkey lettuce wraps
      Category: dinner
      Serves: 4
      Prep: 10 min
      Cook: 15 min
      Per serving: 380 kcal, 42g protein, 12g carbs, 9g fat
      Ingredients
      400g turkey mince
      1 tbsp soy sauce
      200g lettuce
      100g cucumber
      80g 0% Greek yoghurt
      Method
      1. Brown the mince in a wide pan.
      2. Serve in lettuce with cucumber and a spoon of yoghurt.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:chicken-pitta",
    url: "https://example.invalid/p/chicken-pitta",
    creditHandle: "examplecook",
    caption: recipe(`
      Chicken pitta box
      Category: lunch
      Serves: 2
      Prep: 10 min
      Cook: 12 min
      Per serving: 480 kcal, 45g protein, 42g carbs, 12g fat
      Ingredients
      300g chicken breast
      2 wholemeal pittas
      100g lettuce
      80g 0% Greek yoghurt
      1 tsp paprika
      Method
      1. Season and cook the chicken, then slice it.
      2. Fill the pittas with chicken, lettuce and yoghurt.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:turkey-chilli",
    url: "https://example.invalid/p/turkey-chilli",
    creditHandle: "examplecook",
    caption: recipe(`
      Turkey chilli tray
      Category: dinner
      Serves: 4
      Prep: 10 min
      Cook: 30 min
      Per serving: 450 kcal, 48g protein, 36g carbs, 10g fat
      Ingredients
      500g turkey mince
      1 tin chopped tomatoes
      1 tin kidney beans
      200g peppers
      1 tbsp chilli powder
      Method
      1. Brown the turkey with the chilli powder.
      2. Simmer with the tomatoes, beans and peppers until thick.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:voiceover-lunch",
    url: "https://example.invalid/reel/voiceover-lunch",
    creditHandle: "examplecook",
    isReel: true,
    caption: "Lunch idea for the week. The grams are in the voiceover.",
    transcript: recipe(`
      Tuna rice lunch box
      Category: lunch
      Serves: 2
      Prep: 10 min
      Cook: 12 min
      Per serving: 460 kcal, 47g protein, 44g carbs, 8g fat
      Ingredients
      1 tin tuna in spring water
      160g rice
      150g sweetcorn
      100g cucumber
      1 tbsp light soy sauce
      Method
      1. Cook the rice and drain the tuna.
      2. Fold through the sweetcorn, cucumber and soy, then split into two boxes.
    `),
  },
  {
    platform: "instagram",
    sourceKey: "ig:gym-day",
    url: "https://example.invalid/p/gym-day",
    creditHandle: "examplecook",
    caption: "Leg day done. Back at it tomorrow.",
  },
];
