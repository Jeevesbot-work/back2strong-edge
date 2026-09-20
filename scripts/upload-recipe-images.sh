#!/usr/bin/env bash
# Upload the generated recipe photography to Supabase storage.
#
# The images live outside the repo (they are large and regenerable):
#   ~/Documents/edge-recipe-images/web/<slug>.jpg
#
# Each file is uploaded to the public `recipe-images` bucket under its own slug,
# which is what `recipes.image_url` already points at. Re-running is safe:
# x-upsert replaces a file rather than erroring.
#
# Usage:
#   SUPABASE_SERVICE_ROLE_KEY=... ./scripts/upload-recipe-images.sh
#
# Get the key from: Supabase dashboard -> Project Settings -> API -> service_role
# It is a secret: do not commit it, and do not paste it into a chat window.

set -euo pipefail

PROJECT_REF="xlrvcfxgvxfyrmduztza"
BUCKET="recipe-images"
SRC="${HOME}/Documents/edge-recipe-images/web"

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_SERVICE_ROLE_KEY is not set." >&2
  echo "Run: SUPABASE_SERVICE_ROLE_KEY=... $0" >&2
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  echo "No images found at $SRC" >&2
  exit 1
fi

total=0
failed=0

for file in "$SRC"/*.jpg; do
  name="$(basename "$file")"
  code="$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "https://${PROJECT_REF}.supabase.co/storage/v1/object/${BUCKET}/${name}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: image/jpeg" \
    -H "x-upsert: true" \
    --data-binary "@${file}")"

  if [[ "$code" == "200" ]]; then
    printf '  ok   %s\n' "$name"
    total=$((total + 1))
  else
    printf '  FAIL %s (HTTP %s)\n' "$name" "$code" >&2
    failed=$((failed + 1))
  fi
done

echo
echo "Uploaded ${total} image(s), ${failed} failed."

if [[ "$failed" -eq 0 ]]; then
  echo "Public URL pattern:"
  echo "  https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${BUCKET}/<slug>.jpg"
  echo "recipes.image_url is already set to match — the Fuel tab should light up on next load."
else
  exit 1
fi
