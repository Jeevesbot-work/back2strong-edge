// Movement library — the "training drop". Nick sees an exercise, drops the
// frames in, and it becomes a coached card here. Cards work with or without
// demo images (a "demo coming soon" state shows until frames are added).

export type Movement = {
  slug: string;
  name: string;
  subtitle: string;
  trains: string[];        // muscle tags
  equipment: string;
  aliases: string[];       // lowercased fragments to match a programme's exercise names
  images: { src: string; caption: string }[];
  why: string;
  steps: string[];
  cues: string[];
  setsReps: string;
  watchOuts: string[];
  sourceCredit?: string;
  addedOn: string;         // ISO date
};

export const MOVEMENTS: Movement[] = [
  {
    slug: "rotating-dumbbell-bench-press",
    name: "Rotating Dumbbell Bench Press",
    subtitle: "Shoulder-friendly chest press",
    trains: ["Chest", "Front delts", "Triceps"],
    equipment: "Dumbbells · flat bench",
    aliases: ["rotating dumbbell", "rotating db"],
    images: [
      { src: "/moves/rotating-db-press-1.jpg", caption: "Bottom — palms in, elbows tucked" },
      { src: "/moves/rotating-db-press-2.jpg", caption: "Press & rotate" },
      { src: "/moves/rotating-db-press-3.jpg", caption: "Top — palms forward, squeeze" },
    ],
    why:
      "The bottom position is the money. You start with the dumbbells turned in — palms facing each other, elbows tucked to your ribs — which is far kinder to the shoulder than a barbell bench where the elbows flare. As you press up you rotate the palms to face forward and squeeze the chest at the top. Full chest work, happy shoulders. One of the best pressing options for anyone with a cranky shoulder.",
    steps: [
      "Lie flat, dumbbells at the bottom of your chest, palms facing each other, elbows tucked close to your ribs.",
      "Press up and rotate — as the dumbbells rise, turn your palms to face your feet.",
      "At the top, squeeze the chest hard for a beat. Stop a couple of inches short of clashing the dumbbells.",
      "Reverse on the way down — rotate back to palms-in as the elbows return to your sides. 2–3 seconds down, controlled.",
    ],
    cues: ["Turn as you press.", "Elbows to your ribs at the bottom, not out wide.", "Squeeze at the top like you're crushing something between the dumbbells."],
    setsReps: "3 × 8–12 · leave 2–3 reps in the tank",
    watchOuts: ["Don't clash the dumbbells at the top — stop a couple of inches apart.", "Keep the rotation smooth through the whole press, not a wrist-flick at the end."],
    sourceCredit: "Saved from @dickersonross",
    addedOn: "2026-07-23",
  },

  // ── Barry — Session A ──────────────────────────────────────────────
  {
    slug: "sit-to-stand",
    name: "Sit-to-Stand",
    subtitle: "Knee-friendly squat pattern",
    trains: ["Quads", "Glutes"],
    equipment: "High bench or sturdy chair",
    aliases: ["sit-to-stand", "sit to stand", "box squat"],
    images: [],
    why:
      "This is us testing the knee, not thrashing it. Standing up from a high bench takes the deep part of the squat out — the bit that usually bothers a knee — so we groove the movement and let the joint tell us how it feels. Weeks 1–2 it's bodyweight only. If the knee stays comfortable, we lower the bench and add a little load from Week 3. Master this and a proper squat is just a matter of time.",
    steps: [
      "Sit tall on a high bench, feet flat, roughly shoulder-width.",
      "Arms out in front for balance. Lean forward slightly from the hips.",
      "Drive through your heels and stand all the way up. Squeeze the glutes at the top.",
      "Sit back down under control — 2–3 seconds — tapping the bench without flopping onto it.",
    ],
    cues: ["Drive through the heels.", "Chest up, don't collapse forward.", "Control the way down — no flopping."],
    setsReps: "3 × 10–12 · bodyweight (Weeks 1–2)",
    watchOuts: ["Knee discomfort above 3/10 — stop the set and tell Nick.", "Keep the bench high enough that it stays comfortable. Lower it only when the knee's earned it."],
    addedOn: "2026-07-23",
  },
  {
    slug: "seated-chest-press",
    name: "Seated Chest Press (Machine)",
    subtitle: "Supported pressing",
    trains: ["Chest", "Front delts", "Triceps"],
    equipment: "Chest press machine",
    aliases: ["seated chest press", "chest press"],
    images: [],
    why:
      "The machine does the balancing so you can just press — perfect while we build the habit and keep everything shoulder-safe. Back supported, smooth path, no wobble. It lets you push a bit harder without any risk of a dumbbell going wandering.",
    steps: [
      "Set the seat so the handles sit at chest height, not up by your shoulders.",
      "Back flat against the pad, feet planted.",
      "Press out smoothly until the arms are nearly straight — don't lock out hard.",
      "Control it back until you feel a gentle stretch across the chest. Breathe out on the push, in on the return.",
    ],
    cues: ["Smooth out, smooth back.", "Breathe out as you press — never hold your breath.", "Handles at chest height, not shoulders."],
    setsReps: "3 × 10–12 · 2–3 reps in the tank",
    watchOuts: ["Never hold your breath under load — that's the one that matters for the heart.", "Don't slam the weight stack down between reps."],
    addedOn: "2026-07-23",
  },
  {
    slug: "seated-row",
    name: "Seated Row (Machine)",
    subtitle: "Mid-back builder",
    trains: ["Back", "Biceps", "Rear delts"],
    equipment: "Seated row machine",
    aliases: ["seated row", "cable row"],
    images: [],
    why:
      "Balances out all the pressing and pulls your shoulders back where they belong — great for posture and for keeping the shoulder joint healthy. We pull to the ribs and squeeze the shoulder blades together. Simple, safe, and you'll feel it in all the right places.",
    steps: [
      "Chest up against the pad, slight bend in the knees.",
      "Grab the handles, arms straight to start, shoulders relaxed forward.",
      "Pull to your ribs, leading with the elbows and squeezing the shoulder blades together.",
      "Control it back out until the arms are straight again — don't let it yank you forward.",
    ],
    cues: ["Chest up, pull to your ribs.", "Squeeze the shoulder blades at the end.", "Control it back — don't get pulled forward."],
    setsReps: "3 × 10–12",
    watchOuts: ["Don't heave with the lower back — the arms and mid-back do the work.", "Keep it smooth, no jerking."],
    addedOn: "2026-07-23",
  },
  {
    slug: "glute-bridge",
    name: "Glute Bridge",
    subtitle: "Hip & posterior chain",
    trains: ["Glutes", "Hamstrings"],
    equipment: "Bench · (plate optional)",
    aliases: ["glute bridge", "hip thrust"],
    images: [],
    why:
      "This builds the muscle that protects your knee and your back — the glutes. Strong hips take the strain off everything else. Bodyweight to start; once 12 reps feels easy, we rest a plate across the hips to keep it progressing.",
    steps: [
      "Shoulders resting on a bench, feet flat on the floor, knees bent.",
      "Start with hips low.",
      "Drive through the heels and push the hips up until your body's in a straight line from knees to shoulders.",
      "Squeeze the glutes hard at the top for a beat, then lower under control.",
    ],
    cues: ["Drive through the heels.", "Squeeze the glutes at the top — hold for a beat.", "Ribs down, don't arch the lower back."],
    setsReps: "3 × 10–12 · add a plate when it's easy",
    watchOuts: ["Push the hips up with the glutes, not by arching the lower back.", "Full range — all the way up, all the way down."],
    addedOn: "2026-07-23",
  },

  // ── Barry — Session B ──────────────────────────────────────────────
  {
    slug: "leg-press",
    name: "Leg Press (Machine)",
    subtitle: "Knee-spared leg strength",
    trains: ["Quads", "Glutes", "Hamstrings"],
    equipment: "Leg press machine",
    aliases: ["leg press"],
    images: [],
    why:
      "A big leg movement with the back fully supported and no balance required — ideal while we're still listening to the knee. Feet high on the plate shifts the work toward the glutes and hamstrings and spares the knee. Weeks 1–2 it's the lightest setting to learn the groove; real loading comes Week 3 if the knee's stayed green.",
    steps: [
      "Sit back, back and head against the pad, feet high on the plate about shoulder-width.",
      "Release the safeties and lower the platform only as far as stays comfortable — no deeper.",
      "Drive through the heels to press back up, without locking the knees out hard at the top.",
      "Control the descent every rep — 2–3 seconds down.",
    ],
    cues: ["Feet high on the plate — spare the knee.", "Only as deep as stays comfortable.", "Drive through the heels, soft knees at the top."],
    setsReps: "3 × 10–12 · lightest setting (Weeks 1–2)",
    watchOuts: ["Never let the knees cave inward.", "Don't chase depth — comfort first while the knee's settling.", "Knee pain above 3/10 — stop and tell Nick."],
    addedOn: "2026-07-23",
  },
  {
    slug: "seated-shoulder-press",
    name: "Seated Shoulder Press",
    subtitle: "Supported overhead press",
    trains: ["Shoulders", "Triceps"],
    equipment: "Machine or dumbbells · back support",
    aliases: ["seated shoulder press", "shoulder press", "overhead press"],
    images: [],
    why:
      "Overhead strength with the back supported so there's no strain on the lower back. Smooth and controlled — we're building capable shoulders, not testing your ego. Great for everyday strength: lifting things onto shelves, carrying, all of it.",
    steps: [
      "Back supported against the pad, handles or dumbbells at shoulder height.",
      "Press smoothly overhead until the arms are nearly straight.",
      "Don't slam into lockout — stop just short and control it.",
      "Lower back to shoulder height under control. Breathe out on the press.",
    ],
    cues: ["Press smooth — no slamming at the top.", "Breathe out as you press.", "Back stays supported, ribs down."],
    setsReps: "3 × 10–12",
    watchOuts: ["Keep it light enough that form stays clean — shoulders are easy to overload.", "Never hold your breath under load."],
    addedOn: "2026-07-23",
  },
  {
    slug: "lat-pulldown",
    name: "Lat Pulldown",
    subtitle: "Vertical pull",
    trains: ["Back", "Biceps"],
    equipment: "Lat pulldown machine",
    aliases: ["lat pulldown", "pulldown"],
    images: [],
    why:
      "Builds the width of the back and the pulling strength that a lifetime of desks and phones erodes. Pull to the top of the chest, control it back up. Another one that's great for the posture and the shoulders.",
    steps: [
      "Secure your thighs under the pads. Grab the bar a bit wider than shoulder-width.",
      "Start with arms straight, lean back very slightly.",
      "Pull the bar to the top of your chest, leading with the elbows.",
      "Control it all the way back up until the arms are straight — don't let it snap back.",
    ],
    cues: ["Pull to the top of your chest.", "Lead with the elbows, not the hands.", "Control it back up — no swinging."],
    setsReps: "3 × 10–12",
    watchOuts: ["Don't yank with the whole body — a small lean back is fine, heaving isn't.", "Never pull behind the neck."],
    addedOn: "2026-07-23",
  },
  {
    slug: "dumbbell-romanian-deadlift",
    name: "Dumbbell Romanian Deadlift",
    subtitle: "Knee-friendly hip hinge",
    trains: ["Hamstrings", "Glutes", "Back"],
    equipment: "Dumbbells",
    aliases: ["romanian deadlift", "rdl", "dumbbell romanian"],
    images: [],
    why:
      "The best knee-friendly leg exercise there is — the knees barely bend, it's all hips. You'll feel it right in the hamstrings and glutes. It also teaches the hip hinge, which is how you should be picking things up off the floor for the rest of your life. We'll groove this one together first before you do it alone.",
    steps: [
      "Stand tall holding dumbbells in front of your thighs, soft bend in the knees.",
      "Push the hips back — like closing a car door with your backside — letting the dumbbells travel down the front of your legs.",
      "Go as far as you feel a stretch in the hamstrings, back flat throughout, dumbbells close to the legs.",
      "Drive the hips forward to stand tall and squeeze the glutes. Slow and controlled.",
    ],
    cues: ["Push the hips back, don't squat down.", "Dumbbells stay close to your legs.", "Feel the hamstrings stretch, then drive the hips through."],
    setsReps: "3 × 10–12 · start light",
    watchOuts: ["Back stays flat — never round it.", "This is a hip hinge, not a squat: the knees barely move.", "Start light and groove it before adding weight."],
    addedOn: "2026-07-23",
  },
];

export function getMovement(slug: string): Movement | undefined {
  return MOVEMENTS.find((m) => m.slug === slug);
}

// Resolve a programme's exercise name (e.g. "Seated Chest Press (machine)") to
// its movement card, matching on the movement's aliases.
export function movementForExercise(exerciseName: string): Movement | undefined {
  const n = exerciseName.toLowerCase();
  return MOVEMENTS.find((m) => m.aliases.some((a) => n.includes(a)));
}
