import boundaries from "eslint-plugin-boundaries";

const LAYERS = ["domain", "application", "infrastructure", "presentation"];

// The first wildcard (`**`) is captured too, so it needs a name even though no policy reads it.
const MODULE_ELEMENT = {
  type: "module",
  pattern: "**/modules/*/*",
  capture: ["pathPrefix", "group", "module"],
};

const layerFiles = LAYERS.map((layer) => ({
  category: layer,
  pattern: `**/modules/*/*/${layer}/**`,
}));

function forbidLayers(fromLayer, forbiddenLayers, message) {
  return {
    from: { file: { categories: fromLayer } },
    disallow: { to: { file: { categories: { anyOf: forbiddenLayers } } } },
    message,
  };
}

// A module is identified by its group and name, so either one differing means "another module".
function inOtherModule(capturedKey, extraSelector = {}) {
  return {
    element: {
      type: "module",
      captured: { [capturedKey]: `!{{ from.captured.${capturedKey} }}` },
      ...extraSelector,
    },
  };
}

function otherModuleTargets(extraSelector) {
  return [inOtherModule("module", extraSelector), inOtherModule("group", extraSelector)];
}

/**
 * R18 layer direction (01 section 2, ADR-011a) and R19 module entry point (ADR-011).
 * checkInternals is required: layers live inside one module element, and the plugin
 * ignores dependencies inside an element unless told otherwise.
 */
export const architectureBlock = {
  name: "banijjik/architecture-boundaries",
  files: ["**/modules/**/*.ts"],
  plugins: { boundaries },
  settings: {
    // Sources import with ".js" suffixes (NodeNext); the plain node resolver cannot map them to ".ts".
    "import/resolver": { typescript: { alwaysTryTypes: true } },
    "boundaries/elements": [MODULE_ELEMENT],
    "boundaries/files": layerFiles,
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "allow",
        checkInternals: true,
        policies: [
          forbidLayers(
            "domain",
            ["application", "infrastructure", "presentation"],
            "Domain depends on nothing else in the module (ADR-011a).",
          ),
          forbidLayers(
            "application",
            ["infrastructure", "presentation"],
            "Application depends on domain only.",
          ),
          forbidLayers(
            "infrastructure",
            ["presentation"],
            "Infrastructure must not know presentation.",
          ),
          forbidLayers(
            "presentation",
            ["infrastructure"],
            "Presentation reaches data only through application.",
          ),
          {
            from: { file: { categories: "domain" } },
            disallow: { to: otherModuleTargets({}) },
            message: "Domain code does not import other modules (ADR-011a).",
          },
          {
            from: { element: { type: "module" } },
            disallow: { to: otherModuleTargets({ fileInternalPath: "!index.ts" }) },
            message: "Import another module only through its index.ts (ADR-011).",
          },
        ],
      },
    ],
  },
};
