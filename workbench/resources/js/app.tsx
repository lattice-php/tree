/// <reference types="@lattice-php/lattice/svg-sprite-client" />
import "../css/app.css";
import { createLatticeApp } from "@lattice-php/lattice";
import sprite from "virtual:svg-sprite";
import tree from "../../../resources/js/plugin";

// The package under development is the repo root, so it is absent from its own
// vendor/composer/installed.json and `virtual:lattice/plugins` resolves empty
// here. Import the plugin entry directly instead — consumers get the same
// module through the discovery seam.
void createLatticeApp({
  plugins: [tree],
  sprite,
  i18n: { namespaces: ["lattice", "tree"] },
});
