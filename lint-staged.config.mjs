export default {
  "*.{ts,tsx,mjs}": ["eslint --fix --max-warnings=0 --no-warn-ignored", "prettier --write"],
  "*.{json,md}": ["prettier --write"],
};
